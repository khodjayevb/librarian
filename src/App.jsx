import React, { useState, useEffect } from 'react';
import BookDetailModal from './components/BookDetailModal';

function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Advanced filtering states
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('');
  const [sortBy, setSortBy] = useState('title'); // title, date_added, file_size
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc

  // Calculate stats
  const unprocessedCount = books.filter(book =>
    !book.language || book.language === 'Not scanned'
  ).length;

  // Function to open PDF
  const handleOpenPDF = async (bookId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/books/${bookId}/open`, {
        method: 'POST'
      });
      if (!response.ok) {
        console.error('Failed to open PDF');
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
    }
  };

  // Extract unique values for filters
  const allTags = [...new Set(books.flatMap(book => book.tags || []))];
  const allAuthors = [...new Set(books.map(book => book.author).filter(Boolean))].sort();
  const allFileTypes = [...new Set(books.map(book => {
    const ext = book.file_path?.split('.').pop()?.toLowerCase();
    return ext;
  }).filter(Boolean))].sort();

  // Enhanced filtering and sorting
  const filteredAndSortedBooks = React.useMemo(() => {
    // Apply filters
    let filtered = books.filter(book => {
      // Search query filter
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query ||
        (book.title || '').toLowerCase().includes(query) ||
        (book.author || '').toLowerCase().includes(query);

      // Tag filter
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every(tag => book.tags?.includes(tag));

      // Author filter
      const matchesAuthor = !selectedAuthor ||
        book.author === selectedAuthor;

      // File type filter
      const bookFileType = book.file_path?.split('.').pop()?.toLowerCase();
      const matchesFileType = !selectedFileType ||
        bookFileType === selectedFileType;

      return matchesSearch && matchesTags && matchesAuthor && matchesFileType;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'title':
          compareValue = (a.title || '').localeCompare(b.title || '');
          break;
        case 'date_added':
          compareValue = new Date(a.date_added || 0) - new Date(b.date_added || 0);
          break;
        case 'file_size':
          compareValue = (a.file_size || 0) - (b.file_size || 0);
          break;
        case 'author':
          compareValue = (a.author || '').localeCompare(b.author || '');
          break;
        default:
          compareValue = 0;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [books, searchQuery, selectedTags, selectedAuthor, selectedFileType, sortBy, sortOrder]);

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

  const handleGenerateThumbnails = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/books/thumbnails/batch', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Thumbnail generation started:', data);

        // Refresh books after a delay to show new thumbnails
        setTimeout(() => {
          loadBooks();
        }, 5000);
      } else {
        console.error('Failed to generate thumbnails');
      }
    } catch (error) {
      console.error('Error generating thumbnails:', error);
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
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-800">
              Librarian
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {loading ? 'Loading...' : (searchQuery || selectedTags.length > 0 || selectedAuthor || selectedFileType) ? `${filteredAndSortedBooks.length} of ${books.length}` : `${books.length} books`}
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
              <button
                onClick={handleGenerateThumbnails}
                disabled={loading}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                📷 Generate Covers
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Bar - Also sticky below the header */}
      <div className="sticky top-16 z-40 bg-gray-100 border-b border-gray-200 px-6 py-3 shadow-sm">
        <div className="flex items-center space-x-4">
          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Tags:</label>
              <select
                multiple
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedTags}
                onChange={(e) => setSelectedTags(Array.from(e.target.selectedOptions, option => option.value))}
                style={{minWidth: '120px', maxWidth: '200px'}}
              >
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}

          {/* Author Filter */}
          {allAuthors.length > 0 && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Author:</label>
              <select
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
              >
                <option value="">All Authors</option>
                {allAuthors.map(author => (
                  <option key={author} value={author}>{author}</option>
                ))}
              </select>
            </div>
          )}

          {/* File Type Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Type:</label>
            <select
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value)}
            >
              <option value="">All Types</option>
              {allFileTypes.map(type => (
                <option key={type} value={type}>{type.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Sort Options */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="date_added">Date Added</option>
              <option value="file_size">File Size</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Clear Filters */}
          {(selectedTags.length > 0 || selectedAuthor || selectedFileType) && (
            <button
              onClick={() => {
                setSelectedTags([]);
                setSelectedAuthor('');
                setSelectedFileType('');
              }}
              className="px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

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
        ) : filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 text-lg">
              No books match your filters.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer group relative overflow-hidden"
                onClick={() => {
                  setSelectedBook(book);
                  setIsModalOpen(true);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenPDF(book.id);
                }}
                title="Double-click to open PDF"
              >
                {/* Book Cover Image */}
                <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {book.thumbnail_url ? (
                    <img
                      src={book.thumbnail_url}
                      alt={book.title || 'Book cover'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`text-gray-400 text-6xl ${book.thumbnail_url ? 'hidden' : 'flex'}`}>
                    📚
                  </div>
                </div>

                {/* Hover overlay with open button */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-4 pointer-events-none">
                  <div className="text-white text-sm font-medium">
                    Double-click to open PDF
                  </div>
                </div>

                <div className="p-4">
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
                      book.pdf_type === 'unknown' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {book.pdf_type === 'searchable' ? '📝 Searchable' :
                       book.pdf_type === 'scanned' ? '📷 Scanned' :
                       book.pdf_type === 'mixed' ? '📑 Mixed' :
                       book.pdf_type === 'unknown' ? '❓ Unknown' :
                       book.pdf_type}
                    </span>
                    {book.needs_review === 1 && (
                      <span className="text-xs text-red-600">⚠️ Needs Review</span>
                    )}
                  </div>
                )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Book Detail Modal */}
      <BookDetailModal
        book={selectedBook}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBook(null);
        }}
        onUpdate={(updatedBook) => {
          // Update the book in the list
          setBooks(prevBooks =>
            prevBooks.map(book =>
              book.id === updatedBook.id ? updatedBook : book
            )
          );
          // Update selected book if still open
          if (selectedBook?.id === updatedBook.id) {
            setSelectedBook(updatedBook);
          }
        }}
      />
    </div>
  );
}

export default App;