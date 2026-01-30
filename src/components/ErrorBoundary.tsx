import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary that filters out third-party/extension errors
 * Only shows errors that originate from our application code
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if error is from our code (has our file paths in stack)
    const stack = error.stack || '';
    const isOurError = stack.includes('/src/') ||
                       stack.includes('productivity-dashboard') ||
                       stack.includes('components/');

    // Filter out extension errors (undefined variable errors from extensions)
    const isExtensionError =
      (error.message.includes("Can't find variable") && !isOurError) ||
      (error.message.includes('is not defined') && !isOurError) ||
      stack.includes('extension://') ||
      stack.includes('chrome-extension://') ||
      stack.includes('moz-extension://');

    if (isExtensionError) {
      console.warn('[ErrorBoundary] Suppressed extension error:', error.message);
      return { hasError: false, error: null };
    }

    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only log errors that are actually from our code
    const stack = error.stack || '';
    const isOurError = stack.includes('/src/') ||
                       stack.includes('productivity-dashboard');

    if (isOurError) {
      console.error('[ErrorBoundary] Application error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
