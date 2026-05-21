// Вкладки
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
    });
});

// Логин
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    const errorDiv = document.getElementById('login-error');

    errorDiv.classList.add('hidden');

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, rememberMe })
    });

    const data = await res.json();
    if (res.ok) {
        window.location.href = '/';
    } else {
        errorDiv.textContent = data.error;
        errorDiv.classList.remove('hidden');
    }
});

// Регистрация
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const errorDiv = document.getElementById('reg-error');

    errorDiv.classList.add('hidden');

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
    });

    const data = await res.json();
    if (res.ok) {
        // Переключаем на вкладку входа
        document.querySelector('.tab-btn[data-tab="login"]').click();
        const loginError = document.getElementById('login-error');
        loginError.textContent = 'Регистрация успешна! Теперь войдите.';
        loginError.style.background = 'rgba(0,255,0,0.1)';
        loginError.style.color = '#0f0';
        loginError.classList.remove('hidden');
        setTimeout(() => loginError.classList.add('hidden'), 3000);
    } else {
        errorDiv.textContent = data.error;
        errorDiv.classList.remove('hidden');
    }
});