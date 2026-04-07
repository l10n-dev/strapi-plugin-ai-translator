import { useState } from 'react';
import {
  Box,
  Typography,
  Textarea,
  TextInput,
  Button,
  Flex,
  Checkbox,
  Badge,
} from '@strapi/design-system';
import { Play, ArrowClockwise } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { getTrad } from '../utils/getTrad';

interface LocalizableField {
  name: string;
  type: string;
  required: boolean;
}

interface FieldValues {
  source: string;
  target: string;
}

interface FieldEditorProps {
  localizableFields: LocalizableField[];
  fieldValues: Record<string, FieldValues>;
  draftValues: Record<string, string>;
  onFieldChange: (fieldName: string, value: string) => void;
  onTranslateField: (fieldName: string) => void;
  onRevertField: (fieldName: string) => void;
  translatingField?: string;
  lastCharsUsed?: number;
}

export const FieldEditor = ({
  localizableFields,
  fieldValues,
  draftValues,
  onFieldChange,
  onTranslateField,
  onRevertField,
  translatingField,
  lastCharsUsed,
}: FieldEditorProps) => {
  const { formatMessage } = useIntl();
  const [hideSource, setHideSource] = useState(false);

  const isLongText = (type: string) =>
    type === 'text' || type === 'richtext' || type === 'blocks';

  return (
    <Box>
      <Flex justifyContent="flex-end" paddingBottom={3}>
        <Checkbox
          checked={hideSource}
          onCheckedChange={() => setHideSource(!hideSource)}
        >
          {formatMessage({
            id: getTrad('editor.hideSource'),
            defaultMessage: 'Hide source',
          })}
        </Checkbox>
      </Flex>

      <Flex direction="column" gap={4}>
        {localizableFields.map((field) => {
          const source = fieldValues[field.name]?.source ?? '';
          const savedTarget = fieldValues[field.name]?.target ?? '';
          const currentTarget = draftValues[field.name] ?? savedTarget;
          const isModified = currentTarget !== savedTarget;
          const isTranslating = translatingField === field.name;

          return (
            <Box key={field.name} padding={4} background="neutral0" hasRadius shadow="filterShadow">
              <Flex justifyContent="space-between" alignItems="center" paddingBottom={2}>
                <Flex gap={2} alignItems="center">
                  <Typography variant="sigma" textColor="neutral600">
                    {field.name}
                  </Typography>
                  <Typography variant="pi" textColor="neutral400">
                    ({field.type})
                  </Typography>
                  {isModified && (
                    <Badge active backgroundColor="warning100" textColor="warning700">
                      modified
                    </Badge>
                  )}
                  {isTranslating && lastCharsUsed !== undefined && (
                    <Badge active backgroundColor="primary100" textColor="primary700">
                      {lastCharsUsed} chars used
                    </Badge>
                  )}
                </Flex>
                <Flex gap={1}>
                  <Button
                    variant="tertiary"
                    size="S"
                    startIcon={<Play />}
                    onClick={() => onTranslateField(field.name)}
                    loading={isTranslating}
                    disabled={!source || isTranslating}
                  >
                    {formatMessage({
                      id: getTrad('editor.translate'),
                      defaultMessage: 'Translate',
                    })}
                  </Button>
                  {isModified && (
                    <Button
                      variant="tertiary"
                      size="S"
                      startIcon={<ArrowClockwise />}
                      onClick={() => onRevertField(field.name)}
                    >
                      {formatMessage({
                        id: getTrad('editor.revert'),
                        defaultMessage: 'Revert',
                      })}
                    </Button>
                  )}
                </Flex>
              </Flex>

              <Flex gap={4}>
                {!hideSource && (
                  <Box flex="1" style={{ flex: 1 }}>
                    <Typography variant="pi" textColor="neutral500" paddingBottom={1}>
                      Source
                    </Typography>
                    {isLongText(field.type) ? (
                      <Textarea
                        value={source}
                        disabled
                        style={{ minHeight: '120px' }}
                        aria-label={`${field.name} source`}
                      />
                    ) : (
                      <TextInput value={source} disabled aria-label={`${field.name} source`} />
                    )}
                  </Box>
                )}

                <Box flex="1" style={{ flex: 1 }}>
                  <Typography variant="pi" textColor="neutral500" paddingBottom={1}>
                    Target
                  </Typography>
                  {isLongText(field.type) ? (
                    <Textarea
                      value={currentTarget}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        onFieldChange(field.name, e.target.value)
                      }
                      style={{ minHeight: '120px' }}
                      aria-label={`${field.name} target`}
                    />
                  ) : (
                    <TextInput
                      value={currentTarget}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onFieldChange(field.name, e.target.value)
                      }
                      aria-label={`${field.name} target`}
                    />
                  )}
                </Box>
              </Flex>
            </Box>
          );
        })}
      </Flex>
    </Box>
  );
};
