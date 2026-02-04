import React, { createContext, useContext, useState, useEffect } from 'react';

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
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const success = (message) => showToast(message, 'success');
    const error = (message) => showToast(message, 'error');
    const info = (message) => showToast(message, 'info');
    const warning = (message) => showToast(message, 'warning');

    const getToastStyles = (type) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-emerald-500/90',
                    border: 'border-emerald-400',
                    icon: 'bx-check-circle',
                    shadow: 'shadow-emerald-500/20'
                };
            case 'error':
                return {
                    bg: 'bg-rose-500/90',
                    border: 'border-rose-400',
                    icon: 'bx-error-circle',
                    shadow: 'shadow-rose-500/20'
                };
            case 'warning':
                return {
                    bg: 'bg-amber-500/90',
                    border: 'border-amber-400',
                    icon: 'bx-info-circle',
                    shadow: 'shadow-amber-500/20'
                };
            default:
                return {
                    bg: 'bg-indigo-500/90',
                    border: 'border-indigo-400',
                    icon: 'bx-info-circle',
                    shadow: 'shadow-indigo-500/20'
                };
        }
    };

    return (
        <ToastContext.Provider value={{ success, error, info, warning }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-[400px]">
                {toasts.map(toast => {
                    const styles = getToastStyles(toast.type);
                    return (
                        <div
                            key={toast.id}
                            className={`${styles.bg} ${styles.shadow} ${styles.border} border backdrop-blur-md px-5 py-4 rounded-2xl text-white shadow-2xl animate-slide-in-right relative overflow-hidden group min-w-[320px]`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="text-2xl pt-0.5">
                                    <i className={`bx ${styles.icon}`}></i>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm uppercase tracking-widest opacity-80 mb-0.5">{toast.type}</h4>
                                    <p className="font-medium text-[15px] leading-relaxed italic">{toast.message}</p>
                                </div>
                                <button
                                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                                    className="text-white/50 hover:text-white transition-colors"
                                >
                                    <i className="bx bx-x text-xl"></i>
                                </button>
                            </div>

                            {/* Visual Progress Bar */}
                            <div className="absolute bottom-0 left-0 h-1 bg-white/30 animate-shrink-width" style={{ width: '100%' }}></div>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
