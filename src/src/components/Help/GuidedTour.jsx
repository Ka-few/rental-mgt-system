import React, { useEffect, useState, useRef } from 'react';
import { useHelp } from '../../context/HelpContext';

const GuidedTour = () => {
    const { activeTour, nextStep, prevStep, skipTour } = useHelp();
    const [tooltipStyle, setTooltipStyle] = useState({ opacity: 0 });
    const [highlightStyle, setHighlightStyle] = useState({ opacity: 0 });
    const tooltipRef = useRef(null);

    useEffect(() => {
        if (activeTour && activeTour.steps[activeTour.currentIndex]) {
            const step = activeTour.steps[activeTour.currentIndex];
            const target = document.querySelector(step.target_selector);

            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const rect = target.getBoundingClientRect();

                // Highlight style
                setHighlightStyle({
                    top: `${rect.top - 8}px`,
                    left: `${rect.left - 8}px`,
                    width: `${rect.width + 16}px`,
                    height: `${rect.height + 16}px`,
                    opacity: 1,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.8)',
                    zIndex: 999
                });

                // Tooltip position (try to place it relative to target)
                const tooltipTop = rect.bottom + 16;
                const tooltipLeft = Math.max(16, Math.min(window.innerWidth - 320, rect.left));

                setTooltipStyle({
                    top: `${tooltipTop}px`,
                    left: `${tooltipLeft}px`,
                    opacity: 1,
                    zIndex: 1000
                });
            } else {
                // If target not found, just show centered
                setHighlightStyle({ opacity: 0 });
                setTooltipStyle({
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 1,
                    zIndex: 1000
                });
            }
        }
    }, [activeTour]);

    if (!activeTour) return null;

    const currentStep = activeTour.steps[activeTour.currentIndex];
    const isLastStep = activeTour.currentIndex === activeTour.steps.length - 1;

    return (
        <div className="fixed inset-0 pointer-events-none z-[998]">
            {/* Highlight Box */}
            <div
                className="fixed border-4 border-blue-500 rounded-lg transition-all duration-300 ease-in-out"
                style={highlightStyle}
            />

            {/* Tooltip Card */}
            <div
                ref={tooltipRef}
                className="fixed w-72 bg-white rounded-2xl shadow-2xl p-6 pointer-events-auto transition-all duration-300 ease-in-out border border-blue-100"
                style={tooltipStyle}
            >
                <div className="flex justify-between items-start mb-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-md">
                        Step {activeTour.currentIndex + 1} of {activeTour.steps.length}
                    </span>
                    <button
                        onClick={skipTour}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <p className="text-gray-800 text-sm font-medium leading-relaxed mb-6">
                    {currentStep.instruction}
                </p>

                <div className="flex justify-between items-center gap-2">
                    <button
                        onClick={skipTour}
                        className="text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        Skip Tour
                    </button>

                    <div className="flex gap-2">
                        {activeTour.currentIndex > 0 && (
                            <button
                                onClick={prevStep}
                                className="px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={nextStep}
                            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
                        >
                            {isLastStep ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>

                {/* Arrow */}
                <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-t border-l border-blue-100 rotate-45" />
            </div>
        </div>
    );
};

export default GuidedTour;
