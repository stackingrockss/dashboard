// --- Workouts/Exercise Logic ---
// (Moved from fitness.js and workout_entry.js)
// This file now includes all workout entry logic as well.

// Simple notification function (replaces showSnack)
function showSnack(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    // You can replace this with a more sophisticated notification system if needed
    alert(message);
}

// Simple message function (replaces showMessage)
function showMessage(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    alert(message);
}

// Check if exercise is a barbell exercise
async function checkIfBarbellExercise() {
    console.log('checkIfBarbellExercise called with:', { categoryId, exerciseName });
    if (!categoryId || !exerciseName) {
        console.log('Missing categoryId or exerciseName, returning early');
        return;
    }
    
    try {
        console.log('Fetching exercises for category:', categoryId);
        const response = await fetch(`/fitness/api/exercises/${categoryId}`);
        const exercises = await response.json();
        console.log('Exercises received:', exercises);
        
        const exercise = exercises.find(ex => ex.name === exerciseName);
        console.log('Found exercise:', exercise);
        
        if (exercise) {
            exerciseId = exercise.id;
            exerciseEquipment = exercise.equipment;
            isBarbellExercise = exerciseEquipment && exerciseEquipment.toLowerCase() === 'barbell';
            
            console.log('Exercise details:', {
                exerciseId,
                exerciseEquipment,
                isBarbellExercise
            });
            
            // Update total weight display for barbell exercises
            const totalWeightDisplay = document.getElementById('total-weight-display');
            const totalWeightHeader = document.getElementById('total-weight-header');
            const historyTotalWeightHeader = document.getElementById('history-total-weight-header');
            
            console.log('DOM elements found:', {
                totalWeightDisplay: !!totalWeightDisplay,
                totalWeightHeader: !!totalWeightHeader,
                historyTotalWeightHeader: !!historyTotalWeightHeader
            });
            
            if (isBarbellExercise) {
                console.log('Setting barbell exercise display to visible');
                if (totalWeightDisplay) totalWeightDisplay.style.display = 'block';
                if (totalWeightHeader) totalWeightHeader.style.display = 'table-cell';
                if (historyTotalWeightHeader) historyTotalWeightHeader.style.display = 'table-cell';
            } else {
                console.log('Setting barbell exercise display to hidden');
                if (totalWeightDisplay) totalWeightDisplay.style.display = 'none';
                if (totalWeightHeader) totalWeightHeader.style.display = 'none';
                if (historyTotalWeightHeader) historyTotalWeightHeader.style.display = 'none';
            }
            
            // Update favorite button status
            updateFavoriteButtonStatus();
            
            // Load personal records for this exercise
            loadPersonalRecords();
        } else {
            console.log('Exercise not found in list');
        }
    } catch (error) {
        console.error('Error checking barbell exercise:', error);
    }
}

// Load personal records for the current exercise
async function loadPersonalRecords() {
    if (!exerciseName) return;
    
    try {
        const response = await fetch(`/fitness/api/personal_records/${encodeURIComponent(exerciseName)}`);
        if (response.ok) {
            const prs = await response.json();
            
            // Find the highest weight PR
            const weightPR = prs.find(pr => pr.pr_type === 'weight');
            const repsPR = prs.find(pr => pr.pr_type === 'reps');
            
            // Update the PR display
            const prHighestWeight = document.getElementById('pr-highest-weight');
            if (prHighestWeight) {
                if (weightPR) {
                    prHighestWeight.textContent = `${weightPR.value} lbs`;
                    prHighestWeight.style.color = '#28a745';
                } else {
                    prHighestWeight.textContent = 'No PR yet';
                    prHighestWeight.style.color = '#6c757d';
                }
            }
            
            // Store PRs for comparison
            window.currentPRs = {
                weight: weightPR ? weightPR.value : 0,
                reps: repsPR ? repsPR.value : 0
            };
        }
    } catch (error) {
        console.error('Error loading personal records:', error);
    }
}

// Save last inputs for the current exercise
function saveLastInputs(weight, reps) {
    if (!exerciseName) return;
    
    const key = `lastInputs_${exerciseName}`;
    const lastInputs = {
        weight: weight,
        reps: reps,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem(key, JSON.stringify(lastInputs));
        console.log('Saved last inputs:', lastInputs);
    } catch (error) {
        console.error('Error saving last inputs:', error);
    }
}

