import { maxCustomSchemeShareNoteLength, normalizeCustomSchemeShareNote } from "@/lib/schemeSharing";

export const customSchemeShareTemplatesStorageKey = "scheme-sathi-custom-share-templates-v1";
export type CustomSchemeShareTemplate = { id: string; name: string; note: string };

export function normalizeCustomSchemeShareTemplate(input: Pick<CustomSchemeShareTemplate, "name" | "note">): Omit<CustomSchemeShareTemplate, "id"> | null {
  const name = input.name.trim().slice(0, 40);
  const note = normalizeCustomSchemeShareNote(input.note);
  return name && note ? { name, note } : null;
}

export function readCustomSchemeShareTemplates(storage: Pick<Storage, "getItem">): CustomSchemeShareTemplate[] {
  try {
    const raw = storage.getItem(customSchemeShareTemplatesStorageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const template = item as Partial<CustomSchemeShareTemplate>;
      if (typeof template.id !== "string") return [];
      const normalized = normalizeCustomSchemeShareTemplate({ name: template.name ?? "", note: template.note ?? "" });
      return normalized ? [{ id: template.id.slice(0, 48), ...normalized }] : [];
    }).slice(0, 12);
  } catch { return []; }
}

export function writeCustomSchemeShareTemplates(storage: Pick<Storage, "setItem">, templates: CustomSchemeShareTemplate[]) {
  storage.setItem(customSchemeShareTemplatesStorageKey, JSON.stringify(templates.slice(0, 12)));
}

export { maxCustomSchemeShareNoteLength };
