const express = require('express');
const router = express.Router();
const { db } = require('../database/init');

// Get reading progress for a book
router.get('/books/:id/progress', (req, res) => {
  try {
    const bookId = req.params.id;

    const progress = db.prepare(`
      SELECT
        rp.*,
        b.page_count as book_page_count,
        b.title,
        b.author
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.book_id = ?
    `).get(bookId);

    if (!progress) {
      // Return default progress if not started
      const book = db.prepare('SELECT page_count, title, author FROM books WHERE id = ?').get(bookId);
      if (!book) {
        return res.status(404).json({ error: 'Book not found' });
      }

      return res.json({
        book_id: parseInt(bookId),
        current_page: 0,
        total_pages: book.page_count || 0,
        percentage: 0,
        reading_time_minutes: 0,
        last_read: null,
        started_reading: null,
        finished_reading: null,
        title: book.title,
        author: book.author
      });
    }

    res.json(progress);
  } catch (error) {
    console.error('Error fetching reading progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update reading progress
router.put('/books/:id/progress', (req, res) => {
  try {
    const bookId = req.params.id;
    const { current_page, total_pages } = req.body;

    // Validate book exists
    const book = db.prepare('SELECT page_count FROM books WHERE id = ?').get(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const actualTotalPages = total_pages || book.page_count || 0;
    const percentage = actualTotalPages > 0 ? (current_page / actualTotalPages) * 100 : 0;

    // Check if progress exists
    const existing = db.prepare('SELECT * FROM reading_progress WHERE book_id = ?').get(bookId);

    let result;
    const now = new Date().toISOString();

    if (existing) {
      // Update existing progress
      const updateData = {
        current_page,
        total_pages: actualTotalPages,
        percentage: Math.min(100, Math.round(percentage * 100) / 100),
        last_read: now
      };

      // Mark as started if not already
      if (!existing.started_reading && current_page > 0) {
        updateData.started_reading = now;
      }

      // Mark as finished if completed
      if (current_page >= actualTotalPages && actualTotalPages > 0) {
        updateData.finished_reading = now;
      }

      const updateQuery = `
        UPDATE reading_progress
        SET current_page = @current_page,
            total_pages = @total_pages,
            percentage = @percentage,
            last_read = @last_read
            ${updateData.started_reading ? ', started_reading = @started_reading' : ''}
            ${updateData.finished_reading ? ', finished_reading = @finished_reading' : ''}
        WHERE book_id = ${bookId}
      `;

      result = db.prepare(updateQuery).run(updateData);
    } else {
      // Insert new progress
      const insertData = {
        book_id: bookId,
        current_page,
        total_pages: actualTotalPages,
        percentage: Math.min(100, Math.round(percentage * 100) / 100),
        last_read: now,
        started_reading: current_page > 0 ? now : null,
        finished_reading: current_page >= actualTotalPages && actualTotalPages > 0 ? now : null,
        reading_time_minutes: 0
      };

      result = db.prepare(`
        INSERT INTO reading_progress (
          book_id, current_page, total_pages, percentage,
          last_read, started_reading, finished_reading, reading_time_minutes
        ) VALUES (
          @book_id, @current_page, @total_pages, @percentage,
          @last_read, @started_reading, @finished_reading, @reading_time_minutes
        )
      `).run(insertData);
    }

    // Fetch and return updated progress
    const updatedProgress = db.prepare(`
      SELECT
        rp.*,
        b.title,
        b.author
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.book_id = ?
    `).get(bookId);

    res.json(updatedProgress);
  } catch (error) {
    console.error('Error updating reading progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark book as started
router.post('/books/:id/progress/start', (req, res) => {
  try {
    const bookId = req.params.id;
    const now = new Date().toISOString();

    // Check if book exists
    const book = db.prepare('SELECT page_count FROM books WHERE id = ?').get(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Check if progress exists
    const existing = db.prepare('SELECT * FROM reading_progress WHERE book_id = ?').get(bookId);

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE reading_progress
        SET started_reading = ?, last_read = ?
        WHERE book_id = ? AND started_reading IS NULL
      `).run(now, now, bookId);
    } else {
      // Create new progress entry
      db.prepare(`
        INSERT INTO reading_progress (
          book_id, current_page, total_pages, percentage,
          started_reading, last_read, reading_time_minutes
        ) VALUES (?, 0, ?, 0, ?, ?, 0)
      `).run(bookId, book.page_count || 0, now, now);
    }

    res.json({ success: true, started_reading: now });
  } catch (error) {
    console.error('Error starting book:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark book as finished
router.post('/books/:id/progress/finish', (req, res) => {
  try {
    const bookId = req.params.id;
    const now = new Date().toISOString();

    // Check if book exists
    const book = db.prepare('SELECT page_count FROM books WHERE id = ?').get(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Update progress to 100%
    db.prepare(`
      UPDATE reading_progress
      SET finished_reading = ?,
          current_page = total_pages,
          percentage = 100,
          last_read = ?
      WHERE book_id = ?
    `).run(now, now, bookId);

    res.json({ success: true, finished_reading: now });
  } catch (error) {
    console.error('Error finishing book:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all books with reading progress
router.get('/reading/all', (req, res) => {
  try {
    const { status } = req.query; // 'reading', 'finished', 'not_started'

    let query = `
      SELECT
        b.id,
        b.title,
        b.author,
        b.thumbnail_path,
        b.page_count as book_page_count,
        COALESCE(rp.current_page, 0) as current_page,
        COALESCE(rp.total_pages, b.page_count, 0) as total_pages,
        COALESCE(rp.percentage, 0) as percentage,
        rp.last_read,
        rp.started_reading,
        rp.finished_reading,
        rp.reading_time_minutes,
        CASE
          WHEN rp.finished_reading IS NOT NULL THEN 'finished'
          WHEN rp.started_reading IS NOT NULL THEN 'reading'
          ELSE 'not_started'
        END as reading_status
      FROM books b
      LEFT JOIN reading_progress rp ON b.id = rp.book_id
    `;

    const params = [];

    if (status === 'reading') {
      query += ' WHERE rp.started_reading IS NOT NULL AND rp.finished_reading IS NULL';
    } else if (status === 'finished') {
      query += ' WHERE rp.finished_reading IS NOT NULL';
    } else if (status === 'not_started') {
      query += ' WHERE rp.started_reading IS NULL OR rp.book_id IS NULL';
    }

    query += ' ORDER BY rp.last_read DESC, b.date_added DESC';

    const books = db.prepare(query).all(...params);
    res.json(books);
  } catch (error) {
    console.error('Error fetching reading progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reading statistics
router.get('/reading/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN rp.started_reading IS NOT NULL THEN rp.book_id END) as books_started,
        COUNT(DISTINCT CASE WHEN rp.finished_reading IS NOT NULL THEN rp.book_id END) as books_finished,
        COUNT(DISTINCT CASE WHEN rp.started_reading IS NOT NULL AND rp.finished_reading IS NULL THEN rp.book_id END) as currently_reading,
        SUM(CASE WHEN rp.current_page IS NOT NULL THEN rp.current_page ELSE 0 END) as total_pages_read,
        SUM(CASE WHEN rp.reading_time_minutes IS NOT NULL THEN rp.reading_time_minutes ELSE 0 END) as total_reading_time,
        AVG(CASE WHEN rp.percentage IS NOT NULL THEN rp.percentage ELSE 0 END) as average_completion,
        COUNT(DISTINCT b.id) as total_books
      FROM books b
      LEFT JOIN reading_progress rp ON b.id = rp.book_id
    `).get();

    // Get recently read books
    const recentlyRead = db.prepare(`
      SELECT
        b.id,
        b.title,
        b.author,
        b.thumbnail_path,
        rp.current_page,
        rp.total_pages,
        rp.percentage,
        rp.last_read
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.last_read IS NOT NULL
      ORDER BY rp.last_read DESC
      LIMIT 5
    `).all();

    res.json({
      ...stats,
      recently_read: recentlyRead
    });
  } catch (error) {
    console.error('Error fetching reading statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update reading time
router.post('/books/:id/progress/time', (req, res) => {
  try {
    const bookId = req.params.id;
    const { minutes } = req.body;

    // Update or add to existing reading time
    db.prepare(`
      UPDATE reading_progress
      SET reading_time_minutes = reading_time_minutes + ?,
          last_read = ?
      WHERE book_id = ?
    `).run(minutes, new Date().toISOString(), bookId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating reading time:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear reading progress for a book
router.delete('/books/:id/progress', (req, res) => {
  try {
    const bookId = req.params.id;

    const result = db.prepare('DELETE FROM reading_progress WHERE book_id = ?').run(bookId);

    res.json({
      success: true,
      deleted: result.changes > 0
    });
  } catch (error) {
    console.error('Error clearing reading progress:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;