// Load last inputs for the current exercise
function loadLastInputs() {
    console.log('loadLastInputs called with:', { exerciseName, weightInput: !!weightInput, repsInput: !!repsInput });
    if (!exerciseName || !weightInput || !repsInput) {
        console.log('Missing required elements, returning early');
        return;
    }
    
    const key = `lastInputs_${exerciseName}`;
    console.log('Looking for saved inputs with key:', key);
    
    try {
        const saved = localStorage.getItem(key);
        console.log('Saved data from localStorage:', saved);
        
        if (saved) {
            const lastInputs = JSON.parse(saved);
            console.log('Parsed last inputs:', lastInputs);
            
            // Check if the saved data is recent (within last 30 days)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            console.log('Data age check:', { 
                saved: lastInputs.timestamp, 
                thirtyDaysAgo, 
                isRecent: lastInputs.timestamp > thirtyDaysAgo 
            });
            
            if (lastInputs.timestamp > thirtyDaysAgo) {
                // Set the values
                if (lastInputs.weight) {
                    console.log('Setting weight input to:', lastInputs.weight);
                    weightInput.value = lastInputs.weight;
                    // Update total weight display for barbell exercises
                    if (isBarbellExercise) {
                        console.log('Updating total weight display for barbell exercise');
                        updateTotalWeightDisplay(lastInputs.weight);
                    }
                }
                if (lastInputs.reps) {
                    console.log('Setting reps input to:', lastInputs.reps);
                    repsInput.value = lastInputs.reps;
                }
                
                console.log('Loaded last inputs:', lastInputs);
                showMessage(`Loaded last inputs: ${lastInputs.weight} lbs × ${lastInputs.reps} reps`, 'info');
            } else {
                // Clear old data
                console.log('Clearing old data (older than 30 days)');
                localStorage.removeItem(key);
                console.log('Cleared old last inputs data');
            }
        } else {
            console.log('No saved inputs found');
        }
    } catch (error) {
        console.error('Error loading last inputs:', error);
    }
}

// Clear last inputs for the current exercise
function clearLastInputs() {
    if (!exerciseName) return;
    
    const key = `lastInputs_${exerciseName}`;
    try {
        localStorage.removeItem(key);
        console.log('Cleared last inputs for:', exerciseName);
    } catch (error) {
        console.error('Error clearing last inputs:', error);
    }
}

