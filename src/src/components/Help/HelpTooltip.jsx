import React, { useState } from 'react';
import { useHelp } from '../../context/HelpContext';
import { getArticleDetails } from '../../services/helpService';

const HelpTooltip = ({ slug, title, content }) => {
    const { setIsHelpDrawerOpen } = useHelp();
    const [isVisible, setIsVisible] = useState(false);
    const [fetchedContent, setFetchedContent] = useState(content);

    const handleMouseEnter = async () => {
        setIsVisible(true);
        if (!fetchedContent && slug) {
            try {
                const details = await getArticleDetails(slug);
                setFetchedContent(details.content);
            } catch (err) {
                console.error('Failed to fetch tooltip content:', err);
            }
        }
    };

    return (
        <div className="relative inline-block ml-1 align-middle">
            <button
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsHelpDrawerOpen(true)}
                className="text-blue-400 hover:text-blue-600 transition-colors"
                title="Click for full Help Center"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
                </svg>
            </button>

            {isVisible && (fetchedContent || title) && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl z-[1100] animate-fade-in">
                    {title && <div className="font-black mb-1 text-blue-300 uppercase tracking-tighter">{title}</div>}
                    <div className="leading-normal font-medium opacity-90">
                        {fetchedContent?.split('\n')[0] || 'Click to learn more in the Help Center.'}
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                </div>
            )}
        </div>
    );
};

export default HelpTooltip;
