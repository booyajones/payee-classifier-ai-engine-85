
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

class ClassificationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      errorId: Math.random().toString(36).substr(2, 9)
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorId: Math.random().toString(36).substr(2, 9)
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.props.context || 'Classification System';
    logger.error(`[${context} ERROR BOUNDARY] Component error caught:`, error, errorInfo);
    
    // Log specific error types
    if (error.message.includes('Maximum call stack size exceeded')) {
      logger.error('[ERROR BOUNDARY] Stack overflow detected - possible infinite loop');
    }
    
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      errorId: Math.random().toString(36).substr(2, 9)
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isStackOverflow = this.state.error?.message.includes('Maximum call stack size exceeded');
      const context = this.props.context || 'Classification System';

      return (
        <div className="p-4 border rounded-md bg-destructive/5">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{context} Error</AlertTitle>
            <AlertDescription className="mt-2">
              {isStackOverflow ? (
                <div>
                  <p className="font-medium text-destructive mb-2">Stack Overflow Detected</p>
                  <p>The classification system encountered an infinite loop. This usually happens when:</p>
                  <ul className="list-disc ml-4 mt-1 space-y-1 text-sm">
                    <li>Circular dependencies in classification logic</li>
                    <li>Recursive function calls without proper exit conditions</li>
                    <li>Large batch processing exceeding memory limits</li>
                  </ul>
                </div>
              ) : (
                <p>The {context.toLowerCase()} encountered an unexpected error. Please try again or contact support if the problem persists.</p>
              )}
            </AlertDescription>
            
            {this.state.error && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer font-medium flex items-center gap-1">
                  <Bug className="h-3 w-3" />
                  Error Details (ID: {this.state.errorId})
                </summary>
                <pre className="mt-2 whitespace-pre-wrap bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="mt-4 flex gap-2">
              <Button onClick={this.handleReset} size="sm">
                <RefreshCw className="h-3 w-3 mr-1" />
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Reload Page
              </Button>
            </div>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ClassificationErrorBoundary;