// Toggle favorite status
async function toggleFavorite() {
    if (!exerciseId) return;
    
    try {
        const response = await fetch(`/fitness/api/exercise/${exerciseId}/favorite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            updateFavoriteButtonStatus(result.is_favorite);
            showMessage(result.message, 'success');
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to toggle favorite', 'error');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showMessage('Error toggling favorite', 'error');
    }
}

// Update favorite button visual status
async function updateFavoriteButtonStatus(isFavorite = null) {
    if (!favoriteExerciseBtn || !exerciseId) return;
    
    if (isFavorite === null) {
        // Check current favorite status from server
        try {
            const response = await fetch(`/fitness/api/exercises/${categoryId}`);
            const exercises = await response.json();
            const exercise = exercises.find(ex => ex.name === exerciseName);
            if (exercise) {
                isFavorite = exercise.is_favorite;
            }
        } catch (error) {
            console.error('Error checking favorite status:', error);
            isFavorite = false;
        }
    }
    
    favoriteExerciseBtn.classList.toggle('favorite', isFavorite);
    
    // Update the star icon
    const starIcon = favoriteExerciseBtn.querySelector('svg');
    if (starIcon) {
        if (isFavorite) {
            starIcon.style.fill = '#ffd700';
            starIcon.style.stroke = '#ffd700';
        } else {
            starIcon.style.fill = 'none';
            starIcon.style.stroke = 'currentColor';
        }
    }
}

// Setup all event listeners for workout entry page
function setupWorkoutEntryEventListeners() {
    // Form submission for logging sets
    if (logSetForm) {
        logSetForm.addEventListener('submit', handleLogSet);
    }
    
    // Plus/minus buttons for weight and reps
    if (weightMinus) weightMinus.addEventListener('click', () => adjustValue('weight', -2.5));
    if (weightPlus) weightPlus.addEventListener('click', () => adjustValue('weight', 2.5));
    if (repsMinus) repsMinus.addEventListener('click', () => adjustValue('reps', -1));
    if (repsPlus) repsPlus.addEventListener('click', () => adjustValue('reps', 1));
    
    // Input change listeners for real-time updates
    if (weightInput) {
        weightInput.addEventListener('input', () => {
            const weight = parseFloat(weightInput.value) || 0;
            if (isBarbellExercise) {
                updateTotalWeightDisplay(weight);
            }
        });
    }
    
    if (repsInput) {
        repsInput.addEventListener('input', () => {
            // Could add validation or other real-time feedback here
        });
    }
    
    // Tab switching
    if (tabTrack) tabTrack.addEventListener('click', () => switchTab('track'));
    if (tabHistory) tabHistory.addEventListener('click', () => switchTab('history'));
    if (tabLogNew) tabLogNew.addEventListener('click', () => switchTab('log-new'));
    
    // Load initial data
    loadTodaysSets();
    loadExerciseHistory();
}

// Handle logging a new set
async function handleLogSet(e) {
    e.preventDefault();
    
    const formData = new FormData(logSetForm);
    const weight = parseFloat(formData.get('weight'));
    const reps = parseInt(formData.get('reps'));
    
    if (!weight || !reps) {
        showMessage('Please enter both weight and reps', 'error');
        return;
    }
    
    try {
        // Check current PRs before logging the set
        const currentWeightPR = window.currentPRs ? window.currentPRs.weight : 0;
        const currentRepsPR = window.currentPRs ? window.currentPRs.reps : 0;
        
        // Calculate total weight for barbell exercises
        const totalWeight = isBarbellExercise ? weight + STANDARD_BARBELL_WEIGHT : weight;
        
        // Check if this will be a new PR
        const isNewWeightPR = totalWeight > currentWeightPR;
        const isNewRepsPR = reps > currentRepsPR;
        const isNewPR = isNewWeightPR || isNewRepsPR;
        
        console.log('PR check before logging:', {
            currentWeightPR,
            currentRepsPR,
            newWeight: totalWeight,
            newReps: reps,
            isNewWeightPR,
            isNewRepsPR,
            isNewPR
        });
        
        const response = await fetch('/fitness/api/log_set', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category_id: categoryId,
                exercise: exerciseName,
                weight: weight,
                reps: reps,
                is_barbell: isBarbellExercise
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Save the last inputs for this exercise
            saveLastInputs(weight, reps);
            
            // Add the new set to the table
            addSetToTable(result);
            
            // Reset form
            logSetForm.reset();
            
            // Update sets count
            updateSetsCount();
            
            // Only play PR audio and show notification if it's actually a new PR
            if (isNewPR) {
                console.log('New PR achieved! Playing audio and showing notification');
                const prTypes = [];
                if (isNewWeightPR) prTypes.push('weight');
                if (isNewRepsPR) prTypes.push('reps');
                
                handlePRAchievement(prTypes, exerciseName);
            } else {
                console.log('No new PR achieved, showing regular success message');
                showMessage('Set logged successfully!', 'success');
            }
            
            // Reload personal records to update the display
            loadPersonalRecords();
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to log set', 'error');
        }
    } catch (error) {
        console.error('Error logging set:', error);
        showMessage('Error logging set', 'error');
    }
}

// Add a set to the table
function addSetToTable(setData) {
    if (!setsTableBody) return;
    
    const row = document.createElement('tr');
    const setNumber = setsTableBody.children.length + 1;
    
    let totalWeightCell = '';
    if (isBarbellExercise) {
        // Use total_weight from the response if available, otherwise calculate it
        const totalWeight = setData.total_weight || (setData.weight + STANDARD_BARBELL_WEIGHT);
        totalWeightCell = `<td>${totalWeight}</td>`;
    }
    
    row.innerHTML = `
        <td>${setNumber}</td>
        <td>${setData.weight}</td>
        ${totalWeightCell}
        <td>${setData.reps}</td>
        <td>
            <button onclick="deleteSet(${setData.id})" class="btn btn-sm btn-danger">Delete</button>
        </td>
    `;
    
    setsTableBody.appendChild(row);
}

// Update the sets count display
function updateSetsCount() {
    const setsCount = document.getElementById('sets-count');
    if (setsCount && setsTableBody) {
        const count = setsTableBody.children.length;
        setsCount.textContent = `${count} set${count !== 1 ? 's' : ''}`;
    }
}

// Load today's sets
async function loadTodaysSets() {
    if (!setsTableBody) return;
    
    try {
        const response = await fetch(`/fitness/api/todays_sets?exercise=${encodeURIComponent(exerciseName)}`);
        if (response.ok) {
            const sets = await response.json();
            setsTableBody.innerHTML = '';
            
            sets.forEach(set => {
                // Add total_weight calculation for barbell exercises
                if (isBarbellExercise) {
                    set.total_weight = set.weight + STANDARD_BARBELL_WEIGHT;
                }
                addSetToTable(set);
            });
            
            updateSetsCount();
        }
    } catch (error) {
        console.error('Error loading today\'s sets:', error);
    }
}

// Load exercise history
async function loadExerciseHistory() {
    if (!historyTableBody) return;
    
    try {
        const response = await fetch(`/fitness/api/exercise_history?exercise=${encodeURIComponent(exerciseName)}`);
        if (response.ok) {
            const history = await response.json();
            historyTableBody.innerHTML = '';
            
            history.forEach(entry => {
                const row = document.createElement('tr');
                let totalWeightCell = '';
                if (isBarbellExercise) {
                    const totalWeight = entry.weight + STANDARD_BARBELL_WEIGHT;
                    totalWeightCell = `<td>${totalWeight}</td>`;
                }
                
                row.innerHTML = `
                    <td>${new Date(entry.date).toLocaleDateString()}</td>
                    <td>${entry.set_number}</td>
                    <td>${entry.weight}</td>
                    ${totalWeightCell}
                    <td>${entry.reps}</td>
                `;
                historyTableBody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading exercise history:', error);
    }
}

// Switch between tabs
function switchTab(tabName) {
    // Update tab buttons
    [tabTrack, tabHistory, tabLogNew].forEach(tab => {
        if (tab) tab.classList.remove('active');
    });
    
    if (tabName === 'track') {
        if (tabTrack) tabTrack.classList.add('active');
        if (trackSection) trackSection.style.display = 'block';
        if (historySection) historySection.style.display = 'none';
    } else if (tabName === 'history') {
        if (tabHistory) tabHistory.classList.add('active');
        if (trackSection) trackSection.style.display = 'none';
        if (historySection) historySection.style.display = 'block';
    } else if (tabName === 'log-new') {
        if (tabLogNew) tabLogNew.classList.add('active');
        // Open the workout modal for new exercise selection
        openWorkoutModalNewFlow();
    }
}

// Adjust weight or reps with plus/minus buttons
function adjustValue(field, change) {
    const input = field === 'weight' ? weightInput : repsInput;
    if (input) {
        const currentValue = parseFloat(input.value) || 0;
        const newValue = Math.max(0, currentValue + change);
        input.value = newValue;
        
        // Update total weight display for barbell exercises
        if (field === 'weight' && isBarbellExercise) {
            updateTotalWeightDisplay(newValue);
        }
    }
}

// Update total weight display for barbell exercises
function updateTotalWeightDisplay(userWeight) {
    const userWeightSpan = document.getElementById('user-weight');
    const totalWeightSpan = document.getElementById('total-weight');
    
    if (userWeightSpan && totalWeightSpan) {
        userWeightSpan.textContent = userWeight;
        totalWeightSpan.textContent = userWeight + STANDARD_BARBELL_WEIGHT;
    }
}

// Delete a set
async function deleteSet(setId) {
    if (!confirm('Are you sure you want to delete this set?')) return;
    
    try {
        const response = await fetch(`/fitness/api/sets/${setId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Reload today's sets
            loadTodaysSets();
            showMessage('Set deleted successfully!', 'success');
        } else {
            showMessage('Failed to delete set', 'error');
        }
    } catch (error) {
        console.error('Error deleting set:', error);
        showMessage('Error deleting set', 'error');
    }
}

// Place all workout/exercise/template logic here, including:
// - Workout logging (forms, event listeners)
// - Workout templates (modals, save logic)
// - Workout history (fetches, table rendering)
// - Exercise/category selection and fetches
// - Any related helpers or event listeners

// Example placeholder (replace with actual moved code):
// async function loadTodaysWorkout() { ... }
// async function loadFullWorkoutHistory() { ... }
// ...

// Export functions if using modules
// export { loadTodaysWorkout, loadFullWorkoutHistory, ... }; 

// --- Begin workout_entry.js logic ---
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
        prAudio.volume = 0.6; // Set volume to 60%
        
        // Test if audio can be loaded
        prAudio.addEventListener('canplaythrough', () => {
            console.log('PR audio loaded successfully');
        });
        
        prAudio.addEventListener('error', (e) => {
            console.error('PR audio failed to load:', e);
            prAudio = null;
        });
        
        console.log('PR audio initialized successfully');
    } catch (error) {
        console.error('Failed to initialize PR audio:', error);
        prAudio = null;
    }
}

