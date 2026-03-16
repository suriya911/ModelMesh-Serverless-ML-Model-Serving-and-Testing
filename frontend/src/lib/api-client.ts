const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY || "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Keep the generic message when the response body is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };
