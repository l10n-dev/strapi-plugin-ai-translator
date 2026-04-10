import { Box, Typography, Flex, Badge } from "@strapi/design-system";
import { styled } from "styled-components";

interface Entry {
  documentId: string;
  fields: Record<string, { source: string; target: string }>;
  hasTarget: boolean;
}

interface EntryListProps {
  entries: Entry[];
  selectedDocumentId?: string;
  onSelect: (documentId: string) => void;
  modifiedDocumentIds: Set<string>;
  primaryFieldName?: string;
}

const EntryItem = styled(Box)<{ $active?: boolean }>`
  cursor: pointer;
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary100 : "transparent"};
  &:hover {
    background: ${({ theme, $active }) =>
      $active ? theme.colors.primary100 : theme.colors.neutral100};
  }
`;

export const EntryList = ({
  entries,
  selectedDocumentId,
  onSelect,
  modifiedDocumentIds,
  primaryFieldName,
}: EntryListProps) => {
  const getDisplayText = (entry: Entry) => {
    if (primaryFieldName && entry.fields[primaryFieldName]) {
      const val = entry.fields[primaryFieldName].source;
      if (val) return val.length > 60 ? val.slice(0, 60) + "..." : val;
    }
    const firstField = Object.values(entry.fields)[0];
    if (firstField?.source) {
      const val = firstField.source;
      return val.length > 60 ? val.slice(0, 60) + "..." : val;
    }
    return entry.documentId.slice(0, 12) + "...";
  };

  return (
    <Box
      background="neutral0"
      hasRadius
      borderColor="neutral150"
      style={{ overflowY: "auto", maxHeight: "calc(100vh - 270px)" }}
    >
      {entries.map((entry) => (
        <EntryItem
          key={entry.documentId}
          padding={3}
          $active={selectedDocumentId === entry.documentId}
          onClick={() => onSelect(entry.documentId)}
        >
          <Flex justifyContent="space-between" alignItems="center">
            <Typography
              variant="omega"
              textColor={
                selectedDocumentId === entry.documentId
                  ? "primary700"
                  : "neutral800"
              }
              fontWeight={
                selectedDocumentId === entry.documentId ? "bold" : "regular"
              }
              ellipsis
            >
              {getDisplayText(entry)}
            </Typography>
            <Flex gap={1}>
              {modifiedDocumentIds.has(entry.documentId) && (
                <Badge
                  active
                  backgroundColor="warning100"
                  textColor="warning700"
                >
                  unsaved
                </Badge>
              )}
              {!entry.hasTarget && (
                <Badge
                  active
                  backgroundColor="neutral150"
                  textColor="neutral600"
                >
                  new
                </Badge>
              )}
            </Flex>
          </Flex>
        </EntryItem>
      ))}
      {entries.length === 0 && (
        <Box padding={4}>
          <Typography variant="omega" textColor="neutral500">
            No entries found
          </Typography>
        </Box>
      )}
    </Box>
  );
};
