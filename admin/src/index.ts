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
    return Promise.all(
      locales.map(async (locale: string) => {
        try {
          const data = await import(`./translations/${locale}.json`);
          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};
