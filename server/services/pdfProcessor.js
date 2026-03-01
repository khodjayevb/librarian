const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
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
      const data = await pdfParse(dataBuffer);

      const textLength = data.text.trim().length;
      const pageCount = data.numpages;

      // Calculate average characters per page
      const avgCharsPerPage = pageCount > 0 ? textLength / pageCount : 0;

      if (avgCharsPerPage < 50) {
        return 'scanned'; // Likely just has page numbers or minimal text
      } else if (avgCharsPerPage < 500) {
        return 'mixed'; // Has some text but probably incomplete
      } else {
        return 'searchable'; // Full text content
      }
    } catch (error) {
      console.error('Error detecting PDF type:', error);
      return 'unknown';
    }
  }

  /**
   * Extract metadata from PDF
   */
  async extractMetadata(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);

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
      pdfType: 'unknown',
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

      // If it's a scanned PDF, perform OCR (sample mode)
      if (result.pdfType === 'scanned' || result.pdfType === 'mixed') {
        console.log('PDF appears to be scanned, OCR would be performed here');
        result.ocrData = await this.performOCR(filePath, { sampleMode: true });
        result.needsReview = true;
      }

      // Extract title and author if not in metadata
      if (!result.metadata?.title || !result.metadata?.author) {
        const fileName = path.basename(filePath, '.pdf');

        // Try to parse filename for title and author
        // Common patterns: "Author - Title", "Title by Author", etc.
        const patterns = [
          /^(.+?)\s*[-–]\s*(.+)$/, // Author - Title
          /^(.+?)\s+by\s+(.+)$/i,  // Title by Author
          /^(.+?)\s*\((.+?)\)$/,    // Title (Author)
        ];

        let extractedTitle = fileName;
        let extractedAuthor = null;

        for (const pattern of patterns) {
          const match = fileName.match(pattern);
          if (match) {
            // Assume first pattern is Author - Title
            if (pattern === patterns[0]) {
              extractedAuthor = match[1].trim();
              extractedTitle = match[2].trim();
            } else {
              extractedTitle = match[1].trim();
              extractedAuthor = match[2].trim();
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