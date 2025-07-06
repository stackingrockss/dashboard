const categoryId = getQueryParam('category_id');
const categoryName = getQueryParam('category_name');
let exerciseName = getQueryParam('exercise');

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

// Initialize audio using shared utility
prAudio = initAudio('/static/sounds/pr-achievement.mp3');

function playPRSound(type = 'pr') {
    playSound(prAudio, type);
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
            showSnack('Exercise data not loaded yet. Please wait a moment and try again.', 'error');
            return;
        }
        await toggleFavorite();
    });
}

// Progress steps
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

function setActiveTab(tab) {
    [tabLogNew, tabTrack].forEach(btn => btn.classList.remove('active'));
    tab.classList.add('active');
}

// Using showSnack from utils.js instead of custom showMessage

async function loadSetsTable() {
    setsTableBody.innerHTML = '';
    if (!exerciseName) {
        setsTableBody.innerHTML = `<tr><td colspan="5" style="color:#888; text-align:center;">Please select an exercise to view or log sets.</td></tr>`;
        const setsCount = document.getElementById('sets-count');
        if (setsCount) setsCount.textContent = '0 sets';
        return;
    }
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
        showSnack('Failed to load sets', 'error');
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
            
            showSnack(message, 'success');
            loadSetsTable();
            loadPersonalRecords();
        } else {
            showSnack(result.error || 'Failed to update set', 'error');
        }
    } catch (err) {
        showSnack('Error updating set', 'error');
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
                
                showSnack(message, 'success');
                // Reset form but keep the weight and reps values
                logSetForm.reset();
                weightInput.value = currentWeight;
                repsInput.value = currentReps;
                loadSetsTable();
                loadPersonalRecords();
            } else {
                showSnack(result.error || 'Failed to add set', 'error');
            }
        } catch (err) {
            showSnack('Error adding set', 'error');
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
            showSnack('Exercise not found', 'error');
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
        showSnack('Error loading exercise', 'error');
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
            showSnack(`Loaded from last workout (${date}): ${lastWorkout.weight} lbs × ${lastWorkout.reps} reps`, 'success');
        } else {
            console.log('No previous workouts found for this exercise');
        }
    } catch (err) {
        console.error('Error loading last workout defaults:', err);
    }
}

// Rest Timer Functionality - Using shared timerManager
const restTimerDisplay = document.getElementById('rest-timer-display');
const startTimerBtn = document.getElementById('start-timer');
const pauseTimerBtn = document.getElementById('pause-timer');
const resetTimerBtn = document.getElementById('reset-timer');

// --- Rest Timer State ---
let restDuration = 60; // default rest duration in seconds
let restTimeLeft = restDuration;
let restIntervalActive = false;

function updateRestTimerDisplay() {
    if (restTimerDisplay) {
        restTimerDisplay.textContent = formatTime(restTimeLeft);
    }
}

function startRestTimer() {
    if (restIntervalActive) return; // Prevent multiple intervals
    restIntervalActive = true;
    timerManager.setInterval('rest-timer-tick', () => {
        if (restTimeLeft > 0) {
            restTimeLeft--;
            updateRestTimerDisplay();
            if (restTimeLeft === 0) {
                showSnack('⏰ Rest timer completed!', 'success');
                pauseRestTimer();
            }
        }
    }, 1000);
}

function pauseRestTimer() {
    restIntervalActive = false;
    timerManager.clearInterval('rest-timer-tick');
}

function resetRestTimer() {
    pauseRestTimer();
    restTimeLeft = restDuration;
    updateRestTimerDisplay();
}

if (startTimerBtn) {
    startTimerBtn.addEventListener('click', startRestTimer);
}
if (pauseTimerBtn) {
    pauseTimerBtn.addEventListener('click', pauseRestTimer);
}
if (resetTimerBtn) {
    resetTimerBtn.addEventListener('click', resetRestTimer);
}

