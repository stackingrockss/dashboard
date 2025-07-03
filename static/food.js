import { showSnack } from './utils.js';

// --- Food/Nutrition Logic ---
// (Moved from fitness.js)

// Food Form Submission
const foodForm = document.getElementById('manual-food-form');
const foodTable = document.getElementById('food-entries-table')?.querySelector('tbody');
const today = new Date().toISOString().split('T')[0];
const foodDateInput = document.getElementById('food-date');
if (foodDateInput) foodDateInput.value = today;

async function loadFoodEntries() {
    if (document.querySelector('#food.sub-tab-content')?.style.display !== 'block') return;
    try {
        const response = await fetch('/fitness/api/food_entries');
        const entries = await response.json();
        if (foodTable) {
            foodTable.innerHTML = '';
            entries.forEach(e => {
                const row = document.createElement('tr');
                const entryType = e.food_name === 'Manual Entry' ? 'Manual' : 'Logged';
                row.innerHTML = `
                    <td>${e.date}</td>
                    <td>${e.food_name}</td>
                    <td>${e.calories}</td>
                    <td>${e.protein || ''}</td>
                    <td>${e.carbs || ''}</td>
                    <td>${e.fat || ''}</td>
                    <td>${e.quantity}</td>
                    <td>${e.unit}</td>
                    <td>${entryType}</td>
                    <td>
                        <button class="action-btn edit-icon" onclick="editFoodEntry(${e.id})" title="Edit">✏️</button>
                        <button class="action-btn delete-icon" onclick="deleteFoodEntry(${e.id})" title="Delete">✕</button>
                    </td>
                `;
                foodTable.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading food entries:', error);
        showSnack('Failed to load food entries', 'error');
    }
}

if (foodForm) {
    foodForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dateInput = document.getElementById('date');
        if (dateInput) dateInput.value = today;
        // Ensure protein, carbs, fat are always numbers
        ['manual-protein', 'manual-carbs', 'manual-fat'].forEach(id => {
            const input = document.getElementById(id);
            if (input && !input.value) input.value = "0";
        });
        const formData = new FormData(foodForm);
        console.log('Submitting manual calories:', [...formData.entries()]);
        try {
            const response = await fetch('/fitness/add_manual_calories', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (response.ok) {
                showSnack(result.message, 'success');
                foodForm.reset();
                if (dateInput) dateInput.value = today;
                loadFoodEntries();
                // Load nutrition summary for the date
                const date = formData.get('date');
                if (date) {
                    loadDailyNutrition(date);
                }
            } else {
                showSnack(result.error, 'error');
            }
        } catch (error) {
            showSnack('Error: ' + error.message, 'error');
        }
    });
}

// Nutrition summary (example, adjust as needed)
function loadDailyNutrition(date) {
    const summaryDiv = document.getElementById('nutrition-summary-display');
    if (!summaryDiv) return;
    summaryDiv.innerHTML = '<div>Loading...</div>';
    fetch(`/fitness/api/daily_nutrition/${date}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                summaryDiv.innerHTML = `<div class="nutrition-summary-card no-data"><span class="source-badge no-data">No Data</span><div style='margin-top:8px;'>${data.error}</div></div>`;
                return;
            }
            const sourceClass = data.source === 'logged_food' ? 'logged-food' : (data.source === 'manual_input' ? 'manual-input' : 'no-data');
            const sourceLabel = data.source === 'logged_food' ? 'Logged Food' : (data.source === 'manual_input' ? 'Manual Input' : 'No Data');
            summaryDiv.innerHTML = `
                <div class="nutrition-summary-card ${sourceClass}">
                    <span class="source-badge ${sourceClass}">${sourceLabel}</span>
                    <div class="nutrition-totals">
                        <div class="nutrition-item">
                            <span class="label">Calories</span>
                            <span class="value">${data.calories || 0}</span>
                        </div>
                        <div class="nutrition-item">
                            <span class="label">Protein</span>
                            <span class="value">${data.protein || 0}g</span>
                        </div>
                        <div class="nutrition-item">
                            <span class="label">Carbs</span>
                            <span class="value">${data.carbs || 0}g</span>
                        </div>
                        <div class="nutrition-item">
                            <span class="label">Fat</span>
                            <span class="value">${data.fat || 0}g</span>
                        </div>
                    </div>
                    <details class="nutrition-entries" ${data.entries && data.entries.length ? '' : 'open'}>
                        <summary>Entries (${data.entries.length})</summary>
                        <div class="entries-list">
                            ${data.entries.length ? data.entries.map(e => `
                                <div class="entry-item ${e.is_manual ? 'manual-entry' : 'logged-entry'}">
                                    <span>${e.food_name}</span>
                                    <span>${e.calories || 0} kcal</span>
                                    <span class="entry-type">${e.is_manual ? 'Manual' : 'Logged'}</span>
                                </div>
                            `).join('') : '<div style="color:#888;">No entries for this day.</div>'}
                        </div>
                    </details>
                </div>
            `;
        })
        .catch(() => {
            summaryDiv.innerHTML = `<div class="nutrition-summary-card no-data"><span class="source-badge no-data">No Data</span><div style='margin-top:8px;'>Failed to load nutrition summary.</div></div>`;
        });
}

// Edit food entry logic (example, adjust as needed)
function editFoodEntry(id) {
    // Implement edit food entry modal logic here
}

function deleteFoodEntry(id) {
    // Implement delete food entry logic here
}

// Export functions if using modules
export { loadFoodEntries, loadDailyNutrition, editFoodEntry, deleteFoodEntry };

if (document.getElementById('nutrition-summary-display')) {
    loadDailyNutrition(today);
} 