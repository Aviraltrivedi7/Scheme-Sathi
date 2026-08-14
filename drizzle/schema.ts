import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { EligibilityRule, SchemeLevel } from "@shared/schemeCatalog";
import type {
  ApplicationStatus,
  ReminderStatus,
} from "@shared/applicationTracker";
import type { OcrExtraction } from "../server/documentOcr";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Bilingual public scheme catalog. Entries are seeded from the reviewed source file on first access. */
export const schemeCatalog = mysqlTable(
  "scheme_catalog",
  {
    id: varchar("id", { length: 96 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    nameHindi: varchar("nameHindi", { length: 255 }).notNull(),
    category: varchar("category", { length: 96 }).notNull(),
    categoryHindi: varchar("categoryHindi", { length: 128 }).notNull(),
    level: mysqlEnum("level", ["Central", "State"])
      .$type<SchemeLevel>()
      .notNull(),
    administeringBody: varchar("administeringBody", { length: 255 }).notNull(),
    benefits: text("benefits").notNull(),
    benefitsHindi: text("benefitsHindi").notNull(),
    eligibility: json("eligibility").$type<EligibilityRule>().notNull(),
    documents: json("documents").$type<string[]>().notNull(),
    documentsHindi: json("documentsHindi").$type<string[]>().notNull(),
    steps: json("steps").$type<string[]>().notNull(),
    stepsHindi: json("stepsHindi").$type<string[]>().notNull(),
    portalUrl: varchar("portalUrl", { length: 512 }).notNull(),
    reviewed: varchar("reviewed", { length: 64 }).notNull(),
    accent: mysqlEnum("accent", [
      "saffron",
      "emerald",
      "coral",
      "indigo",
    ]).notNull(),
    artwork: varchar("artwork", { length: 512 }).notNull(),
    applicationDeadline: timestamp("applicationDeadline"),
    deadlineLabel: varchar("deadlineLabel", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("scheme_catalog_category_idx").on(table.category),
    index("scheme_catalog_level_idx").on(table.level),
  ]
);

/** One private, editable profile per signed-in user. No identity documents are stored. */
export const userSchemeProfiles = mysqlTable(
  "user_scheme_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    age: int("age").notNull(),
    state: varchar("state", { length: 96 }).notNull(),
    caste: varchar("caste", { length: 64 }).notNull(),
    annualIncome: int("annualIncome").notNull(),
    occupation: varchar("occupation", { length: 96 }).notNull(),
    gender: varchar("gender", { length: 32 }).notNull(),
    isStudent: boolean("isStudent").default(false).notNull(),
    isFarmer: boolean("isFarmer").default(false).notNull(),
    isDisabled: boolean("isDisabled").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("user_scheme_profiles_user_unique").on(table.userId)]
);

/** Saved scheme references for authenticated users. */
export const savedSchemes = mysqlTable(
  "saved_schemes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schemeId: varchar("schemeId", { length: 96 })
      .notNull()
      .references(() => schemeCatalog.id, { onDelete: "cascade" }),
    savedAt: timestamp("savedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("saved_schemes_user_scheme_unique").on(
      table.userId,
      table.schemeId
    ),
    index("saved_schemes_user_idx").on(table.userId),
  ]
);

/** One owner-private note per saved scheme. The application removes the note when its saved reference is removed. */
export const schemeNotes = mysqlTable(
  "scheme_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schemeId: varchar("schemeId", { length: 96 })
      .notNull()
      .references(() => schemeCatalog.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("scheme_notes_user_scheme_unique").on(
      table.userId,
      table.schemeId
    ),
    index("scheme_notes_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

/** Private application desk entries. A user may track each catalog scheme once. */
export const trackedApplications = mysqlTable(
  "tracked_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schemeId: varchar("schemeId", { length: 96 })
      .notNull()
      .references(() => schemeCatalog.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", [
      "considering",
      "preparing",
      "submitted",
      "approved",
      "rejected",
      "closed",
    ])
      .$type<ApplicationStatus>()
      .default("considering")
      .notNull(),
    applicationReference: varchar("applicationReference", { length: 128 }),
    applicationDeadline: timestamp("applicationDeadline"),
    deadlineLabel: varchar("deadlineLabel", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("tracked_applications_user_scheme_unique").on(
      table.userId,
      table.schemeId
    ),
    index("tracked_applications_user_status_idx").on(
      table.userId,
      table.status
    ),
  ]
);

/** User-created deadline reminders. Each task UID is persisted and dereferenced only by the cron callback. */
export const applicationReminders = mysqlTable(
  "application_reminders",
  {
    id: int("id").autoincrement().primaryKey(),
    trackedApplicationId: int("trackedApplicationId")
      .notNull()
      .references(() => trackedApplications.id, { onDelete: "cascade" }),
    remindAt: timestamp("remindAt").notNull(),
    status: mysqlEnum("status", [
      "scheduled",
      "delivered",
      "cancelled",
      "failed",
    ])
      .$type<ReminderStatus>()
      .default("scheduled")
      .notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("application_reminders_task_uid_unique").on(
      table.scheduleCronTaskUid
    ),
    index("application_reminders_application_idx").on(
      table.trackedApplicationId
    ),
    index("application_reminders_status_idx").on(table.status),
  ]
);

/** User-owned uploaded files mapped to the exact checklist item required by a tracked application. */
export const applicationDocuments = mysqlTable(
  "application_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    trackedApplicationId: int("trackedApplicationId")
      .notNull()
      .references(() => trackedApplications.id, { onDelete: "cascade" }),
    documentName: varchar("documentName", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 1024 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 1200 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    expiresAt: timestamp("expiresAt"),
    ocrStatus: mysqlEnum("ocrStatus", [
      "notRequested",
      "processing",
      "complete",
      "failed",
    ])
      .default("notRequested")
      .notNull(),
    ocrExtraction: json("ocrExtraction").$type<OcrExtraction | null>(),
    ocrError: varchar("ocrError", { length: 500 }),
    ocrVerifiedAt: timestamp("ocrVerifiedAt"),
    userVerifiedAt: timestamp("userVerifiedAt"),
    reviewState: mysqlEnum("reviewState", ["unreviewed", "reviewed", "flagged"])
      .default("unreviewed")
      .notNull(),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("application_documents_item_unique").on(
      table.trackedApplicationId,
      table.documentName
    ),
    index("application_documents_application_idx").on(
      table.trackedApplicationId
    ),
  ]
);

/** Immutable user-facing document history, written only by server-side document actions. */
export const documentActivityEvents = mysqlTable(
  "document_activity_events",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationDocumentId: int("applicationDocumentId")
      .notNull()
      .references(() => applicationDocuments.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", [
      "uploaded",
      "reuploaded",
      "expiryUpdated",
      "ocrStarted",
      "ocrCompleted",
      "ocrFailed",
      "userVerified",
      "reviewed",
      "flagged",
    ]).notNull(),
    detail: varchar("detail", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("document_activity_document_idx").on(table.applicationDocumentId),
    index("document_activity_created_idx").on(table.createdAt),
  ]
);

/** An owner can assign an existing account to review an individual private document. */
export const documentReviewAssignments = mysqlTable(
  "document_review_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationDocumentId: int("applicationDocumentId")
      .notNull()
      .references(() => applicationDocuments.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewerUserId: int("reviewerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", [
      "assigned",
      "inReview",
      "completed",
      "revoked",
    ])
      .default("assigned")
      .notNull(),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
    dueAt: timestamp("dueAt"),
    reminderAt: timestamp("reminderAt"),
    reminderStatus: mysqlEnum("reminderStatus", [
      "none",
      "scheduled",
      "delivered",
      "cancelled",
      "failed",
    ])
      .default("none")
      .notNull(),
    reminderScheduleCronTaskUid: varchar("reminderScheduleCronTaskUid", {
      length: 65,
    }).unique(),
    reminderDeliveredAt: timestamp("reminderDeliveredAt"),
    reminderSnoozedUntil: timestamp("reminderSnoozedUntil"),
    reminderSnoozeCount: int("reminderSnoozeCount").default(0).notNull(),
    escalationState: mysqlEnum("escalationState", [
      "normal",
      "escalated",
      "resolved",
    ])
      .default("normal")
      .notNull(),
    escalatedAt: timestamp("escalatedAt"),
    escalationNote: varchar("escalationNote", { length: 500 }),
    completedAt: timestamp("completedAt"),
    revokedAt: timestamp("revokedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("document_review_assignment_unique").on(
      table.applicationDocumentId,
      table.reviewerUserId
    ),
    index("document_review_assignment_owner_status_idx").on(
      table.ownerUserId,
      table.status
    ),
    index("document_review_assignment_reviewer_status_idx").on(
      table.reviewerUserId,
      table.status
    ),
  ]
);

/** Recipient-owned controls for reviewer assignment and due-date reminder alerts. */
export const documentReviewerAlertPreferences = mysqlTable(
  "document_reviewer_alert_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignmentAlertsEnabled: boolean("assignmentAlertsEnabled")
      .default(true)
      .notNull(),
    dueDateRemindersEnabled: boolean("dueDateRemindersEnabled")
      .default(true)
      .notNull(),
    defaultReminderLeadHours: int("defaultReminderLeadHours")
      .default(24)
      .notNull(),
    maxActiveAssignments: int("maxActiveAssignments").default(5).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("review_alert_preferences_user_unique").on(table.userId),
  ]
);

/** Owner-private reusable copy blocks for following up on an overdue assigned review. */
export const documentReviewEscalationTemplates = mysqlTable(
  "document_review_escalation_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("review_escalation_template_owner_updated_idx").on(
      table.ownerUserId,
      table.updatedAt
    ),
  ]
);

