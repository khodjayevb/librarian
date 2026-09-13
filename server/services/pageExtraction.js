/**
 * Turn a book file into pages of text. No database access, so it can run in
 * a worker thread: pdf.js walks every page of a large PDF synchronously
 * enough to stall the event loop for seconds at a time.
 */
const path = require('path');
const properPdfExtractor = require('./properPdfExtractor');
const epubPageExtractor = require('./epubPageExtractor');
const pdfOcrExtractor = require('./pdfOcrExtractor');

/**
 * PDFs have pages the viewer can navigate to, so their numbering comes from
 * the file. ePUBs reflow and have none, so the extractor cuts the reading
 * order into pages of comparable size — useful for retrieval and citation,
 * but not something the ePUB reader can jump to.
 *
 * A scanned PDF has no text layer to read, so its pages are rendered and
 * recognised — seconds a page rather than milliseconds. Callers say whether
 * they are prepared to wait for that; if not, the result says why nothing
 * was extracted.
 *
 * Returns { success, source, pages, confidence?, languages?, error?,
 * skipped? } — pages are { pageNumber, content, wordCount }.
 */
async function extractPages(book, { ocr = true, onProgress } = {}) {
  const isEpub = path.extname(book.file_path || '').toLowerCase() === '.epub';
  const isScanned = !isEpub && book.pdf_type === 'scanned';

  if (isEpub) {
    return { source: 'ePUB', ...(await epubPageExtractor.extractPages(book.file_path)) };
  }

  if (isScanned) {
    if (!ocr) {
      return { success: false, skipped: true, source: 'OCR', error: 'Scanned PDF; OCR not requested' };
    }
    const result = await pdfOcrExtractor.extractPages(book.file_path, {
      pageCount: book.page_count,
      language: book.language,
      onProgress
    });
    return { source: 'OCR', ...result };
  }

  return { source: 'PDF', ...(await properPdfExtractor.extractPages(book.file_path, { verbose: false })) };
}

module.exports = { extractPages };
