// script.js - Every day saved (even 0 points)
let state = {
    foodLibrary: [],
    currentWeek: { startDate: '', weeklyFlex: 35, days: [] },
    today: { date: '', entries: [] },
    userSettings: { weight: 160, activityLevel: 'moderate' }
};

const STORAGE_KEY = 'ww_tracker_state';

function calculatePoints(calories, fat, fiber) {
    const fiberCapped = Math.min(fiber || 0, 4);
    let points = (calories / 50) * 0.8 + (fat / 12) - (fiberCapped / 5);
    points = Math.round(points);
    return Math.max(0, points);
}

function getDailyTarget() {
    const { weight, activityLevel } = state.userSettings;
    let modifier = 0;
    if (activityLevel === 'moderate') modifier = 2;
    else if (activityLevel === 'active') modifier = 4;
    return Math.round((weight / 10) + 6 + modifier);
}

function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
        const todayStr = getTodayDateStr();
        if (state.today.date !== todayStr) {
            autoSaveCurrentDay(); // Always save the day when date changes
            state.today = { date: todayStr, entries: [] };
        }
    } else {
        state.foodLibrary = [
            { id: 1001, name: "Eggs (large, 1 egg)", calories: 70, fat: 5, fiber: 0, points: calculatePoints(70, 5, 0) },
            { id: 1002, name: "Banana (1 medium)", calories: 105, fat: 0, fiber: 3, points: calculatePoints(105, 0, 3) },
            { id: 1003, name: "Sourdough bread (50g slice)", calories: 130, fat: 1, fiber: 1, points: calculatePoints(130, 1, 1) },
            { id: 1004, name: "Zucchini (1 cup raw)", calories: 20, fat: 0, fiber: 2, points: calculatePoints(20, 0, 2) },
            { id: 1005, name: "Popcorn (air-popped, 3 cups)", calories: 90, fat: 1, fiber: 3, points: calculatePoints(90, 1, 3) },
            { id: 1006, name: "Pizza (1 slice cheese)", calories: 250, fat: 10, fiber: 1, points: calculatePoints(250, 10, 1) },
            { id: 1007, name: "Oatmeal (1/2 cup dry)", calories: 150, fat: 3, fiber: 4, points: calculatePoints(150, 3, 4) }
        ];
        resetWeek();
        state.today.date = getTodayDateStr();
    }
}

function resetWeek() {
    state.currentWeek = {
        startDate: getTodayDateStr(),
        weeklyFlex: 35,
        days: []
    };
}

function autoSaveCurrentDay() {
    const total = state.today.entries.reduce((sum, entry) => sum + (entry.totalPoints || 0), 0);
    const dayRecord = {
        date: state.today.date,
        entries: JSON.parse(JSON.stringify(state.today.entries || [])),
        totalPoints: total
    };
    const existingIndex = state.currentWeek.days.findIndex(d => d.date === state.today.date);
    if (existingIndex > -1) {
        state.currentWeek.days[existingIndex] = dayRecord;
    } else {
        state.currentWeek.days.push(dayRecord);
    }
    saveState();
}

function calculateTodayTotal() {
    return state.today.entries.reduce((sum, entry) => sum + (entry.totalPoints || 0), 0);
}

