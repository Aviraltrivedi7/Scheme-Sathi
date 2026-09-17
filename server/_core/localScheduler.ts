/**
 * Standalone in-process scheduler: replaces the platform Heartbeat service.
 *
 * Two delivery paths, both idempotent:
 * 1. In-memory one-shot timers for freshly created jobs (same UX as platform).
 * 2. A periodic DB reconciliation scan that delivers anything whose time has
 *    passed — this covers restarts, since in-memory jobs vanish while their
 *    taskUids persist on the business rows (application_reminders,
 *    document_review_assignments, document_reminder_settings).
 *
 * Handlers already guard with `status !== "scheduled"` lookups, so a timer
 * and the scan racing on the same row is harmless.
 */
import { SignJWT } from "jose";
import type { Express } from "express";
import { and, eq, lte } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { STANDALONE_MODE, sessionSecret } from "./env";
import {
  applicationReminders,
  documentReviewAssignments,
  documentReminderSettings,
} from "../../drizzle/schema";
import {
  deliverDocumentReviewDueReminder,
  ensureDefaultSchemeSources,
  getDb,
  markApplicationReminderDelivered,
  runAllEnabledSchemeSources,
  saveSchemeSyncTask,
} from "../db";

type LocalJob = {
  taskUid: string;
  name: string;
  cron: string;
  path: string;
  enabled: boolean;
  /** Next fire time in ms. */
  nextAt: number;
  timer: NodeJS.Timeout;
};

const jobs = new Map<string, LocalJob>();

let app: Express | null = null;
let port = 3000;
let scanTimer: NodeJS.Timeout | null = null;

/** Cron expression: `sec min hour dom mon dow` (seconds always 0 here), UTC, minute-accurate. */
export function nextCronMatch(cron: string, from = new Date()): number {
  const fields = cron.trim().split(/\s+/);
  if (fields.length < 6) throw new Error("cron must have 6 fields");
  const [, minute, hour, dom, month] = fields.map(f => f.trim());

  const match = (value: string, current: number) => {
    if (value === "*") return true;
    return value.split(",").some(part => {
      const step = part.match(/^\*\/(\d+)$/);
      if (step) {
        const every = Number(step[1]);
        return Number.isInteger(every) && every > 0 && current % every === 0;
      }
      const num = Number(part);
      return Number.isInteger(num) && num === current;
    });
  };

  // One-shot reminder crons are minute-accurate (`0 M H D MON *`); recurring
  // daily scans use fixed times. Scan up to 366 days ahead for the first match.
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      match(minute, cursor.getUTCMinutes()) &&
      match(hour, cursor.getUTCHours()) &&
      match(dom, cursor.getUTCDate()) &&
      match(month, cursor.getUTCMonth() + 1)
    ) {
      return cursor.getTime();
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  throw new Error("Could not resolve next cron match within a year");
}

