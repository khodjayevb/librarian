import React, { useState, useEffect } from 'react';

function SearchResultsModal({ isOpen, onClose, book, searchQuery, searchType = 'any', isDark }) {
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageOffset, setPageOffset] = useState(0);

  useEffect(() => {
    if (isOpen && book && searchQuery) {
      fetchOccurrences();
    }
  }, [isOpen, book, searchQuery, searchType]);

  const fetchOccurrences = async () => {
    setLoading(true);
    try {
      // Use phrase search for "Exact phrase" mode or multi-word queries
      const matchType = searchType === 'phrase' || searchQuery.includes(' ') ? 'phrase' : searchType;
      const response = await fetch(
        `http://localhost:3001/api/search/books/${book.id}/occurrences?q=${encodeURIComponent(searchQuery)}&matchType=${matchType}`
      );
      const data = await response.json();
      console.log('Occurrences data:', data);
      setOccurrences(data.occurrences || []);
      setPageOffset(data.pageOffset || 0);
    } catch (error) {
      console.error('Error fetching occurrences:', error);
      setOccurrences([]);
    } finally {
      setLoading(false);
    }
  };


  const openPDFAtPage = (pageNumber) => {
    // pageNumber is the physical page from database
    // Simply open at that page number without any adjustments
    const pdfPath = book.file_path || book.filePath || '';
    if (pdfPath) {
      // Use the /pdf/ route to serve the PDF file
      // Add search parameter to highlight the search term
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      window.open(`http://localhost:3001/pdf${pdfPath}#page=${pageNumber}${searchParam}`, '_blank');
    } else {
      console.error('No file path available for book');
    }
    setSelectedPage(pageNumber);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className={`
          ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'}
          rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden
        `}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Search Results in "{book?.title || 'Untitled'}"
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Found "{searchQuery}" in {occurrences.length} pages
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="w-8 h-8 border-t-2 border-blue-500 border-solid rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {occurrences.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No occurrences found
                </p>
              ) : (
                occurrences.map((occurrence, index) => (
                  <div
                    key={index}
                    className={`
                      p-4 rounded-lg border cursor-pointer transition-all
                      ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}
                      ${selectedPage === occurrence.pageNumber ? 'ring-2 ring-blue-500' : ''}
                    `}
                    onClick={() => openPDFAtPage(occurrence.pageNumber)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        Page {occurrence.pageNumber}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {occurrence.occurrenceCount} occurrence{occurrence.occurrenceCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Snippet with highlighted search terms */}
                    <div
                      className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: occurrence.snippet }}
                    />

                    <button
                      className="mt-2 text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPDFAtPage(occurrence.pageNumber);
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open at this page
                    </button>
                  </div>
                ))
              )}

              {occurrences.length > 0 && occurrences.length >= 50 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing first 50 occurrences. Open the book to see all results.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {occurrences.reduce((sum, o) => sum + (o.occurrenceCount || 1), 0)} total occurrences
          </div>
          <button
            onClick={() => {
              const pdfPath = book.file_path || book.filePath || '';
              if (pdfPath) {
                window.open(`http://localhost:3001/pdf${pdfPath}`, '_blank');
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Open Book
          </button>
        </div>
      </div>
    </div>
  );
}

export default SearchResultsModal;