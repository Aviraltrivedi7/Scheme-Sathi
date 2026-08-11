import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { applicationReminders, InsertUser, savedSchemes, schemeCatalog, trackedApplications, userSchemeProfiles, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { schemeCatalog as seedCatalog, type SchemeCatalogItem, type SchemeProfileInput } from "@shared/schemeCatalog";
import type { ApplicationStatus } from "@shared/applicationTracker";

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
  const applications = await db.select().from(trackedApplications).where(eq(trackedApplications.userId, userId));
  return Promise.all(applications.map(async (application) => {
    const scheme = await getSchemeById(application.schemeId);
    const reminders = await db.select().from(applicationReminders).where(eq(applicationReminders.trackedApplicationId, application.id));
    return {
      id: application.id, schemeId: application.schemeId, status: application.status, applicationReference: application.applicationReference ?? null,
      applicationDeadline: application.applicationDeadline?.getTime() ?? scheme?.applicationDeadline ?? null,
      deadlineLabel: application.deadlineLabel ?? scheme?.deadlineLabel ?? null, notes: application.notes ?? null,
      createdAt: application.createdAt.getTime(), updatedAt: application.updatedAt.getTime(), scheme: scheme ?? null,
      reminders: reminders.map(mapReminder).sort((a, b) => a.remindAt - b.remindAt),
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
