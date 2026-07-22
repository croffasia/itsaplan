import { API_URL } from '@/lib/api';

async function errorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? `${res.status} ${res.statusText}`;
}

// Uploads an avatar image to the API (stored in MinIO). The API writes the new URL
// to the user's image column itself and returns it, so the caller only has to read
// the session again. Multipart, so the browser sets the boundary itself — no
// Content-Type header.
export async function uploadAvatar(file: File): Promise<{ image: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/me/avatar`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

// Removes the stored avatar object and clears the user's image column.
export async function removeAvatar(): Promise<void> {
  const res = await fetch(`${API_URL}/me/avatar`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(await errorMessage(res));
}
