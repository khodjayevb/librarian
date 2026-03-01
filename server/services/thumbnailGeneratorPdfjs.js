const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { createCanvas, Image } = require('canvas');

class ThumbnailGenerator {
  constructor() {
    this.thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
    this.pdfjsLib = null;
    this.initializeThumbnailsDir();
    this.initializePdfjs();
  }

  async initializePdfjs() {
    try {
      // Dynamically import the ES module
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
      this.pdfjsLib = pdfjs;

      // Set worker to false to avoid worker issues
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = null;
      this.pdfjsLib.GlobalWorkerOptions.isEvalSupported = false;
    } catch (error) {
      console.error('Failed to initialize PDF.js:', error);
    }
  }

  /**
   * Initialize thumbnails directory
   */
  async initializeThumbnailsDir() {
    try {
      await fs.mkdir(this.thumbnailsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating thumbnails directory:', error);
    }
  }

  /**
   * Generate thumbnail for a PDF using pdfjs-dist
   */
  async generateThumbnail(pdfPath, bookId) {
    try {
      // Wait for PDF.js to be initialized
      if (!this.pdfjsLib) {
        await this.initializePdfjs();
        if (!this.pdfjsLib) {
          throw new Error('PDF.js failed to initialize');
        }
      }

      console.log(`Generating PDF thumbnail for book ${bookId}...`);

      // Load the PDF document
      const data = await fs.readFile(pdfPath);
      const uint8Array = new Uint8Array(data);

      // Load PDF without worker
      const loadingTask = this.pdfjsLib.getDocument({
        data: uint8Array,
        disableWorker: true,
        verbosity: 0
      });

      const pdf = await loadingTask.promise;

      // Get the first page
      const page = await pdf.getPage(1);

      // Set up the canvas with a reasonable scale
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Set white background
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, viewport.width, viewport.height);

      // Create a custom canvas factory to handle images
      const canvasFactory = {
        create: (width, height) => {
          const canvas = createCanvas(width, height);
          return {
            canvas,
            context: canvas.getContext('2d')
          };
        },
        reset: (canvasAndContext, width, height) => {
          canvasAndContext.canvas.width = width;
          canvasAndContext.canvas.height = height;
        },
        destroy: (canvasAndContext) => {
          canvasAndContext.canvas.width = 0;
          canvasAndContext.canvas.height = 0;
        }
      };

      // Render the page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvasFactory: canvasFactory
      };

      try {
        await page.render(renderContext).promise;
      } catch (renderError) {
        console.error('Render error (continuing):', renderError.message);
        // Continue even if rendering has issues
      }

      // Convert canvas to buffer
      const buffer = canvas.toBuffer('image/png');

      // Create thumbnail with sharp
      const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);

      await sharp(buffer)
        .resize(300, 400, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath);

      const finalThumbnail = `/thumbnails/book_${bookId}.jpg`;
      console.log(`PDF thumbnail generated: ${finalThumbnail}`);

      // Clean up
      await page.cleanup();

      return {
        success: true,
        thumbnail: finalThumbnail,
        path: thumbnailPath
      };
    } catch (error) {
      console.error(`Error generating PDF thumbnail for book ${bookId}:`, error.message);

      // Create a placeholder image on error
      try {
        const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);

        await sharp({
          create: {
            width: 300,
            height: 400,
            channels: 3,
            background: { r: 240, g: 240, b: 240 }
          }
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath);

        return {
          success: true,
          thumbnail: `/thumbnails/book_${bookId}.jpg`,
          path: thumbnailPath,
          isPlaceholder: true
        };
      } catch (fallbackError) {
        console.error('Fallback thumbnail generation failed:', fallbackError);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  /**
   * Check if thumbnail exists
   */
  async thumbnailExists(bookId) {
    try {
      const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);
      await fs.access(thumbnailPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get thumbnail path for a book
   */
  getThumbnailPath(bookId) {
    return `/thumbnails/book_${bookId}.jpg`;
  }

  /**
   * Delete thumbnail for a book
   */
  async deleteThumbnail(bookId) {
    try {
      const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);
      await fs.unlink(thumbnailPath);
      return true;
    } catch (error) {
      console.error(`Error deleting thumbnail for book ${bookId}:`, error);
      return false;
    }
  }

  /**
   * Generate thumbnails for multiple books
   */
  async generateBatch(books, progressCallback) {
    const results = [];
    const total = books.length;

    for (let i = 0; i < total; i++) {
      const book = books[i];

      // Check if thumbnail already exists
      const exists = await this.thumbnailExists(book.id);
      if (exists) {
        results.push({
          bookId: book.id,
          success: true,
          thumbnail: this.getThumbnailPath(book.id),
          skipped: true
        });
      } else {
        const result = await this.generateThumbnail(book.file_path, book.id);
        results.push({
          bookId: book.id,
          ...result
        });
      }

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total,
          currentBook: book,
          result: results[results.length - 1]
        });
      }
    }

    return results;
  }
}

// Export singleton instance
module.exports = new ThumbnailGenerator();