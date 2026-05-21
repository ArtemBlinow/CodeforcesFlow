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

    if (login.length < 3) {
        return { success: false, error: 'Логин должен быть минимум 3 символа' };
    }

    if (password.length < 4) {
        return { success: false, error: 'Пароль должен быть минимум 4 символа' };
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

        // Вычисляем дату на JavaScript
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresDays);

        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
                [token, user.id, expiresAt.toISOString()],
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

module.exports = { register, login, checkSession, logout };