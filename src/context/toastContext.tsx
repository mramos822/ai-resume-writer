// src/context/toastContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  success: () => {},
  error: () => {},
  info: () => {},
});

let counter = 0;
const DURATION = 4500;

const STYLES: Record<ToastType, { icon: React.ElementType; title: string; accent: string; bar: string; iconWrap: string }> = {
  success: {
    icon: CheckCircle2,
    title: "Done",
    accent: "border-l-green-500",
    bar: "bg-green-500",
    iconWrap: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
  },
  error: {
    icon: AlertCircle,
    title: "Something went wrong",
    accent: "border-l-red-500",
    bar: "bg-red-500",
    iconWrap: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  },
  info: {
    icon: Info,
    title: "Heads up",
    accent: "border-l-blue-500",
    bar: "bg-blue-500",
    iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, type: ToastType) => {
      const id = ++counter;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => push(msg, "success"), [push]);
  const error = useCallback((msg: string) => push(msg, "error"), [push]);
  const info = useCallback((msg: string) => push(msg, "info"), [push]);

  // Stable value: a new object each render made every effect depending on `toast` re-run in a loop
  const value = useMemo(() => ({ success, error, info }), [success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col gap-3"
            aria-live="polite"
          >
            {toasts.map(({ id, message, type }) => {
              const s = STYLES[type];
              const Icon = s.icon;
              return (
                <div
                  key={id}
                  role="status"
                  className={`animate-pop-in pointer-events-auto relative overflow-hidden rounded-md border border-l-4 bg-card text-card-foreground shadow-xl ${s.accent}`}
                >
                  <div className="flex items-start gap-3 p-4 pr-10">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${s.iconWrap}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{s.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground break-words">{message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(id)}
                    aria-label="Dismiss"
                    className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div
                    className={`absolute bottom-0 left-0 h-0.5 ${s.bar}`}
                    style={{ animation: `toast-life ${DURATION}ms linear forwards` }}
                  />
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  return useContext(ToastContext);
};
