import React, { useState, useEffect } from 'react';

function ReadingStatsDashboard({ isDark }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentlyReadingBooks, setCurrentlyReadingBooks] = useState([]);
  const [recentlyReadBooks, setRecentlyReadBooks] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchCurrentlyReading();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/progress/reading/stats');
      const data = await response.json();
      setStats(data);
      setRecentlyReadBooks(data.recently_read || []);
    } catch (error) {
      console.error('Error fetching reading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentlyReading = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/progress/reading/all?status=reading');
      const data = await response.json();
      setCurrentlyReadingBooks(data);
    } catch (error) {
      console.error('Error fetching currently reading books:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-500 dark:text-gray-400">Loading reading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400">
        No reading statistics available
      </div>
    );
  }

  const completionRate = stats.books_started > 0 ?
    Math.round((stats.books_finished / stats.books_started) * 100) : 0;

  const averageReadingTime = stats.books_finished > 0 ?
    Math.round(stats.total_reading_time / stats.books_finished) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        📊 Reading Statistics
      </h2>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-1">
            Currently Reading
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            {stats.currently_reading || 0}
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-green-600 dark:text-green-400 text-sm font-medium mb-1">
            Books Finished
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100">
            {stats.books_finished || 0}
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="text-purple-600 dark:text-purple-400 text-sm font-medium mb-1">
            Total Pages Read
          </div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
            {stats.total_pages_read?.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
          <div className="text-orange-600 dark:text-orange-400 text-sm font-medium mb-1">
            Completion Rate
          </div>
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">
            {completionRate}%
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-4xl mb-2">📚</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.books_started || 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Books Started</div>
        </div>

        <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-4xl mb-2">⏱️</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(stats.total_reading_time / 60) || 0}h
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Reading Time</div>
        </div>

        <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-4xl mb-2">📈</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(stats.average_completion) || 0}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Average Progress</div>
        </div>
      </div>

      {/* Currently Reading Section */}
      {currentlyReadingBooks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📖 Currently Reading
          </h3>
          <div className="space-y-3">
            {currentlyReadingBooks.slice(0, 5).map(book => (
              <div
                key={book.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {book.title}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {book.author} • Page {book.current_page || 0} of {book.total_pages || 0}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(book.percentage || 0)}%
                    </div>
                  </div>
                  <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${book.percentage || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Read Section */}
      {recentlyReadBooks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🕒 Recently Read
          </h3>
          <div className="space-y-2">
            {recentlyReadBooks.map(book => (
              <div
                key={book.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {book.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {book.author}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(book.last_read).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No reading activity message */}
      {stats.books_started === 0 && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📚</div>
          <div className="text-xl text-gray-600 dark:text-gray-400">
            Start reading a book to see your statistics!
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Click on any book and use the "Start Reading" button to begin tracking your progress.
          </div>
        </div>
      )}
    </div>
  );
}

export default ReadingStatsDashboard;