import React from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className={`p-6 ${isDangerous ? 'bg-rose-50' : 'bg-slate-50'} border-b border-gray-100 flex items-center gap-3`}>
                    <div className={`p-2 rounded-lg ${isDangerous ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                        <i className={`bx ${isDangerous ? 'bx-error' : 'bx-info-circle'} text-xl`}></i>
                    </div>
                    <h3 className="text-lg font-black text-gray-800 tracking-tight">{title}</h3>
                </div>
                <div className="p-6">
                    <p className="text-gray-500 leading-relaxed font-medium">{message}</p>
                </div>
                <div className="p-4 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl font-bold hover:bg-gray-100 transition-colors uppercase text-xs tracking-widest"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-4 py-3 rounded-xl text-white font-black shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest ${isDangerous
                            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                            : 'bg-slate-900 hover:bg-black shadow-slate-200'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
