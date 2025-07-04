// Helper to get query params
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

const categoryId = getQueryParam('category_id');
const categoryName = getQueryParam('category_name');
const exerciseName = getQueryParam('exercise');

// Global variables for custom exercise functionality
let currentCategoryId = null;
let currentCategoryName = null;

// Barbell weight constants
const STANDARD_BARBELL_WEIGHT = 45; // Standard Olympic barbell weight
let isBarbellExercise = false;
let exerciseEquipment = null;
let exerciseId = null; // Will be set after exercise is loaded

// Audio functionality for PR achievements
let prAudio = null;

function initAudio() {
    try {
        prAudio = new Audio('/static/sounds/pr-achievement.mp3');
        prAudio.preload = 'auto';
        console.log('PR audio initialized successfully');
    } catch (error) {
        console.error('Failed to initialize PR audio:', error);
    }
}

function playPRSound(type = 'pr') {
    if (prAudio) {
        try {
            prAudio.currentTime = 0;
            prAudio.play().catch(error => {
                console.error('Failed to play PR sound:', error);
            });
            console.log('Playing PR sound');
        } catch (error) {
            console.error('Error playing PR sound:', error);
        }
    } else {
        console.warn('PR audio not initialized');
    }
}

function handlePRAchievement(prsAchieved, exerciseName) {
    console.log('PR Achievement detected:', prsAchieved, 'for', exerciseName);
    if (prsAchieved && prsAchieved.length > 0) {
        playPRSound('pr');
    }
}

// Update header elements
document.getElementById('category-id').value = categoryId || '';
document.getElementById('exercise-name').value = exerciseName || '';

// DOM element references
const exerciseNameInput = document.getElementById('exercise-name');
const exerciseIdInput = document.getElementById('exercise-id');

const logSetForm = document.getElementById('log-set-form');
const setsTableBody = document.querySelector('#sets-table tbody');

// Tab navigation logic
const tabLogNew = document.getElementById('tab-log-new');
const tabTrack = document.getElementById('tab-track');
const trackSection = document.getElementById('track-section');

// Plus/minus button logic for weight and reps
const weightInput = document.getElementById('weight');
const repsInput = document.getElementById('reps');
const weightMinus = document.getElementById('weight-minus');
const weightPlus = document.getElementById('weight-plus');
const repsMinus = document.getElementById('reps-minus');
const repsPlus = document.getElementById('reps-plus');

// --- Modern Modal: Category/Exercise Selection ---
const workoutModal = document.getElementById('workout-modal');
const modalStepCategory = document.getElementById('modal-step-category');
const modalStepExercise = document.getElementById('modal-step-exercise');
const categoryList = document.getElementById('category-list');
const exerciseList = document.getElementById('exercise-list');
const backToCategoryBtn = document.getElementById('back-to-category');
const closeWorkoutModalBtn = document.getElementById('close-workout-modal');
const cancelWorkoutBtn = document.getElementById('cancel-workout-btn');

// Favorite exercise button
const favoriteExerciseBtn = document.getElementById('favorite-exercise');

// Initialize exercise data and favorite button
if (categoryId && exerciseName) {
    checkIfBarbellExercise();
}

// Initialize favorite button (but don't update status until exerciseId is available)
if (favoriteExerciseBtn) {
    // Add click handler
    favoriteExerciseBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!exerciseId) {
            showMessage('Exercise data not loaded yet. Please wait a moment and try again.', 'error');
            return;
        }
        await toggleFavorite();
    });
}

// Progress steps
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

function showStep(step) {
    if (step === 'category') {
        modalStepCategory.classList.add('active');
        modalStepExercise.classList.remove('active');
        step1.classList.add('active');
        step2.classList.remove('active');
    } else if (step === 'exercise') {
        modalStepCategory.classList.remove('active');
        modalStepExercise.classList.add('active');
        step1.classList.remove('active');
        step2.classList.add('active');
    }
}

function resetWorkoutModal() {
    showStep('category');
    if (categoryList) categoryList.innerHTML = '';
    if (exerciseList) exerciseList.innerHTML = '';
}

