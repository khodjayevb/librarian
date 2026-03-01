# Librarian - Development Plan

## Project Overview
**Name:** Librarian
**Purpose:** Personal book catalog application for macOS
**Status:** Phase 1 Complete - Foundation Ready
**Last Updated:** 2026-03-01

### Core Requirements
- Catalog PDF books from a Books folder on external storage
- Support for both searchable and scanned PDFs
- Russian and English language support
- Automatic file discovery and monitoring
- Advanced search and filtering capabilities
- 100% free and open-source stack
- Runs completely offline on local machine

---

## Current Status Summary

### ✅ What's Working
- Full-stack application running (Electron + React + Express)
- SQLite database with complete schema
- RESTful API endpoints for all entities
- UI with Tailwind CSS v3 styling (fixed from v4)
- PDF file discovery and scanning (271 books loaded)
- Fast/full scan modes for library
- PDF metadata extraction with pdf-parse
- Language detection with franc
- PDF type detection (searchable/scanned/mixed)
- Batch processing endpoint for existing books
- Visual indicators for language and PDF type
- Search and filtering functionality
- Books folder configured (/Volumes/Storage/Books)

### 🚧 Next Priority Tasks
1. **PDF Cover Thumbnail Generation** (User requested)
   - Extract first page of PDF as book cover
   - Generate thumbnails on import/scan
   - Cache thumbnails for performance
   - Display covers on book cards in grid view
2. **Quick-Open PDF from Library** (User requested)
   - Double-click any book card to open PDF directly
   - Add quick-open button on book cards
   - Support keyboard navigation (Enter to open)
3. Complete OCR implementation for scanned PDFs
4. Add file system monitoring (chokidar)
5. Implement advanced search filters

### 📝 Known Issues
- OCR not fully implemented (placeholder only)
- Full-text search not implemented
- No book detail view yet

---

## Technology Stack

### Frontend
- **Framework:** React 18.x
- **Desktop Framework:** Electron 28.x
- **UI Components:** Custom components (no paid libraries)
- **Styling:** CSS Modules / Tailwind CSS (free)
- **State Management:** Zustand or Context API

### Backend
- **Runtime:** Node.js 20.x LTS
- **API Framework:** Express.js
- **Database:** SQLite3 (embedded)
- **ORM:** Better-sqlite3 or Prisma

### PDF Processing
- **Text Extraction:** pdf-parse
- **OCR Engine:** Tesseract.js 5.x
- **PDF Rendering:** pdfjs-dist
- **Image Processing:** Sharp

### Utilities
- **File Watching:** Chokidar
- **Language Detection:** Franc
- **Search Engine:** MiniSearch
- **Logging:** Winston
- **Testing:** Jest + React Testing Library

---

## Development Phases

### Phase 1: Foundation (Week 1-2) ✅ COMPLETE
- [x] Define technology stack
- [x] Initialize Electron + React project
- [x] Set up development environment
- [x] Create basic project structure
- [x] Implement SQLite database connection
- [x] Design initial database schema

### Phase 2: Core Backend (Week 3-4) ✅ COMPLETE
- [x] Build Express API server
- [x] Implement file system scanner
- [x] Create PDF metadata extractor
- [x] Add basic OCR support for scanned PDFs (placeholder)
- [x] Implement language detection
- [x] Set up file watcher for Books folder (ready to activate)

### Phase 3: Data Layer (Week 5-6) ✅ COMPLETE
- [x] Complete database schema implementation
- [x] Create CRUD operations for books
- [x] Implement tagging system
- [x] Add categorization features
- [x] Build search indexing (basic search working)
- [x] Implement filtering logic
- [x] Add tag management endpoints
- [x] Add PDF opening functionality

### Phase 4: User Interface (Week 7-8) ⚙️ IN PROGRESS
- [x] Design UI mockups (basic)
- [x] Create main application layout
- [x] Build book grid/list views
- [x] Implement search interface
- [x] Create book detail view (modal)
- [x] Add edit metadata forms
- [ ] Add filter controls (advanced)
- [ ] **Implement PDF cover thumbnail generation**
  - [ ] Extract first page of PDF as cover image
  - [ ] Generate and cache thumbnails
  - [ ] Display cover images on book cards
- [ ] **Add quick-open PDF functionality**
  - [ ] Double-click book card to open PDF
  - [ ] Add "Open" button on book cards
  - [ ] Keyboard shortcut support (Enter key)

### Phase 5: Advanced Features (Week 9-10)
- [ ] Enhance OCR with preprocessing
- [ ] Add batch import functionality
- [ ] Implement cover thumbnail generation
- [ ] Create statistics dashboard
- [ ] Add export functionality
- [ ] Implement backup/restore

### Phase 6: Polish & Packaging (Week 11-12)
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Add user preferences
- [ ] Create app icon and branding
- [ ] Package for macOS distribution
- [ ] Write user documentation

