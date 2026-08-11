/** One-time reminder cron utility. The scheduled callback disables its own yearly cron after first delivery. */
export function buildReminderCron(remindAtMs: number) {
  const reminder = new Date(remindAtMs);
  if (Number.isNaN(reminder.getTime())) throw new Error("Reminder time is invalid");
  return `0 ${reminder.getUTCMinutes()} ${reminder.getUTCHours()} ${reminder.getUTCDate()} ${reminder.getUTCMonth() + 1} *`;
}
