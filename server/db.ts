import { and, desc, eq, ne, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  applicationDocuments,
  applicationReminders,
  documentActivityEvents,
  documentExpiryNotifications,
  documentOcrConfidenceEvents,
  documentPdfAnnotations,
  documentReminderSettings,
  documentReviewerAlertPreferences,
  documentReviewAssignmentNotifications,
  documentReviewAssignments,
  documentReviewAuditEvents,
  documentReviewEscalationTemplates,
  familyFilterInvitationNotifications,
  InsertUser,
  comparisonExportPresets,
  ocrPolicySettings,
  pilotCohortInvites,
  pilotFeedbackSubmissions,
  schemeNotes,
  savedSchemes,
  savedVerificationHistoryFilters,
  savedVerificationHistoryFilterShares,
  schemeCatalog,
  trackedApplications,
  userSchemeProfiles,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  schemeCatalog as seedCatalog,
  type SchemeCatalogItem,
  type SchemeProfileInput,
} from "@shared/schemeCatalog";
import type { ApplicationStatus } from "@shared/applicationTracker";
import { safeStorageFileName, validateDocumentUpload } from "./documentUpload";
import { storageGetSignedUrl, storagePut } from "./storage";
import { expiryNoticeKind, getDocumentExpiryState } from "./documentExpiry";
import { extractDocumentDetails } from "./documentOcr";
import { needsManualOcrReview, type OcrConfidence } from "@shared/ocrPolicy";
import {
  shouldResetOcrConfidenceHistory,
  summariseOcrConfidenceTrend,
} from "@shared/ocrConfidenceTrend";
import {
  buildDocumentActivityInsert,
  buildOcrApprovalUpdate,
  toDocumentTimeline,
  type DocumentActivityKind,
} from "./documentActivity";
import {
  createVerificationHistoryPdf,
  filterVerificationHistory,
  type VerificationHistoryEvent,
} from "./verificationHistoryPdf";
import { createVerificationHistoryCsv } from "./verificationHistoryCsv";
import type {
  FamilyFilterInvitationNotification,
  ReceivedVerificationHistoryFilterInvite,
  SavedVerificationHistoryFilter,
  SharedVerificationHistoryFilter,
  VerificationHistoryFilterPresetInput,
  VerificationHistoryFilterShareRecipient,
} from "@shared/verificationHistoryFilters";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function databaseUnavailable(): never {
  throw new Error("Database is not available. Please retry in a moment.");
}

export type PilotFeedbackSubmissionInput = {
  role: "student" | "parent" | "collegeStaff" | "ngoStaff" | "other";
  state: string;
  journeyStage: "searching" | "preparing" | "applying" | "missedDeadline" | "other";
  biggestBlocker: string;
  helpfulToday: string;
  contactEmail?: string;
  contactConsent: boolean;
  cohortCode?: string;
};

export type PilotFeedbackStatus = "new" | "reviewed" | "followUp" | "archived";
export type PilotCohortInviteInput = {
  cohortName: string;
  cohortType: "college" | "ngo";
  maxUses: number;
  expiresAt?: number | null;
};

function isActivePilotCohortInvite(invite: typeof pilotCohortInvites.$inferSelect) {
  return (
    !invite.revokedAt &&
    (!invite.expiresAt || invite.expiresAt.getTime() > Date.now()) &&
    invite.usedCount < invite.maxUses
  );
}

export async function getPublicPilotCohortInvite(code: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const invite = (
    await db
      .select()
      .from(pilotCohortInvites)
      .where(eq(pilotCohortInvites.code, code.trim().toUpperCase()))
      .limit(1)
  )[0];
  if (!invite || !isActivePilotCohortInvite(invite)) return null;
  return { cohortName: invite.cohortName, cohortType: invite.cohortType };
}

/** Persists only the structured pilot-interview answers and an explicitly consented contact address. */
export async function createPilotFeedbackSubmission(
  input: PilotFeedbackSubmissionInput
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const normalizedCode = input.cohortCode?.trim().toUpperCase();
  const cohortInvite = normalizedCode
    ? (
        await db
          .select()
          .from(pilotCohortInvites)
          .where(eq(pilotCohortInvites.code, normalizedCode))
          .limit(1)
      )[0]
    : undefined;
  if (normalizedCode && (!cohortInvite || !isActivePilotCohortInvite(cohortInvite))) {
    throw new Error("This pilot invite is no longer active. Ask the cohort organiser for a new link.");
  }
  const created = await db.insert(pilotFeedbackSubmissions).values({
    role: input.role,
    state: input.state.trim(),
    journeyStage: input.journeyStage,
    biggestBlocker: input.biggestBlocker.trim(),
    helpfulToday: input.helpfulToday.trim(),
    contactConsent: input.contactConsent,
    contactEmail:
      input.contactConsent && input.contactEmail
        ? input.contactEmail.trim().toLowerCase()
        : null,
    cohortInviteId: cohortInvite?.id ?? null,
  });
  if (cohortInvite) {
    await db
      .update(pilotCohortInvites)
      .set({ usedCount: sql`${pilotCohortInvites.usedCount} + 1` })
      .where(eq(pilotCohortInvites.id, cohortInvite.id));
  }
  return { id: Number(created[0].insertId), cohortName: cohortInvite?.cohortName ?? null };
}

export async function createPilotCohortInvite(
  adminUserId: number,
  input: PilotCohortInviteInput
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const code = randomBytes(7).toString("base64url").toUpperCase();
  const created = await db.insert(pilotCohortInvites).values({
    cohortName: input.cohortName.trim(),
    cohortType: input.cohortType,
    code,
    maxUses: input.maxUses,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    createdByUserId: adminUserId,
  });
  return { id: Number(created[0].insertId), code };
}

export async function listPilotCohortInvites() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(pilotCohortInvites)
    .orderBy(desc(pilotCohortInvites.createdAt));
  return rows.map(invite => ({
    ...invite,
    expiresAt: invite.expiresAt?.getTime() ?? null,
    revokedAt: invite.revokedAt?.getTime() ?? null,
    createdAt: invite.createdAt.getTime(),
    updatedAt: invite.updatedAt.getTime(),
    active: isActivePilotCohortInvite(invite),
  }));
}

export async function revokePilotCohortInvite(inviteId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .update(pilotCohortInvites)
    .set({ revokedAt: new Date() })
    .where(eq(pilotCohortInvites.id, inviteId));
}

export async function listPilotFeedbackForAdmin(filters?: {
  status?: PilotFeedbackStatus;
  cohortInviteId?: number;
  query?: string;
}) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      feedback: pilotFeedbackSubmissions,
      cohortName: pilotCohortInvites.cohortName,
      cohortType: pilotCohortInvites.cohortType,
    })
    .from(pilotFeedbackSubmissions)
    .leftJoin(
      pilotCohortInvites,
      eq(pilotFeedbackSubmissions.cohortInviteId, pilotCohortInvites.id)
    )
    .orderBy(desc(pilotFeedbackSubmissions.createdAt));
  const query = filters?.query?.trim().toLowerCase();
  return rows
    .filter(({ feedback }) => !filters?.status || feedback.status === filters.status)
    .filter(({ feedback }) => !filters?.cohortInviteId || feedback.cohortInviteId === filters.cohortInviteId)
    .filter(({ feedback, cohortName }) => !query || `${feedback.state} ${feedback.biggestBlocker} ${feedback.helpfulToday} ${cohortName ?? ""}`.toLowerCase().includes(query))
    .map(({ feedback, cohortName, cohortType }) => ({
      ...feedback,
      cohortName,
      cohortType,
      createdAt: feedback.createdAt.getTime(),
      reviewedAt: feedback.reviewedAt?.getTime() ?? null,
    }));
}

export async function updatePilotFeedbackForAdmin(
  feedbackId: number,
  input: { status: PilotFeedbackStatus; adminNote?: string | null }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .update(pilotFeedbackSubmissions)
    .set({
      status: input.status,
      adminNote: input.adminNote?.trim() || null,
      reviewedAt: input.status === "new" ? null : new Date(),
    })
    .where(eq(pilotFeedbackSubmissions.id, feedbackId));
}

function mapScheme(row: typeof schemeCatalog.$inferSelect): SchemeCatalogItem {
  return {
    id: row.id,
    name: row.name,
    nameHindi: row.nameHindi,
    category: row.category,
    categoryHindi: row.categoryHindi,
    level: row.level,
    administeringBody: row.administeringBody,
    benefits: row.benefits,
    benefitsHindi: row.benefitsHindi,
    eligibility: row.eligibility,
    documents: row.documents,
    documentsHindi: row.documentsHindi,
    steps: row.steps,
    stepsHindi: row.stepsHindi,
    portalUrl: row.portalUrl,
    sourceUrl: row.sourceUrl ?? row.portalUrl,
    verificationStatus: row.verificationStatus,
    reviewed: row.reviewed,
    accent: row.accent,
    artwork: row.artwork,
    applicationDeadline: row.applicationDeadline?.getTime() ?? null,
    deadlineLabel: row.deadlineLabel ?? null,
  };
}

/** Idempotent catalog seed. It writes only stable reviewed catalog records, never user-generated content. */
export async function ensureSchemeCatalog() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const catalogSeedValues = seedCatalog.map(
    ({ applicationDeadline, deadlineLabel, ...scheme }) => ({
      ...scheme,
      applicationDeadline: applicationDeadline
        ? new Date(applicationDeadline)
        : null,
      deadlineLabel: deadlineLabel ?? null,
    })
  );
  await db
    .insert(schemeCatalog)
    .values(catalogSeedValues)
    .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  // NSP publishes a current application deadline; other catalog entries intentionally remain open-ended until an official deadline is confirmed.
  await db
    .update(schemeCatalog)
    .set({
      applicationDeadline: new Date(Date.UTC(2026, 9, 31, 18, 29, 59)),
      deadlineLabel: "Student applications close 31 Oct 2026",
    })
    .where(eq(schemeCatalog.id, "nsp"));
  return db;
}

