const API_BASE = `/ai-translator`;

export const pluginRequest = async (
  fetchClient: { get: Function; post: Function; put: Function; del: Function },
  method: "get" | "post" | "put" | "del",
  path: string,
  data?: any,
  params?: Record<string, string>,
) => {
  const url = `${API_BASE}${path}`;
  if (method === "get") {
    const response = await fetchClient.get(url, { params });
    return response.data;
  }
  if (method === "del") {
    const response = await fetchClient.del(url);
    return response.data;
  }
  const response = await fetchClient[method](url, data);
  return response.data;
};

// Settings
export const fetchSettings = (client: any) =>
  pluginRequest(client, "get", "/settings");

export const updateSettings = (client: any, data: any) =>
  pluginRequest(client, "put", "/settings", data);

// Content types
export const fetchContentTypes = (client: any, locale?: string) =>
  pluginRequest(
    client,
    "get",
    "/content-types",
    undefined,
    locale ? { locale } : undefined,
  );

export const fetchEntries = (
  client: any,
  uid: string,
  locale: string,
  params?: { page?: number; pageSize?: number; search?: string },
) =>
  pluginRequest(
    client,
    "get",
    `/content-types/${encodeURIComponent(uid)}/entries`,
    undefined,
    {
      locale,
      ...(params?.page ? { page: String(params.page) } : {}),
      ...(params?.pageSize ? { pageSize: String(params.pageSize) } : {}),
      ...(params?.search ? { search: params.search } : {}),
    },
  );

export const fetchEntry = (
  client: any,
  uid: string,
  documentId: string,
  locale: string,
) =>
  pluginRequest(
    client,
    "get",
    `/content-types/${encodeURIComponent(uid)}/entries/${documentId}`,
    undefined,
    { locale },
  );

// Translation
export const translateEntry = (
  client: any,
  data: {
    uid: string;
    documentId: string;
    targetLocale: string;
    incremental?: boolean;
    generateGlossary?: boolean;
    fields?: string[];
  },
) => pluginRequest(client, "post", "/translate", data);

export const translateBulk = (
  client: any,
  data: {
    uids: string[];
    targetLocale: string;
    incremental?: boolean;
    generateGlossary?: boolean;
  },
) => pluginRequest(client, "post", "/translate/bulk", data);

export const saveTranslation = (
  client: any,
  data: {
    uid: string;
    documentId: string;
    targetLocale: string;
    fields: Record<string, string>;
  },
) => pluginRequest(client, "post", "/translate/save", data);

export const fetchBulkStatus = (client: any) =>
  pluginRequest(client, "get", "/translate/status");

export const cancelBulk = (client: any) =>
  pluginRequest(client, "post", "/translate/cancel");

export const fetchBalance = (client: any) =>
  pluginRequest(client, "get", "/balance");
