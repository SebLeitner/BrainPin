const DEFAULT_API_BASE_URL = "https://aw493hkv29.execute-api.eu-central-1.amazonaws.com";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");

export type ApiLinkPayload = {
  name: string;
  url: string;
  categoryId: string;
  description?: string | null;
};

type ApiLinkResponse = {
  id: string;
  name: string;
  url: string;
  categoryId: string;
  description?: string;
};

type ListLinksResponse = {
  links: ApiLinkResponse[];
};

type LinkResponse = {
  link: ApiLinkResponse;
};

const isJsonResponse = (response: Response) => {
  const contentType = response.headers.get("content-type");
  return contentType ? contentType.includes("application/json") : false;
};

const extractErrorMessage = async (response: Response) => {
  if (!isJsonResponse(response)) {
    return `API request failed with status ${response.status}`;
  }

  try {
    const body = await response.json();
    if (body && typeof body.message === "string" && body.message.trim() !== "") {
      return body.message;
    }
  } catch (error) {
    console.error("Failed to parse error response", error);
  }

  return `API request failed with status ${response.status}`;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error("API endpoint is not configured");
  }

  const requestUrl = `${apiBaseUrl}${path}`;
  if (process.env.NODE_ENV !== "production") {
    console.log("[api] →", requestUrl, init);
  }

  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    mode: "cors"
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[api] ←", requestUrl, response.status, response.statusText);
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isJsonResponse(response)) {
    throw new Error("API returned an unexpected response format");
  }

  return (await response.json()) as T;
};

export const linkApi = {
  list: async () => {
    const data = await request<ListLinksResponse>("/links");
    return data.links;
  },
  create: async (payload: ApiLinkPayload) => {
    const data = await request<LinkResponse>("/links", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return data.link;
  },
  update: async (linkId: string, payload: Partial<ApiLinkPayload>) => {
    const data = await request<LinkResponse>(`/links/${linkId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    return data.link;
  },
  remove: async (linkId: string) => {
    await request<void>(`/links/${linkId}`, { method: "DELETE" });
  }
};

export const apiConfig = {
  baseUrl: apiBaseUrl
};
