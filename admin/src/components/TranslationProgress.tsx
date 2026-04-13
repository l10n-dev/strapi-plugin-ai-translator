import { Box, Typography, Flex } from "@strapi/design-system";
import { useIntl } from "react-intl";
import { getTrad } from "../utils/getTrad";

interface TranslationProgressProps {
  total: number;
  completed: number;
  failed: number;
  status: "idle" | "running" | "completed" | "stopped";
}

export const TranslationProgress = ({
  total,
  completed,
  failed,
  status,
}: TranslationProgressProps) => {
  const { formatMessage } = useIntl();

  if (status === "idle") return null;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Flex direction="column" gap={2} style={{ width: "100%" }}>
      <Flex
        style={{ width: "100%" }}
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography variant="pi" fontWeight="bold">
          {status === "running"
            ? formatMessage({
                id: getTrad("progress.translating"),
                defaultMessage: "Translating...",
              })
            : status === "completed"
            ? formatMessage({
                id: getTrad("progress.completed"),
                defaultMessage: "Translation completed",
              })
            : formatMessage({
                id: getTrad("progress.stopped"),
                defaultMessage: "Translation stopped",
              })}
        </Typography>
        <Typography variant="pi" textColor="neutral600">
          {completed}/{total} {total === 1 ? "entry" : "entries"}
          {failed > 0 && ` (${failed} failed)`}
        </Typography>
      </Flex>
      <Box
        style={{
          width: "100%",
          height: "0.4rem",
          backgroundColor: "#dcdce4",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            width: `${percentage}%`,
            height: "100%",
            backgroundColor: `${percentage === 100 ? "#22c55e" : "#4945ff"}`,
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </Box>
    </Flex>
  );
};
