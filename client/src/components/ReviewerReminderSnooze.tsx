import { trpc } from "@/lib/trpc";
import { BellOff, Clock3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import "./ReviewManagement.css";

export function ReviewerReminderSnooze() {
  const utils = trpc.useUtils(); const notifications = trpc.documents.reviewers.notifications.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const markRead = trpc.documents.reviewers.markNotificationRead.useMutation({ onSuccess: () => utils.documents.reviewers.notifications.invalidate() });
  const snooze = trpc.documents.reviewers.snooze.useMutation({ onSuccess: async (result) => { await Promise.all([utils.documents.reviewers.notifications.invalidate(), utils.documents.reviewers.workload.invalidate(), utils.documents.reviewers.mine.invalidate()]); toast.message(result.deferred ? "Snooze saved. It will send automatically after publication when you snooze again." : "Due-date reminder snoozed."); }, onError: (error) => toast.error(error.message || "The reminder could not be snoozed.") });
  const dueNotifications = (notifications.data?.notifications ?? []).filter((notification) => notification.kind === "dueDateReminder");
  const snoozeFor = (notification: typeof dueNotifications[number], hours: number) => snooze.mutate({ assignmentId: notification.assignmentId, snoozeUntil: Date.now() + hours * 60 * 60 * 1000 }, { onSuccess: () => markRead.mutate({ notificationId: notification.id }) });
  return <section className="review-management-card snooze-panel"><header><div><span className="desk-kicker"><BellOff size={14} /> REMINDER SNOOZE</span><h2>Delay a due-date alert when needed.</h2><p>Snoozes are reviewer-controlled, visible in the audit as an action, and cannot extend beyond the review deadline.</p></div></header>{!dueNotifications.length ? <small>No unread due-date reminders to snooze.</small> : <div className="snooze-list">{dueNotifications.map((notification) => <article key={notification.id}><div><strong>{notification.documentName}</strong><small>{notification.schemeName}{notification.dueAt ? ` · Due ${new Date(notification.dueAt).toLocaleString()}` : ""}</small></div><span><button disabled={snooze.isPending} onClick={() => snoozeFor(notification, 1)}><Clock3 size={13} />1 hour</button><button disabled={snooze.isPending} onClick={() => snoozeFor(notification, 4)}><Clock3 size={13} />4 hours</button></span></article>)}</div>}</section>;
}
