/* Catalog automation: pull external scheme lists, normalize them to reviewed-catalog shape, and diff against what we already publish. Pure functions (no DB) so they stay unit-testable. */

import { createHash } from "node:crypto";

export type SchemeSourceKind = "manual" | "datagov" | "myscheme" | "rss" | "pib";

export type SchemeSourceRecord = {
  id: string;
  name: string;
  kind: SchemeSourceKind;
  endpoint: string;
  enabled: boolean;
  autoPublish: boolean;
};

/** Normalized draft ready for review or direct catalog publish. */
export type ExternalSchemeDraft = {
  externalId: string;
  name: string;
  nameHindi: string;
  category: string;
  categoryHindi: string;
  level: "Central" | "State";
  administeringBody: string;
  benefits: string;
  benefitsHindi: string;
  eligibility: Record<string, unknown>;
  documents: string[];
  documentsHindi: string[];
  steps: string[];
  stepsHindi: string[];
  portalUrl: string;
  sourceUrl: string | null;
  applicationDeadline: number | null;
  deadlineLabel: string | null;
};

const str = (value: unknown, max: number): string => {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, max);
};

const strArray = (value: unknown, maxItems: number, maxLen: number): string[] => {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return list
    .filter((item): item is string => typeof item === "string")
    .map(item => item.replace(/[\u0000-\u001F]/g, " ").trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
};

const pick = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
  const lowered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) lowered[key.toLowerCase()] = value;
  for (const key of keys) {
    const hit = lowered[key.toLowerCase()];
    if (hit !== undefined && hit !== null && hit !== "") return hit;
  }
  return undefined;
};

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "scheme";

export function normalizeExternalScheme(
  raw: unknown,
  sourceName: string
): { ok: true; draft: ExternalSchemeDraft } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["Entry must be an object"] };
  const obj = raw as Record<string, unknown>;
  const name = str(pick(obj, "name", "title", "schemeName", "scheme_name"), 255);
  const portalUrl = str(pick(obj, "portalUrl", "url", "link", "website", "applyUrl"), 512);
  if (!name) errors.push("Missing scheme name/title");
  if (!portalUrl) errors.push("Missing portal URL");
  else if (!/^https?:\/\/.+\..+/.test(portalUrl)) errors.push("Portal URL must be an http(s) address");
  if (errors.length) return { ok: false, errors };
  const externalId = str(pick(obj, "id", "externalId", "schemeId", "code"), 191) || slug(`${sourceName}-${name}`);
  const category = str(pick(obj, "category", "sector", "department"), 96) || "Livelihood";
  const levelRaw = str(pick(obj, "level"), 16).toLowerCase();
  const benefits = str(pick(obj, "benefits", "description", "summary", "details"), 3000) || name;
  return {
    ok: true,
    draft: {
      externalId,
      name,
      nameHindi: str(pick(obj, "nameHindi", "title_hi", "name_hi"), 255) || name,
      category,
      categoryHindi: str(pick(obj, "categoryHindi", "category_hi"), 128) || category,
      level: levelRaw === "state" ? "State" : "Central",
      administeringBody: str(pick(obj, "administeringBody", "department", "ministry", "provider", "organization"), 255) || sourceName,
      benefits,
      benefitsHindi: str(pick(obj, "benefitsHindi", "description_hi", "summary_hi"), 3000) || benefits,
      eligibility: (pick(obj, "eligibility") as Record<string, unknown>) && typeof pick(obj, "eligibility") === "object" ? (pick(obj, "eligibility") as Record<string, unknown>) : {},
      documents: strArray(pick(obj, "documents", "requiredDocuments"), 12, 180),
      documentsHindi: strArray(pick(obj, "documentsHindi", "documents_hi"), 12, 180),
      steps: strArray(pick(obj, "steps", "howToApply", "applicationSteps"), 12, 500),
      stepsHindi: strArray(pick(obj, "stepsHindi", "steps_hi"), 12, 500),
      portalUrl,
      sourceUrl: str(pick(obj, "sourceUrl", "source"), 512) || null,
      applicationDeadline: null,
      deadlineLabel: str(pick(obj, "deadlineLabel", "deadline"), 255) || null,
    },
  };
}

