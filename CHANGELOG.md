# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-06-14

### Fixed 

- #6 UID attributes' content is removed during translation
- #7 Rich text (blocks) fields are not translated and their content is removed

### Added

- **Generate & Save Glossary** option. When is enabled (config) it automatically builds a glossary from the source and translated target content, then save it as the active glossary for this source/target language pair. Once saved, the glossary is applied automatically on all future translations for the same language pair.

## [1.2.0] - 2026-04-18

### Fixed

- **Translate button in Content Manager for new locale entries** — The "Translate from {locale}" button now works when creating a new locale variant of an existing entry. Previously it silently did nothing because `form.values.documentId` is absent on an unsaved locale entry; the fix falls back to the `id` exposed by `useContentManagerContext` (sourced from the URL route param).
- **Error notifications for 401 / 402 in Content Manager button** — Unauthorized and insufficient-balance errors now show the correct localised notification instead of "Unknown Server Error". The previous code checked `result.reason` inside the `try` block, which is unreachable for non-2xx responses because Strapi's fetch client throws a `FetchError` before the caller sees the body. Error handling now lives in `catch` and branches on `err.status` (402 → insufficient balance, 401 → unauthorized).
- **Same error-handling fix in the Editor page** — `handleTranslateEntry` and `handleTranslateField` had the same dead `result.reason` checks in `onSuccess`; replaced by `err.status` branches in `onError`.
- **Strapi v5 i18n content-type detection** — Content types and their translatable fields are now correctly detected in both the legacy per-field format (`pluginOptions.i18n.localized = true` on each attribute) and the current format (top-level `pluginOptions.i18n.localized = true` on the content type, all translatable-type fields included automatically). Previously only one of the two formats was handled, causing some content types or fields to be missed depending on the Strapi version.

## [1.1.0] - 2026-04-17

### Added

- **Live Balance on Dashboard Load** — When the Dashboard opens, the plugin now calls `getBalance` from `ai-l10n-core` to retrieve the current character balance. The remaining-balance badge in `QuotaDisplay` is populated immediately without needing to run a translation first. If the API key is not configured or the request fails, the badge is hidden and only the "30,000 characters free monthly" default message is shown.

## [1.0.1] - 2026-04-15

### Changed

- **License** — Changed from Apache 2.0 to MIT.

## [1.0.0] - 2026-04-13

### Added

- **Main Dashboard** — Full-page admin view listing all i18n-enabled Content Types with translation progress per target language.
- **Language Selector** — Dropdown to pick the target locale; defaults to the last selected language (persisted).
- **Bulk Auto-translate** — Select multiple Content Types and translate all entries with one click. Throttled parallel processing (100ms stagger) with real-time progress bar and 402/abort support.
- **Side-by-Side Editor** — Split view for reviewing and editing translations: read-only source on the left, editable target on the right, per-field Translate and Revert actions.
- **Incremental Mode** — Toggle to only translate new/changed entries, preserving existing translations and saving quota.
- **Translate button in Content Manager** — A "Translate from {language}" button appears directly in the entry edit panel when you switch to a non-default locale. Translate the current entry without leaving the Content Manager.
- **Live Quota Display** — Shows "30,000 characters free monthly" and remaining balance from the l10n.dev API response.
- **Persistent Preferences** — Target locale, incremental toggle, and selected categories saved to Strapi plugin store across sessions.
- **Error Handling** — Clear UI notifications for insufficient balance (402), unauthorized (401), and API errors with links to https://l10n.dev/#pricing.
- **Plugin Settings** — API key management via the admin panel.
- **Admin-only API routes** — 10 endpoints for settings, content type introspection, translation, and progress polling, all protected by `admin::isAuthenticatedAdmin`.
- **ai-l10n-core integration** — Uses `L10nTranslationService` with custom Strapi logger for all l10n.dev API communication.
- **i18n Content Type introspection** — Auto-discovers `api::*` content types with localization enabled and their translatable fields (`string`, `text`, `richtext`, `blocks`, `email`).
