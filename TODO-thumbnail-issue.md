# Thumbnail Preservation Issue

## Problem Description
Book thumbnails are not persisting when books are moved to collections. The thumbnails disappear after:
1. Adding books to collections (Want to Read, Favorites, etc.)
2. Fetching metadata for books
3. Editing book metadata

## Current Behavior
- Thumbnails are generated and stored correctly initially
- They display properly in the "All Books" view
- When a book is added to a collection or metadata is updated, the thumbnail_path appears to be lost
- The issue affects both automatic metadata fetching and manual collection management

## Investigation Done

### Files Modified
1. **src/components/BookDetailModal.jsx**
   - Modified `handleSave()` to only send edited fields (lines 88-104)
   - Prevented sending undefined thumbnail_path
   - Added proper merging of updated book data

2. **server/routes/books.js**
   - PUT endpoint already handles thumbnail_path correctly (line 378)
   - Only updates fields that are explicitly provided

3. **src/App.jsx**
   - Collections are loaded correctly (line 262-266)
   - onUpdate callback properly updates book state (lines 819-829)

### Root Cause Analysis
The issue appears to be related to how books are loaded when viewing collections:
- When switching to a collection view, the app fetches books from `/api/collections/:id`
- This endpoint may not be returning thumbnail_path in the book objects
- The collections.js router fetches books with a JOIN query that might not include all fields

## Potential Solutions

### 1. Check Collection Query (Most Likely Fix)
The `/api/collections/:id` endpoint in `server/routes/collections.js` (lines 33-39) uses:
```sql
SELECT b.*, bc.position as collection_position, bc.added_at
FROM books b
JOIN book_collections bc ON b.id = bc.book_id
WHERE bc.collection_id = ?
```
This SHOULD include thumbnail_path, but needs verification that it's actually being returned.

### 2. Explicit Thumbnail Preservation
Ensure all API endpoints that return book data explicitly include thumbnail_path in the SELECT statement.

### 3. Frontend State Management
When updating books in the frontend, always preserve the thumbnail_path from the original book object.

## Next Steps
1. Debug the actual SQL query in `/api/collections/:id` endpoint
2. Log the response data to see if thumbnail_path is included
3. Check if the issue is in the database (thumbnail_path being set to NULL) or in the API response
4. Consider adding a database constraint to prevent thumbnail_path from being set to NULL once it has a value

## Testing Checklist
- [ ] Generate thumbnails for test books
- [ ] Add book to "Want to Read" collection
- [ ] Verify thumbnail still displays in collection view
- [ ] Edit book metadata
- [ ] Verify thumbnail persists after edit
- [ ] Fetch metadata enrichment
- [ ] Verify thumbnail persists after enrichment

## Temporary Workaround
Users can regenerate thumbnails by using the thumbnail generation feature, but this is not ideal as it requires manual intervention each time.