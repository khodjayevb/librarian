#!/usr/bin/env node
/**
 * OCR one book in a process of its own.
 *
 * Reading a scanned book is minutes of CPU on four Tesseract threads, and the
 * backlog is days of it. Run inside the server that would crowd out the UI,
 * the local model and whatever else the machine is doing, so the background
 * sweep starts this under `nice` instead: the kernel then hands it only the
 * time nothing else wants. It also means a Tesseract crash costs one book.
 *
 * Usage: ocrChild.js <book-json> <result-path>
 * The result file holds the extractPages() result as JSON.
 */
require('dotenv').config();
const fs = require('fs');
const { extractPages } = require('./pageExtraction');

const book = JSON.parse(process.argv[2]);
const resultPath = process.argv[3];

extractPages(book, {
  ocr: true,
  onProgress: ({ done, total }) => {
    if (done % 50 === 0 || done === total) {
      console.log(`   OCR ${done}/${total} pages`);
    }
  }
}).then((result) => {
  fs.writeFileSync(resultPath, JSON.stringify(result));
  process.exit(0);
}).catch((error) => {
  fs.writeFileSync(resultPath, JSON.stringify({ success: false, error: error.message }));
  process.exit(1);
});
