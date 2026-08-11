import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { EligibilityRule, SchemeLevel } from "@shared/schemeCatalog";
import type { ApplicationStatus, ReminderStatus } from "@shared/applicationTracker";

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
export const schemeCatalog = mysqlTable("scheme_catalog", {
  id: varchar("id", { length: 96 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameHindi: varchar("nameHindi", { length: 255 }).notNull(),
  category: varchar("category", { length: 96 }).notNull(),
  categoryHindi: varchar("categoryHindi", { length: 128 }).notNull(),
  level: mysqlEnum("level", ["Central", "State"]).$type<SchemeLevel>().notNull(),
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
  accent: mysqlEnum("accent", ["saffron", "emerald", "coral", "indigo"]).notNull(),
  artwork: varchar("artwork", { length: 512 }).notNull(),
  applicationDeadline: timestamp("applicationDeadline"),
  deadlineLabel: varchar("deadlineLabel", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("scheme_catalog_category_idx").on(table.category), index("scheme_catalog_level_idx").on(table.level)]);

/** One private, editable profile per signed-in user. No identity documents are stored. */
export const userSchemeProfiles = mysqlTable("user_scheme_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
}, (table) => [uniqueIndex("user_scheme_profiles_user_unique").on(table.userId)]);

/** Saved scheme references for authenticated users. */
export const savedSchemes = mysqlTable("saved_schemes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  schemeId: varchar("schemeId", { length: 96 }).notNull().references(() => schemeCatalog.id, { onDelete: "cascade" }),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("saved_schemes_user_scheme_unique").on(table.userId, table.schemeId), index("saved_schemes_user_idx").on(table.userId)]);

/** Private application desk entries. A user may track each catalog scheme once. */
export const trackedApplications = mysqlTable("tracked_applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  schemeId: varchar("schemeId", { length: 96 }).notNull().references(() => schemeCatalog.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["considering", "preparing", "submitted", "approved", "rejected", "closed"]).$type<ApplicationStatus>().default("considering").notNull(),
  applicationReference: varchar("applicationReference", { length: 128 }),
  applicationDeadline: timestamp("applicationDeadline"),
  deadlineLabel: varchar("deadlineLabel", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("tracked_applications_user_scheme_unique").on(table.userId, table.schemeId), index("tracked_applications_user_status_idx").on(table.userId, table.status)]);

/** User-created deadline reminders. Each task UID is persisted and dereferenced only by the cron callback. */
export const applicationReminders = mysqlTable("application_reminders", {
  id: int("id").autoincrement().primaryKey(),
  trackedApplicationId: int("trackedApplicationId").notNull().references(() => trackedApplications.id, { onDelete: "cascade" }),
  remindAt: timestamp("remindAt").notNull(),
  status: mysqlEnum("status", ["scheduled", "delivered", "cancelled", "failed"]).$type<ReminderStatus>().default("scheduled").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("application_reminders_task_uid_unique").on(table.scheduleCronTaskUid), index("application_reminders_application_idx").on(table.trackedApplicationId), index("application_reminders_status_idx").on(table.status)]);

/** User-owned uploaded files mapped to the exact checklist item required by a tracked application. */
export const applicationDocuments = mysqlTable("application_documents", {
  id: int("id").autoincrement().primaryKey(),
  trackedApplicationId: int("trackedApplicationId").notNull().references(() => trackedApplications.id, { onDelete: "cascade" }),
  documentName: varchar("documentName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 1024 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1200 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("application_documents_item_unique").on(table.trackedApplicationId, table.documentName), index("application_documents_application_idx").on(table.trackedApplicationId)]);

export type SchemeCatalogRow = typeof schemeCatalog.$inferSelect;
export type UserSchemeProfile = typeof userSchemeProfiles.$inferSelect;
export type TrackedApplication = typeof trackedApplications.$inferSelect;