export async function listSchemeCatalog(filters?: {
  category?: string;
  level?: "Central" | "State";
  state?: string;
  deadline?: "announced" | "closingSoon" | "openEnded";
  sort?: "name" | "category" | "deadline" | "reviewed";
  query?: string;
}) {
  const db = await ensureSchemeCatalog();
  const rows = await db.select().from(schemeCatalog);
  const query = filters?.query?.trim().toLowerCase();
  const today = Date.now();
  const closingSoon = today + 90 * 24 * 60 * 60 * 1000;
  const filtered = rows.map(mapScheme).filter(scheme => {
    const matchesCategory =
      !filters?.category ||
      filters.category === "all" ||
      scheme.category === filters.category;
    const matchesLevel = !filters?.level || scheme.level === filters.level;
    const stateRule = scheme.eligibility.states;
    const matchesState =
      !filters?.state ||
      filters.state === "all" ||
      stateRule === undefined ||
      stateRule === "all" ||
      stateRule.includes(filters.state);
    const matchesDeadline =
      !filters?.deadline ||
      (filters.deadline === "announced" && !!scheme.applicationDeadline) ||
      (filters.deadline === "openEnded" && !scheme.applicationDeadline) ||
      (filters.deadline === "closingSoon" &&
        !!scheme.applicationDeadline &&
        scheme.applicationDeadline >= today &&
        scheme.applicationDeadline <= closingSoon);
    const searchable =
      `${scheme.name} ${scheme.nameHindi} ${scheme.benefits} ${scheme.category}`.toLowerCase();
    return (
      matchesCategory &&
      matchesLevel &&
      matchesState &&
      matchesDeadline &&
      (!query || searchable.includes(query))
    );
  });
  if (filters?.sort === "name")
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.sort === "category")
    return filtered.sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  if (filters?.sort === "deadline")
    return filtered.sort(
      (a, b) =>
        (a.applicationDeadline ?? Number.MAX_SAFE_INTEGER) -
        (b.applicationDeadline ?? Number.MAX_SAFE_INTEGER)
    );
  if (filters?.sort === "reviewed")
    return filtered.sort((a, b) => b.reviewed.localeCompare(a.reviewed));
  return filtered;
}

export async function getSchemeById(schemeId: string) {
  const db = await ensureSchemeCatalog();
  const rows = await db
    .select()
    .from(schemeCatalog)
    .where(eq(schemeCatalog.id, schemeId))
    .limit(1);
  return rows[0] ? mapScheme(rows[0]) : undefined;
}

export async function getUserSchemeProfile(
  userId: number
): Promise<SchemeProfileInput | null> {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(userSchemeProfiles)
    .where(eq(userSchemeProfiles.userId, userId))
    .limit(1);
  const profile = rows[0];
  if (!profile) return null;
  return {
    age: profile.age,
    state: profile.state,
    caste: profile.caste,
    annualIncome: profile.annualIncome,
    occupation: profile.occupation,
    gender: profile.gender,
    isStudent: profile.isStudent,
    isFarmer: profile.isFarmer,
    isDisabled: profile.isDisabled,
  };
}

export async function saveUserSchemeProfile(
  userId: number,
  profile: SchemeProfileInput
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .insert(userSchemeProfiles)
    .values({ userId, ...profile })
    .onDuplicateKeyUpdate({ set: { ...profile, updatedAt: new Date() } });
  return getUserSchemeProfile(userId);
}

export async function listSavedSchemeIds(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({ schemeId: savedSchemes.schemeId })
    .from(savedSchemes)
    .where(eq(savedSchemes.userId, userId));
  return rows.map(row => row.schemeId);
}

export async function listSavedSchemeNotes(userId: number, query?: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({ note: schemeNotes, scheme: schemeCatalog })
    .from(schemeNotes)
    .innerJoin(schemeCatalog, eq(schemeNotes.schemeId, schemeCatalog.id))
    .where(eq(schemeNotes.userId, userId))
    .orderBy(desc(schemeNotes.updatedAt));
  const normalizedQuery = query?.trim().toLowerCase();
  return rows
    .map(row => ({
      schemeId: row.note.schemeId,
      note: row.note.note,
      updatedAt: row.note.updatedAt.getTime(),
      schemeName: row.scheme.name,
      schemeNameHindi: row.scheme.nameHindi,
      category: row.scheme.category,
      categoryHindi: row.scheme.categoryHindi,
      applicationDeadline: row.scheme.applicationDeadline?.getTime() ?? null,
    }))
    .filter(item => !normalizedQuery || `${item.schemeName} ${item.schemeNameHindi} ${item.category} ${item.categoryHindi} ${item.note}`.toLowerCase().includes(normalizedQuery));
}

export async function listComparisonExportPresets(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(comparisonExportPresets)
    .where(eq(comparisonExportPresets.userId, userId))
    .orderBy(desc(comparisonExportPresets.updatedAt));
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    fields: Array.isArray(row.fields) ? row.fields : [],
    updatedAt: row.updatedAt.getTime(),
  }));
}

export async function saveComparisonExportPreset(
  userId: number,
  name: string,
  fields: string[]
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Give this export preset a name.");
  const existing = await db
    .select({ id: comparisonExportPresets.id })
    .from(comparisonExportPresets)
    .where(eq(comparisonExportPresets.userId, userId));
  const namedRows = await db
    .select({ id: comparisonExportPresets.id })
    .from(comparisonExportPresets)
    .where(
      and(
        eq(comparisonExportPresets.userId, userId),
        eq(comparisonExportPresets.name, normalizedName)
      )
    )
    .limit(1);
  if (!namedRows[0] && existing.length >= 12)
    throw new Error("You can save up to 12 comparison export presets.");
  await db
    .insert(comparisonExportPresets)
    .values({ userId, name: normalizedName, fields })
    .onDuplicateKeyUpdate({
      set: { fields, updatedAt: new Date() },
    });
  const saved = await db
    .select()
    .from(comparisonExportPresets)
    .where(
      and(
        eq(comparisonExportPresets.userId, userId),
        eq(comparisonExportPresets.name, normalizedName)
      )
    )
    .limit(1);
  const preset = saved[0];
  if (!preset) throw new Error("The export preset could not be saved.");
  return {
    id: preset.id,
    name: preset.name,
    fields: Array.isArray(preset.fields) ? preset.fields : [],
    updatedAt: preset.updatedAt.getTime(),
  };
}

export async function deleteComparisonExportPreset(userId: number, presetId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .delete(comparisonExportPresets)
    .where(
      and(
        eq(comparisonExportPresets.id, presetId),
        eq(comparisonExportPresets.userId, userId)
      )
    );
}