async function openWorkoutModalNewFlow() {
    resetWorkoutModal();
    if (workoutModal) {
        workoutModal.classList.add('show');
        workoutModal.style.display = 'flex';
    }
    // Fetch categories
    try {
        const resp = await fetch('/fitness/api/exercise_categories');
        const categories = await resp.json();
        categoryList.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = cat.name;
            btn.onclick = () => selectCategory(cat.id, cat.name);
            categoryList.appendChild(btn);
        });
    } catch (err) {
        categoryList.innerHTML = '<div style="color:red">Failed to load categories</div>';
    }
}

async function selectCategory(categoryId, categoryName) {
    currentCategoryId = categoryId;
    currentCategoryName = categoryName;
    showStep('exercise');
    exerciseList.innerHTML = '<div>Loading...</div>';
    try {
        const resp = await fetch(`/fitness/api/exercises/${categoryId}`);
        const exercises = await resp.json();
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
    } catch (err) {
        exerciseList.innerHTML = '<div style="color:red">Failed to load exercises</div>';
    }
    setupCustomExerciseForm();
}

function selectExercise(exerciseId, exerciseName) {
    // Close the modal
    if (workoutModal) {
        workoutModal.classList.remove('show');
        workoutModal.style.display = 'none';
    }
    
    // Redirect to workout entry page with the selected exercise
    const params = new URLSearchParams({
        category_id: currentCategoryId,
        category_name: currentCategoryName,
        exercise: exerciseName,
        exercise_id: exerciseId
    });
    
    window.location.href = `/fitness/workout_entry?${params.toString()}`;
}

// --- Custom Exercise Form Logic ---
function setupCustomExerciseForm() {
    const showCustomExerciseFormBtn = document.getElementById('show-custom-exercise-form');
    const customExerciseForm = document.getElementById('custom-exercise-form');
    const customExerciseNameInput = document.getElementById('custom-exercise-name');

    if (!showCustomExerciseFormBtn || !customExerciseForm) return;

    // Remove previous listeners to avoid duplicates
    showCustomExerciseFormBtn.onclick = null;
    customExerciseForm.onsubmit = null;

    showCustomExerciseFormBtn.onclick = () => {
        customExerciseForm.style.display = 'block';
        showCustomExerciseFormBtn.style.display = 'none';
        if (currentCategoryId) {
            customExerciseForm.setAttribute('data-category-id', currentCategoryId);
        }
    };

    customExerciseForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = customExerciseNameInput.value.trim();
        const category_id = currentCategoryId;
        if (!name || !category_id) {
            showMessage('Exercise name is required.', 'error');
            return;
        }
        try {
            const resp = await fetch('/fitness/api/custom_exercises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    category_id
                })
            });
            const data = await resp.json();
            if (!resp.ok) {
                showMessage(data.error || 'Failed to create exercise', 'error');
                return;
            }
            showMessage('Custom exercise created!', 'success');
            customExerciseForm.reset();
            customExerciseForm.style.display = 'none';
            showCustomExerciseFormBtn.style.display = 'inline-block';
            await selectCategory(currentCategoryId, currentCategoryName);
        } catch (err) {
            showMessage('Failed to create exercise', 'error');
        }
    };
}

function setActiveTab(tab) {
    [tabLogNew, tabTrack].forEach(btn => btn.classList.remove('active'));
    tab.classList.add('active');
}

