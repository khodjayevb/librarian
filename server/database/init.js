const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determine database path
const dbPath = path.join(__dirname, '../../data');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

// Initialize database
const db = new Database(path.join(dbPath, 'librarian.db'));
db.pragma('journal_mode = WAL'); // Better performance for concurrent access

// Create tables
const createTables = () => {
  // Books table
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      author TEXT,
      language TEXT,
      file_path TEXT UNIQUE NOT NULL,
      file_size INTEGER,
      page_count INTEGER,
      pdf_type TEXT CHECK(pdf_type IN ('searchable', 'scanned', 'mixed', 'unknown')),
      ocr_confidence REAL,
      needs_review INTEGER DEFAULT 0,
      manual_metadata TEXT,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_opened DATETIME
    )
  `);

  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT
    )
  `);

  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      parent_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    )
  `);

  // Book-Tags relationship
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_tags (
      book_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (book_id, tag_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Book-Categories relationship
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_categories (
      book_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (book_id, category_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `);

  // Book notes
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  // Reading progress
  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      book_id INTEGER PRIMARY KEY,
      current_page INTEGER,
      total_pages INTEGER,
      last_read DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
    CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
    CREATE INDEX IF NOT EXISTS idx_books_language ON books(language);
    CREATE INDEX IF NOT EXISTS idx_books_date_added ON books(date_added);
    CREATE INDEX IF NOT EXISTS idx_book_tags_book_id ON book_tags(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_tags_tag_id ON book_tags(tag_id);
  `);

  console.log('✅ Database tables created successfully');
};

// Initialize tables
createTables();

// Helper functions
const getStats = () => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_books,
      COUNT(DISTINCT author) as total_authors,
      SUM(page_count) as total_pages,
      AVG(page_count) as avg_pages,
      COUNT(DISTINCT language) as languages
    FROM books
  `).get();

  const byLanguage = db.prepare(`
    SELECT language, COUNT(*) as count
    FROM books
    WHERE language IS NOT NULL
    GROUP BY language
  `).all();

  const byPdfType = db.prepare(`
    SELECT pdf_type, COUNT(*) as count
    FROM books
    WHERE pdf_type IS NOT NULL
    GROUP BY pdf_type
  `).all();

  const needsReview = db.prepare(`
    SELECT COUNT(*) as count
    FROM books
    WHERE needs_review = 1
  `).get();

  return {
    ...stats,
    byLanguage,
    byPdfType,
    needsReview: needsReview.count
  };
};

// Export database instance and helper functions
module.exports = {
  db,
  getStats,
  close: () => db.close()
};