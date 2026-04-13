# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