async function getOwnedSavedScheme(userId: number, schemeId: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({ id: savedSchemes.id })
    .from(savedSchemes)
    .where(
      and(eq(savedSchemes.userId, userId), eq(savedSchemes.schemeId, schemeId))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getSchemeNote(userId: number, schemeId: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (!(await getOwnedSavedScheme(userId, schemeId))) return null;
  const rows = await db
    .select()
    .from(schemeNotes)
    .where(
      and(eq(schemeNotes.userId, userId), eq(schemeNotes.schemeId, schemeId))
    )
    .limit(1);
  const note = rows[0];
  return note ? { note: note.note, updatedAt: note.updatedAt.getTime() } : null;
}

export async function upsertSchemeNote(
  userId: number,
  schemeId: string,
  note: string
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (!(await getOwnedSavedScheme(userId, schemeId)))
    throw new Error("Save this scheme before adding a personal note.");
  const normalizedNote = note.trim();
  if (!normalizedNote) throw new Error("Write a note before saving it.");
  await db
    .insert(schemeNotes)
    .values({ userId, schemeId, note: normalizedNote })
    .onDuplicateKeyUpdate({
      set: { note: normalizedNote, updatedAt: new Date() },
    });
  return getSchemeNote(userId, schemeId);
}

export async function deleteSchemeNote(userId: number, schemeId: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .delete(schemeNotes)
    .where(
      and(eq(schemeNotes.userId, userId), eq(schemeNotes.schemeId, schemeId))
    );
}

export async function toggleSavedScheme(userId: number, schemeId: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const existing = await db
    .select({ id: savedSchemes.id })
    .from(savedSchemes)
    .where(
      and(eq(savedSchemes.userId, userId), eq(savedSchemes.schemeId, schemeId))
    )
    .limit(1);
  if (existing[0]) {
    await db
      .delete(schemeNotes)
      .where(
        and(eq(schemeNotes.userId, userId), eq(schemeNotes.schemeId, schemeId))
      );
    await db.delete(savedSchemes).where(eq(savedSchemes.id, existing[0].id));
    return { schemeId, saved: false };
  }
  await db.insert(savedSchemes).values({ userId, schemeId });
  return { schemeId, saved: true };
}

function mapReminder(row: typeof applicationReminders.$inferSelect) {
  return {
    id: row.id,
    remindAt: row.remindAt.getTime(),
    status: row.status,
    deliveredAt: row.deliveredAt?.getTime() ?? null,
    scheduleCronTaskUid: row.scheduleCronTaskUid ?? null,
  };
}

async function getTrackedApplication(
  userId: number,
  trackedApplicationId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(trackedApplications)
    .where(
      and(
        eq(trackedApplications.id, trackedApplicationId),
        eq(trackedApplications.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listTrackedApplications(userId: number) {
  const db = await ensureSchemeCatalog();
  const ocrPolicy = await getOcrPolicy();
  const applications = await db
    .select()
    .from(trackedApplications)
    .where(eq(trackedApplications.userId, userId));
  return Promise.all(
    applications.map(async application => {
      const scheme = await getSchemeById(application.schemeId);
      const reminders = await db
        .select()
        .from(applicationReminders)
        .where(eq(applicationReminders.trackedApplicationId, application.id));
      const documents = await db
        .select()
        .from(applicationDocuments)
        .where(eq(applicationDocuments.trackedApplicationId, application.id));
      return {
        id: application.id,
        schemeId: application.schemeId,
        status: application.status,
        applicationReference: application.applicationReference ?? null,
        applicationDeadline:
          application.applicationDeadline?.getTime() ??
          scheme?.applicationDeadline ??
          null,
        deadlineLabel:
          application.deadlineLabel ?? scheme?.deadlineLabel ?? null,
        notes: application.notes ?? null,
        createdAt: application.createdAt.getTime(),
        updatedAt: application.updatedAt.getTime(),
        scheme: scheme ?? null,
        reminders: reminders
          .map(mapReminder)
          .sort((a, b) => a.remindAt - b.remindAt),
        documents: await Promise.all(
          documents.map(async document => {
            const events = await db
              .select()
              .from(documentActivityEvents)
              .where(
                eq(documentActivityEvents.applicationDocumentId, document.id)
              )
              .orderBy(desc(documentActivityEvents.createdAt));
            const confidenceHistory = await db
              .select()
              .from(documentOcrConfidenceEvents)
              .where(
                eq(
                  documentOcrConfidenceEvents.applicationDocumentId,
                  document.id
                )
              )
              .orderBy(desc(documentOcrConfidenceEvents.createdAt));
            const needsManualReview =
              document.ocrStatus === "failed" ||
              (document.ocrStatus === "complete" && document.ocrExtraction
                ? needsManualOcrReview(
                    document.ocrExtraction.confidence,
                    document.ocrExtraction.concerns,
                    ocrPolicy.minimumConfidence
                  )
                : false);
            const ocrConfidenceHistory = confidenceHistory.map(event => ({
              confidence: event.confidence,
              concernCount: event.concernCount,
              createdAt: event.createdAt.getTime(),
            }));
            const confidenceTrend =
              summariseOcrConfidenceTrend(ocrConfidenceHistory);
            const activity = confidenceTrend
              ? [
                  {
                    id: -document.id,
                    kind: "ocrConfidenceTrend",
                    detail: confidenceTrend.label,
                    createdAt: confidenceTrend.createdAt,
                    confidenceHistory: ocrConfidenceHistory,
                    needsManualReview,
                  },
                  ...toDocumentTimeline(events),
                ]
              : toDocumentTimeline(events);
            const storageUrl = await storageGetSignedUrl(document.storageKey);
            return {
              id: document.id,
              documentName: document.documentName,
              storageUrl,
              fileName: document.fileName,
              mimeType: document.mimeType,
              expiresAt: document.expiresAt?.getTime() ?? null,
              expiryState: getDocumentExpiryState(
                document.expiresAt?.getTime() ?? null
              ),
              ocrStatus: document.ocrStatus,
              ocrExtraction: document.ocrExtraction,
              ocrError: document.ocrError ?? null,
              ocrVerifiedAt: document.ocrVerifiedAt?.getTime() ?? null,
              userVerifiedAt: document.userVerifiedAt?.getTime() ?? null,
              reviewState: document.reviewState,
              needsManualReview,
              uploadedAt: document.uploadedAt.getTime(),
              activity,
              ocrConfidenceHistory,
            };
          })
        ),
      };
    })
  );
}

export async function trackSchemeApplication(userId: number, schemeId: string) {
  const db = await ensureSchemeCatalog();
  const scheme = await getSchemeById(schemeId);
  if (!scheme) throw new Error("Scheme not found");
  await db
    .insert(trackedApplications)
    .values({
      userId,
      schemeId,
      applicationDeadline: scheme.applicationDeadline
        ? new Date(scheme.applicationDeadline)
        : null,
      deadlineLabel: scheme.deadlineLabel ?? null,
    })
    .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const tracked = await db
    .select()
    .from(trackedApplications)
    .where(
      and(
        eq(trackedApplications.userId, userId),
        eq(trackedApplications.schemeId, schemeId)
      )
    )
    .limit(1);
  return tracked[0];
}

export async function updateTrackedApplication(
  userId: number,
  trackedApplicationId: number,
  patch: {
    status?: ApplicationStatus;
    applicationReference?: string | null;
    applicationDeadline?: number | null;
    deadlineLabel?: string | null;
    notes?: string | null;
  }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const existing = await getTrackedApplication(userId, trackedApplicationId);
  if (!existing) throw new Error("Tracked application not found");
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status !== undefined) updateSet.status = patch.status;
  if (patch.applicationReference !== undefined)
    updateSet.applicationReference = patch.applicationReference || null;
  if (patch.applicationDeadline !== undefined)
    updateSet.applicationDeadline = patch.applicationDeadline
      ? new Date(patch.applicationDeadline)
      : null;
  if (patch.deadlineLabel !== undefined)
    updateSet.deadlineLabel = patch.deadlineLabel || null;
  if (patch.notes !== undefined) updateSet.notes = patch.notes || null;
  await db
    .update(trackedApplications)
    .set(updateSet)
    .where(eq(trackedApplications.id, trackedApplicationId));
  return getTrackedApplication(userId, trackedApplicationId);
}

export async function createApplicationReminder(
  userId: number,
  trackedApplicationId: number,
  remindAt: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const tracked = await getTrackedApplication(userId, trackedApplicationId);
  if (!tracked) throw new Error("Tracked application not found");
  const result = await db
    .insert(applicationReminders)
    .values({
      trackedApplicationId,
      remindAt: new Date(remindAt),
      status: "scheduled",
    });
  const rows = await db
    .select()
    .from(applicationReminders)
    .where(eq(applicationReminders.id, Number(result[0].insertId)))
    .limit(1);
  return rows[0];
}

export async function assignReminderHeartbeat(
  userId: number,
  reminderId: number,
  taskUid: string
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      reminder: applicationReminders,
      application: trackedApplications,
    })
    .from(applicationReminders)
    .innerJoin(
      trackedApplications,
      eq(applicationReminders.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(applicationReminders.id, reminderId),
        eq(trackedApplications.userId, userId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Reminder not found");
  await db
    .update(applicationReminders)
    .set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() })
    .where(eq(applicationReminders.id, reminderId));
  return { ...mapReminder(rows[0].reminder), scheduleCronTaskUid: taskUid };
}

export async function cancelApplicationReminder(
  userId: number,
  reminderId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      reminder: applicationReminders,
      application: trackedApplications,
    })
    .from(applicationReminders)
    .innerJoin(
      trackedApplications,
      eq(applicationReminders.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(applicationReminders.id, reminderId),
        eq(trackedApplications.userId, userId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Reminder not found");
  await db
    .update(applicationReminders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(applicationReminders.id, reminderId));
  return mapReminder(rows[0].reminder);
}

export async function getApplicationReminderByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(applicationReminders)
    .where(eq(applicationReminders.scheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0] ?? null;
}

export async function markApplicationReminderDelivered(reminderId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .update(applicationReminders)
    .set({
      status: "delivered",
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(applicationReminders.id, reminderId));
}

export async function uploadApplicationDocument(
  userId: number,
  trackedApplicationId: number,
  documentName: string,
  fileName: string,
  mimeType: string,
  base64Data: string,
  expiresAt?: number | null
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const tracked = await getTrackedApplication(userId, trackedApplicationId);
  if (!tracked) throw new Error("Tracked application not found");
  const scheme = await getSchemeById(tracked.schemeId);
  if (!scheme || !scheme.documents.includes(documentName))
    throw new Error("Document is not part of this scheme checklist");
  const previous = await db
    .select({ id: applicationDocuments.id })
    .from(applicationDocuments)
    .where(
      and(
        eq(applicationDocuments.trackedApplicationId, trackedApplicationId),
        eq(applicationDocuments.documentName, documentName)
      )
    )
    .limit(1);
  const bytes = validateDocumentUpload(fileName, mimeType, base64Data);
  const uploaded = await storagePut(
    `applications/${userId}/${trackedApplicationId}/${safeStorageFileName(fileName)}`,
    bytes,
    mimeType
  );
  await db
    .insert(applicationDocuments)
    .values({
      trackedApplicationId,
      documentName,
      storageKey: uploaded.key,
      storageUrl: uploaded.url,
      fileName,
      mimeType,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .onDuplicateKeyUpdate({
      set: {
        storageKey: uploaded.key,
        storageUrl: uploaded.url,
        fileName,
        mimeType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        ocrStatus: "notRequested",
        ocrExtraction: null,
        ocrError: null,
        ocrVerifiedAt: null,
        updatedAt: new Date(),
      },
    });
  const rows = await db
    .select()
    .from(applicationDocuments)
    .where(
      and(
        eq(applicationDocuments.trackedApplicationId, trackedApplicationId),
        eq(applicationDocuments.documentName, documentName)
      )
    )
    .limit(1);
  if (rows[0]) {
    if (shouldResetOcrConfidenceHistory(Boolean(previous[0])))
      await db
        .delete(documentOcrConfidenceEvents)
        .where(
          eq(documentOcrConfidenceEvents.applicationDocumentId, rows[0].id)
        );
    await db
      .update(documentExpiryNotifications)
      .set({ status: "read", readAt: new Date() })
      .where(eq(documentExpiryNotifications.applicationDocumentId, rows[0].id));
    await recordDocumentActivity(
      rows[0].id,
      previous[0] ? "reuploaded" : "uploaded",
      previous[0]
        ? "Fresh file uploaded; OCR verification reset."
        : "Document uploaded to checklist."
    );
  }
  return rows[0];
}

export async function removeApplicationDocument(
  userId: number,
  documentId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      document: applicationDocuments,
      application: trackedApplications,
    })
    .from(applicationDocuments)
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(applicationDocuments.id, documentId),
        eq(trackedApplications.userId, userId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Uploaded document not found");
  await db
    .delete(applicationDocuments)
    .where(eq(applicationDocuments.id, documentId));
}

async function getOwnedApplicationDocument(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      document: applicationDocuments,
      application: trackedApplications,
    })
    .from(applicationDocuments)
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(applicationDocuments.id, documentId),
        eq(trackedApplications.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function getAccessibleApplicationDocument(
  userId: number,
  documentId: number
) {
  const owned = await getOwnedApplicationDocument(userId, documentId);
  if (owned) return { ...owned, access: "owner" as const, assignmentId: null };
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      document: applicationDocuments,
      application: trackedApplications,
      assignment: documentReviewAssignments,
    })
    .from(documentReviewAssignments)
    .innerJoin(
      applicationDocuments,
      eq(
        documentReviewAssignments.applicationDocumentId,
        applicationDocuments.id
      )
    )
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(documentReviewAssignments.applicationDocumentId, documentId),
        eq(documentReviewAssignments.reviewerUserId, userId)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.assignment.status === "revoked") return null;
  return {
    document: row.document,
    application: row.application,
    access: "reviewer" as const,
    assignmentId: row.assignment.id,
  };
}

async function recordDocumentActivity(
  documentId: number,
  kind: DocumentActivityKind,
  detail?: string
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .insert(documentActivityEvents)
    .values(buildDocumentActivityInsert(documentId, kind, detail));
}

export async function getApplicationDocumentPreview(
  userId: number,
  documentId: number
) {
  const accessible = await getAccessibleApplicationDocument(userId, documentId);
  if (!accessible) throw new Error("Uploaded document not found");
  return {
    documentId,
    fileName: accessible.document.fileName,
    mimeType: accessible.document.mimeType,
    url: await storageGetSignedUrl(accessible.document.storageKey),
  };
}

export async function runApplicationDocumentOcr(
  userId: number,
  documentId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const owned = await getOwnedApplicationDocument(userId, documentId);
  if (!owned) throw new Error("Uploaded document not found");
  await db
    .update(applicationDocuments)
    .set({ ocrStatus: "processing", ocrError: null, updatedAt: new Date() })
    .where(eq(applicationDocuments.id, documentId));
  await recordDocumentActivity(
    documentId,
    "ocrStarted",
    "AI extraction started."
  );
  try {
    const extraction = await extractDocumentDetails({
      signedUrl: await storageGetSignedUrl(owned.document.storageKey),
      mimeType: owned.document.mimeType,
      checklistName: owned.document.documentName,
      fileName: owned.document.fileName,
    });
    await db
      .update(applicationDocuments)
      .set({
        ocrStatus: "complete",
        ocrExtraction: extraction,
        ocrError: null,
        ocrVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(applicationDocuments.id, documentId));
    await db
      .insert(documentOcrConfidenceEvents)
      .values({
        applicationDocumentId: documentId,
        confidence: extraction.confidence,
        concernCount: extraction.concerns.length,
      });
    await recordDocumentActivity(
      documentId,
      "ocrCompleted",
      `AI extraction completed with ${extraction.confidence} confidence.`
    );
    return extraction;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 500)
        : "OCR processing could not be completed";
    await db
      .update(applicationDocuments)
      .set({ ocrStatus: "failed", ocrError: message, updatedAt: new Date() })
      .where(eq(applicationDocuments.id, documentId));
    await recordDocumentActivity(
      documentId,
      "ocrFailed",
      "AI extraction failed; manual review or retry is required."
    );
    throw new Error(
      "OCR processing could not be completed. Please retry or review the document manually."
    );
  }
}

export async function updateApplicationDocumentExpiry(
  userId: number,
  documentId: number,
  expiresAt: number | null
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      document: applicationDocuments,
      application: trackedApplications,
    })
    .from(applicationDocuments)
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(applicationDocuments.id, documentId),
        eq(trackedApplications.userId, userId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Uploaded document not found");
  await db
    .update(applicationDocuments)
    .set({
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(applicationDocuments.id, documentId));
  await recordDocumentActivity(
    documentId,
    "expiryUpdated",
    expiresAt
      ? "Document expiry date updated."
      : "Document expiry date cleared."
  );
  if (expiresAt && expiresAt > Date.now())
    await db
      .update(documentExpiryNotifications)
      .set({ status: "read", readAt: new Date() })
      .where(eq(documentExpiryNotifications.applicationDocumentId, documentId));
}

export async function approveApplicationDocumentOcr(
  userId: number,
  documentId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const owned = await getOwnedApplicationDocument(userId, documentId);
  if (!owned || owned.document.ocrStatus !== "complete")
    throw new Error("Complete OCR extraction is required before approval");
  await db
    .update(applicationDocuments)
    .set(buildOcrApprovalUpdate(new Date()))
    .where(eq(applicationDocuments.id, documentId));
  await recordDocumentActivity(
    documentId,
    "userVerified",
    "User manually verified extracted details."
  );
}

export async function setApplicationDocumentReviewState(
  userId: number,
  documentId: number,
  reviewState: "reviewed" | "flagged" | "unreviewed"
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const owned = await getOwnedApplicationDocument(userId, documentId);
  if (!owned) throw new Error("Uploaded document not found");
  await db
    .update(applicationDocuments)
    .set({ reviewState, updatedAt: new Date() })
    .where(eq(applicationDocuments.id, documentId));
  if (reviewState === "reviewed")
    await recordDocumentActivity(
      documentId,
      "reviewed",
      "User marked this document as reviewed."
    );
  if (reviewState === "flagged")
    await recordDocumentActivity(
      documentId,
      "flagged",
      "User flagged this document for inspection."
    );
}

async function recordDocumentReviewAudit(
  documentId: number,
  actorUserId: number,
  kind:
    | "assigned"
    | "started"
    | "completed"
    | "revoked"
    | "noteCreated"
    | "noteUpdated"
    | "noteDeleted"
    | "dueReminderSent"
    | "reminderSnoozed"
    | "escalated"
    | "escalationResolved",
  detail: string,
  assignmentId: number | null = null
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .insert(documentReviewAuditEvents)
    .values({
      applicationDocumentId: documentId,
      assignmentId,
      actorUserId,
      kind,
      detail: detail.slice(0, 500),
    });
}

const defaultReviewerAlertPreferences = {
  assignmentAlertsEnabled: true,
  dueDateRemindersEnabled: true,
  defaultReminderLeadHours: 24,
  maxActiveAssignments: 5,
};

export async function getDocumentReviewerAlertPreferences(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewerAlertPreferences)
    .where(eq(documentReviewerAlertPreferences.userId, userId))
    .limit(1);
  const row = rows[0];
  return {
    ...defaultReviewerAlertPreferences,
    ...(row
      ? {
          assignmentAlertsEnabled: row.assignmentAlertsEnabled,
          dueDateRemindersEnabled: row.dueDateRemindersEnabled,
          defaultReminderLeadHours: row.defaultReminderLeadHours,
          maxActiveAssignments: row.maxActiveAssignments,
        }
      : {}),
  };
}

export async function saveDocumentReviewerAlertPreferences(
  userId: number,
  input: {
    assignmentAlertsEnabled: boolean;
    dueDateRemindersEnabled: boolean;
    defaultReminderLeadHours: number;
    maxActiveAssignments: number;
  }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const existing = await db
    .select({ id: documentReviewerAlertPreferences.id })
    .from(documentReviewerAlertPreferences)
    .where(eq(documentReviewerAlertPreferences.userId, userId))
    .limit(1);
  if (existing[0])
    await db
      .update(documentReviewerAlertPreferences)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(documentReviewerAlertPreferences.id, existing[0].id));
  else
    await db
      .insert(documentReviewerAlertPreferences)
      .values({ userId, ...input });
  return getDocumentReviewerAlertPreferences(userId);
}

export async function listDocumentReviewEscalationTemplates(
  ownerUserId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewEscalationTemplates)
    .where(eq(documentReviewEscalationTemplates.ownerUserId, ownerUserId))
    .orderBy(desc(documentReviewEscalationTemplates.updatedAt));
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }));
}

