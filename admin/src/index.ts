import { Earth } from "@strapi/icons";
import PLUGIN_ID from "./pluginId";
import { getTrad } from "./utils/getTrad";
import { TranslateButton } from "./components/TranslateDocumentAction";

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: Earth,
      intlLabel: {
        id: getTrad("plugin.name"),
        defaultMessage: "L10n.dev - AI Translator",
      },
      Component: async () => {
        const { App } = await import("./pages/App");
        return App;
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      name: PLUGIN_ID,
    });
  },

  bootstrap(app: any) {
    const cm = app.getPlugin("content-manager");
    if (cm) {
      cm.injectComponent("editView", "right-links", {
        name: "ai-translator-translate",
        Component: TranslateButton,
      });
    }
  },

  async registerTrads({ locales }: { locales: string[] }) {
    const SUPPORTED = new Set([
      "de",
      "en",
      "es",
      "fr",
      "id",
      "it",
      "ja",
      "ko",
      "pt",
      "zh-CN",
      "zh-TW",
    ]);

    const resolveLocale = (locale: string): string => {
      for (const s of SUPPORTED) {
        if (locale.toLowerCase() === s.toLowerCase()) {
          return s;
        }
      }
      const lang = locale.split("-")[0].toLowerCase();
      for (const s of SUPPORTED) {
        if (s.toLowerCase() === lang) {
          return s;
        }
      }
      return "en";
    };

    return Promise.all(
      locales.map(async (locale: string) => {
        const resolved = resolveLocale(locale);
        try {
          const { default: data } = await import(
            `./translations/${resolved}.json`
          );
          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};
