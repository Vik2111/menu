document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentDate = new Date();
    let menuData = JSON.parse(localStorage.getItem('weeklyMenuData')) || {};

    // Default dishes if not in storage
    const defaultDishes = [
        "Омлет", "Яичница", "Сырники", "Бутерброды", "Каша",
        "Суп", "Борщ", "Солянка", "Котлеты", "Макароны",
        "Пюре", "Салат"
    ];
    let dishDatabase = JSON.parse(localStorage.getItem('dishDatabase')) || defaultDishes;

    // DOM Elements
    const weekGrid = document.getElementById('weekGrid');
    const currentWeekLabel = document.getElementById('currentWeekLabel');
    const prevWeekBtn = document.getElementById('prevWeek');
    const nextWeekBtn = document.getElementById('nextWeek');
    const addDishFab = document.getElementById('addDishFab');
    const addDishModal = document.getElementById('addDishModal');
    const closeModalBtn = document.getElementById('closeModal');
    const saveDishBtn = document.getElementById('saveDishBtn');
    const daySelect = document.getElementById('daySelect');
    const mealSelect = document.getElementById('mealSelect');
    const dishSelect = document.getElementById('dishSelect');
    const customDishGroup = document.getElementById('customDishGroup');
    const customDishInput = document.getElementById('customDishInput');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const downloadBtn = document.getElementById('downloadBtn');

    // Dish DB Elements
    const settingsBtn = document.getElementById('settingsBtn');
    const dishDbModal = document.getElementById('dishDbModal');
    const closeDbModalBtn = document.getElementById('closeDbModal');
    const newDishInput = document.getElementById('newDishInput');
    const addDishToDbBtn = document.getElementById('addDishToDbBtn');
    const dishList = document.getElementById('dishList');

    // Constants
    const daysOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const mealTypes = {
        'breakfast': 'Завтрак',
        'lunch': 'Обед',
        'dinner': 'Ужин'
    };

    // Drag and Drop Handlers (Hoisted)
    function handleDragStart(e, dateKey, type, index, dishName) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            dateKey, type, index, dishName
        }));
        e.target.classList.add('dragging');
        e.stopPropagation();
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.querySelector('.meal-content').classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.currentTarget.querySelector('.meal-content').classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        const targetSlot = e.currentTarget;
        targetSlot.querySelector('.meal-content').classList.remove('drag-over');

        const dataStr = e.dataTransfer.getData('text/plain');
        if (!dataStr) return;

        const data = JSON.parse(dataStr);
        const targetDate = targetSlot.dataset.date;
        const targetType = targetSlot.dataset.type;

        // Don't do anything if dropped on same slot
        if (data.dateKey === targetDate && data.type === targetType) return;

        // Add to new slot
        if (!menuData[targetDate]) menuData[targetDate] = {};
        if (!menuData[targetDate][targetType]) menuData[targetDate][targetType] = [];
        menuData[targetDate][targetType].push(data.dishName);

        // Remove from old slot
        if (menuData[data.dateKey] && menuData[data.dateKey][data.type]) {
            menuData[data.dateKey][data.type].splice(data.index, 1);
            // Cleanup
            if (menuData[data.dateKey][data.type].length === 0) delete menuData[data.dateKey][data.type];
            if (Object.keys(menuData[data.dateKey]).length === 0) delete menuData[data.dateKey];
        }

        localStorage.setItem('weeklyMenuData', JSON.stringify(menuData));
        renderWeek();
    }

    // Expose to window for HTML attributes
    window.handleDragStart = handleDragStart;
    window.handleDragOver = handleDragOver;
    window.handleDragLeave = handleDragLeave;
    window.handleDrop = handleDrop;

    // Initialization
    migrateData();
    try {
        renderWeek();
    } catch (e) {
        console.error("Render error:", e);
    }
    updateDishSelect();

    // Event Listeners
    prevWeekBtn.addEventListener('click', () => changeWeek(-7));
    nextWeekBtn.addEventListener('click', () => changeWeek(7));

    addDishFab.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    addDishModal.addEventListener('click', (e) => {
        if (e.target === addDishModal) closeModal();
    });

    dishSelect.addEventListener('change', (e) => {
        if (e.target.value === 'other') {
            customDishGroup.classList.remove('hidden');
        } else {
            customDishGroup.classList.add('hidden');
        }
    });

    saveDishBtn.addEventListener('click', saveDish);

    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importData);
    downloadBtn.addEventListener('click', downloadOfflineView);

    // Dish DB Listeners
    settingsBtn.addEventListener('click', openDbModal);
    closeDbModalBtn.addEventListener('click', closeDbModal);
    dishDbModal.addEventListener('click', (e) => {
        if (e.target === dishDbModal) closeDbModal();
    });
    addDishToDbBtn.addEventListener('click', addDishToDb);

    // Functions
    function migrateData() {
        // Convert old string format to array format
        let hasChanges = false;
        Object.keys(menuData).forEach(dateKey => {
            Object.keys(menuData[dateKey]).forEach(mealType => {
                const value = menuData[dateKey][mealType];
                if (typeof value === 'string') {
                    menuData[dateKey][mealType] = [value];
                    hasChanges = true;
                }
            });
        });
        if (hasChanges) {
            localStorage.setItem('weeklyMenuData', JSON.stringify(menuData));
        }
    }

    function updateDishSelect() {
        // Save current selection if possible
        const currentVal = dishSelect.value;

        dishSelect.innerHTML = '<option value="">Выберите блюдо...</option>';

        dishDatabase.sort().forEach(dish => {
            const option = document.createElement('option');
            option.value = dish;
            option.textContent = dish;
            dishSelect.appendChild(option);
        });

        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.textContent = 'Другое...';
        dishSelect.appendChild(otherOption);

        if (currentVal && (dishDatabase.includes(currentVal) || currentVal === 'other')) {
            dishSelect.value = currentVal;
        }
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    function formatDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    function formatDisplayDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
    }

    function changeWeek(days) {
        currentDate.setDate(currentDate.getDate() + days);
        renderWeek();
    }

    function renderWeek() {
        weekGrid.innerHTML = '';
        const startOfWeek = getStartOfWeek(currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        currentWeekLabel.textContent = `Неделя ${formatDisplayDate(startOfWeek)} - ${formatDisplayDate(endOfWeek)}`;

        // Populate modal day select
        daySelect.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dateKey = formatDateKey(dayDate);
            const dayName = daysOfWeek[dayDate.getDay()];
            const isToday = new Date().toDateString() === dayDate.toDateString();

            // Add to modal select
            const option = document.createElement('option');
            option.value = dateKey;
            option.textContent = `${dayName} ${formatDisplayDate(dayDate)}`;
            if (isToday) option.selected = true;
            daySelect.appendChild(option);

            // Create Card
            const card = document.createElement('div');
            card.className = 'day-card';

            const header = document.createElement('div');
            header.className = `day-header ${isToday ? 'today' : ''}`;
            header.innerHTML = `<span>${dayName}</span> <span>${formatDisplayDate(dayDate)}</span>`;
            card.appendChild(header);

            // Create Meal Slots
            Object.entries(mealTypes).forEach(([type, label]) => {
                const slot = document.createElement('div');
                slot.className = 'meal-slot';

                // Drag Drop Attributes
                slot.dataset.date = dateKey;
                slot.dataset.type = type;
                slot.ondragover = handleDragOver;
                slot.ondragleave = handleDragLeave;
                slot.ondrop = handleDrop;

                const dishes = menuData[dateKey]?.[type] || [];
                const isFilled = dishes.length > 0;

                let dishesHtml = '';
                if (isFilled) {
                    dishesHtml = dishes.map((dish, index) => `
                        <div class="dish-item" draggable="true" ondragstart="handleDragStart(event, '${dateKey}', '${type}', ${index}, '${dish}')">
                            <span>${dish}</span>
                            <span class="delete-dish" onclick="deleteDish(event, '${dateKey}', '${type}', ${index})">&times;</span>
                        </div>
                    `).join('');
                }

                slot.innerHTML = `
                    <div class="meal-label">${label}</div>
                    <div class="meal-content ${isFilled ? 'filled' : ''}" onclick="openEditModal('${dateKey}', '${type}')">
                        ${dishesHtml}
                    </div>
                `;
                card.appendChild(slot);
            });

            weekGrid.appendChild(card);
        }
    }

    function openModal() {
        addDishModal.classList.remove('hidden');
        // Reset custom input if needed
        if (dishSelect.value === 'other') {
            customDishGroup.classList.remove('hidden');
        } else {
            customDishGroup.classList.add('hidden');
        }
    }

    // Expose to window for onclick handlers
    window.openEditModal = function (dateKey, mealType) {
        // Pre-fill modal
        daySelect.value = dateKey;
        mealSelect.value = mealType;

        // Reset dish selection
        dishSelect.value = '';
        customDishGroup.classList.add('hidden');

        openModal();
    };

    function closeModal() {
        addDishModal.classList.add('hidden');
    }

    function saveDish() {
        const dateKey = daySelect.value;
        const mealType = mealSelect.value;
        let dishName = dishSelect.value;

        if (dishName === 'other') {
            dishName = customDishInput.value.trim();
        }

        if (!dishName) return;

        // If it was a custom dish, ask to add to DB? 
        // For now, just save to menu.

        if (!menuData[dateKey]) {
            menuData[dateKey] = {};
        }

        // Initialize array if not exists
        if (!menuData[dateKey][mealType]) {
            menuData[dateKey][mealType] = [];
        }

        // Add new dish
        menuData[dateKey][mealType].push(dishName);

        localStorage.setItem('weeklyMenuData', JSON.stringify(menuData));
        renderWeek();
        closeModal();
    }

    window.deleteDish = function (event, dateKey, mealType, index) {
        event.stopPropagation(); // Prevent opening modal
        if (confirm('Удалить блюдо?')) {
            if (menuData[dateKey] && menuData[dateKey][mealType]) {
                menuData[dateKey][mealType].splice(index, 1);

                // Cleanup empty arrays/objects
                if (menuData[dateKey][mealType].length === 0) {
                    delete menuData[dateKey][mealType];
                }
                if (Object.keys(menuData[dateKey]).length === 0) {
                    delete menuData[dateKey];
                }

                localStorage.setItem('weeklyMenuData', JSON.stringify(menuData));
                renderWeek();
            }
        }
    };

    // Dish Database Functions
    function openDbModal() {
        renderDishList();
        dishDbModal.classList.remove('hidden');
    }

    function closeDbModal() {
        dishDbModal.classList.add('hidden');
    }

    function renderDishList() {
        dishList.innerHTML = '';
        dishDatabase.sort().forEach((dish, index) => {
            const item = document.createElement('div');
            item.className = 'dish-list-item';
            item.innerHTML = `
                <span>${dish}</span>
                <span class="delete-db-dish" onclick="deleteDbDish(${index})">&times;</span>
            `;
            dishList.appendChild(item);
        });
    }

    function addDishToDb() {
        const name = newDishInput.value.trim();
        if (name && !dishDatabase.includes(name)) {
            dishDatabase.push(name);
            localStorage.setItem('dishDatabase', JSON.stringify(dishDatabase));
            newDishInput.value = '';
            renderDishList();
            updateDishSelect();
        } else if (dishDatabase.includes(name)) {
            alert('Такое блюдо уже есть!');
        }
    }

    window.deleteDbDish = function (index) {
        if (confirm('Удалить это блюдо из списка?')) {
            dishDatabase.splice(index, 1);
            localStorage.setItem('dishDatabase', JSON.stringify(dishDatabase));
            renderDishList();
            updateDishSelect();
        }
    };

    function exportData() {
        const dataStr = JSON.stringify(menuData);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = 'menu-plan.json';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const content = e.target.result;
                const parsedData = JSON.parse(content);
                // Basic validation could go here
                menuData = parsedData;
                localStorage.setItem('weeklyMenuData', JSON.stringify(menuData));
                renderWeek();
                alert('Меню успешно загружено!');
            } catch (err) {
                alert('Ошибка при чтении файла. Убедитесь, что это корректный JSON.');
                console.error(err);
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    }

    function downloadOfflineView() {
        // Embedded CSS to avoid CORS issues when running locally without a server
        const cssText = `
:root {
    --primary-color: #4a90e2;
    --primary-hover: #357abd;
    --bg-color: #f5f7fa;
    --card-bg: #ffffff;
    --text-color: #333333;
    --text-secondary: #666666;
    --border-color: #e1e4e8;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    --radius: 12px;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Inter', sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.5;
    padding-bottom: 80px;
    /* Space for FAB */
}

.app-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
}

/* Header */
header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
    background: var(--card-bg);
    padding: 16px;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
}

.week-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.week-nav h2 {
    font-size: 1.1rem;
    font-weight: 600;
    text-align: center;
}

.nav-btn {
    background: none;
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
}

.actions {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.action-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: white;
    cursor: pointer;
    font-size: 0.9rem;
}

/* Grid */
.week-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}

/* Day Card */
.day-card {
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 16px;
    box-shadow: var(--shadow);
}

.day-header {
    font-weight: 600;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
}

.day-header.today {
    color: var(--primary-color);
}

.meal-slot {
    margin-bottom: 12px;
}

.meal-slot:last-child {
    margin-bottom: 0;
}

.meal-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
}

.meal-content {
    min-height: 40px;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px dashed var(--border-color);
    font-size: 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.meal-content.filled {
    background: #f8f9fa; /* Keep neutral background for container */
    border: 1px solid var(--border-color);
    border-style: solid;
}

.dish-item {
    background: #eef6ff;
    border: 1px solid #b3d7ff;
    border-radius: 4px;
    padding: 4px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background 0.2s;
}

.dish-item:hover {
    background: #dbeafe;
}

.delete-dish {
    color: #ff4d4f;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    padding: 2px 6px;
    margin-left: 8px;
    border-radius: 4px;
}

.delete-dish:hover {
    background: rgba(255, 77, 79, 0.1);
}

/* Dish Database Editor */
.dish-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-top: 16px;
}

.dish-list-item {
    padding: 10px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.dish-list-item:last-child {
    border-bottom: none;
}

.dish-list-item:hover {
    background-color: #f8f9fa;
}

.delete-db-dish {
    color: #ff4d4f;
    cursor: pointer;
    padding: 4px;
    font-size: 1.2rem;
}

/* Drag and Drop Styles */
.meal-content.drag-over {
    background: #e6f7ff;
    border: 2px dashed var(--primary-color);
}

.dish-item.dragging {
    opacity: 0.5;
}

/* FAB */
.fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    border: none;
    font-size: 2rem;
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: transform 0.2s;
}

.fab:active {
    transform: scale(0.95);
}

/* Modal */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    opacity: 1;
    transition: opacity 0.3s;
}

.modal.hidden {
    opacity: 0;
    pointer-events: none;
}

.modal-content {
    background: white;
    width: 90%;
    max-width: 400px;
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 4px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    font-size: 0.9rem;
}

.form-group select,
.form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
}

.primary-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 1rem;
}

.full-width {
    width: 100%;
}

.hidden {
    display: none;
}

/* Desktop Responsive */
@media (min-width: 768px) {
    header {
        flex-direction: row;
        justify-content: space-between;
    }

    .week-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1024px) {
    .week-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
        `;

        // 2. Clone the grid
        const gridClone = weekGrid.cloneNode(true);

        // 3. Clean up interactive elements
        // Remove delete buttons
        const deleteBtns = gridClone.querySelectorAll('.delete-dish');
        deleteBtns.forEach(btn => btn.remove());

        // Remove DB delete buttons if any
        const dbDeleteBtns = gridClone.querySelectorAll('.delete-db-dish');
        dbDeleteBtns.forEach(btn => btn.remove());

        // Remove onclick attributes
        const clickableElements = gridClone.querySelectorAll('[onclick]');
        clickableElements.forEach(el => {
            el.removeAttribute('onclick');
            el.style.cursor = 'default';
        });

        // Remove drag events
        const draggableElements = gridClone.querySelectorAll('[draggable]');
        draggableElements.forEach(el => {
            el.removeAttribute('draggable');
            el.removeAttribute('ondragstart');
        });

        const dropZones = gridClone.querySelectorAll('.meal-slot');
        dropZones.forEach(el => {
            el.removeAttribute('ondragover');
            el.removeAttribute('ondragleave');
            el.removeAttribute('ondrop');
        });

        // 4. Construct HTML
        const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Моё Меню - ${currentWeekLabel.textContent}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        ${cssText}
        /* Overrides for offline view */
        body { padding-bottom: 20px; }
        .fab { display: none; }
        .delete-dish { display: none !important; }
        .meal-content { cursor: default !important; }
        .app-container { max-width: 800px; margin: 0 auto; }
        header { text-align: center; display: block; }
        .week-nav, .actions { display: none; }
        h1 { margin-bottom: 20px; font-size: 1.5rem; text-align: center;}
    </style>
</head>
<body>
    <div class="app-container">
        <h1>${currentWeekLabel.textContent}</h1>
        <div class="week-grid">
            ${gridClone.innerHTML}
        </div>
    </div>
</body>
</html>
        `;

        // 5. Download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `menu_view_${new Date().toISOString().split('T')[0]}.html`;
        link.click();
        URL.revokeObjectURL(url);
    }
});
