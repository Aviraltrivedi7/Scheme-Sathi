import type { Request, Response } from "express";
import { deliverDocumentReviewDueReminder, getApplicationReminderByTaskUid, getDb, getDocumentReminderSettingByTaskUid, getSchemeSyncSettingByTaskUid, markApplicationReminderDelivered, markDocumentReminderScanRun, runAllEnabledSchemeSources, scanDocumentExpiryNotifications } from "./db";
import { updateHeartbeatJob } from "./_core/heartbeat";
import { sdk } from "./_core/sdk";

/** Heartbeat callback: authenticated cron task UID is the only trusted reminder lookup key. */
export async function applicationReminderHandler(req: Request, res: Response) {
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });

    const reminder = await getApplicationReminderByTaskUid(cronUser.taskUid);
    if (!reminder || reminder.status !== "scheduled") return res.json({ ok: true, skipped: "orphan-or-complete" });

    await markApplicationReminderDelivered(reminder.id);
    // The scheduler supports cron rather than one-off jobs. Disable after the first delivery so the reminder remains one-time.
    await updateHeartbeatJob(cronUser.taskUid, { enable: false }, "").catch((error) => console.warn("[Reminder] Could not disable completed job", error));
    return res.json({ ok: true, reminderId: reminder.id, applicationId: reminder.trackedApplicationId });
  } catch (error) {
    console.error("[scheduled] application-reminder failed", error);
    return res.status(500).json({ error: "application-reminder-failed", timestamp: new Date().toISOString() });
  }
}

/** Daily document-expiry scan. Task UID is verified against its durable automation owner row. */
export async function documentExpiryReminderHandler(req: Request, res: Response) {
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
    const setting = await getDocumentReminderSettingByTaskUid(cronUser.taskUid);
    if (!setting) return res.json({ ok: true, skipped: "orphan" });
    const result = await scanDocumentExpiryNotifications();
    await markDocumentReminderScanRun(setting.id);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[scheduled] document-expiry-scan failed", error);
    return res.status(500).json({ error: "document-expiry-scan-failed", timestamp: new Date().toISOString() });
  }
}

/** Catalog sync bot tick. Only enabled sources run; each source records its own run row. */
export async function schemeSyncHandler(req: Request, res: Response) {
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-database" });
    const setting = await getSchemeSyncSettingByTaskUid(cronUser.taskUid);
    if (!setting) return res.json({ ok: true, skipped: "orphan" });
    const outcomes = await runAllEnabledSchemeSources();
    const fresh = outcomes.filter(outcome => outcome.ok).length;
    console.log(`[SchemeSync] tick finished: ${fresh}/${outcomes.length} sources ok`);
    return res.json({ ok: true, sources: outcomes.length, outcomes });
  } catch (error) {
    console.error("[scheduled] scheme-sync failed", error);
    return res.status(500).json({ error: "scheme-sync-failed", timestamp: new Date().toISOString() });
  }
}
/** One-time reviewer due-date alert. Task UID, rather than request body data, identifies the durable assignment. */
export async function documentReviewDueReminderHandler(req: Request, res: Response) {
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await deliverDocumentReviewDueReminder(cronUser.taskUid);
    await updateHeartbeatJob(cronUser.taskUid, { enable: false }, "").catch((error) => console.warn("[Review due reminder] Could not disable completed job", error));
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[scheduled] document-review-due-reminder failed", error);
    return res.status(500).json({ error: "document-review-due-reminder-failed", timestamp: new Date().toISOString() });
  }
}
