# Strapi Plugin — AI Translator (l10n.dev)

Translate your Strapi v5 i18n content with [l10n.dev](https://l10n.dev) AI translation service — directly from the Admin Panel. Supports bulk translation, per-field translation, and a side-by-side editor for reviewing and editing results.

**30,000 characters free every month** — no credit card required.

> **Compatibility:** Strapi v5 only (v5.0.0+)

---

## Features

- **Main Dashboard** — See all your i18n-enabled Content Types at a glance with translation progress per target language.
- **Bulk Auto-translate** — Select multiple Content Types and translate them all with one click. Parallel processing with real-time progress bar.
- **Side-by-Side Editor** — Click "Edit" on any Content Type to open a split view: read-only source on the left, editable target on the right. Translate, revert, or manually edit per field.
- **Per-field Translate** — Translate individual fields without touching the rest.
- **Incremental Mode** — Only translate new/changed strings, saving your character quota.
- **Live Quota Display** — See your remaining character balance update in real time after each translation.
- **Persistent Preferences** — Selected target language, incremental toggle, and category selections are saved across sessions.

---

## Screenshots

> _Screenshots will be added here._

| Dashboard | Side-by-Side Editor |
|-----------|-------------------|
| ![Dashboard](docs/screenshots/dashboard-placeholder.png) | ![Editor](docs/screenshots/editor-placeholder.png) |

---

## Installation

### 1. Install the package

```bash
npm install strapi-plugin-ai-translator
# or
yarn add strapi-plugin-ai-translator
```

### 2. Enable the plugin

Add to your Strapi project's `config/plugins.ts` (or `config/plugins.js`):

```ts
export default {
  'ai-translator': {
    enabled: true,
  },
};
```

### 3. Rebuild and start

```bash
npm run build
npm run develop
```

---

## Configuration

### Get your API Key

1. Go to [l10n.dev/ws/keys](https://l10n.dev/ws/keys) and create a free API key.
2. Open the Strapi Admin Panel and navigate to **L10n.dev - AI Translator** in the sidebar.
3. You will see a **"Set up your API Key"** banner at the top of the page.
4. Paste your key into the **"l10n.dev API Key"** field and click **"Save Key"**.
5. The banner disappears and the plugin is ready to use.

> To update the key later, find the masked key display at the top of the dashboard and click **"Change API Key"**.

### Plugin Settings (stored in Strapi)

| Setting | Description | Default |
|---------|-------------|---------|
| `apiKey` | Your l10n.dev API key | _(empty)_ |
| `incremental` | Only translate new/changed strings | `true` |
| `lastTargetLocale` | Remembers your last selected target language | _(auto)_ |
| `selectedCategories` | Remembers which Content Types are checked for bulk translate | `[]` |

All settings are managed through the Admin Panel UI — no file-based configuration needed.

---

## Usage

### Prerequisites

- **Strapi i18n plugin** must be enabled (ships with Strapi by default).
- At least **two locales** must be configured in Settings → Internationalization.
- Content Types you want to translate must have **"Enable localization for this content-type"** turned on, with individual fields marked as localizable.

### Dashboard

1. Open **L10n.dev - AI Translator** from the sidebar.
2. Select your **target language** from the dropdown.
3. The table shows all i18n-enabled Content Types with their translation status (e.g., "17/17", "0/39").
4. Check the boxes for the Content Types you want to translate, then click **"Auto-translate"**.
5. A progress bar shows real-time translation status.

### Side-by-Side Editor

1. Click **"Edit"** (pencil icon) on any Content Type row.
2. Browse entries in the left sidebar; select one to see its fields.
3. Each field shows the source text (read-only) on the left and the editable target on the right.
4. Use **"Translate"** to AI-translate a single field, or **"Revert"** to undo changes.
5. Click **"Save"** to persist all changes back to Strapi.

### Incremental Mode

When enabled, only fields that don't have a target translation yet (or differ from the source) are sent to the API. This saves your character quota when re-translating content that has already been partially translated.

---

## API Endpoints

All endpoints are admin-authenticated (`admin::isAuthenticatedAdmin`) and prefixed with `/ai-translator`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get plugin settings (API key masked) |
| `PUT` | `/settings` | Update plugin settings |
| `GET` | `/content-types` | List i18n Content Types with translation stats |
| `GET` | `/content-types/:uid/entries` | List entries for a Content Type |
| `GET` | `/content-types/:uid/entries/:documentId` | Get single entry with source/target fields |
| `POST` | `/translate` | Translate a single field of an entry |
| `POST` | `/translate/bulk` | Start bulk translation (auto incremental translation) |
| `POST` | `/translate/save` | Save translated fields to Strapi |
| `GET` | `/translate/status` | Poll bulk translation progress |
| `POST` | `/translate/cancel` | Cancel a running bulk translation |

---

## Compatibility

| Dependency | Version |
|------------|---------|
| Strapi | `^5.0.0` |
| Node.js | `>=18.0.0` |
| `@strapi/design-system` | `^2.0.0` |
| `ai-l10n-core` | `^1.4.0` |

> This plugin is **Strapi v5 only**. It is not compatible with Strapi v4.

---

## How it works

1. The plugin introspects your Strapi content types at runtime to find those with i18n localization enabled.
2. For each localizable field (`string`, `text`, `richtext`, `blocks`, `email`), it extracts the source-language value and sends it to the [l10n.dev](https://l10n.dev) API via the [`ai-l10n-core`](https://www.npmjs.com/package/ai-l10n-core) client library.
3. Translated fields are saved as **draft** entries in Strapi via the Document Service API. You publish them using Strapi's native publish workflow.
4. The API key and preferences are stored securely in Strapi's plugin store — never exposed to the client in full.

---

## Submitting Issues

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/l10n-dev/strapi-plugin-ai-translator/issues).

---

## License

[Apache License Version 2.0](LICENSE) — see the [LICENSE](LICENSE) file for details.
