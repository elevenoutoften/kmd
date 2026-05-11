import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ---- Types ----

export type ToastType = "info" | "warning" | "error" | "success";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type?: ToastType;
  action?: ToastAction;
}

export interface ToastEntry {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: ToastEntry[];
  toast: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

// ---- Context ----

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

// ---- Provider ----

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions): number => {
      const id = nextId++;
      const entry: ToastEntry = {
        id,
        message,
        type: options?.type ?? "info",
        action: options?.action,
      };
      setToasts((prev) => [...prev, entry]);
      return id;
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

// ---- Hook ----

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
