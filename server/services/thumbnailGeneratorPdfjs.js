const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { createCanvas } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

class ThumbnailGenerator {
  constructor() {
    this.thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
    this.initializeThumbnailsDir();

    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
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
      console.log(`Generating thumbnail for book ${bookId}...`);

      // Load the PDF document
      const data = await fs.readFile(pdfPath);
      const pdf = await pdfjsLib.getDocument({
        data: data,
        verbosity: 0
      }).promise;

      // Get the first page
      const page = await pdf.getPage(1);

      // Set up the canvas
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Render the page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Convert canvas to buffer
      const buffer = canvas.toBuffer('image/png');

      // Create thumbnail with sharp
      const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);

      await sharp(buffer)
        .resize(300, 400, {
          fit: 'cover',
          position: 'top'
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath);

      const finalThumbnail = `/thumbnails/book_${bookId}.jpg`;
      console.log(`Thumbnail generated: ${finalThumbnail}`);

      // Clean up
      page.cleanup();

      return {
        success: true,
        thumbnail: finalThumbnail,
        path: thumbnailPath
      };
    } catch (error) {
      console.error(`Error generating thumbnail for book ${bookId}:`, error);

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