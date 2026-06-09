"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type PickerEntry = { dirty: boolean; save: () => Promise<void> };

type PicksSave = {
  register: (id: string, entry: PickerEntry) => void;
  unregister: (id: string) => void;
};

const PicksSaveContext = createContext<PicksSave | null>(null);

export function usePicksSave() {
  return useContext(PicksSaveContext);
}

// Wraps the picks list. Each inline picker registers its dirty state + save
// function so a single "Save all" bar can flush every unsaved pick at once.
export function PicksSaveProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Record<string, PickerEntry>>({});
  const [saving, setSaving] = useState(false);

  const register = useCallback((id: string, entry: PickerEntry) => {
    setEntries((prev) => ({ ...prev, [id]: entry }));
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((prev) => {
      if (!(id in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const dirty = Object.values(entries).filter((entry) => entry.dirty);

  async function saveAll() {
    setSaving(true);
    try {
      await Promise.all(dirty.map((entry) => entry.save()));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PicksSaveContext.Provider value={{ register, unregister }}>
      {children}
      {dirty.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[84px] z-40 px-3 md:bottom-6">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-stone-950 p-2 pl-4 text-white shadow-xl">
            <span className="text-sm font-black">
              {dirty.length} unsaved pick{dirty.length === 1 ? "" : "s"}
            </span>
            <button
              className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-stone-950 disabled:opacity-60"
              disabled={saving}
              onClick={saveAll}
              type="button"
            >
              {saving ? "Saving…" : "Save all"}
            </button>
          </div>
        </div>
      ) : null}
    </PicksSaveContext.Provider>
  );
}
