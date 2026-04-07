export default ({ strapi }: { strapi: any }) => ({
  async getSettings(ctx: any) {
    const settingsService = strapi.plugin('ai-translator').service('settings');
    const settings = await settingsService.getSettings();
    // Never return the full API key to the client — mask it
    ctx.body = {
      ...settings,
      apiKey: settings.apiKey ? `${'•'.repeat(8)}${settings.apiKey.slice(-4)}` : '',
      hasApiKey: !!settings.apiKey,
    };
  },

  async updateSettings(ctx: any) {
    const settingsService = strapi.plugin('ai-translator').service('settings');
    const body = ctx.request.body;
    const allowedFields: Record<string, boolean> = {
      apiKey: true,
      selectedCategories: true,
      incremental: true,
      lastTargetLocale: true,
    };

    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields[key]) {
        updates[key] = value;
      }
    }

    const settings = await settingsService.updateSettings(updates);
    ctx.body = {
      ...settings,
      apiKey: settings.apiKey ? `${'•'.repeat(8)}${settings.apiKey.slice(-4)}` : '',
      hasApiKey: !!settings.apiKey,
    };
  },
});
