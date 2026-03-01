const express = require('express');
const router = express.Router();
const enhancedOCR = require('../services/enhancedOCR');
const { db } = require('../database/init');

// Get OCR statistics
router.get('/stats', (req, res) => {
  try {
    const stats = enhancedOCR.getOCRStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting OCR stats:', error);
    res.status(500).json({ error: 'Failed to get OCR statistics' });
  }
});

// Process OCR for a specific book
router.post('/books/:bookId/process', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { forceReprocess = false } = req.body;

    console.log(`OCR processing requested for book ${bookId}`);

    const result = await enhancedOCR.performOCROnPDF(bookId, {
      forceReprocess,
    });

    res.json(result);
  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({
      success: false,
      message: `OCR processing failed: ${error.message}`,
    });
  }
});

// Process all scanned PDFs
router.post('/process-all', async (req, res) => {
  try {
    const { forceReprocess = false } = req.body;

    // Get count of scanned books
    const scannedBooks = db.prepare(`
      SELECT COUNT(*) as count
      FROM books
      WHERE pdf_type = 'scanned'
        AND (ocr_processed IS NULL OR ocr_processed = 0 OR ? = 1)
    `).get(forceReprocess ? 1 : 0);

    if (scannedBooks.count === 0) {
      return res.json({
        success: true,
        message: 'No scanned PDFs need processing',
        processed: 0,
      });
    }

    // Start processing in the background
    res.json({
      success: true,
      message: `Started OCR processing for ${scannedBooks.count} books`,
      booksToProcess: scannedBooks.count,
    });

    // Process in background (in production, use a job queue)
    enhancedOCR.processAllScannedPDFs({ forceReprocess })
      .then(results => {
        console.log('OCR processing complete:', results);
      })
      .catch(error => {
        console.error('OCR processing failed:', error);
      });
  } catch (error) {
    console.error('Error starting OCR processing:', error);
    res.status(500).json({
      success: false,
      message: `Failed to start OCR processing: ${error.message}`,
    });
  }
});

// Get OCR status for a specific book
router.get('/books/:bookId/status', (req, res) => {
  try {
    const { bookId } = req.params;

    const book = db.prepare(`
      SELECT
        id,
        title,
        pdf_type,
        ocr_processed,
        ocr_confidence,
        ocr_processed_at,
        LENGTH(ocr_text) as ocr_text_length
      FROM books
      WHERE id = ?
    `).get(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json({
      bookId: book.id,
      title: book.title || 'Untitled',
      pdfType: book.pdf_type,
      ocrProcessed: book.ocr_processed === 1,
      ocrConfidence: book.ocr_confidence,
      ocrProcessedAt: book.ocr_processed_at,
      ocrTextLength: book.ocr_text_length || 0,
      needsOCR: book.pdf_type === 'scanned' && !book.ocr_processed,
    });
  } catch (error) {
    console.error('Error getting OCR status:', error);
    res.status(500).json({ error: 'Failed to get OCR status' });
  }
});

module.exports = router;