// The Clipboard API exists only on a secure origin, and a self-hosted instance may be
// served over plain http, so a hidden textarea is the fallback.
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = window.document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    try {
      window.document.body.append(input);
      input.select();
      return window.document.execCommand('copy');
    } catch {
      return false;
    } finally {
      input.remove();
    }
  }
}
