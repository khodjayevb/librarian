import React, { useState, useEffect } from 'react';
import BookDetailModal from './components/BookDetailModal';
import BulkActionsModal from './components/BulkActionsModal';
import CollectionsSidebar from './components/CollectionsSidebar';
import useDarkMode from './hooks/useDarkMode';

function App() {
  const { isDark, toggleDarkMode } = useDarkMode();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Collections state
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionBooks, setCollectionBooks] = useState([]);

  // Multi-select states
  const [selectedBookIds, setSelectedBookIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);

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
      // If a collection is selected, load books from that collection
      if (selectedCollection) {
        const response = await fetch(`http://localhost:3001/api/collections/${selectedCollection}`);
        const data = await response.json();
        console.log('Loaded collection books:', data);
        setBooks(data.books || []);
        setCollectionBooks(data.books || []);
      } else {
        // Load all books
        const response = await fetch('http://localhost:3001/api/books?limit=500');
        const data = await response.json();
        console.log('Loaded books:', data);
        setBooks(data.books || []);
        setCollectionBooks([]);
      }
    } catch (error) {
      console.error('Failed to load books:', error);
      setBooks([]);
      setCollectionBooks([]);
    }
  };

  // Multi-select functions
  const toggleBookSelection = (bookId, event) => {
    if (event) {
      event.stopPropagation();
    }

    const newSelection = new Set(selectedBookIds);
    if (newSelection.has(bookId)) {
      newSelection.delete(bookId);
    } else {
      newSelection.add(bookId);
    }

    setSelectedBookIds(newSelection);

    // Enable selection mode if any book is selected
    if (newSelection.size > 0 && !isSelectionMode) {
      setIsSelectionMode(true);
    } else if (newSelection.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const selectAllVisible = () => {
    const newSelection = new Set(filteredAndSortedBooks.map(book => book.id));
    setSelectedBookIds(newSelection);
    setIsSelectionMode(true);
  };

  const clearSelection = () => {
    setSelectedBookIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkAction = async (action, params) => {
    const bookIds = Array.from(selectedBookIds);

    try {
      switch (action) {
        case 'addTags':
          const addTagsResponse = await fetch('http://localhost:3001/api/books/bulk/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookIds, tags: params.tags })
          });

          if (addTagsResponse.ok) {
            await loadBooks(); // Reload to show updated tags
            clearSelection();
          }
          break;

        case 'delete':
          const deleteResponse = await fetch('http://localhost:3001/api/books/bulk/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookIds })
          });

          if (deleteResponse.ok) {
            await loadBooks(); // Reload to remove deleted books
            clearSelection();
          }
          break;

        default:
          console.log('Unknown bulk action:', action);
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  // Remove a book from the current collection
  const removeBookFromCollection = async (bookId) => {
    if (!selectedCollection) return;

    try {
      const response = await fetch(`http://localhost:3001/api/collections/${selectedCollection}/books/${bookId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadBooks(); // Reload to update the list
      }
    } catch (error) {
      console.error('Failed to remove book from collection:', error);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  // Reload books when selected collection changes
  useEffect(() => {
    loadBooks();
  }, [selectedCollection]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
      {/* Collections Sidebar */}
      <CollectionsSidebar
        selectedCollection={selectedCollection}
        onCollectionSelect={setSelectedCollection}
        selectedBookIds={selectedBookIds}
        isSelectionMode={isSelectionMode}
      />

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Librarian {selectedCollection && <span className="text-lg text-gray-600 dark:text-gray-400 ml-2">/ Collection</span>}
            </h1>
            <div className="flex items-center space-x-4">
              {/* Multi-select controls */}
              {isSelectionMode && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-600">
                    {selectedBookIds.size} selected
                  </span>
                  <button
                    onClick={selectAllVisible}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setIsBulkActionsModalOpen(true)}
                    disabled={selectedBookIds.size === 0}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    Bulk Actions
                  </button>
                </div>
              )}

              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>

              <span className="text-sm text-gray-600 dark:text-gray-400">
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
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className={`px-4 py-2 rounded-lg transition-colors ${isSelectionMode ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                {isSelectionMode ? '✓ Selecting' : 'Select'}
              </button>
              <button
                onClick={loadBooks}
                disabled={loading}
                className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={handleScanLibrary}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Scanning...' : 'Scan Library'}
              </button>
              <button
                onClick={handleProcessBooks}
                disabled={loading}
                className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing...' : 'Process Books'}
              </button>
              <button
                onClick={handleGenerateThumbnails}
                disabled={loading}
                className="px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                📷 Generate Covers
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Bar - Also sticky below the header */}
      <div className="sticky top-16 z-40 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 shadow-sm transition-colors duration-200">
        <div className="flex items-center space-x-4">
          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags:</label>
              <select
                multiple
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Author:</label>
              <select
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</label>
            <select
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
            <select
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
              className="px-3 py-1 bg-red-500 dark:bg-red-600 text-white rounded-md text-sm hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
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
            <div className="text-lg text-gray-600 dark:text-gray-400">Scanning library...</div>
          </div>
        ) : !books || books.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 dark:text-gray-400 text-lg">
              No books found. Click "Scan Library" to discover books.
            </div>
          </div>
        ) : filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 dark:text-gray-400 text-lg">
              No books match your filters.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer group relative overflow-hidden"
                onClick={(e) => {
                  // Don't open modal if clicking on checkbox
                  if (e.target.type !== 'checkbox') {
                    setSelectedBook(book);
                    setIsModalOpen(true);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenPDF(book.id);
                }}
                title="Double-click to open PDF"
              >
                {/* Checkbox for selection */}
                {(isSelectionMode || selectedBookIds.size > 0) && (
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      checked={selectedBookIds.has(book.id)}
                      onChange={(e) => toggleBookSelection(book.id, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Remove from collection button */}
                {selectedCollection && (
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Remove this book from the collection?')) {
                          removeBookFromCollection(book.id);
                        }
                      }}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from collection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Book Cover Image */}
                <div className="h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
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
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-2" title={book.title}>
                  {book.title || 'Untitled'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                  {book.author || 'Unknown Author'}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
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

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedBooks={Array.from(selectedBookIds)}
        onBulkAction={handleBulkAction}
        allTags={allTags}
      />
      </div>
    </div>
  );
}

export default App;