const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const thumbnailGenerator = require('../services/thumbnailGeneratorPdfjs');

// Get all books with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const language = req.query.language || '';

    let query = 'SELECT * FROM books WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (title LIKE ? OR author LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (language) {
      query += ' AND language = ?';
      params.push(language);
    }

    query += ' ORDER BY date_added DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const books = db.prepare(query).all(...params);

    // Add thumbnail URLs to each book
    books.forEach(book => {
      if (book.thumbnail_path) {
        book.thumbnail_url = `http://localhost:3001${book.thumbnail_path}`;
      }
    });

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM books WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ' AND (title LIKE ? OR author LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (language) {
      countQuery += ' AND language = ?';
      countParams.push(language);
    }

    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get single book by ID
router.get('/:id', (req, res) => {
  try {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Get tags
    const tags = db.prepare(`
      SELECT t.* FROM tags t
      JOIN book_tags bt ON t.id = bt.tag_id
      WHERE bt.book_id = ?
    `).all(req.params.id);

    // Get categories
    const categories = db.prepare(`
      SELECT c.* FROM categories c
      JOIN book_categories bc ON c.id = bc.category_id
      WHERE bc.book_id = ?
    `).all(req.params.id);

    res.json({ ...book, tags, categories });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Add new book manually
router.post('/', (req, res) => {
  try {
    const { title, author, language, file_path, tags = [], categories = [] } = req.body;

    if (!file_path) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const result = db.prepare(`
      INSERT INTO books (title, author, language, file_path, manual_metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, author, language, file_path, JSON.stringify(req.body));

    const bookId = result.lastInsertRowid;

    // Add tags
    if (tags.length > 0) {
      const insertTag = db.prepare('INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)');
      tags.forEach(tagId => {
        insertTag.run(bookId, tagId);
      });
    }

    // Add categories
    if (categories.length > 0) {
      const insertCategory = db.prepare('INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)');
      categories.forEach(categoryId => {
        insertCategory.run(bookId, categoryId);
      });
    }

    res.status(201).json({ id: bookId, message: 'Book added successfully' });
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

// Update book metadata
router.put('/:id', (req, res) => {
  try {
    const { title, author, language, tags, categories } = req.body;

    db.prepare(`
      UPDATE books
      SET title = ?, author = ?, language = ?, last_modified = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, author, language, req.params.id);

    // Update tags if provided
    if (tags !== undefined) {
      db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(req.params.id);
      if (tags.length > 0) {
        const insertTag = db.prepare('INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)');
        tags.forEach(tagId => {
          insertTag.run(req.params.id, tagId);
        });
      }
    }

    // Update categories if provided
    if (categories !== undefined) {
      db.prepare('DELETE FROM book_categories WHERE book_id = ?').run(req.params.id);
      if (categories.length > 0) {
        const insertCategory = db.prepare('INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)');
        categories.forEach(categoryId => {
          insertCategory.run(req.params.id, categoryId);
        });
      }
    }

    res.json({ message: 'Book updated successfully' });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Delete book
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Get tags for a book
router.get('/:id/tags', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      JOIN book_tags bt ON t.id = bt.tag_id
      WHERE bt.book_id = ?
    `).all(req.params.id);

    res.json({ tags });
  } catch (error) {
    console.error('Error fetching book tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Add tag to book
router.post('/:id/tags', (req, res) => {
  try {
    const { tag } = req.body;

    if (!tag) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    // First try to find existing tag
    let tagRecord = db.prepare('SELECT * FROM tags WHERE name = ?').get(tag);

    // If tag doesn't exist, create it
    if (!tagRecord) {
      const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(tag);
      tagRecord = { id: result.lastInsertRowid, name: tag };
    }

    // Add tag to book (ignore if already exists)
    try {
      db.prepare('INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)').run(req.params.id, tagRecord.id);
    } catch (err) {
      // Tag already exists for this book, that's okay
      if (!err.message.includes('UNIQUE constraint failed')) {
        throw err;
      }
    }

    res.json({ message: 'Tag added successfully', tag: tagRecord });
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// Remove tag from book
router.delete('/:id/tags/:tagId', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?')
      .run(req.params.id, req.params.tagId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tag not found for this book' });
    }

    res.json({ message: 'Tag removed successfully' });
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Generate thumbnail for a book
router.post('/:id/thumbnail', async (req, res) => {
  try {
    const book = db.prepare('SELECT id, file_path FROM books WHERE id = ?').get(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const result = await thumbnailGenerator.generateThumbnail(book.file_path, book.id);

    if (result.success) {
      // Update book record with thumbnail path
      db.prepare('UPDATE books SET thumbnail_path = ? WHERE id = ?')
        .run(result.thumbnail, book.id);

      res.json({
        message: 'Thumbnail generated successfully',
        thumbnail: result.thumbnail
      });
    } else {
      res.status(500).json({ error: 'Failed to generate thumbnail' });
    }
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// Generate thumbnails for all books
router.post('/thumbnails/batch', async (req, res) => {
  try {
    const books = db.prepare('SELECT id, file_path FROM books WHERE thumbnail_path IS NULL LIMIT 50').all();

    res.json({
      message: 'Thumbnail generation started',
      count: books.length
    });

    // Generate thumbnails in the background
    thumbnailGenerator.generateBatch(books, (progress) => {
      console.log(`Generating thumbnails: ${progress.current}/${progress.total}`);
    }).then(results => {
      // Update database with results
      results.forEach(result => {
        if (result.success && !result.skipped) {
          db.prepare('UPDATE books SET thumbnail_path = ? WHERE id = ?')
            .run(result.thumbnail, result.bookId);
        }
      });
      console.log('Batch thumbnail generation complete');
    });
  } catch (error) {
    console.error('Error in batch thumbnail generation:', error);
    res.status(500).json({ error: 'Failed to start thumbnail generation' });
  }
});

// Open PDF file
router.post('/:id/open', (req, res) => {
  try {
    const book = db.prepare('SELECT file_path FROM books WHERE id = ?').get(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Update last opened timestamp
    db.prepare('UPDATE books SET last_opened = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    // Use platform-specific command to open PDF
    const { exec } = require('child_process');
    const platform = process.platform;

    let command;
    if (platform === 'darwin') {
      // macOS
      command = `open "${book.file_path}"`;
    } else if (platform === 'win32') {
      // Windows
      command = `start "" "${book.file_path}"`;
    } else {
      // Linux
      command = `xdg-open "${book.file_path}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.error('Error opening file:', error);
        return res.status(500).json({ error: 'Failed to open PDF file' });
      }
      res.json({ message: 'PDF opened successfully' });
    });
  } catch (error) {
    console.error('Error opening PDF:', error);
    res.status(500).json({ error: 'Failed to open PDF' });
  }
});

module.exports = router;