function playPRSound(type = 'pr') {
    if (prAudio) {
        try {
            prAudio.currentTime = 0;
            const playPromise = prAudio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('Playing PR sound');
                }).catch(error => {
                    console.error('Failed to play PR sound:', error);
                    // Fallback: show a visual notification instead
                    showMessage('🎉 NEW PERSONAL RECORD!', 'success');
                });
            }
        } catch (error) {
            console.error('Error playing PR sound:', error);
            // Fallback: show a visual notification instead
            showMessage('🎉 NEW PERSONAL RECORD!', 'success');
        }
    } else {
        console.warn('PR audio not initialized');
        // Fallback: show a visual notification instead
        showMessage('🎉 NEW PERSONAL RECORD!', 'success');
    }
}

function handlePRAchievement(prsAchieved, exerciseName) {
    console.log('PR Achievement detected:', prsAchieved, 'for', exerciseName);
    if (prsAchieved && prsAchieved.length > 0) {
        console.log('Playing PR audio for:', prsAchieved);
        playPRSound('pr');
        
        // Show a more detailed PR notification
        const prTypes = prsAchieved.map(type => {
            switch(type) {
                case 'weight': return 'Weight PR';
                case 'reps': return 'Reps PR';
                case 'volume': return 'Volume PR';
                default: return type;
            }
        }).join(', ');
        
        showMessage(`🎉 NEW PERSONAL RECORD! ${prTypes} achieved for ${exerciseName}!`, 'success');
        
        // Add visual feedback to the PR summary
        const prSummary = document.querySelector('.pr-summary');
        if (prSummary) {
            prSummary.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                prSummary.style.animation = '';
            }, 500);
        }
    } else {
        console.log('No PRs achieved, not playing audio');
    }
}

// Update header elements
if (document.getElementById('category-id')) document.getElementById('category-id').value = categoryId || '';
if (document.getElementById('exercise-name')) document.getElementById('exercise-name').value = exerciseName || '';

// DOM element references
const exerciseNameInput = document.getElementById('exercise-name');
const exerciseIdInput = document.getElementById('exercise-id');

const logSetForm = document.getElementById('log-set-form');
const setsTableBody = document.querySelector('#sets-table tbody');

// Tab navigation logic
const tabLogNew = document.getElementById('tab-log-new');
const tabTrack = document.getElementById('tab-track');
const tabHistory = document.getElementById('tab-history');
const trackSection = document.getElementById('track-section');
const historySection = document.getElementById('history-section');
const historyExercise = document.getElementById('history-exercise');
const historyTableBody = document.querySelector('#history-table tbody');

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

// Update exercise title in header
function updateExerciseTitle() {
    const exerciseTitle = document.getElementById('exercise-title');
    if (exerciseTitle && exerciseName) {
        exerciseTitle.textContent = exerciseName;
    }
}

// Update history exercise name
function updateHistoryExerciseName() {
    const historyExercise = document.getElementById('history-exercise');
    if (historyExercise && exerciseName) {
        historyExercise.textContent = exerciseName;
    }
}

// Setup form submission and other event listeners
setupWorkoutEntryEventListeners();

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

// Progress steps - Updated to match HTML structure
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');

