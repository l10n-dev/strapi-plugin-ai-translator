import { Typography, Flex, Badge, Button } from "@strapi/design-system";
import { useIntl } from "react-intl";
import { URLS } from "ai-l10n-core";
import { getTrad } from "../utils/getTrad";
import { localizeUrl } from "../utils/localizeUrl";

interface QuotaDisplayProps {
  remainingBalance?: number;
}

export const QuotaDisplay = ({ remainingBalance }: QuotaDisplayProps) => {
  const { formatMessage, locale } = useIntl();

  return (
    <Flex gap={3} alignItems="center">
      {!remainingBalance && remainingBalance !== 0 && (
        <Typography variant="pi" textColor="neutral600">
          {formatMessage(
            {
              id: getTrad("dashboard.freeQuota"),
              defaultMessage: "{count} characters free monthly",
            },
            { count: (30000).toLocaleString() },
          )}
        </Typography>
      )}
      {remainingBalance != null && remainingBalance >= 0 && (
        <Badge active>
          {formatMessage(
            {
              id: getTrad("dashboard.remainingBalance"),
              defaultMessage: "{count} chars remaining",
            },
            { count: remainingBalance.toLocaleString() },
          )}
        </Badge>
      )}
      <Button
        size="S"
        variant="secondary"
        onClick={() =>
          window.open(
            localizeUrl(URLS.PRICING, locale),
            "_blank",
            "noopener,noreferrer",
          )
        }
      >
        {formatMessage({
          id: getTrad("dashboard.buyCharacters"),
          defaultMessage: "Buy Characters",
        })}
      </Button>
    </Flex>
  );
};
