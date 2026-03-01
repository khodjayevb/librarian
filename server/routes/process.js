const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const pdfProcessor = require('../services/pdfProcessor');

// Process a single book by ID
router.post('/book/:id', async (req, res) => {
  try {
    const bookId = req.params.id;

    // Get book from database
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Process PDF to extract metadata
    const pdfData = await pdfProcessor.processPDF(book.file_path);

    // Update book with extracted metadata
    const stmt = db.prepare(`
      UPDATE books SET
        title = @title,
        author = @author,
        language = @language,
        page_count = @page_count,
        pdf_type = @pdf_type,
        ocr_confidence = @ocr_confidence,
        needs_review = @needs_review,
        manual_metadata = @manual_metadata,
        last_modified = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    stmt.run({
      id: bookId,
      title: pdfData.metadata?.title || pdfData.metadata?.titleFromFilename || book.title,
      author: pdfData.metadata?.author || pdfData.metadata?.authorFromFilename || null,
      language: pdfData.language,
      page_count: pdfData.metadata?.pageCount || null,
      pdf_type: pdfData.pdfType,
      ocr_confidence: pdfData.ocrData?.confidence || null,
      needs_review: pdfData.needsReview ? 1 : 0,
      manual_metadata: JSON.stringify(pdfData.metadata || {})
    });

    res.json({
      success: true,
      message: `Processed book: ${book.title}`,
      data: pdfData
    });

  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({ error: 'Processing failed', details: error.message });
  }
});

// Process multiple unprocessed books
router.post('/batch', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get unprocessed books (no language detected)
    const unprocessed = db.prepare(`
      SELECT id, file_path, title
      FROM books
      WHERE language IS NULL
      LIMIT ?
    `).all(limit);

    if (unprocessed.length === 0) {
      return res.json({
        message: 'No unprocessed books found',
        processed: 0
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const book of unprocessed) {
      try {
        console.log(`Processing: ${book.title}`);

        // Process PDF
        const pdfData = await pdfProcessor.processPDF(book.file_path);

        // Update database
        const stmt = db.prepare(`
          UPDATE books SET
            title = @title,
            author = @author,
            language = @language,
            page_count = @page_count,
            pdf_type = @pdf_type,
            ocr_confidence = @ocr_confidence,
            needs_review = @needs_review,
            manual_metadata = @manual_metadata,
            last_modified = CURRENT_TIMESTAMP
          WHERE id = @id
        `);

        stmt.run({
          id: book.id,
          title: pdfData.metadata?.title || pdfData.metadata?.titleFromFilename || book.title,
          author: pdfData.metadata?.author || pdfData.metadata?.authorFromFilename || null,
          language: pdfData.language,
          page_count: pdfData.metadata?.pageCount || null,
          pdf_type: pdfData.pdfType,
          ocr_confidence: pdfData.ocrData?.confidence || null,
          needs_review: pdfData.needsReview ? 1 : 0,
          manual_metadata: JSON.stringify(pdfData.metadata || {})
        });

        results.push({
          id: book.id,
          title: book.title,
          success: true,
          language: pdfData.language,
          pdfType: pdfData.pdfType
        });
        successCount++;

      } catch (error) {
        console.error(`Failed to process ${book.title}:`, error.message);
        results.push({
          id: book.id,
          title: book.title,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    res.json({
      message: `Batch processing complete`,
      processed: successCount,
      errors: errorCount,
      total: unprocessed.length,
      results: results
    });

  } catch (error) {
    console.error('Batch process error:', error);
    res.status(500).json({ error: 'Batch processing failed', details: error.message });
  }
});

// Get processing status
router.get('/status', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN language IS NOT NULL THEN 1 END) as processed,
        COUNT(CASE WHEN language IS NULL THEN 1 END) as unprocessed,
        COUNT(CASE WHEN needs_review = 1 THEN 1 END) as needs_review
      FROM books
    `).get();

    res.json({
      ...stats,
      percentage: Math.round((stats.processed / stats.total) * 100)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

module.exports = router;