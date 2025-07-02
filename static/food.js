import { showSnack } from './utils.js';

// --- Food/Nutrition Logic ---
// (Moved from fitness.js)

// Food Form Submission
const foodForm = document.getElementById('food-entry-form');
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
        const formData = new FormData(foodForm);
        try {
            const response = await fetch('/fitness/add_food_entry', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (response.ok) {
                showSnack(result.message, 'success');
                foodForm.reset();
                if (foodDateInput) foodDateInput.value = today;
                loadFoodEntries();
                // Load nutrition summary for the date
                const date = formData.get('food_date');
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
    // Implement nutrition summary fetch and render logic here
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