function showStep(step) {
    if (step === 'category') {
        if (modalStepCategory) modalStepCategory.style.display = 'block';
        if (modalStepExercise) modalStepExercise.style.display = 'none';
        if (step1) step1.classList.add('active');
        if (step2) step2.classList.remove('active');
    } else if (step === 'exercise') {
        if (modalStepCategory) modalStepCategory.style.display = 'none';
        if (modalStepExercise) modalStepExercise.style.display = 'block';
        if (step1) step1.classList.remove('active');
        if (step2) step2.classList.add('active');
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
        workoutModal.style.display = 'flex';
    }
    // Fetch categories
    try {
        const resp = await fetch('/fitness/api/exercise_categories');
        const categories = await resp.json();
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
    } catch (err) {
        if (categoryList) categoryList.innerHTML = '<div style="color:red">Failed to load categories</div>';
    }
}

async function selectCategory(categoryId, categoryName) {
    currentCategoryId = categoryId;
    currentCategoryName = categoryName;
    showStep('exercise');
    if (exerciseList) exerciseList.innerHTML = '<div>Loading...</div>';
    try {
        const resp = await fetch(`/fitness/api/exercises/${categoryId}`);
        const exercises = await resp.json();
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
    } catch (err) {
        if (exerciseList) exerciseList.innerHTML = '<div style="color:red">Failed to load exercises</div>';
    }
    setupCustomExerciseForm();
}

function selectExercise(exerciseId, exerciseName) {
    // Close the modal
    if (workoutModal) {
        workoutModal.style.display = 'none';
    }
    
    // Redirect to workout entry page with the selected exercise
    const params = new URLSearchParams({
        category_id: currentCategoryId,
        category_name: currentCategoryName,
        exercise: exerciseName
    });
    window.location.href = `/fitness/workout_entry?${params.toString()}`;
}

// Custom exercise form setup
function setupCustomExerciseForm() {
    const customExerciseForm = document.getElementById('custom-exercise-form');
    const showCustomExerciseFormBtn = document.getElementById('show-custom-exercise-form');
    
    if (showCustomExerciseFormBtn && customExerciseForm) {
        showCustomExerciseFormBtn.addEventListener('click', () => {
            customExerciseForm.style.display = customExerciseForm.style.display === 'none' ? 'block' : 'none';
        });
        
        customExerciseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(customExerciseForm);
            const exerciseName = formData.get('name');
            
            try {
                const response = await fetch('/fitness/api/exercises', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: exerciseName,
                        category_id: currentCategoryId
                    })
                });
                
                if (response.ok) {
                    const newExercise = await response.json();
                    // Refresh the exercise list
                    selectCategory(currentCategoryId, currentCategoryName);
                    customExerciseForm.style.display = 'none';
                    customExerciseForm.reset();
                    showSnack('Exercise created successfully!', 'success');
                } else {
                    showSnack('Failed to create exercise', 'error');
                }
            } catch (error) {
                console.error('Error creating exercise:', error);
                showSnack('Error creating exercise', 'error');
            }
        });
    }
}

