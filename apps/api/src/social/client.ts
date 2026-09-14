import { HttpError } from '../shared/lib';

const ZERNIO_API_URL = 'https://zernio.com/api/v1';

export async function getZernio(path: string, query: Record<string, string>) {
  const apiKey = process.env.ZERNIO_API;
  if (!apiKey) throw new HttpError(503, 'Social data source is not configured');

  const url = new URL(`${ZERNIO_API_URL}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HttpError(503, 'Social data is temporarily unavailable');
  }

  if (!response.ok) throw new HttpError(502, 'Social data provider returned an error');

  try {
    return await response.json();
  } catch {
    throw new HttpError(502, 'Social data provider returned an invalid response');
  }
}