// Initialize timer display
updateRestTimerDisplay();

// --- SESSION MODE LOGIC ---
const SESSION_MODE = typeof window.SESSION_MODE !== 'undefined' ? window.SESSION_MODE : false;
const SESSION_ID = typeof window.SESSION_ID !== 'undefined' ? window.SESSION_ID : null;
const TEMPLATE_ID = typeof window.TEMPLATE_ID !== 'undefined' ? window.TEMPLATE_ID : null;

// Session state variables
let currentSession = null;
let currentExerciseIndex = 0;
let currentExercise = null;
let exerciseSets = [];

if (SESSION_MODE && SESSION_ID) {
    // Hide manual entry UI
    document.querySelector('.workout-container').style.display = 'none';
    // Show session UI
    document.getElementById('session-ui').style.display = 'block';
    // Load and render session
    loadAndRenderSession(SESSION_ID);
}

async function loadAndRenderSession(sessionId) {
    try {
        const resp = await fetch(`/fitness/api/workout_sessions/${sessionId}`);
        if (!resp.ok) throw new Error('Failed to load session');
        
        const session = await resp.json();
        console.log('Loaded session data:', session);
        
        if (!session.exercises || session.exercises.length === 0) {
            console.error('Session has no exercises');
            showSnack('Session has no exercises. Please check your template.', 'error');
            return;
        }
        
        currentSession = session;
        renderSessionUI(session);
        setupSessionEventListeners();
        
        // Load the first exercise
        await loadCurrentExercise();
        
    } catch (err) {
        console.error('Error loading session:', err);
        showSnack('Error loading session: ' + err.message, 'error');
    }
}

