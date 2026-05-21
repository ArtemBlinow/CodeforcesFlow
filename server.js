const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { register, login, checkSession, logout } = require('./Back/full-auth');

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
        res.json({ success: true, login: result.login });
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
    await logout(token);
    res.clearCookie('session_token');
    res.json({ success: true });
});

app.get('/', async (req, res) => {
    const authenticated = await isAuthenticated(req);
    if (authenticated) {
        res.sendFile(path.join(__dirname, 'Front', 'index.html'));
    } else {
        res.redirect('/auth');
    }
});

app.get('/auth', async (req, res) => {
    const authenticated = await isAuthenticated(req);
    if (authenticated) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, 'Front', 'full-auth.html'));
    }
});

app.listen(PORT, () => {
    log(`SERVER START: http://localhost:${PORT}`);
});