function showMessage(msg, type = 'success') {
    let el = document.getElementById('workout-msg');
    if (!el) {
        el = document.createElement('div');
        el.id = 'workout-msg';
        el.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 12px;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            max-width: 300px;
            word-wrap: break-word;
        `;
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === 'success' ? 'rgba(40, 167, 69, 0.9)' : 'rgba(220, 53, 69, 0.9)';
    el.style.color = 'white';
    el.style.transform = 'translateX(0)';
    el.style.transition = 'transform 0.3s ease';
    
    setTimeout(() => { 
        el.style.transform = 'translateX(100%)';
        setTimeout(() => { el.remove(); }, 300);
    }, 3000);
}

async function loadSetsTable() {
    setsTableBody.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    try {
        const resp = await fetch(`/fitness/api/workouts_by_date?date=${today}`);
        const data = await resp.json();
        console.log('API Response:', data); // Debug log
        
        // Filter for this exercise
        const sets = data.filter(w => w.exercise === exerciseName);
        console.log('Filtered sets for exercise:', exerciseName, sets); // Debug log
        
        // Update sets count
        const setsCount = document.getElementById('sets-count');
        if (setsCount) {
            setsCount.textContent = `${sets.length} set${sets.length !== 1 ? 's' : ''}`;
        }
        
        // Populate sets table
        const setsTableBody = document.getElementById('sets-table').querySelector('tbody');
        setsTableBody.innerHTML = '';
        
        sets.forEach((set, idx) => {
            const row = document.createElement('tr');
            const totalWeight = calculateTotalWeight(set.weight);
            
            // Create weight display with barbell info
            let weightDisplay = `${set.weight} lbs`;
            if (isBarbellExercise) {
                weightDisplay = `
                    <div class="weight-breakdown">
                        <div class="user-weight">+${set.weight} lbs</div>
                        <div class="total-weight">${totalWeight} lbs</div>
                        <small class="barbell-note">(+45 barbell)</small>
                    </div>
                `;
            }
            
            row.innerHTML = `
                <td>
                    <div class="set-number">
                        ${idx + 1} ${set.prs_achieved && set.prs_achieved.length > 0 ? '🏆' : ''}
                    </div>
                </td>
                <td>${weightDisplay}</td>
                <td>${set.reps}</td>
                <td>
                    <div class="action-group">
                        <button class="action-btn edit" data-workout-id="${set.id}" data-weight="${set.weight}" data-reps="${set.reps}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                        </button>
                        <button class="action-btn delete" data-workout-id="${set.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </td>
            `;
            setsTableBody.appendChild(row);
        });
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', () => editSet(btn.dataset.workoutId, btn.dataset.weight, btn.dataset.reps));
        });
        
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteSet(btn.dataset.workoutId));
        });
        
        // Note: Default values are now set by loadLastWorkoutDefaults() function
    } catch (err) {
        console.error('Error loading sets:', err); // Debug log
        showMessage('Failed to load sets', 'error');
    }
}

async function editSet(workoutId, currentWeight, currentReps) {
    const newWeight = prompt(`Enter new weight (current: ${currentWeight} lbs):`, currentWeight);
    if (newWeight === null) return; // User cancelled
    
    const newReps = prompt(`Enter new reps (current: ${currentReps}):`, currentReps);
    if (newReps === null) return; // User cancelled
    
    try {
        const resp = await fetch(`/fitness/edit_workout/${workoutId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                weight: parseFloat(newWeight),
                reps: parseInt(newReps)
            })
        });
        
        const result = await resp.json();
        if (resp.ok) {
            let message = 'Set updated successfully!';
            
            // Check if any PRs were updated and play audio
            if (result.prs_updated && result.prs_updated.length > 0) {
                message += '\n🎉 PERSONAL RECORDS UPDATED:\n' + result.prs_updated.join('\n');
                handlePRAchievement(result.prs_updated, result.exercise);
            }
            
            showMessage(message);
            loadSetsTable();
            loadPersonalRecords();
        } else {
            showMessage(result.error || 'Failed to update set', 'error');
        }
    } catch (err) {
        showMessage('Error updating set', 'error');
    }
}

async function deleteSet(workoutId) {
    if (!confirm('Are you sure you want to delete this set? This action cannot be undone.')) {
        return;
    }
    
    try {
        const resp = await fetch(`/fitness/delete_workout/${workoutId}`, {
            method: 'DELETE'
        });
        
        const result = await resp.json();
        if (resp.ok) {
            showMessage('Set deleted successfully!');
            loadSetsTable();
            loadPersonalRecords();
        } else {
            showMessage(result.error || 'Failed to delete set', 'error');
        }
    } catch (err) {
        showMessage('Error deleting set', 'error');
    }
}

async function loadPersonalRecords() {
    try {
        const resp = await fetch(`/fitness/api/personal_records/${encodeURIComponent(exerciseName)}`);
        const prs = await resp.json();
        
        // Reset PR display
        document.getElementById('pr-highest-weight').textContent = '-';
        
        // Find the highest weight PR
        let highestWeight = 0;
        let highestWeightReps = 0;
        
        prs.forEach(pr => {
            if (pr.pr_type === 'weight' && pr.value > highestWeight) {
                highestWeight = pr.value;
                // Try to find the reps for this weight
                const weightPr = prs.find(p => p.pr_type === 'reps' && p.weight === pr.value);
                highestWeightReps = weightPr ? weightPr.value : 0;
            }
        });
        
        // Update PR display
        if (highestWeight > 0) {
            const displayText = highestWeightReps > 0 
                ? `${highestWeight} lbs (${highestWeightReps} reps)`
                : `${highestWeight} lbs`;
            document.getElementById('pr-highest-weight').textContent = displayText;
        } else {
            document.getElementById('pr-highest-weight').textContent = 'No PR yet';
        }
    } catch (err) {
        console.error('Failed to load personal records:', err);
    }
}

if (logSetForm) {
    logSetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(logSetForm);
        formData.append('exercise_category', categoryId);
        formData.append('exercise', exerciseName);
        formData.append('date', new Date().toISOString().split('T')[0]);
        
        // Save current weight and reps values
        const currentWeight = weightInput.value;
        const currentReps = repsInput.value;
        
        try {
            const resp = await fetch('/fitness/add_workout', {
                method: 'POST',
                body: formData
            });
            const result = await resp.json();
            if (resp.ok) {
                let message = 'Set added!';
                
                // Add barbell weight information to the success message
                if (isBarbellExercise) {
                    const userWeight = parseFloat(currentWeight) || 0;
                    const totalWeight = userWeight + STANDARD_BARBELL_WEIGHT;
                    message += `\n💪 ${userWeight} lbs added to barbell (${STANDARD_BARBELL_WEIGHT} lbs) = ${totalWeight} lbs total`;
                }
                
                // Check if any PRs were set and play audio
                if (result.prs_achieved && result.prs_achieved.length > 0) {
                    message += '\n🎉 NEW PERSONAL RECORDS:\n' + result.prs_achieved.join('\n');
                    handlePRAchievement(result.prs_achieved, result.exercise);
                }
                
                showMessage(message);
                // Reset form but keep the weight and reps values
                logSetForm.reset();
                weightInput.value = currentWeight;
                repsInput.value = currentReps;
                loadSetsTable();
                loadPersonalRecords();
            } else {
                showMessage(result.error || 'Failed to add set', 'error');
            }
        } catch (err) {
            showMessage('Error adding set', 'error');
        }
    });
}

if (weightMinus && weightInput) {
    weightMinus.addEventListener('click', () => {
        let val = parseFloat(weightInput.value) || 0;
        val = Math.max(0, val - 5);
        weightInput.value = val;
        updateTotalWeight();
    });
}
if (weightPlus && weightInput) {
    weightPlus.addEventListener('click', () => {
        let val = parseFloat(weightInput.value) || 0;
        val += 5;
        weightInput.value = val;
        updateTotalWeight();
    });
}
if (repsMinus && repsInput) {
    repsMinus.addEventListener('click', () => {
        let val = parseInt(repsInput.value) || 0;
        val = Math.max(0, val - 1);
        repsInput.value = val;
    });
}
if (repsPlus && repsInput) {
    repsPlus.addEventListener('click', () => {
        let val = parseInt(repsInput.value) || 0;
        val += 1;
        repsInput.value = val;
    });
}

// Add event listener for weight input changes
if (weightInput) {
    weightInput.addEventListener('input', updateTotalWeight);
}

