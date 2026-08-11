import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, savedSchemes, schemeCatalog, userSchemeProfiles, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { schemeCatalog as seedCatalog, type SchemeCatalogItem, type SchemeProfileInput } from "@shared/schemeCatalog";

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
  };
}

/** Idempotent catalog seed. It writes only stable reviewed catalog records, never user-generated content. */
export async function ensureSchemeCatalog() {
  const db = await getDb();
  if (!db) databaseUnavailable();
  await db.insert(schemeCatalog).values(seedCatalog).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  return db;
}

export async function listSchemeCatalog(filters?: { category?: string; level?: "Central" | "State"; query?: string }) {
  const db = await ensureSchemeCatalog();
  const rows = await db.select().from(schemeCatalog);
  const query = filters?.query?.trim().toLowerCase();
  return rows.map(mapScheme).filter((scheme) => {
    const matchesCategory = !filters?.category || filters.category === "all" || scheme.category === filters.category;
    const matchesLevel = !filters?.level || scheme.level === filters.level;
    const searchable = `${scheme.name} ${scheme.nameHindi} ${scheme.benefits} ${scheme.category}`.toLowerCase();
    return matchesCategory && matchesLevel && (!query || searchable.includes(query));
  });
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
