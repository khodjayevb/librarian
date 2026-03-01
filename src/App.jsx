import React, { useState, useEffect } from 'react';

function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate stats
  const unprocessedCount = books.filter(book =>
    !book.language || book.language === 'Not scanned'
  ).length;

  // Filter books based on search query
  const filteredBooks = books.filter(book => {
    const query = searchQuery.toLowerCase();
    return (book.title || '').toLowerCase().includes(query) ||
           (book.author || '').toLowerCase().includes(query);
  });

  useEffect(() => {
    // Set up listeners for Electron menu events if available
    if (window.electronAPI) {
      window.electronAPI.onImportBooks(() => {
        console.log('Import books triggered');
        // TODO: Implement import functionality
      });

      window.electronAPI.onScanLibrary(() => {
        console.log('Scan library triggered');
        handleScanLibrary();
      });

      window.electronAPI.onOpenPreferences(() => {
        console.log('Open preferences triggered');
        // TODO: Implement preferences modal
      });

      return () => {
        // Cleanup listeners
        window.electronAPI.removeAllListeners('import-books');
        window.electronAPI.removeAllListeners('scan-library');
        window.electronAPI.removeAllListeners('open-preferences');
      };
    }
  }, []);

  const handleScanLibrary = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/scan?fast=true', {
        method: 'POST',
      });
      const data = await response.json();
      console.log('Scan completed:', data);
      // Reload books after scan
      await loadBooks();
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessBooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/process/batch?limit=10', {
        method: 'POST',
      });
      const data = await response.json();
      console.log('Processing completed:', data);
      alert(`Processed ${data.processed} books. ${data.errors} errors.`);
      // Reload books after processing
      await loadBooks();
    } catch (error) {
      console.error('Processing failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBooks = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/books?limit=500');
      const data = await response.json();
      console.log('Loaded books:', data);
      setBooks(data.books || []);
    } catch (error) {
      console.error('Failed to load books:', error);
      setBooks([]);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-800">
              Librarian
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {loading ? 'Loading...' : searchQuery ? `${filteredBooks.length} of ${books.length}` : `${books.length} books`}
                {unprocessedCount > 0 && !loading && (
                  <span className="ml-2 text-orange-600">
                    ({unprocessedCount} unprocessed)
                  </span>
                )}
              </span>
              <input
                type="text"
                placeholder="Search books..."
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={loadBooks}
                disabled={loading}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={handleScanLibrary}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Scanning...' : 'Scan Library'}
              </button>
              <button
                onClick={handleProcessBooks}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Process Books'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Scanning library...</div>
          </div>
        ) : !books || books.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 text-lg">
              No books found. Click "Scan Library" to discover books.
            </div>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 text-lg">
              No books match your search.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2" title={book.title}>
                  {book.title || 'Untitled'}
                </h3>
                <p className="text-gray-600 text-sm mb-2">
                  {book.author || 'Unknown Author'}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className={`px-2 py-1 rounded ${
                    book.language === 'Russian' ? 'bg-blue-100 text-blue-800' :
                    book.language === 'English' ? 'bg-green-100 text-green-800' :
                    book.language === 'unknown' ? 'bg-yellow-100 text-yellow-800' :
                    !book.language || book.language === 'Not scanned' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {!book.language || book.language === 'Not scanned' ? '⚠️ Not processed' :
                     book.language === 'unknown' ? 'Unknown' :
                     book.language}
                  </span>
                  {book.page_count && <span>{book.page_count} pages</span>}
                </div>
                {book.pdf_type && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      book.pdf_type === 'searchable' ? 'bg-green-50 text-green-700' :
                      book.pdf_type === 'scanned' ? 'bg-orange-50 text-orange-700' :
                      book.pdf_type === 'mixed' ? 'bg-purple-50 text-purple-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {book.pdf_type === 'searchable' ? '📝 Searchable' :
                       book.pdf_type === 'scanned' ? '📷 Scanned' :
                       book.pdf_type === 'mixed' ? '📑 Mixed' :
                       book.pdf_type}
                    </span>
                    {book.needs_review === 1 && (
                      <span className="text-xs text-red-600">⚠️ Needs Review</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;