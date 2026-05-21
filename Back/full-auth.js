const crypto = require('crypto');
const db = require('../db'); // путь к db.js в корне

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function register(login, password) {
    if (!login || !password) {
        return { success: false, error: 'Логин и пароль обязательны' };
    }

    const passwordHash = hashPassword(password);

    try {
        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (login, password_hash) VALUES (?, ?)',
                [login, passwordHash],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            resolve({ success: false, error: 'Пользователь уже существует' });
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({ success: true, userId: this.lastID });
                    }
                }
            );
        });

        return result;
    } catch (err) {
        console.error(err);
        return { success: false, error: 'Ошибка базы данных' };
    }
}

async function login(login, password, rememberMe = false) {
    if (!login || !password) {
        return { success: false, error: 'Логин и пароль обязательны' };
    }

    const passwordHash = hashPassword(password);

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, login FROM users WHERE login = ? AND password_hash = ?',
                [login, passwordHash],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!user) {
            return { success: false, error: 'Неверный логин или пароль' };
        }

        const token = generateToken();
        const expiresDays = rememberMe ? 30 : 1;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresDays);

        const expiresStr = expiresAt.toISOString().replace('T', ' ').substring(0, 19);

        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
                [token, user.id, expiresStr],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        return { success: true, token, userId: user.id, login: user.login };

    } catch (err) {
        console.error(err);
        return { success: false, error: 'Ошибка базы данных' };
    }
}

async function checkSession(token) {
    if (!token) {
        return { success: false, error: 'Нет токена' };
    }

    try {
        const session = await new Promise((resolve, reject) => {
            db.get(
                `SELECT s.user_id, u.login 
         FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.token = ? AND s.expires_at > datetime("now")`,
                [token],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!session) {
            return { success: false, error: 'Сессия истекла' };
        }

        return {
            success: true,
            user: {
                id: session.user_id,
                login: session.login
            }
        };

    } catch (err) {
        console.error(err);
        return { success: false, error: 'Ошибка базы данных' };
    }
}

async function logout(token) {
    if (!token) return { success: false };

    try {
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM sessions WHERE token = ?', [token], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        return { success: true };
    } catch (err) {
        return { success: false };
    }
}

async function getLoginByUserId(userId) {
    if (!userId) return 'unknown';
    try {
        const db = require('./db');
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT login FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        return user ? user.login : 'unknown';
    } catch (err) {
        return 'unknown';
    }
}

async function getUserById(userId) {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, login, private_profile, created_at FROM users WHERE id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        return user;
    } catch (err) {
        console.error(err);
        return null;
    }
}

async function getSessionsByUserId(userId) {
    try {
        const sessions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT token, expires_at 
                 FROM sessions 
                 WHERE user_id = ? AND expires_at > datetime("now")`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        return sessions;
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function getUserIdFromSession(token) {
    if (!token) return null;
    const result = await checkSession(token);
    return result.success ? result.user.id : null;
}

module.exports = {
    register, login, checkSession, logout,
    getLoginByUserId, getUserById, getSessionsByUserId, getUserIdFromSession
};