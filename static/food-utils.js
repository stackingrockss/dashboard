// Shared food utility functions
// Functions are now available globally from utility files

// Debounce utility
export function debounce(func, wait) {
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

// Loading and notification functions
export function showLoading(message) {
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

export function showError(message) {
    showSnack(message, 'error');
}

export function showSuccess(message) {
    showSnack(message, 'success');
}

// Search utilities
export function updateSearchStats(count) {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
}

export function updateView() {
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

// Food card creation and management
export function createFoodCard(food) {
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

export function addCardEventListeners() {
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

export function updateNutritionDisplay(card, foodId) {
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

export function displayResults(foods) {
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

// Global food logging function
export function setupGlobalLogFood() {
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
                card.querySelector('.quantity-input').value = '100';
                // Trigger custom event for page-specific updates
                window.dispatchEvent(new CustomEvent('foodLogged', { detail: { foodId, data } }));
            } else {
                showError(data.error || 'Failed to log food');
            }
        })
        .catch(error => {
            console.error('Error logging food:', error);
            showError('Failed to log food. Please try again.');
        });
    };
} 