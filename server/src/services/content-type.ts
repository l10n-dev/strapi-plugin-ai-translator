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
  "json",
  "uid",
  "email",
  "number",
  "boolean",
  "integer",
  "biginteger",
  "float",
  "decimal",
]);

/**
 * Resolve a dot-notation path (e.g. "seo.metaTitle") from an object.
 */
function resolveFieldValue(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split(".").reduce((curr: any, key: string) => curr?.[key], obj);
}

/**
 * Serialize a field value to a string for the translation/editor pipeline.
 * "blocks" fields are JSON arrays and must be JSON-stringified; all other
 * translatable field types are already strings.
 */
function serializeFieldValue(value: any, type: string): string {
  if (type === "blocks" || type === "json" || type === "component") {
    if (value == null) return "[]";
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

function deserializeFieldValue(value: string): any {
  if (value === undefined) return undefined;
  // Try to parse as JSON, in case it's a serialized "blocks" field or other JSON value
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Build the Strapi Document Service `fields` and `populate` options from
 * a flat list of localizable field names (which may include dot-notation
 * paths like "seo.metaTitle" for non-repeatable component sub-fields).
 *
 * Dynamiczones use the Strapi v5 fragment-populate syntax:
 *   populate: { blocks: { on: { 'shared.rich-text': { fields: ['body'] }, ... } } }
 */
function buildQueryOptions(
  localizableFields: LocalizableField[],
  strapiInstance: any,
  contentTypeUid: string,
): {
  fields: string[];
  populate: Record<string, any>;
} {
  const directFields = new Set<string>(["documentId"]);
  const componentFields = new Map<string, Set<string>>();
  const dynamiczoneNames = new Set<string>();
  const populate: Record<string, any> = {};

  for (const field of localizableFields) {
    if (field.type === "dynamiczone") {
      dynamiczoneNames.add(field.name);
      continue;
    }
    if (field.type === "component") {
      // Repeatable component treated as a JSON blob — must go in populate, not fields
      populate[field.name] = true;
      continue;
    }
    const dot = field.name.indexOf(".");
    if (dot === -1) {
      directFields.add(field.name);
    } else {
      const parent = field.name.slice(0, dot);
      const sub = field.name.slice(dot + 1);
      if (!componentFields.has(parent)) componentFields.set(parent, new Set());
      componentFields.get(parent)!.add(sub);
    }
  }

  for (const [parent, subFields] of componentFields) {
    populate[parent] = { fields: Array.from(subFields) };
  }

  // Dynamiczone: use fragment populate (on: { componentUid: { fields: [...] } })
  // so Strapi v5 knows exactly which component fields to fetch.
  for (const dzName of dynamiczoneNames) {
    // Look up the dynamiczone component list from the specific content type being queried
    // to avoid accidentally picking up a same-named dynamiczone from a different content type.
    const attr =
      strapiInstance.contentTypes[contentTypeUid]?.attributes?.[dzName];
    const componentUids: string[] =
      attr?.type === "dynamiczone" && Array.isArray(attr.components)
        ? attr.components
        : [];

    const on: Record<string, any> = {};
    for (const uid of componentUids) {
      const comp = strapiInstance.components[uid];
      if (!comp?.attributes) continue;
      const translatableSubFields = Object.entries<any>(comp.attributes)
        .filter(([, def]) => TRANSLATABLE_FIELD_TYPES.has(def.type))
        .map(([name]) => name);
      if (translatableSubFields.length > 0) {
        on[uid] = { fields: translatableSubFields };
      }
    }

    if (Object.keys(on).length > 0) {
      populate[dzName] = { on };
    }
  }

  return { fields: Array.from(directFields), populate };
}

export default ({ strapi }: { strapi: any }) => ({
  getI18nContentTypes(): ContentTypeInfo[] {
    const result: ContentTypeInfo[] = [];

    for (const [uid, contentType] of Object.entries<any>(strapi.contentTypes)) {
      if (!uid.startsWith("api::")) continue;

      // Old Strapi v5: i18n plugin adds `locale` attribute at runtime
      // New Strapi v5: check pluginOptions.i18n.localized on the schema directly
      const isI18nEnabled =
        contentType.attributes?.locale !== undefined ||
        contentType.pluginOptions?.i18n?.localized === true;
      if (!isI18nEnabled) continue;

      // Old Strapi v5: each field has pluginOptions.i18n.localized = true
      // New Strapi v5: no per-field setting; all translatable-type fields are included
      const hasFieldLevelI18n = Object.values<any>(contentType.attributes).some(
        (f) => f.pluginOptions?.i18n?.localized === true,
      );

      const localizableFields: LocalizableField[] = [];

      for (const [fieldName, fieldDef] of Object.entries<any>(
        contentType.attributes,
      )) {
        if (fieldName === "locale" || fieldName === "localizations") {
          continue;
        }

        if (fieldDef.type === "component") {
          if (fieldDef.repeatable) {
            // Repeatable component: treat whole array as a JSON blob
            const component = strapi.components[fieldDef.component];
            const hasTranslatable =
              component?.attributes &&
              Object.values<any>(component.attributes).some((d: any) =>
                TRANSLATABLE_FIELD_TYPES.has(d.type),
              );
            if (hasTranslatable) {
              localizableFields.push({
                name: fieldName,
                type: "component",
                required: fieldDef.required || false,
              });
            }
          } else {
            // Non-repeatable component: expand sub-fields with dot-notation
            const component = strapi.components[fieldDef.component];
            if (component?.attributes) {
              for (const [subName, subDef] of Object.entries<any>(
                component.attributes,
              )) {
                if (!TRANSLATABLE_FIELD_TYPES.has(subDef.type)) {
                  continue;
                }
                localizableFields.push({
                  name: `${fieldName}.${subName}`,
                  type: (subDef as any).type,
                  required: (subDef as any).required || false,
                });
              }
            }
          }
          continue;
        }

        // dynamiczone: include if any referenced component has translatable fields
        if (fieldDef.type === "dynamiczone") {
          const hasTranslatable = (fieldDef.components || []).some(
            (componentUid: string) => {
              const comp = strapi.components[componentUid];
              return (
                comp?.attributes &&
                Object.values<any>(comp.attributes).some((d: any) =>
                  TRANSLATABLE_FIELD_TYPES.has(d.type),
                )
              );
            },
          );
          if (hasTranslatable) {
            localizableFields.push({
              name: fieldName,
              type: "dynamiczone",
              required: fieldDef.required || false,
            });
          }
          continue;
        }

        if (!TRANSLATABLE_FIELD_TYPES.has(fieldDef.type)) {
          continue;
        }
        const isLocalized = hasFieldLevelI18n
          ? fieldDef.pluginOptions?.i18n?.localized === true
          : true; // new API: all translatable-type fields are localizable

        if (!isLocalized) {
          continue;
        }

        localizableFields.push({
          name: fieldName,
          type: fieldDef.type,
          required: fieldDef.required || false,
        });
      }

      if (localizableFields.length === 0) {
        continue;
      }

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
    const { fields: fieldsToSelect, populate } = buildQueryOptions(
      ctInfo.localizableFields,
      strapi,
      uid,
    );

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;

    const filters: any = {};
    if (params?.search) {
      const firstStringField = ctInfo.localizableFields.find(
        (f) => f.type === "string" && !f.name.includes("."),
      );
      if (firstStringField) {
        filters[firstStringField.name] = { $containsi: params.search };
      }
    }

    const sourceEntries = await strapi.documents(uid).findMany({
      locale: defaultLocale,
      fields: fieldsToSelect,
      populate,
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
          populate,
        });
      } catch {
        // Target locale version doesn't exist yet
      }

      const fields: Record<string, { source: string; target: string }> = {};
      for (const fieldName of localizableFieldNames) {
        // Dynamiczone fields are expanded below into indexed sub-field keys
        const fieldMeta = ctInfo.localizableFields.find(
          (f) => f.name === fieldName,
        );
        if (fieldMeta?.type === "dynamiczone") continue;
        const fieldType = fieldMeta?.type ?? "string";
        fields[fieldName] = {
          source: serializeFieldValue(
            resolveFieldValue(source, fieldName),
            fieldType,
          ),
          target: serializeFieldValue(
            resolveFieldValue(target, fieldName),
            fieldType,
          ),
        };
      }

      // Flatten dynamiczone fields into indexed keys: blocks[0].body, etc.
      for (const dzField of ctInfo.localizableFields.filter(
        (f) => f.type === "dynamiczone",
      )) {
        const sourceBlocks: any[] = source[dzField.name] || [];
        const targetBlocks: any[] = target ? target[dzField.name] || [] : [];
        sourceBlocks.forEach((block: any, index: number) => {
          const component = strapi.components[block.__component];
          if (!component?.attributes) return;
          const targetBlock = targetBlocks[index];
          for (const [subField, subDef] of Object.entries<any>(
            component.attributes,
          )) {
            if (!TRANSLATABLE_FIELD_TYPES.has((subDef as any).type)) continue;
            fields[`${dzField.name}[${index}].${subField}`] = {
              source: serializeFieldValue(
                block[subField],
                (subDef as any).type,
              ),
              target: serializeFieldValue(
                targetBlock?.[subField],
                (subDef as any).type,
              ),
            };
          }
        });
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
      localizableFields: ctInfo.localizableFields.filter(
        (f) => f.type !== "dynamiczone",
      ),
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
    const { fields: fieldsToSelect, populate } = buildQueryOptions(
      ctInfo.localizableFields,
      strapi,
      uid,
    );

    const source = await strapi.documents(uid).findOne({
      documentId,
      locale: defaultLocale,
      fields: fieldsToSelect,
      populate,
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
        populate,
      });
    } catch {
      // Target doesn't exist yet
    }

    const fields: Record<string, { source: string; target: string }> = {};
    for (const fieldName of localizableFieldNames) {
      // Dynamiczone fields are expanded below into indexed sub-field keys

      const fieldMeta = ctInfo.localizableFields.find(
        (f) => f.name === fieldName,
      );
      if (fieldMeta?.type === "dynamiczone") continue;
      const fieldType = fieldMeta?.type ?? "string";
      fields[fieldName] = {
        source: serializeFieldValue(
          resolveFieldValue(source, fieldName),
          fieldType,
        ),
        target: serializeFieldValue(
          resolveFieldValue(target, fieldName),
          fieldType,
        ),
      };
    }

    // Flatten dynamiczone fields into indexed keys and build per-entry localizableFields
    // (dynamiczone fields themselves are NOT added to extendedLocalizableFields)
    const extendedLocalizableFields: LocalizableField[] = [];
    for (const field of ctInfo.localizableFields) {
      if (field.type !== "dynamiczone") {
        extendedLocalizableFields.push(field);
        continue;
      }
      const sourceBlocks: any[] = source[field.name] || [];
      const targetBlocks: any[] = target ? target[field.name] || [] : [];
      sourceBlocks.forEach((block: any, index: number) => {
        const component = strapi.components[block.__component];
        if (!component?.attributes) return;
        const targetBlock = targetBlocks[index];
        for (const [subField, subDef] of Object.entries<any>(
          component.attributes,
        )) {
          if (!TRANSLATABLE_FIELD_TYPES.has((subDef as any).type)) continue;
          const key = `${field.name}[${index}].${subField}`;
          fields[key] = {
            source: serializeFieldValue(block[subField], (subDef as any).type),
            target: serializeFieldValue(
              targetBlock?.[subField],
              (subDef as any).type,
            ),
          };
          extendedLocalizableFields.push({
            name: key,
            type: (subDef as any).type,
            required: false,
          });
        }
      });
    }

    return {
      documentId,
      sourceLocale: defaultLocale,
      targetLocale,
      fields,
      hasTarget: !!target,
      localizableFields: extendedLocalizableFields,
      contentType: ctInfo,
    };
  },

  /**
   * Reconstruct the data object to pass to strapi.documents().update() from a
   * flat Record<string, string> of translated values.
   *
   * Handles three key formats:
   *   - "title"          → direct field
   *   - "seo.metaTitle"  → non-repeatable component sub-field
   *   - "blocks[0].body" → dynamiczone block sub-field (fetches source structure)
   */
  async rebuildDataFromTranslated(
    uid: string,
    documentId: string,
    translatedFields: Record<string, string>,
  ): Promise<Record<string, any>> {
    const dzPattern = /^([^\[]+)\[(\d+)\]\.(.+)$/;

    // Separate dynamiczone keys from the rest
    const dzGroups: Record<string, Record<number, Record<string, string>>> = {};
    const otherFields: Record<string, string> = {};

    for (const [key, value] of Object.entries(translatedFields)) {
      const match = key.match(dzPattern);
      if (match) {
        const [, fieldName, indexStr, subField] = match;
        const index = parseInt(indexStr, 10);
        if (!dzGroups[fieldName]) dzGroups[fieldName] = {};
        if (!dzGroups[fieldName][index]) dzGroups[fieldName][index] = {};
        dzGroups[fieldName][index][subField] = value;
      } else {
        otherFields[key] = value;
      }
    }

    // Reconstruct component dot-notation keys into nested objects
    const data: Record<string, any> = {};
    for (const [key, value] of Object.entries(otherFields)) {
      const dot = key.indexOf(".");
      if (dot === -1) {
        data[key] = deserializeFieldValue(value);
      } else {
        const parent = key.slice(0, dot);
        const sub = key.slice(dot + 1);
        if (!data[parent] || typeof data[parent] !== "object") {
          data[parent] = {};
        }
        data[parent][sub] = deserializeFieldValue(value);
      }
    }

    // Reconstruct dynamiczone arrays using source locale blocks as template
    if (Object.keys(dzGroups).length > 0) {
      const defaultLocale = await this.getDefaultLocale();

      // Build on-fragment populate for each dynamiczone field
      const populate: Record<string, any> = {};
      for (const dzName of Object.keys(dzGroups)) {
        // Look up the dynamiczone component list from the specific content type being queried
        // to avoid accidentally picking up a same-named dynamiczone from a different content type.
        const attr = strapi.contentTypes[uid]?.attributes?.[dzName];
        const componentUids: string[] =
          attr?.type === "dynamiczone" && Array.isArray(attr.components)
            ? attr.components
            : [];

        const on: Record<string, any> = {};
        for (const compUid of componentUids) {
          const comp = strapi.components[compUid];
          if (comp?.attributes) {
            const translatableAttrs = Object.entries<any>(comp.attributes)
              .filter(([, def]) => TRANSLATABLE_FIELD_TYPES.has(def.type))
              .map(([name]) => name);
            if (translatableAttrs.length > 0) {
              on[compUid] = { fields: translatableAttrs };
            }
          }
        }
        if (Object.keys(on).length > 0) {
          populate[dzName] = { on };
        }
      }

      const sourceEntry = await strapi.documents(uid).findOne({
        documentId,
        locale: defaultLocale,
        fields: ["documentId"],
        populate,
      });

      for (const [fieldName, indexedFields] of Object.entries(dzGroups)) {
        const sourceBlocks: any[] = sourceEntry?.[fieldName] || [];
        data[fieldName] = sourceBlocks.map((block: any, index: number) => {
          const translated = indexedFields[index] || {};
          // Only include __component and translatable field values.
          // Media/relation fields from the source cannot be passed directly
          // to the document service update — Strapi rejects them as invalid keys.
          const comp = strapi.components[block.__component];
          const safeFields: Record<string, any> = {
            __component: block.__component,
          };
          if (comp?.attributes) {
            for (const [attr, def] of Object.entries<any>(comp.attributes)) {
              if (TRANSLATABLE_FIELD_TYPES.has(def.type)) {
                // Use translated value if provided, otherwise preserve source value
                safeFields[attr] =
                  attr in translated
                    ? deserializeFieldValue(translated[attr])
                    : block[attr];
              }
            }
          }
          return safeFields;
        });
      }
    }

    return data;
  },
});