/** Stable hash so re-syncs detect genuinely changed entries only. */
export function draftContentHash(draft: ExternalSchemeDraft): string {
  return createHash("sha256")
    .update(JSON.stringify([draft.name, draft.benefits, draft.portalUrl, draft.administeringBody, draft.category, draft.level]))
    .digest("hex")
    .slice(0, 64);
}

export function diffCatalog(
  existing: { id: string; hash: string }[],
  fetched: { externalId: string; hash: string }[]
): { added: string[]; changed: string[]; unchanged: string[] } {
  const known = new Map(existing.map(item => [item.id, item.hash]));
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const item of fetched) {
    const prior = known.get(item.externalId);
    if (prior === undefined) added.push(item.externalId);
    else if (prior === item.hash) unchanged.push(item.externalId);
    else changed.push(item.externalId);
  }
  return { added, changed, unchanged };
}

/** Fetch a JSON list with a hard timeout. Accepts a bare array or {data|records|schemes|results} wrappers. */
export async function fetchJsonList(
  endpoint: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 15000
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(endpoint, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (Array.isArray(body)) return body;
    if (body && typeof body === "object") {
      const obj = body as Record<string, unknown>;
      for (const key of ["data", "records", "schemes", "results", "items"]) {
        if (Array.isArray(obj[key])) return obj[key] as unknown[];
        // CKAN datastore_search nests under result.records
        const result = obj.result as Record<string, unknown> | undefined;
        if (result && Array.isArray(result.records)) return result.records as unknown[];
      }
    }
    throw new Error("Source did not return a JSON list");
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort CKAN/data.gov.in record → raw draft mapping (field names vary by dataset). */
export function mapDataGovRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: pick(record, "id", "_id", "scheme_code"),
    name: pick(record, "title", "scheme_name", "scheme", "name"),
    nameHindi: pick(record, "title_hi", "scheme_name_hi"),
    category: pick(record, "sector", "category", "department"),
    administeringBody: pick(record, "department", "ministry", "organisation", "organization", "agency"),
    benefits: pick(record, "description", "benefits", "details", "objective"),
    portalUrl: pick(record, "url", "website", "link", "apply_link"),
    level: pick(record, "level", "scheme_level"),
    deadlineLabel: pick(record, "deadline", "last_date", "closing_date"),
  };
}

/** Minimal RSS/Atom item extraction without extra dependencies. */
export function mapRssItems(xml: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks.slice(0, 100)) {
    const tag = (name: string): string => {
      const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
      return (match?.[1] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);
    };
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/i);
    items.push({
      id: tag("guid") || tag("id") || tag("link") || tag("title"),
      name: tag("title"),
      benefits: tag("description") || tag("summary") || tag("content"),
      portalUrl: linkMatch?.[1] ?? tag("link"),
    });
  }
  return items;
}

/** Fetch one source and return raw entries (mapping applied per kind). */
export async function fetchSourceEntries(
  source: SchemeSourceRecord,
  fetchFn: typeof fetch = fetch,
  knownIds: Set<string> = new Set()
): Promise<Record<string, unknown>[]> {
  if (source.kind === "pib") return fetchPibAnnouncements(source.endpoint, fetchFn, knownIds);
  if (source.kind === "rss") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchFn(source.endpoint, { signal: controller.signal, headers: { accept: "application/rss+xml, application/xml, text/xml" } });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      return mapRssItems(await response.text());
    } finally {
      clearTimeout(timer);
    }
  }
  const raw = await fetchJsonList(source.endpoint, fetchFn);
  if (source.kind === "datagov") return raw.map(item => (item && typeof item === "object" ? mapDataGovRecord(item as Record<string, unknown>) : {}));
  return raw.map(item => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}));
}

