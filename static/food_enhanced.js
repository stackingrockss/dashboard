// food_enhanced.js
(function() {
    let currentFoods = [];
    let categories = [];
    let recentFoods = [];

    function setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        if (searchInput) searchInput.addEventListener('input', debounce(performSearch, 300));
        if (searchBtn) searchBtn.addEventListener('click', performSearch);
        // Filters
        const categoryFilter = document.getElementById('categoryFilter');
        const sortBy = document.getElementById('sortBy');
        if (categoryFilter) categoryFilter.addEventListener('change', performSearch);
        if (sortBy) sortBy.addEventListener('change', performSearch);
        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                updateView();
            });
        });
        // Quick add form
        const quickAddForm = document.getElementById('quickAddForm');
        if (quickAddForm) quickAddForm.addEventListener('submit', handleQuickAdd);
    }

    function loadCategories() {
        fetch('/food/categories')
            .then(response => response.json())
            .then(data => {
                categories = data.categories;
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
                currentFoods = data.foods || [];
                displayResults(currentFoods);
                updateSearchStats(data.count || 0);
            })
            .catch(error => {
                console.error('Search error:', error);
                showError('Search failed. Please try again.');
            });
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
                loadRecentFoods();
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

    function handleQuickAdd(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const foodData = {
            food_name: formData.get('foodName'),
            calories: parseFloat(formData.get('calories')),
            protein: parseFloat(formData.get('protein')) || 0,
            carbs: parseFloat(formData.get('carbs')) || 0,
            fat: parseFloat(formData.get('fat')) || 0,
            quantity: parseFloat(formData.get('quantity')),
            unit: formData.get('unit'),
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
                showSuccess('Food added successfully!');
                event.target.reset();
                loadRecentFoods();
            } else {
                showError(data.error || 'Failed to add food');
            }
        })
        .catch(error => {
            console.error('Error adding food:', error);
            showError('Failed to add food. Please try again.');
        });
    }

    function loadRecentFoods() {
        const recentContainer = document.getElementById('recentFoods');
        if (recentContainer) recentContainer.innerHTML = '<p>No recent foods logged yet.</p>';
    }

    window.searchSuggestion = function(term) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = term;
        performSearch();
    };

    function updateSearchStats(count) {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
    }

    function updateView() {
        const view = document.querySelector('.view-btn.active').dataset.view;
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        if (view === 'list') {
            resultsContainer.style.gridTemplateColumns = '1fr';
        } else {
            resultsContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
        }
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
        alert(message);
    }

    function showSuccess(message) {
        alert(message);
    }

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

    // Expose init function
    window.initFoodEnhanced = function() {
        loadCategories();
        loadRecentFoods();
        setupEventListeners();
    };
})(); 