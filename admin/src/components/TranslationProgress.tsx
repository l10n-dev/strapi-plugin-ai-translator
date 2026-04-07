import { Box, ProgressBar, Typography, Flex } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { getTrad } from '../utils/getTrad';

interface TranslationProgressProps {
  total: number;
  completed: number;
  failed: number;
  status: 'idle' | 'running' | 'completed' | 'halted';
}

export const TranslationProgress = ({
  total,
  completed,
  failed,
  status,
}: TranslationProgressProps) => {
  const { formatMessage } = useIntl();

  if (status === 'idle') return null;

  const percentage = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  return (
    <Box padding={4} background="neutral100" hasRadius>
      <Flex direction="column" gap={2}>
        <Flex justifyContent="space-between">
          <Typography variant="pi" fontWeight="bold">
            {status === 'running'
              ? formatMessage({
                  id: getTrad('progress.translating'),
                  defaultMessage: 'Translating...',
                })
              : status === 'completed'
                ? formatMessage({
                    id: getTrad('progress.completed'),
                    defaultMessage: 'Translation completed',
                  })
                : formatMessage({
                    id: getTrad('progress.halted'),
                    defaultMessage: 'Translation halted',
                  })}
          </Typography>
          <Typography variant="pi" textColor="neutral600">
            {completed}/{total}
            {failed > 0 && ` (${failed} failed)`}
          </Typography>
        </Flex>
        <ProgressBar value={percentage} size="S" />
      </Flex>
    </Box>
  );
};
