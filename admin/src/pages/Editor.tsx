import { useState, useEffect, useCallback, useReducer } from "react";
import {
  Box,
  Button,
  Flex,
  Typography,
  TextInput,
  Divider,
  Link,
} from "@strapi/design-system";
import { Page, Layouts, useNotification } from "@strapi/strapi/admin";
import { Check, ArrowLeft } from "@strapi/icons";
import { useIntl } from "react-intl";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "react-query";
import { useFetchClient } from "@strapi/strapi/admin";
import { URLS } from "ai-l10n-core";
import { getTrad } from "../utils/getTrad";
import { usePluginSettings } from "../hooks/usePluginSettings";
import { useTranslation } from "../hooks/useTranslation";
import { useLocales } from "../hooks/useLocales";
import { fetchEntries } from "../utils/api";
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

  const [targetLocale, setTargetLocale] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<
    string | undefined
  >();
  const [search, setSearch] = useState("");
  const [translatingField, setTranslatingField] = useState<
    string | undefined
  >();
  const [lastCharsUsed, setLastCharsUsed] = useState<number | undefined>();
  const [remainingBalance, setRemainingBalance] = useState<
    number | undefined
  >();
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

  // Fetch entries
  const {
    data: entriesData,
    isLoading,
    refetch: refetchEntries,
  } = useQuery(
    ["ai-translator", "entries", uid, targetLocale, search],
    async () => {
      if (!uid || !targetLocale) return null;
      return fetchEntries(client, uid, targetLocale, {
        search: search || undefined,
      });
    },
    {
      enabled: !!uid && !!targetLocale,
      refetchOnWindowFocus: false,
    },
  );

  const entries: Entry[] = entriesData?.entries || [];
  const localizableFields = entriesData?.localizableFields || [];
  const contentType = entriesData?.contentType;

  // Select first entry if none selected
  useEffect(() => {
    if (entries.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(entries[0].documentId);
    }
  }, [entries, selectedDocumentId]);

  const selectedEntry = entries.find(
    (e) => e.documentId === selectedDocumentId,
  );
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
            if (result.status === "success" && result.translations) {
              dispatch({
                type: "SET_TRANSLATED",
                documentId: selectedDocumentId,
                translations: result.translations,
              });
              setLastCharsUsed(result.charsUsed);
              setRemainingBalance(result.remainingBalance);
            } else if (result.reason === "insufficientBalance") {
              toggleNotification({
                type: "warning",
                message: formatMessage({
                  id: getTrad("notification.insufficientBalance"),
                  defaultMessage: `Insufficient balance. Purchase more at ${URLS.PRICING}`,
                }),
              });
            } else {
              toggleNotification({
                type: "warning",
                message: result.message || "Translation failed",
              });
            }
            setTranslatingField(undefined);
          },
          onError: (err) => {
            toggleNotification({ type: "warning", message: err.message });
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

  if (isLoading) return <Page.Loading />;

  const draftValuesForSelected = selectedDocumentId
    ? draftState.changes[selectedDocumentId] || {}
    : {};

  return (
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
            <Flex gap={4} alignItems="flex-start" style={{ width: "100%" }}>
              {/* Left sidebar: entry list */}
              <Box style={{ width: "320px", flexShrink: 0 }}>
                <Box style={{ flex: 1 }} marginBottom={2}>
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
                />
              </Box>

              {/* Right panel: field editor */}
              <Box style={{ flex: 1 }}>
                {selectedEntry ? (
                  <FieldEditor
                    localizableFields={localizableFields}
                    fieldValues={selectedEntry.fields}
                    draftValues={draftValuesForSelected}
                    onFieldChange={handleFieldChange}
                    onTranslateField={handleTranslateField}
                    onRevertField={handleRevertField}
                    translatingField={translatingField}
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
  );
};
