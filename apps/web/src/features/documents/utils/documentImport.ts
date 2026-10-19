// Mirrors the content maxLength the api's create and update document bodies validate.
export const MARKDOWN_MAX_CHARACTERS = 250_000;

export const markdownTitle = (filename: string) =>
  filename
    .trim()
    .replace(/\.(md|markdown)$/i, '')
    .trim();
