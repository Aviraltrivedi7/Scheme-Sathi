import type { Request, Response } from "express";
import { getApplicationReminderByTaskUid, getDocumentReminderSettingByTaskUid, markApplicationReminderDelivered, markDocumentReminderScanRun, scanDocumentExpiryNotifications } from "./db";
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
    const details = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
    return res.status(500).json({ error: "application-reminder-failed", details, timestamp: new Date().toISOString() });
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
    const details = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
    return res.status(500).json({ error: "document-expiry-scan-failed", details, timestamp: new Date().toISOString() });
  }
}
