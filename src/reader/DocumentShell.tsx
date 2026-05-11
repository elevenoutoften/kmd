import { useCallback, useRef, useState, type ReactNode } from "react";
import type { OutlineEntry } from "../parser";
import { findAnchorTarget, scrollContainerToTarget } from "./anchorNavigation";
import "./DocumentShell.css";

interface DocumentShellProps {
  outline: OutlineEntry[];
  activeId?: string;
  children: ReactNode;
  onAnchorClick?: (id: string) => void;
}

function outlineDepth(level: number): 0 | 1 | 2 | 3 {
  if (level <= 1) return 0;
  if (level === 2) return 1;
  if (level === 3) return 2;
  return 3;
}

export function DocumentShell({ outline, activeId, children, onAnchorClick }: DocumentShellProps) {
  const [showOutline, setShowOutline] = useState(true);
  const docRef = useRef<HTMLElement>(null);

  const handleOutlineClick = useCallback((id: string) => {
    if (onAnchorClick) {
      onAnchorClick(id);
      return;
    }

    if (!docRef.current) {
      return;
    }

    const target = findAnchorTarget(docRef.current, id);
    if (target) {
      scrollContainerToTarget(docRef.current, target);
    }
  }, [onAnchorClick]);

  return (
    <div className="reader-layout">
      <nav
        className={`outline-sidebar ${showOutline ? "" : "collapsed"}`}
        aria-label="Document outline"
      >
        <div className="outline-title">Outline</div>
        <ul className="outline-list">
          {outline.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className={`outline-item${entry.id === activeId ? " active" : ""}`}
                data-depth={outlineDepth(entry.level)}
                onClick={(e) => {
                  e.preventDefault();
                  handleOutlineClick(entry.id);
                }}
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <button
        className="outline-toggle"
        onClick={() => setShowOutline((v) => !v)}
        title={showOutline ? "Hide outline" : "Show outline"}
        type="button"
      >
        {showOutline ? "◀" : "▶"}
      </button>
      <article ref={docRef} className="mdr-doc">
        <div className="mdr-content">{children}</div>
      </article>
    </div>
  );
}
