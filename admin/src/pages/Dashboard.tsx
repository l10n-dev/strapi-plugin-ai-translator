import { useState, useEffect, useCallback } from "react";
import type React from "react";
import { useQueryClient } from "react-query";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Typography,
  TextInput,
  Divider,
  Link,
} from "@strapi/design-system";
import { Page, Layouts, useNotification } from "@strapi/strapi/admin";
import { Play } from "@strapi/icons";
import { useIntl } from "react-intl";
import { URLS } from "ai-l10n-core";
import { getTrad } from "../utils/getTrad";
import { localizeUrl } from "../utils/localizeUrl";
import { useBalance } from "../hooks/useBalance";
import { useContentTypes } from "../hooks/useContentTypes";
import { usePluginSettings } from "../hooks/usePluginSettings";
import { useTranslation, useBulkProgress } from "../hooks/useTranslation";
import { LanguageSelector } from "../components/LanguageSelector";
import { QuotaDisplay } from "../components/QuotaDisplay";
import { ContentTypeTable } from "../components/ContentTypeTable";
import { TranslationProgress } from "../components/TranslationProgress";

export const Dashboard = () => {
  const { formatMessage, locale } = useIntl();
  const { toggleNotification } = useNotification();

  const {
    settings,
    isLoading: settingsLoading,
    update: updateSettings,
    updateAsync,
  } = usePluginSettings();
  const [targetLocale, setTargetLocale] = useState("");
  const [incremental, setIncremental] = useState(true);
  const [generateGlossary, setGenerateGlossary] = useState(false);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [translatingUid, setTranslatingUid] = useState<string | undefined>();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  const { data, isLoading, refetch } = useContentTypes(
    targetLocale || undefined,
  );
  const queryClient = useQueryClient();
  const { translateBulk } = useTranslation();
  const { data: bulkProgress } = useBulkProgress(isBulkRunning);
  const {
    remainingBalance,
    updateBalance,
    invalidate: invalidateBalance,
  } = useBalance();

  // Clear stale bulk-status cache when navigating away so the
  // completion notification doesn't re-fire on next mount.
  useEffect(() => {
    return () => {
      queryClient.removeQueries(["ai-translator", "bulk-status"]);
    };
  }, []);

  // Initialize from settings
  useEffect(() => {
    if (settings) {
      if (settings.lastTargetLocale) {
        setTargetLocale(settings.lastTargetLocale);
      }
      setIncremental(settings.incremental ?? true);
      setGenerateGlossary(settings.generateGlossary ?? false);
      if (settings.selectedCategories?.length) {
        setSelectedUids(settings.selectedCategories);
      } else if (data?.contentTypes) {
        setSelectedUids(data.contentTypes.map((ct) => ct.uid));
      }
    }
  }, [settings, data?.contentTypes]);

  // Initialize target locale from locales list only when there is no saved locale
  useEffect(() => {
    if (!targetLocale && data?.locales && !settings?.lastTargetLocale) {
      const nonDefault = data.locales.find((l) => !l.isDefault);
      if (nonDefault) setTargetLocale(nonDefault.code);
    }
  }, [data?.locales, targetLocale, settings?.lastTargetLocale]);

  // Track bulk progress
  useEffect(() => {
    if (bulkProgress) {
      if (
        bulkProgress.remainingBalance != null &&
        bulkProgress.remainingBalance >= 0
      ) {
        updateBalance(bulkProgress.remainingBalance);
      }
      if (
        bulkProgress.status === "completed" ||
        bulkProgress.status === "stopped"
      ) {
        setIsBulkRunning(false);
        setTranslatingUid(undefined);
        refetch();
        if (bulkProgress.status === "stopped") {
          if (bulkProgress.stopReason === "unauthorized") {
            toggleNotification({
              type: "warning",
              message: formatMessage({
                id: getTrad("notification.unauthorized"),
                defaultMessage:
                  "Translation stopped: Invalid API key. Please check your API key.",
              }),
            });
          } else {
            toggleNotification({
              type: "warning",
              message: formatMessage({
                id: getTrad("notification.insufficientBalance"),
                defaultMessage: `Translation stopped: insufficient balance. Upgrade your plan or renew early at ${URLS.PRICING}`,
              }),
            });
          }
        } else if (bulkProgress.failed > 0 && bulkProgress.completed === 0) {
          toggleNotification({
            type: "warning",
            message: formatMessage({
              id: getTrad("notification.bulkFailed"),
              defaultMessage: "Translation failed for all entries.",
            }),
          });
        } else if (bulkProgress.failed > 0) {
          toggleNotification({
            type: "warning",
            message: formatMessage(
              {
                id: getTrad("notification.bulkPartial"),
                defaultMessage:
                  "Translation completed with {failed} failed entries.",
              },
              { failed: bulkProgress.failed },
            ),
          });
        } else {
          toggleNotification({
            type: "success",
            message: formatMessage({
              id: getTrad("notification.bulkCompleted"),
              defaultMessage: "Bulk translation completed!",
            }),
          });
        }
      }
    }
  }, [bulkProgress?.status, bulkProgress?.completed]);

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setIsSavingKey(true);
    try {
      await updateAsync({ apiKey: trimmed });
      setApiKeyInput("");
      setShowApiKeyInput(false);
      invalidateBalance();
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTrad("settings.apiKeySaved"),
          defaultMessage: "API key saved successfully!",
        }),
      });
    } catch (err: any) {
      toggleNotification({ type: "warning", message: err.message });
    } finally {
      setIsSavingKey(false);
    }
  }, [apiKeyInput, updateAsync, toggleNotification, formatMessage]);

  const handleLocaleChange = useCallback(
    (locale: string) => {
      setTargetLocale(locale);
      updateSettings({ lastTargetLocale: locale });
    },
    [updateSettings],
  );

  const handleIncrementalChange = useCallback(
    (checked: boolean) => {
      setIncremental(checked);
      updateSettings({ incremental: checked });
    },
    [updateSettings],
  );

  const handleGenerateGlossaryChange = useCallback(
    (checked: boolean) => {
      setGenerateGlossary(checked);
      updateSettings({ generateGlossary: checked });
    },
    [updateSettings],
  );

  const handleToggleSelect = useCallback(
    (uid: string) => {
      setSelectedUids((prev) => {
        const next = prev.includes(uid)
          ? prev.filter((u) => u !== uid)
          : [...prev, uid];
        updateSettings({ selectedCategories: next });
        return next;
      });
    },
    [updateSettings],
  );

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      const next = selected
        ? (data?.contentTypes || []).map((ct) => ct.uid)
        : [];
      setSelectedUids(next);
      updateSettings({ selectedCategories: next });
    },
    [data?.contentTypes, updateSettings],
  );

  const handleTranslateSingle = useCallback(
    async (uid: string) => {
      if (!targetLocale) return;
      setTranslatingUid(uid);
      translateBulk.mutate(
        { uids: [uid], targetLocale, incremental, generateGlossary },
        {
          onSuccess: () => {
            setIsBulkRunning(true);
          },
          onError: (err) => {
            setTranslatingUid(undefined);
            toggleNotification({ type: "warning", message: err.message });
          },
        },
      );
    },
    [
      targetLocale,
      incremental,
      generateGlossary,
      translateBulk,
      toggleNotification,
    ],
  );

  const handleAutoTranslate = useCallback(() => {
    if (!targetLocale || selectedUids.length === 0) return;
    translateBulk.mutate(
      { uids: selectedUids, targetLocale, incremental, generateGlossary },
      {
        onSuccess: () => {
          setIsBulkRunning(true);
        },
        onError: (err) => {
          toggleNotification({ type: "warning", message: err.message });
        },
      },
    );
  }, [
    targetLocale,
    selectedUids,
    incremental,
    generateGlossary,
    translateBulk,
    toggleNotification,
  ]);

  // Calculate global percentage
  const totalEntries =
    data?.contentTypes?.reduce((sum, ct) => sum + ct.totalEntries, 0) || 0;
  const totalTranslated =
    data?.contentTypes?.reduce((sum, ct) => sum + ct.translatedEntries, 0) || 0;
  const globalPercentage =
    totalEntries > 0
      ? ((totalTranslated / totalEntries) * 100).toFixed(1)
      : "0";

  if (settingsLoading || isLoading) return <Page.Loading />;

  return (
    <Layouts.Root>
      <Page.Title>
        {formatMessage({
          id: getTrad("plugin.name"),
          defaultMessage: "L10n.dev - AI Translator",
        })}
      </Page.Title>
      <Page.Main>
        <Layouts.Header
          title={formatMessage({
            id: getTrad("plugin.name"),
            defaultMessage: "L10n.dev - AI Translator",
          })}
          subtitle={formatMessage(
            {
              id: getTrad("dashboard.subtitle"),
              defaultMessage: "{percentage}% translated",
            },
            { percentage: globalPercentage },
          )}
          primaryAction={
            <Button
              startIcon={<Play />}
              onClick={handleAutoTranslate}
              disabled={
                selectedUids.length === 0 || !targetLocale || isBulkRunning
              }
              loading={isBulkRunning}
            >
              {formatMessage({
                id: getTrad("dashboard.autoTranslate"),
                defaultMessage: "Auto-translate",
              })}
            </Button>
          }
        />

        <Layouts.Content>
          <Box paddingBottom={6}>
            <Flex
              gap={3}
              alignItems="center"
              justifyContent="space-between"
              wrap="wrap"
            >
              <Flex gap={3} alignItems="center" wrap="wrap" style={{ flex: 1 }}>
                {!settings?.hasApiKey ? (
                  <>
                    <Box style={{ flex: "1 1 280px", maxWidth: 420 }}>
                      <TextInput
                        aria-label={formatMessage({
                          id: getTrad("settings.apiKeyLabel"),
                          defaultMessage: "l10n.dev API Key",
                        })}
                        placeholder={formatMessage({
                          id: getTrad("settings.apiKeyPlaceholder"),
                          defaultMessage:
                            "Paste your l10n.dev API key to start translating",
                        })}
                        size="S"
                        value={apiKeyInput}
                        onChange={(e: any) => setApiKeyInput(e.target.value)}
                        type="password"
                      />
                    </Box>
                    <Button
                      onClick={handleSaveApiKey}
                      loading={isSavingKey}
                      disabled={!apiKeyInput.trim()}
                    >
                      {formatMessage({
                        id: getTrad("settings.saveKey"),
                        defaultMessage: "Save",
                      })}
                    </Button>
                  </>
                ) : showApiKeyInput ? (
                  <>
                    <Box style={{ flex: "1 1 240px", maxWidth: 380 }}>
                      <TextInput
                        size="S"
                        aria-label={formatMessage({
                          id: getTrad("settings.newApiKeyPlaceholder"),
                          defaultMessage: "Paste new API key",
                        })}
                        placeholder={formatMessage({
                          id: getTrad("settings.newApiKeyPlaceholder"),
                          defaultMessage: "Paste new API key",
                        })}
                        value={apiKeyInput}
                        onChange={(e: any) => setApiKeyInput(e.target.value)}
                        type="password"
                      />
                    </Box>
                    <Button
                      onClick={handleSaveApiKey}
                      loading={isSavingKey}
                      disabled={!apiKeyInput.trim()}
                    >
                      {formatMessage({
                        id: getTrad("settings.saveKey"),
                        defaultMessage: "Save",
                      })}
                    </Button>
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setShowApiKeyInput(false);
                        setApiKeyInput("");
                      }}
                    >
                      {formatMessage({
                        id: getTrad("settings.cancel"),
                        defaultMessage: "Cancel",
                      })}
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage({
                        id: getTrad("settings.apiKeySet"),
                        defaultMessage: "API key configured",
                      })}
                    </Typography>
                    <Button
                      variant="tertiary"
                      onClick={() => setShowApiKeyInput(true)}
                    >
                      {formatMessage({
                        id: getTrad("settings.changeKey"),
                        defaultMessage: "Change",
                      })}
                    </Button>
                  </>
                )}
              </Flex>
              <Link href={localizeUrl(URLS.API_KEYS, locale)} isExternal>
                {formatMessage({
                  id: getTrad("settings.getApiKeyLink"),
                  defaultMessage: "Get an API key",
                })}
              </Link>
            </Flex>
          </Box>

          <Box paddingBottom={4}>
            <Flex
              gap={6}
              alignItems="center"
              justifyContent="space-between"
              wrap="wrap"
            >
              <Flex gap={6} alignItems="center" wrap="wrap">
                {data?.locales && (
                  <LanguageSelector
                    locales={data.locales}
                    value={targetLocale}
                    onChange={handleLocaleChange}
                    disabled={isBulkRunning}
                  />
                )}
                <Checkbox
                  checked={incremental}
                  onCheckedChange={handleIncrementalChange}
                >
                  {formatMessage({
                    id: getTrad("dashboard.incremental"),
                    defaultMessage:
                      "Incremental (new entries or updated entries only)",
                  })}
                </Checkbox>
                <Checkbox
                  checked={generateGlossary}
                  onCheckedChange={handleGenerateGlossaryChange}
                >
                  {formatMessage({
                    id: getTrad("dashboard.generateGlossary"),
                    defaultMessage:
                      "Generate & Save Glossary (recommended for consistent translations)",
                  })}
                </Checkbox>
              </Flex>
              <QuotaDisplay remainingBalance={remainingBalance} />
            </Flex>
          </Box>

          {!incremental && (
            <Box paddingBottom={4}>
              <Box padding={3} background="warning100" hasRadius>
                <Typography variant="pi" textColor="warning700">
                  {formatMessage({
                    id: getTrad("dashboard.retranslateWarning"),
                    defaultMessage:
                      "Warning: All existing translations will be overwritten. This will retranslate all content, not just new strings.",
                  })}
                </Typography>
              </Box>
            </Box>
          )}

          {isBulkRunning && bulkProgress ? (
            <Box paddingBottom={4}>
              <Box padding={3} hasRadius>
                <Flex direction="column" gap={2} alignItems="stretch">
                  <TranslationProgress
                    total={bulkProgress.total}
                    completed={bulkProgress.completed}
                    failed={bulkProgress.failed}
                    status={bulkProgress.status}
                  />
                  <Typography variant="pi">
                    {formatMessage({
                      id: getTrad("dashboard.inProgressMessage"),
                      defaultMessage:
                        "Translation in progress. AI translation takes time as the AI processes your content. The app translates in real-time and does not store your content on our servers. Please do not leave this page until translation is complete.",
                    })}
                  </Typography>
                </Flex>
              </Box>
            </Box>
          ) : (
            <Box paddingBottom={4}>
              <Box padding={3} hasRadius>
                <Flex direction="column" gap={1} alignItems="stretch">
                  <Typography variant="pi">
                    {formatMessage({
                      id: getTrad("dashboard.infoMessage"),
                      defaultMessage:
                        "Incremental mode skips entries that are already up-to-date. For entries where the source was updated after the translation, all fields are retranslated (Strapi does not track which specific field changed). To translate or edit a single field, open the entry in the Editor.",
                    })}
                  </Typography>
                  <Typography variant="pi">
                    {formatMessage({
                      id: getTrad("dashboard.infoMessageAI"),
                      defaultMessage:
                        "Our AI translator understands context, supports 165 languages, preserves formatting and structure, and follows grammar and plural form rules. It produces natural, human-like translations.",
                    })}
                  </Typography>
                </Flex>
              </Box>
            </Box>
          )}

          <Divider />

          <Box paddingTop={4}>
            {data?.contentTypes && (
              <ContentTypeTable
                contentTypes={data.contentTypes}
                selectedUids={selectedUids}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onTranslate={handleTranslateSingle}
                translatingUid={translatingUid}
              />
            )}
          </Box>

          <Box paddingTop={8}>
            <Divider />
            <Box paddingTop={4}>
              <Flex direction="column" gap={2} alignItems="stretch">
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage(
                    {
                      id: getTrad("footer.welcome"),
                      defaultMessage:
                        "Welcome to our plugin powered by l10n.dev! If you have any questions, feel free to email us at <emailLink>support@l10n.dev</emailLink> or <issueLink>create an issue on GitHub</issueLink>.",
                    },
                    {
                      emailLink: (chunks: React.ReactNode) => (
                        <Link href="mailto:support@l10n.dev">{chunks}</Link>
                      ),
                      issueLink: (chunks: React.ReactNode) => (
                        <Link
                          href="https://github.com/l10n-dev/strapi-plugin-ai-translator/issues"
                          isExternal
                        >
                          {chunks}
                        </Link>
                      ),
                    },
                  )}
                </Typography>
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage(
                    {
                      id: getTrad("footer.star"),
                      defaultMessage:
                        "Enjoying the plugin? <starLink>★ Star the repository</starLink>",
                    },
                    {
                      starLink: (chunks: React.ReactNode) => (
                        <Link
                          href="https://github.com/l10n-dev/strapi-plugin-ai-translator"
                          isExternal
                        >
                          {chunks}
                        </Link>
                      ),
                    },
                  )}
                </Typography>
                <Flex gap={4} wrap="wrap">
                  <Link
                    href={localizeUrl(
                      "https://l10n.dev/terms-of-service",
                      locale,
                    )}
                    isExternal
                  >
                    <Typography variant="pi">
                      {formatMessage({
                        id: getTrad("footer.terms"),
                        defaultMessage: "Terms of Service",
                      })}
                    </Typography>
                  </Link>
                  <Link
                    href={localizeUrl(
                      "https://l10n.dev/privacy-policy",
                      locale,
                    )}
                    isExternal
                  >
                    <Typography variant="pi">
                      {formatMessage({
                        id: getTrad("footer.privacy"),
                        defaultMessage: "Privacy Policy",
                      })}
                    </Typography>
                  </Link>
                  <Link
                    href={localizeUrl("https://l10n.dev/ws/billing", locale)}
                    isExternal
                  >
                    <Typography variant="pi">
                      {formatMessage({
                        id: getTrad("footer.billing"),
                        defaultMessage: "Billing",
                      })}
                    </Typography>
                  </Link>

                  <Link
                    href={localizeUrl(
                      "https://l10n.dev/ws/translation-glossary",
                      locale,
                    )}
                    isExternal
                  >
                    <Typography variant="pi">
                      {formatMessage({
                        id: getTrad("footer.manageGlossary"),
                        defaultMessage: "Manage Glossary",
                      })}
                    </Typography>
                  </Link>
                </Flex>
              </Flex>
            </Box>
          </Box>
        </Layouts.Content>
      </Page.Main>
    </Layouts.Root>
  );
};
