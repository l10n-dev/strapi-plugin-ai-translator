import { useQuery, useQueryClient } from "react-query";
import { useFetchClient } from "@strapi/strapi/admin";
import { fetchBalance } from "../utils/api";
import { usePluginSettings } from "./usePluginSettings";

export const BALANCE_QUERY_KEY = ["ai-translator", "balance"];

interface BalanceData {
  currentBalance?: number;
  error?: string;
}

export const useBalance = () => {
  const client = useFetchClient();
  const queryClient = useQueryClient();
  const { settings } = usePluginSettings();

  const query = useQuery<BalanceData>(
    BALANCE_QUERY_KEY,
    () => fetchBalance(client),
    {
      enabled: !!settings?.hasApiKey,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
  );

  const updateBalance = (currentBalance: number) => {
    queryClient.setQueryData<BalanceData>(BALANCE_QUERY_KEY, {
      currentBalance,
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries(BALANCE_QUERY_KEY);
  };

  const remainingBalance =
    query.data && !query.data.error ? query.data.currentBalance : undefined;

  return { remainingBalance, updateBalance, invalidate };
};
