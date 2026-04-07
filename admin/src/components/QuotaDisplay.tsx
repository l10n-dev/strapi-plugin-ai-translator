import { Box, Typography, Flex, Badge } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { getTrad } from '../utils/getTrad';

interface QuotaDisplayProps {
  remainingBalance?: number;
}

export const QuotaDisplay = ({ remainingBalance }: QuotaDisplayProps) => {
  const { formatMessage } = useIntl();

  return (
    <Flex gap={3} alignItems="center">
      <Typography variant="pi" textColor="neutral600">
        {formatMessage({
          id: getTrad('dashboard.freeQuota'),
          defaultMessage: '30,000 characters free monthly',
        })}
      </Typography>
      {remainingBalance !== undefined && (
        <Badge active>
          {formatMessage(
            {
              id: getTrad('dashboard.remainingBalance'),
              defaultMessage: '{count} chars remaining',
            },
            { count: remainingBalance.toLocaleString() }
          )}
        </Badge>
      )}
      <Typography
        variant="pi"
        textColor="primary600"
        tag="a"
        href="https://l10n.dev/ws/keys"
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'underline' }}
      >
        {formatMessage({
          id: getTrad('dashboard.manageApiKey'),
          defaultMessage: 'Manage API Key',
        })}
      </Typography>
    </Flex>
  );
};
