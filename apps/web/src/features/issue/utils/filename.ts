// "screenshot.png" -> "screenshot". The image editor names the saved file itself
// and appends the extension of the format it was saved in.
export const baseName = (filename: string) => filename.replace(/\.[^./\\]+$/, '');