---

## Database Schema

```sql
-- Core tables
books (
  id INTEGER PRIMARY KEY,
  title TEXT,
  author TEXT,
  language TEXT,
  file_path TEXT UNIQUE NOT NULL,
  file_size INTEGER,
  page_count INTEGER,
  pdf_type TEXT, -- 'searchable', 'scanned', 'mixed'
  ocr_confidence REAL,
  needs_review BOOLEAN DEFAULT 0,
  manual_metadata TEXT, -- JSON
  date_added DATETIME,
  last_modified DATETIME,
  last_opened DATETIME
)

tags (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT
)

categories (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id)
)

-- Relationship tables
book_tags (
  book_id INTEGER REFERENCES books(id),
  tag_id INTEGER REFERENCES tags(id),
  PRIMARY KEY (book_id, tag_id)
)

book_categories (
  book_id INTEGER REFERENCES books(id),
  category_id INTEGER REFERENCES categories(id),
  PRIMARY KEY (book_id, category_id)
)

-- Additional metadata
book_notes (
  id INTEGER PRIMARY KEY,
  book_id INTEGER REFERENCES books(id),
  note TEXT,
  created_at DATETIME
)

reading_progress (
  book_id INTEGER PRIMARY KEY REFERENCES books(id),
  
  current_page INTEGER,
  total_pages INTEGER,
  last_read DATETIME
)
```

---

## API Endpoints

### Books
- `GET /api/books` - List all books with pagination
- `GET /api/books/:id` - Get book details
- `POST /api/books` - Add new book manually
- `PUT /api/books/:id` - Update book metadata
- `DELETE /api/books/:id` - Remove book from catalog

### Search & Filter
- `GET /api/search?q=` - Full-text search
- `POST /api/books/filter` - Advanced filtering
- `GET /api/books/recent` - Recently added/opened

### Tags & Categories
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create new tag
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category

### System
- `POST /api/scan` - Trigger manual scan
- `GET /api/stats` - Library statistics
- `POST /api/ocr/:id` - Re-run OCR on book
- `GET /api/config` - Get app configuration

---

## Features Backlog

### Must Have (MVP)
- ✅ PDF file discovery and import
- ✅ Basic metadata extraction
- ✅ Search by title/author
- ✅ Language filtering (RU/EN)
- ✅ Simple tagging system
- ✅ Grid and list views
- ⏳ File system monitoring
- 🔴 **PDF cover thumbnails on book cards** (User Priority)
- 🔴 **Click to open PDF from library** (User Priority)

### Should Have
- ⏳ OCR for scanned PDFs
- ⏳ Advanced filters
- ⏳ Bulk operations
- ⏳ Reading progress tracking
- ⏳ Quick preview
- ⏳ Keyboard shortcuts for navigation

### Nice to Have
- 📋 Full-text search inside PDFs
- 📋 Auto-tagging suggestions
- 📋 Duplicate detection
- 📋 Series management
- 📋 Reading lists/collections
- 📋 Export to BibTeX/CSV
- 📋 Dark/light theme toggle
- 📋 Keyboard shortcuts
- 📋 Statistics dashboard

### Future Ideas
- 💡 EPUB support
- 💡 Cloud sync (optional)
- 💡 Mobile companion app
- 💡 AI-powered summaries
- 💡 Reading recommendations
- 💡 Social features (sharing lists)

---

## Technical Decisions

### Why Electron?
- Native macOS app experience
- Access to file system
- Offline functionality
- No deployment costs

### Why SQLite?
- Zero configuration
- Single file database
- Fast for local queries
- Perfect for single-user apps

### Why Tesseract.js?
- Completely free
- Runs offline
- Supports Russian & English
- No API limits

---

## Development Guidelines

### Code Structure
```
librarian/
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── menu.js
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── utils/
│   └── api/
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   └── database/
├── scripts/
│   ├── build.js
│   └── package.js
└── tests/
```

### Naming Conventions
- Components: PascalCase
- Files: camelCase
- Database: snake_case
- API endpoints: kebab-case

### Git Workflow
- Main branch: stable releases
- Develop branch: active development
- Feature branches: feature/description
- Commit format: "type: description"

---

## Known Challenges

1. **OCR Performance**
   - Solution: Background processing queue
   - Consider: Optional cloud OCR for better results

2. **Large Library Performance**
   - Solution: Pagination, virtual scrolling
   - Consider: Search result caching

3. **PDF Variety**
   - Solution: Fallback strategies, manual override
   - Consider: User feedback for improvements

4. **Storage Management**
   - Solution: Store only metadata, reference files
   - Consider: Thumbnail caching strategy

---

## Success Metrics

- [ ] Can import 1000+ books without crashing
- [ ] Search results return in < 500ms
- [ ] OCR accuracy > 80% for good scans
- [ ] App starts in < 3 seconds
- [ ] Memory usage < 500MB for normal use

