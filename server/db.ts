import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { applicationDocuments, applicationReminders, documentActivityEvents, documentExpiryNotifications, documentReminderSettings, InsertUser, ocrPolicySettings, savedSchemes, savedVerificationHistoryFilters, schemeCatalog, trackedApplications, userSchemeProfiles, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { schemeCatalog as seedCatalog, type SchemeCatalogItem, type SchemeProfileInput } from "@shared/schemeCatalog";
import type { ApplicationStatus } from "@shared/applicationTracker";
import { safeStorageFileName, validateDocumentUpload } from "./documentUpload";
import { storageGetSignedUrl, storagePut } from "./storage";
import { expiryNoticeKind, getDocumentExpiryState } from "./documentExpiry";
import { extractDocumentDetails } from "./documentOcr";
import { needsManualOcrReview, type OcrConfidence } from "@shared/ocrPolicy";
import { buildDocumentActivityInsert, buildOcrApprovalUpdate, toDocumentTimeline, type DocumentActivityKind } from "./documentActivity";
import { createVerificationHistoryPdf, filterVerificationHistory, type VerificationHistoryEvent } from "./verificationHistoryPdf";
import type { SavedVerificationHistoryFilter, VerificationHistoryFilterPresetInput } from "@shared/verificationHistoryFilters";

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
      values.role = 'admin';
      updateSet.role = 'admin';
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

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function databaseUnavailable(): never { throw new Error("Database is not available. Please retry in a moment."); }

function mapScheme(row: typeof schemeCatalog.$inferSelect): SchemeCatalogItem {
  return {
    id: row.id, name: row.name, nameHindi: row.nameHindi, category: row.category, categoryHindi: row.categoryHindi,
    level: row.level, administeringBody: row.administeringBody, benefits: row.benefits, benefitsHindi: row.benefitsHindi,
    eligibility: row.eligibility, documents: row.documents, documentsHindi: row.documentsHindi, steps: row.steps,
    stepsHindi: row.stepsHindi, portalUrl: row.portalUrl, reviewed: row.reviewed, accent: row.accent, artwork: row.artwork,
    applicationDeadline: row.applicationDeadline?.getTime() ?? null, deadlineLabel: row.deadlineLabel ?? null,
  };
}

/** Idempotent catalog seed. It writes only stable reviewed catalog records, never user-generated content. */
export async function ensureSchemeCatalog() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const catalogSeedValues = seedCatalog.map(({ applicationDeadline, deadlineLabel, ...scheme }) => ({
    ...scheme,
    applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
    deadlineLabel: deadlineLabel ?? null,
  }));
  await db.insert(schemeCatalog).values(catalogSeedValues).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  // NSP publishes a current application deadline; other catalog entries intentionally remain open-ended until an official deadline is confirmed.
  await db.update(schemeCatalog).set({ applicationDeadline: new Date(Date.UTC(2026, 9, 31, 18, 29, 59)), deadlineLabel: "Student applications close 31 Oct 2026" }).where(eq(schemeCatalog.id, "nsp"));
  return db;
}

export async function listSchemeCatalog(filters?: { category?: string; level?: "Central" | "State"; state?: string; deadline?: "announced" | "closingSoon" | "openEnded"; sort?: "name" | "category" | "deadline" | "reviewed"; query?: string }) {
  const db = await ensureSchemeCatalog();
  const rows = await db.select().from(schemeCatalog);
  const query = filters?.query?.trim().toLowerCase();
  const today = Date.now();
  const closingSoon = today + 90 * 24 * 60 * 60 * 1000;
  const filtered = rows.map(mapScheme).filter((scheme) => {
    const matchesCategory = !filters?.category || filters.category === "all" || scheme.category === filters.category;
    const matchesLevel = !filters?.level || scheme.level === filters.level;
    const stateRule = scheme.eligibility.states;
    const matchesState = !filters?.state || filters.state === "all" || stateRule === undefined || stateRule === "all" || stateRule.includes(filters.state);
    const matchesDeadline = !filters?.deadline || (filters.deadline === "announced" && !!scheme.applicationDeadline) || (filters.deadline === "openEnded" && !scheme.applicationDeadline) || (filters.deadline === "closingSoon" && !!scheme.applicationDeadline && scheme.applicationDeadline >= today && scheme.applicationDeadline <= closingSoon);
    const searchable = `${scheme.name} ${scheme.nameHindi} ${scheme.benefits} ${scheme.category}`.toLowerCase();
    return matchesCategory && matchesLevel && matchesState && matchesDeadline && (!query || searchable.includes(query));
  });
  if (filters?.sort === "name") return filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.sort === "category") return filtered.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  if (filters?.sort === "deadline") return filtered.sort((a, b) => (a.applicationDeadline ?? Number.MAX_SAFE_INTEGER) - (b.applicationDeadline ?? Number.MAX_SAFE_INTEGER));
  if (filters?.sort === "reviewed") return filtered.sort((a, b) => b.reviewed.localeCompare(a.reviewed));
  return filtered;
}

