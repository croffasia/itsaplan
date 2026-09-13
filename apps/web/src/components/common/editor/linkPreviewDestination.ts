export function linkPreviewDestination(url: string, origin?: string) {
  try {
    const destination = new URL(url, origin);
    if (
      !['http:', 'https:'].includes(destination.protocol) ||
      destination.username ||
      destination.password
    )
      return null;
    return destination;
  } catch {
    return null;
  }
}
