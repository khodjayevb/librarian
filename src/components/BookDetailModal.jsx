import React, { useState, useEffect } from 'react';

function BookDetailModal({ book, isOpen, onClose, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBook, setEditedBook] = useState(book || {});
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [isEnrichingMetadata, setIsEnrichingMetadata] = useState(false);

  useEffect(() => {
    setEditedBook(book || {});
    if (book?.id) {
      fetchTags(book.id);
    }
  }, [book]);

  const fetchTags = async (bookId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/books/${bookId}/tags`);
      const data = await response.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedBook),
      });

      if (response.ok) {
        const updatedBook = await response.json();
        onUpdate(updatedBook);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to update book:', error);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;

    try {
      const response = await fetch(`http://localhost:3001/api/books/${book.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: newTag.trim() }),
      });

      if (response.ok) {
        fetchTags(book.id);
        setNewTag('');
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/books/${book.id}/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTags(tags.filter(tag => tag.id !== tagId));
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  const handleOpenFile = () => {
    if (book?.file_path) {
      fetch(`http://localhost:3001/api/books/${book.id}/open`, {
        method: 'POST',
      });
    }
  };

  const handleEnrichMetadata = async () => {
    if (!book?.id) return;

    setIsEnrichingMetadata(true);
    try {
      const response = await fetch(`http://localhost:3001/api/books/${book.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });

      const data = await response.json();

      if (data.success && data.book) {
        // Update the book with enriched metadata
        onUpdate(data.book);
        setEditedBook(data.book);

        // Show success message
        alert(`Metadata enriched successfully!\nSource: ${data.book.metadata_source || 'Multiple sources'}`);
      } else {
        alert(data.message || 'No additional metadata found for this book');
      }
    } catch (error) {
      console.error('Failed to enrich metadata:', error);
      alert('Failed to enrich metadata. Please try again.');
    } finally {
      setIsEnrichingMetadata(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Book Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {book && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editedBook.title || ''}
                  onChange={(e) => setEditedBook({ ...editedBook, title: e.target.value })}
                />
              ) : (
                <p className="text-gray-900">{book.title || 'Untitled'}</p>
              )}
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editedBook.author || ''}
                  onChange={(e) => setEditedBook({ ...editedBook, author: e.target.value })}
                />
              ) : (
                <p className="text-gray-900">{book.author || 'Unknown Author'}</p>
              )}
            </div>

            {/* ISBN and Publisher */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editedBook.isbn || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, isbn: e.target.value })}
                    placeholder="978-0-123456-78-9"
                  />
                ) : (
                  <p className="text-gray-900 font-mono">{book.isbn || 'Not available'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editedBook.publisher || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, publisher: e.target.value })}
                    placeholder="Publisher name"
                  />
                ) : (
                  <p className="text-gray-900">{book.publisher || 'Unknown'}</p>
                )}
              </div>
            </div>

            {/* Edition and Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editedBook.edition || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, edition: e.target.value })}
                    placeholder="e.g. 2nd Edition"
                  />
                ) : (
                  <p className="text-gray-900">{book.edition || 'Not specified'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publication Year</label>
                {isEditing ? (
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editedBook.publication_year || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, publication_year: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="e.g. 2024"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                ) : (
                  <p className="text-gray-900">{book.publication_year || 'Unknown'}</p>
                )}
              </div>
            </div>

            {/* Description */}
            {(book.description || isEditing) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                {isEditing ? (
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editedBook.description || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, description: e.target.value })}
                    placeholder="Book description..."
                    rows="3"
                  />
                ) : (
                  <p className="text-gray-900 text-sm">{book.description}</p>
                )}
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                {isEditing ? (
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editedBook.language || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, language: e.target.value })}
                  >
                    <option value="">Unknown</option>
                    <option value="Russian">Russian</option>
                    <option value="English">English</option>
                    <option value="Ukrainian">Ukrainian</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <p className="text-gray-900">{book.language || 'Unknown'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pages</label>
                <p className="text-gray-900">{book.page_count || 'Unknown'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF Type</label>
                <p className="text-gray-900">{book.pdf_type || 'Unknown'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Size</label>
                <p className="text-gray-900">
                  {book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Added</label>
                <p className="text-gray-900">
                  {book.date_added ? new Date(book.date_added).toLocaleDateString() : 'Unknown'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Modified</label>
                <p className="text-gray-900">
                  {book.last_modified ? new Date(book.last_modified).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
            </div>

            {/* File Path */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
              <p className="text-gray-600 text-sm break-all">{book.file_path}</p>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                  <span
                    key={tag.id}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                  >
                    {tag.name}
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveTag(tag.id)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Status Indicators */}
            <div className="flex gap-4">
              {book.needs_review === 1 && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                  ⚠️ Needs Review
                </span>
              )}
              {book.ocr_confidence && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  OCR: {book.ocr_confidence}% confidence
                </span>
              )}
              {book.metadata_source && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  📚 {book.metadata_source}
                </span>
              )}
              {book.average_rating && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  ⭐ {book.average_rating.toFixed(1)}
                </span>
              )}
            </div>

            {/* Categories if available */}
            {book.categories && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(book.categories).map((category, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <div className="flex gap-2">
                <button
                  onClick={handleOpenFile}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Open PDF
                </button>

                <button
                  onClick={handleEnrichMetadata}
                  disabled={isEnrichingMetadata}
                  className={`px-4 py-2 rounded-md text-white ${
                    isEnrichingMetadata
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-purple-500 hover:bg-purple-600'
                  }`}
                >
                  {isEnrichingMetadata ? 'Fetching...' : 'Fetch Metadata'}
                </button>
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookDetailModal;