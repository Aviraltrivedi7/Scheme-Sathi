import type { Scheme } from "@/lib/schemes";

export type SchemeShareLanguage = "en" | "hi";
export type SchemeShareResult = "shared" | "copied" | "dismissed";

function label(language: SchemeShareLanguage, english: string, hindi: string) {
  return language === "hi" ? hindi : english;
}

export function createSchemeShareUrl(schemeId: string, origin = window.location.origin) {
  return new URL(`/scheme/${encodeURIComponent(schemeId)}`, origin).toString();
}

export function createSchemeShareText(scheme: Pick<Scheme, "id" | "name" | "nameHindi" | "benefits" | "benefitsHindi">, language: SchemeShareLanguage, origin = window.location.origin) {
  const name = label(language, scheme.name, scheme.nameHindi);
  const benefit = label(language, scheme.benefits, scheme.benefitsHindi).split(".").slice(0, 2).join(".");
  return `${name}\n${benefit}\n${createSchemeShareUrl(scheme.id, origin)}`;
}

export function createWhatsAppSchemeShareUrl(scheme: Pick<Scheme, "id" | "name" | "nameHindi" | "benefits" | "benefitsHindi">, language: SchemeShareLanguage, origin = window.location.origin) {
  return `https://wa.me/?text=${encodeURIComponent(createSchemeShareText(scheme, language, origin))}`;
}

export async function shareScheme(scheme: Pick<Scheme, "id" | "name" | "nameHindi" | "benefits" | "benefitsHindi">, language: SchemeShareLanguage): Promise<SchemeShareResult> {
  const url = createSchemeShareUrl(scheme.id);
  const title = label(language, scheme.name, scheme.nameHindi);
  const text = label(language, scheme.benefits, scheme.benefitsHindi).split(".").slice(0, 2).join(".");
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "dismissed";
      throw error;
    }
  }
  if (!navigator.clipboard?.writeText) throw new Error("Sharing is unavailable in this browser.");
  await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
  return "copied";
}
