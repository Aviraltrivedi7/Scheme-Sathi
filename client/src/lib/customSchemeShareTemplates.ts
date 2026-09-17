import { maxCustomSchemeShareNoteLength, normalizeCustomSchemeShareNote } from "@/lib/schemeSharing";

export const customSchemeShareTemplatesStorageKey = "scheme-sathi-custom-share-templates-v1";
export const customSchemeShareTemplateBackupFormat = "scheme-sathi-share-templates";
export const customSchemeShareTemplateDuplicateStrategies = ["rename", "skip"] as const;
export type CustomSchemeShareTemplateDuplicateStrategy = (typeof customSchemeShareTemplateDuplicateStrategies)[number];
export type CustomSchemeShareTemplate = { id: string; name: string; note: string };
export type CustomSchemeShareTemplateImportPlan = { templates: CustomSchemeShareTemplate[]; imported: CustomSchemeShareTemplate[]; renamed: Array<{ from: string; to: string }>; skipped: Array<{ name: string; reason: "duplicate" }> };
type CustomSchemeShareTemplateBackup = { format: typeof customSchemeShareTemplateBackupFormat; version: 1; exportedAt: number; templates: Array<Pick<CustomSchemeShareTemplate, "name" | "note">> };

export function normalizeCustomSchemeShareTemplate(input: Pick<CustomSchemeShareTemplate, "name" | "note">): Omit<CustomSchemeShareTemplate, "id"> | null { const name = input.name.trim().slice(0, 40); const note = normalizeCustomSchemeShareNote(input.note); return name && note ? { name, note } : null; }
export function readCustomSchemeShareTemplates(storage: Pick<Storage, "getItem">): CustomSchemeShareTemplate[] { try { const raw = storage.getItem(customSchemeShareTemplatesStorageKey); if (!raw) return []; const parsed: unknown = JSON.parse(raw); if (!Array.isArray(parsed)) return []; return parsed.flatMap(item => { if (!item || typeof item !== "object") return []; const template = item as Partial<CustomSchemeShareTemplate>; if (typeof template.id !== "string") return []; const normalized = normalizeCustomSchemeShareTemplate({ name: template.name ?? "", note: template.note ?? "" }); return normalized ? [{ id: template.id.slice(0, 48), ...normalized }] : []; }).slice(0, 12); } catch { return []; } }
export function writeCustomSchemeShareTemplates(storage: Pick<Storage, "setItem">, templates: CustomSchemeShareTemplate[]) { storage.setItem(customSchemeShareTemplatesStorageKey, JSON.stringify(templates.slice(0, 12))); }
export function createCustomSchemeShareTemplateBackup(templates: CustomSchemeShareTemplate[], exportedAt = Date.now()): CustomSchemeShareTemplateBackup { return { format: customSchemeShareTemplateBackupFormat, version: 1, exportedAt, templates: templates.map(({ name, note }) => ({ name, note })).slice(0, 12) }; }

export function planCustomSchemeShareTemplateImport(raw: string, existingTemplates: CustomSchemeShareTemplate[], strategy: CustomSchemeShareTemplateDuplicateStrategy = "rename"): CustomSchemeShareTemplateImportPlan {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("Backup format is invalid.");
  const backup = parsed as Partial<CustomSchemeShareTemplateBackup>;
  if (backup.format !== customSchemeShareTemplateBackupFormat || backup.version !== 1 || !Array.isArray(backup.templates) || backup.templates.length > 12 || !customSchemeShareTemplateDuplicateStrategies.includes(strategy)) throw new Error("Backup version or template list is invalid.");
  const names = new Set(existingTemplates.map(template => template.name.toLocaleLowerCase()));
  const imported: CustomSchemeShareTemplate[] = [];
  const renamed: CustomSchemeShareTemplateImportPlan["renamed"] = [];
  const skipped: CustomSchemeShareTemplateImportPlan["skipped"] = [];
  backup.templates.forEach((item, index) => {
    const normalized = normalizeCustomSchemeShareTemplate({ name: item?.name ?? "", note: item?.note ?? "" });
    if (!normalized) throw new Error("A backup template is invalid.");
    const originalName = normalized.name;
    let name = originalName;
    if (names.has(name.toLocaleLowerCase())) {
      if (strategy === "skip") { skipped.push({ name: originalName, reason: "duplicate" }); return; }
      let suffix = 2;
      while (names.has(name.toLocaleLowerCase())) { name = `${originalName.slice(0, 34)} (${suffix})`; suffix += 1; }
      renamed.push({ from: originalName, to: name });
    }
    names.add(name.toLocaleLowerCase());
    imported.push({ id: `imported-${index}-${crypto.randomUUID()}`, name, note: normalized.note });
  });
  if (existingTemplates.length + imported.length > 12) throw new Error("Template capacity would be exceeded.");
  return { templates: [...existingTemplates, ...imported], imported, renamed, skipped };
}

export function parseCustomSchemeShareTemplateBackup(raw: string, existingTemplates: CustomSchemeShareTemplate[], strategy: CustomSchemeShareTemplateDuplicateStrategy = "rename"): CustomSchemeShareTemplate[] { return planCustomSchemeShareTemplateImport(raw, existingTemplates, strategy).templates; }
export { maxCustomSchemeShareNoteLength };
