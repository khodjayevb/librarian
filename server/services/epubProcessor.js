const fs = require('fs').promises;
const path = require('path');
const { EPub } = require('epub'); // Correctly import EPub constructor
const jszip = require('jszip');
const xml2js = require('xml2js');
const { franc } = require('franc');
const sharp = require('sharp');

class EpubProcessor {
  constructor() {
    this.parser = new xml2js.Parser();
  }

  async processEpub(filePath) {
    try {
      const metadata = await this.extractMetadata(filePath);
      const content = await this.extractContent(filePath);
      const cover = await this.extractCoverImage(filePath);

      return {
        success: true,
        metadata,
        content,
        cover
      };
    } catch (error) {
      console.error(`Error processing EPUB ${filePath}:`, error);
      return {
        success: false,
        error: error.message,
        metadata: this.getDefaultMetadata(filePath),
        content: '',
        cover: null
      };
    }
  }

  async extractMetadata(filePath) {
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);

      epub.on('end', () => {
        const metadata = {
          title: epub.metadata.title || this.extractTitleFromFilename(filePath),
          author: this.formatAuthor(epub.metadata.creator),
          language: epub.metadata.language || 'Unknown',
          publisher: epub.metadata.publisher || null,
          publicationYear: this.extractYear(epub.metadata.date),
          isbn: this.extractISBN(epub.metadata.identifier),
          description: epub.metadata.description || null,
          subject: epub.metadata.subject || [],
          rights: epub.metadata.rights || null,
          pageCount: null, // EPUBs don't have fixed page counts
          fileType: 'epub',
          chapters: epub.flow.length,
          toc: epub.toc
        };

        // Clean up metadata
        Object.keys(metadata).forEach(key => {
          if (typeof metadata[key] === 'string') {
            metadata[key] = this.cleanHtml(metadata[key]);
          }
        });

        resolve(metadata);
      });

      epub.on('error', reject);
      epub.parse();
    });
  }

  async extractContent(filePath) {
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);
      let fullText = '';

      epub.on('end', async () => {
        try {
          // Extract text from first few chapters for content preview and search
          const chaptersToExtract = Math.min(epub.flow.length, 5);

          for (let i = 0; i < chaptersToExtract; i++) {
            const chapterId = epub.flow[i].id;

            await new Promise((resolveChapter) => {
              epub.getChapter(chapterId, (error, text) => {
                if (!error && text) {
                  // Strip HTML tags for text content
                  const plainText = this.stripHtmlTags(text);
                  fullText += plainText + '\n\n';
                }
                resolveChapter();
              });
            });
          }

          // Detect language from content if not specified
          if (fullText.length > 100) {
            const detectedLang = franc(fullText.substring(0, 1000));
            if (detectedLang && detectedLang !== 'und') {
              // Store detected language
              this.detectedLanguage = this.mapLanguageCode(detectedLang);
            }
          }

          resolve(fullText.substring(0, 50000)); // Limit content for storage
        } catch (err) {
          reject(err);
        }
      });

      epub.on('error', reject);
      epub.parse();
    });
  }

  async extractCoverImage(filePath) {
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);

      epub.on('end', async () => {
        try {
          // Try to find cover image
          let coverPath = null;

          // Check if cover is specified in metadata
          if (epub.manifest[epub.metadata.cover]) {
            coverPath = epub.metadata.cover;
          } else {
            // Look for common cover image names
            const coverPatterns = ['cover', 'Cover', 'COVER', 'cover-image', 'coverimage'];

            for (const item of Object.values(epub.manifest)) {
              if (item.href && item['media-type'] && item['media-type'].startsWith('image/')) {
                const filename = path.basename(item.href).toLowerCase();

                if (coverPatterns.some(pattern => filename.includes(pattern))) {
                  coverPath = item.id;
                  break;
                }
              }
            }
          }

          if (coverPath) {
            epub.getImage(coverPath, (error, data, mimeType) => {
              if (!error && data) {
                resolve({
                  data: data,
                  mimeType: mimeType
                });
              } else {
                resolve(null);
              }
            });
          } else {
            resolve(null);
          }
        } catch (err) {
          resolve(null);
        }
      });

      epub.on('error', () => resolve(null));
      epub.parse();
    });
  }

  async generateThumbnail(filePath, outputPath) {
    try {
      const cover = await this.extractCoverImage(filePath);

      if (cover && cover.data) {
        // Convert to PNG and resize
        await sharp(cover.data)
          .resize(200, 300, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .png()
          .toFile(outputPath);

        return { success: true, thumbnailPath: outputPath };
      } else {
        // Generate placeholder thumbnail
        const svg = Buffer.from(`
          <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="300" fill="#f0f0f0"/>
            <text x="100" y="150" font-family="Arial" font-size="24" fill="#999" text-anchor="middle">EPUB</text>
          </svg>
        `);

        await sharp(svg)
          .png()
          .toFile(outputPath);

        return { success: true, thumbnailPath: outputPath };
      }
    } catch (error) {
      console.error('Error generating EPUB thumbnail:', error);
      return { success: false, error: error.message };
    }
  }

  stripHtmlTags(html) {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanHtml(text) {
    if (!text) return text;
    return this.stripHtmlTags(text)
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  formatAuthor(creator) {
    if (!creator) return null;

    if (Array.isArray(creator)) {
      return creator.join(', ');
    }

    if (typeof creator === 'object' && creator._) {
      return creator._;
    }

    return creator.toString();
  }

  extractISBN(identifier) {
    if (!identifier) return null;

    const identifiers = Array.isArray(identifier) ? identifier : [identifier];

    for (const id of identifiers) {
      const idStr = typeof id === 'object' ? (id._ || id.text || '') : id.toString();

      // Look for ISBN patterns
      const isbnMatch = idStr.match(/(?:ISBN(?:-?1[03])?:?\s*)?([0-9X-]{10,17})/i);
      if (isbnMatch) {
        return isbnMatch[1].replace(/-/g, '');
      }
    }

    return null;
  }

  extractYear(date) {
    if (!date) return null;

    const dateStr = typeof date === 'object' ? (date._ || date.text || '') : date.toString();
    const yearMatch = dateStr.match(/(\d{4})/);

    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year >= 1900 && year <= new Date().getFullYear() + 1) {
        return year;
      }
    }

    return null;
  }

  extractTitleFromFilename(filePath) {
    const filename = path.basename(filePath, '.epub');
    return filename
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  mapLanguageCode(code) {
    const languageMap = {
      'rus': 'Russian',
      'eng': 'English',
      'fra': 'French',
      'deu': 'German',
      'spa': 'Spanish',
      'ita': 'Italian',
      'por': 'Portuguese',
      'jpn': 'Japanese',
      'kor': 'Korean',
      'cmn': 'Chinese',
      'ara': 'Arabic'
    };

    return languageMap[code] || code;
  }

  getDefaultMetadata(filePath) {
    return {
      title: this.extractTitleFromFilename(filePath),
      author: null,
      language: 'Unknown',
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

  async getChapterList(filePath) {
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);

      epub.on('end', () => {
        const chapters = epub.flow.map(item => ({
          id: item.id,
          title: item.title || 'Chapter',
          href: item.href,
          order: item.order
        }));

        resolve(chapters);
      });

      epub.on('error', reject);
      epub.parse();
    });
  }

  async getChapterContent(filePath, chapterId) {
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);

      epub.on('end', () => {
        epub.getChapter(chapterId, (error, html) => {
          if (error) {
            reject(error);
          } else {
            resolve(html);
          }
        });
      });

      epub.on('error', reject);
      epub.parse();
    });
  }
}

module.exports = new EpubProcessor();