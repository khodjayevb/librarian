import React, { useState, useEffect } from 'react';

function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      const response = await fetch('http://localhost:3001/api/scan', {
        method: 'POST',
      });
      const data = await response.json();
      console.log('Scan completed:', data);
      // Reload books after scan
      loadBooks();
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBooks = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/books');
      const data = await response.json();
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
              <input
                type="text"
                placeholder="Search books..."
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={handleScanLibrary}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Scanning...' : 'Scan Library'}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
              >
                <h3 className="font-semibold text-gray-800 mb-2">
                  {book.title || 'Untitled'}
                </h3>
                <p className="text-gray-600 text-sm mb-2">
                  {book.author || 'Unknown Author'}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{book.language || 'Unknown'}</span>
                  <span>{book.page_count} pages</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;