export async function getSchemeById(schemeId: string) {
  const db = await ensureSchemeCatalog();
  const rows = await db.select().from(schemeCatalog).where(eq(schemeCatalog.id, schemeId)).limit(1);
  return rows[0] ? mapScheme(rows[0]) : undefined;
}

export async function getUserSchemeProfile(userId: number): Promise<SchemeProfileInput | null> {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select().from(userSchemeProfiles).where(eq(userSchemeProfiles.userId, userId)).limit(1);
  const profile = rows[0];
  if (!profile) return null;
  return { age: profile.age, state: profile.state, caste: profile.caste, annualIncome: profile.annualIncome, occupation: profile.occupation, gender: profile.gender, isStudent: profile.isStudent, isFarmer: profile.isFarmer, isDisabled: profile.isDisabled };
}

export async function saveUserSchemeProfile(userId: number, profile: SchemeProfileInput) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.insert(userSchemeProfiles).values({ userId, ...profile }).onDuplicateKeyUpdate({ set: { ...profile, updatedAt: new Date() } });
  return getUserSchemeProfile(userId);
}

export async function listSavedSchemeIds(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ schemeId: savedSchemes.schemeId }).from(savedSchemes).where(eq(savedSchemes.userId, userId));
  return rows.map((row) => row.schemeId);
}

export async function toggleSavedScheme(userId: number, schemeId: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const existing = await db.select({ id: savedSchemes.id }).from(savedSchemes).where(and(eq(savedSchemes.userId, userId), eq(savedSchemes.schemeId, schemeId))).limit(1);
  if (existing[0]) {
    await db.delete(savedSchemes).where(eq(savedSchemes.id, existing[0].id));
    return { schemeId, saved: false };
  }
  await db.insert(savedSchemes).values({ userId, schemeId });
  return { schemeId, saved: true };
}

function mapReminder(row: typeof applicationReminders.$inferSelect) {
  return { id: row.id, remindAt: row.remindAt.getTime(), status: row.status, deliveredAt: row.deliveredAt?.getTime() ?? null, scheduleCronTaskUid: row.scheduleCronTaskUid ?? null };
}

