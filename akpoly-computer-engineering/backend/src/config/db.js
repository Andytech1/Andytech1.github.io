const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '..', '..', process.env.DATABASE_PATH || '../database/akpoly.db');

// Ensure the folder that will hold the SQLite file exists (e.g. the external SSD mount point)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // better concurrent read/write behaviour on the Pi
db.pragma('foreign_keys = ON');

module.exports = db;
