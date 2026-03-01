const { db } = require('../database/init');
const pdf = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

class FullTextSearchService {
  constructor() {
    this.initializeFTS();
  }

  initializeFTS() {
    try {
      // Create FTS5 virtual table for full-text search
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
          book_id UNINDEXED,
          title,
          author,
          content,
          description,
          tokenize = 'unicode61'
        )
      `);

      // Create regular table for storing page-level content
      db.exec(`
        CREATE TABLE IF NOT EXISTS book_pages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          page_number INTEGER NOT NULL,
          content TEXT,
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          UNIQUE(book_id, page_number)
        )
      `);

      // Create index for faster page lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_book_pages_book_id
        ON book_pages(book_id)
      `);

      console.log('✅ Full-text search tables initialized');
    } catch (error) {
      console.error('Error initializing FTS:', error);
    }
  }

  async indexBook(bookId, forceReindex = false) {
    try {
      const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      // Check if already indexed
      const existingIndex = db.prepare(
        'SELECT book_id FROM books_fts WHERE book_id = ?'
      ).get(bookId);

      if (existingIndex && !forceReindex) {
        console.log(`Book ${bookId} already indexed, skipping...`);
        return { success: true, message: 'Already indexed' };
      }

      console.log(`Indexing book: ${book.title || book.file_path}`);

      // Extract text from PDF
      const pdfPath = book.file_path;
      const dataBuffer = await fs.readFile(pdfPath);
      const pdfData = await pdf(dataBuffer, {
        max: 0, // No page limit
        version: 'v2.0.550'
      });

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        console.log('  ⚠️ No text content found in PDF');
        return { success: false, message: 'No text content' };
      }

      // Begin transaction for better performance
      const transaction = db.transaction(() => {
        // Remove existing index if reindexing
        if (existingIndex && forceReindex) {
          db.prepare('DELETE FROM books_fts WHERE book_id = ?').run(bookId);
          db.prepare('DELETE FROM book_pages WHERE book_id = ?').run(bookId);
        }

        // Index the full content in FTS table
        const stmt = db.prepare(`
          INSERT INTO books_fts (book_id, title, author, content, description)
          VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
          bookId,
          book.title || '',
          book.author || '',
          pdfData.text,
          book.description || ''
        );

        // Store page-level content if available
        if (pdfData.pages && Array.isArray(pdfData.pages)) {
          const pageStmt = db.prepare(`
            INSERT OR REPLACE INTO book_pages (book_id, page_number, content)
            VALUES (?, ?, ?)
          `);

          pdfData.pages.forEach((page, index) => {
            if (page.pageContent) {
              pageStmt.run(bookId, index + 1, page.pageContent);
            }
          });
        }

        // Update the indexed status
        db.prepare(`
          UPDATE books
          SET indexed_at = datetime('now')
          WHERE id = ?
        `).run(bookId);
      });

      transaction();

      const wordCount = pdfData.text.split(/\s+/).length;
      console.log(`  ✅ Indexed successfully (${wordCount.toLocaleString()} words)`);

      return {
        success: true,
        message: 'Indexed successfully',
        wordCount,
        pageCount: pdfData.numpages
      };
    } catch (error) {
      console.error(`Error indexing book ${bookId}:`, error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async indexAllBooks() {
    console.log('\nStarting full-text indexing for all books...\n');

    const books = db.prepare(`
      SELECT id, title, file_path
      FROM books
      WHERE pdf_type != 'scanned' OR pdf_type IS NULL
      ORDER BY id
    `).all();

    const stats = {
      total: books.length,
      success: 0,
      failed: 0,
      skipped: 0
    };

    for (const book of books) {
      const result = await this.indexBook(book.id);
      if (result.success) {
        if (result.message === 'Already indexed') {
          stats.skipped++;
        } else {
          stats.success++;
        }
      } else {
        stats.failed++;
      }

      // Small delay to prevent overload
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(60));
    console.log('Indexing complete!');
    console.log(`  Total: ${stats.total}`);
    console.log(`  Success: ${stats.success}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Skipped: ${stats.skipped}`);

    return stats;
  }

  search(query, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        bookId = null,
        matchType = 'any' // 'any', 'all', 'phrase'
      } = options;

      // Prepare the search query based on match type
      let ftsQuery = query;
      if (matchType === 'all') {
        // All words must match
        ftsQuery = query.split(/\s+/).join(' AND ');
      } else if (matchType === 'phrase') {
        // Exact phrase match
        ftsQuery = `"${query}"`;
      }
      // 'any' is the default FTS5 behavior

      // Build the SQL query
      let sql = `
        SELECT
          b.id,
          b.title,
          b.author,
          b.file_path,
          b.thumbnail_path,
          b.isbn,
          b.publisher,
          b.publication_year,
          snippet(books_fts, 2, '<mark>', '</mark>', '...', 30) as snippet,
          rank as relevance
        FROM books_fts f
        JOIN books b ON f.book_id = b.id
        WHERE books_fts MATCH ?
      `;

      const params = [ftsQuery];

      if (bookId) {
        sql += ' AND b.id = ?';
        params.push(bookId);
      }

      sql += `
        ORDER BY rank
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);

      const results = db.prepare(sql).all(...params);

      // Get total count for pagination
      let countSql = `
        SELECT COUNT(*) as total
        FROM books_fts
        WHERE books_fts MATCH ?
      `;

      const countParams = [ftsQuery];
      if (bookId) {
        countSql += ' AND book_id = ?';
        countParams.push(bookId);
      }

      const { total } = db.prepare(countSql).get(...countParams);

      return {
        results,
        total,
        query,
        limit,
        offset
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        results: [],
        total: 0,
        query,
        error: error.message
      };
    }
  }

  searchInPages(bookId, query, options = {}) {
    try {
      const { limit = 10 } = options;

      // Search for the query in specific book pages
      const sql = `
        SELECT
          page_number,
          snippet(content, 0, '<mark>', '</mark>', '...', 30) as snippet,
          LENGTH(content) - LENGTH(REPLACE(LOWER(content), LOWER(?), '')) as match_count
        FROM book_pages
        WHERE book_id = ?
          AND content LIKE '%' || ? || '%'
        ORDER BY match_count DESC
        LIMIT ?
      `;

      const results = db.prepare(sql).all(query, bookId, query, limit);

      return {
        success: true,
        results,
        query
      };
    } catch (error) {
      console.error('Page search error:', error);
      return {
        success: false,
        results: [],
        error: error.message
      };
    }
  }

  getIndexStats() {
    try {
      const stats = db.prepare(`
        SELECT
          COUNT(DISTINCT book_id) as indexed_books,
          COUNT(*) as total_entries
        FROM books_fts
      `).get();

      const totalBooks = db.prepare('SELECT COUNT(*) as count FROM books').get().count;

      const pageStats = db.prepare(`
        SELECT
          COUNT(DISTINCT book_id) as books_with_pages,
          COUNT(*) as total_pages
        FROM book_pages
      `).get();

      return {
        totalBooks,
        indexedBooks: stats.indexed_books,
        totalEntries: stats.total_entries,
        booksWithPages: pageStats.books_with_pages,
        totalPages: pageStats.total_pages,
        coverage: Math.round((stats.indexed_books / totalBooks) * 100)
      };
    } catch (error) {
      console.error('Error getting index stats:', error);
      return null;
    }
  }

  rebuildIndex() {
    console.log('Rebuilding full-text search index...');

    // Clear existing index
    db.prepare('DELETE FROM books_fts').run();
    db.prepare('DELETE FROM book_pages').run();

    // Reindex all books
    return this.indexAllBooks();
  }
}

module.exports = new FullTextSearchService();