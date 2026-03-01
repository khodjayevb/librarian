# Librarian - Development Plan

## Project Overview
**Name:** Librarian
**Purpose:** Personal book catalog application for macOS
**Status:** Phase 5 Complete - Advanced Search & Filtering Ready
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
- UI with Tailwind CSS v3 styling
- PDF file discovery and scanning (272 books loaded)
- Fast/full scan modes for library
- PDF metadata extraction with pdf-parse
- Language detection with franc
- PDF type detection (searchable/scanned/mixed)
- Batch processing endpoint for existing books
- Visual indicators for language and PDF type
- Search and filtering functionality
- Books folder configured (/Volumes/Storage/Books)
- **PDF thumbnail generation from first page (GraphicsMagick + pdf2pic)**
- **Double-click to open PDFs directly**
- **Advanced multi-criteria filtering (tags, authors, file types)**
- **Sorting options (title, author, date, size) with asc/desc**
- **Sticky navigation and filter bars**
- **Book detail modal with metadata editing**
- **Tag management system**
- **GitHub Actions CI/CD pipeline**

### 🚧 Next Priority Tasks
1. **Author Extraction from PDF Metadata**
   - Extract author info from PDF document properties
   - Improve author parsing from filenames
   - Handle multiple authors
2. **Multi-Select for Batch Operations**
   - Checkbox selection on book cards
   - Bulk tag assignment
   - Bulk deletion
   - Bulk metadata updates
3. **Collections/Shelves System**
   - Create custom book collections
   - Smart collections based on rules
   - Drag and drop organization

### 📝 Known Issues
- OCR not fully implemented (placeholder only)
- Full-text search within PDFs not implemented
- No reading progress tracking yet

---

## Technology Stack

### Frontend
- **Framework:** React 18.x
- **Desktop Framework:** Electron 28.x
- **UI Components:** Custom components (no paid libraries)
- **Styling:** Tailwind CSS v3 (free)
- **State Management:** React hooks + Context

### Backend
- **Runtime:** Node.js 20.x LTS
- **API Framework:** Express.js
- **Database:** SQLite3 with better-sqlite3
- **Logging:** Winston

### PDF Processing
- **Text Extraction:** pdf-parse v1.1.1
- **OCR Engine:** Tesseract.js 5.x (planned)
- **Thumbnail Generation:** pdf2pic + GraphicsMagick
- **Image Processing:** Sharp
- **Language Detection:** Franc

### Utilities
- **File Watching:** Chokidar
- **Build System:** GitHub Actions
- **Testing:** Jest + React Testing Library

---

## Development Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Define technology stack
- [x] Initialize Electron + React project
- [x] Set up development environment
- [x] Create basic project structure
- [x] Implement SQLite database connection
- [x] Design initial database schema

### Phase 2: Core Backend ✅ COMPLETE
- [x] Build Express API server
- [x] Implement file system scanner
- [x] Create PDF metadata extractor
- [x] Add basic OCR support for scanned PDFs (placeholder)
- [x] Implement language detection
- [x] Set up file watcher for Books folder

### Phase 3: CI/CD & UI Components ✅ COMPLETE
- [x] GitHub Actions workflow setup
- [x] Multi-platform builds (macOS, Windows, Linux)
- [x] Automated releases with artifacts
- [x] Book detail modal component
- [x] Tag management system
- [x] Metadata editing functionality
- [x] Open PDF functionality

### Phase 4: Visual Enhancements ✅ COMPLETE
- [x] **PDF cover thumbnail generation**
  - [x] Extract first page of PDF as cover image
  - [x] Generate and cache thumbnails (pdf2pic + GraphicsMagick)
  - [x] Display cover images on book cards
  - [x] Batch thumbnail generation (50 books at a time)
- [x] **Quick-open PDF functionality**
  - [x] Double-click book card to open PDF
  - [x] Visual indicators on hover
  - [x] Cross-platform PDF opening support

### Phase 5: Advanced Search & Filtering ✅ COMPLETE
- [x] **Advanced filtering UI**
  - [x] Tag filter (multi-select with AND logic)
  - [x] Author filter dropdown
  - [x] File type filter (PDF, EPUB, etc.)
  - [x] Combined search and filters
