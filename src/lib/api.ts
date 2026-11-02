export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let activeRequests = 0;
const activityListeners = new Set<() => void>();

export function subscribeToApiActivity(listener: () => void) {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

export function hasApiActivity() {
  return activeRequests > 0;
}

function notifyActivity() {
  for (const listener of activityListeners) listener();
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  activeRequests += 1;
  notifyActivity();
  try {
    const response = await fetch(url, {
      ...init,
      headers:
        init?.body instanceof FormData
          ? init.headers
          : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!response.ok) {
      throw new ApiError(data.error || "Something went wrong.", response.status, data.code);
    }
    return data as T;
  } finally {
    activeRequests -= 1;
    notifyActivity();
  }
}

export async function uploadImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  const result = await api<{ url: string }>("/api/upload", { method: "POST", body });
  return result.url;
}
