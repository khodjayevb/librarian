const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../database/init');
const { removeBook } = require('../services/bookRemoval');

class DuplicateDetector {
  constructor() {
    this.titleSimilarityThreshold = 0.85; // 85% similarity for titles
    this.authorSimilarityThreshold = 0.90; // 90% similarity for authors
  }

  /**
   * Levenshtein distance, two rows at a time, giving up as soon as it is
   * certain to exceed maxDistance. Comparing every pair of a few thousand
   * titles is millions of calls, and almost all of them are nowhere close.
   */
  levenshteinDistance(str1, str2, maxDistance = Infinity) {
    const m = str1.length;
    const n = str2.length;
    if (Math.abs(m - n) > maxDistance) return maxDistance + 1;

    let previous = new Array(n + 1);
    let current = new Array(n + 1);
    for (let j = 0; j <= n; j++) previous[j] = j;

    for (let i = 1; i <= m; i++) {
      current[0] = i;
      let rowMin = i;
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        current[j] = Math.min(
          previous[j] + 1,        // deletion
          current[j - 1] + 1,     // insertion
          previous[j - 1] + cost  // substitution
        );
        if (current[j] < rowMin) rowMin = current[j];
      }
      if (rowMin > maxDistance) return maxDistance + 1;
      [previous, current] = [current, previous];
    }

    return previous[n];
  }

  /**
   * Similarity ratio between two already-normalised strings. With a
   * threshold, returns 0 early for anything that cannot reach it.
   */
  similarity(str1, str2, threshold = 0) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const maxLength = Math.max(str1.length, str2.length);
    const maxDistance = Math.floor((1 - threshold) * maxLength);
    const distance = this.levenshteinDistance(str1, str2, maxDistance);

    if (distance > maxDistance) return 0;
    return 1 - (distance / maxLength);
  }

  /**
   * Normalize title for comparison.
   *
   * Letters of every script are kept: \\w is ASCII-only in JavaScript, and
   * stripping "everything else" reduced any Russian title containing "PHP"
   * to the single word "php", so eleven unrelated PHP books were one
   * duplicate group.
   */
  normalizeTitle(title) {
    if (!title) return '';

    return title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation
      .replace(/\s+/g, ' ')            // Normalize whitespace
      .replace(/^(the|a|an)\s+/i, '')  // Remove common articles
      .trim();
  }

  /**
   * Normalize author name for comparison
   */
  normalizeAuthor(author) {
    if (!author) return '';

    return author
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation
      .replace(/\s+/g, ' ')            // Normalize whitespace
      .trim();
  }

  /**
   * Is this title specific enough that two books sharing it are probably
   * the same book? Fourteen books were called "tit.indd" — the layout file
   * their publisher exported them from — and ten "Урок"; they have nothing
   * in common but bad metadata. Byte-identical files match regardless.
   */
  isMatchableTitle(normalized) {
    if (!normalized) return false;
    if (/\.(indd|qxd|docx?|fm|pdf|epub)$/.test(normalized)) return false;
    // What Word and PowerPoint write into a PDF's title field.
    if (/^(microsoft (word|powerpoint)|слайд \d|slide \d|untitled|без названия)/.test(normalized)) return false;
    return normalized.includes(' ') || normalized.length >= 10;
  }

  /** The book with its comparison keys computed once. */
  prepare(book) {
    if (book._title === undefined) {
      book._title = this.normalizeTitle(book.title);
      book._author = this.normalizeAuthor(book.author);
      book._matchable = this.isMatchableTitle(book._title);
    }
    return book;
  }

  /**
   * Calculate file hash for exact file comparison
   */
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Why two books look like the same one, or null if they do not.
   *
   * An identical file is certain whatever the titles say — the two copies
   * are usually named differently, which is how they came to be two. Short
   * of that, titles and authors have to agree closely.
   */
  compare(a, b) {
    if (a.file_hash && a.file_hash === b.file_hash) {
      return { confidence: 1, reasons: ['Identical file'] };
    }

    this.prepare(a);
    this.prepare(b);
    if (!a._matchable || !b._matchable) return null;

    // Below the threshold there is no match whatever the authors say, so
    // the title comparison is the only one most pairs ever get.
    const titleSimilarity = this.similarity(a._title, b._title, this.titleSimilarityThreshold);
    if (titleSimilarity < this.titleSimilarityThreshold) return null;

    let authorSimilarity = 0;
    if (a.author && b.author) {
      authorSimilarity = this.similarity(a._author, b._author);
      if (authorSimilarity < this.authorSimilarityThreshold) return null;
    }

    const reasons = [];
    if (titleSimilarity >= 0.95) {
      reasons.push('Nearly identical title');
    } else if (titleSimilarity >= this.titleSimilarityThreshold) {
      reasons.push('Similar title');
    }
    if (authorSimilarity >= 0.95) {
      reasons.push('Same author');
    } else if (authorSimilarity >= this.authorSimilarityThreshold) {
      reasons.push('Similar author');
    }
    if (a.file_size === b.file_size) {
      reasons.push('Same file size');
    }
    if (a.page_count === b.page_count && a.page_count > 0) {
      reasons.push('Same page count');
    }

    return { confidence: (titleSimilarity + authorSimilarity) / 2, reasons };
  }

  /**
   * Find all duplicate groups in the library.
   *
   * Identical files are grouped by hash first — an index lookup — and then
   * every pair is compared by title. A book linked to a group by either
   * route joins it, so a copy under a different name and a near-duplicate
   * under the same one end up on the same card.
   */
  async findAllDuplicates() {
    const books = db.getAllBooks();
    const byId = new Map(books.map((b) => [b.id, b]));

    // Union-find over book ids.
    const parent = new Map(books.map((b) => [b.id, b.id]));
    const find = (id) => {
      while (parent.get(id) !== id) {
        parent.set(id, parent.get(parent.get(id)));
        id = parent.get(id);
      }
      return id;
    };
    const union = (a, b) => parent.set(find(a), find(b));

    // The best reason each book has for being in its group.
    const matches = new Map();
    const note = (id, match) => {
      const current = matches.get(id);
      if (!current || match.confidence > current.confidence) matches.set(id, match);
    };

    const byHash = new Map();
    for (const book of books) {
      if (!book.file_hash) continue;
      const twin = byHash.get(book.file_hash);
      if (twin) {
        union(book.id, twin.id);
        const match = this.compare(book, twin);
        note(book.id, match);
        note(twin.id, match);
      } else {
        byHash.set(book.file_hash, book);
      }
    }

    for (let i = 0; i < books.length; i++) {
      for (let j = i + 1; j < books.length; j++) {
        if (find(books[i].id) === find(books[j].id)) continue;
        const match = this.compare(books[i], books[j]);
        if (!match) continue;
        union(books[i].id, books[j].id);
        note(books[i].id, match);
        note(books[j].id, match);
      }
    }

    const groups = new Map();
    for (const book of books) {
      const root = find(book.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(book);
    }

    const duplicateGroups = [];
    for (const [root, members] of groups) {
      if (members.length < 2) continue;

      // The earliest-added copy is the original; the rest are judged against
      // the group they landed in.
      members.sort((a, b) => String(a.date_added || '').localeCompare(String(b.date_added || '')) || a.id - b.id);
      const [original, ...rest] = members;

      duplicateGroups.push({
        groupId: `group_${root}`,
        count: members.length,
        duplicates: [
          { book: original, confidence: 1.0, reasons: ['Original'] },
          ...rest
            .map((book) => ({ book, ...(matches.get(book.id) || { confidence: 0, reasons: [] }) }))
            .sort((a, b) => b.confidence - a.confidence)
        ]
      });
    }

    return duplicateGroups.sort((a, b) => b.duplicates[1].confidence - a.duplicates[1].confidence);
  }

  /**
   * Find duplicates for a specific book
   */
  async findDuplicatesForBook(bookId) {
    const book = db.getBookById(bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    const duplicates = [];
    for (const otherBook of db.getAllBooks()) {
      if (otherBook.id === book.id) continue;
      const match = this.compare(book, otherBook);
      if (match) duplicates.push({ book: otherBook, ...match });
    }

    return duplicates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Check if a file path already exists in the library
   */
  async checkFileExists(filePath) {
    const books = db.getAllBooks();
    const normalizedPath = path.normalize(filePath).toLowerCase();

    return books.find(book =>
      path.normalize(book.file_path).toLowerCase() === normalizedPath
    );
  }

  /**
   * Merge duplicate books (keep one, remove others)
   */
  async mergeDuplicates(keepBookId, removeBookIds) {
    const keepBook = db.getBookById(keepBookId);
    if (!keepBook) {
      throw new Error('Book to keep not found');
    }

    // Merge metadata from books to be removed
    const booksToRemove = removeBookIds.map(id => db.getBookById(id)).filter(Boolean);

    for (const bookToRemove of booksToRemove) {
      // Merge tags
      const tags = db.getBookTags(bookToRemove.id);
      for (const tag of tags) {
        try {
          db.addTagToBook(keepBookId, tag.id);
        } catch (e) {
          // Tag might already exist
        }
      }

      // Merge collections
      const stmt = db.db.prepare(`
        INSERT OR IGNORE INTO book_collections (book_id, collection_id, position, added_at)
        SELECT ?, collection_id, position, added_at
        FROM book_collections
        WHERE book_id = ?
      `);
      stmt.run(keepBookId, bookToRemove.id);

      // Merge metadata (prefer non-empty values)
      const updates = {};
      if (!keepBook.author && bookToRemove.author) {
        updates.author = bookToRemove.author;
      }
      if (!keepBook.isbn && bookToRemove.isbn) {
        updates.isbn = bookToRemove.isbn;
      }
      if (!keepBook.publisher && bookToRemove.publisher) {
        updates.publisher = bookToRemove.publisher;
      }
      if (!keepBook.publication_year && bookToRemove.publication_year) {
        updates.publication_year = bookToRemove.publication_year;
      }
      if (!keepBook.description && bookToRemove.description) {
        updates.description = bookToRemove.description;
      }

      if (Object.keys(updates).length > 0) {
        db.updateBook(keepBookId, updates);
      }

      // Delete the duplicate book — file included, or the next scan brings
      // it back as a new one.
      await removeBook(bookToRemove.id);
    }

    return {
      // Re-read rather than returning the snapshot taken before the merge:
      // that copy still shows the empty fields the merge has just filled in,
      // so the caller is told nothing happened when it did.
      kept: db.getBookById(keepBookId),
      removed: booksToRemove.length
    };
  }
}

module.exports = new DuplicateDetector();