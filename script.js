// script.js
let state = {
    profile: {
        weight: 160,
        activity: 'moderate'
    },
    foods: [],
    days: {},
    flexPoints: {
        weekStart: null,
        used: 0
    }
};

const DEFAULT_FOODS = [
    { id: 1, name: "Eggs (2 large)", cal: 140, fat: 10, fiber: 0 },
    { id: 2, name: "Banana (medium)", cal: 105, fat: 0.4, fiber: 3.1 },
    { id: 3, name: "Sourdough Bread (1 slice)", cal: 120, fat: 1, fiber: 1 },
    { id: 4, name: "Zucchini (1 cup)", cal: 20, fat: 0, fiber: 1.2 },
    { id: 5, name: "Popcorn (3 cups, air-popped)", cal: 90, fat: 1, fiber: 3.5 },
    { id: 6, name: "Cheese Pizza (1 slice)", cal: 285, fat: 12, fiber: 2 },
    { id: 7, name: "Oatmeal (1 cup cooked)", cal: 150, fat: 3, fiber: 4 },
    { id: 8, name: "Milk (1 cup, 2%)", cal: 120, fat: 5, fiber: 0 }
];

function calculatePoints(cal, fat, fiber) {
    let points = (cal / 50) * 0.8 + (fat / 12) - (fiber / 5);
    points = Math.round(points);
    return Math.max(0, points);
}

function getToday() {
    const now = new Date();
    const options = { timeZone: 'America/New_York' };
    const nyDate = new Date(now.toLocaleString('en-US', options));
    const year = nyDate.getFullYear();
    const month = String(nyDate.getMonth() + 1).padStart(2, '0');
    const day = String(nyDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMondayOfWeek(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday
    const diff = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    date.setDate(date.getDate() + diff);
    return date.toISOString().split('T')[0];
}

function calculateDailyTarget() {
    const { weight, activity } = state.profile;
    let modifier = 0;
    if (activity === 'moderate') modifier = 2;
    if (activity === 'active') modifier = 4;
    return Math.round((weight / 10) + 6 + modifier);
}

function updateFlexWeek() {
    const today = getToday();
    const monday = getMondayOfWeek(today);
    
    if (!state.flexPoints.weekStart || state.flexPoints.weekStart !== monday) {
        state.flexPoints.weekStart = monday;
        state.flexPoints.used = 0;
    }
}

function getFlexRemaining() {
    return Math.max(0, 35 - (state.flexPoints.used || 0));
}

function getSunday() {
    if (!state.flexPoints.weekStart) return '';
    const mon = new Date(state.flexPoints.weekStart);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return sun.toISOString().split('T')[0];
}

function saveState() {
    localStorage.setItem('ww_tracker_state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('ww_tracker_state');
    if (saved) {
        state = JSON.parse(saved);
        // Ensure flexPoints exists
        if (!state.flexPoints) {
            state.flexPoints = { weekStart: null, used: 0 };
        }
    } else {
        state.foods = [...DEFAULT_FOODS];
        const today = getToday();
        state.days[today] = { date: today, entries: [] };
        state.flexPoints = { weekStart: null, used: 0 };
    }
    
    const today = getToday();
    if (!state.days[today]) {
        state.days[today] = { date: today, entries: [] };
    }
    
    updateFlexWeek();
}

function renderToday() {
    const todayDate = getToday();
    const dayData = state.days[todayDate] || { entries: [] };
    
    const totalPoints = dayData.entries.reduce((sum, entry) => {
        return sum + (entry.points * (entry.qty || 1));
    }, 0);
    
    const target = calculateDailyTarget();
    
    const percentage = Math.min((totalPoints / target) * 100, 100);
    const circumference = 2 * Math.PI * 82;
    const offset = circumference - (percentage / 100) * circumference;
    
    const progressCircle = document.getElementById('progress-circle');
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = offset;
    
    document.getElementById('points-today').textContent = totalPoints;
    document.getElementById('target-small').textContent = `/ ${target}`;
    document.getElementById('target-display').textContent = `Target: ${target}`;
    
    updateFlexWeek();
    document.getElementById('flex-remaining').textContent = getFlexRemaining();
    document.getElementById('week-range').textContent = `${state.flexPoints.weekStart} — ${getSunday()}`;
    
    const container = document.getElementById('today-entries');
    container.innerHTML = '';
    
    if (dayData.entries.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px 20px; color:#999;">No entries yet today.<br>Add some food!</div>`;
        return;
    }
    
    dayData.entries.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'entry-card';
        div.innerHTML = `
            <div class="entry-info">
                <div class="entry-name">${entry.name}</div>
                <div class="entry-points">${entry.points} pts × ${entry.qty || 1}</div>
            </div>
            <div class="entry-qty">
                <button class="qty-btn minus" data-index="${index}">-</button>
                <span>${entry.qty || 1}</span>
                <button class="qty-btn plus" data-index="${index}">+</button>
            </div>
        `;
        container.appendChild(div);
    });
    
    document.querySelectorAll('#today-entries .minus').forEach(btn => {
        btn.addEventListener('click', () => adjustTodayQty(parseInt(btn.dataset.index), -1));
    });
    
    document.querySelectorAll('#today-entries .plus').forEach(btn => {
        btn.addEventListener('click', () => adjustTodayQty(parseInt(btn.dataset.index), 1));
    });
}

function adjustTodayQty(index, change) {
    const todayDate = getToday();
    const dayData = state.days[todayDate];
    if (!dayData || !dayData.entries[index]) return;
    
    const entry = dayData.entries[index];
    entry.qty = Math.max(1, (entry.qty || 1) + change);
    saveState();
    renderToday();
}

function renderLibrary() {
    const container = document.getElementById('food-library');
    container.innerHTML = '';
    const searchTerm = document.getElementById('library-search').value.toLowerCase();
    
    state.foods.forEach(food => {
        if (searchTerm && !food.name.toLowerCase().includes(searchTerm)) return;
        const points = calculatePoints(food.cal, food.fat, food.fiber);
        
        const div = document.createElement('div');
        div.className = 'food-item';
        div.innerHTML = `
            <h4>${food.name}</h4>
            <div class="points">${points}</div>
            <div class="meta">${food.cal} cal • ${food.fat}f • ${food.fiber}fib</div>
        `;
        div.addEventListener('click', () => editFood(food.id));
        container.appendChild(div);
    });
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    
    const dates = Object.keys(state.days).sort().reverse();
    
    dates.forEach(date => {
        const dayData = state.days[date];
        const total = dayData.entries.reduce((sum, e) => sum + (e.points * (e.qty || 1)), 0);
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'history-day';
        dayDiv.innerHTML = `
            <div class="history-header" data-date="${date}">
                <div class="history-date">${date}</div>
                <div class="history-total">${total} pts</div>
            </div>
            <div class="history-entries" id="entries-${date}"></div>
        `;
        container.appendChild(dayDiv);
        
        dayDiv.querySelector('.history-header').addEventListener('click', () => toggleHistoryDay(date));
    });
}

function toggleHistoryDay(date) {
    document.querySelectorAll('.history-entries').forEach(el => el.classList.remove('active'));
    const container = document.getElementById(`entries-${date}`);
    if (container) {
        container.classList.add('active');
        renderHistoryEntries(date, container);
    }
}

function renderHistoryEntries(date, container) {
    container.innerHTML = '';
    const dayData = state.days[date];
    
    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn-small';
    addBtn.textContent = '+ Add Food';
    addBtn.style.marginBottom = '16px';
    addBtn.addEventListener('click', () => openAddToDayModal(date));
    container.appendChild(addBtn);
    
    dayData.entries.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'entry-card';
        div.innerHTML = `
            <div class="entry-info">
                <div class="entry-name">${entry.name}</div>
                <div class="entry-points">${entry.points} pts × ${entry.qty || 1}</div>
            </div>
            <div class="entry-qty">
                <button class="qty-btn minus" data-index="${index}" data-date="${date}">-</button>
                <span>${entry.qty || 1}</span>
                <button class="qty-btn plus" data-index="${index}" data-date="${date}">+</button>
            </div>
        `;
        container.appendChild(div);
    });
    
    container.querySelectorAll('.minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopImmediatePropagation();
            adjustHistoryQty(btn.dataset.date, parseInt(btn.dataset.index), -1);
        });
    });
    
    container.querySelectorAll('.plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopImmediatePropagation();
            adjustHistoryQty(btn.dataset.date, parseInt(btn.dataset.index), 1);
        });
    });
}