export const DEFAULT_SCHEME_SOURCES: SchemeSourceRecord[] = [
  {
    id: "pib-announcements",
    name: "PIB scheme announcements",
    kind: "pib",
    endpoint: "https://pib.gov.in/AllRel.aspx?reg=3&lang=1",
    enabled: true,
    autoPublish: true,
  },
  {
    id: "myscheme-directory",
    name: "myScheme national directory",
    kind: "myscheme",
    endpoint: "https://www.myscheme.gov.in/schemes",
    enabled: false,
    autoPublish: true,
  },
  {
    id: "datagov-schemes",
    name: "data.gov.in open datasets",
    kind: "datagov",
    endpoint: "https://api.data.gov.in/resource/",
    enabled: false,
    autoPublish: true,
  },
  {
    id: "nsp-directory",
    name: "National Scholarship Portal directory",
    kind: "rss",
    endpoint: "https://scholarships.gov.in/All-Scholarships",
    enabled: false,
    autoPublish: true,
  },
];

/* ---------- PIB announcement watcher (no key needed) ---------- */

/** Titles must look like scheme announcements; everything else is ignored. */
const PIB_TIER1 = /\b(yojana|yojna|abhiyan|abhiyaan|scholarship|fellowship|pension|bima|awas|aawas|subsidy|kisan nidhi|credit card|ration card)\b/i;
/** Generic words that only count beside a launch/approval verb. */
const PIB_TIER2 = /\b(scheme|mission|programme|program)\b/i;
const PIB_LAUNCH_VERB = /\b(launch|launches|launched|approv|cabinet|notif|roll ?out|guidelines)\b/i;
/** Space/defence/event releases that also say "mission"/"programme". */
const PIB_BLOCK = /\b(gaganyaan|chandrayaan|isro|drdo|missile|naval|army|defence|defense|visit|meets|remarks|speech|address|conference|webinar|workshop|award|ranks?|radar|mausam|weather|instalment|installment|mann ki baat|film festival|football|cricket)\b/i;

export function isSchemeAnnouncement(title: string): boolean {
  const clean = title.replace(/\s+/g, " ").trim();
  if (clean.length < 20 || clean.length > 300) return false;
  if (PIB_BLOCK.test(clean)) return false;
  if (PIB_TIER1.test(clean)) return true;
  return PIB_TIER2.test(clean) && PIB_LAUNCH_VERB.test(clean);
}

export function inferCategoryFromTitle(title: string): { category: string; categoryHindi: string } {
  const text = title.toLowerCase();
  if (/(scholarship|fellowship|education|school|college|student|vidyalaya|shiksha)/.test(text)) return { category: "Education", categoryHindi: "शिक्षा" };
  if (/(kisan|farmer|crop|fasal|agri|krishi|pashu|dairy|fishery|irrigation|mandi)/.test(text)) return { category: "Agriculture", categoryHindi: "कृषि" };
  if (/(health|swasthya|ayushman|hospital|medical| Rog |vaccine)/.test(text)) return { category: "Health", categoryHindi: "स्वास्थ्य" };
  if (/(mahila|women|beti|ladli|girl|widow|anganwadi)/.test(text)) return { category: "Women & Family", categoryHindi: "महिला एवं परिवार" };
  if (/(awas|housing|ghar|makaan)/.test(text)) return { category: "Housing", categoryHindi: "आवास" };
  return { category: "Livelihood", categoryHindi: "आजीविका" };
}

const PIB_BOT_HEADERS = {
  accept: "text/html",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
};

/** Boilerplate/orgarbage extraction must never reach the catalog. */
export function isQualityReleaseSummary(summary: string): boolean {
  const clean = summary.replace(/\s+/g, " ").trim();
  if (clean.length < 150) return false;
  return !/javascript must be enabled|access denied|request blocked|not supported by your browser/i.test(clean);
}

