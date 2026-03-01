const express = require('express');
const router = express.Router();
const fullTextSearch = require('../services/fullTextSearch');
const { db } = require('../database/init');

// Full-text search across all books
router.get('/books', async (req, res) => {
  try {
    const {
      q: query,
      limit = 20,
      offset = 0,
      matchType = 'any',
      bookId
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    const results = fullTextSearch.search(query, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      matchType,
      bookId: bookId ? parseInt(bookId) : null
    });

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Search within a specific book's pages
router.get('/books/:id/pages', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const { q: query, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    const results = fullTextSearch.searchInPages(bookId, query, {
      limit: parseInt(limit)
    });

    res.json(results);
  } catch (error) {
    console.error('Page search error:', error);
    res.status(500).json({
      error: 'Page search failed',
      message: error.message
    });
  }
});

// Index a single book
router.post('/index/book/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const { force = false } = req.body;

    const result = await fullTextSearch.indexBook(bookId, force);

    res.json(result);
  } catch (error) {
    console.error('Indexing error:', error);
    res.status(500).json({
      error: 'Indexing failed',
      message: error.message
    });
  }
});

// Index all books
router.post('/index/all', async (req, res) => {
  try {
    // Start indexing in background
    res.json({
      success: true,
      message: 'Indexing started in background'
    });

    // Run indexing asynchronously
    fullTextSearch.indexAllBooks()
      .then(stats => {
        console.log('Full-text indexing complete:', stats);
      })
      .catch(error => {
        console.error('Full-text indexing error:', error);
      });
  } catch (error) {
    console.error('Indexing error:', error);
    res.status(500).json({
      error: 'Failed to start indexing',
      message: error.message
    });
  }
});

// Rebuild the entire index
router.post('/index/rebuild', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Index rebuild started in background'
    });

    fullTextSearch.rebuildIndex()
      .then(stats => {
        console.log('Index rebuild complete:', stats);
      })
      .catch(error => {
        console.error('Index rebuild error:', error);
      });
  } catch (error) {
    console.error('Rebuild error:', error);
    res.status(500).json({
      error: 'Failed to rebuild index',
      message: error.message
    });
  }
});

// Get index statistics
router.get('/index/stats', (req, res) => {
  try {
    const stats = fullTextSearch.getIndexStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

// Search suggestions (autocomplete)
router.get('/suggestions', (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Get unique words from titles and authors for suggestions
    const suggestions = db.prepare(`
      SELECT DISTINCT title as suggestion, 'title' as type
      FROM books
      WHERE title LIKE ? || '%'
      UNION
      SELECT DISTINCT author as suggestion, 'author' as type
      FROM books
      WHERE author LIKE ? || '%'
      LIMIT 10
    `).all(query, query);

    res.json(suggestions);
  } catch (error) {
    console.error('Suggestions error:', error);
    res.json([]);
  }
});

module.exports = router;