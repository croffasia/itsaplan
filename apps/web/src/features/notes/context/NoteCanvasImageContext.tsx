'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface NoteCanvasImageContextValue {
  projectKey: string;
  boardId: number;
  canEdit: boolean;
}

const NoteCanvasImageContext = createContext<NoteCanvasImageContextValue | null>(null);

export function useNoteCanvasImageContext(): NoteCanvasImageContextValue {
  const value = useContext(NoteCanvasImageContext);
  if (!value) throw new Error('Note image nodes must be rendered inside a note canvas');
  return value;
}

export default function NoteCanvasImageProvider({
  projectKey,
  boardId,
  canEdit,
  children,
}: NoteCanvasImageContextValue & { children: ReactNode }) {
  return (
    <NoteCanvasImageContext.Provider value={{ projectKey, boardId, canEdit }}>
      {children}
    </NoteCanvasImageContext.Provider>
  );
}
