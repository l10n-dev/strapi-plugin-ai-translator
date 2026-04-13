import { URLS } from "ai-l10n-core";

/** Locale codes supported by l10n.dev (excluding default "en"). */
const SUPPORTED_LOCALES = new Set([
  "de",
  "es",
  "fr",
  "id",
  "it",
  "ja",
  "ko",
  "pt",
  "zh-CN",
  "zh-TW",
]);

/**
 * Normalizes an arbitrary locale code to one of the 11 codes accepted by
 * l10n.dev, or returns "en" as a fallback.
 */
function normalizeLocale(locale: string): string {
  if (!locale || locale.startsWith("en")) {
    return "en";
  }

  // Exact match (case-insensitive for simple codes, case-sensitive for zh-*)
  for (const supported of SUPPORTED_LOCALES) {
    if (locale.toLowerCase() === supported.toLowerCase()) {
      return supported;
    }
  }

  // Prefix match: e.g. "pt-BR" → "pt", "de-AT" → "de"
  const lang = locale.split("-")[0].toLowerCase();
  for (const supported of SUPPORTED_LOCALES) {
    if (supported.toLowerCase() === lang) {
      return supported;
    }
  }

  return "en";
}

/**
 * Adds a locale prefix to l10n.dev URLs for non-English locales.
 * Unsupported codes fall back to English (no prefix).
 * Other domains (e.g. GitHub) are returned unchanged.
 */
export function localizeUrl(url: string, locale: string): string {
  if (!url.startsWith(URLS.BASE)) {
    return url;
  }
  const resolved = normalizeLocale(locale);
  if (resolved === "en") {
    return url;
  }
  const path = url.slice(URLS.BASE.length); // e.g. "/ws/keys" or "/#pricing"
  return `${URLS.BASE}/${resolved}${path}`;
}
