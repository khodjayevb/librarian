/**
 * Page text for scanned PDFs via Apple's Vision framework.
 *
 * Same contract as pdfOcrExtractor, which it replaces on a Mac. Vision runs
 * on the Neural Engine and read a 56-page Russian scan in 18 seconds at 91%
 * confidence where Tesseract took 110 seconds on four cores for 55%. The
 * work is done by a small Swift tool (tools/visionocr) that renders each
 * page with CoreGraphics and prints one JSON line per page; it is compiled
 * on first use if the command-line tools are installed.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');

const TOOL_DIR = path.join(__dirname, '../../tools/visionocr');
const BINARY = path.join(TOOL_DIR, 'visionocr');
const SOURCE = path.join(TOOL_DIR, 'main.swift');

const MIN_CONFIDENCE = Number(process.env.OCR_MIN_CONFIDENCE) || 40;
const MIN_WORDS = Number(process.env.OCR_MIN_WORDS) || 5;

// Vision wants BCP-47 tags; the book's language column is a plain name.
const LANGUAGE_TAGS = {
  russian: 'ru-RU', english: 'en-US', german: 'de-DE', french: 'fr-FR',
  spanish: 'es-ES', italian: 'it-IT', portuguese: 'pt-BR', ukrainian: 'uk-UA'
};

class VisionOcrExtractor {
  constructor() {
    this.checked = false;
    this.usable = false;
  }

  /** Is the tool present, or buildable? Decided once per process. */
  isAvailable() {
    if (this.checked) return this.usable;
    this.checked = true;

    if (process.platform !== 'darwin') return false;

    if (!fs.existsSync(BINARY) || fs.statSync(BINARY).mtimeMs < fs.statSync(SOURCE).mtimeMs) {
      console.log('🔨 Building the Vision OCR tool...');
      const build = spawnSync('swiftc', ['-O', '-o', BINARY, SOURCE], { encoding: 'utf8' });
      if (build.status !== 0) {
        console.warn(`Vision OCR unavailable (swiftc failed); falling back to Tesseract.\n${build.stderr || build.error}`);
        return false;
      }
    }

    this.usable = true;
    return true;
  }

  languagesFor(language) {
    const tag = LANGUAGE_TAGS[(language || '').toLowerCase()];
    // Both scripts are always allowed: a Russian technical book quotes
    // English constantly, and the language column is a guess to begin with.
    return tag && tag !== 'ru-RU' && tag !== 'en-US' ? `${tag},en-US,ru-RU` :
           tag === 'en-US' ? 'en-US,ru-RU' : 'ru-RU,en-US';
  }

  async extractPages(filePath, { pageCount, language, onProgress } = {}) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Vision OCR is not available' };
    }

    const languages = this.languagesFor(language);

    return new Promise((resolve) => {
      const child = spawn(BINARY, [filePath, '1', String(pageCount || 100000), languages]);
      const pages = [];
      let confidenceSum = 0;
      let done = 0;
      let stderr = '';

      child.stderr.on('data', (d) => { stderr += d; });

      readline.createInterface({ input: child.stdout }).on('line', (line) => {
        let page;
        try { page = JSON.parse(line); } catch { return; }
        done++;

        const text = (page.text || '').trim();
        const words = text ? text.split(/\s+/).length : 0;
        const confidence = (page.confidence || 0) * 100;

        // A near-empty or low-confidence page is a plate, a blank or an
        // artefact rather than text worth indexing.
        if (words >= MIN_WORDS && confidence >= MIN_CONFIDENCE) {
          pages.push({ pageNumber: page.page, content: text, wordCount: words });
          confidenceSum += confidence;
        }

        if (onProgress) onProgress({ done, total: pageCount || done });
      });

      child.on('error', (error) => resolve({ success: false, error: error.message }));

      child.on('close', (code) => {
        if (code !== 0 && pages.length === 0) {
          return resolve({ success: false, error: `visionocr exited with code ${code}: ${stderr.trim()}` });
        }
        resolve({
          success: true,
          pages,
          confidence: pages.length ? confidenceSum / pages.length : 0,
          languages,
          engine: 'vision'
        });
      });
    });
  }
}

module.exports = new VisionOcrExtractor();
