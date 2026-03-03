import React, { useState } from 'react';
import ReadingProgress from './ReadingProgress';

const BookCard = ({
  book,
  isSelected,
  onSelect,
  onDoubleClick,
  onClick,
  onRemoveFromCollection,
  selectedCollection
}) => {
  const [imageError, setImageError] = useState(false);

  const getLanguageBadgeClass = (language) => {
    if (!language || language === 'Not scanned') return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
    if (language === 'Russian') return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200';
    if (language === 'English') return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200';
    if (language === 'unknown') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const getPdfTypeBadgeClass = (pdfType) => {
    switch(pdfType) {
      case 'searchable': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200';
      case 'scanned': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200';
      case 'mixed': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200';
      case 'unknown': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPdfTypeIcon = (pdfType) => {
    switch(pdfType) {
      case 'searchable': return '📝';
      case 'scanned': return '📷';
      case 'mixed': return '📑';
      case 'unknown': return '❓';
      default: return '';
    }
  };

  return (
    <div
      className={`
        relative group cursor-pointer overflow-hidden
        bg-white dark:bg-gray-800
        rounded-xl shadow-md hover:shadow-xl
        transition-all duration-300 transform hover:-translate-y-1
        border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'}
      `}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div
          className="absolute top-3 left-3 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(book.id, e.target.checked);
            }}
            className="w-5 h-5 text-blue-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:border-gray-600 cursor-pointer shadow-sm"
          />
        </div>
      )}

      {/* Remove from Collection Button */}
      {selectedCollection && onRemoveFromCollection && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Remove this book from the collection?')) {
              onRemoveFromCollection(book.id);
            }
          }}
          className="absolute top-3 right-3 z-20 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove from collection"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Book Cover Section - Prominent Display */}
      <div className="relative w-full aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
        {book.thumbnail_url && !imageError ? (
          <img
            src={book.thumbnail_url}
            alt={book.title || 'Book cover'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <div className="text-6xl mb-3 opacity-50">📚</div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 line-clamp-2">
                {book.title || 'Untitled'}
              </p>
              {book.author && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-1">
                  {book.author}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <div className="text-white">
            <p className="text-sm font-semibold mb-1 line-clamp-2">{book.title || 'Untitled'}</p>
            <p className="text-xs opacity-90">Double-click to open</p>
          </div>
        </div>

        {/* Language Badge - Top Right of Image */}
        <div className="absolute top-3 right-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium shadow-sm ${getLanguageBadgeClass(book.language)}`}>
            {!book.language || book.language === 'Not scanned' ? '⚠️' : book.language}
          </span>
        </div>
      </div>

      {/* Book Information Section */}
      <div className="p-4 space-y-2">
        {/* Title and Author */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 text-sm" title={book.title}>
            {book.title || 'Untitled'}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-1">
            {book.author || 'Unknown Author'}
          </p>
        </div>

        {/* Year and Pages */}
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          {book.publication_year && (
            <span>Year: {book.publication_year}</span>
          )}
          {book.page_count && (
            <span>Pages: {book.page_count}</span>
          )}
        </div>

        {/* PDF Status */}
        {book.pdf_type && (
          <div className="flex items-center">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPdfTypeBadgeClass(book.pdf_type)}`}>
              {getPdfTypeIcon(book.pdf_type)} {book.pdf_type}
            </span>
          </div>
        )}

        {/* Reading Progress */}
        <div className="pt-1">
          <ReadingProgress book={book} compact={true} />
        </div>
      </div>
    </div>
  );
};

export default BookCard;