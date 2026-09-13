/**
 * Take a book out of the library: the row, its cover, and the file itself.
 *
 * Every delete used to remove only the row. That was harmless while scans
 * were run by hand, but the server now rescans the folder hourly and on
 * every start, so an orphaned file came straight back as a "new" book —
 * merging duplicates undid itself within the hour.
 *
 * The file goes to the Trash rather than being unlinked: to the volume's
 * own .Trashes for an external drive, or ~/.Trash otherwise, which is
 * exactly where the Finder would put it, so it shows up in the Trash and
 * can be dragged back out.
 */
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { db } = require('../database/init');

const THUMBNAILS_DIR = path.join(__dirname, '../../public/thumbnails');

function trashDirFor(filePath) {
  const match = /^\/Volumes\/([^/]+)\//.exec(filePath);
  if (match) return path.join('/Volumes', match[1], '.Trashes', String(os.userInfo().uid));
  return path.join(os.homedir(), '.Trash');
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

/** Move a file to the Trash. Returns where it went, or null if it was already gone. */
async function trashFile(filePath) {
  if (!(await exists(filePath))) return null;

  const dir = trashDirFor(filePath);
  await fs.mkdir(dir, { recursive: true });

  // The Finder's own convention for a name already in the Trash.
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let target = path.join(dir, base + ext);
  for (let n = 2; await exists(target); n++) {
    target = path.join(dir, `${base} ${n}${ext}`);
  }

  await fs.rename(filePath, target);
  return target;
}

/**
 * Remove one book. The file is trashed first: if that fails the row is left
 * in place, since a row without its file would only be recreated by the
 * next scan, and the caller gets the reason.
 */
async function removeBook(bookId, { trash = true } = {}) {
  const book = db.prepare('SELECT id, file_path FROM books WHERE id = ?').get(bookId);
  if (!book) return { removed: false, error: 'Book not found' };

  let trashed = null;
  if (trash && book.file_path) {
    trashed = await trashFile(book.file_path);
  }

  db.prepare('DELETE FROM books WHERE id = ?').run(book.id);

  for (const cover of [`book_${book.id}.jpg`, `${book.id}.png`]) {
    await fs.unlink(path.join(THUMBNAILS_DIR, cover)).catch(() => {});
  }

  return { removed: true, trashed };
}

/** Remove several; one failure does not stop the rest. */
async function removeBooks(bookIds, options) {
  const results = [];
  for (const id of bookIds) {
    try {
      results.push({ id, ...(await removeBook(id, options)) });
    } catch (error) {
      results.push({ id, removed: false, error: error.message });
    }
  }
  return results;
}

module.exports = { removeBook, removeBooks, trashFile };