export async function saveDocumentReviewEscalationTemplate(
  ownerUserId: number,
  input: { templateId?: number; name: string; body: string }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body)
    throw new Error("Add both a template name and follow-up message.");
  if (input.templateId) {
    const existing = await db
      .select({ id: documentReviewEscalationTemplates.id })
      .from(documentReviewEscalationTemplates)
      .where(
        and(
          eq(documentReviewEscalationTemplates.id, input.templateId),
          eq(documentReviewEscalationTemplates.ownerUserId, ownerUserId)
        )
      )
      .limit(1);
    if (!existing[0]) throw new Error("Escalation template not found.");
    await db
      .update(documentReviewEscalationTemplates)
      .set({ name, body, updatedAt: new Date() })
      .where(eq(documentReviewEscalationTemplates.id, input.templateId));
    return input.templateId;
  }
  const existing = await db
    .select({ id: documentReviewEscalationTemplates.id })
    .from(documentReviewEscalationTemplates)
    .where(eq(documentReviewEscalationTemplates.ownerUserId, ownerUserId));
  if (existing.length >= 20)
    throw new Error("You can keep up to 20 private escalation templates.");
  const created = await db
    .insert(documentReviewEscalationTemplates)
    .values({ ownerUserId, name, body });
  return Number(created[0].insertId);
}

export async function deleteDocumentReviewEscalationTemplate(
  ownerUserId: number,
  templateId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const existing = await db
    .select({ id: documentReviewEscalationTemplates.id })
    .from(documentReviewEscalationTemplates)
    .where(
      and(
        eq(documentReviewEscalationTemplates.id, templateId),
        eq(documentReviewEscalationTemplates.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  if (!existing[0]) throw new Error("Escalation template not found.");
  await db
    .delete(documentReviewEscalationTemplates)
    .where(eq(documentReviewEscalationTemplates.id, templateId));
}

export async function listDocumentReviewAssignments(
  ownerUserId: number,
  documentId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (!(await getOwnedApplicationDocument(ownerUserId, documentId)))
    throw new Error("Uploaded document not found");
  const rows = await db
    .select({
      assignment: documentReviewAssignments,
      reviewerName: users.name,
      reviewerEmail: users.email,
    })
    .from(documentReviewAssignments)
    .innerJoin(users, eq(documentReviewAssignments.reviewerUserId, users.id))
    .where(
      and(
        eq(documentReviewAssignments.applicationDocumentId, documentId),
        eq(documentReviewAssignments.ownerUserId, ownerUserId)
      )
    )
    .orderBy(desc(documentReviewAssignments.updatedAt));
  return rows.map(row => ({
    id: row.assignment.id,
    reviewerUserId: row.assignment.reviewerUserId,
    reviewerName: row.reviewerName ?? row.reviewerEmail ?? "Reviewer",
    reviewerEmail: row.reviewerEmail ?? null,
    status: row.assignment.status,
    assignedAt: row.assignment.assignedAt.getTime(),
    dueAt: row.assignment.dueAt?.getTime() ?? null,
    reminderAt: row.assignment.reminderAt?.getTime() ?? null,
    reminderStatus: row.assignment.reminderStatus,
    reminderSnoozedUntil:
      row.assignment.reminderSnoozedUntil?.getTime() ?? null,
    reminderSnoozeCount: row.assignment.reminderSnoozeCount,
    escalationState: row.assignment.escalationState,
    escalatedAt: row.assignment.escalatedAt?.getTime() ?? null,
    escalationNote: row.assignment.escalationNote ?? null,
    completedAt: row.assignment.completedAt?.getTime() ?? null,
    revokedAt: row.assignment.revokedAt?.getTime() ?? null,
    updatedAt: row.assignment.updatedAt.getTime(),
  }));
}

export async function assignDocumentReviewer(
  ownerUserId: number,
  documentId: number,
  reviewerEmail: string
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (!(await getOwnedApplicationDocument(ownerUserId, documentId)))
    throw new Error("Uploaded document not found");
  const reviewers = await db
    .select()
    .from(users)
    .where(eq(users.email, reviewerEmail.trim().toLowerCase()))
    .limit(1);
  const reviewer = reviewers[0];
  if (!reviewer)
    throw new Error(
      "Ask the reviewer to sign in once before assigning this document."
    );
  if (reviewer.id === ownerUserId)
    throw new Error(
      "You already own this document and do not need to assign yourself."
    );
  const existing = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.applicationDocumentId, documentId),
        eq(documentReviewAssignments.reviewerUserId, reviewer.id)
      )
    )
    .limit(1);
  const preferences = await getDocumentReviewerAlertPreferences(reviewer.id);
  const needsCapacity =
    !existing[0] ||
    existing[0].status === "completed" ||
    existing[0].status === "revoked";
  if (needsCapacity) {
    const reviewerAssignments = await db
      .select({ status: documentReviewAssignments.status })
      .from(documentReviewAssignments)
      .where(eq(documentReviewAssignments.reviewerUserId, reviewer.id));
    const activeCount = reviewerAssignments.filter(
      assignment =>
        assignment.status === "assigned" || assignment.status === "inReview"
    ).length;
    if (activeCount >= preferences.maxActiveAssignments)
      throw new Error(
        `This reviewer has reached their active review limit of ${preferences.maxActiveAssignments}.`
      );
  }
  let assignmentId: number;
  if (existing[0]) {
    assignmentId = existing[0].id;
    await db
      .update(documentReviewAssignments)
      .set({
        ownerUserId,
        status: "assigned",
        assignedAt: new Date(),
        completedAt: null,
        revokedAt: null,
        escalationState: "normal",
        escalatedAt: null,
        escalationNote: null,
        updatedAt: new Date(),
      })
      .where(eq(documentReviewAssignments.id, assignmentId));
  } else {
    const created = await db
      .insert(documentReviewAssignments)
      .values({
        applicationDocumentId: documentId,
        ownerUserId,
        reviewerUserId: reviewer.id,
        status: "assigned",
      });
    assignmentId = Number(created[0].insertId);
  }
  if (preferences.assignmentAlertsEnabled)
    await db
      .insert(documentReviewAssignmentNotifications)
      .values({
        assignmentId,
        recipientUserId: reviewer.id,
        kind: "assignment",
        status: "unread",
      })
      .onDuplicateKeyUpdate({
        set: {
          recipientUserId: reviewer.id,
          status: "unread",
          createdAt: new Date(),
          readAt: null,
        },
      });
  await recordDocumentReviewAudit(
    documentId,
    ownerUserId,
    "assigned",
    `Assigned ${reviewer.name ?? reviewer.email ?? "a reviewer"}.`,
    assignmentId
  );
  return listDocumentReviewAssignments(ownerUserId, documentId);
}

export async function revokeDocumentReviewer(
  ownerUserId: number,
  assignmentId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (!assignment) throw new Error("Review assignment not found");
  await db
    .update(documentReviewAssignments)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      reminderStatus: assignment.reminderScheduleCronTaskUid
        ? "cancelled"
        : assignment.reminderStatus,
      reminderScheduleCronTaskUid: null,
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignmentId));
  await recordDocumentReviewAudit(
    assignment.applicationDocumentId,
    ownerUserId,
    "revoked",
    "Owner revoked reviewer access.",
    assignmentId
  );
  return { previousTaskUid: assignment.reminderScheduleCronTaskUid };
}

export async function setDocumentReviewAssignmentDueDate(
  ownerUserId: number,
  assignmentId: number,
  dueAt: number | null,
  reminderAt: number | null
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (!assignment) throw new Error("Review assignment not found");
  if (assignment.status === "revoked" || assignment.status === "completed")
    throw new Error(
      "Due dates can be changed only for an active review assignment"
    );
  const previousTaskUid = assignment.reminderScheduleCronTaskUid;
  await db
    .update(documentReviewAssignments)
    .set({
      dueAt: dueAt ? new Date(dueAt) : null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      reminderStatus: previousTaskUid ? "cancelled" : "none",
      reminderScheduleCronTaskUid: null,
      reminderDeliveredAt: null,
      reminderSnoozedUntil: null,
      reminderSnoozeCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignmentId));
  return { assignmentId, previousTaskUid };
}

export async function assignDocumentReviewDueReminderTask(
  ownerUserId: number,
  assignmentId: number,
  taskUid: string
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (
    !assignment ||
    !assignment.reminderAt ||
    assignment.status === "revoked" ||
    assignment.status === "completed"
  )
    throw new Error(
      "Active review assignment with a reminder time is required"
    );
  await db
    .update(documentReviewAssignments)
    .set({
      reminderScheduleCronTaskUid: taskUid,
      reminderStatus: "scheduled",
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignmentId));
}

export async function cancelDocumentReviewDueReminder(
  ownerUserId: number,
  assignmentId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (!assignment) throw new Error("Review assignment not found");
  await db
    .update(documentReviewAssignments)
    .set({
      reminderStatus: "cancelled",
      reminderScheduleCronTaskUid: null,
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignmentId));
  return { previousTaskUid: assignment.reminderScheduleCronTaskUid };
}

export async function getDocumentReviewDueReminderByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(eq(documentReviewAssignments.reminderScheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0] ?? null;
}

export async function deliverDocumentReviewDueReminder(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const assignment = await getDocumentReviewDueReminderByTaskUid(taskUid);
  if (!assignment || assignment.reminderStatus !== "scheduled")
    return {
      delivered: false,
      skipped: "orphan-or-complete" as const,
      assignmentId: assignment?.id ?? null,
    };
  if (assignment.status === "revoked" || assignment.status === "completed") {
    await db
      .update(documentReviewAssignments)
      .set({ reminderStatus: "cancelled", updatedAt: new Date() })
      .where(eq(documentReviewAssignments.id, assignment.id));
    return {
      delivered: false,
      skipped: "inactive-review" as const,
      assignmentId: assignment.id,
    };
  }
  const preferences = await getDocumentReviewerAlertPreferences(
    assignment.reviewerUserId
  );
  if (!preferences.dueDateRemindersEnabled) {
    await db
      .update(documentReviewAssignments)
      .set({ reminderStatus: "cancelled", updatedAt: new Date() })
      .where(eq(documentReviewAssignments.id, assignment.id));
    return {
      delivered: false,
      skipped: "reviewer-preference" as const,
      assignmentId: assignment.id,
    };
  }
  await db
    .insert(documentReviewAssignmentNotifications)
    .values({
      assignmentId: assignment.id,
      recipientUserId: assignment.reviewerUserId,
      kind: "dueDateReminder",
      status: "unread",
    })
    .onDuplicateKeyUpdate({
      set: { status: "unread", createdAt: new Date(), readAt: null },
    });
  await db
    .update(documentReviewAssignments)
    .set({
      reminderStatus: "delivered",
      reminderDeliveredAt: new Date(),
      reminderSnoozedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignment.id));
  await recordDocumentReviewAudit(
    assignment.applicationDocumentId,
    assignment.ownerUserId,
    "dueReminderSent",
    "Automated due-date reminder was delivered to the assigned reviewer.",
    assignment.id
  );
  return { delivered: true, skipped: null, assignmentId: assignment.id };
}

export async function getMyDocumentReviewWorkload(reviewerUserId: number) {
  const assignments = await listMyDocumentReviewAssignments(reviewerUserId);
  const now = Date.now();
  const soon = now + 48 * 60 * 60 * 1000;
  const active = assignments.filter(
    assignment =>
      assignment.status === "assigned" || assignment.status === "inReview"
  );
  return {
    summary: {
      active: active.length,
      assigned: active.filter(assignment => assignment.status === "assigned")
        .length,
      inReview: active.filter(assignment => assignment.status === "inReview")
        .length,
      overdue: active.filter(assignment =>
        Boolean(assignment.dueAt && assignment.dueAt < now)
      ).length,
      dueSoon: active.filter(assignment =>
        Boolean(
          assignment.dueAt &&
            assignment.dueAt >= now &&
            assignment.dueAt <= soon
        )
      ).length,
      escalated: active.filter(
        assignment => assignment.escalationState === "escalated"
      ).length,
    },
    assignments,
  };
}

export async function listOwnerOverdueDocumentReviews(ownerUserId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      assignment: documentReviewAssignments,
      document: applicationDocuments,
      application: trackedApplications,
      reviewerName: users.name,
      reviewerEmail: users.email,
    })
    .from(documentReviewAssignments)
    .innerJoin(
      applicationDocuments,
      eq(
        documentReviewAssignments.applicationDocumentId,
        applicationDocuments.id
      )
    )
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .innerJoin(users, eq(documentReviewAssignments.reviewerUserId, users.id))
    .where(eq(documentReviewAssignments.ownerUserId, ownerUserId))
    .orderBy(desc(documentReviewAssignments.dueAt));
  const now = Date.now();
  const schemeCache = new Map<string, string>();
  return Promise.all(
    rows
      .filter(
        row =>
          (row.assignment.status === "assigned" ||
            row.assignment.status === "inReview") &&
          Boolean(row.assignment.dueAt && row.assignment.dueAt.getTime() < now)
      )
      .map(async row => {
        let schemeName = schemeCache.get(row.application.schemeId);
        if (!schemeName) {
          schemeName =
            (await getSchemeById(row.application.schemeId))?.name ??
            row.application.schemeId;
          schemeCache.set(row.application.schemeId, schemeName);
        }
        return {
          assignmentId: row.assignment.id,
          documentId: row.document.id,
          documentName: row.document.documentName,
          schemeName,
          reviewerName: row.reviewerName ?? row.reviewerEmail ?? "Reviewer",
          status: row.assignment.status,
          dueAt: row.assignment.dueAt!.getTime(),
          escalationState: row.assignment.escalationState,
          escalationNote: row.assignment.escalationNote ?? null,
          escalatedAt: row.assignment.escalatedAt?.getTime() ?? null,
        };
      })
  );
}

export async function setDocumentReviewEscalation(
  ownerUserId: number,
  assignmentId: number,
  input: { action: "escalate" | "resolve"; note?: string }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.ownerUserId, ownerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (
    !assignment ||
    assignment.status === "revoked" ||
    assignment.status === "completed"
  )
    throw new Error("Active review assignment not found");
  const note = input.note?.trim().slice(0, 500) || null;
  if (input.action === "escalate") {
    if (!assignment.dueAt || assignment.dueAt.getTime() >= Date.now())
      throw new Error("Only overdue review assignments can be escalated");
    await db
      .update(documentReviewAssignments)
      .set({
        escalationState: "escalated",
        escalatedAt: new Date(),
        escalationNote: note,
        updatedAt: new Date(),
      })
      .where(eq(documentReviewAssignments.id, assignmentId));
    await recordDocumentReviewAudit(
      assignment.applicationDocumentId,
      ownerUserId,
      "escalated",
      note
        ? `Owner escalated this overdue review: ${note}`
        : "Owner escalated this overdue review.",
      assignmentId
    );
  } else {
    await db
      .update(documentReviewAssignments)
      .set({
        escalationState: "resolved",
        escalationNote: note,
        updatedAt: new Date(),
      })
      .where(eq(documentReviewAssignments.id, assignmentId));
    await recordDocumentReviewAudit(
      assignment.applicationDocumentId,
      ownerUserId,
      "escalationResolved",
      note
        ? `Owner resolved the escalation: ${note}`
        : "Owner resolved the escalation.",
      assignmentId
    );
  }
}

export async function snoozeDocumentReviewDueReminder(
  reviewerUserId: number,
  assignmentId: number,
  snoozeUntil: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.reviewerUserId, reviewerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (
    !assignment ||
    assignment.status === "revoked" ||
    assignment.status === "completed"
  )
    throw new Error("Active review assignment not found");
  const preferences = await getDocumentReviewerAlertPreferences(reviewerUserId);
  if (!preferences.dueDateRemindersEnabled)
    throw new Error("Turn on due-date reminders before snoozing one.");
  if (!assignment.dueAt || snoozeUntil >= assignment.dueAt.getTime())
    throw new Error("Choose a snooze time before the review due date");
  if (snoozeUntil <= Date.now() + 60_000)
    throw new Error("Choose a snooze time at least one minute in the future");
  const previousTaskUid = assignment.reminderScheduleCronTaskUid;
  await db
    .update(documentReviewAssignments)
    .set({
      reminderAt: new Date(snoozeUntil),
      reminderStatus: "none",
      reminderScheduleCronTaskUid: null,
      reminderSnoozedUntil: new Date(snoozeUntil),
      reminderSnoozeCount: assignment.reminderSnoozeCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignmentId));
  await recordDocumentReviewAudit(
    assignment.applicationDocumentId,
    reviewerUserId,
    "reminderSnoozed",
    "Reviewer snoozed the due-date reminder.",
    assignmentId
  );
  return { previousTaskUid };
}

export async function assignDocumentReviewSnoozeTask(
  reviewerUserId: number,
  assignmentId: number,
  taskUid: string
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.reviewerUserId, reviewerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (
    !assignment ||
    !assignment.reminderAt ||
    assignment.status === "revoked" ||
    assignment.status === "completed"
  )
    throw new Error("Active snoozed review reminder not found");
  await db
    .update(documentReviewAssignments)
    .set({
      reminderScheduleCronTaskUid: taskUid,
      reminderStatus: "scheduled",
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignmentId));
}

