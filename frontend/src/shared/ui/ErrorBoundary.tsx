import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('React Error Boundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100%', gap: 12,
                    padding: 40, color: '#666',
                }}>
                    <span style={{ fontSize: 48 }}>⚠️</span>
                    <h3 style={{ margin: 0, color: '#333' }}>页面渲染出错</h3>
                    <pre style={{
                        background: '#f5f5f5', padding: '12px 20px', borderRadius: 6,
                        fontSize: 12, maxWidth: '80%', overflow: 'auto', color: '#cc0000',
                    }}>
                        {this.state.error?.message || '未知错误'}
                    </pre>
                    <button
                        style={{
                            padding: '6px 16px', borderRadius: 4, border: '1px solid #d9d9d9',
                            background: '#fff', cursor: 'pointer', fontSize: 13,
                        }}
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        重试
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
