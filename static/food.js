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

// --- Barcode Scanner Modal Logic ---
const openBarcodeModalBtn = document.getElementById('open-barcode-modal');
const barcodeModal = document.getElementById('barcode-modal');
const closeBarcodeModalBtn = document.getElementById('close-barcode-modal');

if (openBarcodeModalBtn && barcodeModal && closeBarcodeModalBtn) {
    openBarcodeModalBtn.addEventListener('click', () => {
        barcodeModal.style.display = 'flex';
    });
    closeBarcodeModalBtn.addEventListener('click', () => {
        barcodeModal.style.display = 'none';
    });
    barcodeModal.addEventListener('click', (e) => {
        if (e.target === barcodeModal) {
            barcodeModal.style.display = 'none';
        }
    });
}

// --- Food Search Logic (adapted from food_enhanced.js) ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading(message) {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
}

function showError(message) {
    showSnack(message, 'error');
}

function showSuccess(message) {
    showSnack(message, 'success');
}

function updateSearchStats(count) {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
}

function updateView() {
    const viewBtn = document.querySelector('.view-btn.active');
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer || !viewBtn) return;
    const view = viewBtn.dataset.view;
    if (view === 'list') {
        resultsContainer.style.gridTemplateColumns = '1fr';
    } else {
        resultsContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
    }
}

