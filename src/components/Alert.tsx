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

type AlertApi = {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
};

const AlertCtx = createContext<AlertApi | null>(null);

export function useAlert() {
  const ctx = useContext(AlertCtx);
  if (!ctx) throw new Error("useAlert requires AlertProvider");
  return ctx;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const seq = useRef(0);

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

  const closeAlert = () => {
    if (dialog?.mode === "alert") dialog.resolve();
    setDialog(null);
  };

  const closeConfirm = (ok: boolean) => {
    if (dialog?.mode === "confirm") dialog.resolve(ok);
    setDialog(null);
  };

  return (
    <AlertCtx.Provider value={{ alert, confirm }}>
      {children}
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
