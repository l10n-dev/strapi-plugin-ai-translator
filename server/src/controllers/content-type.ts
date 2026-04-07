export default ({ strapi }: { strapi: any }) => ({
  async list(ctx: any) {
    const contentTypeService = strapi.plugin('ai-translator').service('content-type');
    const targetLocale = ctx.query.locale;

    if (!targetLocale) {
      const locales = await contentTypeService.getLocales();
      const contentTypes = contentTypeService.getI18nContentTypes();
      ctx.body = { contentTypes, locales };
      return;
    }

    const contentTypes = await contentTypeService.getContentTypesWithStats(targetLocale);
    const locales = await contentTypeService.getLocales();
    ctx.body = { contentTypes, locales };
  },

  async entries(ctx: any) {
    const contentTypeService = strapi.plugin('ai-translator').service('content-type');
    const { uid } = ctx.params;
    const { locale, page, pageSize, search } = ctx.query;

    if (!uid || !locale) {
      return ctx.badRequest('uid and locale are required');
    }

    const decodedUid = decodeURIComponent(uid);
    const result = await contentTypeService.getEntries(decodedUid, locale, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 50,
      search,
    });

    ctx.body = result;
  },

  async entry(ctx: any) {
    const contentTypeService = strapi.plugin('ai-translator').service('content-type');
    const { uid, documentId } = ctx.params;
    const { locale } = ctx.query;

    if (!uid || !documentId || !locale) {
      return ctx.badRequest('uid, documentId, and locale are required');
    }

    const decodedUid = decodeURIComponent(uid);
    const result = await contentTypeService.getEntry(decodedUid, documentId, locale);
    ctx.body = result;
  },
});
