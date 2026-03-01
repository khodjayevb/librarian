# Librarian - Personal Book Catalog

A desktop application for cataloging and managing your personal PDF book collection on macOS.

## Features

- 📚 **PDF Discovery & Import** - Automatically scan and import PDFs from your Books folder
- 🔍 **Smart Search** - Search by title, author, or content
- 🏷️ **Tagging System** - Organize books with custom tags and categories
- 🌍 **Multi-language Support** - Built for Russian and English books
- 🖥️ **Native Desktop App** - Electron-based macOS application
- 🔒 **100% Offline** - All data stays on your machine
- 🆓 **Completely Free** - Open source, no subscriptions or API costs

## Tech Stack

- **Frontend**: React 18 + Tailwind CSS
- **Desktop**: Electron 28
- **Backend**: Express.js + Node.js
- **Database**: SQLite
- **PDF Processing**: pdf-parse, Tesseract.js (OCR)

## Getting Started

### Prerequisites

- Node.js 20+ LTS
- npm or yarn
- macOS (primary target platform)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/Bibliotheka.git
cd Bibliotheka
```

2. Install dependencies:
```bash
npm install
```

3. Configure your Books folder path:
Edit `server/routes/scan.js` line 8:
```javascript
const BOOKS_FOLDER = '/path/to/your/Books';
```

4. Start the application:
```bash
npm start
```

Or run components separately:
```bash
npm run server       # Backend API (port 3001)
npm run react:start  # Frontend (port 5173)
npm run electron:dev # Electron app
```

## Development

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for detailed development roadmap and architecture.

### Project Structure

```
Bibliotheka/
├── electron/        # Electron main process
├── src/            # React frontend
├── server/         # Express backend
│   ├── routes/     # API endpoints
│   └── database/   # SQLite setup
├── scripts/        # Build and utility scripts
└── data/          # SQLite database files (generated)
```

### Available Scripts

- `npm start` - Start all components
- `npm run server` - Start backend server only
- `npm run react:start` - Start React dev server
- `npm run electron:dev` - Start Electron (requires React running)
- `npm test` - Run tests
- `npm run build` - Build for production

## Current Status

✅ **Phase 1 Complete**: Foundation established
- Full-stack application running
- Database schema implemented
- Basic UI with search functionality
- PDF file discovery

🚧 **Next Steps**:
- PDF metadata extraction
- OCR for scanned PDFs
- Language detection
- File system monitoring

## License

MIT

## Contributing

This is currently a personal project, but contributions are welcome! Feel free to open issues or submit pull requests.

## Author

Bibliotheka Dev Team

---

*Built with ❤️ for book lovers who value privacy and simplicity*