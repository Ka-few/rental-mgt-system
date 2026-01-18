import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const success = (message) => showToast(message, 'success');
    const error = (message) => showToast(message, 'error');
    const info = (message) => showToast(message, 'info');
    const warning = (message) => showToast(message, 'warning');

    return (
        <ToastContext.Provider value={{ success, error, info, warning }}>
            {children}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-6 py-3 rounded-lg shadow-lg text-white min-w-[300px] animate-slide-in ${toast.type === 'success' ? 'bg-green-500' :
                                toast.type === 'error' ? 'bg-red-500' :
                                    toast.type === 'warning' ? 'bg-yellow-500' :
                                        'bg-blue-500'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            {toast.type === 'success' && <span>✓</span>}
                            {toast.type === 'error' && <span>✕</span>}
                            {toast.type === 'warning' && <span>⚠</span>}
                            {toast.type === 'info' && <span>ℹ</span>}
                            <span>{toast.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