// Initial load
loadSetsTable();
loadPersonalRecords();
checkIfBarbellExercise();
// Load defaults after a short delay to ensure exercise data is loaded
setTimeout(() => {
    loadLastWorkoutDefaults();
}, 500);

tabTrack.addEventListener('click', () => {
    setActiveTab(tabTrack);
    trackSection.style.display = '';
});

if (tabLogNew) {
    tabLogNew.addEventListener('click', () => {
        setActiveTab(tabLogNew);
        openWorkoutModalNewFlow();
    });
}
if (backToCategoryBtn) {
    backToCategoryBtn.addEventListener('click', () => {
        showStep('category');
    });
}
if (closeWorkoutModalBtn) {
    closeWorkoutModalBtn.addEventListener('click', () => { 
        // Reset custom exercise form if it's visible
        const customExerciseForm = document.getElementById('custom-exercise-form');
        const showCustomExerciseFormBtn = document.getElementById('show-custom-exercise-form');
        if (customExerciseForm && customExerciseForm.style.display !== 'none') {
            customExerciseForm.reset();
            customExerciseForm.style.display = 'none';
            if (showCustomExerciseFormBtn) {
                showCustomExerciseFormBtn.style.display = 'inline-block';
            }
        }
        
        if (workoutModal) {
            workoutModal.classList.remove('show');
            setTimeout(() => {
                workoutModal.style.display = 'none';
            }, 300);
        }
        resetWorkoutModal(); 
    });
}
if (cancelWorkoutBtn) {
    cancelWorkoutBtn.addEventListener('click', () => { 
        // Reset custom exercise form if it's visible
        const customExerciseForm = document.getElementById('custom-exercise-form');
        const showCustomExerciseFormBtn = document.getElementById('show-custom-exercise-form');
        if (customExerciseForm && customExerciseForm.style.display !== 'none') {
            customExerciseForm.reset();
            customExerciseForm.style.display = 'none';
            if (showCustomExerciseFormBtn) {
                showCustomExerciseFormBtn.style.display = 'inline-block';
            }
        }
        
        if (workoutModal) {
            workoutModal.classList.remove('show');
            setTimeout(() => {
                workoutModal.style.display = 'none';
            }, 300);
        }
        resetWorkoutModal(); 
    });
}
if (workoutModal) {
    workoutModal.addEventListener('click', function(e) {
        if (e.target === workoutModal || e.target.classList.contains('modal-overlay')) {
            // Reset custom exercise form if it's visible
            const customExerciseForm = document.getElementById('custom-exercise-form');
            const showCustomExerciseFormBtn = document.getElementById('show-custom-exercise-form');
            if (customExerciseForm && customExerciseForm.style.display !== 'none') {
                customExerciseForm.reset();
                customExerciseForm.style.display = 'none';
                if (showCustomExerciseFormBtn) {
                    showCustomExerciseFormBtn.style.display = 'inline-block';
                }
            }
            
            workoutModal.classList.remove('show');
            setTimeout(() => {
                workoutModal.style.display = 'none';
            }, 300);
            resetWorkoutModal();
        }
    });
}

