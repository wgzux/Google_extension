const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'redmine-helper.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initTables();
    }
    return db;
}

function initTables() {
    db.exec(`
        -- Cấu hình hệ thống (cache trackers, statuses, priorities từ Redmine)
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Thông tin user kết nối Redmine
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            redmine_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            display_name TEXT,
            redmine_user_id INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Dữ liệu mở rộng cho Issue (plan release, deadline, note...)
        CREATE TABLE IF NOT EXISTS issue_extensions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            redmine_issue_id INTEGER NOT NULL,
            plan_release TEXT,
            dev_date TEXT,
            pre_date TEXT,
            release_date TEXT,
            environment TEXT,
            extra TEXT,
            note TEXT,
            is_special_subtask INTEGER DEFAULT 0,
            code_status TEXT,
            test_status TEXT,
            code_deadline TEXT,
            test_deadline TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, redmine_issue_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Danh sách issue đang watch
        CREATE TABLE IF NOT EXISTS watches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            redmine_issue_id INTEGER NOT NULL,
            issue_subject TEXT,
            issue_root TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, redmine_issue_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Ghi nhớ cá nhân
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            status INTEGER DEFAULT 1,
            related_issue_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

    console.log('[DB] Tables initialized successfully');
}

module.exports = { getDb };
