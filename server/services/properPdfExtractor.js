// Use the legacy build for Node.js compatibility
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');

// Disable worker threads
global.Worker = undefined;

class ProperPdfExtractor {
  /**
   * Extract text from PDF with correct page numbering
   * This matches how PDF viewers display pages
   */
  async extractPages(filePath, options = {}) {
    const {
      maxPages = null,
      startPage = 1,
      verbose = false
    } = options;

    const pages = [];

    try {
      // Load the PDF
      const data = new Uint8Array(fs.readFileSync(filePath));
      const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
        verbosity: verbose ? pdfjsLib.VerbosityLevel.INFOS : pdfjsLib.VerbosityLevel.ERRORS
      });

      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      if (verbose) {
        console.log(`PDF has ${totalPages} pages`);
      }

      const endPage = maxPages ? Math.min(startPage + maxPages - 1, totalPages) : totalPages;

      // Extract each page in order
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Combine all text items on the page
          let pageText = '';
          let lastY = null;

          for (const item of textContent.items) {
            // Add newline if Y position changed significantly (new line)
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
              pageText += '\n';
            }
            pageText += item.str;
            lastY = item.transform[5];
          }

          // Clean up the text
          pageText = pageText
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim();

          pages.push({
            pageNumber: pageNum,  // This is the actual PDF page number
            content: pageText,
            wordCount: pageText.split(/\s+/).filter(w => w.length > 0).length
          });

          if (verbose && pageNum % 10 === 0) {
            console.log(`  Extracted page ${pageNum}/${endPage}`);
          }
        } catch (pageError) {
          console.error(`Error extracting page ${pageNum}:`, pageError.message);
          pages.push({
            pageNumber: pageNum,
            content: '',
            wordCount: 0,
            error: pageError.message
          });
        }
      }

      return {
        success: true,
        totalPages,
        extractedPages: pages.length,
        pages
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pages: []
      };
    }
  }

  /**
   * Extract a specific page to verify content
   */
  async extractSinglePage(filePath, pageNumber) {
    const result = await this.extractPages(filePath, {
      startPage: pageNumber,
      maxPages: 1
    });

    return result.pages[0] || null;
  }

  /**
   * Search for text across pages and return page numbers
   */
  async findTextInPdf(filePath, searchText, options = {}) {
    const { maxResults = 10 } = options;
    const matches = [];

    try {
      const data = new Uint8Array(fs.readFileSync(filePath));
      const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
        verbosity: pdfjsLib.VerbosityLevel.ERRORS
      });

      const pdf = await loadingTask.promise;
      const searchLower = searchText.toLowerCase();

      for (let pageNum = 1; pageNum <= pdf.numPages && matches.length < maxResults; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .toLowerCase();

        if (pageText.includes(searchLower)) {
          // Extract context around the match
          const index = pageText.indexOf(searchLower);
          const contextStart = Math.max(0, index - 100);
          const contextEnd = Math.min(pageText.length, index + searchText.length + 100);
          const context = pageText.substring(contextStart, contextEnd);

          matches.push({
            pageNumber: pageNum,
            context: context.replace(/\s+/g, ' ').trim()
          });
        }
      }

      return matches;
    } catch (error) {
      console.error('Error searching PDF:', error);
      return [];
    }
  }
}

module.exports = new ProperPdfExtractor();