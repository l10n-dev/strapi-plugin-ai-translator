const STORE_KEY = 'plugin_ai_translator_settings';

export interface PluginSettings {
  apiKey: string;
  selectedCategories: string[];
  incremental: boolean;
  lastTargetLocale: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: '',
  selectedCategories: [],
  incremental: true,
  lastTargetLocale: '',
};

export default ({ strapi }: { strapi: any }) => ({
  async getSettings(): Promise<PluginSettings> {
    const store = strapi.store({ type: 'plugin', name: 'ai-translator' });
    const data = await store.get({ key: STORE_KEY });
    if (!data) {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...(data as Partial<PluginSettings>) };
  },

  async updateSettings(newSettings: Partial<PluginSettings>): Promise<PluginSettings> {
    const store = strapi.store({ type: 'plugin', name: 'ai-translator' });
    const current = await this.getSettings();
    const merged = { ...current, ...newSettings };
    await store.set({ key: STORE_KEY, value: merged });
    return merged;
  },

  async getApiKey(): Promise<string> {
    const settings = await this.getSettings();
    return settings.apiKey;
  },
});
