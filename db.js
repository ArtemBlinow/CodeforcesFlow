const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

db.run('PRAGMA foreign_keys = ON');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            private_profile INTEGER DEFAULT 0,
            no_permanent_password INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            link_to_contest TEXT UNIQUE,
            name TEXT NOT NULL,
            platform TEXT DEFAULT 'CF'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS problems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contest_id INTEGER NOT NULL,
            problem_index TEXT NOT NULL,
            name TEXT NOT NULL,
            rating INTEGER,
            tags TEXT,
            FOREIGN KEY (contest_id) REFERENCES contests (id) ON DELETE CASCADE,
            UNIQUE(contest_id, problem_index)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contest_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            contest_id INTEGER NOT NULL,
            total_time_spent INTEGER DEFAULT 0,
            comment TEXT,
            mood TEXT CHECK(mood IN ('GREAT', 'GOOD', 'NORMAL', 'BAD', 'TERRIBLE')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (contest_id) REFERENCES contests (id) ON DELETE CASCADE,
            UNIQUE(user_id, contest_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS problem_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contest_result_id INTEGER NOT NULL,
            problem_id INTEGER NOT NULL,
            solved INTEGER DEFAULT 0,
            attempts INTEGER DEFAULT 0,
            solution_time INTEGER,
            time_reading INTEGER DEFAULT 0,
            time_thinking INTEGER DEFAULT 0,
            time_coding INTEGER DEFAULT 0,
            time_checking INTEGER DEFAULT 0,
            time_debugging INTEGER DEFAULT 0,
            time_other INTEGER DEFAULT 0,
            comment TEXT,
            FOREIGN KEY (contest_result_id) REFERENCES contest_results (id) ON DELETE CASCADE,
            FOREIGN KEY (problem_id) REFERENCES problems (id) ON DELETE CASCADE,
            UNIQUE(contest_result_id, problem_id)
        )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_contests_cf ON contests(link_to_contest)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_problems_contest ON problems(contest_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_problems_rating ON problems(rating)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_contest_results_user ON contest_results(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_contest_results_contest ON contest_results(contest_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_problem_results_result ON problem_results(contest_result_id)`);
});

module.exports = db;