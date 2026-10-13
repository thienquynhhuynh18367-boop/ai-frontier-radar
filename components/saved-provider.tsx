"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { IntelligenceItem } from "../types/intelligence-item";
import { SAVED_STORAGE_KEY, emptySavedState, mergeSavedState, parseSavedState,
  updateSavedEntry, updateExistingEntry, type SavedState } from "../lib/saved-state";

type SavedContextValue = {
  state: SavedState; ready: boolean; storageError: string | null;
  toggle: (item: IntelligenceItem, field: "saved" | "read" | "hidden") => void;
  toggleExisting: (id: string, field: "saved" | "read" | "hidden") => void;
  importText: (text: string) => number;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SavedState>(emptySavedState);
  const [ready, setReady] = useState(false);
  const [persistEnabled, setPersistEnabled] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => {
      try {
        const stored = window.localStorage.getItem(SAVED_STORAGE_KEY);
        setState(stored ? parseSavedState(stored) : emptySavedState());
        setStorageError(null);
        setPersistEnabled(true);
      } catch {
        setStorageError("本机收藏数据无法读取；请检查浏览器存储权限或导入备份。");
        setPersistEnabled(false);
      }
      setReady(true);
    };
    const timer = window.setTimeout(load, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SAVED_STORAGE_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, []);
  useEffect(() => {
    if (!ready || !persistEnabled) return;
    try {
      window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 浏览器无可用存储时仍可使用当前页状态，但明确告知用户无法持久化。
      const timer = window.setTimeout(() => setStorageError("本机存储失败；本页操作可能在关闭后丢失。"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [ready, persistEnabled, state]);
  const toggle = useCallback((item: IntelligenceItem, field: "saved" | "read" | "hidden") => {
    setPersistEnabled(true);
    setState((current) => updateSavedEntry(current, item, field, new Date().toISOString()));
  }, []);
  const toggleExisting = useCallback((id: string, field: "saved" | "read" | "hidden") => {
    setPersistEnabled(true);
    setState((current) => updateExistingEntry(current, id, field, new Date().toISOString()));
  }, []);
  const importText = useCallback((text: string) => {
    const imported = parseSavedState(text);
    setPersistEnabled(true);
    setState((current) => mergeSavedState(current, imported));
    return Object.keys(imported.entries).length;
  }, []);
  const value = useMemo(() => ({ state, ready, storageError, toggle, toggleExisting, importText }),
    [state, ready, storageError, toggle, toggleExisting, importText]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const context = useContext(SavedContext);
  if (!context) throw new Error("SavedProvider is missing");
  return context;
}
