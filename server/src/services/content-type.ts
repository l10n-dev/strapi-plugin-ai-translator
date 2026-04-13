export interface LocalizableField {
  name: string;
  type: string;
  required: boolean;
}

export interface ContentTypeInfo {
  uid: string;
  kind: string;
  displayName: string;
  singularName: string;
  pluralName: string;
  localizableFields: LocalizableField[];
}

export interface ContentTypeWithStats extends ContentTypeInfo {
  totalEntries: number;
  translatedEntries: number;
}

const TRANSLATABLE_FIELD_TYPES = new Set([
  "string",
  "text",
  "richtext",
  "blocks",
  "email",
]);

export default ({ strapi }: { strapi: any }) => ({
  getI18nContentTypes(): ContentTypeInfo[] {
    const result: ContentTypeInfo[] = [];

    for (const [uid, contentType] of Object.entries<any>(strapi.contentTypes)) {
      if (!uid.startsWith("api::")) continue;
      if (!contentType.attributes?.locale) continue;

      const localizableFields: LocalizableField[] = [];

      for (const [fieldName, fieldDef] of Object.entries<any>(
        contentType.attributes,
      )) {
        if (fieldName === "locale" || fieldName === "localizations") continue;

        const isLocalized = fieldDef.pluginOptions?.i18n?.localized === true;
        if (!isLocalized) continue;

        if (TRANSLATABLE_FIELD_TYPES.has(fieldDef.type)) {
          localizableFields.push({
            name: fieldName,
            type: fieldDef.type,
            required: fieldDef.required || false,
          });
        }
      }

      if (localizableFields.length === 0) continue;

      result.push({
        uid,
        kind: contentType.kind,
        displayName:
          contentType.info?.displayName ||
          contentType.info?.singularName ||
          uid,
        singularName: contentType.info?.singularName || "",
        pluralName: contentType.info?.pluralName || "",
        localizableFields,
      });
    }

    return result;
  },

  async getDefaultLocale(): Promise<string> {
    const i18nLocaleService = strapi.plugin("i18n").service("locales");
    const defaultCode = await i18nLocaleService.getDefaultLocale();
    return defaultCode || "en";
  },

  async getLocales(): Promise<
    Array<{ code: string; name: string; isDefault: boolean }>
  > {
    const i18nLocaleService = strapi.plugin("i18n").service("locales");
    const locales = await i18nLocaleService.find();
    const decorated = await i18nLocaleService.setIsDefault(locales);
    return decorated.map((l: any) => ({
      code: l.code,
      name: l.name,
      isDefault: l.isDefault || false,
    }));
  },

  async getTranslationStatus(
    uid: string,
    targetLocale: string,
  ): Promise<{ totalEntries: number; translatedEntries: number }> {
    const defaultLocale = await this.getDefaultLocale();

    const sourceEntries = await strapi.documents(uid).findMany({
      locale: defaultLocale,
      limit: 10000,
      fields: ["documentId", "updatedAt"],
    });

    const targetEntries = await strapi.documents(uid).findMany({
      locale: targetLocale,
      limit: 10000,
      fields: ["documentId", "updatedAt"],
    });

    const targetByDocId = new Map(
      targetEntries.map((e: any) => [e.documentId, e.updatedAt]),
    );

    let translatedCount = 0;
    for (const source of sourceEntries) {
      const targetUpdatedAt = targetByDocId.get(source.documentId) as
        | string
        | undefined;
      if (
        targetUpdatedAt &&
        new Date(targetUpdatedAt) >= new Date(source.updatedAt as string)
      ) {
        translatedCount++;
      }
    }

    return {
      totalEntries: sourceEntries.length,
      translatedEntries: translatedCount,
    };
  },

  async getContentTypesWithStats(
    targetLocale: string,
  ): Promise<ContentTypeWithStats[]> {
    const contentTypes = this.getI18nContentTypes();
    const results: ContentTypeWithStats[] = [];

    for (const ct of contentTypes) {
      const stats = await this.getTranslationStatus(ct.uid, targetLocale);
      results.push({ ...ct, ...stats });
    }

    return results;
  },

  async getEntries(
    uid: string,
    targetLocale: string,
    params?: { page?: number; pageSize?: number; search?: string },
  ) {
    const defaultLocale = await this.getDefaultLocale();
    const contentTypes = this.getI18nContentTypes();
    const ctInfo = contentTypes.find((ct) => ct.uid === uid);
    if (!ctInfo)
      throw new Error(`Content type ${uid} not found or not i18n-enabled`);

    const localizableFieldNames = ctInfo.localizableFields.map((f) => f.name);
    const fieldsToSelect = ["documentId", ...localizableFieldNames];

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;

    const filters: any = {};
    if (params?.search) {
      const firstStringField = ctInfo.localizableFields.find(
        (f) => f.type === "string",
      );
      if (firstStringField) {
        filters[firstStringField.name] = { $containsi: params.search };
      }
    }

    const sourceEntries = await strapi.documents(uid).findMany({
      locale: defaultLocale,
      fields: fieldsToSelect,
      filters,
      start: (page - 1) * pageSize,
      limit: pageSize,
    });

    const entries = [];
    for (const source of sourceEntries) {
      let target = null;
      try {
        target = await strapi.documents(uid).findOne({
          documentId: source.documentId,
          locale: targetLocale,
          fields: fieldsToSelect,
        });
      } catch {
        // Target locale version doesn't exist yet
      }

      const fields: Record<string, { source: string; target: string }> = {};
      for (const fieldName of localizableFieldNames) {
        fields[fieldName] = {
          source: source[fieldName] ?? "",
          target: target?.[fieldName] ?? "",
        };
      }

      entries.push({
        documentId: source.documentId,
        sourceLocale: defaultLocale,
        targetLocale,
        fields,
        hasTarget: !!target,
      });
    }

    return {
      entries,
      pagination: {
        page,
        pageSize,
        hasNextPage: sourceEntries.length === pageSize,
      },
      localizableFields: ctInfo.localizableFields,
      contentType: ctInfo,
    };
  },

  async getEntry(uid: string, documentId: string, targetLocale: string) {
    const defaultLocale = await this.getDefaultLocale();
    const contentTypes = this.getI18nContentTypes();
    const ctInfo = contentTypes.find((ct) => ct.uid === uid);
    if (!ctInfo)
      throw new Error(`Content type ${uid} not found or not i18n-enabled`);

    const localizableFieldNames = ctInfo.localizableFields.map((f) => f.name);
    const fieldsToSelect = ["documentId", ...localizableFieldNames];

    const source = await strapi.documents(uid).findOne({
      documentId,
      locale: defaultLocale,
      fields: fieldsToSelect,
    });
    if (!source) {
      throw new Error(`Entry ${documentId} not found`);
    }

    let target = null;
    try {
      target = await strapi.documents(uid).findOne({
        documentId,
        locale: targetLocale,
        fields: fieldsToSelect,
      });
    } catch {
      // Target doesn't exist yet
    }

    const fields: Record<string, { source: string; target: string }> = {};
    for (const fieldName of localizableFieldNames) {
      fields[fieldName] = {
        source: source[fieldName] ?? "",
        target: target?.[fieldName] ?? "",
      };
    }

    return {
      documentId,
      sourceLocale: defaultLocale,
      targetLocale,
      fields,
      hasTarget: !!target,
      localizableFields: ctInfo.localizableFields,
      contentType: ctInfo,
    };
  },
});
