import { useState } from 'react';

// The key that rebuilds a text editor when its stored text changes. Text the editor
// saved itself keeps the key: rebuilt, the editor renders nothing for a frame, which
// shortens the page under the reader and resets its scroll.
export function useEditorKey(stored: string | undefined) {
  const [state, setState] = useState({ stored, saved: stored, key: 0 });
  if (state.stored !== stored) {
    setState({ ...state, stored, key: stored === state.saved ? state.key : state.key + 1 });
  }
  return {
    key: state.key,
    // Called with the text the editor is about to save.
    saved: (text: string) => setState((s) => ({ ...s, saved: text })),
  };
}