export async function listMyDocumentReviewAssignments(reviewerUserId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      assignment: documentReviewAssignments,
      document: applicationDocuments,
      application: trackedApplications,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(documentReviewAssignments)
    .innerJoin(
      applicationDocuments,
      eq(
        documentReviewAssignments.applicationDocumentId,
        applicationDocuments.id
      )
    )
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .innerJoin(users, eq(documentReviewAssignments.ownerUserId, users.id))
    .where(eq(documentReviewAssignments.reviewerUserId, reviewerUserId))
    .orderBy(desc(documentReviewAssignments.updatedAt));
  const schemeCache = new Map<string, string>();
  return Promise.all(
    rows.map(async row => {
      let schemeName = schemeCache.get(row.application.schemeId);
      if (!schemeName) {
        schemeName =
          (await getSchemeById(row.application.schemeId))?.name ??
          row.application.schemeId;
        schemeCache.set(row.application.schemeId, schemeName);
      }
      return {
        id: row.assignment.id,
        documentId: row.document.id,
        documentName: row.document.documentName,
        fileName: row.document.fileName,
        mimeType: row.document.mimeType,
        schemeName,
        ownerName: row.ownerName ?? row.ownerEmail ?? "Document owner",
        status: row.assignment.status,
        assignedAt: row.assignment.assignedAt.getTime(),
        dueAt: row.assignment.dueAt?.getTime() ?? null,
        reminderAt: row.assignment.reminderAt?.getTime() ?? null,
        reminderStatus: row.assignment.reminderStatus,
        reminderSnoozedUntil:
          row.assignment.reminderSnoozedUntil?.getTime() ?? null,
        reminderSnoozeCount: row.assignment.reminderSnoozeCount,
        escalationState: row.assignment.escalationState,
        escalationNote: row.assignment.escalationNote ?? null,
        completedAt: row.assignment.completedAt?.getTime() ?? null,
      };
    })
  );
}

export async function updateMyDocumentReviewAssignment(
  reviewerUserId: number,
  assignmentId: number,
  status: "inReview" | "completed"
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReviewAssignments)
    .where(
      and(
        eq(documentReviewAssignments.id, assignmentId),
        eq(documentReviewAssignments.reviewerUserId, reviewerUserId)
      )
    )
    .limit(1);
  const assignment = rows[0];
  if (!assignment || assignment.status === "revoked")
    throw new Error("Review assignment not found");
  await db
    .update(documentReviewAssignments)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(documentReviewAssignments.id, assignmentId));
  await recordDocumentReviewAudit(
    assignment.applicationDocumentId,
    reviewerUserId,
    status === "completed" ? "completed" : "started",
    status === "completed"
      ? "Reviewer marked this review complete."
      : "Reviewer started reviewing this document.",
    assignmentId
  );
}

export async function listDocumentReviewAudit(
  userId: number,
  documentId: number,
  filters?: {
    startAt?: number;
    endAt?: number;
    kinds?: (
      | "assigned"
      | "started"
      | "completed"
      | "revoked"
      | "noteCreated"
      | "noteUpdated"
      | "noteDeleted"
      | "dueReminderSent"
      | "reminderSnoozed"
      | "escalated"
      | "escalationResolved"
    )[];
  }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (!(await getAccessibleApplicationDocument(userId, documentId)))
    throw new Error("Review audit is not available for this document");
  const rows = await db
    .select({
      audit: documentReviewAuditEvents,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(documentReviewAuditEvents)
    .innerJoin(users, eq(documentReviewAuditEvents.actorUserId, users.id))
    .where(eq(documentReviewAuditEvents.applicationDocumentId, documentId))
    .orderBy(desc(documentReviewAuditEvents.createdAt));
  return rows
    .filter(
      row =>
        (!filters?.startAt ||
          row.audit.createdAt.getTime() >= filters.startAt) &&
        (!filters?.endAt || row.audit.createdAt.getTime() <= filters.endAt) &&
        (!filters?.kinds?.length || filters.kinds.includes(row.audit.kind))
    )
    .map(row => ({
      id: row.audit.id,
      assignmentId: row.audit.assignmentId,
      kind: row.audit.kind,
      detail: row.audit.detail ?? null,
      actorName: row.actorName ?? row.actorEmail ?? "Account holder",
      createdAt: row.audit.createdAt.getTime(),
    }));
}

export async function listDocumentReviewAssignmentNotifications(
  reviewerUserId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      notification: documentReviewAssignmentNotifications,
      assignment: documentReviewAssignments,
      document: applicationDocuments,
      application: trackedApplications,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(documentReviewAssignmentNotifications)
    .innerJoin(
      documentReviewAssignments,
      eq(
        documentReviewAssignmentNotifications.assignmentId,
        documentReviewAssignments.id
      )
    )
    .innerJoin(
      applicationDocuments,
      eq(
        documentReviewAssignments.applicationDocumentId,
        applicationDocuments.id
      )
    )
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .innerJoin(users, eq(documentReviewAssignments.ownerUserId, users.id))
    .where(
      and(
        eq(
          documentReviewAssignmentNotifications.recipientUserId,
          reviewerUserId
        ),
        eq(documentReviewAssignmentNotifications.status, "unread"),
        ne(documentReviewAssignments.status, "revoked")
      )
    )
    .orderBy(desc(documentReviewAssignmentNotifications.createdAt));
  const schemeCache = new Map<string, string>();
  return Promise.all(
    rows.map(async row => {
      let schemeName = schemeCache.get(row.application.schemeId);
      if (!schemeName) {
        schemeName =
          (await getSchemeById(row.application.schemeId))?.name ??
          row.application.schemeId;
        schemeCache.set(row.application.schemeId, schemeName);
      }
      return {
        id: row.notification.id,
        assignmentId: row.assignment.id,
        documentId: row.document.id,
        documentName: row.document.documentName,
        fileName: row.document.fileName,
        mimeType: row.document.mimeType,
        schemeName,
        ownerName: row.ownerName ?? row.ownerEmail ?? "Document owner",
        kind: row.notification.kind,
        assignmentStatus: row.assignment.status,
        assignedAt: row.assignment.assignedAt.getTime(),
        dueAt: row.assignment.dueAt?.getTime() ?? null,
        createdAt: row.notification.createdAt.getTime(),
      };
    })
  );
}

export async function markDocumentReviewAssignmentNotificationRead(
  reviewerUserId: number,
  notificationId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({ id: documentReviewAssignmentNotifications.id })
    .from(documentReviewAssignmentNotifications)
    .where(
      and(
        eq(documentReviewAssignmentNotifications.id, notificationId),
        eq(
          documentReviewAssignmentNotifications.recipientUserId,
          reviewerUserId
        )
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Reviewer notification not found");
  await db
    .update(documentReviewAssignmentNotifications)
    .set({ status: "read", readAt: new Date() })
    .where(eq(documentReviewAssignmentNotifications.id, notificationId));
}

export async function listDocumentPdfAnnotations(
  userId: number,
  documentId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (!(await getAccessibleApplicationDocument(userId, documentId)))
    throw new Error("Private notes are not available for this document");
  const rows = await db
    .select()
    .from(documentPdfAnnotations)
    .where(
      and(
        eq(documentPdfAnnotations.applicationDocumentId, documentId),
        eq(documentPdfAnnotations.authorUserId, userId)
      )
    )
    .orderBy(desc(documentPdfAnnotations.updatedAt));
  return rows.map(row => ({
    id: row.id,
    pageNumber: row.pageNumber,
    note: row.note,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }));
}

export async function saveDocumentPdfAnnotation(
  userId: number,
  input: {
    documentId: number;
    pageNumber: number;
    note: string;
    annotationId?: number;
  }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const access = await getAccessibleApplicationDocument(
    userId,
    input.documentId
  );
  if (!access)
    throw new Error("Private notes are not available for this document");
  const note = input.note.trim();
  if (!note) throw new Error("Write a note before saving.");
  if (input.annotationId) {
    const existing = await db
      .select()
      .from(documentPdfAnnotations)
      .where(
        and(
          eq(documentPdfAnnotations.id, input.annotationId),
          eq(documentPdfAnnotations.applicationDocumentId, input.documentId),
          eq(documentPdfAnnotations.authorUserId, userId)
        )
      )
      .limit(1);
    if (!existing[0]) throw new Error("Private note not found");
    await db
      .update(documentPdfAnnotations)
      .set({ pageNumber: input.pageNumber, note, updatedAt: new Date() })
      .where(eq(documentPdfAnnotations.id, input.annotationId));
    await recordDocumentReviewAudit(
      input.documentId,
      userId,
      "noteUpdated",
      `Updated a private note on page ${input.pageNumber}.`,
      access.assignmentId
    );
    return input.annotationId;
  }
  const created = await db
    .insert(documentPdfAnnotations)
    .values({
      applicationDocumentId: input.documentId,
      authorUserId: userId,
      pageNumber: input.pageNumber,
      note,
    });
  const annotationId = Number(created[0].insertId);
  await recordDocumentReviewAudit(
    input.documentId,
    userId,
    "noteCreated",
    `Added a private note on page ${input.pageNumber}.`,
    access.assignmentId
  );
  return annotationId;
}

export async function deleteDocumentPdfAnnotation(
  userId: number,
  annotationId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentPdfAnnotations)
    .where(
      and(
        eq(documentPdfAnnotations.id, annotationId),
        eq(documentPdfAnnotations.authorUserId, userId)
      )
    )
    .limit(1);
  const annotation = rows[0];
  if (!annotation) throw new Error("Private note not found");
  const access = await getAccessibleApplicationDocument(
    userId,
    annotation.applicationDocumentId
  );
  if (!access)
    throw new Error("Private notes are not available for this document");
  await db
    .delete(documentPdfAnnotations)
    .where(eq(documentPdfAnnotations.id, annotationId));
  await recordDocumentReviewAudit(
    annotation.applicationDocumentId,
    userId,
    "noteDeleted",
    `Deleted a private note from page ${annotation.pageNumber}.`,
    access.assignmentId
  );
}

export async function listDocumentVerificationHistory(
  userId: number,
  filters?: {
    startAt?: number;
    endAt?: number;
    sort?: "newest" | "oldest";
    query?: string;
  }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      event: documentActivityEvents,
      document: applicationDocuments,
      application: trackedApplications,
    })
    .from(documentActivityEvents)
    .innerJoin(
      applicationDocuments,
      eq(documentActivityEvents.applicationDocumentId, applicationDocuments.id)
    )
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .where(eq(trackedApplications.userId, userId));
  const schemeCache = new Map<string, string>();
  const events: VerificationHistoryEvent[] = [];
  for (const row of rows) {
    const at = row.event.createdAt.getTime();
    let schemeName = schemeCache.get(row.application.schemeId);
    if (!schemeName) {
      schemeName =
        (await getSchemeById(row.application.schemeId))?.name ??
        row.application.schemeId;
      schemeCache.set(row.application.schemeId, schemeName);
    }
    events.push({
      documentId: row.document.id,
      documentName: row.document.documentName,
      fileName: row.document.fileName,
      mimeType: row.document.mimeType,
      schemeName,
      kind: row.event.kind,
      detail: row.event.detail ?? null,
      createdAt: at,
    });
  }
  return filterVerificationHistory(events, filters);
}

export async function exportDocumentVerificationHistoryPdf(
  userId: number,
  filters?: {
    startAt?: number;
    endAt?: number;
    sort?: "newest" | "oldest";
    query?: string;
  }
) {
  const events = (await listDocumentVerificationHistory(userId, filters)).slice(
    0,
    200
  );
  return {
    fileName: "scheme-sathi-verification-history.pdf",
    base64Data: Buffer.from(
      await createVerificationHistoryPdf(events)
    ).toString("base64"),
    eventCount: events.length,
  };
}

export async function exportDocumentVerificationHistoryCsv(
  userId: number,
  filters?: {
    startAt?: number;
    endAt?: number;
    sort?: "newest" | "oldest";
    query?: string;
  }
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const events = (await listDocumentVerificationHistory(userId, filters)).slice(
    0,
    1000
  );
  const details = new Map<
    number,
    {
      ocrStatus: string;
      ocrExtraction: {
        confidence: string;
        documentType: string;
        detectedName: string | null;
        concerns: string[];
      } | null;
      reviewState: string;
    }
  >();
  for (const documentId of Array.from(
    new Set(
      events.flatMap(event => (event.documentId ? [event.documentId] : []))
    )
  )) {
    const owned = await getOwnedApplicationDocument(userId, documentId);
    if (owned)
      details.set(documentId, {
        ocrStatus: owned.document.ocrStatus,
        ocrExtraction: owned.document.ocrExtraction,
        reviewState: owned.document.reviewState,
      });
  }
  return {
    fileName: "scheme-sathi-verification-history.csv",
    csv: createVerificationHistoryCsv(events, details),
    eventCount: events.length,
  };
}

function mapSavedVerificationHistoryFilter(
  row: typeof savedVerificationHistoryFilters.$inferSelect
): SavedVerificationHistoryFilter {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    startAt: row.startAt?.getTime(),
    endAt: row.endAt?.getTime(),
    sort: row.sort,
    isDefault: row.isDefault,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listSavedVerificationHistoryFilters(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(savedVerificationHistoryFilters)
    .where(eq(savedVerificationHistoryFilters.userId, userId))
    .orderBy(desc(savedVerificationHistoryFilters.updatedAt));
  return rows.map(mapSavedVerificationHistoryFilter);
}

export async function saveVerificationHistoryFilter(
  userId: number,
  input: VerificationHistoryFilterPresetInput
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const values = {
    userId,
    name: input.name,
    query: input.query,
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
    sort: input.sort,
  };
  await db
    .insert(savedVerificationHistoryFilters)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        query: values.query,
        startAt: values.startAt,
        endAt: values.endAt,
        sort: values.sort,
        updatedAt: new Date(),
      },
    });
  const rows = await db
    .select()
    .from(savedVerificationHistoryFilters)
    .where(
      and(
        eq(savedVerificationHistoryFilters.userId, userId),
        eq(savedVerificationHistoryFilters.name, input.name)
      )
    )
    .limit(1);
  return mapSavedVerificationHistoryFilter(rows[0]!);
}