async function getTrackedApplication(userId: number, trackedApplicationId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select().from(trackedApplications).where(and(eq(trackedApplications.id, trackedApplicationId), eq(trackedApplications.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function listTrackedApplications(userId: number) {
  const db = await ensureSchemeCatalog();
  const ocrPolicy = await getOcrPolicy();
  const applications = await db.select().from(trackedApplications).where(eq(trackedApplications.userId, userId));
  return Promise.all(applications.map(async (application) => {
    const scheme = await getSchemeById(application.schemeId);
    const reminders = await db.select().from(applicationReminders).where(eq(applicationReminders.trackedApplicationId, application.id));
    const documents = await db.select().from(applicationDocuments).where(eq(applicationDocuments.trackedApplicationId, application.id));
    return {
      id: application.id, schemeId: application.schemeId, status: application.status, applicationReference: application.applicationReference ?? null,
      applicationDeadline: application.applicationDeadline?.getTime() ?? scheme?.applicationDeadline ?? null,
      deadlineLabel: application.deadlineLabel ?? scheme?.deadlineLabel ?? null, notes: application.notes ?? null,
      createdAt: application.createdAt.getTime(), updatedAt: application.updatedAt.getTime(), scheme: scheme ?? null,
      reminders: reminders.map(mapReminder).sort((a, b) => a.remindAt - b.remindAt),
      documents: await Promise.all(documents.map(async (document) => {
        const events = await db.select().from(documentActivityEvents).where(eq(documentActivityEvents.applicationDocumentId, document.id)).orderBy(desc(documentActivityEvents.createdAt));
        const needsManualReview = document.ocrStatus === "failed" || (document.ocrStatus === "complete" && document.ocrExtraction ? needsManualOcrReview(document.ocrExtraction.confidence, document.ocrExtraction.concerns, ocrPolicy.minimumConfidence) : false);
        return { id: document.id, documentName: document.documentName, storageUrl: document.storageUrl, fileName: document.fileName, mimeType: document.mimeType, expiresAt: document.expiresAt?.getTime() ?? null, expiryState: getDocumentExpiryState(document.expiresAt?.getTime() ?? null), ocrStatus: document.ocrStatus, ocrExtraction: document.ocrExtraction, ocrError: document.ocrError ?? null, ocrVerifiedAt: document.ocrVerifiedAt?.getTime() ?? null, userVerifiedAt: document.userVerifiedAt?.getTime() ?? null, needsManualReview, uploadedAt: document.uploadedAt.getTime(), activity: toDocumentTimeline(events) };
      })),
    };
  }));
}

export async function trackSchemeApplication(userId: number, schemeId: string) {
  const db = await ensureSchemeCatalog();
  const scheme = await getSchemeById(schemeId);
  if (!scheme) throw new Error("Scheme not found");
  await db.insert(trackedApplications).values({ userId, schemeId, applicationDeadline: scheme.applicationDeadline ? new Date(scheme.applicationDeadline) : null, deadlineLabel: scheme.deadlineLabel ?? null }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const tracked = await db.select().from(trackedApplications).where(and(eq(trackedApplications.userId, userId), eq(trackedApplications.schemeId, schemeId))).limit(1);
  return tracked[0];
}

export async function updateTrackedApplication(userId: number, trackedApplicationId: number, patch: { status?: ApplicationStatus; applicationReference?: string | null; applicationDeadline?: number | null; deadlineLabel?: string | null; notes?: string | null }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const existing = await getTrackedApplication(userId, trackedApplicationId);
  if (!existing) throw new Error("Tracked application not found");
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status !== undefined) updateSet.status = patch.status;
  if (patch.applicationReference !== undefined) updateSet.applicationReference = patch.applicationReference || null;
  if (patch.applicationDeadline !== undefined) updateSet.applicationDeadline = patch.applicationDeadline ? new Date(patch.applicationDeadline) : null;
  if (patch.deadlineLabel !== undefined) updateSet.deadlineLabel = patch.deadlineLabel || null;
  if (patch.notes !== undefined) updateSet.notes = patch.notes || null;
  await db.update(trackedApplications).set(updateSet).where(eq(trackedApplications.id, trackedApplicationId));
  return getTrackedApplication(userId, trackedApplicationId);
}

export async function createApplicationReminder(userId: number, trackedApplicationId: number, remindAt: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const tracked = await getTrackedApplication(userId, trackedApplicationId);
  if (!tracked) throw new Error("Tracked application not found");
  const result = await db.insert(applicationReminders).values({ trackedApplicationId, remindAt: new Date(remindAt), status: "scheduled" });
  const rows = await db.select().from(applicationReminders).where(eq(applicationReminders.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function assignReminderHeartbeat(userId: number, reminderId: number, taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ reminder: applicationReminders, application: trackedApplications }).from(applicationReminders).innerJoin(trackedApplications, eq(applicationReminders.trackedApplicationId, trackedApplications.id)).where(and(eq(applicationReminders.id, reminderId), eq(trackedApplications.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Reminder not found");
  await db.update(applicationReminders).set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() }).where(eq(applicationReminders.id, reminderId));
  return { ...mapReminder(rows[0].reminder), scheduleCronTaskUid: taskUid };
}

export async function cancelApplicationReminder(userId: number, reminderId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ reminder: applicationReminders, application: trackedApplications }).from(applicationReminders).innerJoin(trackedApplications, eq(applicationReminders.trackedApplicationId, trackedApplications.id)).where(and(eq(applicationReminders.id, reminderId), eq(trackedApplications.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Reminder not found");
  await db.update(applicationReminders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(applicationReminders.id, reminderId));
  return mapReminder(rows[0].reminder);
}

export async function getApplicationReminderByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select().from(applicationReminders).where(eq(applicationReminders.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0] ?? null;
}

export async function markApplicationReminderDelivered(reminderId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.update(applicationReminders).set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(applicationReminders.id, reminderId));
}

export async function uploadApplicationDocument(userId: number, trackedApplicationId: number, documentName: string, fileName: string, mimeType: string, base64Data: string, expiresAt?: number | null) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const tracked = await getTrackedApplication(userId, trackedApplicationId);
  if (!tracked) throw new Error("Tracked application not found");
  const scheme = await getSchemeById(tracked.schemeId);
  if (!scheme || !scheme.documents.includes(documentName)) throw new Error("Document is not part of this scheme checklist");
  const previous = await db.select({ id: applicationDocuments.id }).from(applicationDocuments).where(and(eq(applicationDocuments.trackedApplicationId, trackedApplicationId), eq(applicationDocuments.documentName, documentName))).limit(1);
  const bytes = validateDocumentUpload(fileName, mimeType, base64Data);
  const uploaded = await storagePut(`applications/${userId}/${trackedApplicationId}/${safeStorageFileName(fileName)}`, bytes, mimeType);
  await db.insert(applicationDocuments).values({ trackedApplicationId, documentName, storageKey: uploaded.key, storageUrl: uploaded.url, fileName, mimeType, expiresAt: expiresAt ? new Date(expiresAt) : null }).onDuplicateKeyUpdate({ set: { storageKey: uploaded.key, storageUrl: uploaded.url, fileName, mimeType, expiresAt: expiresAt ? new Date(expiresAt) : null, ocrStatus: "notRequested", ocrExtraction: null, ocrError: null, ocrVerifiedAt: null, updatedAt: new Date() } });
  const rows = await db.select().from(applicationDocuments).where(and(eq(applicationDocuments.trackedApplicationId, trackedApplicationId), eq(applicationDocuments.documentName, documentName))).limit(1);
  if (rows[0]) {
    await db.update(documentExpiryNotifications).set({ status: "read", readAt: new Date() }).where(eq(documentExpiryNotifications.applicationDocumentId, rows[0].id));
    await recordDocumentActivity(rows[0].id, previous[0] ? "reuploaded" : "uploaded", previous[0] ? "Fresh file uploaded; OCR verification reset." : "Document uploaded to checklist.");
  }
  return rows[0];
}

export async function removeApplicationDocument(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ document: applicationDocuments, application: trackedApplications }).from(applicationDocuments).innerJoin(trackedApplications, eq(applicationDocuments.trackedApplicationId, trackedApplications.id)).where(and(eq(applicationDocuments.id, documentId), eq(trackedApplications.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Uploaded document not found");
  await db.delete(applicationDocuments).where(eq(applicationDocuments.id, documentId));
}

async function getOwnedApplicationDocument(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ document: applicationDocuments, application: trackedApplications }).from(applicationDocuments).innerJoin(trackedApplications, eq(applicationDocuments.trackedApplicationId, trackedApplications.id)).where(and(eq(applicationDocuments.id, documentId), eq(trackedApplications.userId, userId))).limit(1);
  return rows[0] ?? null;
}

async function recordDocumentActivity(documentId: number, kind: DocumentActivityKind, detail?: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.insert(documentActivityEvents).values(buildDocumentActivityInsert(documentId, kind, detail));
}

export async function getApplicationDocumentPreview(userId: number, documentId: number) {
  const owned = await getOwnedApplicationDocument(userId, documentId);
  if (!owned) throw new Error("Uploaded document not found");
  return { documentId, fileName: owned.document.fileName, mimeType: owned.document.mimeType, url: await storageGetSignedUrl(owned.document.storageKey) };
}

export async function runApplicationDocumentOcr(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const owned = await getOwnedApplicationDocument(userId, documentId);
  if (!owned) throw new Error("Uploaded document not found");
  await db.update(applicationDocuments).set({ ocrStatus: "processing", ocrError: null, updatedAt: new Date() }).where(eq(applicationDocuments.id, documentId));
  await recordDocumentActivity(documentId, "ocrStarted", "AI extraction started.");
  try {
    const extraction = await extractDocumentDetails({ signedUrl: await storageGetSignedUrl(owned.document.storageKey), mimeType: owned.document.mimeType, checklistName: owned.document.documentName, fileName: owned.document.fileName });
    await db.update(applicationDocuments).set({ ocrStatus: "complete", ocrExtraction: extraction, ocrError: null, ocrVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(applicationDocuments.id, documentId));
    await recordDocumentActivity(documentId, "ocrCompleted", `AI extraction completed with ${extraction.confidence} confidence.`);
    return extraction;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "OCR processing could not be completed";
    await db.update(applicationDocuments).set({ ocrStatus: "failed", ocrError: message, updatedAt: new Date() }).where(eq(applicationDocuments.id, documentId));
    await recordDocumentActivity(documentId, "ocrFailed", "AI extraction failed; manual review or retry is required.");
    throw new Error("OCR processing could not be completed. Please retry or review the document manually.");
  }
}

export async function updateApplicationDocumentExpiry(userId: number, documentId: number, expiresAt: number | null) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ document: applicationDocuments, application: trackedApplications }).from(applicationDocuments).innerJoin(trackedApplications, eq(applicationDocuments.trackedApplicationId, trackedApplications.id)).where(and(eq(applicationDocuments.id, documentId), eq(trackedApplications.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Uploaded document not found");
  await db.update(applicationDocuments).set({ expiresAt: expiresAt ? new Date(expiresAt) : null, updatedAt: new Date() }).where(eq(applicationDocuments.id, documentId));
  await recordDocumentActivity(documentId, "expiryUpdated", expiresAt ? "Document expiry date updated." : "Document expiry date cleared.");
  if (expiresAt && expiresAt > Date.now()) await db.update(documentExpiryNotifications).set({ status: "read", readAt: new Date() }).where(eq(documentExpiryNotifications.applicationDocumentId, documentId));
}

export async function approveApplicationDocumentOcr(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const owned = await getOwnedApplicationDocument(userId, documentId);
  if (!owned || owned.document.ocrStatus !== "complete") throw new Error("Complete OCR extraction is required before approval");
  await db.update(applicationDocuments).set(buildOcrApprovalUpdate(new Date())).where(eq(applicationDocuments.id, documentId));
  await recordDocumentActivity(documentId, "userVerified", "User manually verified extracted details.");
}

export async function listDocumentVerificationHistory(userId: number, filters?: { startAt?: number; endAt?: number; sort?: "newest" | "oldest" }) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ event: documentActivityEvents, document: applicationDocuments, application: trackedApplications }).from(documentActivityEvents).innerJoin(applicationDocuments, eq(documentActivityEvents.applicationDocumentId, applicationDocuments.id)).innerJoin(trackedApplications, eq(applicationDocuments.trackedApplicationId, trackedApplications.id)).where(eq(trackedApplications.userId, userId));
  const schemeCache = new Map<string, string>();
  const events: VerificationHistoryEvent[] = [];
  for (const row of rows) {
    const at = row.event.createdAt.getTime();
    let schemeName = schemeCache.get(row.application.schemeId);
    if (!schemeName) { schemeName = (await getSchemeById(row.application.schemeId))?.name ?? row.application.schemeId; schemeCache.set(row.application.schemeId, schemeName); }
    events.push({ documentId: row.document.id, documentName: row.document.documentName, fileName: row.document.fileName, mimeType: row.document.mimeType, schemeName, kind: row.event.kind, detail: row.event.detail ?? null, createdAt: at });
  }
  return filterVerificationHistory(events, filters);
}

export async function exportDocumentVerificationHistoryPdf(userId: number, filters?: { startAt?: number; endAt?: number; sort?: "newest" | "oldest" }) {
  const events = (await listDocumentVerificationHistory(userId, filters)).slice(0, 200);
  return { fileName: "scheme-sathi-verification-history.pdf", base64Data: Buffer.from(await createVerificationHistoryPdf(events)).toString("base64"), eventCount: events.length };
}

function mapSavedVerificationHistoryFilter(row: typeof savedVerificationHistoryFilters.$inferSelect): SavedVerificationHistoryFilter {
  return { id: row.id, name: row.name, query: row.query, startAt: row.startAt?.getTime(), endAt: row.endAt?.getTime(), sort: row.sort, createdAt: row.createdAt.getTime(), updatedAt: row.updatedAt.getTime() };
}

export async function listSavedVerificationHistoryFilters(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select().from(savedVerificationHistoryFilters).where(eq(savedVerificationHistoryFilters.userId, userId)).orderBy(desc(savedVerificationHistoryFilters.updatedAt));
  return rows.map(mapSavedVerificationHistoryFilter);
}

export async function saveVerificationHistoryFilter(userId: number, input: VerificationHistoryFilterPresetInput) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const values = { userId, name: input.name, query: input.query, startAt: input.startAt ? new Date(input.startAt) : null, endAt: input.endAt ? new Date(input.endAt) : null, sort: input.sort };
  await db.insert(savedVerificationHistoryFilters).values(values).onDuplicateKeyUpdate({ set: { query: values.query, startAt: values.startAt, endAt: values.endAt, sort: values.sort, updatedAt: new Date() } });
  const rows = await db.select().from(savedVerificationHistoryFilters).where(and(eq(savedVerificationHistoryFilters.userId, userId), eq(savedVerificationHistoryFilters.name, input.name))).limit(1);
  return mapSavedVerificationHistoryFilter(rows[0]!);
}

export async function removeSavedVerificationHistoryFilter(userId: number, filterId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.delete(savedVerificationHistoryFilters).where(and(eq(savedVerificationHistoryFilters.userId, userId), eq(savedVerificationHistoryFilters.id, filterId)));
}

export async function runBatchDocumentOcr(userId: number, documentIds: number[]) {
  const outcomes: { documentId: number; ok: boolean; message?: string }[] = [];
  for (const documentId of documentIds) {
    try { await runApplicationDocumentOcr(userId, documentId); outcomes.push({ documentId, ok: true }); }
    catch (error) { outcomes.push({ documentId, ok: false, message: error instanceof Error ? error.message : "OCR processing failed" }); }
  }
  return outcomes;
}

export async function approveBatchDocumentOcr(userId: number, documentIds: number[]) {
  const outcomes: { documentId: number; ok: boolean; message?: string }[] = [];
  for (const documentId of documentIds) {
    try { await approveApplicationDocumentOcr(userId, documentId); outcomes.push({ documentId, ok: true }); }
    catch (error) { outcomes.push({ documentId, ok: false, message: error instanceof Error ? error.message : "Approval failed" }); }
  }
  return outcomes;
}

export async function getOcrPolicy() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select().from(ocrPolicySettings).where(eq(ocrPolicySettings.id, "default")).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(ocrPolicySettings).values({ id: "default", minimumConfidence: "medium" });
  const created = await db.select().from(ocrPolicySettings).where(eq(ocrPolicySettings.id, "default")).limit(1);
  return created[0]!;
}

