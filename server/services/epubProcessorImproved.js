const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const JSZip = require('jszip');
const xml2js = require('xml2js');

class EpubProcessorImproved {
  constructor() {
    this.parser = new xml2js.Parser();
  }

  async processEpub(filePath) {
    try {
      const metadata = await this.extractBasicMetadata(filePath);
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
      // Try to extract the actual cover from the ePUB
      const coverImage = await this.extractCoverImage(filePath);

      if (coverImage) {
        // Use the extracted cover
        await sharp(coverImage)
          .resize(200, 300, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .png()
          .toFile(outputPath);

        return { success: true, thumbnailPath: outputPath };
      } else {
        // If no cover found, generate a better placeholder
        const filename = path.basename(filePath, '.epub');
        const title = filename
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .substring(0, 40);

        // Create a more attractive placeholder
        const svg = Buffer.from(`
          <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="200" height="300" fill="url(#grad1)"/>
            <rect x="20" y="20" width="160" height="260" fill="white" opacity="0.1" rx="5"/>
            <text x="100" y="100" font-family="Arial" font-size="18" font-weight="bold" fill="white" text-anchor="middle">EPUB</text>
            <text x="100" y="150" font-family="Arial" font-size="10" fill="white" text-anchor="middle" opacity="0.9">
              ${this.wrapText(title, 18).split('\n')[0] || ''}
            </text>
            <text x="100" y="165" font-family="Arial" font-size="10" fill="white" text-anchor="middle" opacity="0.9">
              ${this.wrapText(title, 18).split('\n')[1] || ''}
            </text>
            <text x="100" y="180" font-family="Arial" font-size="10" fill="white" text-anchor="middle" opacity="0.9">
              ${this.wrapText(title, 18).split('\n')[2] || ''}
            </text>
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

  async extractCoverImage(filePath) {
    try {
      // Read the ePUB file as a zip
      const data = await fs.readFile(filePath);
      const zip = await JSZip.loadAsync(data);

      // First, try to find the OPF file (package document)
      let opfPath = null;
      let opfContent = null;

      // Check for container.xml to find the OPF file
      const containerXml = await zip.file('META-INF/container.xml')?.async('string');
      if (containerXml) {
        const containerData = await this.parser.parseStringPromise(containerXml);
        const rootfile = containerData?.container?.rootfiles?.[0]?.rootfile?.[0];
        if (rootfile && rootfile.$) {
          opfPath = rootfile.$['full-path'];
        }
      }

      // If we didn't find it via container.xml, search for .opf files
      if (!opfPath) {
        const opfFiles = Object.keys(zip.files).filter(name => name.endsWith('.opf'));
        if (opfFiles.length > 0) {
          opfPath = opfFiles[0];
        }
      }

      // Parse the OPF file if found
      if (opfPath) {
        opfContent = await zip.file(opfPath)?.async('string');
        if (opfContent) {
          const opfData = await this.parser.parseStringPromise(opfContent);

          // Look for cover in metadata
          const metadata = opfData?.package?.metadata?.[0];
          const manifest = opfData?.package?.manifest?.[0];

          if (metadata && manifest) {
            // Check for cover meta tag
            const coverMeta = metadata.meta?.find(m =>
              m.$?.name === 'cover' || m.$?.name === 'cover-image'
            );

            let coverId = coverMeta?.$?.content;

            // Find the cover item in manifest
            if (coverId && manifest.item) {
              const coverItem = manifest.item.find(item =>
                item.$?.id === coverId ||
                item.$?.properties?.includes('cover-image')
              );

              if (coverItem?.$?.href) {
                // Resolve the path relative to the OPF file
                const opfDir = path.dirname(opfPath);
                const coverPath = path.join(opfDir, coverItem.$.href).replace(/\\/g, '/');
                const coverFile = await zip.file(coverPath)?.async('nodebuffer');
                if (coverFile) {
                  return coverFile;
                }
              }
            }

            // If no cover found via metadata, look for common cover patterns
            const imageItems = manifest.item?.filter(item =>
              item.$?.['media-type']?.startsWith('image/')
            ) || [];

            for (const item of imageItems) {
              const href = item.$?.href;
              if (href && /cover|thumbnail/i.test(href)) {
                const opfDir = path.dirname(opfPath);
                const imagePath = path.join(opfDir, href).replace(/\\/g, '/');
                const imageFile = await zip.file(imagePath)?.async('nodebuffer');
                if (imageFile) {
                  return imageFile;
                }
              }
            }
          }
        }
      }

      // Fallback: Look for common cover image names directly
      const coverPatterns = [
        /^.*\/(cover|Cover|COVER)\.(jpg|jpeg|png|gif)$/,
        /^.*(cover|Cover|COVER).*\.(jpg|jpeg|png|gif)$/,
        /^.*thumbnail.*\.(jpg|jpeg|png|gif)$/i
      ];

      for (const fileName of Object.keys(zip.files)) {
        for (const pattern of coverPatterns) {
          if (pattern.test(fileName)) {
            const imageFile = await zip.file(fileName)?.async('nodebuffer');
            if (imageFile) {
              return imageFile;
            }
          }
        }
      }

      // Last resort: Get the first image in the OEBPS/Images or images directory
      const imageFiles = Object.keys(zip.files).filter(name =>
        /\.(jpg|jpeg|png|gif)$/i.test(name) &&
        (name.includes('Images/') || name.includes('images/'))
      ).sort();

      if (imageFiles.length > 0) {
        const imageFile = await zip.file(imageFiles[0])?.async('nodebuffer');
        if (imageFile) {
          return imageFile;
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting cover image:', error);
      return null;
    }
  }

  wrapText(text, maxLength) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length > maxLength) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word.substring(0, maxLength));
          currentLine = word.substring(maxLength);
        }
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.slice(0, 3).join('\n');
  }
}

module.exports = new EpubProcessorImproved();