/** Parse a fetch Response body as JSON; reject HTML error pages from Next/Vercel. */
export async function readApiJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trimStart();

  if (trimmed.startsWith("<!") || trimmed.startsWith("<")) {
    if (res.status === 504 || res.status === 502) {
      throw new Error(
        "Server timed out loading bus data. Wait a minute and try again."
      );
    }
    throw new Error(
      `Server returned an error page (${res.status}). Try refreshing.`
    );
  }

  if (!trimmed) {
    throw new Error(`Empty response from server (${res.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Could not read server response (${res.status}). Try refreshing.`
    );
  }
}

export async function fetchApi<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<{ res: Response; data: T }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  const data = await readApiJson<T>(res);
  return { res, data };
}
