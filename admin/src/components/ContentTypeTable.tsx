import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Typography,
  Badge,
  Flex,
  IconButton,
  Button,
} from '@strapi/design-system';
import { Pencil, Play } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { getTrad } from '../utils/getTrad';
import PLUGIN_ID from '../pluginId';

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

  const allSelected = contentTypes.length > 0 && selectedUids.length === contentTypes.length;

  const getStatus = (ct: ContentType) => {
    if (translatingUid === ct.uid) return 'translating';
    if (ct.totalEntries === 0) return 'empty';
    if (ct.translatedEntries >= ct.totalEntries) return 'upToDate';
    if (ct.translatedEntries > 0) return 'partial';
    return 'notTranslated';
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'translating':
        return <Badge active>Translating...</Badge>;
      case 'upToDate':
        return <Badge active backgroundColor="success100" textColor="success700">Up to date</Badge>;
      case 'partial':
        return <Badge active backgroundColor="warning100" textColor="warning700">Partial</Badge>;
      case 'empty':
        return <Badge active backgroundColor="neutral150" textColor="neutral600">Empty</Badge>;
      default:
        return <Badge active backgroundColor="danger100" textColor="danger700">Not translated</Badge>;
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
              {formatMessage({ id: getTrad('table.category'), defaultMessage: 'Category' })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({ id: getTrad('table.type'), defaultMessage: 'Type' })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({ id: getTrad('table.translated'), defaultMessage: 'Translated' })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({ id: getTrad('table.status'), defaultMessage: 'Status' })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({ id: getTrad('table.actions'), defaultMessage: 'Actions' })}
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
                  {ct.kind === 'singleType' ? 'Single' : 'Collection'}
                </Typography>
              </Td>
              <Td>
                <Typography textColor="neutral800">
                  {ct.translatedEntries}/{ct.totalEntries}
                </Typography>
              </Td>
              <Td>{statusBadge(status)}</Td>
              <Td>
                <Flex gap={1}>
                  <IconButton
                    onClick={() => navigate(`editor/${encodeURIComponent(ct.uid)}`)}
                    label="Edit"
                    variant="ghost"
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    onClick={() => onTranslate(ct.uid)}
                    label="Translate"
                    variant="ghost"
                    disabled={status === 'translating' || ct.totalEntries === 0}
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