function displayResults(foods) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    if (foods.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <h3>No foods found</h3>
                <p>Try adjusting your search terms or browse by category.</p>
                <div class="suggestions">
                    <span class="suggestion-tag" onclick="searchSuggestion('apple')">Apple</span>
                    <span class="suggestion-tag" onclick="searchSuggestion('chicken')">Chicken</span>
                    <span class="suggestion-tag" onclick="searchSuggestion('yogurt')">Yogurt</span>
                    <span class="suggestion-tag" onclick="searchSuggestion('rice')">Rice</span>
                </div>
            </div>
        `;
        return;
    }
    const foodCards = foods.map(food => createFoodCard(food)).join('');
    resultsContainer.innerHTML = foodCards;
    addCardEventListeners();
    document.querySelectorAll('.food-card').forEach(card => {
        const foodId = card.getAttribute('data-food-id');
        updateNutritionDisplay(card, foodId);
    });
}

function createFoodCard(food) {
    const nutrition = food.nutrition;
    const servingSizes = food.common_serving_sizes || [];
    return `
        <div class="food-card" data-food-id="${food.id}">
            <div class="food-header">
                <div>
                    <h3 class="food-title">${food.name}</h3>
                    ${food.brand ? `<p class="food-brand">${food.brand}</p>` : ''}
                </div>
                <span class="food-category">${food.category || 'Uncategorized'}</span>
            </div>
            <div class="nutrition-grid">
                <div class="nutrition-item">
                    <span class="nutrition-label">Calories</span>
                    <span class="nutrition-value">${nutrition.calories || 0}</span>
                </div>
                <div class="nutrition-item">
                    <span class="nutrition-label">Protein</span>
                    <span class="nutrition-value">${nutrition.protein || 0}g</span>
                </div>
                <div class="nutrition-item">
                    <span class="nutrition-label">Carbs</span>
                    <span class="nutrition-value">${nutrition.carbs || 0}g</span>
                </div>
                <div class="nutrition-item">
                    <span class="nutrition-label">Fat</span>
                    <span class="nutrition-value">${nutrition.fat || 0}g</span>
                </div>
            </div>
            ${servingSizes.length > 0 ? `
                <div class="serving-info">
                    <h4>Serving Options</h4>
                    <div class="serving-options">
                        ${servingSizes.map(serving => `
                            <span class="serving-option" data-serving-id="${serving.id}">
                                ${serving.description}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="log-section">
                <input type="number" class="quantity-input" value="100" min="1" step="1">
                <select class="unit-select">
                    <option value="g">g</option>
                    <option value="oz">oz</option>
                    <option value="cup">cup</option>
                    <option value="piece">piece</option>
                </select>
                <button class="log-btn" onclick="logFood(${food.id})">Log Food</button>
            </div>
        </div>
    `;
}

function addCardEventListeners() {
    document.querySelectorAll('.serving-option').forEach(option => {
        option.addEventListener('click', function() {
            const card = this.closest('.food-card');
            card.querySelectorAll('.serving-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    document.querySelectorAll('.food-card').forEach(card => {
        const foodId = card.getAttribute('data-food-id');
        const qtyInput = card.querySelector('.quantity-input');
        const unitSelect = card.querySelector('.unit-select');
        if (qtyInput && unitSelect) {
            const update = () => updateNutritionDisplay(card, foodId);
            qtyInput.addEventListener('input', update);
            unitSelect.addEventListener('change', update);
        }
    });
}

function updateNutritionDisplay(card, foodId) {
    const qty = card.querySelector('.quantity-input').value;
    const unit = card.querySelector('.unit-select').value;
    fetch(`/food/nutrition/${foodId}?amount=${qty}&unit=${unit}`)
        .then(res => res.json())
        .then(data => {
            const nutrition = data.nutrition;
            const grid = card.querySelector('.nutrition-grid');
            if (nutrition && grid) {
                grid.innerHTML = `
                    <div class="nutrition-item"><span class="nutrition-label">Calories</span><span class="nutrition-value">${nutrition.calories || 0}</span></div>
                    <div class="nutrition-item"><span class="nutrition-label">Protein</span><span class="nutrition-value">${nutrition.protein || 0}g</span></div>
                    <div class="nutrition-item"><span class="nutrition-label">Carbs</span><span class="nutrition-value">${nutrition.carbs || 0}g</span></div>
                    <div class="nutrition-item"><span class="nutrition-label">Fat</span><span class="nutrition-value">${nutrition.fat || 0}g</span></div>
                `;
            }
        });
}

window.logFood = function(foodId) {
    const card = document.querySelector(`[data-food-id="${foodId}"]`);
    const quantity = card.querySelector('.quantity-input').value;
    const selectedServing = card.querySelector('.serving-option.selected');
    const servingSizeId = selectedServing ? selectedServing.dataset.servingId : null;
    const foodData = {
        food_id: foodId,
        quantity: parseFloat(quantity),
        serving_size_id: servingSizeId,
        date: new Date().toISOString().split('T')[0]
    };
    fetch('/food/food_entry', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(foodData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccess('Food logged successfully!');
            // Optionally reload food entries
            loadFoodEntries();
            card.querySelector('.quantity-input').value = '100';
        } else {
            showError(data.error || 'Failed to log food');
        }
    })
    .catch(error => {
        console.error('Error logging food:', error);
        showError('Failed to log food. Please try again.');
    });
};

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortBy = document.getElementById('sortBy');
    const query = searchInput ? searchInput.value.trim() : '';
    const category = categoryFilter ? categoryFilter.value : '';
    const sort = sortBy ? sortBy.value : '';
    if (!query && !category) {
        showLoading('Search for foods to get started...');
        return;
    }
    showLoading('Searching...');
    let url = '/food/search?';
    if (query) url += `q=${encodeURIComponent(query)}&`;
    if (category) url += `category=${category}&`;
    if (sort) url += `sort=${sort}&`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const foods = data.foods || [];
            displayResults(foods);
            updateSearchStats(data.count || 0);
        })
        .catch(error => {
            console.error('Search error:', error);
            showError('Search failed. Please try again.');
        });
}

function loadCategories() {
    fetch('/food/categories')
        .then(response => response.json())
        .then(data => {
            const categories = data.categories;
            const categoryFilter = document.getElementById('categoryFilter');
            if (!categoryFilter) return;
            // Remove old options except the first
            while (categoryFilter.options.length > 1) categoryFilter.remove(1);
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading categories:', error));
}

window.searchSuggestion = function(term) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = term;
    performSearch();
};

// --- Setup event listeners for food search ---
function setupFoodSearchEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    if (searchInput) searchInput.addEventListener('input', debounce(performSearch, 300));
    if (searchBtn) searchBtn.addEventListener('click', performSearch);
    const categoryFilter = document.getElementById('categoryFilter');
    const sortBy = document.getElementById('sortBy');
    if (categoryFilter) categoryFilter.addEventListener('change', performSearch);
    if (sortBy) sortBy.addEventListener('change', performSearch);
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateView();
        });
    });
}

// --- Initialize food search and categories on page load ---
if (document.getElementById('searchInput')) {
    loadCategories();
    setupFoodSearchEventListeners();
} 