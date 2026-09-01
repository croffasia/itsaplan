'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'itsaplan:docs:editor-preferences:v1';

interface DocumentEditorPreferences {
  stickyToolbar: boolean;
}

const DEFAULT_PREFERENCES: DocumentEditorPreferences = {
  stickyToolbar: true,
};

function parsePreferences(value: string | null): DocumentEditorPreferences {
  if (!value) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as Partial<DocumentEditorPreferences>;
    return { stickyToolbar: parsed.stickyToolbar !== false };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function readPreferences(): DocumentEditorPreferences {
  try {
    return parsePreferences(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function useDocumentEditorPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setPreferences(readPreferences());
    setRestored(true);

    const syncPreferences = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = parsePreferences(event.newValue);
      setPreferences((current) => (current.stickyToolbar === next.stickyToolbar ? current : next));
    };
    window.addEventListener('storage', syncPreferences);
    return () => window.removeEventListener('storage', syncPreferences);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      return;
    }
  }, [preferences, restored]);

  const setStickyToolbar = useCallback((stickyToolbar: boolean) => {
    setPreferences((current) =>
      current.stickyToolbar === stickyToolbar ? current : { ...current, stickyToolbar },
    );
  }, []);

  return { ...preferences, setStickyToolbar };
}