export async function removeSavedVerificationHistoryFilter(
  userId: number,
  filterId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .delete(savedVerificationHistoryFilters)
    .where(
      and(
        eq(savedVerificationHistoryFilters.userId, userId),
        eq(savedVerificationHistoryFilters.id, filterId)
      )
    );
}

export async function setDefaultVerificationHistoryFilter(
  userId: number,
  filterId: number | null
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  if (filterId !== null) {
    const owned = await db
      .select({ id: savedVerificationHistoryFilters.id })
      .from(savedVerificationHistoryFilters)
      .where(
        and(
          eq(savedVerificationHistoryFilters.userId, userId),
          eq(savedVerificationHistoryFilters.id, filterId)
        )
      )
      .limit(1);
    if (!owned[0]) throw new Error("Saved history filter not found");
  }
  await db
    .update(savedVerificationHistoryFilters)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(savedVerificationHistoryFilters.userId, userId));
  if (filterId !== null)
    await db
      .update(savedVerificationHistoryFilters)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(savedVerificationHistoryFilters.userId, userId),
          eq(savedVerificationHistoryFilters.id, filterId)
        )
      );
  return listSavedVerificationHistoryFilters(userId);
}

export async function listVerificationHistoryFilterShares(
  ownerUserId: number
): Promise<VerificationHistoryFilterShareRecipient[]> {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      shareId: savedVerificationHistoryFilterShares.id,
      savedFilterId: savedVerificationHistoryFilterShares.savedFilterId,
      recipientUserId: users.id,
      recipientName: users.name,
      recipientEmail: users.email,
      status: savedVerificationHistoryFilterShares.status,
      createdAt: savedVerificationHistoryFilterShares.createdAt,
      respondedAt: savedVerificationHistoryFilterShares.respondedAt,
    })
    .from(savedVerificationHistoryFilterShares)
    .innerJoin(
      users,
      eq(savedVerificationHistoryFilterShares.recipientUserId, users.id)
    )
    .where(eq(savedVerificationHistoryFilterShares.ownerUserId, ownerUserId));
  return rows.map(row => ({
    ...row,
    createdAt: row.createdAt.getTime(),
    respondedAt: row.respondedAt?.getTime() ?? null,
  }));
}

export async function listReceivedVerificationHistoryFilters(
  recipientUserId: number
): Promise<SharedVerificationHistoryFilter[]> {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      shareId: savedVerificationHistoryFilterShares.id,
      id: savedVerificationHistoryFilters.id,
      name: savedVerificationHistoryFilters.name,
      query: savedVerificationHistoryFilters.query,
      startAt: savedVerificationHistoryFilters.startAt,
      endAt: savedVerificationHistoryFilters.endAt,
      sort: savedVerificationHistoryFilters.sort,
      createdAt: savedVerificationHistoryFilters.createdAt,
      updatedAt: savedVerificationHistoryFilters.updatedAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(savedVerificationHistoryFilterShares)
    .innerJoin(
      savedVerificationHistoryFilters,
      eq(
        savedVerificationHistoryFilterShares.savedFilterId,
        savedVerificationHistoryFilters.id
      )
    )
    .innerJoin(
      users,
      eq(savedVerificationHistoryFilterShares.ownerUserId, users.id)
    )
    .where(
      and(
        eq(
          savedVerificationHistoryFilterShares.recipientUserId,
          recipientUserId
        ),
        eq(savedVerificationHistoryFilterShares.status, "accepted")
      )
    )
    .orderBy(desc(savedVerificationHistoryFilterShares.createdAt));
  return rows.map(row => ({
    shareId: row.shareId,
    filter: {
      id: row.id,
      name: row.name,
      query: row.query,
      startAt: row.startAt?.getTime(),
      endAt: row.endAt?.getTime(),
      sort: row.sort,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    },
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
  }));
}

export async function listReceivedVerificationHistoryFilterInvites(
  recipientUserId: number
): Promise<ReceivedVerificationHistoryFilterInvite[]> {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      shareId: savedVerificationHistoryFilterShares.id,
      id: savedVerificationHistoryFilters.id,
      name: savedVerificationHistoryFilters.name,
      query: savedVerificationHistoryFilters.query,
      startAt: savedVerificationHistoryFilters.startAt,
      endAt: savedVerificationHistoryFilters.endAt,
      sort: savedVerificationHistoryFilters.sort,
      createdAt: savedVerificationHistoryFilters.createdAt,
      updatedAt: savedVerificationHistoryFilters.updatedAt,
      invitationCreatedAt: savedVerificationHistoryFilterShares.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(savedVerificationHistoryFilterShares)
    .innerJoin(
      savedVerificationHistoryFilters,
      eq(
        savedVerificationHistoryFilterShares.savedFilterId,
        savedVerificationHistoryFilters.id
      )
    )
    .innerJoin(
      users,
      eq(savedVerificationHistoryFilterShares.ownerUserId, users.id)
    )
    .where(
      and(
        eq(
          savedVerificationHistoryFilterShares.recipientUserId,
          recipientUserId
        ),
        eq(savedVerificationHistoryFilterShares.status, "pending")
      )
    )
    .orderBy(desc(savedVerificationHistoryFilterShares.createdAt));
  return rows.map(row => ({
    shareId: row.shareId,
    filter: {
      id: row.id,
      name: row.name,
      query: row.query,
      startAt: row.startAt?.getTime(),
      endAt: row.endAt?.getTime(),
      sort: row.sort,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    },
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    status: "pending",
    createdAt: row.invitationCreatedAt.getTime(),
  }));
}

export async function shareVerificationHistoryFilter(
  ownerUserId: number,
  filterId: number,
  recipientEmail: string
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const email = recipientEmail.trim().toLowerCase();
  const ownerFilter = await db
    .select({ id: savedVerificationHistoryFilters.id })
    .from(savedVerificationHistoryFilters)
    .where(
      and(
        eq(savedVerificationHistoryFilters.userId, ownerUserId),
        eq(savedVerificationHistoryFilters.id, filterId)
      )
    )
    .limit(1);
  if (!ownerFilter[0]) throw new Error("Saved history filter not found");
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const recipient = recipients[0];
  if (!recipient)
    throw new Error(
      "Ask this family member to sign in once before sharing a filter."
    );
  if (recipient.id === ownerUserId)
    throw new Error("Your own account already has this filter.");
  await db
    .insert(savedVerificationHistoryFilterShares)
    .values({
      savedFilterId: filterId,
      ownerUserId,
      recipientUserId: recipient.id,
      status: "pending",
    })
    .onDuplicateKeyUpdate({
      set: { status: "pending", createdAt: new Date(), respondedAt: null },
    });
  const created = await db
    .select({ id: savedVerificationHistoryFilterShares.id })
    .from(savedVerificationHistoryFilterShares)
    .where(
      and(
        eq(savedVerificationHistoryFilterShares.savedFilterId, filterId),
        eq(savedVerificationHistoryFilterShares.recipientUserId, recipient.id)
      )
    )
    .limit(1);
  if (created[0])
    await db
      .insert(familyFilterInvitationNotifications)
      .values({
        shareId: created[0].id,
        recipientUserId: recipient.id,
        status: "unread",
      })
      .onDuplicateKeyUpdate({
        set: { status: "unread", createdAt: new Date(), readAt: null },
      });
  return listVerificationHistoryFilterShares(ownerUserId);
}

export async function revokeVerificationHistoryFilterShare(
  ownerUserId: number,
  shareId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .delete(savedVerificationHistoryFilterShares)
    .where(
      and(
        eq(savedVerificationHistoryFilterShares.ownerUserId, ownerUserId),
        eq(savedVerificationHistoryFilterShares.id, shareId)
      )
    );
}

