import React, { useState } from 'react';

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const [inputPage, setInputPage] = useState('');

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        if (value === '' || /^\d+$/.test(value)) {
            setInputPage(value);
        }
    };

    const handleGoToPage = () => {
        const page = parseInt(inputPage);
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
            setInputPage('');
        }
    };

    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
            <div className="flex justify-between flex-1 sm:hidden">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of{' '}
                        <span className="font-medium">{totalItems}</span> results
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Previous</span>
                            ‹
                        </button>

                        {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = idx + 1;
                            } else if (currentPage <= 3) {
                                pageNum = idx + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + idx;
                            } else {
                                pageNum = currentPage - 2 + idx;
                            }

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`relative inline-flex items-center px-4 py-2 text-sm font-medium border ${currentPage === pageNum
                                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Next</span>
                            ›
                        </button>
                    </nav>

                    <div className="flex items-center gap-2 ml-4">
                        <span className="text-sm text-gray-700">Go to:</span>
                        <input
                            type="text"
                            value={inputPage}
                            onChange={handleInputChange}
                            onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
                            placeholder={currentPage.toString()}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                        <button
                            onClick={handleGoToPage}
                            className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                        >
                            Go
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
