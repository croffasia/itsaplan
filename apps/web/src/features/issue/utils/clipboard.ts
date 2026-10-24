// Safari accepts a clipboard write only within the click that asked for it, so text that
// is still being built is written as a pending item the clipboard waits for.
export function writeClipboardText(text: string | Promise<string>): Promise<void> {
  return navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })]);
}
