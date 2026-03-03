const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

class EpubProcessorSimple {
  async processEpub(filePath) {
    try {
      const metadata = this.extractBasicMetadata(filePath);
      return {
        success: true,
        metadata,
        content: '', // Simplified - no content extraction for now
        cover: null
      };
    } catch (error) {
      console.error(`Error processing EPUB ${filePath}:`, error);
      return {
        success: false,
        error: error.message,
        metadata: this.extractBasicMetadata(filePath),
        content: '',
        cover: null
      };
    }
  }

  extractBasicMetadata(filePath) {
    const filename = path.basename(filePath, '.epub');
    const cleanTitle = filename
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title: cleanTitle,
      author: null,
      language: 'English', // Default to English
      publisher: null,
      publicationYear: null,
      isbn: null,
      description: null,
      subject: [],
      rights: null,
      pageCount: null,
      fileType: 'epub',
      chapters: 0
    };
  }

  async generateThumbnail(filePath, outputPath) {
    try {
      // Create a simple placeholder thumbnail for ePUB files
      const filename = path.basename(filePath, '.epub');
      const title = filename
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .substring(0, 30);

      const svg = Buffer.from(`
        <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="300" fill="#4a5568"/>
          <rect x="20" y="20" width="160" height="260" fill="#718096" rx="5"/>
          <text x="100" y="100" font-family="Arial" font-size="14" fill="white" text-anchor="middle">EPUB</text>
          <text x="100" y="150" font-family="Arial" font-size="10" fill="white" text-anchor="middle">
            ${title.substring(0, 20)}
          </text>
        </svg>
      `);

      await sharp(svg)
        .png()
        .toFile(outputPath);

      return { success: true, thumbnailPath: outputPath };
    } catch (error) {
      console.error('Error generating EPUB thumbnail:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EpubProcessorSimple();