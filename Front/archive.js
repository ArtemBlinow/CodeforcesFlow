// archive.js

function formatTime(seconds) {
  const secs = Number(seconds) || 0;
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const secsRemainder = secs % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secsRemainder.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadArchive() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');

  try {
    const response = await fetch('/api/archive');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Ошибка загрузки');
    }

    loading.style.display = 'none';

    if (!data.contests || data.contests.length === 0) {
      content.innerHTML = `
        <div class="empty">
          <h2>Архив пуст</h2>
          <p>Вы ещё не сохранили ни одного контеста</p>
          <p><a href="/contest">Начать новый контест</a></p>
        </div>
      `;
      return;
    }

    let html = '';

    data.contests.forEach(contest => {
      html += `
        <div class="archive-card">
          <div class="archive-header">
            <div>
              <div class="archive-name">${escapeHtml(contest.contest_name)}</div>
              ${contest.link_to_contest ? 
                `<a href="${escapeHtml(contest.link_to_contest)}" target="_blank" class="archive-link" rel="noopener">↗ ${escapeHtml(contest.link_to_contest)}</a>` 
                : ''}
            </div>
          </div>

          <div class="archive-meta">
            <span>⏱ <strong>${formatTime(contest.total_time_spent)}</strong></span>
            <span>📝 Задач: <strong>${contest.problems.length}</strong></span>
          </div>

          <button class="expand-btn" onclick="toggleDetails(this)">📋 Время по задачам</button>
          
          <div class="details">
            <table class="problems-table">
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>📖 Чтение</th>
                  <th>💡 Решение</th>
                  <th>💻 Код</th>
                  <th>🪲 Проверка</th>
                  <th>🐞 Отладка</th>
                  <th>📝 Прочее</th>
                  <th>Всего</th>
                </tr>
              </thead>
              <tbody>
                ${contest.problems.map(p => {
                  const total = 
                    (p.time_reading || 0) + 
                    (p.time_thinking || 0) + 
                    (p.time_coding || 0) + 
                    (p.time_checking || 0) + 
                    (p.time_debugging || 0) + 
                    (p.time_other || 0);
                  
                  return `
                    <tr>
                      <td class="problem-letter">${escapeHtml(p.problem_index)}</td>
                      <td class="time-cell">${formatTime(p.time_reading)}</td>
                      <td class="time-cell">${formatTime(p.time_thinking)}</td>
                      <td class="time-cell">${formatTime(p.time_coding)}</td>
                      <td class="time-cell">${formatTime(p.time_checking)}</td>
                      <td class="time-cell">${formatTime(p.time_debugging)}</td>
                      <td class="time-cell">${formatTime(p.time_other)}</td>
                      <td class="time-cell total-time-cell">${formatTime(total)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    content.innerHTML = html;

  } catch (error) {
    loading.style.display = 'none';
    content.innerHTML = `
      <div class="error">
        ❌ Ошибка загрузки: ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function toggleDetails(btn) {
  const details = btn.nextElementSibling;
  details.classList.toggle('open');
  btn.textContent = details.classList.contains('open') ? '📋 Скрыть' : '📋 Время по задачам';
}

document.addEventListener('DOMContentLoaded', loadArchive);