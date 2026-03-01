const express = require('express');
const router = express.Router();
const { db } = require('../database/init');

// Get all categories
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*,
             COUNT(bc.book_id) as book_count,
             p.name as parent_name
      FROM categories c
      LEFT JOIN book_categories bc ON c.id = bc.category_id
      LEFT JOIN categories p ON c.parent_id = p.id
      GROUP BY c.id
      ORDER BY c.name
    `).all();

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get category tree
router.get('/tree', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();

    // Build tree structure
    const buildTree = (parent_id = null) => {
      return categories
        .filter(cat => cat.parent_id === parent_id)
        .map(cat => ({
          ...cat,
          children: buildTree(cat.id)
        }));
    };

    const tree = buildTree();
    res.json(tree);
  } catch (error) {
    console.error('Error fetching category tree:', error);
    res.status(500).json({ error: 'Failed to fetch category tree' });
  }
});

// Create new category
router.post('/', (req, res) => {
  try {
    const { name, description, parent_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const result = db.prepare('INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)')
      .run(name, description || null, parent_id || null);

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Category created successfully'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category already exists' });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', (req, res) => {
  try {
    const { name, description, parent_id } = req.body;

    // Check for circular reference
    if (parent_id) {
      const checkCircular = (catId, targetParentId) => {
        if (catId == targetParentId) return true;
        const parent = db.prepare('SELECT parent_id FROM categories WHERE id = ?').get(targetParentId);
        if (parent && parent.parent_id) {
          return checkCircular(catId, parent.parent_id);
        }
        return false;
      };

      if (checkCircular(req.params.id, parent_id)) {
        return res.status(400).json({ error: 'Circular reference detected' });
      }
    }

    const result = db.prepare('UPDATE categories SET name = ?, description = ?, parent_id = ? WHERE id = ?')
      .run(name, description, parent_id, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/:id', (req, res) => {
  try {
    // Update children to have no parent
    db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?')
      .run(req.params.id);

    const result = db.prepare('DELETE FROM categories WHERE id = ?')
      .run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;