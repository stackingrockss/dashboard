// Shared workout utility functions

// Clear cache for specific endpoints
function clearCache(pattern) {
    if (typeof apiCache !== 'undefined') {
        apiCache.clear(pattern);
    }
}

// Exercise category utilities
async function loadExerciseCategories() {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch('/fitness/api/exercise_categories');
    }
    return await fetch('/fitness/api/exercise_categories').then(r => r.json());
}

async function loadExercisesByCategory(categoryId) {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch(`/fitness/api/exercises/${categoryId}`);
    }
    return await fetch(`/fitness/api/exercises/${categoryId}`).then(r => r.json());
}

// Personal records utilities
async function loadPersonalRecords(exerciseName) {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch(`/fitness/api/personal_records/${encodeURIComponent(exerciseName)}`);
    }
    return await fetch(`/fitness/api/personal_records/${encodeURIComponent(exerciseName)}`).then(r => r.json());
}

// Exercise utilities
async function checkIfBarbellExercise() {
    const exerciseName = document.getElementById('exerciseName')?.value;
    if (!exerciseName) return false;
    
    const barbellExercises = [
        'bench press', 'squat', 'deadlift', 'overhead press', 'barbell row',
        'power clean', 'snatch', 'clean and jerk', 'front squat', 'back squat'
    ];
    
    return barbellExercises.some(exercise => 
        exerciseName.toLowerCase().includes(exercise)
    );
}

async function toggleFavorite(exerciseId) {
    try {
        const response = await fetch(`/fitness/api/exercise/${exerciseId}/favorite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        
        if (data.success) {
            if (typeof showSnack !== 'undefined') {
                showSnack(data.message || 'Favorite status updated!', 'success');
            }
            return data.is_favorite;
        } else {
            if (typeof showSnack !== 'undefined') {
                showSnack(data.error || 'Failed to update favorite status', 'error');
            }
            return null;
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        if (typeof showSnack !== 'undefined') {
            showSnack('Failed to update favorite status', 'error');
        }
        return null;
    }
}

async function updateFavoriteButtonStatus(exerciseId, isFavorite = null) {
    const favoriteBtn = document.querySelector('.favorite-btn');
    if (!favoriteBtn) return;
    
    if (isFavorite === null) {
        // Check current status
        try {
            const response = await fetch(`/fitness/api/exercise/${exerciseId}/favorite`);
            const data = await response.json();
            isFavorite = data.is_favorite;
        } catch (error) {
            console.error('Error checking favorite status:', error);
            return;
        }
    }
    
    favoriteBtn.classList.toggle('favorited', isFavorite);
    favoriteBtn.innerHTML = isFavorite ? 
        '<i class="fas fa-heart"></i>' : 
        '<i class="far fa-heart"></i>';
}

// Set management utilities
async function loadTodaysSets(exerciseName) {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch(`/fitness/api/todays_sets?exercise=${encodeURIComponent(exerciseName)}`);
    }
    return await fetch(`/fitness/api/todays_sets?exercise=${encodeURIComponent(exerciseName)}`).then(r => r.json());
}

async function loadExerciseHistory(exerciseName) {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch(`/fitness/api/exercise_history?exercise=${encodeURIComponent(exerciseName)}`);
    }
    return await fetch(`/fitness/api/exercise_history?exercise=${encodeURIComponent(exerciseName)}`).then(r => r.json());
}

async function deleteSet(setId) {
    try {
        const response = await fetch(`/fitness/api/sets/${setId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        
        if (data.success) {
            if (typeof showSnack !== 'undefined') {
                showSnack('Set deleted successfully!', 'success');
            }
            return true;
        } else {
            if (typeof showSnack !== 'undefined') {
                showSnack(data.error || 'Failed to delete set', 'error');
            }
            return false;
        }
    } catch (error) {
        console.error('Error deleting set:', error);
        if (typeof showSnack !== 'undefined') {
            showSnack('Failed to delete set', 'error');
        }
        return false;
    }
}

// Workout template utilities
async function loadWorkoutTemplates() {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch('/fitness/api/workout_templates');
    }
    return await fetch('/fitness/api/workout_templates').then(r => r.json());
}

async function loadWorkoutHistory() {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch('/fitness/api/workout_history');
    }
    return await fetch('/fitness/api/workout_history').then(r => r.json());
}

