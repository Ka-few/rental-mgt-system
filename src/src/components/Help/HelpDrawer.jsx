import React, { useState, useEffect } from 'react';
import { useHelp } from '../../context/HelpContext';
import { searchArticles, getArticleDetails } from '../../services/helpService';

const MarkdownRenderer = ({ content }) => {
    // Simple regex-based markdown parser
    const parseMarkdown = (text) => {
        if (!text) return '';

        return text
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-black mt-6 mb-3 border-b pb-1">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black mb-4 text-blue-800">$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/^\d\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
            .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
            .replace(/\n/gim, '<br />');
    };

    return (
        <div
            className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
        />
    );
};

const HelpDrawer = () => {
    const { isHelpDrawerOpen, setIsHelpDrawerOpen, helpArticles, startTour } = useHelp();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (searchQuery.trim().length > 2) {
            const delayDebounceFn = setTimeout(async () => {
                setLoading(true);
                try {
                    const results = await searchArticles(searchQuery);
                    setSearchResults(results);
                } catch (err) {
                    console.error('Search failed:', err);
                } finally {
                    setLoading(false);
                }
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const handleSelectArticle = async (slug) => {
        setLoading(true);
        try {
            const details = await getArticleDetails(slug);
            setSelectedArticle(details);
        } catch (err) {
            console.error('Failed to fetch article:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isHelpDrawerOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => setIsHelpDrawerOpen(false)}
            />

            <div className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col border-l border-gray-200 animate-slide-in-right">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50">
                    <div>
                        <h2 className="text-xl font-black text-blue-900">Help Center</h2>
                        <p className="text-sm text-blue-700 font-medium">Learn how to use your system</p>
                    </div>
                    <button
                        onClick={() => setIsHelpDrawerOpen(false)}
                        className="p-2 hover:bg-white rounded-full transition-colors text-blue-900"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-white border-b border-gray-100">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search help articles..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-0">
                    {selectedArticle ? (
                        <div className="p-6">
                            <button
                                onClick={() => setSelectedArticle(null)}
                                className="mb-6 flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to All Topics
                            </button>

                            <MarkdownRenderer content={selectedArticle.content} />

                            {selectedArticle.steps && selectedArticle.steps.length > 0 && (
                                <div className="mt-8 p-4 bg-green-50 border border-green-100 rounded-2xl">
                                    <h4 className="font-black text-green-900 mb-2">Guided Walkthrough Available</h4>
                                    <p className="text-sm text-green-700 mb-4">Would you like to start a guided tour for this process?</p>
                                    <button
                                        onClick={() => startTour(selectedArticle.slug)}
                                        className="w-full py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md hover:shadow-lg"
                                    >
                                        Start Guided Tour
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : searchQuery.trim().length > 2 ? (
                        <div className="p-4">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Search Results</h3>
                            {loading ? (
                                <p className="text-center py-8 text-gray-400 animate-pulse">Searching...</p>
                            ) : searchResults.length > 0 ? (
                                <div className="space-y-2">
                                    {searchResults.map(result => (
                                        <button
                                            key={result.id}
                                            onClick={() => handleSelectArticle(result.slug)}
                                            className="w-full text-left p-4 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-2xl transition-all"
                                        >
                                            <div className="text-xs font-bold text-blue-600 mb-1">{result.category}</div>
                                            <div className="font-bold text-gray-900">{result.title}</div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-8 text-gray-500">No results found for "{searchQuery}"</p>
                            )}
                        </div>
                    ) : (
                        <div className="p-4">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Browse by Topic</h3>
                            <div className="space-y-6">
                                {['Glossary', 'Guides', 'FAQ'].map(cat => {
                                    const catArticles = helpArticles.filter(a => a.category === cat);
                                    if (catArticles.length === 0) return null;
                                    return (
                                        <div key={cat}>
                                            <div className="flex items-center mb-3">
                                                <div className="w-1 h-4 bg-blue-600 rounded-full mr-2" />
                                                <h4 className="font-black text-gray-900">{cat}</h4>
                                            </div>
                                            <div className="space-y-1">
                                                {catArticles.map(article => (
                                                    <button
                                                        key={article.id}
                                                        onClick={() => handleSelectArticle(article.slug)}
                                                        className="w-full text-left p-3 hover:bg-gray-50 rounded-xl transition-colors group flex items-center"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{article.title}</div>
                                                        </div>
                                                        <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-center text-gray-400 font-medium">Rental Management System v1.0.0 • Offline Help</p>
                </div>
            </div>
        </div>
    );
};

export default HelpDrawer;