/** Honest pointer text when the release body is bot-walled: never invent details. */
export function pibPointerBenefits(title: string): string {
  return `${title}. Tracked from an official PIB announcement — open the source link to read the full release and verify current benefits, eligibility, and dates.`;
}
/** Extract (PRID, title) pairs from the PIB AllRel listing page. */
export function parsePibListing(html: string): { prid: string; title: string }[] {
  const seen = new Set<string>();
  const items: { prid: string; title: string }[] = [];
  const anchor = /<a[^>]*href=['"]\/PressReleaseDetail\.aspx\?PRID=(\d+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const prid = match[1];
    if (seen.has(prid)) continue;
    seen.add(prid);
    const titleAttr = /title=['"]([^'"]+)['"]/i.exec(match[0])?.[1];
    const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = (titleAttr ?? text).replace(/\s+/g, " ").trim();
    if (title) items.push({ prid, title });
  }
  return items;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull ministry + summary from a PIB release detail page. */
export function parsePibDetail(html: string): { ministry: string; summary: string } {
  const text = stripHtml(html);
  const ministry = /Ministry of [A-Za-z&,\-() ]+/.exec(text)?.[0].trim().slice(0, 255) ?? "";
  let summary = "";
  const posted = text.indexOf("Posted On");
  if (posted >= 0) {
    const afterDate = text.indexOf("by PIB", posted);
    const start = afterDate >= 0 ? afterDate + 6 : posted + 9;
    summary = text.slice(start, start + 1200);
    const cutAt = summary.search(/\(\s*Release ID|\*{3,}|Read this release in:/);
    if (cutAt > 100) summary = summary.slice(0, cutAt);
    summary = summary.trim().slice(0, 900);
  }
  if (!summary) summary = text.slice(0, 600);
  return { ministry, summary };
}

/**
 * Poll the PIB listing, keep only scheme-like announcements, and fetch detail
 * pages solely for unknown PRIDs (bounded so a 5-minute tick stays cheap).
 */
export async function fetchPibAnnouncements(
  listingUrl: string,
  fetchFn: typeof fetch = fetch,
  knownIds: Set<string> = new Set(),
  maxNew = 5
): Promise<Record<string, unknown>[]> {
  const origin = new URL(listingUrl).origin;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let html: string;
  try {
    const response = await fetchFn(listingUrl, { signal: controller.signal, headers: { accept: "text/html" } });
    if (!response.ok) throw new Error(`PIB listing returned HTTP ${response.status}`);
    html = await response.text();
  } finally {
    clearTimeout(timer);
  }
  const fresh = parsePibListing(html)
    .filter(item => isSchemeAnnouncement(item.title) && !knownIds.has(`pib-${item.prid}`))
    .slice(0, maxNew);
  const raw: Record<string, unknown>[] = [];
  const pushPointerDraft = (item: { prid: string; title: string }) => {
    const pageUrl = `${origin}/PressReleaseDetail.aspx?PRID=${item.prid}`;
    const category = inferCategoryFromTitle(item.title);
    raw.push({
      id: `pib-${item.prid}`,
      name: item.title,
      category: category.category,
      categoryHindi: category.categoryHindi,
      administeringBody: "Government of India",
      benefits: pibPointerBenefits(item.title),
      portalUrl: pageUrl,
      sourceUrl: pageUrl,
    });
  };
  for (const item of fresh) {
    const pageUrl = `${origin}/PressReleaseDetail.aspx?PRID=${item.prid}`;
    try {
      const detailController = new AbortController();
      const detailTimer = setTimeout(() => detailController.abort(), 15000);
      try {
        const response = await fetchFn(pageUrl, { signal: detailController.signal, headers: PIB_BOT_HEADERS });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const pageHtml = await response.text();
        // Bot-walled pages carry no release marker — fall back to the honest
        // pointer draft instead of publishing page boilerplate as benefits.
        if (!/Release ID:\s*\d+/.test(pageHtml)) throw new Error("unreadable release page");
        const detail = parsePibDetail(pageHtml);
        if (!isQualityReleaseSummary(detail.summary)) throw new Error("low-quality extraction");
        const category = inferCategoryFromTitle(item.title);
        raw.push({
          id: `pib-${item.prid}`,
          name: item.title,
          category: category.category,
          categoryHindi: category.categoryHindi,
          administeringBody: detail.ministry || "Government of India",
          benefits: detail.summary,
          portalUrl: pageUrl,
          sourceUrl: pageUrl,
        });
      } finally {
        clearTimeout(detailTimer);
      }
    } catch {
      // One unreadable release must never break the whole sweep — and must
      // never publish boilerplate. Stage the honest pointer draft instead.
      pushPointerDraft(item);
    }
  }
  return raw;
}
