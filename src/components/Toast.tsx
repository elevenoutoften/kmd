import { useEffect, type FC } from "react";
import type { ToastEntry } from "../hooks/useToast";

export interface ToastProps {
  entry: ToastEntry;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 2000;

export const Toast: FC<ToastProps> = ({ entry, onClose }) => {
  const autoDismiss = entry.type === "info" || entry.type === "success";

  useEffect(() => {
    if (!autoDismiss) return;
    const timer = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [autoDismiss, onClose]);

  return (
    <div className={`toast toast--${entry.type}`} role="alert">
      <span className="toast__message">{entry.message}</span>
      {entry.action && (
        <button
          className="toast__action"
          type="button"
          onClick={entry.action.onClick}
        >
          {entry.action.label}
        </button>
      )}
      <button
        className="toast__close"
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
};
