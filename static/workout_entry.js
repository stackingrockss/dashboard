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
        
        // Update table header to include Total Weight
        const setsTableHead = document.getElementById('sets-table').querySelector('thead tr');
        if (setsTableHead && setsTableHead.children.length < 5) {
            setsTableHead.innerHTML = `
                <th>Set</th>
                <th>Weight</th>
                <th>Total Weight</th>
                <th>Reps</th>
                <th>Actions</th>
            `;
        }
        
        sets.forEach((set, idx) => {
            const row = document.createElement('tr');
            // Use total_weight from backend if available, else calculate
            let totalWeight = set.total_weight !== undefined ? set.total_weight : calculateTotalWeight(set.weight);
            row.innerHTML = `
                <td>
                    <div class="set-number">
                        ${idx + 1} ${set.prs_achieved && set.prs_achieved.length > 0 ? '🏆' : ''}
                    </div>
                </td>
                <td>${set.weight} lbs</td>
                <td>${totalWeight} lbs</td>
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

// Rest Timer Functionality - Using shared timerManager
const restTimerDisplay = document.getElementById('rest-timer-display');
const startTimerBtn = document.getElementById('start-timer');
const pauseTimerBtn = document.getElementById('pause-timer');
const resetTimerBtn = document.getElementById('reset-timer');

// --- Rest Timer State ---
let restDuration = 60; // default rest duration in seconds
let restTimeLeft = restDuration;
let restIntervalActive = false;

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
} else {
    // Only run initial load for manual mode
    loadSetsTable();
    loadPersonalRecords();
    // Load defaults after a short delay to ensure exercise data is loaded
    setTimeout(() => {
        loadLastWorkoutDefaults();
    }, 500);
}

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
            <!-- Modern Header -->
            <header class='workout-header'>
                <div class='header-content'>
                    <div class='header-left'>
                        <a href="/#activity?tab=workouts" class='back-btn'>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            Back
                        </a>
                    </div>
                    <div class='header-center'>
                        <h1 class='page-title'>${session.name}</h1>
                        <p class='session-info'>Date: ${session.date} | Status: ${session.status}</p>
                    </div>
                </div>
            </header>

            <!-- Progress Bar -->
            <div class='exercise-progress'>
                <div class='progress-bar'>
                    <div class='progress-fill' style='width: ${(currentExerciseIndex / session.exercises.length) * 100}%'></div>
                </div>
                <div class='progress-text'>Exercise ${currentExerciseIndex + 1} of ${session.exercises.length}</div>
            </div>
            
            <!-- Exercise Navigation -->
            <div class='exercise-navigation'>
                <button id='prev-exercise' class='btn btn-secondary' ${currentExerciseIndex === 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <button id='next-exercise' class='btn btn-secondary' ${currentExerciseIndex === session.exercises.length - 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
            
            <div id='current-exercise-display'></div>
            
            <!-- Main Content -->
            <main class='workout-main'>
                <div class='content-grid'>
                    <!-- Left Column: Log Set Form -->
                    <div class='form-column'>
                        <div class='form-card'>
                            <div class='card-header'>
                                <h2 class='card-title'>Log New Set</h2>
                                <p class='card-subtitle'>Add your latest set to track progress</p>
                            </div>
                            
                            <div id='set-logging-section' style='display: none;'>
                                <form id='session-log-set-form' class='modern-form'>
                                    <div class='form-row'>
                                        <div class='form-group'>
                                            <label for='session-weight' class='form-label'>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M6 3h12l4 6-10 13L2 9z"/>
                                                </svg>
                                                Weight (lbs)
                                            </label>
                                            <div class='input-group'>
                                                <button type='button' class='input-btn minus' id='session-weight-minus' aria-label='Decrease weight'>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M5 12h14"/>
                                                    </svg>
                                                </button>
                                                <input type='number' id='session-weight' name='weight' step='0.1' required class='form-input'>
                                                <button type='button' class='input-btn plus' id='session-weight-plus' aria-label='Increase weight'>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M12 5v14M5 12h14"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div class='form-group'>
                                            <label for='session-reps' class='form-label'>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                                                </svg>
                                                Reps
                                            </label>
                                            <div class='input-group'>
                                                <button type='button' class='input-btn minus' id='session-reps-minus' aria-label='Decrease reps'>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M5 12h14"/>
                                                    </svg>
                                                </button>
                                                <input type='number' id='session-reps' name='reps' required class='form-input'>
                                                <button type='button' class='input-btn plus' id='session-reps-plus' aria-label='Increase reps'>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M12 5v14M5 12h14"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Total Weight Display for Barbell Exercises -->
                                    <div id='session-total-weight-display' class='form-group' style='display: none;'>
                                        <label class='form-label'>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                            </svg>
                                            Total Weight (including barbell)
                                        </label>
                                        <div class='total-weight-value' id='session-total-weight-value' style="
                                            background: #f8f9fa;
                                            padding: 12px 16px;
                                            border-radius: 8px;
                                            font-size: 18px;
                                            font-weight: bold;
                                            color: #007bff;
                                            text-align: center;
                                            border: 2px solid #e9ecef;
                                        ">
                                            <span id='session-user-weight'>0</span> + <span id='session-barbell-weight'>45</span> = <span id='session-total-weight'>45</span> lbs
                                        </div>
                                    </div>
                                    
                                    <button type='button' id='log-set-btn' class='submit-btn'>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M12 5v14M5 12h14"/>
                                        </svg>
                                        Add Set
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Sets -->
                    <div class='stats-column'>
                        <!-- Personal Record Summary -->
                        <div class='pr-summary'>
                            <span>🏆 Personal Record: <span id='pr-highest-weight'>-</span></span>
                        </div>
                        
                        <!-- Rest Timer Section -->
                        <div class='rest-timer-card'>
                            <div class='card-header'>
                                <h3 class='card-title'>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    Rest Timer
                                </h3>
                                <div class='timer-status' id='session-timer-status'>Ready</div>
                            </div>
                            
                            <div class='timer-display-container'>
                                <div class='timer-display' id='session-rest-timer-display'>00:00</div>
                                <div class='timer-progress'>
                                    <div class='progress-bar'>
                                        <div class='progress-fill' id='session-timer-progress-fill'></div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Preset Rest Times -->
                            <div class='preset-times'>
                                <div class='preset-label'>Quick Start:</div>
                                <div class='preset-buttons'>
                                    <button class='preset-btn' data-time='60'>1 min</button>
                                    <button class='preset-btn' data-time='90'>1:30</button>
                                    <button class='preset-btn' data-time='120'>2 min</button>
                                    <button class='preset-btn' data-time='180'>3 min</button>
                                    <button class='preset-btn' data-time='300'>5 min</button>
                                </div>
                            </div>
                            
                            <div class='timer-controls'>
                                <button id='session-start-timer' class='timer-btn start'>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polygon points="5,3 19,12 5,21"/>
                                    </svg>
                                    Start
                                </button>
                                <button id='session-pause-timer' class='timer-btn pause' disabled>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="6" y="4" width="4" height="16"/>
                                        <rect x="14" y="4" width="4" height="16"/>
                                    </svg>
                                    Pause
                                </button>
                                <button id='session-reset-timer' class='timer-btn reset'>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="1,4 1,10 7,10"/>
                                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                                    </svg>
                                    Reset
                                </button>
                            </div>
                            
                            <!-- Custom Time Input -->
                            <div class='custom-time-section'>
                                <div class='custom-time-input'>
                                    <input type='number' id='session-custom-minutes' placeholder='0' min='0' max='59'>
                                    <span class='time-separator'>:</span>
                                    <input type='number' id='session-custom-seconds' placeholder='00' min='0' max='59'>
                                    <button id='session-set-custom-time' class='set-time-btn'>Set</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Today's Sets Card -->
                        <div class='sets-card'>
                            <div class='card-header'>
                                <h3 class='card-title'>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                                    </svg>
                                    Today's Sets
                                </h3>
                                <span class='sets-count' id='session-sets-count'>0 sets</span>
                            </div>
                            <div class='sets-table-container'>
                                <div class='table-container'>
                                    <table id='session-sets-table' class='modern-table'>
                                        <thead>
                                            <tr>
                                                <th>Set</th>
                                                <th>Weight</th>
                                                <th>Total Weight</th>
                                                <th>Reps</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id='session-sets-tbody'></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            <!-- Session Actions -->
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
    
    // Load personal records for the current exercise
    loadPersonalRecords();
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
        weightInput.value = Math.max(0, parseFloat(weightInput.value || 0) - 5);
    });
    weightPlus.addEventListener('click', () => {
        weightInput.value = parseFloat(weightInput.value || 0) + 5;
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
    
    // Barbell logic and total weight calculation
    weightInput.addEventListener('input', updateSessionTotalWeight);
    repsInput.addEventListener('input', updateSessionTotalWeight);
    
    // Rest timer functionality
    setupSessionRestTimer();
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
    
    // Load personal records for the new exercise
    loadPersonalRecords();
    
    // Load exercise sets
    await loadExerciseSets();
    
    // Load default values from last workout
    await loadSessionDefaults();
}

async function loadExerciseSets() {
    try {
        console.log('Loading exercise sets for:', {
            exercise_id: currentExercise.exercise_id,
            session_id: SESSION_ID,
            exercise_name: currentExercise.exercise_name
        });
        
        const resp = await fetch(`/fitness/api/exercise_sets?exercise_id=${currentExercise.exercise_id}&session_id=${SESSION_ID}&exercise_name=${encodeURIComponent(currentExercise.exercise_name)}`);
        if (!resp.ok) throw new Error('Failed to load sets');
        exerciseSets = await resp.json();
        console.log('Loaded exercise sets:', exerciseSets);
        renderExerciseSets();
    } catch (err) {
        console.error('Error loading exercise sets:', err);
        exerciseSets = [];
        renderExerciseSets();
    }
}

function renderExerciseSets() {
    const tbody = document.getElementById('session-sets-tbody');
    const setsCount = document.getElementById('session-sets-count');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    exerciseSets.forEach((set, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${set.weight} lbs</td>
            <td>${set.total_weight} lbs</td>
            <td>${set.reps}</td>
            <td>
                <button class='btn btn-sm btn-danger' onclick='deleteSessionSet(${set.id})'>Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Update sets count
    if (setsCount) {
        setsCount.textContent = `${exerciseSets.length} set${exerciseSets.length !== 1 ? 's' : ''}`;
    }
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
        category_id: currentExercise.category_id || null,
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
        
        const result = await resp.json();
        
        // Clear form
        weightInput.value = '';
        repsInput.value = '';
        
        // Reload sets
        await loadExerciseSets();
        
        // Show PR achievements if present in backend response
        let message = 'Set logged successfully!';
        if (result.prs_achieved && result.prs_achieved.length > 0) {
            message += '\n🎉 NEW PERSONAL RECORDS:\n' + result.prs_achieved.join('\n');
            handlePRAchievement(result.prs_achieved, currentExercise.exercise_name);
        }
        showSnack(message, 'success');
        
        // Optionally, still check for PRs in frontend for extra safety (can be removed if not needed)
        // await checkPRAchievements(weight, reps);
        
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

// Personal Records functionality for session mode
async function loadPersonalRecords() {
    // Only load PRs if we're in session mode and currentExercise is available
    if (!currentExercise || !SESSION_MODE) return;
    
    try {
        const resp = await fetch(`/fitness/api/personal_records/${currentExercise.exercise_name}`);
        const prElement = document.getElementById('pr-highest-weight');
        if (resp.status === 404) {
            if (prElement) {
                prElement.textContent = 'No PR yet';
                prElement.style.color = '#6c757d';
                prElement.style.fontWeight = 'normal';
            }
            console.warn('No personal records found for this exercise.');
            return;
        }
        if (!resp.ok) throw new Error('Failed to load PRs');
        const prs = await resp.json();
        // prs is an array of PR objects
        let weightPR = prs.find(pr => pr.pr_type === 'weight');
        let repsPR = prs.find(pr => pr.pr_type === 'reps');
        if (prElement && weightPR) {
            prElement.textContent = `${weightPR.value} lbs`;
            prElement.style.color = '#007bff';
            prElement.style.fontWeight = 'bold';
        } else if (prElement) {
            prElement.textContent = 'No PR yet';
            prElement.style.color = '#6c757d';
            prElement.style.fontWeight = 'normal';
        }
        // Optionally, you could display reps PR elsewhere if desired
    } catch (err) {
        console.error('Error loading personal records:', err);
    }
}

// Barbell logic for session mode
function updateSessionTotalWeight() {
    const weightInput = document.getElementById('session-weight');
    const totalWeightDisplay = document.getElementById('session-total-weight-display');
    const userWeightSpan = document.getElementById('session-user-weight');
    const barbellWeightSpan = document.getElementById('session-barbell-weight');
    const totalWeightSpan = document.getElementById('session-total-weight');
    
    if (!weightInput || !totalWeightDisplay) return;
    
    const userWeight = parseFloat(weightInput.value) || 0;
    const barbellWeight = 45; // Standard barbell weight
    
    // Check if this is a barbell exercise
    const isBarbell = checkIfBarbellExercise(currentExercise?.exercise_name);
    
    if (isBarbell && userWeight > 0) {
        totalWeightDisplay.style.display = 'block';
        const totalWeight = userWeight + barbellWeight;
        
        if (userWeightSpan) userWeightSpan.textContent = userWeight;
        if (barbellWeightSpan) barbellWeightSpan.textContent = barbellWeight;
        if (totalWeightSpan) totalWeightSpan.textContent = totalWeight;
    } else {
        totalWeightDisplay.style.display = 'none';
    }
}

function checkIfBarbellExercise(exerciseName) {
    if (!exerciseName) return false;
    
    const barbellExercises = [
        'bench press', 'squat', 'deadlift', 'overhead press', 'barbell row',
        'barbell curl', 'barbell tricep extension', 'barbell shoulder press',
        'barbell bench press', 'barbell squat', 'barbell deadlift'
    ];
    
    return barbellExercises.some(exercise => 
        exerciseName.toLowerCase().includes(exercise.toLowerCase())
    );
}

// Load default values from last workout for session mode
async function loadSessionDefaults() {
    if (!currentExercise || !SESSION_MODE) return;
    
    try {
        const resp = await fetch(`/fitness/api/last_workout/${currentExercise.exercise_name}`);
        
        if (resp.status === 404) {
            // No previous workout found - this is normal for new exercises
            console.log(`No previous workout found for ${currentExercise.exercise_name}`);
            return;
        }
        
        if (!resp.ok) {
            console.error('Failed to load defaults:', resp.status, resp.statusText);
            return;
        }
        
        const lastWorkout = await resp.json();
        console.log('Setting defaults from last workout:', lastWorkout);
        
        if (lastWorkout.weight && lastWorkout.reps) {
            const weightInput = document.getElementById('session-weight');
            const repsInput = document.getElementById('session-reps');
            
            if (weightInput) weightInput.value = lastWorkout.weight;
            if (repsInput) repsInput.value = lastWorkout.reps;
            
            console.log(`Default values set: ${lastWorkout.weight} lbs, ${lastWorkout.reps} reps`);
            
            // Update total weight display if it's a barbell exercise
            updateSessionTotalWeight();
        }
    } catch (err) {
        console.error('Error loading session defaults:', err);
    }
}

// Check for PR achievements in session mode
async function checkPRAchievements(weight, reps) {
    if (!currentExercise || !SESSION_MODE) return;
    
    try {
        const resp = await fetch(`/fitness/api/personal_records/${currentExercise.exercise_name}`);
        if (!resp.ok) throw new Error('Failed to load PRs');
        
        const prs = await resp.json();
        const prsAchieved = [];
        
        // Check for weight PR
        if (prs.highest_weight && weight > prs.highest_weight) {
            prsAchieved.push('weight');
        }
        
        // Check for reps PR
        if (prs.highest_reps && reps > prs.highest_reps) {
            prsAchieved.push('reps');
        }
        
        // Check for total weight PR (for barbell exercises)
        if (checkIfBarbellExercise(currentExercise.exercise_name)) {
            const totalWeight = weight + 45; // Include barbell weight
            if (prs.highest_total_weight && totalWeight > prs.highest_total_weight) {
                prsAchieved.push('total_weight');
            }
        }
        
        if (prsAchieved.length > 0) {
            handlePRAchievement(prsAchieved, currentExercise.exercise_name);
        }
        
    } catch (err) {
        console.error('Error checking PR achievements:', err);
    }
}

// Rest timer functionality for session mode
let sessionTimerInterval;
let sessionTimerTime = 0;
let sessionTimerRunning = false;

function setupSessionRestTimer() {
    const startBtn = document.getElementById('session-start-timer');
    const pauseBtn = document.getElementById('session-pause-timer');
    const resetBtn = document.getElementById('session-reset-timer');
    const setCustomBtn = document.getElementById('session-set-custom-time');
    const presetBtns = document.querySelectorAll('.preset-btn');
    
    if (startBtn) startBtn.addEventListener('click', startSessionTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseSessionTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetSessionTimer);
    if (setCustomBtn) setCustomBtn.addEventListener('click', setSessionCustomTime);
    
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const time = parseInt(btn.dataset.time);
            setSessionTimerTime(time);
        });
    });
}

function startSessionTimer() {
    if (sessionTimerTime <= 0) return;
    
    sessionTimerRunning = true;
    document.getElementById('session-start-timer').disabled = true;
    document.getElementById('session-pause-timer').disabled = false;
    document.getElementById('session-timer-status').textContent = 'Running';
    
    sessionTimerInterval = setInterval(() => {
        sessionTimerTime--;
        updateSessionTimerDisplay();
        
        if (sessionTimerTime <= 0) {
            clearInterval(sessionTimerInterval);
            sessionTimerRunning = false;
            document.getElementById('session-start-timer').disabled = false;
            document.getElementById('session-pause-timer').disabled = true;
            document.getElementById('session-timer-status').textContent = 'Complete';
            
            // Play notification sound
            playTimerCompleteSound();
        }
    }, 1000);
}

function pauseSessionTimer() {
    if (!sessionTimerRunning) return;
    
    clearInterval(sessionTimerInterval);
    sessionTimerRunning = false;
    document.getElementById('session-start-timer').disabled = false;
    document.getElementById('session-pause-timer').disabled = true;
    document.getElementById('session-timer-status').textContent = 'Paused';
}

function resetSessionTimer() {
    clearInterval(sessionTimerInterval);
    sessionTimerRunning = false;
    sessionTimerTime = 0;
    document.getElementById('session-start-timer').disabled = true;
    document.getElementById('session-pause-timer').disabled = true;
    document.getElementById('session-timer-status').textContent = 'Ready';
    updateSessionTimerDisplay();
}

function setSessionCustomTime() {
    const minutes = parseInt(document.getElementById('session-custom-minutes').value) || 0;
    const seconds = parseInt(document.getElementById('session-custom-seconds').value) || 0;
    const totalSeconds = minutes * 60 + seconds;
    
    if (totalSeconds > 0) {
        setSessionTimerTime(totalSeconds);
    }
}

function setSessionTimerTime(seconds) {
    sessionTimerTime = seconds;
    updateSessionTimerDisplay();
    document.getElementById('session-start-timer').disabled = false;
    document.getElementById('session-timer-status').textContent = 'Ready';
}

function updateSessionTimerDisplay() {
    const minutes = Math.floor(sessionTimerTime / 60);
    const seconds = sessionTimerTime % 60;
    const display = document.getElementById('session-rest-timer-display');
    const progressFill = document.getElementById('session-timer-progress-fill');
    
    if (display) {
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (progressFill) {
        const progress = sessionTimerTime > 0 ? (sessionTimerTime / (sessionTimerTime + 1)) * 100 : 0;
        progressFill.style.width = `${progress}%`;
    }
}

function playTimerCompleteSound() {
    // Play a notification sound when timer completes
    const audio = new Audio('/static/sounds/timer-complete.mp3');
    audio.play().catch(err => console.log('Could not play timer sound:', err));
}