function adjustHistoryQty(date, index, change) {
    const dayData = state.days[date];
    if (!dayData || !dayData.entries[index]) return;
    const entry = dayData.entries[index];
    entry.qty = Math.max(1, (entry.qty || 1) + change);
    saveState();
    const container = document.getElementById(`entries-${date}`);
    if (container) renderHistoryEntries(date, container);
}

let currentEditingFoodId = null;

function openFoodModal(food = null) {
    const modal = document.getElementById('food-modal');
    document.getElementById('modal-title').textContent = food ? 'Edit Food' : 'Add New Food';
    
    if (food) {
        currentEditingFoodId = food.id;
        document.getElementById('food-name').value = food.name;
        document.getElementById('food-cal').value = food.cal;
        document.getElementById('food-fat').value = food.fat;
        document.getElementById('food-fiber').value = food.fiber;
    } else {
        currentEditingFoodId = null;
        document.getElementById('food-name').value = '';
        document.getElementById('food-cal').value = 100;
        document.getElementById('food-fat').value = 0;
        document.getElementById('food-fiber').value = 0;
    }
    updateModalPoints();
    modal.style.display = 'flex';
}

function updateModalPoints() {
    const cal = parseFloat(document.getElementById('food-cal').value) || 0;
    const fat = parseFloat(document.getElementById('food-fat').value) || 0;
    const fiber = parseFloat(document.getElementById('food-fiber').value) || 0;
    document.getElementById('modal-points').textContent = calculatePoints(cal, fat, fiber);
}

function editFood(id) {
    const food = state.foods.find(f => f.id === id);
    if (food) openFoodModal(food);
}

