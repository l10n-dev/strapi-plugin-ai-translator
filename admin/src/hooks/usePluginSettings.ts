import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useFetchClient } from '@strapi/strapi/admin';
import { fetchSettings, updateSettings } from '../utils/api';

interface PluginSettings {
  apiKey: string;
  hasApiKey: boolean;
  selectedCategories: string[];
  incremental: boolean;
  lastTargetLocale: string;
}

export const usePluginSettings = () => {
  const client = useFetchClient();
  const queryClient = useQueryClient();

  const query = useQuery<PluginSettings>(
    ['ai-translator', 'settings'],
    async () => {
      const data = await fetchSettings(client);
      return data;
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const mutation = useMutation<PluginSettings, Error, Partial<PluginSettings>>(
    async (updates) => {
      const data = await updateSettings(client, updates);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ai-translator', 'settings']);
      },
    }
  );

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isUpdating: mutation.isLoading,
  };
};
