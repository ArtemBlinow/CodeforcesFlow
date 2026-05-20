const savedHandle = localStorage.getItem('codeforcesHandle');
if (savedHandle) {
  window.location.href = 'dashboard.html?handle=' + encodeURIComponent(savedHandle);
}

async function checkHandleExists(handle) {
  try {
    const response = await fetch(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`
    );

    const data = await response.json();

    if (data.status === 'OK') {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
}

document.getElementById('auth-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const handleInput = document.getElementById('handle-input');
  const errorEl = document.getElementById('handle-error');

  const handle = handleInput.value.trim();

  errorEl.textContent = '';
  handleInput.classList.remove('input-error');

  if (!handle) {
    showError('Пожалуйста, введите хендл.');
    return;
  }

  const exist = await checkHandleExists(handle);
  if (exist) {
    localStorage.setItem('codeforcesHandle', handle);
    window.location.href = 'dashboard.html?handle=' + encodeURIComponent(handle);
  } else {
    showError("Аккаунт не найден");
  }
});

function showError(message) {
  const errorEl = document.getElementById('handle-error');
  errorEl.textContent = message;
}