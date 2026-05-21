document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('login').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm-password').value;
    const errorDiv = document.getElementById('error-message');

    errorDiv.classList.add('hidden');

    if (password !== confirm) {
        errorDiv.textContent = 'Пароли не совпадают';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });

        const data = await response.json();

        if (response.ok) {
            window.location.href = 'login.html';
        } else {
            errorDiv.textContent = data.error || 'Ошибка регистрации';
            errorDiv.classList.remove('hidden');
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения';
        errorDiv.classList.remove('hidden');
    }
});