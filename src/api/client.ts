import { API_BASE_URL } from "@/constants/config";

// Thin fetch wrapper. Deliberately does NOT fabricate fallback data on
// failure — callers must handle `ApiError` and render an empty/error state,
// per the "no dummy data" principle in docs/PROJECT_CONTEXT.md.

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;

  let activeToken = token;
  if (!activeToken) {
    try {
      activeToken = (await AsyncStorage.getItem("auth_token")) || undefined;
    } catch {
      // Ignore
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    throw new ApiError("Network request failed. Check your connection.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore — non-JSON error body
    }
    throw new ApiError(message, response.status);
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, token?: string) => request<T>(path, { method: "GET", token }),
  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, token }),
  put: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined, token }),
};