/** In-app alert created or refreshed whenever an owner assigns a reviewer to a document. */
export const documentReviewAssignmentNotifications = mysqlTable(
  "document_review_assignment_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId")
      .notNull()
      .references(() => documentReviewAssignments.id, { onDelete: "cascade" }),
    recipientUserId: int("recipientUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["assignment", "dueDateReminder"])
      .default("assignment")
      .notNull(),
    status: mysqlEnum("status", ["unread", "read"]).default("unread").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt"),
  },
  table => [
    uniqueIndex("review_assignment_notice_assignment_kind_unique").on(
      table.assignmentId,
      table.kind
    ),
    index("review_assignment_notice_recipient_status_idx").on(
      table.recipientUserId,
      table.status
    ),
  ]
);

/** Immutable accountability record for reviewer assignment and review-status changes; never stores PDF note text. */
export const documentReviewAuditEvents = mysqlTable(
  "document_review_audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationDocumentId: int("applicationDocumentId")
      .notNull()
      .references(() => applicationDocuments.id, { onDelete: "cascade" }),
    assignmentId: int("assignmentId").references(
      () => documentReviewAssignments.id,
      { onDelete: "set null" }
    ),
    actorUserId: int("actorUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", [
      "assigned",
      "started",
      "completed",
      "revoked",
      "noteCreated",
      "noteUpdated",
      "noteDeleted",
      "dueReminderSent",
      "reminderSnoozed",
      "escalated",
      "escalationResolved",
    ]).notNull(),
    detail: varchar("detail", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("document_review_audit_document_created_idx").on(
      table.applicationDocumentId,
      table.createdAt
    ),
    index("document_review_audit_assignment_idx").on(table.assignmentId),
  ]
);

