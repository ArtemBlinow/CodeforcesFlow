let timerInterval = null;
let elapsedTime = 0;
let problems = [];
let currentProblemLetter = null;
let isRunning = false;

let problemStats = {}; // { "A": { reading: 0, thinking: 0, ... }, "B": {...} }

let currentStage = null;
let stageTimerInterval = null;

const STORAGE_KEY = 'cf_contest_tracker_state';

// ========== ФОРМАТИРОВАНИЕ ВРЕМЕНИ ==========
function formatTime(seconds) {
    // Проверяем что seconds это число
    const secs = Number(seconds);
    if (isNaN(secs) || secs < 0) {
        return '00:00:00';
    }
    
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const secsRemainder = secs % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secsRemainder.toString().padStart(2, '0')}`;
}

// ========== ОСНОВНОЙ ТАЙМЕР ==========
function updateTimer() {
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = formatTime(elapsedTime);
    }
}

function startTimer() {
    if (timerInterval) return;
    isRunning = true;
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.textContent = 'Стоп';
    
    timerInterval = setInterval(() => {
        elapsedTime++;
        updateTimer();
        
        if (currentStage && currentProblemLetter) {
            addTimeToCurrentStage();
        }
        
        saveState();
    }, 1000);
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isRunning = false;
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.textContent = 'Возобновить';
    
    saveState();
}

// ========== ДОБАВЛЕНИЕ ВРЕМЕНИ К ЭТАПУ ==========
function addTimeToCurrentStage() {
    if (!currentProblemLetter || !currentStage) return;
    
    // Инициализируем статистику для задачи если её нет
    if (!problemStats[currentProblemLetter]) {
        problemStats[currentProblemLetter] = {
            reading: 0,
            thinking: 0,
            coding: 0,
            debuggingBefore: 0,
            debuggingAfter: 0,
            other: 0
        };
    }
    
    // Проверяем что текущий этап существует
    if (!problemStats[currentProblemLetter][currentStage]) {
        problemStats[currentProblemLetter][currentStage] = 0;
    }
    
    // Добавляем секунду к текущему этапу
    problemStats[currentProblemLetter][currentStage] += 1;
    
    // Обновляем отображение
    updateProblemStatsDisplay();
}

// ========== РЕНДЕР ЗАДАЧ ==========
function renderProblems() {
    const grid = document.getElementById('problemGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (!problems || problems.length === 0) return;
    
    problems.forEach(p => {
        const box = document.createElement('div');
        box.className = 'problem-box';
        if (p.letter === currentProblemLetter) box.classList.add('current-problem');
        box.textContent = p.letter;
        box.onclick = () => {
            currentProblemLetter = p.letter;
            renderProblems();
            
            // Показываем название задачи
            const problemTitle = document.getElementById('problemTitle');
            if (problemTitle) {
                problemTitle.textContent = p.title || `Задача ${p.letter}`;
                problemTitle.classList.remove('hidden');
            }
            
            // Инициализируем статистику если её нет
            if (!problemStats[currentProblemLetter]) {
                problemStats[currentProblemLetter] = {
                    reading: 0,
                    thinking: 0,
                    coding: 0,
                    debuggingBefore: 0,
                    debuggingAfter: 0,
                    other: 0
                };
            }
            
            // Обновляем отображение
            updateProblemStatsDisplay();
            updateCurrentProblemTitle();
            
            saveState();
        };
        grid.appendChild(box);
    });
    
    // Автовыбор первой задачи
    if (!currentProblemLetter && problems.length > 0) {
        const firstProblem = problems[0];
        currentProblemLetter = firstProblem.letter;
        
        if (!problemStats[currentProblemLetter]) {
            problemStats[currentProblemLetter] = {
                reading: 0,
                thinking: 0,
                coding: 0,
                debuggingBefore: 0,
                debuggingAfter: 0,
                other: 0
            };
        }
        
        const problemTitle = document.getElementById('problemTitle');
        if (problemTitle) {
            problemTitle.textContent = firstProblem.title || `Задача ${firstProblem.letter}`;
            problemTitle.classList.remove('hidden');
        }
        
        updateProblemStatsDisplay();
        updateCurrentProblemTitle();
        renderProblems();
    }
}

// ========== ОБНОВЛЕНИЕ СТАТИСТИКИ ==========
function updateProblemStatsDisplay() {
    if (!currentProblemLetter || !problemStats[currentProblemLetter]) return;
    
    const stats = problemStats[currentProblemLetter];
    
    // Маппинг ID элементов на ключи статистики
    const elementMapping = {
        'timeReading': 'reading',
        'timeThinking': 'thinking', 
        'timeCoding': 'coding',
        'timeDebugging': 'debuggingBefore', // 🪲 Отладка до отправки
        'timePenalty': 'debuggingAfter',    // 🐞 Отладка после отправки
        'timeOther': 'other'
    };
    
    for (const [elementId, statKey] of Object.entries(elementMapping)) {
        const element = document.getElementById(elementId);
        if (element) {
            // Безопасное получение значения
            const timeValue = stats[statKey] || 0;
            element.textContent = formatTime(timeValue);
        }
    }
}

function updateCurrentProblemTitle() {
    const element = document.getElementById('currentProblemLetter');
    if (element) {
        element.textContent = currentProblemLetter || '—';
    }
}

// ========== ПЕРЕКЛЮЧЕНИЕ ЭТАПОВ ==========
function switchStage(newStage) {
    if (!currentProblemLetter) {
        alert('Сначала выберите задачу!');
        return;
    }
    
    currentStage = newStage;
    
    // Обновляем кнопки
    const stageButtons = document.querySelectorAll('.stage-btn');
    if (stageButtons) {
        stageButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.stage === newStage) {
                btn.classList.add('active');
            }
        });
    }
    
    console.log('Активный этап:', currentStage, 'для задачи:', currentProblemLetter);
}

// ========== СОХРАНЕНИЕ СОСТОЯНИЯ ==========
function saveState() {
    const contestId = document.getElementById('contestId')?.value?.trim() || '';
    
    const state = {
        contestId,
        problems,
        elapsedTime,
        currentProblemLetter,
        isRunning,
        currentStage,
        problemStats,
        timestamp: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    localStorage.removeItem(STORAGE_KEY);
    
    // Сброс переменных
    elapsedTime = 0;
    problems = [];
    currentProblemLetter = null;
    isRunning = false;
    problemStats = {};
    currentStage = null;
}

// ========== ВОССТАНОВЛЕНИЕ СЕССИИ ==========
async function restoreSession(state) {
    problems = state.problems || [];
    elapsedTime = state.elapsedTime || 0;
    currentProblemLetter = state.currentProblemLetter || null;
    isRunning = state.isRunning || false;
    problemStats = state.problemStats || {};
    currentStage = state.currentStage || null;
    
    // Показываем трекер
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('tracker').classList.remove('hidden');
    
    // Обновляем интерфейс
    updateTimer();
    renderProblems();
    updateProblemStatsDisplay();
    
    if (currentProblemLetter) {
        const p = problems.find(x => x.letter === currentProblemLetter);
        if (p) {
            const problemTitle = document.getElementById('problemTitle');
            if (problemTitle) {
                problemTitle.textContent = p.title;
                problemTitle.classList.remove('hidden');
            }
        }
    }
    
    // Восстанавливаем активный этап
    if (currentStage) {
        const stageButtons = document.querySelectorAll('.stage-btn');
        stageButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.stage === currentStage) {
                btn.classList.add('active');
            }
        });
    }
    
    // Назначаем обработчики
    document.getElementById('pauseBtn').onclick = () => {
        if (isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    };
    
    // Запускаем таймер если нужно
    if (isRunning) {
        startTimer();
    }
}

// ========== ЗАВЕРШЕНИЕ КОНТЕСТА ==========
function finishContest() {
    pauseTimer();
    
    // Скрываем трекер
    document.getElementById('tracker').classList.add('hidden');
    
    // Показываем результаты
    showResults();
}

function showResults() {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) {
        console.error('Элемент results не найден!');
        return;
    }
    
    resultsDiv.innerHTML = '<h3>Результаты контеста</h3>';
    
    // Общее время контеста
    const totalTimeDiv = document.createElement('div');
    totalTimeDiv.className = 'total-time';
    totalTimeDiv.innerHTML = `<h4>Общее время контеста: ${formatTime(elapsedTime)}</h4>`;
    resultsDiv.appendChild(totalTimeDiv);
    
    // Статистика по задачам
    if (problems && problems.length > 0) {
        problems.forEach(problem => {
            const problemDiv = document.createElement('div');
            problemDiv.className = 'problem-result';
            
            const stats = problemStats[problem.letter] || {};
            
            // Безопасный подсчет общего времени задачи
            const totalProblemTime = Object.values(stats).reduce((sum, value) => {
                const numValue = Number(value) || 0;
                return sum + numValue;
            }, 0);
            
            const stageLabels = {
                reading: '📖 Чтение условия',
                thinking: '💡 Обдумывание решения',
                coding: '💻 Написание кода',
                debuggingBefore: '🪲 Отладка до отправки',
                debuggingAfter: '🐞 Отладка',
                other: '📝 Прочее'
            };
            
            let statsHTML = '<div class="problem-stats-list">';
            let hasStats = false;
            
            for (const [stage, time] of Object.entries(stats)) {
                const timeValue = Number(time) || 0;
                if (timeValue > 0) {
                    hasStats = true;
                    const percent = totalProblemTime > 0 
                        ? Math.round((timeValue / totalProblemTime) * 100) 
                        : 0;
                    
                    statsHTML += `
                        <div class="stat-row">
                            <span>${stageLabels[stage] || stage}</span>
                            <span>${formatTime(timeValue)} (${percent}%)</span>
                        </div>
                    `;
                }
            }
            
            if (!hasStats) {
                statsHTML += '<div class="stat-row">Нет данных по этапам</div>';
            }
            
            statsHTML += '</div>';
            
            problemDiv.innerHTML = `
                <div class="problem-header">Задача ${problem.letter}: ${problem.title || ''}</div>
                <div class="problem-total">Всего времени: ${formatTime(totalProblemTime)}</div>
                ${statsHTML}
            `;
            
            resultsDiv.appendChild(problemDiv);
        });
    } else {
        const noProblems = document.createElement('div');
        noProblems.className = 'no-problems';
        noProblems.textContent = 'Нет данных о задачах';
        resultsDiv.appendChild(noProblems);
    }
    
    // Кнопки действий
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'result-actions';
    actionsDiv.innerHTML = `
        <button id="exportCSVBtn" class="export-btn">📄 Экспорт в CSV</button>
        <button id="exitBtn" class="exit-btn">Выйти</button>
    `;
    
    resultsDiv.appendChild(actionsDiv);
    
    // Обработчики кнопок
    setTimeout(() => {
        const exportBtn = document.getElementById('exportCSVBtn');
        const exitBtn = document.getElementById('exitBtn');
        
        if (exportBtn) {
            exportBtn.onclick = exportData;
        }
        if (exitBtn) {
            exitBtn.onclick = exitToDashboard;
        }
    }, 100);
    
    // Показываем результаты
    resultsDiv.classList.remove('hidden');
}

// ========== ЭКСПОРТ В CSV ==========
function exportToCSV() {
    try {
        if (!problems || problems.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        const contestId = document.getElementById('contestId')?.value?.trim() || 'unknown';
        const date = new Date().toISOString().split('T')[0];
        
        // Заголовки
        let csv = 'Задача,Название,Чтение условия (сек),Обдумывание решения (сек),Написание кода (сек),Отладка до отправки (сек),Отладка после отправки (сек),Прочее (сек),Всего (сек)\n';
        
        // Данные по задачам
        problems.forEach(problem => {
            const stats = problemStats[problem.letter] || {};
            const total = Object.values(stats).reduce((a, b) => a + b, 0);
            
            const row = [
                `"${problem.letter}"`,
                `"${(problem.title || '').replace(/"/g, '""')}"`,
                stats.reading || 0,
                stats.thinking || 0,
                stats.coding || 0,
                stats.debuggingBefore || 0,
                stats.debuggingAfter || 0,
                stats.other || 0,
                total
            ].join(',');
            
            csv += row + '\n';
        });
        
        // Итог
        csv += `\n"ИТОГО","",,,,,,,${elapsedTime}\n`;
        
        // Создаем и скачиваем файл
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `codeforces_${contestId}_${date}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('CSV экспортирован');
        
    } catch (error) {
        console.error('Ошибка экспорта CSV:', error);
        alert('Ошибка при экспорте CSV');
    }
}

function exportData() {
    let format = 'csv'
    try {
        if (!problems || problems.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        const contestId = document.getElementById('contestId')?.value?.trim() || 'unknown';
        const date = new Date().toISOString().split('T')[0];
        
        const headers = [
            'Задача',
            'Название',
            'Чтение условия (сек)',
            'Обдумывание решения (сек)',
            'Написание кода (сек)',
            'Отладка до отправки (сек)',
            'Отладка после отправки (сек)',
            'Прочее (сек)',
            'Всего (сек)'
        ];
        
        let content = '';
        let mimeType = '';
        let fileExt = '';
        let delimiter = '';
        
        if (format === 'csv') {
            // CSV с BOM для Excel
            content = '\uFEFF';
            delimiter = ';';
            mimeType = 'text/csv;charset=utf-8;';
            fileExt = 'csv';
        } else if (format === 'tsv') {
            // TSV (лучше открывается)
            delimiter = '\t';
            mimeType = 'text/tab-separated-values;charset=utf-8;';
            fileExt = 'tsv';
        }
        
        content += headers.join(delimiter) + '\r\n';
        
        problems.forEach(problem => {
            const stats = problemStats[problem.letter] || {};
            const total = Object.values(stats).reduce((a, b) => a + b, 0);
            
            const row = format === 'csv' 
                ? [
                    `"${problem.letter}"`,
                    `"${(problem.title || '').replace(/"/g, '""')}"`,
                    stats.reading || 0,
                    stats.thinking || 0,
                    stats.coding || 0,
                    stats.debuggingBefore || 0,
                    stats.debuggingAfter || 0,
                    stats.other || 0,
                    total
                ]
                : [
                    problem.letter,
                    problem.title || '',
                    stats.reading || 0,
                    stats.thinking || 0,
                    stats.coding || 0,
                    stats.debuggingBefore || 0,
                    stats.debuggingAfter || 0,
                    stats.other || 0,
                    total
                ];
            
            content += row.join(delimiter) + '\r\n';
        });
        
        content += `\r\nИТОГО${delimiter.repeat(8)}${elapsedTime}`;
        
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `codeforces_${contestId}_${date}.${fileExt}`;
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 100);
        
        console.log(`${format.toUpperCase()} экспортирован`);
        
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        alert(`Ошибка экспорта: ${error.message}`);
    }
}

