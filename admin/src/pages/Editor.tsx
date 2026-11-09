import { useState, useEffect, useCallback, useReducer, useMemo } from "react";
import {
  Box,
  Button,
  Flex,
  Typography,
  TextInput,
  Divider,
  Link,
  Dialog,
} from "@strapi/design-system";
import { Page, Layouts, useNotification } from "@strapi/strapi/admin";
import { Check, ArrowLeft, WarningCircle } from "@strapi/icons";
import { useIntl } from "react-intl";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useQueryClient, useInfiniteQuery } from "react-query";
import { useFetchClient } from "@strapi/strapi/admin";
import { URLS } from "ai-l10n-core";
import { getTrad } from "../utils/getTrad";
import { usePluginSettings } from "../hooks/usePluginSettings";
import { useTranslation } from "../hooks/useTranslation";
import { useLocales } from "../hooks/useLocales";
import { useIsMobile } from "../hooks/useIsMobile";
import { fetchEntries } from "../utils/api";
import { useBalance } from "../hooks/useBalance";
import { LanguageSelector } from "../components/LanguageSelector";
import { QuotaDisplay } from "../components/QuotaDisplay";
import { EntryList } from "../components/EntryList";
import { FieldEditor } from "../components/FieldEditor";

interface FieldValues {
  source: string;
  target: string;
}

interface Entry {
  documentId: string;
  fields: Record<string, FieldValues>;
  hasTarget: boolean;
  sourceLocale: string;
  targetLocale: string;
}

type DraftAction =
  | { type: "SET_FIELD"; documentId: string; fieldName: string; value: string }
  | {
      type: "SET_TRANSLATED";
      documentId: string;
      translations: Record<string, string>;
    }
  | { type: "REVERT_FIELD"; documentId: string; fieldName: string }
  | { type: "REVERT_ALL" }
  | { type: "MARK_SAVED"; documentIds: string[] };

interface DraftState {
  changes: Record<string, Record<string, string>>; // documentId -> fieldName -> value
}

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "SET_FIELD": {
      const docChanges = { ...state.changes[action.documentId] };
      docChanges[action.fieldName] = action.value;
      return { changes: { ...state.changes, [action.documentId]: docChanges } };
    }
    case "SET_TRANSLATED": {
      const docChanges = {
        ...state.changes[action.documentId],
        ...action.translations,
      };
      return { changes: { ...state.changes, [action.documentId]: docChanges } };
    }
    case "REVERT_FIELD": {
      const docChanges = { ...state.changes[action.documentId] };
      delete docChanges[action.fieldName];
      if (Object.keys(docChanges).length === 0) {
        const next = { ...state.changes };
        delete next[action.documentId];
        return { changes: next };
      }
      return { changes: { ...state.changes, [action.documentId]: docChanges } };
    }
    case "REVERT_ALL":
      return { changes: {} };
    case "MARK_SAVED": {
      const next = { ...state.changes };
      for (const docId of action.documentIds) {
        delete next[docId];
      }
      return { changes: next };
    }
    default:
      return state;
  }
}

export const Editor = () => {
  const { uid: rawUid } = useParams<{ uid: string }>();
  const uid = rawUid ? decodeURIComponent(rawUid) : "";
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const client = useFetchClient();
  const queryClient = useQueryClient();

  const { settings } = usePluginSettings();
  const { data: locales } = useLocales();
  const { translate, save } = useTranslation();
  const isMobile = useIsMobile();

  const [targetLocale, setTargetLocale] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<
    string | undefined
  >();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);
  const [translatingField, setTranslatingField] = useState<
    string | undefined
  >();
  const [isTranslatingEntry, setIsTranslatingEntry] = useState(false);
  const [lastCharsUsed, setLastCharsUsed] = useState<number | undefined>();
  const { remainingBalance, updateBalance } = useBalance();
  const [draftState, dispatch] = useReducer(draftReducer, { changes: {} });

  // Initialize target locale
  useEffect(() => {
    if (settings?.lastTargetLocale) {
      setTargetLocale(settings.lastTargetLocale);
    } else if (locales) {
      const nonDefault = locales.find((l) => !l.isDefault);
      if (nonDefault) setTargetLocale(nonDefault.code);
    }
  }, [settings?.lastTargetLocale, locales]);

  const PAGE_SIZE = 50;

  // Fetch entries
  const {
    data: entriesPages,
    isLoading,
    refetch: refetchEntries,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    ["ai-translator", "entries", uid, targetLocale, debouncedSearch],
    async ({ pageParam = 1 }) => {
      if (!uid || !targetLocale) return null;
      return fetchEntries(client, uid, targetLocale, {
        search: debouncedSearch || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      });
    },
    {
      enabled: !!uid && !!targetLocale,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      getNextPageParam: (lastPage: any) =>
        lastPage?.pagination?.hasNextPage
          ? lastPage.pagination.page + 1
          : undefined,
    },
  );

  const entries: Entry[] =
    entriesPages?.pages?.flatMap((p: any) => p?.entries || []) || [];
  const localizableFields = entriesPages?.pages?.[0]?.localizableFields || [];
  const contentType = entriesPages?.pages?.[0]?.contentType;

  // Build a lookup from the base localizable fields list.
  // For the selected entry, include any extra indexed keys (e.g. blocks[0].body)
  // that exist in fieldValues but are not in the base localizableFields.
  const selectedEntry = entries.find(
    (e) => e.documentId === selectedDocumentId,
  );

  const displayLocalizableFields = useMemo(() => {
    if (!selectedEntry) return localizableFields;
    const knownNames = new Set(localizableFields.map((f: any) => f.name));
    const extra = Object.keys(selectedEntry.fields)
      .filter((key) => !knownNames.has(key))
      .map((key) => ({ name: key, type: "text", required: false }));
    return [...localizableFields, ...extra];
  }, [selectedEntry, localizableFields]);

  // Select first entry if none selected
  useEffect(() => {
    if (entries.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(entries[0].documentId);
    }
  }, [entries, selectedDocumentId]);

  const modifiedDocumentIds = new Set(Object.keys(draftState.changes));

  const primaryFieldName = localizableFields.find(
    (f: any) => f.type === "string",
  )?.name;

  const handleFieldChange = useCallback(
    (fieldName: string, value: string) => {
      if (!selectedDocumentId) return;
      dispatch({
        type: "SET_FIELD",
        documentId: selectedDocumentId,
        fieldName,
        value,
      });
    },
    [selectedDocumentId],
  );

  const handleTranslateEntry = useCallback(async () => {
    if (!selectedDocumentId || !uid || !targetLocale) return;
    setIsTranslatingEntry(true);
    setLastCharsUsed(undefined);

    translate.mutate(
      { uid, documentId: selectedDocumentId, targetLocale },
      {
        onSuccess: (result) => {
          if (result.translations) {
            dispatch({
              type: "SET_TRANSLATED",
              documentId: selectedDocumentId,
              translations: result.translations,
            });
            setLastCharsUsed(result.charsUsed);
            if (result.remainingBalance != null)
              updateBalance(result.remainingBalance);
          } else {
            toggleNotification({
              type: "warning",
              message: result.message || "Translation failed",
            });
          }
          setIsTranslatingEntry(false);
        },
        onError: (err: any) => {
          const status = err?.status;
          if (status === 402) {
            toggleNotification({
              type: "warning",
              message: formatMessage({
                id: getTrad("notification.insufficientBalance"),
                defaultMessage: `Insufficient balance. Upgrade your plan or renew early at ${URLS.PRICING}`,
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
            toggleNotification({ type: "warning", message: err.message || "Translation failed" });
          }
          setIsTranslatingEntry(false);
        },
      },
    );
  }, [
    selectedDocumentId,
    uid,
    targetLocale,
    translate,
    toggleNotification,
    formatMessage,
  ]);

  const handleTranslateField = useCallback(
    async (fieldName: string) => {
      if (!selectedDocumentId || !uid || !targetLocale) return;
      setTranslatingField(fieldName);
      setLastCharsUsed(undefined);

      translate.mutate(
        {
          uid,
          documentId: selectedDocumentId,
          targetLocale,
          fields: [fieldName],
        },
        {
          onSuccess: (result) => {
            if (result.translations) {
              dispatch({
                type: "SET_TRANSLATED",
                documentId: selectedDocumentId,
                translations: result.translations,
              });
              setLastCharsUsed(result.charsUsed);
              if (result.remainingBalance != null)
                updateBalance(result.remainingBalance);
            } else {
              toggleNotification({
                type: "warning",
                message: result.message || "Translation failed",
              });
            }
            setTranslatingField(undefined);
          },
          onError: (err: any) => {
            const status = err?.status;
            if (status === 402) {
              toggleNotification({
                type: "warning",
                message: formatMessage({
                  id: getTrad("notification.insufficientBalance"),
                  defaultMessage: `Insufficient balance. Upgrade your plan or renew early at ${URLS.PRICING}`,
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
              toggleNotification({ type: "warning", message: err.message || "Translation failed" });
            }
            setTranslatingField(undefined);
          },
        },
      );
    },
    [
      selectedDocumentId,
      uid,
      targetLocale,
      translate,
      toggleNotification,
      formatMessage,
    ],
  );

  const handleRevertField = useCallback(
    (fieldName: string) => {
      if (!selectedDocumentId) return;
      dispatch({
        type: "REVERT_FIELD",
        documentId: selectedDocumentId,
        fieldName,
      });
    },
    [selectedDocumentId],
  );

  const handleSaveAll = useCallback(async () => {
    const docIds = Object.keys(draftState.changes);
    if (docIds.length === 0) return;

    try {
      for (const docId of docIds) {
        const fields = draftState.changes[docId];
        if (Object.keys(fields).length === 0) continue;

        await save.mutateAsync({
          uid,
          documentId: docId,
          targetLocale,
          fields,
        });
      }

      dispatch({ type: "MARK_SAVED", documentIds: docIds });
      queryClient.invalidateQueries(["ai-translator"]);
      refetchEntries();

      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTrad("notification.saved"),
          defaultMessage: "Translations saved successfully",
        }),
      });
    } catch (err: any) {
      toggleNotification({
        type: "warning",
        message: err.message || "Save failed",
      });
    }
  }, [
    draftState.changes,
    uid,
    targetLocale,
    save,
    queryClient,
    refetchEntries,
    toggleNotification,
    formatMessage,
  ]);

  const handleCancel = useCallback(() => {
    dispatch({ type: "REVERT_ALL" });
  }, []);

  const hasUnsavedChanges = Object.keys(draftState.changes).length > 0;

  // Block in-app navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname,
  );

  // Warn on browser tab/window close
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (isLoading) return <Page.Loading />;

  const draftValuesForSelected = selectedDocumentId
    ? draftState.changes[selectedDocumentId] || {}
    : {};

  return (
    <>
      <Layouts.Root>
        <Page.Title>
          {formatMessage(
            { id: getTrad("editor.title"), defaultMessage: "Edit: {name}" },
            { name: contentType?.displayName || uid },
          )}
        </Page.Title>
        <Page.Main>
          <Layouts.Header
            title={contentType?.displayName || uid}
            subtitle={formatMessage(
              {
                id: getTrad("editor.subtitle"),
                defaultMessage: "{count} entries",
              },
              { count: entries.length },
            )}
            navigationAction={
              <Link
                style={{
                  justifyContent: "flex-start",
                  paddingLeft: 0,
                  width: "min-content",
                }}
                startIcon={<ArrowLeft />}
                onClick={() => navigate("..")}
              >
                {formatMessage({
                  id: getTrad("editor.back"),
                  defaultMessage: "Back",
                })}
              </Link>
            }
            primaryAction={
              <Flex gap={2}>
                <Button
                  variant="tertiary"
                  onClick={handleCancel}
                  disabled={modifiedDocumentIds.size === 0}
                >
                  {formatMessage({
                    id: getTrad("editor.cancelChanges"),
                    defaultMessage: "Cancel changes",
                  })}
                </Button>
                <Button
                  startIcon={<Check />}
                  onClick={handleSaveAll}
                  disabled={modifiedDocumentIds.size === 0}
                  loading={save.isLoading}
                >
                  {formatMessage(
                    {
                      id: getTrad("editor.save"),
                      defaultMessage: "Save ({count})",
                    },
                    { count: modifiedDocumentIds.size },
                  )}
                </Button>
              </Flex>
            }
          />

          <Layouts.Content>
            <Box paddingBottom={4}>
              <Flex gap={4} justifyContent="space-between" alignItems="center">
                {locales && (
                  <LanguageSelector
                    locales={locales}
                    value={targetLocale}
                    onChange={setTargetLocale}
                  />
                )}
                <QuotaDisplay remainingBalance={remainingBalance} />
              </Flex>
            </Box>

            <Divider />

            <Box paddingTop={4}>
              <Flex
                gap={4}
                alignItems="flex-start"
                direction={isMobile ? "column" : "row"}
                style={{ width: "100%" }}
              >
                {/* Left sidebar: entry list */}
                <Box
                  style={
                    isMobile
                      ? { width: "100%" }
                      : { width: "320px", flexShrink: 0 }
                  }
                >
                  <Box style={{ flex: 1 }} marginBottom={4}>
                    <TextInput
                      placeholder={formatMessage({
                        id: getTrad("editor.search"),
                        defaultMessage: "Search entries...",
                      })}
                      value={search}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSearch(e.target.value)
                      }
                      size="S"
                      aria-label="Search"
                    />
                  </Box>
                  <EntryList
                    entries={entries}
                    selectedDocumentId={selectedDocumentId}
                    onSelect={setSelectedDocumentId}
                    modifiedDocumentIds={modifiedDocumentIds}
                    primaryFieldName={primaryFieldName}
                    onLoadMore={fetchNextPage}
                    hasNextPage={!!hasNextPage}
                    isLoadingMore={isFetchingNextPage}
                  />
                </Box>

                {/* Right panel: field editor */}
                <Box style={{ width: "100%" }}>
                  {selectedEntry ? (
                    <FieldEditor
                      localizableFields={displayLocalizableFields}
                      fieldValues={selectedEntry.fields}
                      draftValues={draftValuesForSelected}
                      onFieldChange={handleFieldChange}
                      onTranslateField={handleTranslateField}
                      onTranslateEntry={handleTranslateEntry}
                      onRevertField={handleRevertField}
                      translatingField={translatingField}
                      isTranslatingEntry={isTranslatingEntry}
                      lastCharsUsed={lastCharsUsed}
                    />
                  ) : (
                    <Box padding={6} background="neutral100" hasRadius>
                      <Typography variant="omega" textColor="neutral500">
                        {formatMessage({
                          id: getTrad("editor.selectEntry"),
                          defaultMessage:
                            "Select an entry from the list to edit translations",
                        })}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Flex>
            </Box>
          </Layouts.Content>
        </Page.Main>
      </Layouts.Root>

      {blocker.state === "blocked" && (
        <Dialog.Root open onOpenChange={() => blocker.reset?.()}>
          <Dialog.Content>
            <Dialog.Header>
              {formatMessage({
                id: "app.components.ConfirmDialog.title",
                defaultMessage: "Confirmation",
              })}
            </Dialog.Header>
            <Dialog.Body
              icon={
                <WarningCircle width="24px" height="24px" fill="danger600" />
              }
              textAlign="center"
            >
              {formatMessage({
                id: "global.prompt.unsaved",
                defaultMessage:
                  "Are you sure you want to leave this page? All your modifications will be lost.",
              })}
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Cancel>
                <Button variant="tertiary" fullWidth>
                  {formatMessage({
                    id: "app.components.Button.cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
              </Dialog.Cancel>
              <Button
                variant="danger"
                fullWidth
                onClick={() => blocker.proceed?.()}
              >
                {formatMessage({
                  id: "app.components.Button.confirm",
                  defaultMessage: "Confirm",
                })}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </>
  );
};
