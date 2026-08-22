import { clearToken, getToken } from "@/lib/auth";

export class ApiError extends Error {
  constructor(public status: number, message = "Request failed") {
    super(message);
    this.name = "ApiError";
  }
}

/** The only browser API entry point for authenticated application data. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...init, headers, credentials: "include" });
  if (response.status === 401) {
    // A stale local token used to leave protected screens blank. Clear it once,
    // tell the app, and let the route guard take the user to sign-in.
    clearToken();
    window.dispatchEvent(new CustomEvent("focusarx:auth-expired"));
    throw new ApiError(401, "Your session expired. Please sign in again.");
  }
  if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status})`);
  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>;
}
