const fs = require('fs').promises;
const path = require('path');
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');

class ThumbnailGenerator {
  constructor() {
    this.thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
    this.initializeThumbnailsDir();
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
   * Generate thumbnail for a PDF
   */
  async generateThumbnail(pdfPath, bookId) {
    try {
      console.log(`Generating thumbnail for book ${bookId}...`);

      // Configure pdf2pic options
      const options = {
        density: 100,           // DPI
        saveFilename: `book_${bookId}`,
        savePath: this.thumbnailsDir,
        format: 'png',
        width: 300,             // Thumbnail width
        height: 400,            // Thumbnail height
        page: 1                 // Extract first page
      };

      const convert = fromPath(pdfPath, options);
      const pageToConvertAsImage = 1;

      // Convert first page to image
      const output = await convert(pageToConvertAsImage, { responseType: 'image' });

      // The image is saved, now let's optimize it with sharp
      const originalPath = output.path || path.join(this.thumbnailsDir, `book_${bookId}.1.png`);
      const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.png`);

      // Optimize the image
      await sharp(originalPath)
        .resize(300, 400, {
          fit: 'cover',
          position: 'top'
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath.replace('.png', '.jpg'));

      // Clean up the original PNG if different from final
      if (originalPath !== thumbnailPath) {
        try {
          await fs.unlink(originalPath);
        } catch (err) {
          console.log('Could not delete temp file:', err.message);
        }
      }

      const finalThumbnail = `/thumbnails/book_${bookId}.jpg`;
      console.log(`Thumbnail generated: ${finalThumbnail}`);

      return {
        success: true,
        thumbnail: finalThumbnail,
        path: thumbnailPath.replace('.png', '.jpg')
      };
    } catch (error) {
      console.error(`Error generating thumbnail for book ${bookId}:`, error);

      // Fallback: Try with sharp directly if PDF has embedded images
      try {
        const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);

        // Create a placeholder image
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