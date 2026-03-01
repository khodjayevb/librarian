const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const thumbnailGenerator = require('../services/thumbnailGeneratorPdf2pic');
const fs = require('fs');
const path = require('path');

// IMPORTANT: Bulk routes must come BEFORE /:id routes to avoid route matching issues

// Bulk operations

// Bulk add tags to multiple books
router.post('/bulk/tags', (req, res) => {
  try {
    const { bookIds, tags } = req.body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ error: 'Book IDs are required' });
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags are required' });
    }

    // Start a transaction for better performance
    const transaction = db.transaction(() => {
      for (const tagName of tags) {
        // First ensure tag exists
        let tagRecord = db.prepare('SELECT * FROM tags WHERE name = ?').get(tagName);

        if (!tagRecord) {
          const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(tagName);
          tagRecord = { id: result.lastInsertRowid, name: tagName };
        }

        // Add tag to each book
        for (const bookId of bookIds) {
          try {
            db.prepare('INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)').run(bookId, tagRecord.id);
          } catch (err) {
            // Ignore duplicate entries
            if (!err.message.includes('UNIQUE constraint failed')) {
              throw err;
            }
          }
        }
      }
    });

    transaction();

    res.json({
      message: `Successfully added ${tags.length} tag(s) to ${bookIds.length} book(s)`,
      bookIds,
      tags
    });
  } catch (error) {
    console.error('Error bulk adding tags:', error);
    res.status(500).json({ error: 'Failed to add tags' });
  }
});

// Bulk remove tags from multiple books
router.delete('/bulk/tags', (req, res) => {
  try {
    const { bookIds, tagIds } = req.body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ error: 'Book IDs are required' });
    }

    let query = 'DELETE FROM book_tags WHERE book_id IN (' + bookIds.map(() => '?').join(',') + ')';
    const params = [...bookIds];

    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      query += ' AND tag_id IN (' + tagIds.map(() => '?').join(',') + ')';
      params.push(...tagIds);
    }

    const result = db.prepare(query).run(...params);

    res.json({
      message: `Removed tags from ${bookIds.length} book(s)`,
      removed: result.changes
    });
  } catch (error) {
    console.error('Error bulk removing tags:', error);
    res.status(500).json({ error: 'Failed to remove tags' });
  }
});

// Bulk delete books
router.delete('/bulk/delete', (req, res) => {
  try {
    const { bookIds } = req.body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ error: 'Book IDs are required' });
    }

    const query = 'DELETE FROM books WHERE id IN (' + bookIds.map(() => '?').join(',') + ')';
    const result = db.prepare(query).run(...bookIds);

    res.json({
      message: `Successfully deleted ${result.changes} book(s)`,
      deleted: result.changes
    });
  } catch (error) {
    console.error('Error bulk deleting books:', error);
    res.status(500).json({ error: 'Failed to delete books' });
  }
});

// Bulk update metadata
router.put('/bulk/update', (req, res) => {
  try {
    const { bookIds, updates } = req.body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ error: 'Book IDs are required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Updates are required' });
    }

    // Build dynamic update query
    const allowedFields = ['author', 'language'];
    const updateFields = [];
    const params = [];

    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field) && value !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(value);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Execute update for each book
    const transaction = db.transaction(() => {
      const query = `UPDATE books SET ${updateFields.join(', ')}, last_modified = CURRENT_TIMESTAMP WHERE id = ?`;
      const stmt = db.prepare(query);

      for (const bookId of bookIds) {
        stmt.run(...params, bookId);
      }
    });

    transaction();

    res.json({
      message: `Successfully updated ${bookIds.length} book(s)`,
      bookIds,
      updates
    });
  } catch (error) {
    console.error('Error bulk updating books:', error);
    res.status(500).json({ error: 'Failed to update books' });
  }
});

// Individual book routes

// Get all books with pagination and filtering
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Filter parameters
    const search = req.query.search || '';
    const tags = req.query.tags ? req.query.tags.split(',') : [];
    const author = req.query.author || '';
    const fileType = req.query.fileType || '';
    const language = req.query.language || '';
    const sortBy = req.query.sortBy || 'date_added';
    const sortOrder = req.query.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let query = 'SELECT DISTINCT b.* FROM books b WHERE 1=1';
    const params = [];

    // Search filter
    if (search) {
      query += ' AND (b.title LIKE ? OR b.author LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Author filter
    if (author) {
      query += ' AND b.author = ?';
      params.push(author);
    }

    // File type filter
    if (fileType) {
      query += ' AND LOWER(SUBSTR(b.file_path, -LENGTH(?))) = LOWER(?)';
      params.push(`.${fileType}`, `.${fileType}`);
    }

    // Language filter
    if (language) {
      query += ' AND b.language = ?';
      params.push(language);
    }

    // Tags filter (if we have tags in the query)
    if (tags.length > 0) {
      query = `SELECT DISTINCT b.* FROM books b
               INNER JOIN book_tags bt ON b.id = bt.book_id
               INNER JOIN tags t ON bt.tag_id = t.id
               WHERE 1=1`;

      if (search) {
        query += ' AND (b.title LIKE ? OR b.author LIKE ?)';
      }
      if (author) {
        query += ' AND b.author = ?';
      }
      if (fileType) {
        query += ' AND LOWER(SUBSTR(b.file_path, -LENGTH(?))) = LOWER(?)';
      }
      if (language) {
        query += ' AND b.language = ?';
      }

      query += ' AND t.name IN (' + tags.map(() => '?').join(',') + ')';
      query += ' GROUP BY b.id HAVING COUNT(DISTINCT t.name) = ?';
      params.push(...tags, tags.length);
    }

    // Sorting
    const validSortColumns = ['title', 'author', 'date_added', 'file_size'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'date_added';
    query += ` ORDER BY b.${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const books = db.prepare(query).all(...params);

    // Add thumbnail URLs and tags to each book
    books.forEach(book => {
      if (book.thumbnail_path) {
        book.thumbnail_url = `http://localhost:3001${book.thumbnail_path}`;
      }

      // Get tags for this book
      const bookTags = db.prepare(`
        SELECT t.name FROM tags t
        INNER JOIN book_tags bt ON t.id = bt.tag_id
        WHERE bt.book_id = ?
      `).all(book.id);

      book.tags = bookTags.map(t => t.name);
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
    // Get books that don't have thumbnails yet
    // First check which books don't have actual thumbnail files
    const allBooks = db.prepare('SELECT id, file_path FROM books').all();
    const booksWithoutThumbnails = [];

    for (const book of allBooks) {
      const thumbnailPath = path.join(__dirname, '../../public/thumbnails', `book_${book.id}.jpg`);
      if (!fs.existsSync(thumbnailPath)) {
        booksWithoutThumbnails.push(book);
      }
    }

    // Process up to 50 books that don't have thumbnails
    const books = booksWithoutThumbnails.slice(0, 50);

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