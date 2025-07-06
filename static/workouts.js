// --- Workouts/Exercise Logic ---
// (Moved from fitness.js and workout_entry.js)
// This file now includes all workout entry logic as well.

// Functions are now available globally from utility files

// Initialize workout utilities
if (typeof initWorkoutUtils !== 'undefined') {
    initWorkoutUtils();
}

// Using checkIfBarbellExercise from workout-utils.js

// Using loadPersonalRecords from workout-utils.js

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
                showSnack(`Loaded last inputs: ${lastInputs.weight} lbs × ${lastInputs.reps} reps`, 'info');
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

// Using toggleFavorite from workout-utils.js

// Using updateFavoriteButtonStatus from workout-utils.js

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
    if (exerciseName) {
        loadTodaysSets(exerciseName);
        loadExerciseHistory(exerciseName);
    }
}

// Handle logging a new set
async function handleLogSet(e) {
    e.preventDefault();
    
    const formData = new FormData(logSetForm);
    const weight = parseFloat(formData.get('weight'));
    const reps = parseInt(formData.get('reps'));
    
    if (!weight || !reps) {
        showSnack('Please enter both weight and reps', 'error');
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
                showSnack('Set logged successfully!', 'success');
            }
            
            // Reload personal records to update the display
            if (exerciseName) {
                loadPersonalRecords(exerciseName);
            }
        } else {
            const error = await response.json();
            showSnack(error.error || 'Failed to log set', 'error');
        }
    } catch (error) {
        console.error('Error logging set:', error);
        showSnack('Error logging set', 'error');
    }
}

// Add a set to the table
function addSetToTable(setData) {
    if (!setsTableBody) return;
    const row = document.createElement('tr');
    const setNumber = setsTableBody.children.length + 1;

    // Always show the user-entered weight
    let totalWeightCell = '';
    if (isBarbellExercise) {
        // Only show total weight for barbell exercises
        const totalWeight = setData.weight + STANDARD_BARBELL_WEIGHT;
        totalWeightCell = `<td>${totalWeight}</td>`;
    }

    row.innerHTML = `
        <td>${setNumber}</td>
        <td>${setData.weight}</td>
        ${isBarbellExercise ? totalWeightCell : ''}
        <td>${setData.reps}</td>
        <td>
            <button onclick="deleteSet(${setData.id})" class="btn btn-sm btn-danger">Delete</button>
        </td>
    `;
    setsTableBody.appendChild(row);

    // Update the table header visibility for Total Weight
    const totalWeightHeader = document.getElementById('total-weight-header');
    if (totalWeightHeader) {
        totalWeightHeader.style.display = isBarbellExercise ? 'table-cell' : 'none';
    }
}

// Update the sets count display
function updateSetsCount() {
    const setsCount = document.getElementById('sets-count');
    if (setsCount && setsTableBody) {
        const count = setsTableBody.children.length;
        setsCount.textContent = `${count} set${count !== 1 ? 's' : ''}`;
    }
}

// Using loadTodaysSets from workout-utils.js

// Using loadExerciseHistory from workout-utils.js

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

// Using deleteSet from workout-utils.js

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
// Using shared getQueryParam from shared-utils.js

const categoryId = getQueryParam('category_id');
const categoryName = getQueryParam('category_name');
const exerciseName = getQueryParam('exercise');

// Global variables for custom exercise functionality
window.currentCategoryId = null;
window.currentCategoryName = null;

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
        
        showSnack(`🎉 NEW PERSONAL RECORD! ${prTypes} achieved for ${exerciseName}!`, 'success');
        
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
            showSnack('Exercise data not loaded yet. Please wait a moment and try again.', 'error');
            return;
        }
        await toggleFavorite(exerciseId);
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

// Using openWorkoutModalNewFlow from workout-utils.js

// Using selectCategory from workout-utils.js
// Using selectExercise from workout-utils.js

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
        loadWorkoutTemplatesAndDisplay();
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
        showSnack('Please enter a workout name', 'error');
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
    
    // Get the template name from the stored template data
    const template = workoutTemplates.find(t => t.id === templateId);
    const templateName = template ? template.name : 'Workout';
    
    // Redirect to workout session with template
    startSessionFromTemplate(templateId, templateName);
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

// Global variable to store template data
let workoutTemplates = [];