// Check if this is a barbell exercise
async function checkIfBarbellExercise() {
    try {
        // Fetch all exercises for the category
        const response = await fetch(`/fitness/api/exercises/${categoryId}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`Failed to fetch exercise data: ${response.status} - ${errorText}`);
        }
        
        const exercises = await response.json();
        // Find the specific exercise by name
        const exercise = exercises.find(ex => ex.name === exerciseName);
        
        if (!exercise) {
            console.error(`Exercise "${exerciseName}" not found in category ${categoryId}`);
            showMessage(`Exercise "${exerciseName}" not found. Please try selecting it again from the exercise list.`, 'error');
            // Set default values to prevent further errors
            isBarbellExercise = false;
            exerciseEquipment = null;
            exerciseId = null;
            return;
        }
        
        isBarbellExercise = exercise.equipment && exercise.equipment.toLowerCase() === 'barbell';
        exerciseEquipment = exercise.equipment;
        exerciseId = exercise.id;
        
        console.log('Exercise loaded:', {
            name: exercise.name,
            id: exercise.id,
            equipment: exercise.equipment,
            isBarbell: isBarbellExercise
        });
        
        updateTotalWeight();
        updateFavoriteButton();
    } catch (error) {
        console.error('Error checking exercise equipment:', error);
        // Show user-friendly error message
        showMessage(`Failed to load exercise data: ${error.message}`, 'error');
        
        // Set default values to prevent further errors
        isBarbellExercise = false;
        exerciseEquipment = null;
        exerciseId = null;
    }
}

// Favorite exercise functionality

async function isExerciseFavorite() {
    try {
        // Fetch user's favorite exercises
        const response = await fetch('/fitness/api/favorites');
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`Failed to fetch favorite exercises: ${response.status} - ${errorText}`);
        }
        
        const favorites = await response.json();
        // Check if current exercise is in favorites using exercise ID
        return favorites.some(fav => fav.id === exerciseId);
    } catch (error) {
        console.error('Error checking favorite status:', error);
        return false;
    }
}

function updateFavoriteButton() {
    if (!favoriteExerciseBtn) return;
    
    // Don't try to update if exerciseId is not available yet
    if (!exerciseId) {
        console.log('Exercise ID not available yet, skipping favorite button update');
        // Show a subtle loading state
        favoriteExerciseBtn.style.opacity = '0.6';
        favoriteExerciseBtn.title = 'Loading...';
        return;
    }
    
    // Show loading state
    favoriteExerciseBtn.style.opacity = '0.8';
    favoriteExerciseBtn.disabled = true;
    
    isExerciseFavorite().then(isFavorite => {
        // Set the button's color (affects stroke due to currentColor)
        favoriteExerciseBtn.style.color = isFavorite ? '#ff4444' : '#666';
        
        // Update the SVG path
        const path = favoriteExerciseBtn.querySelector('svg path');
        if (path) {
            // Set stroke and fill colors
            path.style.stroke = isFavorite ? '#ff4444' : '#666';
            path.style.fill = isFavorite ? '#ff4444' : 'none';
        }
        
        // Update tooltip
        favoriteExerciseBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
        
        // Remove loading state
        favoriteExerciseBtn.style.opacity = '1';
        favoriteExerciseBtn.disabled = false;
        
        // Add animation class
        favoriteExerciseBtn.classList.add('favorite-animate');
        setTimeout(() => {
            favoriteExerciseBtn.classList.remove('favorite-animate');
        }, 300);
    }).catch(error => {
        console.error('Error updating favorite button:', error);
        // Set to default state on error
        favoriteExerciseBtn.style.color = '#666';
        favoriteExerciseBtn.style.opacity = '1';
        favoriteExerciseBtn.disabled = false;
        favoriteExerciseBtn.title = 'Error loading favorite status';
        
        const path = favoriteExerciseBtn.querySelector('svg path');
        if (path) {
            path.style.stroke = '#666';
            path.style.fill = 'none';
        }
    });
}

async function toggleFavorite() {
    if (!exerciseId) {
        showMessage('Exercise ID not found', 'error');
        return;
    }
    
    // Prevent multiple rapid clicks
    if (favoriteExerciseBtn.disabled) {
        return;
    }
    
    try {
        // Show loading state
        favoriteExerciseBtn.disabled = true;
        favoriteExerciseBtn.style.opacity = '0.6';
        favoriteExerciseBtn.title = 'Updating...';
        
        // Get current favorite status
        const isCurrentlyFavorite = await isExerciseFavorite();
        
        // Make the API call to toggle the favorite status
        const response = await fetch(`/fitness/api/exercise/${exerciseId}/favorite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to update favorite status');
        }
        
        // Update UI
        updateFavoriteButton();
        
        // Show appropriate success message based on current state
        const message = await response.json();
        showMessage(message.message || (isCurrentlyFavorite ? 'Exercise removed from favorites' : 'Exercise added to favorites'), 'success');
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showMessage(error.message || 'Failed to toggle favorite status', 'error');
        
        // Reset button state on error
        favoriteExerciseBtn.disabled = false;
        favoriteExerciseBtn.style.opacity = '1';
        favoriteExerciseBtn.title = 'Error occurred';
    }
}

