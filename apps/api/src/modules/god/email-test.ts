// Provider errors can contain host names and transport details that should stay
// in the server log. Map only recognizable categories to actionable, stable API
// messages and use a generic fallback for everything else.
export function emailTestError(error: string | undefined): string {
  const value = error?.toLowerCase() ?? '';
  if (value.includes('timeout') || value.includes('aborted')) {
    return 'The email provider timed out';
  }
  if (value.includes('429') || value.includes('rate limit') || value.includes('quota')) {
    return 'The email provider rate limit or quota was reached';
  }
  if (
    value.includes('sender') ||
    value.includes('from address') ||
    value.includes('domain is not verified') ||
    value.includes('verify a domain') ||
    value.includes('domain verification')
  ) {
    return 'The email provider rejected the From address';
  }
  if (
    value.includes('auth') ||
    value.includes('credential') ||
    value.includes('invalid login') ||
    value.includes('401') ||
    value.includes('403') ||
    value.includes('535')
  ) {
    return 'The email provider rejected the credentials';
  }
  return 'The email provider rejected the test message';
}
