// account.js

document.addEventListener('DOMContentLoaded', () => {
    // === DOM-элементы ===
    const accountLogin = document.getElementById('account-login');
    const accountCreated = document.getElementById('account-created');
    const privateProfileCheckbox = document.getElementById('private-profile');
    const savePrivacyBtn = document.getElementById('save-privacy-btn');
    const privacyError = document.getElementById('privacy-error');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const passwordError = document.getElementById('password-error');
    const sessionsList = document.getElementById('sessions-list');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteError = document.getElementById('delete-error');
    const deleteModal = document.getElementById('delete-modal');
    const deletePasswordInput = document.getElementById('delete-password');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deleteModalError = document.getElementById('delete-modal-error');
    const logoutBtn = document.getElementById('logout-btn');

    // === Данные из сервера ===
    const accountData = window.__accountData;
    let currentSessionToken = accountData.current_session_token;

    // === Утилиты ===
    function showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }

    function hideError(element) {
        element.textContent = '';
        element.classList.add('hidden');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // === Инициализация данных ===
    accountLogin.textContent = accountData.login;
    accountCreated.textContent = new Date(accountData.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    privateProfileCheckbox.checked = accountData.private_profile === 1;
    renderSessions(accountData.sessions);

    // === Сессии ===
    function renderSessions(sessions) {
        if (!sessions || sessions.length === 0) {
            sessionsList.innerHTML = '<p class="placeholder-text">Нет активных сессий</p>';
            return;
        }

        sessionsList.innerHTML = sessions.map(session => {
            const isCurrent = session.token === currentSessionToken;
            const expiresDate = new Date(session.expires_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="session-item">
                    <div class="session-info">
                        <span class="session-device">${escapeHtml(session.user_agent || 'Неизвестное устройство')}</span>
                        <span class="session-expires">Истекает: ${expiresDate}</span>
                        ${isCurrent ? '<span class="session-current">Текущая сессия</span>' : ''}
                    </div>
                    ${!isCurrent ? `<button class="session-revoke" data-token="${session.token}">Завершить</button>` : ''}
                </div>
            `;
        }).join('');

        document.querySelectorAll('.session-revoke').forEach(btn => {
            btn.addEventListener('click', () => revokeSession(btn.dataset.token));
        });
    }

    async function revokeSession(token) {
        try {
            const response = await fetch('/api/sessions/revoke', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            if (!response.ok) throw new Error('Ошибка при завершении сессии');

            // Перезагружаем страницу чтобы обновить список
            window.location.reload();

        } catch (err) {
            console.error(err);
        }
    }

    // === Приватность ===
    savePrivacyBtn.addEventListener('click', async () => {
        hideError(privacyError);
        savePrivacyBtn.disabled = true;
        savePrivacyBtn.textContent = 'Сохранение...';

        try {
            const response = await fetch('/api/account/privacy', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    private_profile: privateProfileCheckbox.checked ? 1 : 0
                })
            });

            if (!response.ok) throw new Error('Ошибка сохранения');

            savePrivacyBtn.textContent = 'Сохранено ✓';
            setTimeout(() => {
                savePrivacyBtn.textContent = 'Сохранить настройки';
            }, 2000);

        } catch (err) {
            showError(privacyError, 'Не удалось сохранить настройки');
            savePrivacyBtn.textContent = 'Сохранить настройки';
        } finally {
            savePrivacyBtn.disabled = false;
        }
    });

    // === Смена пароля ===
    changePasswordBtn.addEventListener('click', async () => {
        hideError(passwordError);

        const currentPassword = currentPasswordInput.value.trim();
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
            showError(passwordError, 'Все поля обязательны для заполнения');
            return;
        }

        if (newPassword.length < 4) {
            showError(passwordError, 'Новый пароль должен содержать минимум 4 символа');
            return;
        }

        if (newPassword !== confirmPassword) {
            showError(passwordError, 'Новый пароль и подтверждение не совпадают');
            return;
        }

        changePasswordBtn.disabled = true;
        changePasswordBtn.textContent = 'Смена пароля...';

        try {
            const response = await fetch('/api/account/password', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка смены пароля');
            }

            currentPasswordInput.value = '';
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';

            changePasswordBtn.textContent = 'Пароль изменён ✓';
            setTimeout(() => {
                changePasswordBtn.textContent = 'Сменить пароль';
            }, 2000);

        } catch (err) {
            showError(passwordError, err.message);
            changePasswordBtn.textContent = 'Сменить пароль';
        } finally {
            changePasswordBtn.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                localStorage.removeItem('codeforcesHandle');
                window.location.href = '/';
            }
        } catch (err) {
            console.error(err);
        }
    });

    // === Удаление аккаунта ===
    deleteAccountBtn.addEventListener('click', () => {
        deleteModal.classList.remove('hidden');
        deletePasswordInput.value = '';
        hideError(deleteModalError);
        deletePasswordInput.focus();
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
    });

    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            deleteModal.classList.add('hidden');
        }
    });

    // === Удаление аккаунта ===
    confirmDeleteBtn.addEventListener('click', async () => {
        hideError(deleteModalError);

        const password = deletePasswordInput.value.trim();
        if (!password) {
            showError(deleteModalError, 'Введите пароль для подтверждения');
            return;
        }

        // Блокируем кнопку и показываем индикатор загрузки
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Удаление...';

        // Отключаем кнопку закрытия модального окна
        cancelDeleteBtn.disabled = true;

        try {
            const response = await fetch('/api/account/delete', {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            // Парсим ответ
            let data;
            try {
                data = await response.json();
            } catch (e) {
                throw new Error('Не удалось получить ответ от сервера');
            }

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка удаления аккаунта');
            }

            if (data.success) {
                localStorage.removeItem('codeforcesHandle');
                window.location.href = data.redirect;
            } else {
                throw new Error(data.error || 'Неизвестная ошибка');
            }

        } catch (err) {
            console.error('Ошибка удаления:', err);
            showError(deleteModalError, err.message);

            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'Удалить аккаунт';
            cancelDeleteBtn.disabled = false;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !deleteModal.classList.contains('hidden')) {
            deleteModal.classList.add('hidden');
        }
    });
});