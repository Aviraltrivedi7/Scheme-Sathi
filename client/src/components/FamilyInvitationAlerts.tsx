import { MailCheck, MailOpen, UsersRound, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import "./FamilyInvitationAlerts.css";

export function FamilyInvitationAlerts() {
  const utils = trpc.useUtils(); const alerts = trpc.documents.historyFilters.notifications.useQuery(undefined, { retry: false }); const markRead = trpc.documents.historyFilters.markNotificationRead.useMutation({ onSuccess: () => utils.documents.historyFilters.notifications.invalidate() }); const respond = trpc.documents.historyFilters.respondToInvite.useMutation({ onSuccess: async () => { await Promise.all([utils.documents.historyFilters.notifications.invalidate(), utils.documents.historyFilters.list.invalidate()]); toast.success("Family filter invitation updated."); }, onError: (error) => toast.error(error.message || "The invitation could not be updated.") });
  const notifications = alerts.data?.notifications ?? [];
  if (!notifications.length) return null;
  return <section id="family-invitations" className="family-invitation-alerts" aria-label="Family filter invitations"><header><span className="desk-kicker"><MailCheck size={14} /> FAMILY FILTER INVITATIONS</span><strong>{notifications.length} new</strong></header><div>{notifications.map(({ id, invitation }) => <article key={id}><UsersRound size={18} /><div><strong>{invitation.ownerName || invitation.ownerEmail || "A family member"} shared “{invitation.filter.name}”</strong><p>This shares only saved search criteria—not documents, activity, or applications.</p><span><button disabled={respond.isPending} onClick={() => respond.mutate({ shareId: invitation.shareId, decision: "accepted" })}>Accept</button><button disabled={respond.isPending} onClick={() => respond.mutate({ shareId: invitation.shareId, decision: "declined" })}>Decline</button></span></div><button className="family-alert-dismiss" type="button" aria-label={`Mark invitation from ${invitation.ownerName || invitation.ownerEmail || "family member"} as read`} disabled={markRead.isPending} onClick={() => markRead.mutate({ notificationId: id })}><MailOpen size={15} /><X size={13} /></button></article>)}</div></section>;
}