- [x] **Sorting options**
  - [x] Sort by title (A-Z, Z-A)
  - [x] Sort by author
  - [x] Sort by date added
  - [x] Sort by file size
  - [x] Ascending/descending toggle
- [x] **Backend API enhancements**
  - [x] Dynamic SQL query building for filters
  - [x] Tag filtering with JOINs
  - [x] Sort column validation
  - [x] Combined filter parameters
- [x] **UI/UX improvements**
  - [x] Sticky navigation bar
  - [x] Sticky filter bar
  - [x] Clear filters button
  - [x] Real-time filter updates

### Phase 6: Polish & Advanced Features ⚙️ IN PROGRESS
- [ ] Author extraction from PDF metadata
- [ ] Multi-select for batch operations
- [ ] Collections/shelves system
- [ ] Reading progress tracking
- [ ] Full-text search within PDFs
- [ ] Dark mode theme
- [ ] Export/import functionality
- [ ] Performance optimization
- [ ] User preferences
- [ ] Package for macOS distribution

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
  pdf_type TEXT, -- 'searchable', 'scanned', 'mixed', 'unknown'
  ocr_confidence REAL,
  needs_review BOOLEAN DEFAULT 0,
  manual_metadata TEXT, -- JSON
  thumbnail_path TEXT, -- Path to generated thumbnail
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
- `GET /api/books` - List all books with pagination, filtering, and sorting
- `GET /api/books/:id` - Get book details
- `POST /api/books` - Add new book manually
- `PUT /api/books/:id` - Update book metadata
- `DELETE /api/books/:id` - Remove book from catalog
- `POST /api/books/:id/open` - Open PDF in default reader
- `POST /api/books/:id/thumbnail` - Generate thumbnail for single book
- `POST /api/books/thumbnails/batch` - Batch generate thumbnails

### Search & Filter
- `GET /api/books?search=&tags=&author=&fileType=&sortBy=&sortOrder=` - Advanced filtering
- `GET /api/books/recent` - Recently added/opened

### Tags & Categories
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create new tag
- `GET /api/books/:id/tags` - Get tags for a book
- `POST /api/books/:id/tags` - Add tag to book
- `DELETE /api/books/:id/tags/:tagId` - Remove tag from book
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category

### System
- `POST /api/scan` - Trigger manual scan
- `POST /api/books/process` - Batch process metadata
- `GET /api/stats` - Library statistics
- `POST /api/ocr/:id` - Re-run OCR on book
- `GET /api/config` - Get app configuration

---

## Features Backlog

### Must Have (MVP) ✅
- ✅ PDF file discovery and import
- ✅ Basic metadata extraction
- ✅ Search by title/author
- ✅ Language filtering (RU/EN)
- ✅ Simple tagging system
- ✅ Grid and list views
- ✅ **PDF cover thumbnails on book cards**
- ✅ **Click to open PDF from library**
- ✅ **Advanced filtering and sorting**
- ✅ File system monitoring (implemented)

### Should Have ⚙️
- ⏳ Enhanced OCR for scanned PDFs
- ⏳ Author extraction from PDF metadata
- ⏳ Multi-select for batch operations
- ⏳ Collections/shelves system
- ⏳ Reading progress tracking
- ⏳ Quick preview panel

### Nice to Have 📋
- 📋 Full-text search inside PDFs
- 📋 Auto-tagging suggestions
- 📋 Duplicate detection
- 📋 Series management
- 📋 Reading lists/collections
- 📋 Export to BibTeX/CSV
- 📋 Dark/light theme toggle
- 📋 Keyboard shortcuts
- 📋 Statistics dashboard

### Future Ideas 💡
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

### Why pdf2pic + GraphicsMagick?
- High-quality PDF thumbnails
- Fast processing
- Reliable cross-platform support
- Better than pure JavaScript solutions

---

## Development Guidelines

