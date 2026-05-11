import { useRecentFiles, type RecentFile } from "@/hooks/useRecentFiles";
import "./WelcomeScreen.css";

interface WelcomeScreenProps {
  onOpenFile: (path: string) => void;
  onPickFile: () => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function RecentFileItem({ file, onOpen }: { file: RecentFile; onOpen: (path: string) => void }) {
  return (
    <button
      className="welcome-recent-item"
      onClick={() => onOpen(file.path)}
      type="button"
      title={file.path}
    >
      <span className="welcome-recent-name">{file.display_name}</span>
      <span className="welcome-recent-date">{formatDate(file.last_opened_at)}</span>
    </button>
  );
}

export function WelcomeScreen({ onOpenFile, onPickFile }: WelcomeScreenProps) {
  const { files, loading } = useRecentFiles();

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <h1 className="welcome-title">kmd</h1>
        <p className="welcome-subtitle">Kawaii MD reader</p>

        <button className="welcome-open-btn" onClick={onPickFile} type="button">
          Open Markdown File
        </button>

        <div className="welcome-shortcut-hint">
          <kbd>Ctrl</kbd>+<kbd>O</kbd> to open
        </div>

        {files.length > 0 && (
          <section className="welcome-recent">
            <h2 className="welcome-recent-heading">Recent Files</h2>
            {loading ? (
              <div className="welcome-recent-loading">Loading…</div>
            ) : (
              <ul className="welcome-recent-list">
                {files.slice(0, 10).map((file) => (
                  <li key={file.path}>
                    <RecentFileItem file={file} onOpen={onOpenFile} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
