import { useState, useEffect } from 'react';
import logo from '../assets/logo.png';

export default function SplashScreen({ onFinish }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Show splash for 2 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => {
                onFinish();
            }, 500); // Wait for fade out animation
        }, 2000);

        return () => clearTimeout(timer);
    }, [onFinish]);

    if (!isVisible) {
        return null;
    }

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'
                }`}
        >
            <div className="text-center">
                {/* Logo */}
                <div className="mb-8 animate-pulse">
                    <img
                        src={logo}
                        alt="Application Logo"
                        className="h-32 w-auto mx-auto object-contain"
                    />
                </div>

                {/* Loading Animation */}
                <div className="flex justify-center items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>

                {/* Loading Text */}
                <p className="mt-6 text-gray-400 text-sm animate-pulse">Loading...</p>
            </div>
        </div>
    );
}
