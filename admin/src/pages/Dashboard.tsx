import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Typography,
  TextInput,
  Divider,
  Link,
} from '@strapi/design-system';
import { Page, Layouts, useNotification } from '@strapi/strapi/admin';
import { Play } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { getTrad } from '../utils/getTrad';
import { useContentTypes } from '../hooks/useContentTypes';
import { usePluginSettings } from '../hooks/usePluginSettings';
import { useTranslation, useBulkProgress } from '../hooks/useTranslation';
import { LanguageSelector } from '../components/LanguageSelector';
import { QuotaDisplay } from '../components/QuotaDisplay';
import { ContentTypeTable } from '../components/ContentTypeTable';
import { TranslationProgress } from '../components/TranslationProgress';

export const Dashboard = () => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();

  const { settings, isLoading: settingsLoading, update: updateSettings } = usePluginSettings();
  const [targetLocale, setTargetLocale] = useState('');
  const [incremental, setIncremental] = useState(true);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [remainingBalance, setRemainingBalance] = useState<number | undefined>();
  const [translatingUid, setTranslatingUid] = useState<string | undefined>();

  const { data, isLoading, refetch } = useContentTypes(targetLocale || undefined);
  const { translate, translateBulk, cancel } = useTranslation();
  const { data: bulkProgress } = useBulkProgress(isBulkRunning);

  // Initialize from settings
  useEffect(() => {
    if (settings) {
      if (settings.lastTargetLocale) setTargetLocale(settings.lastTargetLocale);
      setIncremental(settings.incremental ?? true);
      if (settings.selectedCategories?.length) setSelectedUids(settings.selectedCategories);
    }
  }, [settings]);

  // Initialize target locale from locales list if not set
  useEffect(() => {
    if (!targetLocale && data?.locales) {
      const nonDefault = data.locales.find((l) => !l.isDefault);
      if (nonDefault) setTargetLocale(nonDefault.code);
    }
  }, [data?.locales, targetLocale]);

  // Track bulk progress
  useEffect(() => {
    if (bulkProgress) {
      setRemainingBalance(bulkProgress.remainingBalance);
      if (bulkProgress.status === 'completed' || bulkProgress.status === 'halted') {
        setIsBulkRunning(false);
        refetch();
        if (bulkProgress.status === 'halted') {
          toggleNotification({
            type: 'warning',
            message: formatMessage({
              id: getTrad('notification.insufficientBalance'),
              defaultMessage:
                'Translation halted: insufficient balance. Purchase more at https://l10n.dev/#pricing',
            }),
          });
        } else {
          toggleNotification({
            type: 'success',
            message: formatMessage({
              id: getTrad('notification.bulkCompleted'),
              defaultMessage: 'Bulk translation completed!',
            }),
          });
        }
      }
    }
  }, [bulkProgress?.status, bulkProgress?.completed]);

  const handleLocaleChange = useCallback(
    (locale: string) => {
      setTargetLocale(locale);
      updateSettings({ lastTargetLocale: locale });
    },
    [updateSettings]
  );

  const handleIncrementalChange = useCallback(
    (checked: boolean) => {
      setIncremental(checked);
      updateSettings({ incremental: checked });
    },
    [updateSettings]
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
    [updateSettings]
  );

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      const next = selected ? (data?.contentTypes || []).map((ct) => ct.uid) : [];
      setSelectedUids(next);
      updateSettings({ selectedCategories: next });
    },
    [data?.contentTypes, updateSettings]
  );

  const handleTranslateSingle = useCallback(
    async (uid: string) => {
      if (!targetLocale) return;
      setTranslatingUid(uid);
      translateBulk.mutate(
        { uids: [uid], targetLocale, incremental },
        {
          onSuccess: () => {
            setIsBulkRunning(true);
          },
          onError: (err) => {
            setTranslatingUid(undefined);
            toggleNotification({ type: 'warning', message: err.message });
          },
        }
      );
    },
    [targetLocale, incremental, translateBulk, toggleNotification]
  );

  const handleAutoTranslate = useCallback(() => {
    if (!targetLocale || selectedUids.length === 0) return;
    translateBulk.mutate(
      { uids: selectedUids, targetLocale, incremental },
      {
        onSuccess: () => {
          setIsBulkRunning(true);
        },
        onError: (err) => {
          toggleNotification({ type: 'warning', message: err.message });
        },
      }
    );
  }, [targetLocale, selectedUids, incremental, translateBulk, toggleNotification]);

  // Calculate global percentage
  const totalEntries = data?.contentTypes?.reduce((sum, ct) => sum + ct.totalEntries, 0) || 0;
  const totalTranslated =
    data?.contentTypes?.reduce((sum, ct) => sum + ct.translatedEntries, 0) || 0;
  const globalPercentage =
    totalEntries > 0 ? ((totalTranslated / totalEntries) * 100).toFixed(1) : '0';

  if (settingsLoading || isLoading) return <Page.Loading />;

  return (
    <Layouts.Root>
      <Page.Title>
        {formatMessage({ id: getTrad('plugin.name'), defaultMessage: 'AI Translator' })}
      </Page.Title>
      <Page.Main>
        <Layouts.Header
          title={formatMessage({ id: getTrad('plugin.name'), defaultMessage: 'AI Translator' })}
          subtitle={formatMessage(
            {
              id: getTrad('dashboard.subtitle'),
              defaultMessage: '{percentage}% translated',
            },
            { percentage: globalPercentage }
          )}
          primaryAction={
            <Button
              startIcon={<Play />}
              onClick={handleAutoTranslate}
              disabled={selectedUids.length === 0 || !targetLocale || isBulkRunning}
              loading={isBulkRunning}
            >
              {formatMessage({
                id: getTrad('dashboard.autoTranslate'),
                defaultMessage: 'Auto-translate',
              })}
            </Button>
          }
        />

        <Layouts.Content>
          <Box paddingBottom={4}>
            <Flex gap={4} alignItems="flex-end" wrap="wrap">
              {data?.locales && (
                <LanguageSelector
                  locales={data.locales}
                  value={targetLocale}
                  onChange={handleLocaleChange}
                  disabled={isBulkRunning}
                />
              )}
              <QuotaDisplay remainingBalance={remainingBalance} />
            </Flex>
          </Box>

          <Box paddingBottom={4}>
            <Flex gap={4} alignItems="center">
              <Checkbox
                checked={incremental}
                onCheckedChange={handleIncrementalChange}
              >
                {formatMessage({
                  id: getTrad('dashboard.incremental'),
                  defaultMessage: 'Incremental (new strings only)',
                })}
              </Checkbox>
            </Flex>
          </Box>

          {isBulkRunning && bulkProgress && (
            <Box paddingBottom={4}>
              <TranslationProgress
                total={bulkProgress.total}
                completed={bulkProgress.completed}
                failed={bulkProgress.failed}
                status={bulkProgress.status}
              />
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
        </Layouts.Content>
      </Page.Main>
    </Layouts.Root>
  );
};
