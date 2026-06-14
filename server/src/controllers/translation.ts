export default ({ strapi }: { strapi: any }) => ({
  async translate(ctx: any) {
    const translationService = strapi
      .plugin("ai-translator")
      .service("translation");
    const { uid, documentId, targetLocale, fields } = ctx.request.body;

    if (!uid || !documentId || !targetLocale) {
      return ctx.badRequest("uid, documentId, and targetLocale are required");
    }

    const result = await translationService.translateEntry(
      uid,
      documentId,
      targetLocale,
      {
        incremental: false, // Force incremental to false for selected translation
        generateGlossary: false, // Force generateGlossary to false for selected translation
        fields,
      },
    );

    if (result.status === "error") {
      if (result.reason === "insufficientBalance") {
        ctx.status = 402;
      } else if (result.reason === "unauthorized") {
        ctx.status = 401;
      } else {
        ctx.status = 500;
      }
      ctx.body = result;
      return;
    }

    const contentTypeService = strapi
      .plugin("ai-translator")
      .service("content-type");

    const data = await contentTypeService.rebuildDataFromTranslated(
      uid,
      documentId,
      result.translations ?? {},
    );

    ctx.body = { ...result, data };
  },

  async translateBulk(ctx: any) {
    const translationService = strapi
      .plugin("ai-translator")
      .service("translation");
    const { uids, targetLocale, incremental, generateGlossary } =
      ctx.request.body;

    if (!uids || !Array.isArray(uids) || uids.length === 0 || !targetLocale) {
      return ctx.badRequest("uids (array) and targetLocale are required");
    }

    // Launch bulk translation in background — respond immediately
    translationService.translateBulk(uids, targetLocale, {
      incremental: !!incremental,
      generateGlossary: !!generateGlossary,
    });

    ctx.body = { status: "started", message: "Bulk translation started" };
  },

  async save(ctx: any) {
    const translationService = strapi
      .plugin("ai-translator")
      .service("translation");
    const { uid, documentId, targetLocale, fields } = ctx.request.body;

    if (!uid || !documentId || !targetLocale || !fields) {
      return ctx.badRequest(
        "uid, documentId, targetLocale, and fields are required",
      );
    }

    await translationService.saveTranslation(
      uid,
      documentId,
      targetLocale,
      fields,
    );
    ctx.body = { status: "saved" };
  },

  async balance(ctx: any) {
    const translationService = strapi
      .plugin("ai-translator")
      .service("translation");
    ctx.body = await translationService.getBalance();
  },

  async status(ctx: any) {
    const translationService = strapi
      .plugin("ai-translator")
      .service("translation");
    ctx.body = translationService.getBulkProgress();
  },

  async cancel(ctx: any) {
    const translationService = strapi
      .plugin("ai-translator")
      .service("translation");
    translationService.cancelBulk();
    ctx.body = { status: "cancelled" };
  },
});
