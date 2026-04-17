import { useState, useEffect } from "react";
import { useIntl } from "react-intl";
import {
  useFetchClient,
  useNotification,
  unstable_useContentManagerContext as useContentManagerContext,
} from "@strapi/strapi/admin";
import { useQueryParams } from "@strapi/admin/strapi-admin";
import { Button } from "@strapi/design-system";
import { Earth } from "@strapi/icons";
import { URLS } from "ai-l10n-core";
import { translateEntry, fetchContentTypes } from "../utils/api";
import { getTrad } from "../utils/getTrad";

interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
}

export const TranslateButton = () => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const client = useFetchClient();
  const { form, contentType, id: contextId } = useContentManagerContext();
  const [{ query }] = useQueryParams<{
    plugins?: { i18n?: { locale?: string } };
  }>();

  const [locales, setLocales] = useState<Locale[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchContentTypes(client)
      .then((data: any) => setLocales(data.locales || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isI18nEnabled =
    (contentType as any)?.pluginOptions?.i18n?.localized || false;

  const targetLocale = query.plugins?.i18n?.locale;
  const defaultLocale = locales.find((l) => l.isDefault);

  // Hide when: not an i18n type, or already viewing the default locale
  if (
    !isI18nEnabled ||
    !targetLocale ||
    !defaultLocale ||
    targetLocale === defaultLocale.code
  ) {
    return null;
  }

  const handleTranslate = async () => {
    const documentId =
      (form as any).values?.documentId ?? (form as any).values?.id ?? contextId;
    if (!documentId || !(contentType as any)?.uid) return;

    setIsLoading(true);
    try {
      const result = await translateEntry(client, {
        uid: (contentType as any).uid,
        documentId,
        targetLocale,
      });

      if (!result.translations) {
        throw new Error(result.message || "Translation failed");
      }

      // Populate each translated field into the form via onChange
      Object.entries(result.translations).forEach(([key, value]) => {
        (form as any).onChange({ target: { name: key, value } });
      });

      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTrad("contentManager.translated"),
          defaultMessage: "Translation applied. Review and save when ready.",
        }),
      });
    } catch (err: any) {
      const status = err?.status;
      if (status === 402) {
        toggleNotification({
          type: "warning",
          message: formatMessage({
            id: getTrad("notification.insufficientBalance"),
            defaultMessage: `Insufficient balance. Purchase more at ${URLS.PRICING}`,
          }),
        });
      } else if (status === 401) {
        toggleNotification({
          type: "warning",
          message: formatMessage({
            id: getTrad("notification.unauthorized"),
            defaultMessage: "Unauthorized. Please check your API Key.",
          }),
        });
      } else {
        toggleNotification({
          type: "warning",
          message: err.message || "Translation failed",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      startIcon={<Earth />}
      fullWidth
      loading={isLoading}
      onClick={handleTranslate}
    >
      {formatMessage(
        {
          id: getTrad("contentManager.translateFrom"),
          defaultMessage: "Translate from {locale}",
        },
        { locale: defaultLocale.name },
      )}
    </Button>
  );
};