async function loadTodaysWorkout() {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch('/fitness/api/todays_workout');
    }
    return await fetch('/fitness/api/todays_workout').then(r => r.json());
}

async function loadFullWorkoutHistory() {
    if (typeof cachedFetch !== 'undefined') {
        return await cachedFetch('/fitness/api/workout_history');
    }
    return await fetch('/fitness/api/workout_history').then(r => r.json());
}

// Modal utilities
function openWorkoutModalNewFlow() {
    const workoutModal = document.getElementById('workout-modal');
    const categoryList = document.getElementById('category-list');
    
    if (workoutModal) {
        workoutModal.style.display = 'flex';
    }
    
    // Fetch categories
    loadExerciseCategories().then(categories => {
        if (categoryList) {
            categoryList.innerHTML = '';
            categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-primary';
                btn.textContent = cat.name;
                btn.onclick = () => selectCategory(cat.id, cat.name);
                categoryList.appendChild(btn);
            });
        }
    }).catch(err => {
        if (categoryList) categoryList.innerHTML = '<div style="color:red">Failed to load categories</div>';
    });
}

function selectCategory(categoryId, categoryName) {
    const exerciseList = document.getElementById('exercise-list');
    const modalStepCategory = document.getElementById('modal-step-category');
    const modalStepExercise = document.getElementById('modal-step-exercise');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    
    // Set global variables for use in selectExercise
    window.currentCategoryId = categoryId;
    window.currentCategoryName = categoryName;
    
    // Show exercise step
    if (modalStepCategory) modalStepCategory.style.display = 'none';
    if (modalStepExercise) modalStepExercise.style.display = 'block';
    if (step1) step1.classList.remove('active');
    if (step2) step2.classList.add('active');
    
    if (exerciseList) exerciseList.innerHTML = '<div>Loading...</div>';
    
    loadExercisesByCategory(categoryId).then(exercises => {
        if (exerciseList) {
            exerciseList.innerHTML = '';
            exercises.forEach(ex => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-primary';
                btn.textContent = ex.name;
                btn.style.minWidth = '160px';
                if (ex.is_favorite) {
                    btn.classList.add('favorite-exercise');
                    btn.innerHTML = '<span class="star">⭐</span> ' + ex.name;
                }
                btn.onclick = () => selectExercise(ex.id, ex.name);
                exerciseList.appendChild(btn);
            });
        }
    }).catch(err => {
        if (exerciseList) exerciseList.innerHTML = '<div style="color:red">Failed to load exercises</div>';
    });
}

function selectExercise(exerciseId, exerciseName) {
    const workoutModal = document.getElementById('workout-modal');
    
    // Close the modal
    if (workoutModal) {
        workoutModal.style.display = 'none';
    }
    
    // Redirect to workout entry page with the selected exercise
    const params = new URLSearchParams({
        category_id: window.currentCategoryId || '',
        category_name: window.currentCategoryName || '',
        exercise: exerciseName
    });
    window.location.href = `/fitness/workout_entry?${params.toString()}`;
}

// Log set utility
async function logSet(setData) {
    try {
        const response = await fetch('/fitness/api/log_set', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(setData)
        });
        const data = await response.json();
        
        if (data.success) {
            if (typeof showSnack !== 'undefined') {
                showSnack('Set logged successfully!', 'success');
            }
            // Clear cache for related endpoints
            clearCache('todays_sets');
            clearCache('exercise_history');
            return data;
        } else {
            if (typeof showSnack !== 'undefined') {
                showSnack(data.error || 'Failed to log set', 'error');
            }
            return null;
        }
    } catch (error) {
        console.error('Error logging set:', error);
        if (typeof showSnack !== 'undefined') {
            showSnack('Failed to log set', 'error');
        }
        return null;
    }
}

// Initialize workout utilities
function initWorkoutUtils() {
    // Set up global functions
    window.openWorkoutModalNewFlow = openWorkoutModalNewFlow;
    window.selectCategory = selectCategory;
    window.selectExercise = selectExercise;
    window.toggleFavorite = toggleFavorite;
    window.deleteSet = deleteSet;
} 