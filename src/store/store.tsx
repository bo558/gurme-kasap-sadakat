import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { buildSeed, DEMO_CUSTOMER_INDEX, SEED_VERSION } from "../data/seed";
import type { AppState } from "../data/types";

/**
 * Prototip durumu tarayıcının yerel deposunda (localStorage) tutulur.
 * Müşteri uygulaması ve işletme paneli farklı sekmelerde açılsa bile
 * "storage" olayı ile senkron kalır. Gerçek veritabanı bağlantısı yoktur.
 */
// Projeye özgü anahtar: aynı alan adında (ör. GitHub Pages) başka demolar yayınlansa da veriler karışmaz.
const KEY = "gurme-kasap-sadakat-demo";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s.version === SEED_VERSION) return s;
    }
  } catch {
    /* yok say */
  }
  return buildSeed();
}

interface Toast {
  id: number;
  tone: "ok" | "bad" | "info";
  text: string;
}

interface Store {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  reset: () => void;
  loginDemo: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(load);
  // Güncellemeler her zaman en güncel durum üzerinde, render dışında ve bir kez çalışır.
  const ref = useRef(state);
  const setState = useCallback((next: AppState) => {
    ref.current = next;
    setStateRaw(next);
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const skipSave = useRef(false);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* depolama kapalı olabilir */
    }
  }, [state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as AppState;
        skipSave.current = true;
        setState(s);
      } catch {
        /* yok say */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setState]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn(ref.current)), [setState]);
  const reset = useCallback(() => setState(buildSeed()), [setState]);
  const loginDemo = useCallback(() => {
    const s = ref.current;
    setState({ ...s, session: { ...s.session, customerId: s.customers[DEMO_CUSTOMER_INDEX]!.id } });
  }, [setState]);
  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, tone, text }].slice(-2));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return <Ctx.Provider value={{ state, update, reset, loginDemo, toasts, toast }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider eksik");
  return s;
}

/** Basit hash yönlendirici: #/app/..., #/panel/... */
export function useRoute(): [string[], (path: string) => void] {
  const parse = () => (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => setParts(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((path: string) => {
    location.hash = `#/${path.replace(/^\//, "")}`;
  }, []);
  return [parts, go];
}