/** Page-scoped review annotations remain visible only to their author and are removed with the source document. */
export const documentPdfAnnotations = mysqlTable(
  "document_pdf_annotations",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationDocumentId: int("applicationDocumentId")
      .notNull()
      .references(() => applicationDocuments.id, { onDelete: "cascade" }),
    authorUserId: int("authorUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageNumber: int("pageNumber").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("document_pdf_annotations_author_document_page_idx").on(
      table.authorUserId,
      table.applicationDocumentId,
      table.pageNumber
    ),
    index("document_pdf_annotations_document_idx").on(
      table.applicationDocumentId
    ),
  ]
);

/** Named private presets for a user's Verification History date, order, and keyword search criteria. */
export const savedVerificationHistoryFilters = mysqlTable(
  "saved_verification_history_filters",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    query: varchar("query", { length: 120 }).notNull().default(""),
    startAt: timestamp("startAt"),
    endAt: timestamp("endAt"),
    sort: mysqlEnum("sort", ["newest", "oldest"]).default("newest").notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("saved_history_filters_user_name_unique").on(
      table.userId,
      table.name
    ),
    index("saved_history_filters_user_updated_idx").on(
      table.userId,
      table.updatedAt
    ),
  ]
);

/** Owner-controlled sharing of a saved history filter with another signed-in family account. */
export const savedVerificationHistoryFilterShares = mysqlTable(
  "saved_verification_history_filter_shares",
  {
    id: int("id").autoincrement().primaryKey(),
    savedFilterId: int("savedFilterId")
      .notNull()
      .references(() => savedVerificationHistoryFilters.id, {
        onDelete: "cascade",
      }),
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: int("recipientUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["pending", "accepted", "declined"])
      .default("accepted")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    respondedAt: timestamp("respondedAt"),
  },
  table => [
    uniqueIndex("saved_history_filter_share_unique").on(
      table.savedFilterId,
      table.recipientUserId
    ),
    index("saved_history_filter_share_owner_idx").on(table.ownerUserId),
    index("saved_history_filter_share_recipient_idx").on(table.recipientUserId),
  ]
);

/** Email-style in-app alerts for private family-filter invitations. */
export const familyFilterInvitationNotifications = mysqlTable(
  "family_filter_invitation_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    shareId: int("shareId")
      .notNull()
      .references(() => savedVerificationHistoryFilterShares.id, {
        onDelete: "cascade",
      }),
    recipientUserId: int("recipientUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["unread", "read"]).default("unread").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt"),
  },
  table => [
    uniqueIndex("family_filter_invitation_notice_share_unique").on(
      table.shareId
    ),
    index("family_filter_invitation_notice_recipient_status_idx").on(
      table.recipientUserId,
      table.status
    ),
  ]
);