function renderToday() {
    const target = getDailyTarget();
    const total = calculateTodayTotal();
    const percent = Math.min(Math.round((total / target) * 100), 100);
    
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    document.getElementById('today-points').textContent = total;
    document.getElementById('target-small').textContent = target;
    document.getElementById('daily-target').textContent = target;
    
    const circumference = 301.59;
    const offset = circumference - (circumference * percent / 100);
    document.getElementById('progress-ring').setAttribute('stroke-dashoffset', offset);
    
    const container = document.getElementById('today-entries');
    container.innerHTML = '';
    if (state.today.entries.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No foods logged yet</h3><p>Tap "+ Add Food"</p></div>`;
        return;
    }
    state.today.entries.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'entry-item';
        div.innerHTML = `
            <div class="entry-info">
                <div class="entry-name">${entry.name}</div>
                <div class="entry-points">${entry.points} pts × ${entry.quantity} = ${entry.totalPoints} pts</div>
            </div>
            <div class="quantity-controls">
                <button onclick="changeQuantity(${index}, -1)">−</button>
                <span style="min-width:20px;text-align:center;font-weight:600;">${entry.quantity}</span>
                <button onclick="changeQuantity(${index}, 1)">+</button>
            </div>
        `;
        container.appendChild(div);
    });
    updateFlexDisplay();
}

function updateFlexDisplay() {
    const target = getDailyTarget();
    let totalFlexUsed = 0;
    state.currentWeek.days.forEach(day => {
        totalFlexUsed += Math.max(0, day.totalPoints - target);
    });
    const remaining = Math.max(0, state.currentWeek.weeklyFlex - totalFlexUsed);
    document.getElementById('flex-remaining').textContent = remaining;
}

function switchTab(tabIndex) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    if (tabIndex === 0) {
        document.getElementById('page-today').classList.add('active');
        document.getElementById('tab-today').classList.add('active');
        document.getElementById('nav-today').classList.add('active');
        renderToday();
    } else if (tabIndex === 1) {
        document.getElementById('page-library').classList.add('active');
        document.getElementById('tab-library').classList.add('active');
        document.getElementById('nav-library').classList.add('active');
        renderLibrary();
    } else if (tabIndex === 2) {
        document.getElementById('page-history').classList.add('active');
        document.getElementById('tab-history').classList.add('active');
        document.getElementById('nav-history').classList.add('active');
        renderHistory();
    }
    updateFlexDisplay();
}

function renderLibrary(filteredFoods = null) {
    const container = document.getElementById('library-list');
    container.innerHTML = '';
    const foods = filteredFoods || state.foodLibrary;
    if (foods.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No foods found</h3></div>`;
        return;
    }
    foods.forEach(food => {
        const div = document.createElement('div');
        div.className = 'food-row';
        div.innerHTML = `
            <div class="food-info">
                <div class="food-name">${food.name}</div>
                <div class="food-meta">${food.calories} cal • ${food.points} pts</div>
            </div>
            <div class="food-actions">
                <button onclick="editFood(${food.id})" class="edit-btn">✏️</button>
                <button onclick="deleteFood(${food.id})" class="delete-btn">🗑</button>
                <button onclick="quickAddToToday(${food.id})" class="add-to-today">＋</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function filterLibrary() {
    const query = document.getElementById('library-search').value.toLowerCase().trim();
    if (!query) {
        renderLibrary();
        return;
    }
    const filtered = state.foodLibrary.filter(food => food.name.toLowerCase().includes(query));
    renderLibrary(filtered);
}

function renderModalLibrary(filtered = null) {
    const container = document.getElementById('modal-library-list');
    container.innerHTML = '';
    const foods = filtered || state.foodLibrary;
    foods.forEach(food => {
        const div = document.createElement('div');
        div.className = 'food-row';
        div.innerHTML = `
            <div class="food-info">
                <div class="food-name">${food.name}</div>
                <div class="food-meta">${food.calories} cal • ${food.points} pts</div>
            </div>
            <button onclick="addFoodToTodayFromModal(${food.id}); hideAddFoodModal()" class="add-to-today">＋</button>
        `;
        container.appendChild(div);
    });
}

function modalSearch() {
    const query = document.getElementById('modal-search').value.toLowerCase().trim();
    const filtered = query ? state.foodLibrary.filter(f => f.name.toLowerCase().includes(query)) : null;
    renderModalLibrary(filtered);
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    const days = [...state.currentWeek.days].reverse();
    if (days.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No previous days</h3></div>`;
        return;
    }
    days.forEach((day, idx) => {
        const actualIdx = state.currentWeek.days.length - 1 - idx;
        const div = document.createElement('div');
        div.className = 'history-day';
        div.innerHTML = `
            <div class="history-day-header" onclick="toggleHistoryDay(this, ${actualIdx})">
                <div>
                    <div class="history-date">${new Date(day.date).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})}</div>
                    <div class="history-points">${day.totalPoints} points</div>
                </div>
                <span>▼</span>
            </div>
            <div class="history-day-content" id="history-content-${actualIdx}"></div>
        `;
        container.appendChild(div);
    });
}

function toggleHistoryDay(header, dayIndex) {
    const content = header.nextElementSibling;
    const isOpen = content.classList.toggle('active');
    header.querySelector('span').textContent = isOpen ? '▲' : '▼';
    
    if (isOpen) {
        const day = state.currentWeek.days[dayIndex];
        content.innerHTML = '';
        day.entries.forEach((entry, entryIdx) => {
            const row = document.createElement('div');
            row.className = 'history-entry';
            row.innerHTML = `
                <div>${entry.name} × <span id="qty-${dayIndex}-${entryIdx}">${entry.quantity || 1}</span></div>
                <div>
                    <button onclick="historyChangeQty(${dayIndex}, ${entryIdx}, -1)" style="width:28px;height:28px;">−</button>
                    <button onclick="historyChangeQty(${dayIndex}, ${entryIdx}, 1)" style="width:28px;height:28px;">+</button>
                </div>
            `;
            content.appendChild(row);
        });
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Food';
        addBtn.style.marginTop = '12px';
        addBtn.style.width = '100%';
        addBtn.style.padding = '12px';
        addBtn.style.background = '#4a7043';
        addBtn.style.color = 'white';
        addBtn.style.border = 'none';
        addBtn.style.borderRadius = '12px';
        addBtn.onclick = () => showAddFoodToHistoryModal(dayIndex);
        content.appendChild(addBtn);
    }
}

function historyChangeQty(dayIndex, entryIdx, delta) {
    const day = state.currentWeek.days[dayIndex];
    const entry = day.entries[entryIdx];
    entry.quantity = (entry.quantity || 1) + delta;
    if (entry.quantity < 1) day.entries.splice(entryIdx, 1);
    else entry.totalPoints = entry.points * entry.quantity;
    day.totalPoints = day.entries.reduce((sum, e) => sum + (e.totalPoints || 0), 0);
    saveState();
    const qtySpan = document.getElementById(`qty-${dayIndex}-${entryIdx}`);
    if (qtySpan) qtySpan.textContent = entry.quantity || 1;
}

function showAddFoodToHistoryModal(dayIndex) {
    const original = window.addFoodToTodayFromModal;
    window.addFoodToTodayFromModal = (foodId) => {
        const food = state.foodLibrary.find(f => f.id === foodId);
        if (food) {
            const day = state.currentWeek.days[dayIndex];
            const entry = {
                foodId: food.id,
                name: food.name,
                points: food.points,
                quantity: 1,
                totalPoints: food.points
            };
            day.entries.unshift(entry);
            day.totalPoints = day.entries.reduce((sum, e) => sum + (e.totalPoints || 0), 0);
            saveState();
            renderHistory();
            hideAddFoodModal();
        }
    };
    showAddFoodModal();
    setTimeout(() => {
        window.addFoodToTodayFromModal = original;
    }, 1000);
}

function quickAddToToday(foodId) {
    const food = state.foodLibrary.find(f => f.id === foodId);
    if (food) addFoodToToday(food);
}

function addFoodToToday(food) {
    const entry = {
        foodId: food.id,
        name: food.name,
        points: food.points,
        quantity: 1,
        totalPoints: food.points
    };
    state.today.entries.unshift(entry);
    saveState();
    renderToday();
}

function addFoodToTodayFromModal(foodId) {
    const food = state.foodLibrary.find(f => f.id === foodId);
    if (food) addFoodToToday(food);
}

function changeQuantity(index, delta) {
    const entry = state.today.entries[index];
    if (!entry) return;
    const newQty = entry.quantity + delta;
    if (newQty < 1) {
        state.today.entries.splice(index, 1);
    } else {
        entry.quantity = newQty;
        entry.totalPoints = entry.points * newQty;
    }
    saveState();
    renderToday();
}

function startNewDay() {
    autoSaveCurrentDay();
    const todayStr = getTodayDateStr();
    state.today = { date: todayStr, entries: [] };
    saveState();
    renderToday();
    renderHistory();
    updateFlexDisplay();
    alert("Day saved successfully!");
}

function deleteDay(index) {
    if (!confirm("Delete this day?")) return;
    state.currentWeek.days.splice(index, 1);
    saveState();
    renderHistory();
    updateFlexDisplay();
}

function startNewWeek() {
    if (!confirm("Start new week?")) return;
    resetWeek();
    state.today = { date: getTodayDateStr(), entries: [] };
    saveState();
    renderHistory();
    renderToday();
    updateFlexDisplay();
}

function showSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
    document.getElementById('settings-weight').value = state.userSettings.weight;
    document.getElementById('settings-activity').value = state.userSettings.activityLevel;
    updateTargetPreview();
}

function hideSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

function updateTargetPreview() {
    const weight = parseFloat(document.getElementById('settings-weight').value) || 160;
    const activity = document.getElementById('settings-activity').value;
    let mod = 0;
    if (activity === 'moderate') mod = 2;
    else if (activity === 'active') mod = 4;
    const target = Math.round((weight / 10) + 6 + mod);
    document.getElementById('preview-target').textContent = target;
}

function saveSettings() {
    state.userSettings.weight = parseFloat(document.getElementById('settings-weight').value) || 160;
    state.userSettings.activityLevel = document.getElementById('settings-activity').value;
    saveState();
    hideSettings();
    renderToday();
    updateFlexDisplay();
}

function showAddFoodModal() {
    document.getElementById('add-food-modal').style.display = 'flex';
    document.getElementById('modal-search').value = '';
    renderModalLibrary();
}

function hideAddFoodModal() {
    document.getElementById('add-food-modal').style.display = 'none';
}

function showNewFoodForm() {
    hideAddFoodModal();
    document.getElementById('food-modal-title').textContent = 'New Food Item';
    document.getElementById('save-food-btn').textContent = 'Save';
    document.getElementById('new-name').value = '';
    document.getElementById('new-calories').value = 120;
    document.getElementById('new-fat').value = 3;
    document.getElementById('new-fiber').value = 0;
    document.getElementById('new-food-modal').style.display = 'flex';
}

function hideNewFoodModal() {
    document.getElementById('new-food-modal').style.display = 'none';
}

function saveNewFood() {
    const name = document.getElementById('new-name').value.trim();
    if (!name) return alert("Name required");
    const calories = parseFloat(document.getElementById('new-calories').value) || 0;
    const fat = parseFloat(document.getElementById('new-fat').value) || 0;
    const fiber = parseFloat(document.getElementById('new-fiber').value) || 0;
    const points = calculatePoints(calories, fat, fiber);
    const newFood = { id: Date.now(), name, calories, fat, fiber, points };
    state.foodLibrary.unshift(newFood);
    saveState();
    hideNewFoodModal();
    renderLibrary();
}

function editFood(id) {
    alert("Edit food coming soon");
}

function deleteFood(id) {
    if (confirm("Delete food?")) {
        state.foodLibrary = state.foodLibrary.filter(f => f.id !== id);
        saveState();
        renderLibrary();
    }
}

function init() {
    loadState();
    renderToday();
    renderLibrary();
    renderHistory();
    updateFlexDisplay();
    switchTab(0);

    window.addEventListener('beforeunload', autoSaveCurrentDay);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') autoSaveCurrentDay();
    });
}

window.onload = init;
