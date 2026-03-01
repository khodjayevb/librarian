const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { franc } = require('franc');
const sharp = require('sharp');

class PDFProcessor {
  constructor() {
    this.ocrWorker = null;
    this.ocrLanguages = process.env.OCR_LANGUAGE || 'eng+rus';
    this.confidenceThreshold = parseInt(process.env.OCR_CONFIDENCE_THRESHOLD) || 60;
  }

  /**
   * Initialize OCR worker
   */
  async initializeOCR() {
    if (!this.ocrWorker) {
      this.ocrWorker = await createWorker(this.ocrLanguages);
    }
    return this.ocrWorker;
  }

  /**
   * Cleanup OCR worker
   */
  async cleanupOCR() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }

  /**
   * Detect PDF type (searchable, scanned, or mixed)
   */
  async detectPDFType(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);

      const textLength = data.text.trim().length;
      const pageCount = data.numpages;

      // Calculate average characters per page
      const avgCharsPerPage = pageCount > 0 ? textLength / pageCount : 0;

      console.log(`PDF analysis: ${path.basename(filePath)} - ${avgCharsPerPage} chars/page, ${pageCount} pages total`);

      // Adjusted thresholds for better detection
      if (avgCharsPerPage < 20) {
        return 'scanned'; // Likely just has page numbers or no text
      } else if (avgCharsPerPage < 200) {
        return 'mixed'; // Has some text but probably incomplete
      } else {
        return 'searchable'; // Full text content (most books have 1000+ chars/page)
      }
    } catch (error) {
      console.error('Error detecting PDF type:', error);
      // Don't default to scanned - try to make a better guess
      return 'unknown'; // Will be handled differently
    }
  }

  /**
   * Extract metadata from PDF
   */
  async extractMetadata(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);

      return {
        title: data.info?.Title || null,
        author: data.info?.Author || null,
        subject: data.info?.Subject || null,
        keywords: data.info?.Keywords || null,
        creator: data.info?.Creator || null,
        producer: data.info?.Producer || null,
        creationDate: data.info?.CreationDate || null,
        modificationDate: data.info?.ModDate || null,
        pageCount: data.numpages || 0,
        text: data.text.substring(0, 5000), // First 5000 chars for language detection
        version: data.version || null
      };
    } catch (error) {
      console.error('Error extracting PDF metadata:', error);
      return null;
    }
  }

  /**
   * Detect language from text
   */
  detectLanguage(text) {
    if (!text || text.trim().length < 50) {
      return 'unknown';
    }

    const detectedLang = franc(text);

    // Map franc language codes to our simplified codes
    const langMap = {
      'rus': 'Russian',
      'eng': 'English',
      'ukr': 'Ukrainian',
      'bel': 'Belarusian',
      'fra': 'French',
      'deu': 'German',
      'spa': 'Spanish',
      'ita': 'Italian',
      'por': 'Portuguese',
      'pol': 'Polish',
      'tur': 'Turkish',
      'ara': 'Arabic',
      'heb': 'Hebrew',
      'jpn': 'Japanese',
      'kor': 'Korean',
      'cmn': 'Chinese'
    };

    return langMap[detectedLang] || 'Other';
  }

  /**
   * Extract text using OCR from a scanned PDF
   */
  async performOCR(filePath, options = {}) {
    const {
      maxPages = 3, // Only OCR first few pages by default
      sampleMode = true // Sample mode for quick detection
    } = options;

    try {
      await this.initializeOCR();

      // For now, we'll use a simplified approach
      // In production, you'd convert PDF pages to images first
      console.log(`OCR processing for ${filePath} - this feature needs full implementation`);

      // Placeholder return - in full implementation, this would:
      // 1. Convert PDF pages to images using pdf2pic or similar
      // 2. Run OCR on each image
      // 3. Combine and return the text

      return {
        text: '',
        confidence: 0,
        language: 'unknown',
        needsReview: true
      };
    } catch (error) {
      console.error('OCR error:', error);
      return {
        text: '',
        confidence: 0,
        language: 'unknown',
        needsReview: true,
        error: error.message
      };
    }
  }

  /**
   * Process a single PDF file and extract all information
   */
  async processPDF(filePath) {
    console.log(`Processing PDF: ${filePath}`);

    const result = {
      filePath,
      fileName: path.basename(filePath),
      fileSize: 0,
      pdfType: 'unknown', // Default to unknown
      metadata: null,
      language: 'unknown',
      ocrData: null,
      needsReview: false,
      processedAt: new Date().toISOString()
    };

    try {
      // Get file stats
      const stats = await fs.stat(filePath);
      result.fileSize = stats.size;

      // Detect PDF type
      result.pdfType = await this.detectPDFType(filePath);
      console.log(`PDF type: ${result.pdfType}`);

      // Extract metadata
      result.metadata = await this.extractMetadata(filePath);

      // Detect language from extracted text
      if (result.metadata && result.metadata.text) {
        result.language = this.detectLanguage(result.metadata.text);
        console.log(`Detected language: ${result.language}`);
      }

      // Only perform OCR and mark for review if it's truly scanned
      if (result.pdfType === 'scanned') {
        console.log('PDF appears to be scanned, OCR would be performed here');
        result.ocrData = await this.performOCR(filePath, { sampleMode: true });
        result.needsReview = true;
      } else if (result.pdfType === 'mixed') {
        console.log('PDF has mixed content (some text extractable)');
        // Mixed PDFs have some text, so don't mark as needs review
        result.needsReview = false;
      } else if (result.pdfType === 'unknown') {
        console.log('PDF type could not be determined');
        // Unknown PDFs might be corrupted or have other issues
        result.needsReview = true;
      }

      // Extract title and author if not in metadata
      if (!result.metadata?.title || !result.metadata?.author) {
        const fileName = path.basename(filePath, '.pdf');

        // Clean up filename - remove common suffixes and numbers at the end
        let cleanFileName = fileName
          .replace(/_\d+$/, '') // Remove trailing _5334 type numbers
          .replace(/\s*-\s*\d{4}$/, '') // Remove trailing year - 2025
          .replace(/,?\s*\d+[-е]?\s*(изд|издание|edition|ed)\.?$/i, '') // Remove edition info
          .trim();

        // Try to parse filename for title and author
        const patterns = [
          // Specific patterns first
          /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-–—]\s*(.+)$/, // English Name - Title
          /^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]\s*\d{4}$/, // Author - Title - Year
          /^(.+?)\s*[-–—]\s*(.+)$/, // Generic dash separator
          /^(.+?)\.\s+(.+)$/,       // Title. Subtitle or Series. Title
          /^(.+?),\s*(.+)$/,        // Author, Title
          /^(.+?)\s+by\s+(.+)$/i,   // Title by Author
          /^(.+?)\s*\((.+?)\)$/,    // Title (Author)
        ];

        let extractedTitle = cleanFileName;
        let extractedAuthor = null;

        for (const pattern of patterns) {
          const match = cleanFileName.match(pattern);
          if (match) {
            const part1 = match[1].trim();
            const part2 = match[2].trim();

            // Check if parts contain Cyrillic characters
            const hasCyrillic = (text) => /[А-Яа-яЁё]/.test(text);

            // Check if looks like an author name (First Last or Last First format)
            const looksLikeAuthor = (text) => {
              const words = text.split(/\s+/);
              // 2-3 words, first word capitalized, no special chars except dots
              return words.length >= 2 && words.length <= 4 &&
                     /^[A-ZА-ЯЁ][a-zа-яё]+/.test(words[0]) &&
                     !/[&+#@]/.test(text);
            };

            if (pattern === patterns[0]) {
              // English Name pattern - always Author - Title
              extractedAuthor = part1;
              extractedTitle = part2;
            } else if (pattern === patterns[1] || pattern === patterns[2]) {
              // Dash patterns
              if (looksLikeAuthor(part1)) {
                extractedAuthor = part1;
                extractedTitle = part2;
              } else if (looksLikeAuthor(part2)) {
                extractedTitle = part1;
                extractedAuthor = part2;
              } else if (hasCyrillic(part1) && !hasCyrillic(part2)) {
                // Cyrillic title, non-Cyrillic might be author
                extractedTitle = part1;
                extractedAuthor = part2;
              } else if (!hasCyrillic(part1) && hasCyrillic(part2)) {
                // Non-Cyrillic might be author, Cyrillic title
                extractedAuthor = part1;
                extractedTitle = part2;
              } else {
                // Default: Author - Title
                extractedAuthor = part1;
                extractedTitle = part2;
              }
            } else if (pattern === patterns[3]) {
              // Dot pattern - could be Series. Title or Title. Subtitle
              // If first part is short (< 20 chars), probably series
              if (part1.length < 20 && part1.split(' ').length <= 3) {
                extractedTitle = part2; // Use the second part as main title
                // Don't set author from series name
              } else {
                extractedTitle = `${part1}. ${part2}`; // Keep both as title
              }
            } else if (pattern === patterns[4]) {
              // Comma pattern
              if (looksLikeAuthor(part1)) {
                extractedAuthor = part1;
                extractedTitle = part2;
              } else {
                extractedTitle = cleanFileName; // Keep original if unclear
              }
            } else {
              extractedTitle = part1;
              extractedAuthor = part2;
            }
            break;
          }
        }

        if (!result.metadata) {
          result.metadata = {};
        }
        result.metadata.titleFromFilename = extractedTitle;
        result.metadata.authorFromFilename = extractedAuthor;
      }

    } catch (error) {
      console.error(`Error processing PDF ${filePath}:`, error);
      result.error = error.message;
      result.needsReview = true;
    }

    return result;
  }

  /**
   * Process multiple PDFs with progress callback
   */
  async processBatch(filePaths, progressCallback) {
    const results = [];
    const total = filePaths.length;

    for (let i = 0; i < total; i++) {
      const filePath = filePaths[i];
      const result = await this.processPDF(filePath);
      results.push(result);

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total,
          currentFile: filePath,
          result
        });
      }
    }

    return results;
  }
}

// Export singleton instance
module.exports = new PDFProcessor();