#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Librarian Setup...\n');

// Check dependencies
console.log('1. Checking dependencies...');
try {
  require('electron');
  console.log('   ✅ Electron installed');
} catch {
  console.log('   ❌ Electron not found');
}

try {
  require('express');
  console.log('   ✅ Express installed');
} catch {
  console.log('   ❌ Express not found');
}

try {
  require('better-sqlite3');
  console.log('   ✅ Better-SQLite3 installed');
} catch {
  console.log('   ❌ Better-SQLite3 not found');
}

// Check database
console.log('\n2. Checking database...');
try {
  const { db } = require('../server/database/init');
  const count = db.prepare('SELECT COUNT(*) as count FROM books').get();
  console.log(`   ✅ Database initialized (${count.count} books found)`);
} catch (error) {
  console.log('   ❌ Database error:', error.message);
}

// Check server can start
console.log('\n3. Testing server startup...');
const server = spawn('node', [path.join(__dirname, '../server/index.js')], {
  env: { ...process.env, PORT: '3002' }
});

let serverStarted = false;
server.stdout.on('data', (data) => {
  if (!serverStarted && data.toString().includes('running')) {
    serverStarted = true;
    console.log('   ✅ Server can start');

    // Test API endpoint
    fetch('http://localhost:3002/api/health')
      .then(res => res.json())
      .then(data => {
        console.log('   ✅ API health check passed');
        console.log('\n✨ Setup test complete! All systems ready.');
        console.log('\nTo start the application:');
        console.log('   npm start');
        console.log('\nOr run components separately:');
        console.log('   npm run server     # Start backend');
        console.log('   npm run react:start # Start frontend');
        console.log('   npm run electron:dev # Start Electron (after frontend is running)');
        server.kill();
        process.exit(0);
      })
      .catch(error => {
        console.log('   ❌ API test failed:', error.message);
        server.kill();
        process.exit(1);
      });
  }
});

server.stderr.on('data', (data) => {
  console.log('   ❌ Server error:', data.toString());
});

// Timeout after 5 seconds
setTimeout(() => {
  if (!serverStarted) {
    console.log('   ❌ Server startup timeout');
    server.kill();
    process.exit(1);
  }
}, 5000);