// Update total weight display
function updateTotalWeight() {
    const weightInput = document.getElementById('weight');
    const totalWeightSpan = document.getElementById('total-weight');
    const barbellWeightSpan = document.getElementById('barbell-weight');
    const userWeightSpan = document.getElementById('user-weight');
    const totalWeightDisplay = document.getElementById('total-weight-display');
    
    if (weightInput && totalWeightSpan) {
        const userWeight = parseFloat(weightInput.value) || 0;
        const barbellWeight = isBarbellExercise ? STANDARD_BARBELL_WEIGHT : 0;
        const totalWeight = userWeight + barbellWeight;
        
        // Update all weight displays
        totalWeightSpan.textContent = totalWeight;
        barbellWeightSpan.textContent = barbellWeight;
        if (userWeightSpan) {
            userWeightSpan.textContent = userWeight;
        }
        
        // Show/hide total weight display based on whether it's a barbell exercise
        if (totalWeightDisplay) {
            if (isBarbellExercise) {
                totalWeightDisplay.style.display = 'block';
                // Add helpful tooltip
                totalWeightDisplay.title = `You're adding ${userWeight} lbs to the barbell (${barbellWeight} lbs). Total weight lifted: ${totalWeight} lbs.`;
            } else {
                totalWeightDisplay.style.display = 'none';
            }
        }
        
        // Update the weight input label to be clearer
        const weightLabel = document.querySelector('label[for="weight"]');
        if (weightLabel && isBarbellExercise) {
            weightLabel.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 3h12l4 6-10 13L2 9z"/>
                </svg>
                <div>
                    <div>Weight to Add (lbs)</div>
                    <small>Weight you're adding to the barbell</small>
                </div>
            `;
        } else if (weightLabel) {
            weightLabel.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 3h12l4 6-10 13L2 9z"/>
                </svg>
                <div>Weight (lbs)</div>
            `;
        }
    }
}

// Calculate total weight for display
function calculateTotalWeight(userWeight) {
    return isBarbellExercise ? (userWeight + STANDARD_BARBELL_WEIGHT) : userWeight;
} 

// Initialize the page
async function initializePage() {
    try {
        // Initialize audio for PR achievements
        initAudio();
        
        // Get the exercise name from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const exerciseName = urlParams.get('exercise');
        
        if (!exerciseName) {
            showMessage('Exercise not found', 'error');
            return;
        }
        
        // Set the exercise name in the main title
        const exerciseTitle = document.getElementById('exercise-title');
        if (exerciseTitle) {
            exerciseTitle.textContent = exerciseName;
        }
        
        // Note: updateFavoriteButton() is called in checkIfBarbellExercise() 
        // after exerciseId is set, so we don't call it here
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showMessage('Error loading exercise', 'error');
    }
}

initializePage();

async function loadLastWorkoutDefaults() {
    try {
        // Wait a bit to ensure exercise data is loaded
        if (!exerciseName) {
            console.log('Exercise name not available yet, skipping defaults');
            return;
        }
        
        // Fetch all workouts for this exercise, ordered by date (most recent first)
        const resp = await fetch(`/fitness/api/workouts`);
        const allWorkouts = await resp.json();
        
        // Filter for this exercise and sort by date (most recent first)
        const exerciseWorkouts = allWorkouts
            .filter(w => w.exercise === exerciseName)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (exerciseWorkouts.length > 0) {
            const lastWorkout = exerciseWorkouts[0]; // Most recent workout
            console.log('Setting defaults from last workout:', lastWorkout);
            
            // Set the default values
            if (weightInput) {
                weightInput.value = lastWorkout.weight;
            }
            if (repsInput) {
                repsInput.value = lastWorkout.reps;
            }
            
            // Update total weight display if it's a barbell exercise
            updateTotalWeight();
            
            console.log(`Default values set: ${lastWorkout.weight} lbs, ${lastWorkout.reps} reps`);
            
            // Show a subtle message that defaults were loaded
            const date = new Date(lastWorkout.date).toLocaleDateString();
            showMessage(`Loaded from last workout (${date}): ${lastWorkout.weight} lbs × ${lastWorkout.reps} reps`, 'success');
        } else {
            console.log('No previous workouts found for this exercise');
        }
    } catch (err) {
        console.error('Error loading last workout defaults:', err);
    }
}

