import { useQuery } from 'react-query';
import { useFetchClient } from '@strapi/strapi/admin';
import { fetchContentTypes } from '../utils/api';

interface ContentType {
  uid: string;
  kind: string;
  displayName: string;
  singularName: string;
  pluralName: string;
  localizableFields: Array<{ name: string; type: string; required: boolean }>;
  totalEntries: number;
  translatedEntries: number;
}

interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
}

interface ContentTypesResponse {
  contentTypes: ContentType[];
  locales: Locale[];
}

export const useContentTypes = (targetLocale?: string) => {
  const client = useFetchClient();

  return useQuery<ContentTypesResponse>(
    ['ai-translator', 'content-types', targetLocale],
    async () => {
      const data = await fetchContentTypes(client, targetLocale);
      return data;
    },
    {
      enabled: true,
      refetchOnWindowFocus: false,
    }
  );
};
