const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const db = require('./db');
const {
    register, login, checkSession, logout,
    getLoginByUserId, getUserById, getSessionsByUserId, getUserIdFromSession
} = require('./Back/full-auth');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'Front')));

function log(file, msg) {
    const line = `[${new Date().toLocaleString()}] ${msg}\n`;
    const logPath = path.join('logs', file);
    fs.appendFileSync(logPath, line);
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
        log('users.log', `REGISTER OK: ${login}`);
        res.json({ success: true });
    } else {
        log('users.log', `REGISTER FAIL: ${login} - ${result.error}`);
        res.status(400).json({ error: result.error });
    }
});

app.post('/api/login', async (req, res) => {
    const { login: userLogin, password, rememberMe } = req.body;
    const result = await login(userLogin, password, rememberMe);

    if (result.success) {
        log('users.log', `LOGIN OK: ${userLogin}`);
        res.cookie('session_token', result.token, {
            httpOnly: true,
            maxAge: (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000
        });
        res.json({ success: true, login: result.login, redirect: '/' });
    } else {
        log('users.log', `LOGIN FAIL: ${userLogin} - ${result.error}`);
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
        log('users.log', `LOGOUT: ${userLogin} - Session ended`);
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
            log('users.log', `PASSWORD_CHANGE FAIL: user_id=${userId} - Неверный текущий пароль`);
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
        log('users.log', `PASSWORD_CHANGE OK: ${user.login} (user_id=${userId})`);

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

        log('users.log', `PRIVACY_CHANGE: ${login} (user_id=${userId}) - changed from ${oldPrivacy} to ${private_profile}`);

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
        log('users.log', `SESSION_REVOKE: ${login} (user_id=${userId}) - revoked session ${tokenToRevoke.substring(0, 8)}...`);

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/account/delete', async (req, res) => {
    const token = req.cookies.session_token;

    // Сначала получаем ВСЕ данные пользователя ДО проверки сессии
    let userId = null;
    let userLogin = null;

    try {
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
            log('users.log', `ACCOUNT_DELETE FAIL: ${userLogin || userId} (user_id=${userId}) - Неверный пароль`);
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
        log('users.log', `ACCOUNT_DELETE OK: ${finalLogin} (user_id=${userId}) - Account deleted`);

        // Очищаем cookie
        res.clearCookie('session_token');

        return res.status(200).json({
            success: true,
            redirect: '/'
        });

    } catch (err) {
        console.error('Ошибка при удалении аккаунта:', err);
        log('users.log', `ACCOUNT_DELETE ERROR: ${userLogin || userId} - ${err.message}`);
        return res.status(500).json({ error: 'Ошибка сервера при удалении аккаунта' });
    }
});

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'Front', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Front', 'dashboard.html'));
});

