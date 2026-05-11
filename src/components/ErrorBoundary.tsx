import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary] caught rendering error:", error, info.componentStack);
  }

  private handleReload = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const message =
        this.state.error.message.length > 200
          ? this.state.error.message.slice(0, 200) + "…"
          : this.state.error.message;

      return (
        <div className="error-boundary">
          <div className="error-boundary-inner">
            <h2 className="error-boundary-title">Something went wrong</h2>
            <p className="error-boundary-message">{message}</p>
            <button
              className="error-boundary-reload"
              onClick={this.handleReload}
              type="button"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