// Modal event listeners
function setupModalEventListeners() {
    // Close modal button for workout modal
    if (closeWorkoutModalBtn) {
        closeWorkoutModalBtn.addEventListener('click', () => {
            if (workoutModal) workoutModal.style.display = 'none';
        });
    }
    
    // Close modal button for start workout modal
    const closeStartWorkoutModalBtn = document.getElementById('close-start-workout-modal');
    if (closeStartWorkoutModalBtn) {
        closeStartWorkoutModalBtn.addEventListener('click', () => {
            const startWorkoutModal = document.getElementById('start-workout-modal');
            if (startWorkoutModal) startWorkoutModal.style.display = 'none';
        });
    }
    
    // Back to category button
    if (backToCategoryBtn) {
        backToCategoryBtn.addEventListener('click', () => {
            showStep('category');
        });
    }
    
    // Cancel workout button
    if (cancelWorkoutBtn) {
        cancelWorkoutBtn.addEventListener('click', () => {
            if (workoutModal) workoutModal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    if (workoutModal) {
        workoutModal.addEventListener('click', (e) => {
            if (e.target === workoutModal) {
                workoutModal.style.display = 'none';
            }
        });
    }
    
    // Close start workout modal when clicking outside
    const startWorkoutModal = document.getElementById('start-workout-modal');
    if (startWorkoutModal) {
        startWorkoutModal.addEventListener('click', (e) => {
            if (e.target === startWorkoutModal) {
                startWorkoutModal.style.display = 'none';
            }
        });
    }
}

// Workout tab switching
function setupWorkoutTabSwitching() {
    const workoutTabNew = document.getElementById('workout-tab-new');
    const workoutTabHistory = document.getElementById('workout-tab-history');
    const workoutTabContentNew = document.getElementById('workout-tab-content-new');
    const workoutTabContentHistory = document.getElementById('workout-tab-content-history');
    
    if (workoutTabNew && workoutTabHistory && workoutTabContentNew && workoutTabContentHistory) {
        workoutTabNew.addEventListener('click', () => {
            workoutTabNew.classList.add('active');
            workoutTabHistory.classList.remove('active');
            workoutTabContentNew.style.display = 'block';
            workoutTabContentHistory.style.display = 'none';
        });
        
        workoutTabHistory.addEventListener('click', () => {
            workoutTabHistory.classList.add('active');
            workoutTabNew.classList.remove('active');
            workoutTabContentHistory.style.display = 'block';
            workoutTabContentNew.style.display = 'none';
            loadFullWorkoutHistory();
        });
    }
}

// Start Workout Modal Functions
// Make functions globally accessible for HTML onclick handlers
window.openStartWorkoutModal = function() {
    const startWorkoutModal = document.getElementById('start-workout-modal');
    if (startWorkoutModal) {
        startWorkoutModal.style.display = 'flex';
        showStartWorkoutStep(1);
        loadWorkoutTemplates();
    }
}

window.createNewWorkout = function() {
    showStartWorkoutStep(2);
}

window.backToWorkoutSelection = function() {
    showStartWorkoutStep(1);
}

window.nextToExerciseSelection = function() {
    const workoutName = document.getElementById('workout-template-name').value.trim();
    if (!workoutName) {
        alert('Please enter a workout name');
        return;
    }
    showStartWorkoutStep(3);
    loadCategoriesForNewWorkout();
}

window.backToCategories = function() {
    showStartWorkoutStep(2);
}

window.loadExercisesForSelectedCategories = function() {
    loadExercisesForSelectedCategoriesInternal();
}

window.saveWorkoutTemplate = function() {
    saveWorkoutTemplateInternal();
}

window.closeWorkoutTemplateSuccess = function() {
    const startWorkoutModal = document.getElementById('start-workout-modal');
    if (startWorkoutModal) {
        startWorkoutModal.style.display = 'none';
    }
    showStartWorkoutStep(1);
}

window.selectWorkoutTemplate = function(templateId) {
    // Close the modal and start the workout with the selected template
    const startWorkoutModal = document.getElementById('start-workout-modal');
    if (startWorkoutModal) {
        startWorkoutModal.style.display = 'none';
    }
    
    // Redirect to workout entry with template
    window.location.href = `/fitness/workout_entry?template_id=${templateId}`;
}

function showStartWorkoutStep(step) {
    const step1 = document.getElementById('start-workout-step-1');
    const step2 = document.getElementById('start-workout-step-2');
    const step3 = document.getElementById('start-workout-step-3');
    const step4 = document.getElementById('start-workout-step-4');
    
    // Hide all steps
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';
    if (step4) step4.style.display = 'none';
    
    // Show the requested step
    switch(step) {
        case 1:
            if (step1) step1.style.display = 'block';
            break;
        case 2:
            if (step2) step2.style.display = 'block';
            break;
        case 3:
            if (step3) step3.style.display = 'block';
            break;
        case 4:
            if (step4) step4.style.display = 'block';
            break;
    }
}

async function loadWorkoutTemplates() {
    const templateList = document.getElementById('workout-template-list');
    if (!templateList) return;
    
    try {
        const response = await fetch('/fitness/api/workout_templates');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const templates = await response.json();
        console.log('Workout templates response:', templates);
        
        if (Array.isArray(templates) && templates.length > 0) {
            templateList.innerHTML = '';
            templates.forEach(template => {
                const templateItem = document.createElement('div');
                templateItem.className = 'workout-template-item';
                templateItem.innerHTML = `
                    <div class="template-info">
                        <h4>${template.name}</h4>
                        <p>${template.exercises && Array.isArray(template.exercises) ? template.exercises.length : 0} exercises</p>
                    </div>
                    <button onclick="selectWorkoutTemplate(${template.id})" class="btn btn-primary">Select</button>
                `;
                templateList.appendChild(templateItem);
            });
        } else {
            templateList.innerHTML = '<p style="text-align: center; color: #666;">No saved workout templates found.</p>';
        }
    } catch (error) {
        console.error('Error loading workout templates:', error);
        templateList.innerHTML = '<p style="text-align: center; color: #666;">Error loading templates</p>';
    }
}

async function loadCategoriesForNewWorkout() {
    const categoryList = document.getElementById('multi-category-list');
    if (!categoryList) return;
    
    try {
        const response = await fetch('/fitness/api/exercise_categories');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const categories = await response.json();
        
        categoryList.innerHTML = '';
        categories.forEach(cat => {
            const categoryBtn = document.createElement('button');
            categoryBtn.className = 'category-btn';
            categoryBtn.textContent = cat.name;
            categoryBtn.dataset.categoryId = cat.id;
            categoryBtn.dataset.categoryName = cat.name;
            categoryBtn.onclick = () => toggleCategorySelection(cat.id, cat.name, categoryBtn);
            categoryList.appendChild(categoryBtn);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
        categoryList.innerHTML = '<p style="color: red;">Error loading categories</p>';
    }
}

let selectedCategories = [];

function toggleCategorySelection(categoryId, categoryName, button) {
    const index = selectedCategories.findIndex(cat => cat.id === categoryId);
    if (index > -1) {
        selectedCategories.splice(index, 1);
        button.classList.remove('selected');
    } else {
        selectedCategories.push({ id: categoryId, name: categoryName });
        button.classList.add('selected');
    }
}

async function loadExercisesForSelectedCategoriesInternal() {
    const exerciseList = document.getElementById('multi-exercise-list');
    if (!exerciseList) return;
    
    exerciseList.innerHTML = '<p>Loading exercises...</p>';
    
    try {
        const allExercises = [];
        for (const category of selectedCategories) {
            const response = await fetch(`/fitness/api/exercises/${category.id}`);
            if (response.ok) {
                const exercises = await response.json();
                exercises.forEach(ex => {
                    ex.category_name = category.name;
                    allExercises.push(ex);
                });
            }
        }
        
        exerciseList.innerHTML = '';
        allExercises.forEach(ex => {
            const exerciseBtn = document.createElement('button');
            exerciseBtn.className = 'exercise-btn';
            exerciseBtn.textContent = ex.name;
            exerciseBtn.dataset.exerciseId = ex.id;
            exerciseBtn.dataset.exerciseName = ex.name;
            exerciseBtn.dataset.categoryName = ex.category_name;
            exerciseBtn.onclick = () => toggleExerciseSelection(ex.id, ex.name, ex.category_name, exerciseBtn);
            exerciseList.appendChild(exerciseBtn);
        });
    } catch (error) {
        console.error('Error loading exercises:', error);
        exerciseList.innerHTML = '<p style="color: red;">Error loading exercises</p>';
    }
}

let selectedExercises = [];

function toggleExerciseSelection(exerciseId, exerciseName, categoryName, button) {
    const index = selectedExercises.findIndex(ex => ex.id === exerciseId);
    if (index > -1) {
        selectedExercises.splice(index, 1);
        button.classList.remove('selected');
    } else {
        selectedExercises.push({ 
            id: exerciseId, 
            name: exerciseName, 
            category_name: categoryName 
        });
        button.classList.add('selected');
    }
}

async function saveWorkoutTemplateInternal() {
    const workoutName = document.getElementById('workout-template-name').value.trim();
    
    if (!workoutName) {
        alert('Please enter a workout name');
        return;
    }
    
    if (selectedExercises.length === 0) {
        alert('Please select at least one exercise');
        return;
    }
    
    try {
        const response = await fetch('/fitness/api/workout_templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: workoutName,
                exercises: selectedExercises.map((ex, idx) => ({
                    exercise_name: ex.name,
                    exercise_id: ex.id,
                    category_name: ex.category_name,
                    order: idx + 1 // Ensure unique order for each exercise
                }))
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showStartWorkoutStep(4);
            // Reset form
            document.getElementById('workout-template-name').value = '';
            selectedCategories = [];
            selectedExercises = [];
        } else {
            const error = await response.json();
            alert('Error saving workout: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving workout template:', error);
        alert('Error saving workout template');
    }
}

// Load workout history
async function loadFullWorkoutHistory() {
    const historyTableBody = document.querySelector('#full-workout-history-table tbody');
    if (!historyTableBody) return;
    
    try {
        const response = await fetch('/fitness/api/workout_history');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const history = await response.json();
        
        historyTableBody.innerHTML = '';
        if (history && history.length > 0) {
            history.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(entry.date).toLocaleDateString()}</td>
                    <td>${entry.category_name || 'N/A'}</td>
                    <td>${entry.exercise_name || 'N/A'}</td>
                    <td>${entry.weight || 'N/A'}</td>
                    <td>${entry.reps || 'N/A'}</td>
                    <td>${entry.sets || 'N/A'}</td>
                `;
                historyTableBody.appendChild(row);
            });
        } else {
            historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No workout history found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading workout history:', error);
        historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No workout history available</td></tr>';
    }
}

// Load today's workout
async function loadTodaysWorkout() {
    const workoutTableBody = document.querySelector('#workout-table tbody');
    if (!workoutTableBody) return;
    
    try {
        const response = await fetch('/fitness/api/todays_workout');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const workout = await response.json();
        
        workoutTableBody.innerHTML = '';
        if (workout && workout.length > 0) {
            workout.forEach(set => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${set.category_name || 'N/A'}</td>
                    <td>${set.exercise_name || 'N/A'}</td>
                    <td>${set.set_number || 'N/A'}</td>
                    <td>${set.total_weight || 'N/A'}</td>
                    <td>${set.reps || 'N/A'}</td>
                    <td>
                        <button onclick="editSet(${set.id})" class="btn btn-sm btn-secondary">Edit</button>
                        <button onclick="deleteSet(${set.id})" class="btn btn-sm btn-danger">Delete</button>
                    </td>
                `;
                workoutTableBody.appendChild(row);
            });
        } else {
            workoutTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No workouts logged today</td></tr>';
        }
    } catch (error) {
        console.error('Error loading today\'s workout:', error);
        workoutTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No workouts available</td></tr>';
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Workouts.js loaded');
    
    // Initialize audio
    initAudio();
    
    // Setup modal event listeners
    setupModalEventListeners();
    
    // Setup workout tab switching
    setupWorkoutTabSwitching();
    
    // Setup activity/workout sub-tab switching
    const workoutsTabBtn = document.getElementById('activity-sub-tab-workouts');
    const activitiesTabBtn = document.getElementById('activity-sub-tab-activities');
    const workoutsContent = document.getElementById('activity-sub-content-workouts');
    const activitiesContent = document.getElementById('activity-sub-content-activities');

    if (workoutsTabBtn && activitiesTabBtn && workoutsContent && activitiesContent) {
        workoutsTabBtn.addEventListener('click', () => {
            workoutsTabBtn.classList.add('active');
            activitiesTabBtn.classList.remove('active');
            workoutsContent.style.display = 'block';
            activitiesContent.style.display = 'none';
        });

        activitiesTabBtn.addEventListener('click', () => {
            activitiesTabBtn.classList.add('active');
            workoutsTabBtn.classList.remove('active');
            activitiesContent.style.display = 'block';
            workoutsContent.style.display = 'none';
        });
    }

    // Add event listeners for workout modal buttons (only if they exist)
    const startWorkoutBtn = document.getElementById('start-workout-btn');
    if (startWorkoutBtn) {
        startWorkoutBtn.addEventListener('click', openStartWorkoutModal);
        console.log('Start workout button listener added');
    }
    
    const logExerciseBtn = document.getElementById('log-exercise-btn');
    if (logExerciseBtn) {
        logExerciseBtn.addEventListener('click', openWorkoutModalNewFlow);
        console.log('Log exercise button listener added');
    }
    
    // Load initial data (only if we're on a page that has these elements)
    const workoutTableBody = document.querySelector('#workout-table tbody');
    if (workoutTableBody) {
        loadTodaysWorkout();
    }
    
    // Initialize exercise data and favorite button (only for workout entry page)
    console.log('DOMContentLoaded: Initialization starting with:', { categoryId, exerciseName });
    if (categoryId && exerciseName) {
        console.log('Both categoryId and exerciseName present, proceeding with initialization');
        updateExerciseTitle();
        updateHistoryExerciseName();
        console.log('Calling checkIfBarbellExercise...');
        checkIfBarbellExercise().then(() => {
            console.log('checkIfBarbellExercise completed, loading last inputs...');
            // Load last inputs after exercise data is loaded
            loadLastInputs();
        }).catch(error => {
            console.error('Error in checkIfBarbellExercise:', error);
        });
    } else {
        console.log('Missing categoryId or exerciseName, skipping initialization');
    }
});

// Test function for debugging (can be called from browser console)
window.testPRFunctionality = function() {
    console.log('Testing PR functionality...');
    console.log('Exercise name:', exerciseName);
    console.log('Category ID:', categoryId);
    console.log('Exercise ID:', exerciseId);
    console.log('Is barbell exercise:', isBarbellExercise);
    
    // Test audio
    if (prAudio) {
        console.log('PR audio is available');
        playPRSound('pr');
    } else {
        console.log('PR audio is not available');
    }
    
    // Test personal records loading
    loadPersonalRecords();
    
    // Test favorite status
    updateFavoriteButtonStatus();
    
    console.log('PR functionality test complete');
};

// Test function for simulating a PR achievement
window.testPRAchievement = function() {
    console.log('Testing PR achievement...');
    handlePRAchievement(['weight', 'reps'], exerciseName || 'Test Exercise');
};

// Test function for last inputs functionality
window.testLastInputs = function() {
    console.log('Testing last inputs functionality...');
    console.log('Current exercise:', exerciseName);
    
    // Test saving inputs
    saveLastInputs(135, 8);
    console.log('Saved inputs: 135 lbs × 8 reps');
    
    // Test loading inputs
    loadLastInputs();
    
    // Test clearing inputs
    // clearLastInputs();
    // console.log('Cleared last inputs');
};

// Function to manually clear last inputs (for testing)
window.clearLastInputsManual = function() {
    clearLastInputs();
    showMessage('Last inputs cleared for ' + exerciseName, 'info');
};

// Comprehensive test function for all features
window.testAllFeatures = function() {
    console.log('=== COMPREHENSIVE FEATURE TEST ===');
    
    // Test 1: Check if we're on the right page
    console.log('1. Page check:', {
        isWorkoutEntryPage: window.location.pathname.includes('workout_entry'),
        categoryId,
        exerciseName,
        hasWeightInput: !!document.getElementById('weight'),
        hasRepsInput: !!document.getElementById('reps')
    });
    
    // Test 2: Check barbell detection
    console.log('2. Barbell detection:', {
        isBarbellExercise,
        exerciseEquipment,
        exerciseId
    });
    
    // Test 3: Check DOM elements
    console.log('3. DOM elements:', {
        totalWeightDisplay: !!document.getElementById('total-weight-display'),
        totalWeightHeader: !!document.getElementById('total-weight-header'),
        historyTotalWeightHeader: !!document.getElementById('history-total-weight-header'),
        prHighestWeight: !!document.getElementById('pr-highest-weight'),
        favoriteBtn: !!document.getElementById('favorite-exercise')
    });
    
    // Test 4: Check localStorage
    if (exerciseName) {
        const key = `lastInputs_${exerciseName}`;
        const saved = localStorage.getItem(key);
        console.log('4. localStorage:', {
            key,
            hasSavedData: !!saved,
            savedData: saved ? JSON.parse(saved) : null
        });
    }
    
    // Test 5: Test barbell weight calculation
    if (isBarbellExercise) {
        console.log('5. Barbell weight calculation test:');
        const testWeight = 135;
        const totalWeight = testWeight + STANDARD_BARBELL_WEIGHT;
        console.log(`   User weight: ${testWeight} + Barbell: ${STANDARD_BARBELL_WEIGHT} = Total: ${totalWeight}`);
        
        // Test the display function
        updateTotalWeightDisplay(testWeight);
    }
    
    // Test 6: Test saving and loading inputs
    console.log('6. Testing input save/load:');
    saveLastInputs(185, 5);
    console.log('   Saved: 185 lbs × 5 reps');
    loadLastInputs();
    
    console.log('=== TEST COMPLETE ===');
}; 