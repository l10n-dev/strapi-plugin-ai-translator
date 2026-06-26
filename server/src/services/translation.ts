import { L10nTranslationService, URLS } from "ai-l10n-core";

export interface TranslateEntryResult {
  status: "success" | "error";
  reason?: "insufficientBalance" | "unauthorized" | "unknown";
  message?: string;
  translations?: Record<string, string>;
  data?: Record<string, any>;
  charsUsed?: number;
  remainingBalance?: number;
}

export interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  status: "idle" | "running" | "completed" | "stopped";
  stopReason?: "insufficientBalance" | "unauthorized";
  errors: Array<{ documentId: string; error: string }>;
  remainingBalance?: number;
}

const createStrapiLogger = (strapi: any) => {
  return {
    logger: {
      logInfo(message: string) {
        strapi.log.info(`[ai-translator] ${message}`);
      },
      logWarning(message: string) {
        strapi.log.warn(`[ai-translator] ${message}`);
      },
      logError(message: string) {
        strapi.log.error(`[ai-translator] ${message}`);
      },
      showAndLogError(
        message: string,
        error?: unknown,
        context?: string,
        _actionLabel?: string,
        _actionUrl?: string,
      ) {
        if (context) {
          strapi.log.error(`[ai-translator] ${context}: ${message}`);
        } else {
          strapi.log.error(`[ai-translator] ${message}`);
        }
        if (error) {
          strapi.log.error(error);
        }
      },
    },
  };
};

let bulkProgress: BulkProgress = {
  total: 0,
  completed: 0,
  failed: 0,
  status: "idle",
  errors: [],
};

let abortBulk = false;

/**
 * Deep-merge `data` (translated fields) into `entry` (existing document).
 * Only keys present in `data` are visited; all other entry properties are
 * preserved untouched.  This ensures non-translated component fields (e.g.
 * `metaDescription` when only `metaTitle` was translated) survive the update.
 *
 * Merge rules:
 *  - primitive / null in data  → use data value
 *  - array in data             → merge element-by-element with entry array
 *  - plain object in data      → spread entry object, recursively apply data keys
 */
function deepMergeTranslated(entryValue: any, dataValue: any): any {
  if (dataValue === null || typeof dataValue !== "object") return dataValue;

  if (Array.isArray(dataValue)) {
    const entryArray = Array.isArray(entryValue) ? entryValue : [];
    return dataValue.map((item: any, i: number) =>
      deepMergeTranslated(entryArray[i], item),
    );
  }

  // Plain object
  if (
    entryValue &&
    typeof entryValue === "object" &&
    !Array.isArray(entryValue)
  ) {
    const result: Record<string, any> = { ...entryValue };
    for (const [key, val] of Object.entries(dataValue)) {
      result[key] = deepMergeTranslated(entryValue[key], val);
    }
    return result;
  }

  return dataValue;
}

function serializeFieldValue(value: any): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function deserializeFieldValue(value: string): any {
  if (value === undefined) return undefined;
  // Try to parse as JSON, in case it's a serialized "blocks" field or other JSON value
  try {
    return JSON.parse(value);
  } catch {
    return new String(value);
  }
}

