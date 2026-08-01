export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = []
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    // Normalize browser network failures for retry + UI messaging.
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Network request failed';
    throw new ApiError(0, 'NETWORK_ERROR', message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => null)) as T | ApiErrorBody | null;

  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? 'Request failed',
      body?.error?.details ?? []
    );
  }

  return data as T;
}
