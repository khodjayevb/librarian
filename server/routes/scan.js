const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { db } = require('../database/init');

// Configuration - UPDATE THIS to your actual Books folder path
const BOOKS_FOLDER = process.env.BOOKS_FOLDER || '/Volumes/Storage/Books';

// Recursively scan directory for PDF files
async function scanDirectory(dirPath) {
  const pdfFiles = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath);
        pdfFiles.push(...subFiles);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.pdf') {
        // Add PDF file to list
        const stats = await fs.stat(fullPath);
        pdfFiles.push({
          path: fullPath,
          name: entry.name,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return pdfFiles;
}

// Trigger library scan
router.post('/', async (req, res) => {
  try {
    console.log(`Starting scan of: ${BOOKS_FOLDER}`);

    // Check if directory exists
    try {
      await fs.access(BOOKS_FOLDER);
    } catch {
      return res.status(404).json({
        error: 'Books folder not found',
        path: BOOKS_FOLDER,
        hint: 'Please update BOOKS_FOLDER in server/routes/scan.js or set BOOKS_FOLDER environment variable'
      });
    }

    // Scan for PDF files
    const pdfFiles = await scanDirectory(BOOKS_FOLDER);
    console.log(`Found ${pdfFiles.length} PDF files`);

    // Get existing files from database
    const existingFiles = db.prepare('SELECT file_path FROM books').all()
      .map(book => book.file_path);

    // Prepare insert statement
    const insertBook = db.prepare(`
      INSERT OR IGNORE INTO books (file_path, file_size, last_modified)
      VALUES (?, ?, ?)
    `);

    let added = 0;
    let skipped = 0;

    // Process each PDF file
    for (const pdf of pdfFiles) {
      if (existingFiles.includes(pdf.path)) {
        skipped++;
        continue;
      }

      // Extract basic info from filename
      const fileName = path.basename(pdf.name, '.pdf');
      const title = fileName.replace(/[-_]/g, ' ');

      insertBook.run(pdf.path, pdf.size, pdf.modified.toISOString());
      added++;

      // Update with title extracted from filename
      db.prepare('UPDATE books SET title = ? WHERE file_path = ?')
        .run(title, pdf.path);
    }

    res.json({
      success: true,
      scanned: pdfFiles.length,
      added,
      skipped,
      message: `Scan complete: ${added} new books added, ${skipped} already in library`
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Scan failed', details: error.message });
  }
});

// Get scan status/configuration
router.get('/config', (req, res) => {
  res.json({
    booksFolder: BOOKS_FOLDER,
    exists: fs.access(BOOKS_FOLDER).then(() => true).catch(() => false)
  });
});

module.exports = router;