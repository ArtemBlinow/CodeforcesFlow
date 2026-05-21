const urlParams = new URLSearchParams(window.location.search);
const handle = urlParams.get('handle');

if (!handle) {
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile(handle);
});

async function loadUserProfile(handle) {
  try {
    const response = await fetch(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`
    );
    const data = await response.json();

    if (data.status !== 'OK') {
      alert('Пользователь не найден. Возврат на главную.');
      window.location.href = '/';
      return;
    }

    const user = data.result[0];
    renderProfile(user);
  } catch (err) {
    console.error(err);
    alert('Не удалось загрузить профиль. Проверьте интернет.');
    window.location.href = '/';
  }
}

function renderProfile(user) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const fullNameEl = document.getElementById('full-name');
  if (fullName) {
    fullNameEl.textContent = fullName;
    fullNameEl.style.display = 'block';
  } else {
    fullNameEl.style.display = 'none';
  }

  const rankColor = getRankColor(user.rating);

  const handleEl = document.getElementById('handle');
  handleEl.textContent = user.handle;
  handleEl.style.color = rankColor;

  const locationEl = document.getElementById('country-city');
  const locationParts = [user.country, user.city].filter(Boolean);
  locationEl.textContent = locationParts.join(', ');
  locationEl.style.display = locationParts.length > 0 ? 'block' : 'none';

  toggleStatWithColor('stat-rating', user.rating != null, user.rating, rankColor);

  toggleStatWithColor('stat-rank', !!user.rank, user.rank, rankColor);

  const avatar = document.getElementById('avatar');
  if (user.titlePhoto) {
    avatar.src = user.titlePhoto;
    avatar.style.display = 'block';
    avatar.style.borderColor = rankColor;
  } else {
    avatar.style.display = 'none';
  }
}

function toggleStat(statId, hasValue, text) {
  const statEl = document.getElementById(statId);
  if (!statEl) return;

  const valueEl = statEl.querySelector('.stat-value');
  if (hasValue) {
    if (valueEl) {
      valueEl.textContent = text;
    }
    statEl.classList.remove('hidden');
  } else {
    statEl.classList.add('hidden');
  }
}

function toggleStatWithColor(statId, hasValue, text, color) {
  const statEl = document.getElementById(statId);
  if (!statEl) return;

  const valueEl = statEl.querySelector('.stat-value');
  if (hasValue && valueEl) {
    valueEl.textContent = text;
    valueEl.style.color = color;
    statEl.classList.remove('hidden');
  } else {
    statEl.classList.add('hidden');
  }
}

function getRankName(rating) {
  if (rating === undefined) return '—';
  if (rating < 1200) return 'Newbie';
  if (rating < 1400) return 'Pupil';
  if (rating < 1600) return 'Specialist';
  if (rating < 1900) return 'Expert';
  if (rating < 2100) return 'Candidate Master';
  if (rating < 2300) return 'Master';
  if (rating < 2400) return 'International Master';
  if (rating < 2600) return 'Grandmaster';
  if (rating < 3000) return 'International Grandmaster';
  return 'Legendary Grandmaster';
}

document.getElementById('account-btn')?.addEventListener('click', () => {
  window.location.href = 'account';
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('codeforcesHandle');
  window.location.href = '/';
});

function getRankColor(rating) {
  if (rating == null || rating < 0) return 'var(--cf-white)';

  if (rating >= 3000) return 'var(--cf-legendary)';     // Legendary Grandmaster
  if (rating >= 2600) return 'var(--cf-red)';           // International Grandmaster
  if (rating >= 2400) return 'var(--cf-red)';           // Grandmaster
  if (rating >= 2300) return 'var(--cf-orange)';        // International Master
  if (rating >= 2100) return 'var(--cf-orange)';        // Master
  if (rating >= 1900) return 'var(--cf-violet)';        // Candidate Master
  if (rating >= 1600) return 'var(--cf-blue)';          // Expert
  if (rating >= 1400) return 'var(--cf-cyan)';          // Specialist
  if (rating >= 1200) return 'var(--cf-green)';         // Pupil
  return 'var(--cf-grey)';                              // Newbie (0–1199)
}
