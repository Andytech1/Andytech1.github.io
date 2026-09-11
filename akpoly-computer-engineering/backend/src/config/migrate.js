// Applies every .sql file in database/migrations, in filename order.
// Run with: npm run migrate

const fs = require('fs');
const path = require('path');
const db = require('./db');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'database', 'migrations');

function run() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found in', MIGRATIONS_DIR);
    return;
  }

  for (const file of files) {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`Applying migration: ${file}`);
    db.exec(sql);
  }

  console.log('All migrations applied successfully.');
}

run();
