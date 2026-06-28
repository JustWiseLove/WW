// script.js
let state = {
    foodLibrary: [],
    currentWeek: {
        startDate: '',
        weeklyFlex: 35,
        days: []
    },
    today: {
        date: '',
        entries: []
    },
    userSettings: {
        weight: 160,
        activityLevel: 'moderate'
    },
    lastUndo: null,
    editingFoodId: null,
    editingDayIndex: null
};

const STORAGE_KEY = 'ww_tracker_state';

// Utility functions
function calculatePoints(calories, fat, fiber) {
    const fiberCapped = Math.min(fiber || 0, 4);
    let points = (calories / 70) + (fat / 10) - (fiberCapped / 5);
    points = Math.round(points);
    return Math.max(1, points);
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
        if (!state.today.date || state.today.date !== todayStr) {
            // Auto transition to new day when date changes
            if (state.today.entries && state.today.entries.length > 0) {
                autoSaveCurrentDay();
            }
            state.today.date = todayStr;
            state.today.entries = state.today.entries || [];
        }
        
        if (!state.currentWeek.startDate) {
            resetWeek();
        }
    } else {
        state.foodLibrary = [
            { id: 1001, name: "Eggs (large, 1 egg)", calories: 70, fat: 5, fiber: 0, points: calculatePoints(70, 5, 0) },
            { id: 1002, name: "Banana (1 medium)", calories: 105, fat: 0, fiber: 3, points: calculatePoints(105, 0, 3) },
            { id: 1003, name: "Sourdough bread (50g slice)", calories: 130, fat: 1, fiber: 1, points: calculatePoints(130, 1, 1) },
            { id: 1004, name: "Zucchini (1 cup raw)", calories: 20, fat: 0, fiber: 2, points: calculatePoints(20, 0, 2) },
            { id: 1005, name: "Popcorn (air-popped, 3 cups)", calories: 90, fat: 1, fiber: 3, points: calculatePoints(90, 1, 3) },
            { id: 1006, name: "Pizza (1 slice cheese)", calories: 250, fat: 10, fiber: 1, points: calculatePoints(250, 10, 1) },
            { id: 1007, name: "Oatmeal (1/2 cup dry)", calories: 150, fat: 3, fiber: 4, points: calculatePoints(150, 3, 4) },
            { id: 1, name: "Grilled Chicken Breast", calories: 120, fat: 3, fiber: 0, points: 2 },
            { id: 2, name: "Apple", calories: 80, fat: 0, fiber: 4, points: 1 }
        ];
        resetWeek();
        state.today.date = getTodayDateStr();
    }
}

function autoSaveCurrentDay() {
    if (!state.today.entries || state.today.entries.length === 0) return;
    
    const todayStr = getTodayDateStr();
    const total = calculateTodayTotal();
    
    const dayRecord = {
        date: todayStr,
        entries: JSON.parse(JSON.stringify(state.today.entries)),
        totalPoints: total
    };
    
    const existingIndex = state.currentWeek.days.findIndex(d => d.date === todayStr);
    if (existingIndex > -1) {
        state.currentWeek.days[existingIndex] = dayRecord;
    } else {
        state.currentWeek.days.push(dayRecord);
    }
    saveState();
}

