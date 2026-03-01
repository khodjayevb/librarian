import React, { useState, useEffect } from 'react';

function CollectionsSidebar({ selectedCollection, onCollectionSelect, selectedBookIds, isSelectionMode }) {
  const [collections, setCollections] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [loading, setLoading] = useState(false);

  // Load collections
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/collections');
      const data = await response.json();
      setCollections(data.collections || []);

      // Initialize default collections if empty
      if (!data.collections || data.collections.length === 0) {
        await initializeDefaults();
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  };

  const initializeDefaults = async () => {
    try {
      await fetch('http://localhost:3001/api/collections/init-defaults', {
        method: 'POST'
      });
      await loadCollections();
    } catch (error) {
      console.error('Failed to initialize default collections:', error);
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      const response = await fetch('http://localhost:3001/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName })
      });

      if (response.ok) {
        setNewCollectionName('');
        setIsCreating(false);
        await loadCollections();
      }
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  };

  const addSelectedBooksToCollection = async (collectionId) => {
    if (selectedBookIds.size === 0) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/collections/${collectionId}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookIds: Array.from(selectedBookIds) })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        await loadCollections(); // Refresh counts
      }
    } catch (error) {
      console.error('Failed to add books to collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCollection = async (id) => {
    if (!window.confirm('Are you sure you want to delete this collection?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/collections/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadCollections();
        if (selectedCollection === id) {
          onCollectionSelect(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-full overflow-y-auto transition-colors duration-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Collections</h2>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="text-blue-500 hover:text-blue-600"
              title="Create new collection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {isCreating && (
          <div className="mb-4">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createCollection()}
              placeholder="Collection name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex space-x-2 mt-2">
              <button
                onClick={createCollection}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewCollectionName('');
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* All Books */}
        <div
          className={`p-3 rounded-lg cursor-pointer transition-colors ${
            selectedCollection === null
              ? 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          onClick={() => onCollectionSelect(null)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xl">📚</span>
              <span className="font-medium text-gray-800 dark:text-gray-100">All Books</span>
            </div>
          </div>
        </div>

        {/* Collections List */}
        <div className="mt-2 space-y-1">
          {collections.map((collection) => (
            <div key={collection.id} className="group relative">
              <div
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedCollection === collection.id
                    ? 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => onCollectionSelect(collection.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{collection.icon || '📁'}</span>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">{collection.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{collection.book_count || 0} books</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isSelectionMode && selectedBookIds.size > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addSelectedBooksToCollection(collection.id);
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Add selected books"
                        disabled={loading}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCollection(collection.id);
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete collection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick add to collection when in selection mode */}
        {isSelectionMode && selectedBookIds.size > 0 && (
          <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              {selectedBookIds.size} book{selectedBookIds.size !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300">
              Click the + icon next to a collection to add selected books
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CollectionsSidebar;