export async function updateOcrPolicy(userId: number, minimumConfidence: OcrConfidence) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.insert(ocrPolicySettings).values({ id: "default", minimumConfidence, updatedByUserId: userId }).onDuplicateKeyUpdate({ set: { minimumConfidence, updatedByUserId: userId, updatedAt: new Date() } });
  return getOcrPolicy();
}

export async function listDocumentExpiryNotifications(userId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ notification: documentExpiryNotifications, document: applicationDocuments, application: trackedApplications }).from(documentExpiryNotifications).innerJoin(applicationDocuments, eq(documentExpiryNotifications.applicationDocumentId, applicationDocuments.id)).innerJoin(trackedApplications, eq(applicationDocuments.trackedApplicationId, trackedApplications.id)).where(and(eq(trackedApplications.userId, userId), eq(documentExpiryNotifications.status, "unread")));
  return rows.map(({ notification, document, application }) => ({ id: notification.id, kind: notification.kind, documentName: document.documentName, fileName: document.fileName, expiresAt: document.expiresAt?.getTime() ?? null, trackedApplicationId: application.id, schemeId: application.schemeId, createdAt: notification.createdAt.getTime() }));
}

export async function markDocumentExpiryNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select({ notification: documentExpiryNotifications, application: trackedApplications }).from(documentExpiryNotifications).innerJoin(applicationDocuments, eq(documentExpiryNotifications.applicationDocumentId, applicationDocuments.id)).innerJoin(trackedApplications, eq(applicationDocuments.trackedApplicationId, trackedApplications.id)).where(and(eq(documentExpiryNotifications.id, notificationId), eq(trackedApplications.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Document notification not found");
  await db.update(documentExpiryNotifications).set({ status: "read", readAt: new Date() }).where(eq(documentExpiryNotifications.id, notificationId));
}

/** Idempotent daily scan used only by the production Heartbeat callback after the project is deployed. */
export async function scanDocumentExpiryNotifications(now = Date.now()) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const documents = await db.select().from(applicationDocuments);
  let created = 0;
  for (const document of documents) {
    const kind = expiryNoticeKind(getDocumentExpiryState(document.expiresAt?.getTime() ?? null, now));
    if (!kind) continue;
    const existing = await db.select({ id: documentExpiryNotifications.id }).from(documentExpiryNotifications).where(and(eq(documentExpiryNotifications.applicationDocumentId, document.id), eq(documentExpiryNotifications.kind, kind))).limit(1);
    if (existing[0]) continue;
    await db.insert(documentExpiryNotifications).values({ applicationDocumentId: document.id, kind, status: "unread" });
    created += 1;
  }
  return { scanned: documents.length, created };
}

export async function getDocumentReminderSettingByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select().from(documentReminderSettings).where(eq(documentReminderSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0] ?? null;
}

export async function markDocumentReminderScanRun(settingId: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.update(documentReminderSettings).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(eq(documentReminderSettings.id, settingId));
}

export async function getDocumentReminderSetting() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  const rows = await db.select().from(documentReminderSettings).where(eq(documentReminderSettings.id, "daily-document-expiry")).limit(1);
  return rows[0] ?? null;
}

export async function saveDocumentReminderTask(taskUid: string) {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.insert(documentReminderSettings).values({ id: "daily-document-expiry", scheduleCronTaskUid: taskUid }).onDuplicateKeyUpdate({ set: { scheduleCronTaskUid: taskUid, updatedAt: new Date() } });
  return getDocumentReminderSetting();
}

export async function updateSchemeAdmin(schemeId: string, patch: { name?: string; nameHindi?: string; administeringBody?: string; benefits?: string; benefitsHindi?: string; portalUrl?: string; applicationDeadline?: number | null; deadlineLabel?: string | null; reviewed?: string }) {
  const db = await ensureSchemeCatalog();
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) updateSet.name = patch.name;
  if (patch.nameHindi !== undefined) updateSet.nameHindi = patch.nameHindi;
  if (patch.administeringBody !== undefined) updateSet.administeringBody = patch.administeringBody;
  if (patch.benefits !== undefined) updateSet.benefits = patch.benefits;
  if (patch.benefitsHindi !== undefined) updateSet.benefitsHindi = patch.benefitsHindi;
  if (patch.portalUrl !== undefined) updateSet.portalUrl = patch.portalUrl;
  if (patch.applicationDeadline !== undefined) updateSet.applicationDeadline = patch.applicationDeadline ? new Date(patch.applicationDeadline) : null;
  if (patch.deadlineLabel !== undefined) updateSet.deadlineLabel = patch.deadlineLabel || null;
  if (patch.reviewed !== undefined) updateSet.reviewed = patch.reviewed;
  await db.update(schemeCatalog).set(updateSet).where(eq(schemeCatalog.id, schemeId));
  return getSchemeById(schemeId);
}