// ========== ВЫХОД ==========
function exitToDashboard() {
    clearState();
    
    const handle = localStorage.getItem('cf_handle');
    if (handle) {
        window.location.href = `dashboard.html?handle=${encodeURIComponent(handle)}`;
    } else {
        window.location.href = 'index.html';
    }
}

function exitWithoutSave() {
    if (confirm('Выйти без сохранения? Все данные будут потеряны.')) {
        clearState();
        exitToDashboard();
    }
}

// ========== ЗАГРУЗКА ЗАДАЧ ==========
async function fetchProblems(contestId) {
    try {
        const response = await fetch(
            `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`,
            { timeout: 10000 }
        );
        
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        
        const data = await response.json();
        if (data.status !== 'OK') throw new Error(data.comment || 'Ошибка API');
        
        if (!data.result?.problems?.length) {
            throw new Error('Не найдены задачи для этого контеста');
        }
        
        return data.result.problems.map(p => ({
            letter: p.index,
            title: p.name,
            rating: p.rating || 0
        }));
        
    } catch (error) {
        throw new Error(`Не удалось загрузить задачи: ${error.message}`);
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Contest tracker инициализирован');
    
    // Проверяем сохраненную сессию
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            const hoursSinceSave = (Date.now() - state.timestamp) / (1000 * 60 * 60);
            
            if (hoursSinceSave < 24 && state.contestId && state.problems) {
                await restoreSession(state);
                return;
            }
        } catch (e) {
            console.error('Ошибка восстановления:', e);
        }
        localStorage.removeItem(STORAGE_KEY);
    }
    
    // Переключатели типа и режима
    document.querySelectorAll('.type-btn, .mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentElement.querySelectorAll('.active').forEach(el => {
                el.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Кнопки этапов
    document.querySelectorAll('.stage-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchStage(this.dataset.stage);
        });
    });
    
    // Кнопка старта
    document.getElementById('startBtn').addEventListener('click', async () => {
        const contestId = document.getElementById('contestId').value.trim();
        if (!contestId) {
            alert('Введите ID контеста');
            return;
        }
        
        const btn = document.getElementById('startBtn');
        btn.disabled = true;
        btn.textContent = 'Загрузка...';
        
        try {
            problems = await fetchProblems(contestId);
            
            // Сброс состояния
            elapsedTime = 0;
            currentProblemLetter = null;
            isRunning = false;
            problemStats = {};
            currentStage = null;
            
            // Показываем трекер
            document.getElementById('setup').classList.add('hidden');
            document.getElementById('tracker').classList.remove('hidden');
            
            // Обновляем интерфейс
            updateTimer();
            renderProblems();
            
            // Назначаем обработчики
            document.getElementById('pauseBtn').onclick = () => {
                if (isRunning) {
                    pauseTimer();
                } else {
                    startTimer();
                }
            };
            
            document.getElementById('finishBtn').onclick = finishContest;
            
            // Начинаем отсчет
            startTimer();
            
            console.log('Контест начат');
            
        } catch (error) {
            alert('Ошибка: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Старт';
        }
    });
    
    document.getElementById('contestId')?.focus();
});