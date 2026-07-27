"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type DialogState =
  | { mode: "alert"; message: string; resolve: () => void }
  | { mode: "confirm"; message: string; resolve: (ok: boolean) => void }
  | null;

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

type AlertApi = {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  toast: (message: string, tone?: ToastTone) => void;
};

const AlertCtx = createContext<AlertApi | null>(null);

export function useAlert() {
  const ctx = useContext(AlertCtx);
  if (!ctx) throw new Error("useAlert requires AlertProvider");
  return ctx;
}

const toneClass: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-zinc-200 bg-white text-zinc-900",
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const toastSeq = useRef(0);

  const alert = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      seq.current += 1;
      setDialog({ mode: "alert", message, resolve });
    });
  }, []);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      seq.current += 1;
      setDialog({ mode: "confirm", message, resolve });
    });
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-4), { id, message, tone }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 3200);
  }, []);

  const closeAlert = () => {
    if (dialog?.mode === "alert") dialog.resolve();
    setDialog(null);
  };

  const closeConfirm = (ok: boolean) => {
    if (dialog?.mode === "confirm") dialog.resolve(ok);
    setDialog(null);
  };

  return (
    <AlertCtx.Provider value={{ alert, confirm, toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[110] flex w-[min(100%-2rem,22rem)] flex-col gap-2 sm:right-6 sm:top-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${toneClass[t.tone]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
            aria-label="Dismiss"
            onClick={() => (dialog.mode === "alert" ? closeAlert() : closeConfirm(false))}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xl"
          >
            <p className="text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">{dialog.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              {dialog.mode === "confirm" && (
                <button
                  type="button"
                  className="rounded-lg px-3.5 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
                  onClick={() => closeConfirm(false)}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => (dialog.mode === "alert" ? closeAlert() : closeConfirm(true))}
                autoFocus
              >
                {dialog.mode === "alert" ? "OK" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertCtx.Provider>
  );
}
