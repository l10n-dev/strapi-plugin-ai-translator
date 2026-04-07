import { L10nTranslationService, FinishReason } from 'ai-l10n-core';

export interface TranslateEntryResult {
  status: 'success' | 'error';
  reason?: 'insufficientBalance' | 'unauthorized' | 'unknown';
  message?: string;
  translations?: Record<string, string>;
  charsUsed?: number;
  remainingBalance?: number;
}

export interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  status: 'idle' | 'running' | 'completed' | 'halted';
  errors: Array<{ documentId: string; error: string }>;
  remainingBalance?: number;
}

const StrapiLogger = (strapi: any) => ({
  logInfo(message: string) {
    strapi.log.info(`[ai-translator] ${message}`);
  },
  logWarning(message: string, error?: unknown) {
    strapi.log.warn(`[ai-translator] ${message}`, error);
  },
  logError(message: string, error?: unknown) {
    strapi.log.error(`[ai-translator] ${message}`, error);
  },
  showAndLogError(message: string, error?: unknown) {
    strapi.log.error(`[ai-translator] ${message}`, error);
  },
});

let bulkProgress: BulkProgress = {
  total: 0,
  completed: 0,
  failed: 0,
  status: 'idle',
  errors: [],
};

let abortBulk = false;

export default ({ strapi }: { strapi: any }) => {
  const l10nService = new L10nTranslationService(StrapiLogger(strapi));

  return {
    getBulkProgress(): BulkProgress {
      return { ...bulkProgress };
    },

    async translateEntry(
      uid: string,
      documentId: string,
      targetLocale: string,
      options?: { incremental?: boolean; fields?: string[] }
    ): Promise<TranslateEntryResult> {
      const settingsService = strapi.plugin('ai-translator').service('settings');
      const contentTypeService = strapi.plugin('ai-translator').service('content-type');
      const apiKey = await settingsService.getApiKey();

      if (!apiKey) {
        return { status: 'error', reason: 'unauthorized', message: 'API key not configured' };
      }

      const entry = await contentTypeService.getEntry(uid, documentId, targetLocale);

      const sourceObj: Record<string, string> = {};
      const targetObj: Record<string, string> = {};
      const fieldsToTranslate = options?.fields || Object.keys(entry.fields);

      for (const fieldName of fieldsToTranslate) {
        const fieldData = entry.fields[fieldName];
        if (!fieldData) continue;
        const srcVal = fieldData.source;
        if (srcVal !== null && srcVal !== undefined && srcVal !== '') {
          sourceObj[fieldName] = String(srcVal);
        }
        if (options?.incremental && fieldData.target) {
          targetObj[fieldName] = String(fieldData.target);
        }
      }

      if (Object.keys(sourceObj).length === 0) {
        return { status: 'success', translations: {}, charsUsed: 0 };
      }

      try {
        const result = await l10nService.translate(
          {
            sourceStrings: JSON.stringify(sourceObj),
            targetLanguageCode: targetLocale,
            returnTranslationsAsString: true,
            client: 'strapi-plugin-ai-translator',
            translateOnlyNewStrings: options?.incremental || false,
            targetStrings: Object.keys(targetObj).length > 0 ? JSON.stringify(targetObj) : undefined,
            schema: null,
          },
          apiKey
        );

        if (!result) {
          return {
            status: 'error',
            reason: 'unauthorized',
            message: 'Invalid API key or insufficient balance',
          };
        }

        if (result.finishReason === FinishReason.insufficientBalance) {
          return {
            status: 'error',
            reason: 'insufficientBalance',
            message: 'Not enough characters remaining. Purchase more at https://l10n.dev/#pricing',
            remainingBalance: result.remainingBalance,
          };
        }

        let translations: Record<string, string> = {};
        if (result.translations) {
          translations = typeof result.translations === 'string'
            ? JSON.parse(result.translations)
            : result.translations;
        }

        return {
          status: 'success',
          translations,
          charsUsed: result.usage?.charsUsed,
          remainingBalance: result.remainingBalance,
        };
      } catch (error: any) {
        return {
          status: 'error',
          reason: 'unknown',
          message: error.message || 'Translation failed',
        };
      }
    },

    async saveTranslation(
      uid: string,
      documentId: string,
      targetLocale: string,
      translatedFields: Record<string, string>
    ) {
      const existing = await strapi.documents(uid).findOne({
        documentId,
        locale: targetLocale,
        fields: ['documentId'],
      }).catch(() => null);

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
      options?: { incremental?: boolean }
    ) {
      const contentTypeService = strapi.plugin('ai-translator').service('content-type');
      const defaultLocale = await contentTypeService.getDefaultLocale();

      abortBulk = false;

      // Gather all entries to translate
      const allTasks: Array<{ uid: string; documentId: string }> = [];
      for (const uid of uids) {
        const entries = await strapi.documents(uid).findMany({
          locale: defaultLocale,
          fields: ['documentId'],
          limit: 10000,
        });
        for (const entry of entries) {
          allTasks.push({ uid, documentId: entry.documentId });
        }
      }

      bulkProgress = {
        total: allTasks.length,
        completed: 0,
        failed: 0,
        status: 'running',
        errors: [],
      };

      if (allTasks.length === 0) {
        bulkProgress.status = 'completed';
        return bulkProgress;
      }

      // Throttled parallel: 100ms stagger between request launches
      const STAGGER_MS = 100;
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
            { incremental: options?.incremental }
          );

          if (result.status === 'success' && result.translations) {
            if (Object.keys(result.translations).length > 0) {
              await this.saveTranslation(
                task.uid,
                task.documentId,
                targetLocale,
                result.translations
              );
            }
            bulkProgress.completed++;
            bulkProgress.remainingBalance = result.remainingBalance;
          } else {
            bulkProgress.failed++;
            bulkProgress.errors.push({
              documentId: task.documentId,
              error: result.message || 'Translation failed',
            });
            if (result.reason === 'insufficientBalance') {
              abortBulk = true;
              bulkProgress.status = 'halted';
              bulkProgress.remainingBalance = result.remainingBalance;
            }
          }
        })();

        promises.push(promise);

        // Stagger: wait 100ms before launching the next request
        if (i < allTasks.length - 1 && !abortBulk) {
          await new Promise((resolve) => setTimeout(resolve, STAGGER_MS));
        }
      }

      await Promise.allSettled(promises);

      if (bulkProgress.status !== 'halted') {
        bulkProgress.status = 'completed';
      }

      return { ...bulkProgress };
    },

    cancelBulk() {
      abortBulk = true;
      if (bulkProgress.status === 'running') {
        bulkProgress.status = 'halted';
      }
    },
  };
};
