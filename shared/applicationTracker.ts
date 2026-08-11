export const applicationStatuses = ["considering", "preparing", "submitted", "approved", "rejected", "closed"] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const reminderStatuses = ["scheduled", "delivered", "cancelled", "failed"] as const;
export type ReminderStatus = (typeof reminderStatuses)[number];

export const applicationStatusCopy: Record<ApplicationStatus, { label: string; labelHi: string; tone: "ink" | "indigo" | "saffron" | "emerald" | "coral" }> = {
  considering: { label: "Considering", labelHi: "विचार कर रहे हैं", tone: "ink" },
  preparing: { label: "Preparing", labelHi: "तैयारी में", tone: "saffron" },
  submitted: { label: "Submitted", labelHi: "जमा किया", tone: "indigo" },
  approved: { label: "Approved", labelHi: "स्वीकृत", tone: "emerald" },
  rejected: { label: "Not approved", labelHi: "स्वीकृत नहीं", tone: "coral" },
  closed: { label: "Closed", labelHi: "बंद", tone: "ink" },
};
