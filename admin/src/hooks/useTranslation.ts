import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  translateEntry,
  translateBulk,
  saveTranslation,
  fetchBulkStatus,
  cancelBulk,
} from '../utils/api';
import { useState, useEffect, useCallback, useRef } from 'react';

interface TranslateResult {
  status: 'success' | 'error';
  reason?: string;
  message?: string;
  translations?: Record<string, string>;
  charsUsed?: number;
  remainingBalance?: number;
}

interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  status: 'idle' | 'running' | 'completed' | 'stopped';
  stopReason?: 'insufficientBalance' | 'unauthorized';
  errors: Array<{ documentId: string; error: string }>;
  remainingBalance?: number;
}

export const useTranslation = () => {
  const client = useFetchClient();
  const queryClient = useQueryClient();

  const translateMutation = useMutation<
    TranslateResult,
    Error,
    { uid: string; documentId: string; targetLocale: string; incremental?: boolean; fields?: string[] }
  >(
    async (params) => {
      const data = await translateEntry(client, params);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ai-translator', 'content-types']);
      },
    }
  );

  const bulkMutation = useMutation<
    any,
    Error,
    { uids: string[]; targetLocale: string; incremental?: boolean }
  >(async (params) => {
    const data = await translateBulk(client, params);
    return data;
  }, {
    onMutate: () => {
      queryClient.removeQueries(['ai-translator', 'bulk-status']);
    },
  });

  const saveMutation = useMutation<
    any,
    Error,
    { uid: string; documentId: string; targetLocale: string; fields: Record<string, string> }
  >(
    async (params) => {
      const data = await saveTranslation(client, params);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ai-translator']);
      },
    }
  );

  const cancelMutation = useMutation(async () => {
    return cancelBulk(client);
  });

  return {
    translate: translateMutation,
    translateBulk: bulkMutation,
    save: saveMutation,
    cancel: cancelMutation,
  };
};

export const useBulkProgress = (polling: boolean) => {
  const client = useFetchClient();

  return useQuery<BulkProgress>(
    ['ai-translator', 'bulk-status'],
    async () => {
      const data = await fetchBulkStatus(client);
      return data;
    },
    {
      refetchInterval: polling ? 2000 : false,
      enabled: polling,
    }
  );
};