function saveFood() {
    const name = document.getElementById('food-name').value.trim();
    if (!name) return;
    
    const cal = parseFloat(document.getElementById('food-cal').value) || 0;
    const fat = parseFloat(document.getElementById('food-fat').value) || 0;
    const fiber = parseFloat(document.getElementById('food-fiber').value) || 0;
    
    if (currentEditingFoodId !== null) {
        const food = state.foods.find(f => f.id === currentEditingFoodId);
        if (food) {
            food.name = name;
            food.cal = cal;
            food.fat = fat;
            food.fiber = fiber;
        }
    } else {
        const maxId = state.foods.length ? Math.max(...state.foods.map(f => f.id)) : 0;
        state.foods.push({ id: maxId + 1, name, cal, fat, fiber });
    }
    
    saveState();
    closeModals();
    renderLibrary();
    showToast('Food saved!');
}

function openProfileModal() {
    document.getElementById('profile-weight').value = state.profile.weight;
    document.getElementById('profile-activity').value = state.profile.activity;
    updateCalculatedTarget();
    document.getElementById('profile-modal').style.display = 'flex';
}

function updateCalculatedTarget() {
    const weight = parseFloat(document.getElementById('profile-weight').value) || 160;
    const activity = document.getElementById('profile-activity').value;
    let modifier = 0;
    if (activity === 'moderate') modifier = 2;
    if (activity === 'active') modifier = 4;
    const target = Math.round((weight / 10) + 6 + modifier);
    document.getElementById('calculated-target').textContent = target;
}

function saveProfile() {
    state.profile.weight = parseFloat(document.getElementById('profile-weight').value) || 160;
    state.profile.activity = document.getElementById('profile-activity').value;
    saveState();
    closeModals();
    renderToday();
    showToast('Settings saved!');
}

function closeModals() {
    document.getElementById('food-modal').style.display = 'none';
    document.getElementById('add-to-day-modal').style.display = 'none';
    document.getElementById('profile-modal').style.display = 'none';
}

function openAddToDayModal(date) {
    closeModals();
    const modal = document.getElementById('add-to-day-modal');
    document.getElementById('modal-day-date').textContent = date;
    
    const listContainer = document.getElementById('modal-food-list');
    const searchInput = document.getElementById('add-search');
    
    const renderList = () => {
        listContainer.innerHTML = '';
        const term = searchInput.value.toLowerCase();
        state.foods.forEach(food => {
            if (term && !food.name.toLowerCase().includes(term)) return;
            const points = calculatePoints(food.cal, food.fat, food.fiber);
            const item = document.createElement('div');
            item.className = 'food-item';
            item.style.marginBottom = '10px';
            item.innerHTML = `<h4>${food.name}</h4><div class="points">${points} pts</div>`;
            item.addEventListener('click', () => {
                addFoodToDay(date, food);
                closeModals();
            });
            listContainer.appendChild(item);
        });
    };
    
    searchInput.oninput = renderList;
    renderList();
    modal.style.display = 'flex';
}

function addFoodToDay(date, food) {
    if (!state.days[date]) state.days[date] = { date, entries: [] };
    
    const points = calculatePoints(food.cal, food.fat, food.fiber);
    state.days[date].entries.push({
        name: food.name,
        cal: food.cal,
        fat: food.fat,
        fiber: food.fiber,
        points: points,
        qty: 1
    });
    
    saveState();
    
    if (date === getToday()) {
        renderToday();
    } else {
        const container = document.getElementById(`entries-${date}`);
        if (container && container.classList.contains('active')) {
            renderHistoryEntries(date, container);
        }
    }
    showToast('Added to day!');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

function setupListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
            if (btn.dataset.tab === 'library') renderLibrary();
            if (btn.dataset.tab === 'history') renderHistory();
        });
    });
    
    document.getElementById('add-food-today').addEventListener('click', () => openAddToDayModal(getToday()));
    document.getElementById('add-new-food').addEventListener('click', () => openFoodModal());
    document.getElementById('target-display').addEventListener('click', openProfileModal);
    
    document.getElementById('profile-cancel').addEventListener('click', closeModals);
    document.getElementById('profile-save').addEventListener('click', saveProfile);
    document.getElementById('profile-weight').addEventListener('input', updateCalculatedTarget);
    document.getElementById('profile-activity').addEventListener('change', updateCalculatedTarget);
    
    document.getElementById('modal-cancel').addEventListener('click', closeModals);
    document.getElementById('modal-save').addEventListener('click', saveFood);
    document.getElementById('close-add-modal').addEventListener('click', closeModals);
    
    ['food-cal', 'food-fat', 'food-fiber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateModalPoints);
    });
    
    document.getElementById('library-search').addEventListener('input', renderLibrary);
    
    document.addEventListener('keydown', e => {
        if (e.key === "Escape") closeModals();
    });
}

function init() {
    loadState();
    setupListeners();
    renderToday();
    renderLibrary();
    renderHistory();
    
    window.addEventListener('beforeunload', saveState);
    setInterval(saveState, 30000);
    
    console.log('%cWW Journey ready!', 'color:#4a7043; font-weight:bold');
}

init();