/** Immutable confidence snapshots, written whenever document OCR completes successfully. */
export const documentOcrConfidenceEvents = mysqlTable(
  "document_ocr_confidence_events",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationDocumentId: int("applicationDocumentId")
      .notNull()
      .references(() => applicationDocuments.id, { onDelete: "cascade" }),
    confidence: mysqlEnum("confidence", ["low", "medium", "high"]).notNull(),
    concernCount: int("concernCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("document_ocr_confidence_document_created_idx").on(
      table.applicationDocumentId,
      table.createdAt
    ),
  ]
);

/** Singleton policy for deciding when a completed OCR result needs a manual user review. */
export const ocrPolicySettings = mysqlTable("ocr_policy_settings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  minimumConfidence: mysqlEnum("minimumConfidence", ["low", "medium", "high"])
    .default("medium")
    .notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** User-visible document follow-up notices, deduplicated per document and state. */
export const documentExpiryNotifications = mysqlTable(
  "document_expiry_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationDocumentId: int("applicationDocumentId")
      .notNull()
      .references(() => applicationDocuments.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["expiringSoon", "expired"]).notNull(),
    status: mysqlEnum("status", ["unread", "read"]).default("unread").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt"),
  },
  table => [
    uniqueIndex("document_expiry_notice_unique").on(
      table.applicationDocumentId,
      table.kind
    ),
    index("document_expiry_notice_status_idx").on(table.status),
  ]
);

/** Durable automation owner row. A production Heartbeat task UID is stored here after deployment. */
export const documentReminderSettings = mysqlTable(
  "document_reminder_settings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", {
      length: 65,
    }).unique(),
    lastRunAt: timestamp("lastRunAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }
);

export type SchemeCatalogRow = typeof schemeCatalog.$inferSelect;
export type UserSchemeProfile = typeof userSchemeProfiles.$inferSelect;
export type TrackedApplication = typeof trackedApplications.$inferSelect;