export async function respondToVerificationHistoryFilterInvite(
  recipientUserId: number,
  shareId: number,
  decision: "accepted" | "declined"
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const invite = await db
    .select({ id: savedVerificationHistoryFilterShares.id })
    .from(savedVerificationHistoryFilterShares)
    .where(
      and(
        eq(savedVerificationHistoryFilterShares.id, shareId),
        eq(
          savedVerificationHistoryFilterShares.recipientUserId,
          recipientUserId
        ),
        eq(savedVerificationHistoryFilterShares.status, "pending")
      )
    )
    .limit(1);
  if (!invite[0]) throw new Error("Family filter invitation not found");
  await db
    .update(savedVerificationHistoryFilterShares)
    .set({ status: decision, respondedAt: new Date() })
    .where(eq(savedVerificationHistoryFilterShares.id, shareId));
  await db
    .update(familyFilterInvitationNotifications)
    .set({ status: "read", readAt: new Date() })
    .where(
      and(
        eq(familyFilterInvitationNotifications.shareId, shareId),
        eq(
          familyFilterInvitationNotifications.recipientUserId,
          recipientUserId
        ),
        eq(familyFilterInvitationNotifications.status, "unread")
      )
    );
  return { shareId, status: decision };
}

export async function listFamilyFilterInvitationNotifications(
  recipientUserId: number
): Promise<FamilyFilterInvitationNotification[]> {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      id: familyFilterInvitationNotifications.id,
      shareId: savedVerificationHistoryFilterShares.id,
      filterId: savedVerificationHistoryFilters.id,
      name: savedVerificationHistoryFilters.name,
      query: savedVerificationHistoryFilters.query,
      startAt: savedVerificationHistoryFilters.startAt,
      endAt: savedVerificationHistoryFilters.endAt,
      sort: savedVerificationHistoryFilters.sort,
      filterCreatedAt: savedVerificationHistoryFilters.createdAt,
      filterUpdatedAt: savedVerificationHistoryFilters.updatedAt,
      inviteCreatedAt: savedVerificationHistoryFilterShares.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(familyFilterInvitationNotifications)
    .innerJoin(
      savedVerificationHistoryFilterShares,
      eq(
        familyFilterInvitationNotifications.shareId,
        savedVerificationHistoryFilterShares.id
      )
    )
    .innerJoin(
      savedVerificationHistoryFilters,
      eq(
        savedVerificationHistoryFilterShares.savedFilterId,
        savedVerificationHistoryFilters.id
      )
    )
    .innerJoin(
      users,
      eq(savedVerificationHistoryFilterShares.ownerUserId, users.id)
    )
    .where(
      and(
        eq(
          familyFilterInvitationNotifications.recipientUserId,
          recipientUserId
        ),
        eq(familyFilterInvitationNotifications.status, "unread"),
        eq(savedVerificationHistoryFilterShares.status, "pending")
      )
    )
    .orderBy(desc(familyFilterInvitationNotifications.createdAt));
  return rows.map(row => ({
    id: row.id,
    invitation: {
      shareId: row.shareId,
      filter: {
        id: row.filterId,
        name: row.name,
        query: row.query,
        startAt: row.startAt?.getTime(),
        endAt: row.endAt?.getTime(),
        sort: row.sort,
        createdAt: row.filterCreatedAt.getTime(),
        updatedAt: row.filterUpdatedAt.getTime(),
      },
      ownerName: row.ownerName,
      ownerEmail: row.ownerEmail,
      status: "pending",
      createdAt: row.inviteCreatedAt.getTime(),
    },
  }));
}

export async function markFamilyFilterInvitationNotificationRead(
  recipientUserId: number,
  notificationId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const owned = await db
    .select({ id: familyFilterInvitationNotifications.id })
    .from(familyFilterInvitationNotifications)
    .where(
      and(
        eq(familyFilterInvitationNotifications.id, notificationId),
        eq(familyFilterInvitationNotifications.recipientUserId, recipientUserId)
      )
    )
    .limit(1);
  if (!owned[0]) throw new Error("Family invitation notification not found");
  await db
    .update(familyFilterInvitationNotifications)
    .set({ status: "read", readAt: new Date() })
    .where(eq(familyFilterInvitationNotifications.id, notificationId));
}

export async function runBatchDocumentOcr(
  userId: number,
  documentIds: number[]
) {
  const outcomes: { documentId: number; ok: boolean; message?: string }[] = [];
  for (const documentId of documentIds) {
    try {
      await runApplicationDocumentOcr(userId, documentId);
      outcomes.push({ documentId, ok: true });
    } catch (error) {
      outcomes.push({
        documentId,
        ok: false,
        message:
          error instanceof Error ? error.message : "OCR processing failed",
      });
    }
  }
  return outcomes;
}

export async function approveBatchDocumentOcr(
  userId: number,
  documentIds: number[]
) {
  const outcomes: { documentId: number; ok: boolean; message?: string }[] = [];
  for (const documentId of documentIds) {
    try {
      await approveApplicationDocumentOcr(userId, documentId);
      outcomes.push({ documentId, ok: true });
    } catch (error) {
      outcomes.push({
        documentId,
        ok: false,
        message: error instanceof Error ? error.message : "Approval failed",
      });
    }
  }
  return outcomes;
}

export async function getOcrPolicy() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(ocrPolicySettings)
    .where(eq(ocrPolicySettings.id, "default"))
    .limit(1);
  if (rows[0]) return rows[0];
  await db
    .insert(ocrPolicySettings)
    .values({ id: "default", minimumConfidence: "medium" });
  const created = await db
    .select()
    .from(ocrPolicySettings)
    .where(eq(ocrPolicySettings.id, "default"))
    .limit(1);
  return created[0]!;
}

export async function updateOcrPolicy(
  userId: number,
  minimumConfidence: OcrConfidence
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .insert(ocrPolicySettings)
    .values({ id: "default", minimumConfidence, updatedByUserId: userId })
    .onDuplicateKeyUpdate({
      set: {
        minimumConfidence,
        updatedByUserId: userId,
        updatedAt: new Date(),
      },
    });
  return getOcrPolicy();
}

export async function listDocumentExpiryNotifications(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      notification: documentExpiryNotifications,
      document: applicationDocuments,
      application: trackedApplications,
    })
    .from(documentExpiryNotifications)
    .innerJoin(
      applicationDocuments,
      eq(
        documentExpiryNotifications.applicationDocumentId,
        applicationDocuments.id
      )
    )
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(trackedApplications.userId, userId),
        eq(documentExpiryNotifications.status, "unread")
      )
    );
  return rows.map(({ notification, document, application }) => ({
    id: notification.id,
    kind: notification.kind,
    documentName: document.documentName,
    fileName: document.fileName,
    expiresAt: document.expiresAt?.getTime() ?? null,
    trackedApplicationId: application.id,
    schemeId: application.schemeId,
    createdAt: notification.createdAt.getTime(),
  }));
}

export async function markDocumentExpiryNotificationRead(
  userId: number,
  notificationId: number
) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select({
      notification: documentExpiryNotifications,
      application: trackedApplications,
    })
    .from(documentExpiryNotifications)
    .innerJoin(
      applicationDocuments,
      eq(
        documentExpiryNotifications.applicationDocumentId,
        applicationDocuments.id
      )
    )
    .innerJoin(
      trackedApplications,
      eq(applicationDocuments.trackedApplicationId, trackedApplications.id)
    )
    .where(
      and(
        eq(documentExpiryNotifications.id, notificationId),
        eq(trackedApplications.userId, userId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Document notification not found");
  await db
    .update(documentExpiryNotifications)
    .set({ status: "read", readAt: new Date() })
    .where(eq(documentExpiryNotifications.id, notificationId));
}

/** Idempotent daily scan used only by the production Heartbeat callback after the project is deployed. */
export async function scanDocumentExpiryNotifications(now = Date.now()) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const documents = await db.select().from(applicationDocuments);
  let created = 0;
  for (const document of documents) {
    const kind = expiryNoticeKind(
      getDocumentExpiryState(document.expiresAt?.getTime() ?? null, now)
    );
    if (!kind) continue;
    const existing = await db
      .select({ id: documentExpiryNotifications.id })
      .from(documentExpiryNotifications)
      .where(
        and(
          eq(documentExpiryNotifications.applicationDocumentId, document.id),
          eq(documentExpiryNotifications.kind, kind)
        )
      )
      .limit(1);
    if (existing[0]) continue;
    await db
      .insert(documentExpiryNotifications)
      .values({ applicationDocumentId: document.id, kind, status: "unread" });
    created += 1;
  }
  return { scanned: documents.length, created };
}

export async function getDocumentReminderSettingByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReminderSettings)
    .where(eq(documentReminderSettings.scheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0] ?? null;
}

export async function markDocumentReminderScanRun(settingId: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .update(documentReminderSettings)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(documentReminderSettings.id, settingId));
}

export async function getDocumentReminderSetting() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db
    .select()
    .from(documentReminderSettings)
    .where(eq(documentReminderSettings.id, "daily-document-expiry"))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveDocumentReminderTask(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db
    .insert(documentReminderSettings)
    .values({ id: "daily-document-expiry", scheduleCronTaskUid: taskUid })
    .onDuplicateKeyUpdate({
      set: { scheduleCronTaskUid: taskUid, updatedAt: new Date() },
    });
  return getDocumentReminderSetting();
}

export async function updateSchemeAdmin(
  schemeId: string,
  patch: {
    name?: string;
    nameHindi?: string;
    administeringBody?: string;
    benefits?: string;
    benefitsHindi?: string;
    portalUrl?: string;
    applicationDeadline?: number | null;
    deadlineLabel?: string | null;
    reviewed?: string;
  }
) {
  const db = await ensureSchemeCatalog();
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) updateSet.name = patch.name;
  if (patch.nameHindi !== undefined) updateSet.nameHindi = patch.nameHindi;
  if (patch.administeringBody !== undefined)
    updateSet.administeringBody = patch.administeringBody;
  if (patch.benefits !== undefined) updateSet.benefits = patch.benefits;
  if (patch.benefitsHindi !== undefined)
    updateSet.benefitsHindi = patch.benefitsHindi;
  if (patch.portalUrl !== undefined) updateSet.portalUrl = patch.portalUrl;
  if (patch.applicationDeadline !== undefined)
    updateSet.applicationDeadline = patch.applicationDeadline
      ? new Date(patch.applicationDeadline)
      : null;
  if (patch.deadlineLabel !== undefined)
    updateSet.deadlineLabel = patch.deadlineLabel || null;
  if (patch.reviewed !== undefined) updateSet.reviewed = patch.reviewed;
  await db
    .update(schemeCatalog)
    .set(updateSet)
    .where(eq(schemeCatalog.id, schemeId));
  return getSchemeById(schemeId);
}
