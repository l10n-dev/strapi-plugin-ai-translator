import { useQuery } from "react-query";
import { useFetchClient } from "@strapi/strapi/admin";
import { fetchContentTypes } from "../utils/api";

interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
}

export const useLocales = () => {
  const client = useFetchClient();

  return useQuery<Locale[]>(
    ["ai-translator", "locales"],
    async () => {
      const data = await fetchContentTypes(client);
      return data.locales || [];
    },
    {
      refetchOnWindowFocus: false,
      staleTime: 60000,
    },
  );
};