function resetWeek() {
    const today = getTodayDateStr();
    state.currentWeek = {
        startDate: today,
        weeklyFlex: 35,
        days: []
    };
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
        container.innerHTML = `
            <div class="empty-state">
                <h3>No foods logged yet</h3>
                <p>Tap "+ Add Food" to get started</p>
            </div>
        `;
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
                <button onclick="editFood(${food.id})" class="edit-btn" title="Edit">✏️</button>
                <button onclick="deleteFood(${food.id})" class="delete-btn" title="Delete">🗑</button>
                <button onclick="quickAddToToday(${food.id})" class="add-to-today" title="Add to today">＋</button>
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
        container.innerHTML = `
            <div class="empty-state">
                <h3>No previous days yet</h3>
                <p>Complete your first day to see history here</p>
            </div>
        `;
        return;
    }
    
    const target = getDailyTarget();
    
    days.forEach((day, idx) => {
        const actualIdx = state.currentWeek.days.length - 1 - idx;
        const overflow = Math.max(0, day.totalPoints - target);
        
        const div = document.createElement('div');
        div.className = 'history-day';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:start">
                <div onclick="editDay(${actualIdx})" style="cursor:pointer;flex:1">
                    <div class="history-date">${new Date(day.date).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})}</div>
                    <div class="history-points">
                        <span>${day.totalPoints} points</span>
                        <span style="color:#c44">−${overflow} flex</span>
                    </div>
                </div>
                <button onclick="deleteDay(${actualIdx});event.stopImmediatePropagation()" class="delete-day">🗑</button>
            </div>
        `;
        container.appendChild(div);
    });
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
    state.editingFoodId = null;
    document.getElementById('food-modal-title').textContent = 'New Food Item';
    document.getElementById('save-food-btn').textContent = 'Save to Library';
    document.getElementById('new-name').value = '';
    document.getElementById('new-calories').value = 120;
    document.getElementById('new-fat').value = 3;
    document.getElementById('new-fiber').value = 0;
    document.getElementById('new-food-modal').style.display = 'flex';
    updatePointsPreview();
}

function hideNewFoodModal() {
    document.getElementById('new-food-modal').style.display = 'none';
}

function updatePointsPreview() {
    const cal = parseFloat(document.getElementById('new-calories').value) || 0;
    const fat = parseFloat(document.getElementById('new-fat').value) || 0;
    const fiber = parseFloat(document.getElementById('new-fiber').value) || 0;
    document.getElementById('points-preview').textContent = calculatePoints(cal, fat, fiber);
}

function saveNewFood() {
    const name = document.getElementById('new-name').value.trim();
    if (!name) return alert("Food name is required");
    
    const calories = parseFloat(document.getElementById('new-calories').value) || 0;
    const fat = parseFloat(document.getElementById('new-fat').value) || 0;
    const fiber = parseFloat(document.getElementById('new-fiber').value) || 0;
    const points = calculatePoints(calories, fat, fiber);
    
    if (state.editingFoodId) {
        const food = state.foodLibrary.find(f => f.id === state.editingFoodId);
        if (food) {
            food.name = name;
            food.calories = calories;
            food.fat = fat;
            food.fiber = fiber;
            food.points = points;
        }
    } else {
        state.foodLibrary.unshift({
            id: Date.now(),
            name, calories, fat, fiber, points
        });
    }
    
    saveState();
    hideNewFoodModal();
    renderLibrary();
}

function editFood(foodId) {
    const food = state.foodLibrary.find(f => f.id === foodId);
    if (!food) return;
    state.editingFoodId = foodId;
    document.getElementById('food-modal-title').textContent = 'Edit Food';
    document.getElementById('save-food-btn').textContent = 'Save Changes';
    document.getElementById('new-name').value = food.name;
    document.getElementById('new-calories').value = food.calories;
    document.getElementById('new-fat').value = food.fat;
    document.getElementById('new-fiber').value = food.fiber;
    document.getElementById('new-food-modal').style.display = 'flex';
    updatePointsPreview();
}

function deleteFood(foodId) {
    if (!confirm("Delete this food permanently?")) return;
    state.foodLibrary = state.foodLibrary.filter(f => f.id !== foodId);
    state.today.entries = state.today.entries.filter(e => e.foodId !== foodId);
    saveState();
    renderLibrary();
    renderToday();
}

function quickAddToToday(foodId) {
    const food = state.foodLibrary.find(f => f.id === foodId);
    if (food) addFoodToToday(food);
}

function addFoodToToday(food) {
    const entry = { foodId: food.id, name: food.name, points: food.points, quantity: 1, totalPoints: food.points };
    state.today.entries.unshift(entry);
    saveLastUndo();
    saveState();
    renderToday();
    updateFlexDisplay();
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
    saveLastUndo();
    saveState();
    renderToday();
    updateFlexDisplay();
}

function saveLastUndo() {
    state.lastUndo = JSON.parse(JSON.stringify(state.today.entries));
}

function undoLastAction() {
    if (!state.lastUndo) return;
    state.today.entries = JSON.parse(JSON.stringify(state.lastUndo));
    state.lastUndo = null;
    saveState();
    renderToday();
    updateFlexDisplay();
}

function startNewDay() {
    autoSaveCurrentDay();
    const todayStr = getTodayDateStr();
    state.today = { date: todayStr, entries: [] };
    saveState();
    renderToday();
    renderHistory();
    updateFlexDisplay();
    alert("✅ Day saved! New day started.");
}

function editDay(index) {
    const day = state.currentWeek.days[index];
    if (!day) return;
    
    if (confirm(`Edit day ${new Date(day.date).toLocaleDateString()}?`)) {
        state.today = {
            date: day.date,
            entries: JSON.parse(JSON.stringify(day.entries || []))
        };
        state.currentWeek.days.splice(index, 1); // remove old version
        saveState();
        switchTab(0); // go to today view (now editing previous day)
        renderToday();
    }
}

function deleteDay(index) {
    if (!confirm("Delete this day permanently?")) return;
    state.currentWeek.days.splice(index, 1);
    saveState();
    renderHistory();
    updateFlexDisplay();
}

function startNewWeek() {
    if (!confirm("Start a brand new week? Current week history will be cleared.")) return;
    resetWeek();
    const todayStr = getTodayDateStr();
    state.today = { date: todayStr, entries: [] };
    saveState();
    renderHistory();
    renderToday();
    updateFlexDisplay();
    alert("New week started!");
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
    let mod = activity === 'moderate' ? 2 : activity === 'active' ? 4 : 0;
    document.getElementById('preview-target').textContent = Math.round((weight / 10) + 6 + mod);
}

function saveSettings() {
    state.userSettings.weight = parseFloat(document.getElementById('settings-weight').value) || 160;
    state.userSettings.activityLevel = document.getElementById('settings-activity').value;
    saveState();
    hideSettings();
    renderToday();
    updateFlexDisplay();
}

function handleKeyboard(e) {
    if (e.metaKey && e.key === "k") {
        e.preventDefault();
        showAddFoodModal();
    }
}

function init() {
    loadState();
    
    const inputs = ['new-calories','new-fat','new-fiber'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePointsPreview);
    });
    
    renderToday();
    renderLibrary();
    renderHistory();
    updateFlexDisplay();
    switchTab(0);
    
    document.addEventListener('keydown', handleKeyboard);
    
    // Auto-save on page unload / visibility change
    window.addEventListener('beforeunload', () => {
        if (state.today.entries && state.today.entries.length > 0) autoSaveCurrentDay();
    });
    
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && state.today.entries && state.today.entries.length > 0) {
            autoSaveCurrentDay();
        }
    });
    
    console.log('%cWW Journey ready — data auto-saves on every change + day rollover', 'color:#4a7043;font-weight:600');
}

window.onload = init;
