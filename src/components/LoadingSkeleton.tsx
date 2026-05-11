import "./LoadingSkeleton.css";

export function LoadingSkeleton() {
  return (
    <div className="loading-skeleton">
      <div className="skeleton-sidebar">
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--item" />
        <div className="skeleton-line skeleton-line--item" />
        <div className="skeleton-line skeleton-line--item skeleton-line--short" />
      </div>
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-line--h1" />
        <div className="skeleton-line skeleton-line--p" />
        <div className="skeleton-line skeleton-line--p skeleton-line--short" />
        <div className="skeleton-line skeleton-line--h2" />
        <div className="skeleton-line skeleton-line--p" />
        <div className="skeleton-block" />
        <div className="skeleton-line skeleton-line--p" />
        <div className="skeleton-line skeleton-line--p skeleton-line--mid" />
        <div className="skeleton-line skeleton-line--p skeleton-line--short" />
      </div>
    </div>
  );
}
