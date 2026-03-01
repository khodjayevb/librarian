const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const pdfThumbnail = require('pdf-thumbnail');

class PDFThumbnailGenerator {
  constructor() {
    this.thumbnailsDir = path.join(process.cwd(), 'public', 'thumbnails');
    this.initializeThumbnailsDir();
  }

  async initializeThumbnailsDir() {
    try {
      await fs.mkdir(this.thumbnailsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating thumbnails directory:', error);
    }
  }

  async generateThumbnail(pdfPath, bookId) {
    try {
      console.log(`Generating PDF thumbnail for book ${bookId}...`);

      // Read the PDF file
      const pdfBuffer = await fs.readFile(pdfPath);

      // Generate thumbnail using pdf-thumbnail
      const thumbnailBuffer = await pdfThumbnail(pdfBuffer, {
        compress: {
          type: 'JPEG',
          quality: 85
        },
        resize: {
          width: 300,
          height: 400
        }
      });

      // Save the thumbnail
      const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);
      await fs.writeFile(thumbnailPath, thumbnailBuffer);

      const finalThumbnail = `/thumbnails/book_${bookId}.jpg`;
      console.log(`PDF thumbnail generated: ${finalThumbnail}`);

      return {
        success: true,
        thumbnail: finalThumbnail,
        path: thumbnailPath
      };
    } catch (error) {
      console.error(`Error generating PDF thumbnail for book ${bookId}:`, error);

      // If pdf-thumbnail fails, try using sharp directly with a simple approach
      try {
        console.log(`Fallback: Creating placeholder for book ${bookId}`);
        const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);

        // Create a book-like placeholder
        const svg = `
          <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="300" height="400" fill="#f5f5f5"/>
            <rect x="20" y="20" width="260" height="360" fill="#fff" stroke="#ddd" stroke-width="2"/>
            <text x="150" y="50" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#333">PDF</text>
            <line x1="40" y1="80" x2="260" y2="80" stroke="#e0e0e0" stroke-width="1"/>
            <line x1="40" y1="110" x2="260" y2="110" stroke="#e0e0e0" stroke-width="1"/>
            <line x1="40" y1="140" x2="260" y2="140" stroke="#e0e0e0" stroke-width="1"/>
            <line x1="40" y1="170" x2="260" y2="170" stroke="#e0e0e0" stroke-width="1"/>
            <line x1="40" y1="200" x2="260" y2="200" stroke="#e0e0e0" stroke-width="1"/>
            <line x1="40" y1="230" x2="200" y2="230" stroke="#e0e0e0" stroke-width="1"/>
            <rect x="40" y="260" width="100" height="80" fill="#f0f0f0" stroke="#ddd" stroke-width="1"/>
            <text x="150" y="360" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#999">Book ${bookId}</text>
          </svg>
        `;

        await sharp(Buffer.from(svg))
          .jpeg({ quality: 85 })
          .toFile(thumbnailPath);

        return {
          success: true,
          thumbnail: `/thumbnails/book_${bookId}.jpg`,
          path: thumbnailPath,
          isPlaceholder: true
        };
      } catch (fallbackError) {
        console.error('Fallback thumbnail generation also failed:', fallbackError);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  async thumbnailExists(bookId) {
    try {
      const thumbnailPath = path.join(this.thumbnailsDir, `book_${bookId}.jpg`);
      await fs.access(thumbnailPath);
      return true;
    } catch {
      return false;
    }
  }

  getThumbnailPath(bookId) {
    return `/thumbnails/book_${bookId}.jpg`;
  }

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

      // Add a small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}

module.exports = new PDFThumbnailGenerator();