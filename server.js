const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const {
    register, login, checkSession, logout,
    getLoginByUserId, getUserById, getSessionsByUserId, getUserIdFromSession
} = require('./Back/full-auth');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'Front')));

function log(msg) {
    const line = `[${new Date().toLocaleString()}] ${msg}\n`;
    fs.appendFileSync('users.log', line);
}

async function isAuthenticated(req) {
    const token = req.cookies.session_token;
    if (!token) return false;
    const result = await checkSession(token);
    return result.success;
}

app.post('/api/register', async (req, res) => {
    const { login, password } = req.body;
    const result = await register(login, password);

    if (result.success) {
        log(`REGISTER OK: ${login}`);
        res.json({ success: true });
    } else {
        log(`REGISTER FAIL: ${login} - ${result.error}`);
        res.status(400).json({ error: result.error });
    }
});

app.post('/api/login', async (req, res) => {
    const { login: userLogin, password, rememberMe } = req.body;
    const result = await login(userLogin, password, rememberMe);

    if (result.success) {
        log(`LOGIN OK: ${userLogin}`);
        res.cookie('session_token', result.token, {
            httpOnly: true,
            maxAge: (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000
        });
        res.json({ success: true, login: result.login, redirect: '/' });
    } else {
        log(`LOGIN FAIL: ${userLogin} - ${result.error}`);
        res.status(401).json({ error: result.error });
    }
});

app.get('/api/me', async (req, res) => {
    const token = req.cookies.session_token;
    const result = await checkSession(token);

    if (result.success) {
        res.json(result.user);
    } else {
        res.status(401).json({ error: result.error });
    }
});

app.post('/api/logout', async (req, res) => {
    const token = req.cookies.session_token;

    let userLogin = null;
    if (token) {
        const session = await checkSession(token);
        if (session.success && session.user) {
            userLogin = session.user.login;
        }
    }

    await logout(token);
    res.clearCookie('session_token');

    if (userLogin) {
        log(`LOGOUT: ${userLogin} - Session ended`);
    }

    res.json({ success: true, redirect: '/' });
});

app.put('/api/account/password', async (req, res) => {
    const token = req.cookies.session_token;
    const userId = await getUserIdFromSession(token);

    if (!userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    try {
        const crypto = require('crypto');
        const db = require('./db');

        const currentHash = crypto.createHash('sha256').update(currentPassword).digest('hex');

        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, login FROM users WHERE id = ? AND password_hash = ?',
                [userId, currentHash],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!user) {
            log(`PASSWORD_CHANGE FAIL: user_id=${userId} - Неверный текущий пароль`);
            return res.status(400).json({ error: 'Неверный текущий пароль' });
        }

        const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                [newHash, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // ЛОГИРУЕМ успешную смену пароля
        log(`PASSWORD_CHANGE OK: ${user.login} (user_id=${userId})`);

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/account/privacy', async (req, res) => {
    const token = req.cookies.session_token;
    const userId = await getUserIdFromSession(token);

    if (!userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    const { private_profile } = req.body;

    try {
        const db = require('./db');

        // Получаем логин пользователя для логирования
        const login = await getLoginByUserId(userId);

        // Получаем старое значение
        const oldPrivacy = await new Promise((resolve, reject) => {
            db.get('SELECT private_profile FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row?.private_profile);
            });
        });

        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET private_profile = ? WHERE id = ?',
                [private_profile, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        log(`PRIVACY_CHANGE: ${login} (user_id=${userId}) - changed from ${oldPrivacy} to ${private_profile}`);

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/sessions/revoke', async (req, res) => {
    const token = req.cookies.session_token;
    const userId = await getUserIdFromSession(token);

    if (!userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    const { token: tokenToRevoke } = req.body;

    if (tokenToRevoke === token) {
        return res.status(400).json({ error: 'Нельзя завершить текущую сессию' });
    }

    try {
        const db = require('./db');

        // Получаем логин пользователя
        const login = await getLoginByUserId(userId);

        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM sessions WHERE token = ? AND user_id = ?',
                [tokenToRevoke, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // ЛОГИРУЕМ завершение сессии
        log(`SESSION_REVOKE: ${login} (user_id=${userId}) - revoked session ${tokenToRevoke.substring(0, 8)}...`);

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// === Удаление аккаунта ===
app.delete('/api/account/delete', async (req, res) => {
    const token = req.cookies.session_token;

    // Сначала получаем ВСЕ данные пользователя ДО проверки сессии
    let userId = null;
    let userLogin = null;

    try {
        const db = require('./db');

        // Получаем userId из сессии отдельным запросом
        if (token) {
            const session = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")',
                    [token],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (session) {
                userId = session.user_id;
                // Получаем логин пользователя
                const user = await new Promise((resolve, reject) => {
                    db.get('SELECT login FROM users WHERE id = ?', [userId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                if (user) {
                    userLogin = user.login;
                }
            }
        }
    } catch (err) {
        console.error('Ошибка получения данных пользователя:', err);
    }

    if (!userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Пароль обязателен' });
    }

    try {
        const crypto = require('crypto');
        const db = require('./db');

        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

        // Проверяем пароль
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, login FROM users WHERE id = ? AND password_hash = ?',
                [userId, passwordHash],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!user) {
            log(`ACCOUNT_DELETE FAIL: ${userLogin || userId} (user_id=${userId}) - Неверный пароль`);
            return res.status(400).json({ error: 'Неверный пароль' });
        }

        // Сохраняем логин для лога
        const finalLogin = user.login;

        // Удаляем все сессии пользователя
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM sessions WHERE user_id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Удаляем пользователя
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // ЛОГИРУЕМ удаление аккаунта
        log(`ACCOUNT_DELETE OK: ${finalLogin} (user_id=${userId}) - Account deleted`);

        // Очищаем cookie
        res.clearCookie('session_token');

        return res.status(200).json({
            success: true,
            redirect: '/'
        });

    } catch (err) {
        console.error('Ошибка при удалении аккаунта:', err);
        log(`ACCOUNT_DELETE ERROR: ${userLogin || userId} - ${err.message}`);
        return res.status(500).json({ error: 'Ошибка сервера при удалении аккаунта' });
    }
});

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'Front', 'index.html'));

    // const authenticated = await isAuthenticated(req);
    // if (authenticated) {
    //     res.sendFile(path.join(__dirname, 'Front', 'index.html'));
    // } else {
    //     res.redirect('/auth');
    // }
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Front', 'dashboard.html'));
});

app.get('/auth', async (req, res) => {
    const authenticated = await isAuthenticated(req);
    if (authenticated) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, 'Front', 'full-auth.html'));
    }
});

app.get('/account', async (req, res) => {
    const authenticated = await isAuthenticated(req);
    if (!authenticated) {
        return res.sendFile(path.join(__dirname, 'Front', 'full-auth.html'));
    }

    const token = req.cookies.session_token;
    const userId = await getUserIdFromSession(token);
    const user = await getUserById(userId);
    const sessions = await getSessionsByUserId(userId);

    const accountData = {
        login: user.login,
        created_at: user.created_at,
        private_profile: user.private_profile,
        current_session_token: token,
        sessions: sessions.map(s => ({
            token: s.token,
            user_agent: s.user_agent || 'Неизвестное устройство',
            expires_at: s.expires_at
        }))
    };

    let html = fs.readFileSync(path.join(__dirname, 'Front', 'account.html'), 'utf-8');
    html = html.replace('__ACCOUNT_DATA_PLACEHOLDER__', JSON.stringify(accountData));
    res.send(html);
});


app.listen(PORT, () => {
    log(`SERVER START: http://localhost:${PORT}`);
});