import React from 'react';

export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    };

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className={`${sizeClasses[size]} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`}></div>
            {text && <p className="mt-2 text-gray-600">{text}</p>}
        </div>
    );
}
