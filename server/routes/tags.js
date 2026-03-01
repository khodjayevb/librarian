const express = require('express');
const router = express.Router();
const { db } = require('../database/init');

// Get all tags
router.get('/', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.*, COUNT(bt.book_id) as book_count
      FROM tags t
      LEFT JOIN book_tags bt ON t.id = bt.tag_id
      GROUP BY t.id
      ORDER BY t.name
    `).all();

    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Create new tag
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
      .run(name, color || null);

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Tag created successfully'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Tag already exists' });
    }
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update tag
router.put('/:id', (req, res) => {
  try {
    const { name, color } = req.body;

    const result = db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?')
      .run(name, color, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ message: 'Tag updated successfully' });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete tag
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tags WHERE id = ?')
      .run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

module.exports = router;