### Code Structure
```
Bibliotheka/
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── menu.js
├── src/
│   ├── components/
│   │   └── BookDetailModal.jsx
│   ├── pages/
│   ├── hooks/
│   ├── utils/
│   └── api/
├── server/
│   ├── routes/
│   │   ├── books.js
│   │   ├── scan.js
│   │   └── tags.js
│   ├── services/
│   │   ├── thumbnailGeneratorPdf2pic.js
│   │   └── pdfProcessor.js
│   ├── database/
│   │   └── init.js
│   └── index.js
├── public/
│   └── thumbnails/
├── scripts/
│   ├── build.js
│   └── package.js
├── .github/
│   └── workflows/
│       └── ci.yml
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

## Performance Metrics

### Current Performance ✅
- ✅ Can import 272+ books without issues
- ✅ Search results return instantly with filtering
- ✅ App starts in < 2 seconds
- ✅ Memory usage < 300MB for normal use
- ✅ Thumbnail generation ~1 second per book
- ✅ Smooth scrolling with sticky headers

### Target Metrics
- [ ] Can handle 5000+ books efficiently
- [ ] OCR accuracy > 80% for good scans
- [ ] Full-text search in < 1 second
- [ ] Batch operations on 100+ books

---

## Changelog

### 2026-03-01 - Phase 5 Complete - Advanced Search & Filtering
- ✅ **Phase 5 Complete**: Advanced filtering and sorting system
- Implemented multi-criteria filtering:
  - Tag filtering with multi-select (AND logic)
  - Author filtering with dropdown
  - File type filtering (PDF, EPUB, etc.)
  - All filters work together with search
- Added comprehensive sorting options:
  - Sort by title, author, date added, file size
  - Ascending/descending toggle
  - Real-time sorting updates
- Enhanced backend API:
  - Dynamic SQL query building for complex filters
  - Proper JOIN operations for tag filtering
  - Sort column validation
  - Improved query performance
- UI/UX improvements:
  - Made filter bar sticky below navigation
  - Clear filters button when active
  - Filter status in book count display
  - Improved visual hierarchy

### 2026-03-01 - Phase 4 Complete - Visual Enhancements
- ✅ **Phase 4 Complete**: PDF thumbnails and quick open functionality
- Implemented PDF thumbnail generation:
  - Using pdf2pic + GraphicsMagick for high-quality thumbnails
  - First page extraction from PDFs
  - Batch generation (50 books at a time)
  - Thumbnail caching in public/thumbnails
  - Database integration with thumbnail_path field
- Added quick-open functionality:
  - Double-click any book to open PDF directly
  - Cross-platform support (macOS, Windows, Linux)
  - Visual hover indicators
- Fixed thumbnail generation issues:
  - Installed GraphicsMagick and Ghostscript dependencies
  - Resolved pdf2pic configuration
  - Improved error handling with fallback placeholders
- UI improvements:
  - Book cards now show actual PDF covers
  - Loading states for thumbnail generation
  - Generate Covers button for batch processing

### 2026-03-01 - Phase 3 Complete - CI/CD & UI Components
- ✅ **Phase 3 Complete**: CI/CD pipeline and core UI components
- Created comprehensive CI/CD pipeline with GitHub Actions:
  - Multi-platform builds (macOS, Windows, Linux)
  - Automated testing and linting
  - Release automation for main branch
  - Fixed deprecated v3 actions to v4
  - Added proper permissions for GitHub token
- Implemented Book Detail Modal component:
  - View and edit book metadata (title, author, language)
  - Tag management system (add/remove tags)
  - Open PDF functionality for all platforms
  - Visual status indicators for OCR confidence
- Enhanced API endpoints:
  - GET/POST/DELETE `/api/books/:id/tags` for tag management
  - POST `/api/books/:id/open` to open PDFs natively
  - Improved response handling

### 2026-03-01 - Phase 2 Complete - Core Backend
- ✅ **Phase 2 Complete**: PDF processing pipeline fully functional
- Implemented PDF metadata extraction with pdf-parse v1.1.1
- Added language detection using franc library
- Created PDF type detection (searchable/scanned/mixed/unknown)
- Built batch processing endpoint for unprocessed books
- Enhanced filename parsing for author/title extraction
- Fixed critical bugs and improved processing accuracy

### 2026-03-01 - Phase 1 Complete - Foundation
- ✅ **Phase 1 Complete**: Foundation established
- Implemented Electron + React + Express stack
- Created complete SQLite database schema
- Built full CRUD REST API
- Set up Tailwind CSS with PostCSS
- Implemented file system scanner for PDF discovery

---

*This is a living document. Last major update: Phase 5 completion with advanced filtering.*