// Function to load and display workout templates
async function loadWorkoutTemplatesAndDisplay() {
    const templateList = document.getElementById('workout-template-list');
    if (!templateList) {
        console.error('Template list element not found');
        return;
    }
    
    try {
        templateList.innerHTML = '<p style="text-align: center; color: #666;">Loading templates...</p>';
        
        const templates = await loadWorkoutTemplates();
        
        // Store templates globally
        workoutTemplates = templates;
        
        if (templates.length === 0) {
            templateList.innerHTML = '<p style="text-align: center; color: #666;">No saved workout templates found. Create your first template above!</p>';
            return;
        }
        
        templateList.innerHTML = '';
        templates.forEach(template => {
            const templateItem = document.createElement('div');
            templateItem.className = 'workout-template-item';
            templateItem.innerHTML = `
                <div class="template-info">
                    <h4>${template.name}</h4>
                    <p>${template.exercise_count} exercises • Created ${new Date(template.created_at).toLocaleDateString()}</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="editWorkoutTemplate(${template.id})" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.9em;">
                        Edit
                    </button>
                    <button onclick="selectWorkoutTemplate(${template.id})" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.9em;">
                        Start Workout
                    </button>
                </div>
            `;
            templateList.appendChild(templateItem);
        });
    } catch (error) {
        console.error('Error loading workout templates:', error);
        templateList.innerHTML = '<p style="text-align: center; color: red;">Error loading templates. Please try again.</p>';
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
        showSnack('Please enter a workout name', 'error');
        return;
    }
    
    if (selectedExercises.length === 0) {
        showSnack('Please select at least one exercise', 'error');
        return;
    }
    
    console.log('Saving workout template:', {
        name: workoutName,
        exercises: selectedExercises
    });
    
    try {
        const requestBody = {
            name: workoutName,
            exercises: selectedExercises.map((ex, idx) => ({
                exercise_name: ex.name,
                exercise_id: ex.id,
                category_name: ex.category_name,
                order: idx + 1 // Ensure unique order for each exercise
            }))
        };
        
        console.log('Request body:', requestBody);
        
        const response = await fetch('/fitness/api/workout_templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Template saved successfully:', result);
            showStartWorkoutStep(4);
            // Reset form
            document.getElementById('workout-template-name').value = '';
            selectedCategories = [];
            selectedExercises = [];
            
            // Refresh the template list
            setTimeout(() => {
                loadWorkoutTemplatesAndDisplay();
            }, 1000);
        } else {
            const error = await response.json();
            console.error('Error response:', error);
            showSnack('Error saving workout: ' + (error.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error saving workout template:', error);
        showSnack('Error saving workout template', 'error');
    }
}

// Using loadFullWorkoutHistory from workout-utils.js

// Using loadTodaysWorkout from workout-utils.js

// Edit Workout Template Functions
let currentEditingTemplateId = null;
let editSelectedCategories = [];
let editSelectedExercises = [];

async function editWorkoutTemplate(templateId) {
    currentEditingTemplateId = templateId;
    
    try {
        // Load the template data
        const response = await fetch(`/fitness/api/workout_templates/${templateId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const template = await response.json();
        
        // Populate the edit form
        document.getElementById('edit-workout-template-name').value = template.name;
        
        // Pre-select the exercises that are already in the template
        editSelectedExercises = template.exercises.map(ex => ({
            id: ex.exercise_id,
            name: ex.exercise_name,
            category_name: ex.category_name || 'Unknown'
        }));
        
        // Show the edit modal
        document.getElementById('edit-workout-template-modal').style.display = 'flex';
        showEditWorkoutStep(1);
        
        // Load categories for editing
        await loadEditCategoriesForWorkout();
        
    } catch (error) {
        console.error('Error loading template for editing:', error);
        showSnack('Error loading template for editing', 'error');
    }
}

function showEditWorkoutStep(step) {
    // Hide all steps
    document.getElementById('edit-workout-step-1').style.display = 'none';
    document.getElementById('edit-workout-step-2').style.display = 'none';
    document.getElementById('edit-workout-step-3').style.display = 'none';
    
    // Show the specified step
    document.getElementById(`edit-workout-step-${step}`).style.display = 'block';
}

async function loadEditCategoriesForWorkout() {
    const categoryList = document.getElementById('edit-multi-category-list');
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
            categoryBtn.onclick = () => toggleEditCategorySelection(cat.id, cat.name, categoryBtn);
            categoryList.appendChild(categoryBtn);
        });
        
        // Pre-select categories that contain the current exercises
        const exerciseCategories = [...new Set(editSelectedExercises.map(ex => ex.category_name))];
        categories.forEach(cat => {
            if (exerciseCategories.includes(cat.name)) {
                const btn = categoryList.querySelector(`[data-category-id="${cat.id}"]`);
                if (btn) {
                    btn.classList.add('selected');
                    editSelectedCategories.push({ id: cat.id, name: cat.name });
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading categories for editing:', error);
        categoryList.innerHTML = '<p style="color: red;">Error loading categories</p>';
    }
}

function toggleEditCategorySelection(categoryId, categoryName, button) {
    const index = editSelectedCategories.findIndex(cat => cat.id === categoryId);
    if (index > -1) {
        editSelectedCategories.splice(index, 1);
        button.classList.remove('selected');
    } else {
        editSelectedCategories.push({ id: categoryId, name: categoryName });
        button.classList.add('selected');
    }
}

function nextToEditExerciseSelection() {
    const templateName = document.getElementById('edit-workout-template-name').value.trim();
    if (!templateName) {
        showSnack('Please enter a workout name', 'error');
        return;
    }
    showEditWorkoutStep(2);
    loadEditExercisesForSelectedCategories();
}

function backToEditName() {
    showEditWorkoutStep(1);
}

async function loadEditExercisesForSelectedCategories() {
    const exerciseList = document.getElementById('edit-multi-exercise-list');
    if (!exerciseList) return;
    
    exerciseList.innerHTML = '<p>Loading exercises...</p>';
    
    try {
        const allExercises = [];
        for (const category of editSelectedCategories) {
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
            
            // Check if this exercise is already selected
            const isSelected = editSelectedExercises.some(selected => selected.id === ex.id);
            if (isSelected) {
                exerciseBtn.classList.add('selected');
            }
            
            exerciseBtn.onclick = () => toggleEditExerciseSelection(ex.id, ex.name, ex.category_name, exerciseBtn);
            exerciseList.appendChild(exerciseBtn);
        });
    } catch (error) {
        console.error('Error loading exercises for editing:', error);
        exerciseList.innerHTML = '<p style="color: red;">Error loading exercises</p>';
    }
}

function toggleEditExerciseSelection(exerciseId, exerciseName, categoryName, button) {
    const index = editSelectedExercises.findIndex(ex => ex.id === exerciseId);
    if (index > -1) {
        editSelectedExercises.splice(index, 1);
        button.classList.remove('selected');
    } else {
        editSelectedExercises.push({ 
            id: exerciseId, 
            name: exerciseName, 
            category_name: categoryName 
        });
        button.classList.add('selected');
    }
}

async function updateWorkoutTemplate() {
    const workoutName = document.getElementById('edit-workout-template-name').value.trim();
    
    if (!workoutName) {
        showSnack('Please enter a workout name', 'error');
        return;
    }
    
    if (editSelectedExercises.length === 0) {
        showSnack('Please select at least one exercise', 'error');
        return;
    }
    
    if (!currentEditingTemplateId) {
        showSnack('No template selected for editing', 'error');
        return;
    }
    
    try {
        const requestBody = {
            name: workoutName,
            exercises: editSelectedExercises.map((ex, idx) => ({
                exercise_name: ex.name,
                exercise_id: ex.id,
                category_name: ex.category_name,
                order: idx + 1
            }))
        };
        
        const response = await fetch(`/fitness/api/workout_templates/${currentEditingTemplateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Template updated successfully:', result);
            showEditWorkoutStep(3);
            
            // Reset form
            document.getElementById('edit-workout-template-name').value = '';
            editSelectedCategories = [];
            editSelectedExercises = [];
            currentEditingTemplateId = null;
            
            // Refresh the template list
            setTimeout(() => {
                loadWorkoutTemplatesAndDisplay();
            }, 1000);
        } else {
            const error = await response.json();
            console.error('Error response:', error);
            showSnack('Error updating template: ' + (error.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error updating workout template:', error);
        showSnack('Error updating workout template', 'error');
    }
}

function closeEditWorkoutModal() {
    document.getElementById('edit-workout-template-modal').style.display = 'none';
    // Reset form
    document.getElementById('edit-workout-template-name').value = '';
    editSelectedCategories = [];
    editSelectedExercises = [];
    currentEditingTemplateId = null;
}

function closeEditWorkoutSuccess() {
    document.getElementById('edit-workout-template-modal').style.display = 'none';
    // Reset form
    document.getElementById('edit-workout-template-name').value = '';
    editSelectedCategories = [];
    editSelectedExercises = [];
    currentEditingTemplateId = null;
}

// Add event listener for close button
document.addEventListener('DOMContentLoaded', function() {
    const closeEditModalBtn = document.getElementById('close-edit-workout-modal');
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', closeEditWorkoutModal);
    }
});

// --- Rest Timer Logic ---
let restTimerInterval = null;
let restTimerSeconds = 0;
let restTimerRunning = false;
let restTimerTotalSeconds = 0; // Store the total time for progress calculation

function updateRestTimerDisplay() {
    const display = document.getElementById('rest-timer-display');
    const progressFill = document.getElementById('timer-progress-fill');
    const status = document.getElementById('timer-status');
    
    if (display) {
        const mins = String(Math.floor(restTimerSeconds / 60)).padStart(2, '0');
        const secs = String(restTimerSeconds % 60).padStart(2, '0');
        display.textContent = `${mins}:${secs}`;
        
        // Update progress bar
        if (progressFill && restTimerTotalSeconds > 0) {
            const progress = ((restTimerTotalSeconds - restTimerSeconds) / restTimerTotalSeconds) * 100;
            progressFill.style.width = `${progress}%`;
        }
        
        // Update status
        if (status) {
            if (restTimerRunning) {
                status.textContent = 'Running';
                status.className = 'timer-status running';
                display.className = 'timer-display running';
            } else if (restTimerSeconds > 0 && restTimerSeconds < restTimerTotalSeconds) {
                status.textContent = 'Paused';
                status.className = 'timer-status paused';
                display.className = 'timer-display paused';
            } else if (restTimerSeconds === 0 && restTimerTotalSeconds > 0) {
                status.textContent = 'Completed';
                status.className = 'timer-status completed';
                display.className = 'timer-display completed';
                
                // Play completion sound or show notification
                showSnack('⏰ Rest timer completed!', 'success');
            } else {
                status.textContent = 'Ready';
                status.className = 'timer-status';
                display.className = 'timer-display';
            }
        }
    }
}

function startRestTimer() {
    if (restTimerRunning || restTimerTotalSeconds === 0) return;
    
    restTimerRunning = true;
    const startBtn = document.getElementById('start-timer');
    const pauseBtn = document.getElementById('pause-timer');
    
    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;
    
    restTimerInterval = setInterval(() => {
        if (restTimerSeconds > 0) {
            restTimerSeconds--;
            updateRestTimerDisplay();
        } else {
            // Timer completed
            stopRestTimer();
            showSnack('⏰ Rest period completed! Ready for your next set!', 'success');
        }
    }, 1000);
    
    updateRestTimerDisplay();
}

function pauseRestTimer() {
    if (!restTimerRunning) return;
    
    restTimerRunning = false;
    const startBtn = document.getElementById('start-timer');
    const pauseBtn = document.getElementById('pause-timer');
    
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;
    
    clearInterval(restTimerInterval);
    updateRestTimerDisplay();
}

function resetRestTimer() {
    restTimerRunning = false;
    restTimerSeconds = 0;
    restTimerTotalSeconds = 0;
    
    const startBtn = document.getElementById('start-timer');
    const pauseBtn = document.getElementById('pause-timer');
    const progressFill = document.getElementById('timer-progress-fill');
    
    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = true;
    if (progressFill) progressFill.style.width = '0%';
    
    clearInterval(restTimerInterval);
    updateRestTimerDisplay();
    
    // Clear active preset button
    document.querySelectorAll('.preset-btn.active').forEach(btn => {
        btn.classList.remove('active');
    });
}

function setRestTimer(seconds) {
    restTimerTotalSeconds = seconds;
    restTimerSeconds = seconds;
    restTimerRunning = false;
    
    const startBtn = document.getElementById('start-timer');
    if (startBtn) startBtn.disabled = false;
    
    clearInterval(restTimerInterval);
    updateRestTimerDisplay();
    
    // Save to localStorage for convenience
    try {
        localStorage.setItem('lastRestTimerDuration', seconds.toString());
    } catch (error) {
        console.error('Error saving timer duration:', error);
    }
}

// Load last used timer duration
function loadLastTimerDuration() {
    try {
        const savedDuration = localStorage.getItem('lastRestTimerDuration');
        if (savedDuration) {
            const seconds = parseInt(savedDuration);
            if (seconds > 0) {
                setRestTimer(seconds);
                // Removed the showMessage call to avoid popup notification
                console.log(`Loaded last timer: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
            }
        }
    } catch (error) {
        console.error('Error loading timer duration:', error);
    }
}

// Setup preset timer buttons
function setupPresetTimers() {
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const seconds = parseInt(btn.dataset.time);
            
            // Remove active class from all buttons
            presetButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            setRestTimer(seconds);
            
            // Auto-start timer for quick convenience
            setTimeout(() => {
                startRestTimer();
            }, 500);
            
            showSnack(`Timer started: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, 'success');
        });
    });
}

// Setup custom time input
function setupCustomTimeInput() {
    const customMinutes = document.getElementById('custom-minutes');
    const customSeconds = document.getElementById('custom-seconds');
    const setTimeBtn = document.getElementById('set-custom-time');
    
    if (setTimeBtn) {
        setTimeBtn.addEventListener('click', () => {
            const minutes = parseInt(customMinutes.value) || 0;
            const seconds = parseInt(customSeconds.value) || 0;
            const totalSeconds = (minutes * 60) + seconds;
            
            if (totalSeconds > 0) {
                setRestTimer(totalSeconds);
                
                // Clear active preset buttons
                document.querySelectorAll('.preset-btn.active').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                showSnack(`Custom timer set to ${minutes}:${String(seconds).padStart(2, '0')}`, 'info');
            } else {
                showSnack('Please enter a valid time', 'error');
            }
        });
    }
    
    // Allow Enter key to set time
    if (customMinutes && customSeconds) {
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                setTimeBtn.click();
            }
        };
        
        customMinutes.addEventListener('keypress', handleEnter);
        customSeconds.addEventListener('keypress', handleEnter);
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
    
    // Setup activity/workout sub-tab switching with URL state management
    const workoutsTabBtn = document.getElementById('activity-sub-tab-workouts');
    const activitiesTabBtn = document.getElementById('activity-sub-tab-activities');
    const workoutsContent = document.getElementById('activity-sub-content-workouts');
    const activitiesContent = document.getElementById('activity-sub-content-activities');

    if (workoutsTabBtn && activitiesTabBtn && workoutsContent && activitiesContent) {
        // Function to switch to workouts tab
        function switchToWorkouts() {
            workoutsTabBtn.classList.add('active');
            activitiesTabBtn.classList.remove('active');
            workoutsContent.style.display = 'block';
            activitiesContent.style.display = 'none';
            
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('activity-tab', 'workouts');
            window.history.pushState({}, '', url);
        }

        // Function to switch to activities tab
        function switchToActivities() {
            activitiesTabBtn.classList.add('active');
            workoutsTabBtn.classList.remove('active');
            activitiesContent.style.display = 'block';
            workoutsContent.style.display = 'none';
            
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('activity-tab', 'activities');
            window.history.pushState({}, '', url);
        }

        // Add event listeners
        workoutsTabBtn.addEventListener('click', switchToWorkouts);
        activitiesTabBtn.addEventListener('click', switchToActivities);

        // Check URL parameter on page load to restore state
        const urlParams = new URLSearchParams(window.location.search);
        const activityTab = urlParams.get('activity-tab');
        
        if (activityTab === 'workouts') {
            switchToWorkouts();
        } else {
            // Default to activities tab
            switchToActivities();
        }
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

    // Rest timer setup
    updateRestTimerDisplay();
    
    // Setup timer controls
    const startBtn = document.getElementById('start-timer');
    const pauseBtn = document.getElementById('pause-timer');
    const resetBtn = document.getElementById('reset-timer');
    
    if (startBtn) startBtn.addEventListener('click', startRestTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseRestTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetRestTimer);
    
    // Setup preset timers and custom time input
    setupPresetTimers();
    setupCustomTimeInput();
    
    // Load last used timer duration
    loadLastTimerDuration();
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
    if (exerciseName) {
        loadPersonalRecords(exerciseName);
    }
    
    // Test favorite status
    if (exerciseId) {
        updateFavoriteButtonStatus(exerciseId);
    }
    
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
    showSnack('Last inputs cleared for ' + exerciseName, 'info');
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

// Function to load and apply a workout template
async function loadAndApplyTemplate(templateId) {
    try {
        console.log('Loading template with ID:', templateId);
        const response = await fetch(`/fitness/api/workout_templates/${templateId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const template = await response.json();
        
        console.log('Template loaded:', template);
        
        // Create a workout session from the template
        const today = new Date().toISOString().split('T')[0];
        const sessionData = {
            name: template.name,
            date: today,
            template_id: templateId,
            exercises: template.exercises.map(ex => ({
                exercise_name: ex.exercise_name,
                category_name: ex.category_name
            }))
        };
        
        console.log('Creating workout session with data:', sessionData);
        
        const sessionResponse = await fetch('/fitness/api/workout_sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
        
        if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            console.error('Session creation failed:', errorText);
            throw new Error(`Failed to create workout session: ${sessionResponse.status} - ${errorText}`);
        }
        
        const session = await sessionResponse.json();
        console.log('Workout session created:', session);
        
        // Show success message
        showSnack(`Workout "${template.name}" loaded successfully!`, 'success');
        
        // Redirect to workout session page
        startSessionFromTemplate(templateId, template.name);
        
    } catch (error) {
        console.error('Error loading template:', error);
        showSnack('Failed to load workout template', 'error');
    }
}

// Check for template_id parameter on page load
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const templateId = urlParams.get('template_id');
    
    if (templateId) {
        console.log('Template ID found in URL:', templateId);
        // Load the template after a short delay to ensure everything is initialized
        setTimeout(() => {
            loadAndApplyTemplate(templateId);
        }, 500);
    }
});

// Test function for debugging workout templates
window.debugWorkoutTemplates = function() {
    console.log('=== WORKOUT TEMPLATE DEBUG ===');
    
    // Test 1: Check if we can load templates
    console.log('1. Testing template loading...');
    loadWorkoutTemplatesAndDisplay();
    
    // Test 2: Check selected exercises
    console.log('2. Selected exercises:', selectedExercises);
    console.log('3. Selected categories:', selectedCategories);
    
    // Test 3: Check DOM elements
    console.log('4. DOM elements:', {
        templateList: !!document.getElementById('workout-template-list'),
        startWorkoutModal: !!document.getElementById('start-workout-modal'),
        multiCategoryList: !!document.getElementById('multi-category-list'),
        multiExerciseList: !!document.getElementById('multi-exercise-list')
    });
    
    // Test 4: Test API directly
    fetch('/fitness/api/workout_templates')
        .then(response => response.json())
        .then(templates => {
            console.log('5. API response:', templates);
            if (templates.length > 0) {
                console.log('6. First template details:', templates[0]);
            }
        })
        .catch(error => {
            console.error('7. API error:', error);
        });
    
    console.log('=== DEBUG COMPLETE ===');
};

// Test function for creating a sample template
window.createSampleTemplate = function() {
    console.log('Creating sample template...');
    
    // Set up sample data
    selectedCategories = [{ id: 1, name: 'Chest' }];
    selectedExercises = [
        { id: 1, name: 'Bench Press', category_name: 'Chest' },
        { id: 2, name: 'Push-ups', category_name: 'Chest' }
    ];
    
    // Set the workout name
    const nameInput = document.getElementById('workout-template-name');
    if (nameInput) {
        nameInput.value = 'Sample Chest Workout';
    }
    
    console.log('Sample data set up:', {
        categories: selectedCategories,
        exercises: selectedExercises,
        name: nameInput ? nameInput.value : 'Sample Chest Workout'
    });
    
    // Save the template
    saveWorkoutTemplateInternal();
};

// Expose edit modal functions to window for inline HTML access
window.editWorkoutTemplate = editWorkoutTemplate;
window.nextToEditExerciseSelection = nextToEditExerciseSelection;
window.backToEditName = backToEditName;
window.loadEditExercisesForSelectedCategories = loadEditExercisesForSelectedCategories;
window.updateWorkoutTemplate = updateWorkoutTemplate;
window.closeEditWorkoutModal = closeEditWorkoutModal;
window.closeEditWorkoutSuccess = closeEditWorkoutSuccess;

// Utility to start a session from a template and redirect
async function startSessionFromTemplate(templateId, templateName) {
    const today = new Date().toISOString().split('T')[0];
    // Use a unique session name per template per day
    const sessionName = (templateName ? templateName : 'Workout') + ' - ' + today;
    try {
        const resp = await fetch('/fitness/api/workout_sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: sessionName,
                date: today,
                template_id: templateId
            })
        });
        const result = await resp.json();
        if (resp.ok && result.session && result.session.id) {
            window.location.href = `/fitness/workout_entry?session_id=${result.session.id}`;
        } else {
            alert(result.error || 'Failed to start session');
        }
    } catch (err) {
        alert('Error starting session: ' + err.message);
    }
} 