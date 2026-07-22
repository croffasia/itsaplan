// Badge text for a planned item in the copy/paste import dialogs (states, issue
// types, labels). A match that differs only in color is applied as an update.
export function transferActionLabel(action: 'create' | 'update' | 'unchanged'): string {
  switch (action) {
    case 'create':
      return 'New';
    case 'update':
      return 'Update color';
    case 'unchanged':
      return 'No change';
  }
}
