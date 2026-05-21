document.addEventListener('DOMContentLoaded', () => {
  // Проверка авторизации — теперь показывает guest-notice если НЕ авторизован
  async function checkAuth() {
    const guestNotice = document.getElementById('guest-notice');

    try {
      const response = await fetch('/api/me', { credentials: 'include' });

      if (!response.ok && guestNotice) {
        // Пользователь НЕ авторизован — показываем уведомление
        guestNotice.style.display = 'block';
      }
      // Если авторизован — элемент остаётся скрытым (display: none по умолчанию)
    } catch (err) {
      // При ошибке запроса тоже показываем (считаем что не авторизован)
      if (guestNotice) {
        guestNotice.style.display = 'block';
      }
    }
  }

  // Проверка хэндла
  async function checkHandleExists(handle) {
    try {
      const response = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
      const data = await response.json();
      return data.status === 'OK';
    } catch (e) {
      return false;
    }
  }

  // Валидация хэндла (только латиница, цифры, подчёркивания, дефисы, точки)
  function isValidHandle(handle) {
    return /^[a-zA-Z0-9_.-]+$/.test(handle);
  }

  // Форма
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = document.getElementById('handle-input');
    const handle = input.value.trim();
    const errorDiv = document.getElementById('handle-error');

    errorDiv.textContent = '';

    if (!handle) {
      errorDiv.textContent = 'Введите хэндл';
      return;
    }

    if (!isValidHandle(handle)) {
      errorDiv.textContent = 'Некорректный хендл';
      return;
    }

    const exists = await checkHandleExists(handle);

    if (exists) {
      localStorage.setItem('codeforcesHandle', handle);
      window.location.href = '/dashboard?handle=' + encodeURIComponent(handle);
    } else {
      errorDiv.textContent = 'Пользователь не найден';
    }
  });

  // Кнопки
  document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/auth';
  });

  document.getElementById('go-to-account')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/account';
  });

  document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('codeforcesHandle');
    window.location.reload();
  });

  // Автопереход с проверкой
  async function autoRedirect() {
    const savedHandle = localStorage.getItem('codeforcesHandle');
    if (savedHandle && window.location.pathname === '/') {
      if (!isValidHandle(savedHandle)) {
        localStorage.removeItem('codeforcesHandle');
        return;
      }
      const valid = await checkHandleExists(savedHandle);
      if (valid) {
        window.location.href = '/dashboard?handle=' + encodeURIComponent(savedHandle);
      } else {
        localStorage.removeItem('codeforcesHandle');
      }
    }
  }

  autoRedirect();
  checkAuth();
});