async function fire(job: LocalJob) {
  if (!app) return;
  // Mint the same cron session the platform heartbeat sends: subject
  // `cron_<taskUid>` signed with the session secret. authenticateRequest
  // resolves it to { isCron: true, taskUid } in standalone mode.
  const token = await new SignJWT({
    openId: `cron_${job.taskUid}`,
    appId: "local-scheduler",
    name: job.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
    .sign(new TextEncoder().encode(sessionSecret()));

  try {
    const response = await fetch(`http://127.0.0.1:${port}${job.path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        cookie: `${COOKIE_NAME}=${token}`,
      },
      body: "{}",
    });
    if (!response.ok)
      console.warn(
        `[LocalScheduler] job ${job.name} handler returned ${response.status}`
      );
  } catch (error) {
    console.warn(`[LocalScheduler] job ${job.name} fire failed:`, String(error));
  }
}

function scheduleNext(job: LocalJob) {
  clearTimeout(job.timer);
  if (!job.enabled) return;
  job.timer = setTimeout(() => {
    fire(job).finally(() => {
      if (!job.enabled) return;
      // One-shot reminder jobs self-disable after delivery, mirroring the
      // platform handlers' updateHeartbeatJob({enable:false}) behaviour.
      const reminderStyle = /scheme-sathi-(reminder|review-due|review-snooze)-/.test(
        job.name
      );
      if (reminderStyle) {
        job.enabled = false;
        return;
      }
      job.nextAt = nextCronMatch(job.cron);
      scheduleNext(job);
    });
  }, Math.max(0, job.nextAt - Date.now()));
}

/** Register a job, optionally with a caller-persisted taskUid (restart re-arm). */
function registerJob(taskUid: string, job: {
  name: string;
  cron: string;
  path: string;
}): { taskUid: string; nextExecutionAt: string } {
  const nextAt = nextCronMatch(job.cron);
  const local: LocalJob = {
    taskUid,
    name: job.name,
    cron: job.cron,
    path: job.path,
    enabled: true,
    nextAt,
    timer: setTimeout(() => {}, 0),
  };
  jobs.set(taskUid, local);
  scheduleNext(local);
  return { taskUid, nextExecutionAt: new Date(nextAt).toISOString() };
}

export function createLocalHeartbeatJob(job: {
  name: string;
  cron: string;
  path: string;
}): { taskUid: string; nextExecutionAt: string } {
  return registerJob(`local-cron-${crypto.randomUUID()}`, job);
}

/** Re-register with a taskUid already persisted on a business row (e.g. after restart). */
function rearmJobWithUid(taskUid: string, job: {
  name: string;
  cron: string;
  path: string;
}): { taskUid: string; nextExecutionAt: string } {
  return registerJob(taskUid, job);
}

export function updateLocalHeartbeatJob(
  taskUid: string,
  patch: { enable?: boolean }
): { nextExecutionAt: string | null } {
  const job = jobs.get(taskUid);
  if (!job) return { nextExecutionAt: null };
  if (patch.enable !== undefined) job.enabled = patch.enable;
  if (job.enabled) {
    if (Date.now() >= job.nextAt) job.nextAt = nextCronMatch(job.cron);
    scheduleNext(job);
  } else {
    clearTimeout(job.timer);
  }
  return {
    nextExecutionAt: job.enabled ? new Date(job.nextAt).toISOString() : null,
  };
}

export function deleteLocalHeartbeatJob(taskUid: string) {
  const job = jobs.get(taskUid);
  if (job) {
    clearTimeout(job.timer);
    jobs.delete(taskUid);
  }
}

export function listLocalHeartbeatJobs() {
  return Array.from(jobs.values()).map(job => ({
    taskUid: job.taskUid,
    name: job.name,
    enabled: job.enabled,
    nextExecutionAt: job.enabled
      ? new Date(job.nextAt).toISOString()
      : null,
  }));
}

/** Bind the scheduler to the running app and start the recovery scan (standalone only). */
export function attachLocalScheduler(expressApp: Express, httpPort: number) {
  if (!STANDALONE_MODE) return;
  app = expressApp;
  port = httpPort;
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = setInterval(() => {
    scanDueWork().catch(error =>
      console.warn("[LocalScheduler] recovery scan failed:", String(error))
    );
  }, 60_000);
}

/**
 * Durable catch-up: deliver anything recorded in the DB whose time has come,
 * regardless of in-memory timers. Covers restarts and missed fires.
 */
async function scanDueWork() {
  const db = await getDb();
  if (!db) return;
  const now = new Date();

  // One-time application reminders past their remindAt.
  const dueReminders = await db
    .select({
      id: applicationReminders.id,
    })
    .from(applicationReminders)
    .where(
      and(
        eq(applicationReminders.status, "scheduled"),
        lte(applicationReminders.remindAt, now)
      )
    )
    .limit(50);
  for (const reminder of dueReminders) {
    try {
      await markApplicationReminderDelivered(reminder.id);
    } catch (error) {
      console.warn(
        `[LocalScheduler] reminder ${reminder.id} delivery failed:`,
        String(error)
      );
    }
  }

  // Reviewer due-date reminders past their reminderAt.
  const dueReviews = await db
    .select({
      taskUid: documentReviewAssignments.reminderScheduleCronTaskUid,
    })
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.reminderStatus, "scheduled"),
        lte(documentReviewAssignments.reminderAt, now)
      )
    )
    .limit(50);
  for (const review of dueReviews) {
    if (!review.taskUid) continue;
    try {
      await deliverDocumentReviewDueReminder(review.taskUid);
    } catch (error) {
      console.warn(
        `[LocalScheduler] review reminder delivery failed:`,
        String(error)
      );
    }
  }
}

/**
 * Re-arm the daily document-expiry scan on boot using the taskUid persisted in
 * document_reminder_settings, so the admin status row stays truthful and the
 * in-memory timer matches the DB reference after every restart.
 */
export async function rearmDailyExpiryScan() {
  if (!STANDALONE_MODE) return;
  const db = await getDb();
  if (!db) return;
  const setting = await db
    .select()
    .from(documentReminderSettings)
    .where(eq(documentReminderSettings.id, "daily-document-expiry"))
    .limit(1);
  const taskUid = setting[0]?.scheduleCronTaskUid;
  if (!taskUid) return;
  if (
    Array.from(jobs.values()).some(
      job =>
        job.path === "/api/scheduled/document-expiry-reminders" &&
        job.enabled
    )
  )
    return;
  rearmJobWithUid(taskUid, {
    name: "scheme-sathi-document-expiry-daily",
    cron: "0 0 3 * * *",
    path: "/api/scheduled/document-expiry-reminders",
  });
  console.log(
    `[LocalScheduler] daily document-expiry scan re-armed (taskUid ${taskUid.slice(0, 18)}…)`
  );
}

/**
 * Scheme-sync bot: watches enabled catalog sources every 5 minutes and
 * publishes arrivals straight to the catalog (sources default to
 * auto-publish). Runs entirely in-process on standalone; on the platform the
 * equivalent Heartbeat job is created by the admin automation control.
 *
 * Boot behaviour: register the 5-minute job (reusing the persisted taskUid
 * when one exists), seed the default source templates, and fire one delayed
 * first sync ~45s after boot so fresh deployments pick up arrivals quickly.
 * Every step is best-effort — without a database the handler reports a
 * `no-database` skip instead of failing.
 */
export const SCHEME_SYNC_BOT_CRON = "0 */5 * * * *";
const SCHEME_SYNC_BOT_PATH = "/api/scheduled/scheme-sync";

export async function ensureSchemeSyncBot() {
  if (!STANDALONE_MODE) return;
  if (
    Array.from(jobs.values()).some(
      job => job.path === SCHEME_SYNC_BOT_PATH && job.enabled
    )
  )
    return;
  let taskUid: string | null = null;
  try {
    const db = await getDb();
    if (db) {
      try {
        await ensureDefaultSchemeSources();
      } catch (error) {
        console.warn("[SchemeSyncBot] default sources unavailable:", String(error));
      }
      const { schemeSyncSettings } = await import("../../drizzle/schema");
      const setting = await db
        .select()
        .from(schemeSyncSettings)
        .where(eq(schemeSyncSettings.id, "daily"))
        .limit(1);
      taskUid = setting[0]?.scheduleCronTaskUid ?? null;
      if (!taskUid) {
        taskUid = `local-cron-${crypto.randomUUID()}`;
        try {
          await saveSchemeSyncTask(taskUid);
        } catch (error) {
          console.warn("[SchemeSyncBot] could not persist taskUid:", String(error));
        }
      }
    }
  } catch (error) {
    console.warn("[SchemeSyncBot] continuing without durable state:", String(error));
  }
  const registered = rearmJobWithUid(taskUid ?? `local-cron-${crypto.randomUUID()}`, {
    name: "scheme-sathi-scheme-sync-5min",
    cron: SCHEME_SYNC_BOT_CRON,
    path: SCHEME_SYNC_BOT_PATH,
  });
  console.log(
    `[SchemeSyncBot] watching catalog sources every 5 minutes (next ${registered.nextExecutionAt})`
  );
  // Delayed first sweep so a fresh boot surfaces arrivals without blocking startup.
  setTimeout(() => {
    runAllEnabledSchemeSources()
      .then(outcomes => {
        const fresh = outcomes.filter(outcome => outcome.ok).length;
        console.log(`[SchemeSyncBot] boot sweep finished: ${fresh}/${outcomes.length} sources ok`);
      })
      .catch(error => console.warn("[SchemeSyncBot] boot sweep skipped:", String(error)));
  }, 45_000).unref?.();
}
