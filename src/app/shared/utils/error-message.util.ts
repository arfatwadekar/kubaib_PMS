/**
 * Extracts a user-friendly error message from an HTTP error.
 *
 * Prefers the backend-provided message (supports plain string bodies,
 * `{ message }`, `{ detail }`, `{ title }`, `{ error }`, and ASP.NET
 * ModelState-style `{ errors: { field: string[] } }` shapes). Falls back to
 * a friendly per-status message, and only then to `fallback` — it never
 * surfaces Angular's technical `HttpErrorResponse.message`/`statusText`
 * (e.g. "Http failure response for .../api/x: 404 Not Found"), since those
 * read as raw status codes to the user.
 */
export function getErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const httpErr = err as { status?: number; error?: unknown } | null | undefined;

  const backendMessage = extractBackendMessage(httpErr?.error);
  if (backendMessage) return backendMessage;

  return getDefaultMessageForStatus(httpErr?.status, fallback);
}

function extractBackendMessage(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body.trim() || null;
  if (typeof body !== 'object') return null;

  const b = body as Record<string, unknown>;

  for (const key of ['message', 'detail', 'title', 'error']) {
    const value = b[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  // ASP.NET validation errors: { errors: { Field: ['msg1', 'msg2'] } }
  if (b['errors'] && typeof b['errors'] === 'object') {
    const messages: string[] = [];
    for (const value of Object.values(b['errors'] as Record<string, unknown>)) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (typeof item === 'string' && item.trim()) messages.push(item.trim());
      }
    }
    if (messages.length) return messages.join(' ');
  }

  return null;
}

function getDefaultMessageForStatus(status: number | undefined, fallback: string): string {
  switch (status) {
    case 0:
      return 'Network error. Please check your internet connection.';
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Your session has expired. Please login again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested record was not found.';
    case 409:
      return 'This record already exists or conflicts with existing data.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 500:
    case 502:
    case 503:
      return 'Server error. Please try again in a moment.';
    default:
      return fallback;
  }
}
