import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Typography,
  Box,
  Flex,
  IconButton,
} from "@strapi/design-system";
import { Pencil, Play } from "@strapi/icons";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { getTrad } from "../utils/getTrad";

interface ContentType {
  uid: string;
  kind: string;
  displayName: string;
  totalEntries: number;
  translatedEntries: number;
}

interface ContentTypeTableProps {
  contentTypes: ContentType[];
  selectedUids: string[];
  onToggleSelect: (uid: string) => void;
  onSelectAll: (selected: boolean) => void;
  onTranslate: (uid: string) => void;
  translatingUid?: string;
}

export const ContentTypeTable = ({
  contentTypes,
  selectedUids,
  onToggleSelect,
  onSelectAll,
  onTranslate,
  translatingUid,
}: ContentTypeTableProps) => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  const allSelected =
    contentTypes.length > 0 && selectedUids.length === contentTypes.length;

  const getStatus = (ct: ContentType) => {
    if (translatingUid === ct.uid) return "translating";
    if (ct.totalEntries === 0) return "empty";
    if (ct.translatedEntries >= ct.totalEntries) return "upToDate";
    if (ct.translatedEntries > 0) return "partial";
    return "notTranslated";
  };

  const pill = (bg: string, color: string, label: string) => (
    <Box
      background={bg}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      borderRadius="4px"
      display="inline-block"
    >
      <Typography variant="pi" fontWeight="bold" textColor={color}>
        {label}
      </Typography>
    </Box>
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case "translating":
        return pill(
          "primary100",
          "primary700",
          formatMessage({
            id: getTrad("table.status.translating"),
            defaultMessage: "Translating...",
          }),
        );
      case "upToDate":
        return pill(
          "success100",
          "success700",
          formatMessage({
            id: getTrad("table.status.upToDate"),
            defaultMessage: "Up to date",
          }),
        );
      case "partial":
        return pill(
          "warning100",
          "warning700",
          formatMessage({
            id: getTrad("table.status.partial"),
            defaultMessage: "Partial",
          }),
        );
      case "empty":
        return pill(
          "neutral150",
          "neutral600",
          formatMessage({
            id: getTrad("table.status.empty"),
            defaultMessage: "Empty",
          }),
        );
      default:
        return pill(
          "danger100",
          "danger700",
          formatMessage({
            id: getTrad("table.status.notTranslated"),
            defaultMessage: "Not translated",
          }),
        );
    }
  };

  return (
    <Table colCount={6} rowCount={contentTypes.length + 1}>
      <Thead>
        <Tr>
          <Th>
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked: boolean) => onSelectAll(checked)}
              aria-label="Select all"
            />
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({
                id: getTrad("table.category"),
                defaultMessage: "Category",
              })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({
                id: getTrad("table.type"),
                defaultMessage: "Type",
              })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({
                id: getTrad("table.translated"),
                defaultMessage: "Translated",
              })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({
                id: getTrad("table.status"),
                defaultMessage: "Status",
              })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({
                id: getTrad("table.actions"),
                defaultMessage: "Actions",
              })}
            </Typography>
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        {contentTypes.map((ct) => {
          const status = getStatus(ct);
          return (
            <Tr key={ct.uid}>
              <Td>
                <Checkbox
                  checked={selectedUids.includes(ct.uid)}
                  onCheckedChange={() => onToggleSelect(ct.uid)}
                  aria-label={`Select ${ct.displayName}`}
                />
              </Td>
              <Td>
                <Typography textColor="neutral800" fontWeight="bold">
                  {ct.displayName}
                </Typography>
              </Td>
              <Td>
                <Typography textColor="neutral600">
                  {ct.kind === "singleType" ? "Single" : "Collection"}
                </Typography>
              </Td>
              <Td>
                <Typography textColor="neutral800">
                  {ct.translatedEntries}/{ct.totalEntries}
                </Typography>
              </Td>
              <Td minWidth="120px">{statusBadge(status)}</Td>
              <Td>
                <Flex gap={1}>
                  <IconButton
                    onClick={() =>
                      navigate(`editor/${encodeURIComponent(ct.uid)}`)
                    }
                    label="Edit"
                    variant="ghost"
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    onClick={() => onTranslate(ct.uid)}
                    label="Translate"
                    variant="ghost"
                    disabled={status === "translating" || ct.totalEntries === 0}
                  >
                    <Play />
                  </IconButton>
                </Flex>
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};