// Rest Timer Functionality
let restTimerInterval = null;
let restTimerStartTime = null;
let restTimerElapsedTime = 0; // in seconds
let restTimerState = 'stopped'; // 'stopped', 'running', 'paused'

// DOM elements for timer
const restTimerDisplay = document.getElementById('rest-timer-display');
const startTimerBtn = document.getElementById('start-timer');
const pauseTimerBtn = document.getElementById('pause-timer');
const resetTimerBtn = document.getElementById('reset-timer');

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    if (restTimerDisplay) {
        restTimerDisplay.textContent = formatTime(restTimerElapsedTime);
        
        // Update display class based on state
        restTimerDisplay.className = 'timer-display';
        if (restTimerState === 'running') {
            restTimerDisplay.classList.add('running');
        } else if (restTimerState === 'paused') {
            restTimerDisplay.classList.add('paused');
        }
    }
}

function startRestTimer() {
    if (restTimerState === 'stopped') {
        // Starting from zero
        restTimerElapsedTime = 0;
        restTimerStartTime = Date.now();
    } else if (restTimerState === 'paused') {
        // Resuming from pause
        restTimerStartTime = Date.now() - (restTimerElapsedTime * 1000);
    }
    
    restTimerState = 'running';
    
    // Clear any existing interval
    if (restTimerInterval) {
        clearInterval(restTimerInterval);
    }
    
    // Start the timer interval
    restTimerInterval = setInterval(() => {
        restTimerElapsedTime = Math.floor((Date.now() - restTimerStartTime) / 1000);
        updateTimerDisplay();
    }, 1000);
    
    // Update button states
    updateTimerButtons();
    updateTimerDisplay();
}

function pauseRestTimer() {
    if (restTimerState === 'running') {
        restTimerState = 'paused';
        
        if (restTimerInterval) {
            clearInterval(restTimerInterval);
            restTimerInterval = null;
        }
        
        updateTimerButtons();
        updateTimerDisplay();
    }
}

function resetRestTimer() {
    restTimerState = 'stopped';
    restTimerElapsedTime = 0;
    restTimerStartTime = null;
    
    if (restTimerInterval) {
        clearInterval(restTimerInterval);
        restTimerInterval = null;
    }
    
    updateTimerButtons();
    updateTimerDisplay();
}

function updateTimerButtons() {
    if (startTimerBtn && pauseTimerBtn && resetTimerBtn) {
        if (restTimerState === 'stopped') {
            startTimerBtn.disabled = false;
            pauseTimerBtn.disabled = true;
            resetTimerBtn.disabled = false;
            startTimerBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                </svg>
                Start
            `;
        } else if (restTimerState === 'running') {
            startTimerBtn.disabled = true;
            pauseTimerBtn.disabled = false;
            resetTimerBtn.disabled = false;
        } else if (restTimerState === 'paused') {
            startTimerBtn.disabled = false;
            pauseTimerBtn.disabled = true;
            resetTimerBtn.disabled = false;
            startTimerBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                </svg>
                Resume
            `;
        }
    }
}

// Event listeners for timer buttons
if (startTimerBtn) {
    startTimerBtn.addEventListener('click', startRestTimer);
}

if (pauseTimerBtn) {
    pauseTimerBtn.addEventListener('click', pauseRestTimer);
}

if (resetTimerBtn) {
    resetTimerBtn.addEventListener('click', resetRestTimer);
}

// Initialize timer display and buttons
updateTimerDisplay();
updateTimerButtons();