app.get('/contest', (req, res) => {
    res.sendFile(path.join(__dirname, 'Front', '/contest.html'));
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

// POST /api/contest/save
app.post('/api/contest/save', async (req, res) => {
    const file = 'contests.log';

    try {
        // Получаем userId из сессии
        const token = req.cookies.session_token;
        const userId = await getUserIdFromSession(token);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Не авторизован' });
        }

        const { contestId, contestName, platform, mode, totalTime, problems } = req.body;

        log(file, `=== Начало сохранения контеста #${contestId} ===`);
        log(file, `Параметры: platform=${platform}, mode=${mode}, totalTime=${totalTime}с, задач=${problems?.length || 0}`);
        log(file, `Пользователь: id=${userId}`);

        // 1. Ищем контест
        log(file, `Поиск контеста по ссылке: https://codeforces.com/contest/${contestId}`);
        let contest = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM contests WHERE link_to_contest = ?',
                [`https://codeforces.com/contest/${contestId}`],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!contest) {
            log(file, 'Контест не найден в базе, создаём новый');

            const contestId_db = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO contests (link_to_contest, name, platform) VALUES (?, ?, ?)',
                    [
                        `https://codeforces.com/contest/${contestId}`,
                        contestName || `Codeforces Round #${contestId}`,
                        'CF'
                    ],
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });

            contest = { id: contestId_db };
            log(file, `Контест создан: id=${contest.id}, name="${contestName}"`);

            log(file, `Добавление ${problems.length} задач`);
            for (const p of problems) {
                await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO problems (contest_id, problem_index, name, rating, tags) VALUES (?, ?, ?, ?, ?)',
                        [contest.id, p.letter, p.title, p.rating || 0, p.tags || ''],
                        err => err ? reject(err) : resolve()
                    );
                });
                log(file, `  Задача ${p.letter}: "${p.title}", rating=${p.rating || 0}`);
            }
        } else {
            log(file, `Контест найден: id=${contest.id}`);
        }

        // 2. Ищем или создаём результат
        log(file, `Проверка существующего результата: user_id=${userId}, contest_id=${contest.id}`);
        let contestResult = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM contest_results WHERE user_id = ? AND contest_id = ?',
                [userId, contest.id],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (contestResult) {
            log(file, `Результат найден: id=${contestResult.id}, обновляем`);
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE contest_results SET total_time_spent = ?, comment = ?, mood = ? WHERE id = ?',
                    [totalTime, '', 'NORMAL', contestResult.id],
                    err => err ? reject(err) : resolve()
                );
            });
        } else {
            log(file, 'Результат не найден, создаём новый');
            const resultId = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO contest_results (user_id, contest_id, total_time_spent, mood) VALUES (?, ?, ?, ?)',
                    [userId, contest.id, totalTime, 'NORMAL'],
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
            contestResult = { id: resultId };
            log(file, `Результат создан: id=${contestResult.id}`);
        }

        // 3. Сохраняем результаты по задачам
        log(file, `Сохранение результатов по ${problems.length} задачам`);
        for (const p of problems) {
            const problem = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id FROM problems WHERE contest_id = ? AND problem_index = ?',
                    [contest.id, p.letter],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            if (!problem) {
                log(file, `  Задача ${p.letter}: НЕ НАЙДЕНА в базе, пропускаем`);
                continue;
            }

            const existingProblem = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id FROM problem_results WHERE contest_result_id = ? AND problem_id = ?',
                    [contestResult.id, problem.id],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            const stats = p.stats || {};
            const problemData = {
                solved: p.solved ? 1 : 0,
                attempts: p.attempts || 0,
                solution_time: p.solutionTime || null,
                time_reading: stats.reading || 0,
                time_thinking: stats.thinking || 0,
                time_coding: stats.coding || 0,
                time_checking: stats.debuggingBefore || 0,
                time_debugging: stats.debuggingAfter || 0,
                time_other: stats.other || 0,
                comment: p.comment || ''
            };

            if (existingProblem) {
                log(file, `  Задача ${p.letter}: обновление (id=${existingProblem.id})`);
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE problem_results SET 
                            solved = ?, attempts = ?, solution_time = ?,
                            time_reading = ?, time_thinking = ?, time_coding = ?,
                            time_checking = ?, time_debugging = ?, time_other = ?,
                            comment = ?
                        WHERE id = ?`,
                        [
                            problemData.solved, problemData.attempts, problemData.solution_time,
                            problemData.time_reading, problemData.time_thinking, problemData.time_coding,
                            problemData.time_checking, problemData.time_debugging, problemData.time_other,
                            problemData.comment,
                            existingProblem.id
                        ],
                        err => err ? reject(err) : resolve()
                    );
                });
            } else {
                log(file, `  Задача ${p.letter}: создание`);
                const newProblemId = await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO problem_results 
                            (contest_result_id, problem_id, solved, attempts, solution_time,
                             time_reading, time_thinking, time_coding,
                             time_checking, time_debugging, time_other, comment)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            contestResult.id, problem.id,
                            problemData.solved, problemData.attempts, problemData.solution_time,
                            problemData.time_reading, problemData.time_thinking, problemData.time_coding,
                            problemData.time_checking, problemData.time_debugging, problemData.time_other,
                            problemData.comment
                        ],
                        function (err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        }
                    );
                });
                log(file, `    id=${newProblemId}`);
            }
        }

        log(file, `=== Сохранение завершено успешно ===`);
        log(file, '');

        res.json({
            success: true,
            message: 'Результаты сохранены',
            contestResultId: contestResult.id
        });

    } catch (error) {
        log(file, `❌ ОШИБКА: ${error.message}`);
        log(file, `Стек: ${error.stack}`);
        log(file, '');

        console.error('Ошибка сохранения:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при сохранении результатов'
        });
    }
});

// GET /api/archive — получить контесты текущего пользователя
app.get('/api/archive', async (req, res) => {
    try {
        const token = req.cookies.session_token;
        const userId = await getUserIdFromSession(token);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Не авторизован' });
        }

        const contests = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    cr.id as result_id,
                    cr.total_time_spent,
                    cr.comment as contest_comment,
                    cr.mood,
                    c.id as contest_id,
                    c.name as contest_name,
                    c.link_to_contest,
                    c.platform
                FROM contest_results cr
                JOIN contests c ON cr.contest_id = c.id
                WHERE cr.user_id = ?
                ORDER BY cr.id DESC
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        for (const contest of contests) {
            contest.problems = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        pr.*,
                        p.problem_index,
                        p.name as problem_name,
                        p.rating,
                        p.tags
                    FROM problem_results pr
                    JOIN problems p ON pr.problem_id = p.id
                    WHERE pr.contest_result_id = ?
                    ORDER BY p.problem_index
                `, [contest.result_id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        }

        res.json({ success: true, contests });

    } catch (error) {
        console.error('Ошибка загрузки архива:', error);
        res.status(500).json({ success: false, message: 'Ошибка загрузки архива' });
    }
});

app.get('/archive', (req, res) => {
    res.sendFile(path.join(__dirname, 'Front', 'archive.html'));
});

app.listen(PORT, () => {
    log('global.log', `SERVER START: http://localhost:${PORT}`);
});