export default ({ strapi }: { strapi: any }) => {
  return {
    getBulkProgress(): BulkProgress {
      return { ...bulkProgress };
    },

    async translateEntry(
      uid: string,
      documentId: string,
      targetLocale: string,
      options?: {
        fields?: string[];
        incremental?: boolean;
        generateGlossary?: boolean;
      },
    ): Promise<TranslateEntryResult> {
      const settingsService = strapi
        .plugin("ai-translator")
        .service("settings");
      const contentTypeService = strapi
        .plugin("ai-translator")
        .service("content-type");
      const apiKey = await settingsService.getApiKey();

      if (!apiKey) {
        return {
          status: "error",
          reason: "unauthorized",
          message: "API key not configured",
        };
      }

      const entry = await contentTypeService.getEntry(
        uid,
        documentId,
        targetLocale,
      );

      const sourceObj: Record<string, string> = {};
      const targetObj: Record<string, string> = {};
      const fieldsToTranslate = options?.fields || Object.keys(entry.fields);

      for (const fieldName of fieldsToTranslate) {
        const fieldData = entry.fields[fieldName];
        if (!fieldData) {
          continue;
        }
        if (fieldData.source) {
          sourceObj[fieldName] = deserializeFieldValue(fieldData.source);
        }
        if (fieldData.target) {
          targetObj[fieldName] = deserializeFieldValue(fieldData.target);
        }
      }

      if (Object.keys(sourceObj).length === 0) {
        return { status: "success", translations: {}, charsUsed: 0 };
      }

      const { logger } = createStrapiLogger(strapi);
      const l10nService = new L10nTranslationService(logger);

      try {
        const response = await l10nService.translate(
          {
            sourceStrings: JSON.stringify(sourceObj),
            targetStrings: JSON.stringify(targetObj),
            targetLanguageCode: targetLocale,
            client: "strapi-ai-translator",
            translateOnlyNewStrings: options?.incremental || false,
            schema: null,
            format: "json",
            generateGlossary: options?.generateGlossary || false,
            scope: documentId,
          },
          apiKey,
        );

        if (!response.success && response.reason === "paymentRequired") {
          return {
            status: "error",
            reason: "insufficientBalance",
            message: `Not enough characters remaining. Purchase more at ${URLS.PRICING}`,
            remainingBalance: response?.currentBalance,
          };
        }

        if (!response.success && response.reason === "unauthorized") {
          return {
            status: "error",
            reason: "unauthorized",
            message: "Unauthorized. Please check your API Key.",
          };
        }

        if (!response.success) {
          return {
            status: "error",
            reason: "unknown",
            message: response.message || "Translation failed",
          };
        }

        const result = response.data;
        let translations: Record<string, any> = {};
        if (result.translations) {
          translations = JSON.parse(result.translations);
        }

        return {
          status: "success",
          translations: Object.fromEntries(
            Object.entries(translations).map(([key, value]) => [
              key,
              serializeFieldValue(value),
            ]),
          ),
          charsUsed: result.usage?.charsUsed,
          remainingBalance: result.remainingBalance,
        };
      } catch (error: any) {
        return {
          status: "error",
          reason: "unknown",
          message: error.message || "Translation failed",
        };
      }
    },

    async getBalance(): Promise<{ currentBalance?: number; error?: string }> {
      const settingsService = strapi
        .plugin("ai-translator")
        .service("settings");
      const apiKey = await settingsService.getApiKey();

      if (!apiKey) {
        return { error: "noApiKey" };
      }

      const { logger } = createStrapiLogger(strapi);
      const l10nService = new L10nTranslationService(logger);
      const response = await l10nService.getBalance(apiKey);

      if (!response.success) {
        return { error: response.reason || "serverError" };
      }

      return { currentBalance: response.data.currentBalance };
    },

    async saveTranslation(
      uid: string,
      documentId: string,
      targetLocale: string,
      translatedFields: Record<string, string>,
    ) {
      const contentTypeService = strapi
        .plugin("ai-translator")
        .service("content-type");

      const data = await contentTypeService.rebuildDataFromTranslated(
        uid,
        documentId,
        translatedFields,
      );

      const { syncNonLocalizedAttributes } = strapi
        .plugin("i18n")
        .service("localizations");

      const entry = await strapi
        .documents(uid)
        .findOne({
          documentId,
          populate: "*",
        })
        .catch(() => null);

      await syncNonLocalizedAttributes(entry, strapi.getModel(uid));

      // Fetch the existing target-locale entry so we can deep-merge translated
      // fields into it, preserving non-translated component properties.
      const targetEntry = await strapi
        .documents(uid)
        .findOne({
          documentId,
          locale: targetLocale,
          populate: "*",
        })
        .catch(() => null);

      // For every key in data, deep-merge with the corresponding value from the
      // target entry so that non-translated nested fields are not wiped out.
      const mergedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        mergedData[key] = deepMergeTranslated(targetEntry?.[key], value);
      }

      return strapi.documents(uid).update({
        documentId,
        locale: targetLocale,
        data: mergedData,
      });
    },

    async translateBulk(
      uids: string[],
      targetLocale: string,
      options?: { incremental?: boolean; generateGlossary?: boolean },
    ) {
      // Reset immediately before any async work to avoid race with client polling
      abortBulk = false;
      bulkProgress = {
        total: 0,
        completed: 0,
        failed: 0,
        status: "running",
        errors: [],
      };

      const contentTypeService = strapi
        .plugin("ai-translator")
        .service("content-type");
      const defaultLocale = await contentTypeService.getDefaultLocale();

      // Gather all entries to translate
      // For entries where the source was updated after the target, we must
      // retranslate all fields — Strapi exposes no per-field updatedAt, so we
      // cannot tell which specific field changed.
      const allTasks: Array<{
        uid: string;
        documentId: string;
      }> = [];
      for (const uid of uids) {
        const entries = await strapi.documents(uid).findMany({
          locale: defaultLocale,
          fields: ["documentId", "updatedAt"],
          limit: 10000,
        });

        if (options?.incremental) {
          const targetEntries = await strapi.documents(uid).findMany({
            locale: targetLocale,
            fields: ["documentId", "updatedAt"],
            limit: 10000,
          });
          const targetByDocId = new Map(
            targetEntries.map((e: any) => [e.documentId, e.updatedAt]),
          );
          for (const entry of entries) {
            const targetUpdatedAt = targetByDocId.get(entry.documentId) as
              | string
              | undefined;
            if (
              targetUpdatedAt &&
              new Date(targetUpdatedAt) >= new Date(entry.updatedAt)
            ) {
              continue; // Already translated and up-to-date
            }
            allTasks.push({
              uid,
              documentId: entry.documentId,
            });
          }
        } else {
          for (const entry of entries) {
            allTasks.push({
              uid,
              documentId: entry.documentId,
            });
          }
        }
      }

      bulkProgress.total = allTasks.length;

      if (allTasks.length === 0) {
        bulkProgress.status = "completed";
        return bulkProgress;
      }

      // Throttled parallel: 10ms stagger between request launches
      const STAGGER_MS = 10;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < allTasks.length; i++) {
        if (abortBulk) break;

        const task = allTasks[i];
        const promise = (async () => {
          if (abortBulk) return;

          const result = await this.translateEntry(
            task.uid,
            task.documentId,
            targetLocale,
            {
              incremental: options?.incremental,
              generateGlossary: options?.generateGlossary,
            },
          );

          if (result.status === "success" && result.translations) {
            if (Object.keys(result.translations).length > 0) {
              await this.saveTranslation(
                task.uid,
                task.documentId,
                targetLocale,
                result.translations,
              );
            }
            bulkProgress.completed++;
            bulkProgress.remainingBalance = result.remainingBalance;
          } else {
            bulkProgress.failed++;
            bulkProgress.errors.push({
              documentId: task.documentId,
              error: result.message || "Translation failed",
            });
            if (
              result.reason === "insufficientBalance" ||
              result.reason === "unauthorized"
            ) {
              abortBulk = true;
              bulkProgress.status = "stopped";
              bulkProgress.stopReason = result.reason;
              bulkProgress.remainingBalance = result.remainingBalance;
            }
          }
        })();

        promises.push(promise);

        // Stagger: wait 10ms before launching the next request
        if (i < allTasks.length - 1 && !abortBulk) {
          await new Promise((resolve) => setTimeout(resolve, STAGGER_MS));
        }
      }

      await Promise.allSettled(promises);

      if (bulkProgress.status !== "stopped") {
        bulkProgress.status = "completed";
      }

      return { ...bulkProgress };
    },

    cancelBulk() {
      abortBulk = true;
      if (bulkProgress.status === "running") {
        bulkProgress.status = "stopped";
      }
    },
  };
};
