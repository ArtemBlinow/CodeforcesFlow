document.addEventListener('DOMContentLoaded', async function() {
    console.log('history.js загружен');
    
    const urlParams = new URLSearchParams(window.location.search);
    const handle = urlParams.get('handle');
    
    if (!handle) {
        showError('Хендл не указан');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&count=1000`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.status !== 'OK') throw new Error(data.comment || 'API ошибка');
        
        console.log('Всего посылок:', data.result.length);
        
        const stats = calculateRealStats(data.result);
        displayStats(stats);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError(`Ошибка: ${error.message}`);
    }
});

function calculateRealStats(submissions) {
    const last10Days = [];
    for (let i = 9; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last10Days.push({
            date: date,
            key: date.toISOString().split('T')[0], // YYYY-MM-DD
            solved: 0,
            problemSet: new Set()
        });
    }
    
    submissions.forEach(submission => {
        if (submission.verdict !== 'OK') return;
        
        const subDate = new Date(submission.creationTimeSeconds * 1000);
        const subDateKey = subDate.toISOString().split('T')[0];
        
        const day = last10Days.find(d => d.key === subDateKey);
        if (day) {
            const problemId = `${submission.problem.contestId}-${submission.problem.index}`;
            
            if (!day.problemSet.has(problemId)) {
                day.problemSet.add(problemId);
                day.solved = day.problemSet.size;
            }
        }
    });
    
    const solvedCounts = last10Days.map(day => day.solved);
    const totalLast10 = solvedCounts.reduce((a, b) => a + b, 0);
    const bestDayCount = Math.max(...solvedCounts);
    
    let daysWithSolutions = 0;
    for ( i = 9; i >= 0; i--) {
        console.log(last10Days[i].solved);
        if (last10Days[i].solved > 0) {
            daysWithSolutions++;
        }
    }
    
    const avgPerDay = daysWithSolutions ? (totalLast10 / daysWithSolutions).toFixed(1) : 0;
    
    return {
        days: last10Days,
        totalLast10: totalLast10,
        avgPerDay: avgPerDay,
        bestDayCount: bestDayCount,
        daysWithSolutions: daysWithSolutions,
        solvedCounts: solvedCounts
    };
}

function displayStats(stats) {
    console.log('Статистика:', stats);
    
    document.getElementById('total-last-10').textContent = stats.totalLast10;
    document.getElementById('avg-per-day').textContent = stats.avgPerDay;
    document.getElementById('best-day-count').textContent = stats.bestDayCount;
    document.getElementById('current-streak').textContent = stats.daysWithSolutions;
    
    createActivityChart(stats.days, stats.solvedCounts);
}

function createActivityChart(days, solvedCounts) {
    const barsContainer = document.getElementById('activity-bars');
    barsContainer.innerHTML = '';
    
    const maxSolved = Math.max(...solvedCounts, 1);
    
    days.forEach((dayObj, index) => {
        const solved = dayObj.solved;
        
        const heightPercent = Math.max((solved / maxSolved) * 90, 5);
        
        const date = dayObj.date;
        const dayNumber = date.getDate();
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        const monthName = monthNames[date.getMonth()];
        
        const barHTML = `
            <div class="bar-day">
                <div class="bar-value">${solved}</div>
                <div class="bar" style="height: ${heightPercent}%"></div>
                <div class="bar-label">${dayNumber} <br>${monthName}</div>
            </div>
        `;
        
        barsContainer.innerHTML += barHTML;
    });
}

function showLoading() {
    const barsContainer = document.getElementById('activity-bars');
    if (barsContainer) {
        barsContainer.innerHTML = '<div class="loading-bars">Загрузка с Codeforces...</div>';
    }
}

function showError(message) {
    const barsContainer = document.getElementById('activity-bars');
    if (barsContainer) {
        barsContainer.innerHTML = `<div class="loading-bars" style="color:#f44336;">${message}</div>`;
    }
    
    document.getElementById('total-last-10').textContent = '0';
    document.getElementById('avg-per-day').textContent = '0.0';
    document.getElementById('best-day-count').textContent = '0';
    document.getElementById('current-streak').textContent = '0';
}