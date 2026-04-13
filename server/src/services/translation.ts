import { L10nTranslationService, FinishReason, URLS } from "ai-l10n-core";

export interface TranslateEntryResult {
  status: "success" | "error";
  reason?: "insufficientBalance" | "unauthorized" | "unknown";
  message?: string;
  translations?: Record<string, string>;
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
  const ctx = {
    lastErrorUrl: undefined as string | undefined,
    lastErrorMessage: undefined as string | undefined,
  };
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
        _error?: unknown,
        _prefix?: string,
        _actionLabel?: string,
        actionUrl?: string,
      ) {
        strapi.log.error(`[ai-translator] ${message}`);
        ctx.lastErrorUrl = actionUrl;
        ctx.lastErrorMessage = message;
      },
    },
    getLastError: () => ctx,
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

export default ({ strapi }: { strapi: any }) => {
  return {
    getBulkProgress(): BulkProgress {
      return { ...bulkProgress };
    },

    async translateEntry(
      uid: string,
      documentId: string,
      targetLocale: string,
      options?: { fields?: string[] },
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
      const fieldsToTranslate = options?.fields || Object.keys(entry.fields);

      for (const fieldName of fieldsToTranslate) {
        const fieldData = entry.fields[fieldName];
        if (!fieldData) {
          continue;
        }
        if (fieldData.source) {
          sourceObj[fieldName] = String(fieldData.source);
        }
      }

      if (Object.keys(sourceObj).length === 0) {
        return { status: "success", translations: {}, charsUsed: 0 };
      }

      const { logger, getLastError } = createStrapiLogger(strapi);
      const l10nService = new L10nTranslationService(logger);

      try {
        const result = await l10nService.translate(
          {
            sourceStrings: JSON.stringify(sourceObj),
            targetLanguageCode: targetLocale,
            returnTranslationsAsString: true,
            client: "strapi-ai-translator",
            translateOnlyNewStrings: false,
            schema: null,
            format: "json",
          },
          apiKey,
        );

        if (
          (!result && getLastError().lastErrorUrl === URLS.PRICING) ||
          result?.finishReason === FinishReason.insufficientBalance
        ) {
          return {
            status: "error",
            reason: "insufficientBalance",
            message: `Not enough characters remaining. Purchase more at ${URLS.PRICING}`,
            remainingBalance: result?.remainingBalance,
          };
        }

        if (!result) {
          return {
            status: "error",
            reason: "unauthorized",
            message: "Unauthorized. Please check your API Key.",
          };
        }

        let translations: Record<string, string> = {};
        if (result.translations) {
          translations =
            typeof result.translations === "string"
              ? JSON.parse(result.translations)
              : result.translations;
        }

        return {
          status: "success",
          translations,
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

    async saveTranslation(
      uid: string,
      documentId: string,
      targetLocale: string,
      translatedFields: Record<string, string>,
    ) {
      const existing = await strapi
        .documents(uid)
        .findOne({
          documentId,
          locale: targetLocale,
          fields: ["documentId"],
        })
        .catch(() => null);

      if (existing) {
        return strapi.documents(uid).update({
          documentId,
          locale: targetLocale,
          data: translatedFields,
        });
      } else {
        return strapi.documents(uid).update({
          documentId,
          locale: targetLocale,
          data: translatedFields,
        });
      }
    },

    async translateBulk(
      uids: string[],
      targetLocale: string,
      options?: { incremental?: boolean },
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
