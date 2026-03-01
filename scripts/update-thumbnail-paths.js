const { db } = require('../server/database/init');
const fs = require('fs');
const path = require('path');

// Check which thumbnails exist and update database
const thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');

// Get all books
const books = db.prepare('SELECT id FROM books').all();

let updated = 0;
books.forEach(book => {
  const thumbnailFile = path.join(thumbnailsDir, `book_${book.id}.jpg`);
  if (fs.existsSync(thumbnailFile)) {
    const thumbnailPath = `/thumbnails/book_${book.id}.jpg`;
    db.prepare('UPDATE books SET thumbnail_path = ? WHERE id = ?')
      .run(thumbnailPath, book.id);
    updated++;
  }
});

console.log(`✅ Updated ${updated} books with thumbnail paths`);