function renderSessionUI(session) {
    const container = document.getElementById('session-ui');

    // Defensive check for exercises
    if (!Array.isArray(session.exercises) || session.exercises.length === 0) {
        container.innerHTML = `<div style='color:red; padding:1em;'>No exercises found for this session. Please check your workout template or contact support.</div>`;
        return;
    }

    let html = `
        <div class='workout-session-container'>
            <div class='session-header'>
                <div class='session-title'>${session.name}</div>
                <div class='session-info'>Date: ${session.date} | Status: ${session.status}</div>
            </div>
            
            <div class='exercise-progress'>
                <div class='progress-bar'>
                    <div class='progress-fill' style='width: ${(currentExerciseIndex / session.exercises.length) * 100}%'></div>
                </div>
                <div class='progress-text'>Exercise ${currentExerciseIndex + 1} of ${session.exercises.length}</div>
            </div>
            
            <div class='exercise-navigation'>
                <button id='prev-exercise' class='btn btn-secondary' ${currentExerciseIndex === 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <button id='next-exercise' class='btn btn-secondary' ${currentExerciseIndex === session.exercises.length - 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
            
            <div id='current-exercise-display'></div>
            
            <div id='set-logging-section' style='display: none;'>
                <div class='set-logging-header'>
                    <h3>Log Sets for <span id='current-exercise-name'></span></h3>
                </div>
                
                <div class='set-logging-form'>
                    <div class='form-group'>
                        <label for='session-weight'>Weight (lbs)</label>
                        <div class='input-group'>
                            <button type='button' id='session-weight-minus' class='btn btn-sm'>-</button>
                            <input type='number' id='session-weight' class='form-control' min='0' step='0.5'>
                            <button type='button' id='session-weight-plus' class='btn btn-sm'>+</button>
                        </div>
                    </div>
                    
                    <div class='form-group'>
                        <label for='session-reps'>Reps</label>
                        <div class='input-group'>
                            <button type='button' id='session-reps-minus' class='btn btn-sm'>-</button>
                            <input type='number' id='session-reps' class='form-control' min='1' max='100'>
                            <button type='button' id='session-reps-plus' class='btn btn-sm'>+</button>
                        </div>
                    </div>
                    
                    <button id='log-set-btn' class='btn btn-primary'>Log Set</button>
                </div>
                
                <div id='session-sets-table'>
                    <table class='table'>
                        <thead>
                            <tr>
                                <th>Set</th>
                                <th>Weight</th>
                                <th>Reps</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id='session-sets-tbody'></tbody>
                    </table>
                </div>
            </div>
            
            <div class='session-actions'>
                <button id='complete-workout-btn' class='btn btn-success' style='display: none;'>
                    Complete Workout
                </button>
                <button id='cancel-workout-btn' class='btn btn-danger'>
                    Cancel Workout
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Add event listeners
    setupSessionEventListeners();
    
    // Load first exercise
    if (session.exercises.length > 0) {
        loadCurrentExercise();
    }
}

function setupSessionEventListeners() {
    // Navigation buttons
    document.getElementById('prev-exercise').addEventListener('click', () => {
        if (currentExerciseIndex > 0) {
            currentExerciseIndex--;
            loadCurrentExercise();
        }
    });
    
    document.getElementById('next-exercise').addEventListener('click', () => {
        if (currentExerciseIndex < currentSession.exercises.length - 1) {
            currentExerciseIndex++;
            loadCurrentExercise();
        }
    });
    
    // Set logging form
    const weightInput = document.getElementById('session-weight');
    const repsInput = document.getElementById('session-reps');
    const weightMinus = document.getElementById('session-weight-minus');
    const weightPlus = document.getElementById('session-weight-plus');
    const repsMinus = document.getElementById('session-reps-minus');
    const repsPlus = document.getElementById('session-reps-plus');
    const logSetBtn = document.getElementById('log-set-btn');
    
    // Plus/minus buttons
    weightMinus.addEventListener('click', () => {
        weightInput.value = Math.max(0, parseInt(weightInput.value || 0) - 5);
    });
    weightPlus.addEventListener('click', () => {
        weightInput.value = parseInt(weightInput.value || 0) + 5;
    });
    repsMinus.addEventListener('click', () => {
        repsInput.value = Math.max(1, parseInt(repsInput.value || 0) - 1);
    });
    repsPlus.addEventListener('click', () => {
        repsInput.value = parseInt(repsInput.value || 0) + 1;
    });
    
    // Log set button
    logSetBtn.addEventListener('click', logSetForSession);
    
    // Complete workout button
    document.getElementById('complete-workout-btn').addEventListener('click', completeWorkout);
    
    // Cancel workout button
    document.getElementById('cancel-workout-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel this workout? All logged sets will be lost.')) {
            window.location.href = '/';
        }
    });
}

async function loadCurrentExercise() {
    if (!currentSession || currentExerciseIndex >= currentSession.exercises.length) {
        return;
    }
    
    currentExercise = currentSession.exercises[currentExerciseIndex];
    console.log('Loading current exercise:', currentExercise);
    
    // Set global exerciseName for session mode
    exerciseName = currentExercise.exercise_name;
    
    // Update exercise display
    const exerciseDisplay = document.getElementById('current-exercise-display');
    const exerciseNameSpan = document.getElementById('current-exercise-name');
    
    exerciseDisplay.innerHTML = `
        <div class='current-exercise'>
            <h2>${currentExercise.exercise_name}</h2>
            <p class='exercise-order'>Exercise ${currentExerciseIndex + 1} of ${currentSession.exercises.length}</p>
        </div>
    `;
    
    if (exerciseNameSpan) {
        exerciseNameSpan.textContent = currentExercise.exercise_name;
    }
    
    // Show set logging section
    const setLoggingSection = document.getElementById('set-logging-section');
    if (setLoggingSection) setLoggingSection.style.display = 'block';
    
    // Update navigation buttons
    document.getElementById('prev-exercise').disabled = currentExerciseIndex === 0;
    document.getElementById('next-exercise').disabled = currentExerciseIndex === currentSession.exercises.length - 1;
    
    // Update progress bar
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (currentExerciseIndex === currentSession.exercises.length - 1) {
        // Last exercise - show complete button
        document.getElementById('complete-workout-btn').style.display = 'block';
    } else {
        document.getElementById('complete-workout-btn').style.display = 'none';
    }
    
    if (progressFill) {
        progressFill.style.width = `${(currentExerciseIndex / currentSession.exercises.length) * 100}%`;
    }
    if (progressText) {
        progressText.textContent = `Exercise ${currentExerciseIndex + 1} of ${currentSession.exercises.length}`;
    }
    
    // Load sets for this exercise
    await loadExerciseSets();
}

async function loadExerciseSets() {
    try {
        const resp = await fetch(`/fitness/api/exercise_sets?exercise_id=${currentExercise.id}&session_id=${SESSION_ID}`);
        if (!resp.ok) throw new Error('Failed to load sets');
        exerciseSets = await resp.json();
        renderExerciseSets();
    } catch (err) {
        console.error('Error loading exercise sets:', err);
        exerciseSets = [];
        renderExerciseSets();
    }
}

function renderExerciseSets() {
    const tbody = document.getElementById('session-sets-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    exerciseSets.forEach((set, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${set.weight} lbs</td>
            <td>${set.reps}</td>
            <td>
                <button class='btn btn-sm btn-danger' onclick='deleteSessionSet(${set.id})'>Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function logSetForSession() {
    const weightInput = document.getElementById('session-weight');
    const repsInput = document.getElementById('session-reps');
    
    const weight = parseFloat(weightInput.value);
    const reps = parseInt(repsInput.value);
    
    if (!weight || !reps) {
        showSnack('Please enter both weight and reps', 'error');
        return;
    }
    
    // Check if currentExercise is available
    if (!currentExercise) {
        console.error('currentExercise is not set');
        showSnack('No exercise selected. Please refresh the page.', 'error');
        return;
    }
    
    const payload = {
        session_id: SESSION_ID,
        exercise_id: currentExercise.id,
        category_id: currentExercise.category_id || '',
        exercise: currentExercise.exercise_name,
        weight: weight,
        reps: reps
    };
    console.log('Logging set payload:', payload); // DEBUG LOG
    
    try {
        const resp = await fetch('/fitness/api/log_set', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!resp.ok) {
            const error = await resp.json();
            throw new Error(error.error || 'Failed to log set');
        }
        
        // Clear form
        weightInput.value = '';
        repsInput.value = '';
        
        // Reload sets
        await loadExerciseSets();
        
        showSnack('Set logged successfully!', 'success');
        
    } catch (err) {
        console.error('Error logging set:', err);
        showSnack('Error logging set: ' + err.message, 'error');
    }
}

async function deleteSessionSet(setId) {
    if (!confirm('Are you sure you want to delete this set?')) {
        return;
    }
    
    try {
        const resp = await fetch(`/fitness/api/sets/${setId}`, {
            method: 'DELETE'
        });
        
        if (!resp.ok) throw new Error('Failed to delete set');
        
        await loadExerciseSets();
        showSnack('Set deleted successfully!', 'success');
        
    } catch (err) {
        console.error('Error deleting set:', err);
        showSnack('Error deleting set', 'error');
    }
}

async function completeWorkout() {
    if (!confirm('Are you sure you want to complete this workout?')) {
        return;
    }
    
    try {
        const resp = await fetch(`/fitness/api/workout_sessions/${SESSION_ID}/complete`, {
            method: 'PUT'
        });
        
        if (!resp.ok) throw new Error('Failed to complete workout');
        
        showSnack('Workout completed successfully!', 'success');
        
        // Redirect back to dashboard
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
        
    } catch (err) {
        console.error('Error completing workout:', err);
        showSnack('Error completing workout', 'error');
    }
}

// Make deleteSessionSet available globally
window.deleteSessionSet = deleteSessionSet;