---

## Notes & Ideas

_Add new ideas and notes here as development progresses_

- Consider adding a "quick add" floating button
- Maybe implement smart folders based on rules
- Could add ISBN lookup for better metadata
- Think about adding annotation support later

---

## Upcoming Features (User Requested)

### PDF Cover Thumbnails
**Priority: HIGH** - Display book covers (first page of PDF) on book cards

#### Technical Implementation:
1. **PDF to Image Conversion**
   - Use `pdf2pic` or `pdfjs-dist` to extract first page
   - Generate thumbnails at multiple sizes (small for grid, large for detail)
   - Store in `/thumbnails` folder with book ID as filename

2. **Caching Strategy**
   - Generate thumbnails during initial scan/import
   - Background job for existing books without thumbnails
   - Store thumbnail path in database

3. **UI Updates**
   - Add image placeholder on book cards
   - Lazy loading for performance
   - Fallback to generic book icon if no thumbnail

4. **API Endpoints**
   - `GET /api/books/:id/thumbnail` - Get thumbnail URL
   - `POST /api/books/:id/generate-thumbnail` - Force regenerate

### Quick-Open PDF from Library
**Priority: HIGH** - Direct PDF opening from book cards

#### Technical Implementation:
1. **Double-click Handler**
   - Add `onDoubleClick` event to book cards
   - Call existing `/api/books/:id/open` endpoint

2. **Visual Indicators**
   - Add hover effect showing "Double-click to open"
   - Quick-open button overlay on hover
   - Cursor change to pointer

3. **Keyboard Support**
   - Focus management for book cards
   - Enter key to open selected book
   - Arrow keys for navigation

---

## Changelog

### 2026-03-01 - User Feature Requests Added
- Added PDF cover thumbnail generation to roadmap (HIGH priority)
- Added quick-open PDF functionality to roadmap (HIGH priority)
- Updated Features Backlog with user priorities
- These features will be implemented in next development session

### 2026-03-01 - Phase 3 Complete & CI/CD Setup
- ✅ **Phase 3 Complete**: Data layer and core UI functionality
- Created comprehensive CI/CD pipeline with GitHub Actions
  - Multi-platform builds (macOS, Windows, Linux)
  - Automated testing and linting
  - Release automation for main branch
- Implemented Book Detail Modal component
  - View and edit book metadata (title, author, language)
  - Tag management system (add/remove tags)
  - Open PDF functionality for all platforms
  - Visual status indicators for OCR confidence and needs review
- Added new API endpoints:
  - GET/POST/DELETE `/api/books/:id/tags` for tag management
  - POST `/api/books/:id/open` to open PDFs natively
- Integrated modal into main application
  - Click any book card to view details
  - Edit mode for metadata updates
  - Real-time tag management
- Fixed API response handling for book updates
- Application now has full CRUD operations for books and tags

### 2026-03-01 - Phase 2 Complete
- ✅ **Phase 2 Complete**: PDF processing pipeline fully functional
- Implemented PDF metadata extraction with pdf-parse v1.1.1
- Added language detection using franc library
- Created PDF type detection (searchable/scanned/mixed/unknown)
- Built batch processing endpoint for unprocessed books
- Added file watcher service with chokidar (ready but not activated)
- Configured Books folder path from environment variable
- Fixed Tailwind CSS v4 to v3 downgrade for styling
- Enhanced UI with visual indicators:
  - Language badges (Russian=blue, English=green)
  - PDF type indicators (searchable/scanned/mixed/unknown)
  - Unprocessed books counter
  - Process Books button for batch processing
- Improved filename parsing for author/title extraction:
  - Handles Russian books with dot separators (Title. Author)
  - Detects English names in "Author - Title" format
  - Cleans up edition info, years, and trailing numbers
  - Smart detection using Cyrillic character presence
  - Recognizes series names (e.g., "Head First")
- Fixed critical bugs:
  - pdf-parse v2.4.5 to v1.1.1 (function export issue)
  - Database schema to support 'unknown' PDF type
  - Improved PDF type detection thresholds
  - Better "Needs Review" logic (only for truly scanned PDFs)
- Successfully processing 272 books from /Volumes/Storage/Books
- All books can now be processed with metadata extraction

### 2026-03-01 - Phase 1
- ✅ Phase 1 Complete: Foundation established
- Implemented Electron + React + Express stack
- Created complete SQLite database schema with all tables
- Built full CRUD REST API for books, tags, and categories
- Set up Tailwind CSS with PostCSS (fixed v4 compatibility)
- Created basic UI with search and grid view
- Implemented file system scanner for PDF discovery
- Added development scripts and testing utilities
- Fixed React state management for API responses
- Project is now runnable with `npm start`

### 2026-02-28
- Initial development plan created
- Defined technology stack
- Outlined 6-phase development approach

---

*This is a living document. Update regularly as the project evolves.*