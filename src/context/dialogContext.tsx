// src/context/dialogContext.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, HelpCircle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** In-app replacements for window.confirm / window.prompt. */
export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** "danger" = red, irreversible actions. */
  tone?: "danger" | "default";
}

export interface PromptOptions {
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  /** Return an error message to block submit, or null when valid. */
  validate?: (value: string) => string | null;
}

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

type State =
  | { kind: "confirm"; opts: ConfirmOptions }
  | { kind: "prompt"; opts: PromptOptions }
  | null;

const DialogContext = createContext<DialogApi>({
  confirm: async () => false,
  prompt: async () => null,
});

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((v: boolean | string | null) => void) | null>(null);

  const close = useCallback((result: boolean | string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve as (v: boolean | string | null) => void;
        setState({ kind: "confirm", opts });
      }),
    []
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve as (v: boolean | string | null) => void;
        setValue(opts.defaultValue ?? "");
        setError(null);
        setState({ kind: "prompt", opts });
      }),
    []
  );

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  const submitPrompt = () => {
    if (state?.kind !== "prompt") return;
    const trimmed = value.trim();
    const problem = state.opts.validate
      ? state.opts.validate(trimmed)
      : trimmed
      ? null
      : "Please enter a value.";
    if (problem) {
      setError(problem);
      return;
    }
    close(trimmed);
  };

  const danger = state?.kind === "confirm" && state.opts.tone === "danger";
  const Icon = state?.kind === "prompt" ? Pencil : danger ? AlertTriangle : HelpCircle;

  return (
    <DialogContext.Provider value={api}>
      {children}

      <Dialog
        open={state !== null}
        onOpenChange={(open) => {
          if (!open) close(state?.kind === "confirm" ? false : null);
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-md p-0 gap-0 overflow-hidden">
          {state && (
            <div className="p-6">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${
                    danger
                      ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                      : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg font-semibold leading-tight">
                    {state.opts.title}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="mt-1.5 text-sm text-muted-foreground">
                      {state.opts.description ?? (danger ? "This can't be undone." : "")}
                    </div>
                  </DialogDescription>

                  {state.kind === "prompt" && (
                    <div className="mt-4">
                      {state.opts.label && (
                        <label
                          htmlFor="app-dialog-input"
                          className="mb-1.5 block text-sm font-medium"
                        >
                          {state.opts.label}
                        </label>
                      )}
                      <Input
                        id="app-dialog-input"
                        autoFocus
                        value={value}
                        placeholder={state.opts.placeholder}
                        onChange={(e) => {
                          setValue(e.target.value);
                          setError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitPrompt();
                          }
                        }}
                        aria-invalid={!!error}
                      />
                      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {state && (
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => close(state.kind === "confirm" ? false : null)}
              >
                {state.opts.cancelText ?? "Cancel"}
              </Button>
              <Button
                autoFocus={state.kind === "confirm"}
                variant={danger ? "destructive" : "default"}
                onClick={() => (state.kind === "confirm" ? close(true) : submitPrompt())}
              >
                {state.opts.confirmText ?? (state.kind === "prompt" ? "Save" : "Confirm")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
};

export const useDialog = () => useContext(DialogContext);
