import { showSnack } from './utils.js';

// Helper function to format date string
function formatDate(dateString) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const parts = dateString.split('-').map(part => parseInt(part, 10));
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-US', options);
}

document.addEventListener('DOMContentLoaded', () => {
    // Move OCR processing functionality inside DOMContentLoaded
    async function processOCR() {
        console.log('processOCR function called');
        const fileInput = document.getElementById('bodyscan_image');
        if (!fileInput.files[0]) {
            alert('Please select an image file first');
            return;
        }
        const formData = new FormData();
        formData.append('bodyscan_image', fileInput.files[0]);

        try {
            const response = await fetch('/fitness/process_ocr', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                const params = new URLSearchParams({
                    image_path: result.image_path,
                    temp_filename: result.temp_filename,
                    metrics: JSON.stringify(result.metrics)
                });
                window.location.href = `/fitness/review_ocr?${params.toString()}`;
            } else {
                alert(result.error || 'OCR processing failed');
            }
        } catch (error) {
            console.error('OCR processing error:', error);
            alert('OCR processing failed: ' + error.message);
        }
    }

    const ocrButton = document.getElementById('process-ocr-btn');
    if (ocrButton) {
        ocrButton.addEventListener('click', processOCR);
    }
    
    const statsForm = document.getElementById('stats-form');
    const foodForm = document.getElementById('food-entry-form');
    const manualCaloriesForm = document.getElementById('manual-calories-form');
    const workoutForm = document.getElementById('workout-form');
    const profileForm = document.getElementById('profile-form');
    const activityForm = document.getElementById('activity-form');
    const editActivityForm = document.getElementById('edit-activity-form');
    const statsTable = document.getElementById('stats-table')?.querySelector('tbody');
    const foodTable = document.getElementById('food-entries-table')?.querySelector('tbody');
    const workoutTable = document.getElementById('workout-table')?.querySelector('tbody');
    const activityTable = document.getElementById('activity-table')?.querySelector('tbody');
    const tdeeSummary = document.getElementById('tdee-summary');
    const tdeeHistoryTable = document.getElementById('tdee-history-table')?.querySelector('tbody');
    const nutritionSummaryDisplay = document.getElementById('nutrition-summary-display');
    const activityTypeSelect = document.getElementById('activity-type');
    const customActivityInput = document.getElementById('custom-activity-type');
    const editActivityTypeSelect = document.getElementById('edit-activity-type');    
    const editCustomActivityInput = document.getElementById('edit-custom-activity-type');
    const saveActivityBtn = document.getElementById('save-activity-btn');
    const editActivityModal = document.getElementById('edit-activity-modal');
    const closeModal = editActivityModal?.querySelector('.close');
    const cancelModalBtn = editActivityModal?.querySelector('.cancel');
    const editFoodModal = document.getElementById('edit-food-modal');
    const editFoodClose = editFoodModal?.querySelector('.close');
    const editFoodCancel = editFoodModal?.querySelector('.cancel');
    const editFoodForm = document.getElementById('edit-food-form');
    
    // Milestone-related DOM elements
    const changeMilestoneBtn = document.getElementById('change-milestone-btn');
    const resetMilestoneBtn = document.getElementById('reset-milestone-btn');
    const currentMilestoneSection = document.getElementById('current-milestone');
    const milestoneTrailSelect = document.getElementById('milestone-trail');
    const setMilestoneBtn = document.getElementById('set-milestone-btn');
    
    let tdeeChartInstance = null;

    const recordTdeeBtn = document.getElementById('record-tdee-btn');

    if (recordTdeeBtn) {
        recordTdeeBtn.addEventListener('click', async () => {
            const today = new Date().toISOString().split('T')[0];
            try {
                const response = await fetch('/fitness/record_daily_tdee', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ date: today })
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message, 'success');
                    // Reload TDEE data to show the new record
                    loadTDEE();
                    loadTDEEHistory();
                } else {
                    showSnack(result.error, 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

    // Initialize date fields
    const today = new Date().toISOString().split('T')[0];
    const foodDateInput = document.getElementById('food-date');
    const manualDateInput = document.getElementById('manual-date');
    const workoutDateInput = document.getElementById('workout-date');
    const activityDateInput = document.getElementById('activity-date');
    const editActivityDateInput = document.getElementById('edit-activity-date');

    if (foodDateInput) foodDateInput.value = today;
    if (manualDateInput) manualDateInput.value = today;
    if (workoutDateInput) workoutDateInput.value = today;
    if (activityDateInput) activityDateInput.value = today;
    if (editActivityDateInput) editActivityDateInput.value = today;

    // Activity Form Validation
    function validateActivityForm() {
        const activityType = activityTypeSelect?.value;
        const customActivity = customActivityInput?.value.trim();
        const duration = document.getElementById('duration')?.value;
        const intensity = document.getElementById('intensity')?.value;
        const isValid = activityType && duration > 0 && intensity && (activityType !== 'Other' || customActivity);
        if (saveActivityBtn) {
            saveActivityBtn.disabled = !isValid;
        }
    }

    if (activityTypeSelect && customActivityInput) {
        activityTypeSelect.addEventListener('change', () => {
            customActivityInput.style.display = activityTypeSelect.value === 'Other' ? 'block' : 'none';
            validateActivityForm();
            // Show miles field for cycling, running, walking
            const milesGroup = document.getElementById('miles-group');
            if (['Cycling', 'Running', 'Walking'].includes(activityTypeSelect.value)) {
                milesGroup.style.display = 'block';
            } else {
                milesGroup.style.display = 'none';
                document.getElementById('miles').value = '';
            }
        });
        document.getElementById('duration')?.addEventListener('input', validateActivityForm);
        document.getElementById('intensity')?.addEventListener('change', validateActivityForm);
        customActivityInput.addEventListener('input', validateActivityForm);
        validateActivityForm();
    }

    if (editActivityTypeSelect && editCustomActivityInput) {
        editActivityTypeSelect.addEventListener('change', () => {
            if (editCustomActivityInput) {
                editCustomActivityInput.style.display = editActivityTypeSelect.value === 'Other' ? 'block' : 'none';
            }
        });
    }
    // Stats Form
    if (statsForm) {
        statsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(statsForm);
            try {
                const response = await fetch('/fitness/add_stat', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message, 'success');
                    statsForm.reset();
                    loadStats();
                    loadTDEE();
                    loadTDEEHistory();
                } else {
                    showSnack(result.error, 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

        // Food Form Submission
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
                    const foodDateInput = document.getElementById('food-date');
                    if (foodDateInput) foodDateInput.value = today;
                    loadFoodEntries();
                    loadTDEE();
                    loadTDEEHistory();
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

    // Workout Form
    const fullWorkoutHistoryTable = document.getElementById('full-workout-history-table')?.querySelector('tbody');

    if (workoutForm) {
        workoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(workoutForm);
            try {
                const response = await fetch('/fitness/add_workout', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message, 'success');
                    
                    // Check for PR achievements and play audio
                    if (result.prs_achieved && result.prs_achieved.length > 0) {
                        console.log('PRs achieved:', result.prs_achieved);
                        handlePRAchievement(result.prs_achieved, result.exercise);
                    }
                    
                    // Reset only weight and reps, keep date and exercise
                    document.getElementById('weight').value = '';
                    document.getElementById('reps').value = '';
                    loadTodaysWorkout();
                    loadFullWorkoutHistory();
                    loadTDEE();
                    loadTDEEHistory();
                } else {
                    showSnack(result.error, 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

    // Profile Form
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            try {
                const response = await fetch('/update_profile', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message, 'success');
                    profileForm.reset();
                    loadActivities();
                } else {
                    showSnack(result.error, 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

        // Activity Form
    if (activityForm) {
        activityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(activityForm);
            // Remove daily activity level from form data since it shouldn't be saved with individual activities
            formData.delete('daily_activity_level');
            // Add current date as activity_date
            const today = new Date().toISOString().split('T')[0];
            formData.set('activity_date', today);
            try {
                const response = await fetch('/fitness/add_activity', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message, 'success');
                    activityForm.reset();
                    loadActivities();
                    loadTDEE();
                    loadTDEEHistory();
                } else {
                    showSnack(result.error, 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

    // Activity level change handlers for real-time TDEE updates
    const dailyActivityLevel = document.getElementById('daily-activity-level');
    
    if (dailyActivityLevel) {
        dailyActivityLevel.addEventListener('change', function() {
            loadTDEE();
        });
    }

    // Edit Activity Form
    if (editActivityForm) {
        editActivityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(editActivityForm);
            
            // Remove daily activity level from form data since it shouldn't be saved with individual activities
            formData.delete('daily_activity_level');
            
            try {
                const response = await fetch('/fitness/edit_activity', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message, 'success');
                    editActivityModal.style.display = 'none';
                    loadActivities();
                    loadTDEE();
                    loadTDEEHistory();
                } else {
                    showSnack(result.error, 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

    // Modal Controls
    if (closeModal && cancelModalBtn) {
        closeModal.addEventListener('click', () => {
            if (editActivityModal) {
                editActivityModal.style.display = 'none';
            }
        });
        cancelModalBtn.addEventListener('click', () => {
            if (editActivityModal) {
                editActivityModal.style.display = 'none';
            }
        });
    }

    // Edit Food Entry Modal Event Listeners
    if (editFoodClose) {
        editFoodClose.addEventListener('click', () => {
            if (editFoodModal) editFoodModal.style.display = 'none';
        });
    }

    if (editFoodCancel) {
        editFoodCancel.addEventListener('click', () => {
            if (editFoodModal) editFoodModal.style.display = 'none';
        });
    }

    if (editFoodForm) {
        editFoodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(editFoodForm);
            const foodId = formData.get('id');
            
            const data = {
                date: formData.get('date'),
                food_name: formData.get('food_name'),
                calories: formData.get('calories'),
                protein: formData.get('protein'),
                carbs: formData.get('carbs'),
                fat: formData.get('fat'),
                quantity: formData.get('quantity'),
                unit: formData.get('unit')
            };
            
            try {
                const response = await fetch(`/fitness/edit_food_entry/${foodId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message, 'success');
                    if (editFoodModal) editFoodModal.style.display = 'none';
                    loadFoodEntries();
                    loadTDEE();
                    loadTDEEHistory();
                    // Reload nutrition summary for current date
                    const currentDate = document.getElementById('manual-date')?.value || 
                                      document.getElementById('food-date')?.value || 
                                      new Date().toISOString().split('T')[0];
                    loadDailyNutrition(currentDate);
                } else {
                    showSnack(result.error, 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

    // Sub-tab switching
    const subTabButtons = document.querySelectorAll('.sub-tab-button');
    subTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const subTabId = button.getAttribute('data-sub-tab');
            document.querySelectorAll('.sub-tab-content').forEach(content => {
                content.style.display = content.id === subTabId ? 'block' : 'none';
            });
            subTabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Load data for the active sub-tab
            if (subTabId === 'stats') {
                loadStats();
            } else if (subTabId === 'food') {
                loadFoodEntries();
                // Load nutrition summary for today's date
                loadDailyNutrition(today);
            } else if (subTabId === 'history') {
                loadFullWorkoutHistory();
            } else if (subTabId === 'activity') {
                // Load activities sub-tab by default
                const activitiesContent = document.getElementById('activity-sub-content-activities');
                const activitiesButton = document.getElementById('activity-sub-tab-activities');
                activitiesContent.classList.add('active');
                activitiesContent.style.display = 'block';
                activitiesButton.classList.add('active');
                document.getElementById('activity-sub-content-workouts').style.display = 'none';
                loadActivities();
                loadTDEE();
                loadTDEEHistory();
                
                // Check if workouts sub-tab should be active (from URL or other state)
                const workoutsSubTab = document.getElementById('activity-sub-tab-workouts');
                if (workoutsSubTab && workoutsSubTab.classList.contains('active')) {
                    // Switch to workouts sub-tab
                    activitiesContent.classList.remove('active');
                    activitiesContent.style.display = 'none';
                    activitiesButton.classList.remove('active');
                    const workoutsContent = document.getElementById('activity-sub-content-workouts');
                    workoutsContent.classList.add('active');
                    workoutsContent.style.display = 'block';
                    workoutsSubTab.classList.add('active');
                    loadTodaysWorkout();
                    loadExerciseCategories();
                }
            } else if (subTabId === 'leaderboard') {
                loadLeaderboard();
            }
        });
    });

    async function loadStats() {
        const statsTable = document.getElementById('stats-table')?.querySelector('tbody');
        if (document.querySelector('#stats.sub-tab-content')?.style.display !== 'block') return;
        try {
            const response = await fetch('/fitness/api/data');
            const stats = await response.json();
            if (statsTable) {
                statsTable.innerHTML = '';
                // Reverse the stats array so the most recent entry is at the top
                stats.slice().reverse().forEach(stat => {
                    // Create main row
                    const row = document.createElement('tr');
                    row.className = 'expandable-row';
                    row.setAttribute('data-stat-id', stat.id);
                    
                    const imageCell = stat.bodyscan_image_path 
                        ? `<a href="/${stat.bodyscan_image_path}" target="_blank">View Scan</a>`
                        : 'No Scan';

                    row.innerHTML = `
                        <td>
                            <span class="expand-icon">▶</span>
                            ${stat.date}
                        </td>
                        <td>${stat.weight || ''}</td>
                        <td>${stat.body_fat_percentage || ''}</td>
                        <td>${stat.smm || ''}</td>
                        <td>${stat.body_fat_mass || ''}</td>
                        <td>${stat.lean_body_mass || ''}</td>
                        <td>${stat.bmr || ''}</td>
                        <td>${imageCell}</td>
                        <td>
                            <button class="action-btn edit-icon" onclick="editStat(${stat.id})" title="Edit">✏️</button>
                            <button class="action-btn delete-icon" onclick="deleteStat(${stat.id})" title="Delete">✕</button>
                        </td>
                    `;
                    statsTable.appendChild(row);

                    // Create details row
                    const detailsRow = document.createElement('tr');
                    detailsRow.className = 'details-row';
                    detailsRow.setAttribute('data-stat-id', stat.id);
                    
                    const detailsContent = `
                        <td colspan="9">
                            <div class="details-content">
                                <h4>Complete Body Composition Data</h4>
                                <div class="details-grid">
                                    <div class="detail-item">
                                        <span class="detail-label">Weight:</span>
                                        <span class="detail-value">${stat.weight || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Body Fat %:</span>
                                        <span class="detail-value">${stat.body_fat_percentage || 'N/A'}%</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Skeletal Muscle Mass:</span>
                                        <span class="detail-value">${stat.smm || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Body Fat Mass:</span>
                                        <span class="detail-value">${stat.body_fat_mass || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Lean Body Mass:</span>
                                        <span class="detail-value">${stat.lean_body_mass || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Basal Metabolic Rate:</span>
                                        <span class="detail-value">${stat.bmr || 'N/A'} kcal</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Left Arm Lean Mass:</span>
                                        <span class="detail-value">${stat.left_arm_lean_mass || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Right Arm Lean Mass:</span>
                                        <span class="detail-value">${stat.right_arm_lean_mass || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Left Leg Lean Mass:</span>
                                        <span class="detail-value">${stat.left_leg_lean_mass || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Right Leg Lean Mass:</span>
                                        <span class="detail-value">${stat.right_leg_lean_mass || 'N/A'} lbs</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Trunk Lean Mass:</span>
                                        <span class="detail-value">${stat.trunk_lean_mass || 'N/A'} lbs</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                    `;
                    detailsRow.innerHTML = detailsContent;
                    statsTable.appendChild(detailsRow);

                    // Add click handler for expandable row
                    row.addEventListener('click', function(e) {
                        // Don't expand if clicking on action buttons
                        if (e.target.closest('.action-btn')) return;
                        
                        const statId = this.getAttribute('data-stat-id');
                        const detailsRow = document.querySelector(`.details-row[data-stat-id="${statId}"]`);
                        const expandIcon = this.querySelector('.expand-icon');
                        
                        if (detailsRow.classList.contains('show')) {
                            detailsRow.classList.remove('show');
                            expandIcon.classList.remove('expanded');
                        } else {
                            detailsRow.classList.add('show');
                            expandIcon.classList.add('expanded');
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            showSnack('Failed to load stats', 'error');
        }
    }

    async function loadActivities() {
        if (document.querySelector('#activity.sub-tab-content')?.style.display !== 'block') return;
        try {
            let date = document.getElementById('activity-date')?.value;
            if (!date) {
                const today = new Date();
                date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            }
            const response = await fetch(`/fitness/api/activities?date=${date}`);
            const activities = await response.json();
            const activityTable = document.getElementById('activity-table')?.querySelector('tbody');
            if (activityTable) {
                activityTable.innerHTML = '';
                let totalCalories = 0;
                activities.forEach(a => {
                    totalCalories += a.calories_burned || 0;
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${a.date}</td>
                        <td>${a.activity_type}</td>
                        <td>${a.duration}</td>
                        <td>${a.miles != null && a.miles !== undefined ? a.miles : ''}</td>
                        <td>${a.intensity}</td>
                        <td>${a.calories_burned}</td>
                        <td>
                            <button class="action-btn edit-icon" onclick="editActivity(${a.id})" title="Edit">✏️</button>
                            <button class="action-btn delete-icon" onclick="deleteActivity(${a.id})" title="Delete">✕</button>
                        </td>
                    `;
                    activityTable.appendChild(row);
                });
                const totalCaloriesElement = document.getElementById('total-calories-burned');
                if (totalCaloriesElement) {
                    totalCaloriesElement.innerHTML = `<p>Total Calories Burned: ${totalCalories} kcal</p>`;
                }
            }
        } catch (error) {
            console.error('Error loading activities:', error);
            showSnack('Failed to load activities', 'error');
        }
    }

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

    // Add loading flag to prevent duplicate calls
    let isLoadingWorkouts = false;

    async function loadTodaysWorkout() {
        // Prevent multiple simultaneous calls
        if (isLoadingWorkouts) {
            console.log('Workout loading already in progress, skipping...');
            return;
        }
        
        isLoadingWorkouts = true;
        
        const workoutTableElement = document.getElementById('workout-table');
        const workoutTable = workoutTableElement ? workoutTableElement.querySelector('tbody') : null;
        if (!workoutTable || !workoutTableElement) {
            console.log('Workout table not found, skipping load');
            isLoadingWorkouts = false;
            return;
        }
        
        try {
            const today = new Date().toISOString().split('T')[0];
            console.log('Loading workouts for date:', today);
            const response = await fetch(`/fitness/api/workouts_by_date?date=${today}`);
            const workouts = await response.json();
            console.log('API response for today\'s workouts:', workouts);
            console.log('Number of workouts found:', workouts.length);
            
            if (!workoutTable || !workoutTableElement) {
                console.log('Workout table became null during fetch, skipping load');
                isLoadingWorkouts = false;
                return;
            }
            
            // Clear the table completely before adding new data
            workoutTable.innerHTML = '';
            
            // Group by exercise
            const setsByExercise = workouts.reduce((acc, w) => {
                if (!acc[w.exercise]) {
                    acc[w.exercise] = [];
                }
                acc[w.exercise].push(w);
                return acc;
            }, {});
            
            console.log('Grouped workouts by exercise:', setsByExercise);
            console.log('Number of exercises with workouts:', Object.keys(setsByExercise).length);

            if (Object.keys(setsByExercise).length === 0) {
                workoutTable.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #666; font-style: italic;">No workouts logged for today. Start your workout above!</td></tr>';
                console.log('No workouts found for today');
                isLoadingWorkouts = false;
                return;
            }
            
            for (const exerciseName in setsByExercise) {
                const sets = setsByExercise[exerciseName];
                
                // Check if this is a barbell exercise
                let isBarbellExercise = false;
                try {
                    const exerciseResponse = await fetch('/fitness/api/exercises');
                    const allExercises = await exerciseResponse.json();
                    const exercise = allExercises.find(ex => ex.name === exerciseName);
                    isBarbellExercise = exercise && exercise.equipment && exercise.equipment.toLowerCase() === 'barbell';
                } catch (error) {
                    console.error('Error checking exercise equipment:', error);
                }
                
                sets.forEach((w, index) => {
                    const row = document.createElement('tr');
                    const totalWeight = isBarbellExercise ? (w.weight + 45) : w.weight;
                    
                    row.innerHTML = `
                        ${index === 0 ? `<td rowspan="${sets.length}">${w.category || 'N/A'}</td>` : ''}
                        ${index === 0 ? `<td rowspan="${sets.length}">
                            <a href="/fitness/workout_entry?category_id=${w.category_id || ''}&category_name=${encodeURIComponent(w.category || '')}&exercise=${encodeURIComponent(w.exercise)}" 
                               class="exercise-link" 
                               style="color: #007bff; text-decoration: none; font-weight: 500; cursor: pointer;"
                               onmouseover="this.style.textDecoration='underline'"
                               onmouseout="this.style.textDecoration='none'">
                                ${w.exercise}
                            </a>
                        </td>` : ''}
                        <td>${index + 1}</td>
                        <td><strong>${totalWeight}</strong></td>
                        <td>${w.reps}</td>
                        <td>
                            <button class="action-btn edit-icon" onclick="editWorkout(${w.id})" title="Edit">✏️</button>
                        </td>
                    `;
                    
                    console.log(`Adding row ${index + 1} for ${w.exercise}:`, row.outerHTML.substring(0, 200) + '...');
                    workoutTable.appendChild(row);
                    console.log(`Row ${index + 1} added. Table now has ${workoutTable.children.length} children`);
                });
            }
            console.log('Finished populating workout table. Total rows added:', workoutTable.children.length);
            console.log('Table element display style:', workoutTableElement.style.display);
            console.log('Table element visibility:', workoutTableElement.style.visibility);
            console.log('Table container display style:', workoutTableElement.parentElement?.style.display);
            console.log('Table HTML:', workoutTableElement.outerHTML.substring(0, 500) + '...');
            
            // Debug: Check if table has any content
            const tbody = workoutTableElement.querySelector('tbody');
            if (tbody) {
                console.log('Table body children count:', tbody.children.length);
                console.log('Table body HTML:', tbody.innerHTML.substring(0, 300) + '...');
            }
            
            // Apply styling to the main table element IMMEDIATELY
            console.log('Applying table styling...');
            workoutTableElement.style.display = 'table';
            workoutTableElement.style.visibility = 'visible';
            workoutTableElement.style.width = '100%';
            workoutTableElement.style.borderCollapse = 'collapse';
            workoutTableElement.style.marginTop = '10px';
            console.log('Table styling applied. Display style now:', workoutTableElement.style.display);
            console.log('Table styling applied. Visibility now:', workoutTableElement.style.visibility);
            
            // Force styles with !important to override any CSS
            workoutTableElement.style.setProperty('display', 'table', 'important');
            workoutTableElement.style.setProperty('visibility', 'visible', 'important');
            workoutTableElement.style.setProperty('opacity', '1', 'important');
            console.log('Forced styling applied. Display style now:', workoutTableElement.style.display);
            
            // Apply styling to all rows
            const rows = workoutTable.querySelectorAll('tr');
            rows.forEach(row => {
                row.style.display = 'table-row';
                row.style.visibility = 'visible';
                row.style.opacity = '1';
                row.style.height = 'auto';
                row.style.minHeight = '20px';
            });
            
            // Force table cells to be visible
            const cells = workoutTable.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.style.display = 'table-cell';
                cell.style.visibility = 'visible';
                cell.style.opacity = '1';
                cell.style.padding = '8px';
                cell.style.border = '1px solid #ddd';
            });
            
            console.log('Table styling applied. Rows found:', rows.length);
            
            // Add a visual indicator to confirm table is there
            const firstRow = workoutTable.querySelector('tr');
            if (firstRow) {
                console.log('First row content:', firstRow.innerHTML.substring(0, 200) + '...');
                // Add a background color to make it more visible
                firstRow.style.backgroundColor = '#f0f8ff';
            }
            
            // Check if the table section is visible
            const workoutSection = document.getElementById('workout-today-section');
            if (workoutSection) {
                console.log('Workout section display:', workoutSection.style.display);
                console.log('Workout section visibility:', workoutSection.style.visibility);
                workoutSection.style.display = 'block';
                workoutSection.style.visibility = 'visible';
                
                // Also ensure the parent container is visible
                const parentContainer = workoutSection.parentElement;
                if (parentContainer) {
                    console.log('Parent container display:', parentContainer.style.display);
                    parentContainer.style.display = 'block';
                    parentContainer.style.visibility = 'visible';
                }
                
                // Force the table to be visible with !important
                workoutTableElement.style.setProperty('display', 'table', 'important');
                workoutTableElement.style.setProperty('visibility', 'visible', 'important');
                workoutTableElement.style.setProperty('opacity', '1', 'important');
            }
        } catch (error) {
            console.error('Error loading today\'s workouts:', error);
            if (workoutTable) {
                workoutTable.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #ff6b6b;">Failed to load workout data. Please refresh the page.</td></tr>';
            }
            showSnack('Failed to load today\'s workout', 'error');
        } finally {
            isLoadingWorkouts = false;
        }
    }

    async function loadFullWorkoutHistory() {
        if (!fullWorkoutHistoryTable) return;
        try {
            const response = await fetch('/fitness/api/workouts');
            const workouts = await response.json();
            fullWorkoutHistoryTable.innerHTML = '';
            
            // Get all exercises to map names to category_ids and check for barbell exercises
            const exerciseResponse = await fetch('/fitness/api/exercises');
            const allExercises = await exerciseResponse.json();
            const exerciseMap = {};
            const barbellExercises = new Set();
            allExercises.forEach(ex => {
                exerciseMap[ex.name] = ex.category_id;
                if (ex.equipment && ex.equipment.toLowerCase() === 'barbell') {
                    barbellExercises.add(ex.name);
                }
            });
            
            // Update table header to include total weight
            const tableHead = fullWorkoutHistoryTable.parentElement.querySelector('thead tr');
            if (tableHead && !tableHead.querySelector('th[data-total-weight]')) {
                const weightHeader = tableHead.querySelector('th:nth-child(5)'); // Weight column
                if (weightHeader) {
                    const totalWeightHeader = document.createElement('th');
                    totalWeightHeader.setAttribute('data-total-weight', 'true');
                    totalWeightHeader.textContent = 'Total Weight';
                    weightHeader.after(totalWeightHeader);
                }
            }
            
            workouts.forEach(w => {
                const row = document.createElement('tr');
                const categoryId = exerciseMap[w.exercise] || '';
                const isBarbellExercise = barbellExercises.has(w.exercise);
                const totalWeight = isBarbellExercise ? (w.weight + 45) : w.weight;
                
                row.innerHTML = `
                    <td>${w.date}</td>
                    <td>${w.category || 'N/A'}</td>
                    <td>
                        <a href="/fitness/workout_entry?category_id=${categoryId}&category_name=${encodeURIComponent(w.category || '')}&exercise=${encodeURIComponent(w.exercise)}" 
                           class="exercise-link" 
                           style="color: #007bff; text-decoration: none; font-weight: 500; cursor: pointer;"
                           onmouseover="this.style.textDecoration='underline'"
                           onmouseout="this.style.textDecoration='none'">
                            ${w.exercise}
                        </a>
                    </td>
                    <td>${w.weight}</td>
                    <td><strong>${totalWeight}</strong></td>
                    <td>${w.reps}</td>
                    <td>${w.sets}</td>
                `;
                fullWorkoutHistoryTable.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading workout history:', error);
            showSnack('Failed to load workout history', 'error');
        }
    }

    // Edit and Delete Functions
    window.editStat = async function(id) {
        try {
            const response = await fetch('/fitness/api/data');
            const stats = await response.json();
            const stat = stats.find(s => s.id === id);
            if (!stat) {
                showSnack('Stat not found', 'error');
                    return;
                }
            document.getElementById('edit-stat-id').value = stat.id;
            document.getElementById('edit-stat-date').value = stat.date;
            document.getElementById('edit-stat-weight').value = stat.weight || '';
            document.getElementById('edit-stat-body-fat-percentage').value = stat.body_fat_percentage || '';
            document.getElementById('edit-stat-smm').value = stat.smm || '';
            document.getElementById('edit-stat-body-fat-mass').value = stat.body_fat_mass || '';
            document.getElementById('edit-stat-lean-body-mass').value = stat.lean_body_mass || '';
            document.getElementById('edit-stat-bmr').value = stat.bmr || '';
            document.getElementById('edit-stat-resting-heart-rate').value = stat.resting_heart_rate || '';
            document.getElementById('edit-stat-bicep-measurement').value = stat.bicep_measurement || '';
            document.getElementById('edit-stat-chest-measurement').value = stat.chest_measurement || '';
            document.getElementById('edit-stat-waist-measurement').value = stat.waist_measurement || '';
            document.getElementById('edit-stat-butt-measurement').value = stat.butt_measurement || '';
            document.getElementById('edit-stat-quad-measurement').value = stat.quad_measurement || '';
            document.getElementById('edit-stat-left-arm-lean-mass').value = stat.left_arm_lean_mass || '';
            document.getElementById('edit-stat-right-arm-lean-mass').value = stat.right_arm_lean_mass || '';
            document.getElementById('edit-stat-left-leg-lean-mass').value = stat.left_leg_lean_mass || '';
            document.getElementById('edit-stat-right-leg-lean-mass').value = stat.right_leg_lean_mass || '';
            document.getElementById('edit-stat-trunk-lean-mass').value = stat.trunk_lean_mass || '';
            document.getElementById('edit-stat-modal').style.display = 'flex';
        } catch (error) {
            showSnack('Error loading stat', 'error');
        }
    };

    document.getElementById('close-edit-stat-modal').addEventListener('click', function() {
        document.getElementById('edit-stat-modal').style.display = 'none';
    });
    document.getElementById('cancel-edit-stat').addEventListener('click', function() {
        document.getElementById('edit-stat-modal').style.display = 'none';
    });

    document.getElementById('edit-stat-form').addEventListener('submit', async function(e) {
            e.preventDefault();
        const form = e.target;
        const id = document.getElementById('edit-stat-id').value;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(`/fitness/edit_stat/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok) {
                showSnack(result.message, 'success');
                document.getElementById('edit-stat-modal').style.display = 'none';
                loadStats();
                    loadTDEE();
                    loadTDEEHistory();
                } else {
                showSnack(result.error, 'error');
                }
            } catch (error) {
            showSnack('Error updating stat', 'error');
            }
        });
    
    function editFood(id) { showSnack('Edit Food ID: ' + id, 'error'); }

    // Motivation Tab Functionality
    const refreshQuoteBtn = document.getElementById('refresh-quote-btn');
    const goalForm = document.getElementById('goal-form');
    const goalsList = document.getElementById('goals-list');

    // Motivational quotes array
    const motivationalQuotes = [
        { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
        { text: "Strength does not come from the physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
        { text: "The difference between the impossible and the possible lies in determination.", author: "Tommy Lasorda" },
        { text: "Success isn't always about greatness. It's about consistency.", author: "Dwayne Johnson" },
        { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "Unknown" },
        { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
        { text: "Don't wish for it. Work for it.", author: "Unknown" },
        { text: "The hard days are what make you stronger.", author: "Aly Raisman" },
        { text: "If you want something you've never had, you must be willing to do something you've never done.", author: "Thomas Jefferson" },
        { text: "The only way to define your limits is by going beyond them.", author: "Arthur C. Clarke" },
        { text: "Pain is temporary. Quitting lasts forever.", author: "Lance Armstrong" },
        { text: "Make yourself proud.", author: "Unknown" },
        { text: "The only workout you'll regret is the one you didn't do.", author: "Unknown" },
        { text: "Your future self is watching you right now through memories.", author: "Unknown" },
        { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" }
    ];

    // Function to get random quote
    function getRandomQuote() {
        const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
        return motivationalQuotes[randomIndex];
    }

    // Function to update quote display
    function updateQuote() {
        const quote = getRandomQuote();
        document.getElementById('daily-quote').textContent = quote.text;
        document.getElementById('quote-author').textContent = `- ${quote.author}`;
    }

    // Event listener for refresh quote button
    if (refreshQuoteBtn) {
        refreshQuoteBtn.addEventListener('click', updateQuote);
    }

    // Goal management
    let userGoals = JSON.parse(localStorage.getItem('fitnessGoals')) || [];

    // Function to save goals to localStorage
    function saveGoals() {
        localStorage.setItem('fitnessGoals', JSON.stringify(userGoals));
    }

    // Function to render goals
    function renderGoals() {
        if (userGoals.length === 0) {
            goalsList.innerHTML = '<p>No goals set yet. Add your first goal above!</p>';
            return;
        }

        goalsList.innerHTML = userGoals.map((goal, index) => {
            const deadline = new Date(goal.deadline);
            const today = new Date();
            const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
            
            let status = 'active';
            let statusText = 'Active';
            if (goal.completed) {
                status = 'completed';
                statusText = 'Completed';
            } else if (daysLeft < 0) {
                status = 'overdue';
                statusText = 'Overdue';
            }

            return `
                <div class="goal-item ${status}">
                    <div class="goal-header">
                        <div class="goal-title">${goal.description}</div>
                        <span class="goal-status ${status}">${statusText}</span>
                    </div>
                    <div class="goal-details">
                        <p><strong>Type:</strong> ${goal.type}</p>
                        ${goal.target ? `<p><strong>Target:</strong> ${goal.target}</p>` : ''}
                        <p><strong>Deadline:</strong> ${goal.deadline}</p>
                        ${!goal.completed && daysLeft >= 0 ? `<p><strong>Days Left:</strong> ${daysLeft}</p>` : ''}
                    </div>
                    <div class="goal-actions">
                        ${!goal.completed ? `<button onclick="completeGoal(${index})" class="btn btn-success btn-sm">Mark Complete</button>` : ''}
                        <button onclick="deleteGoal(${index})" class="btn btn-danger btn-sm">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Function to complete a goal
    window.completeGoal = function(index) {
        userGoals[index].completed = true;
        saveGoals();
        renderGoals();
        showSnackbar('Goal completed! 🎉', 'success');
    };

    // Function to delete a goal
    window.deleteGoal = function(index) {
        if (confirm('Are you sure you want to delete this goal?')) {
            userGoals.splice(index, 1);
            saveGoals();
            renderGoals();
            showSnackbar('Goal deleted', 'info');
        }
    };

    // Event listener for goal form
    if (goalForm) {
        goalForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(goalForm);
            const goal = {
                type: formData.get('goal_type'),
                description: formData.get('goal_description'),
                target: formData.get('goal_target'),
                deadline: formData.get('goal_deadline'),
                created: new Date().toISOString(),
                completed: false
            };

            userGoals.push(goal);
            saveGoals();
            renderGoals();
            
            goalForm.reset();
            showSnackbar('Goal added successfully! 🎯', 'success');
        });
    }

    // Initialize motivation tab
    function initMotivationTab() {
        updateQuote();
        renderGoals();
    }

    // Call initialization when page loads
    initMotivationTab();

    // Dashboard Tab Functionality
    function switchToTab(tabName) {
        // Hide all sub-tab contents
        document.querySelectorAll('.sub-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Remove active class from all sub-tab buttons
        document.querySelectorAll('.sub-tab-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Show selected tab content
        const selectedContent = document.getElementById(tabName);
        if (selectedContent) {
            selectedContent.classList.add('active');
        }
        
        // Add active class to selected button
        const selectedButton = document.querySelector(`[data-sub-tab="${tabName}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }
    }

    // Make switchToTab function globally available
    window.switchToTab = switchToTab;

    // Function to switch to workouts sub-tab in activity section
    window.switchToActivityWorkouts = function() {
        // Switch to activity tab first
        const activityTab = document.querySelector('[data-sub-tab="activity"]');
        if (activityTab) {
            activityTab.click();
            
            // Wait a moment for the tab to switch, then switch to workouts sub-tab
            setTimeout(() => {
                const workoutsSubTab = document.getElementById('activity-sub-tab-workouts');
                if (workoutsSubTab) {
                    workoutsSubTab.click();
                }
            }, 100);
        }
    };

    // Function to load dashboard data
    async function loadDashboardData() {
        try {
            // Load current weight
            const weightResponse = await fetch('/fitness/api/latest_weight');
            if (weightResponse.ok) {
                const weightData = await weightResponse.json();
                if (weightData.weight) {
                    document.getElementById('current-weight').textContent = `${weightData.weight} lbs`;
                    
                    // Calculate weight change if we have previous weight
                    if (weightData.previous_weight) {
                        const change = weightData.weight - weightData.previous_weight;
                        const changeElement = document.getElementById('weight-change');
                        if (change > 0) {
                            changeElement.textContent = `+${change.toFixed(1)} lbs`;
                            changeElement.classList.add('negative');
                        } else if (change < 0) {
                            changeElement.textContent = `${change.toFixed(1)} lbs`;
                            changeElement.classList.remove('negative');
                        } else {
                            changeElement.textContent = 'No change';
                        }
                    }
                }
            }

            // Load today's calories
            const today = new Date().toISOString().split('T')[0];
            const nutritionResponse = await fetch(`/fitness/api/daily_nutrition/${today}`);
            if (nutritionResponse.ok) {
                const nutritionData = await nutritionResponse.json();
                if (nutritionData.total_calories) {
                    document.getElementById('today-calories').textContent = nutritionData.total_calories;
                    document.getElementById('calorie-target').textContent = `Target: ${nutritionData.target_calories || '--'}`;
                }
            }

            // Load weekly workouts count
            const workoutsResponse = await fetch('/fitness/api/weekly_workouts');
            if (workoutsResponse.ok) {
                const workoutsData = await workoutsResponse.json();
                document.getElementById('weekly-workouts').textContent = workoutsData.count || 0;
            }

            // Load active goals count
            const goals = JSON.parse(localStorage.getItem('fitnessGoals')) || [];
            const activeGoals = goals.filter(goal => !goal.completed);
            document.getElementById('active-goals').textContent = activeGoals.length;

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    // Function to load recent activity
    async function loadRecentActivity() {
        try {
            const response = await fetch('/fitness/api/recent_activity');
            if (response.ok) {
                const activities = await response.json();
                const timeline = document.getElementById('activity-timeline');
                
                if (activities.length === 0) {
                    timeline.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No recent activity</p>';
                    return;
                }

                timeline.innerHTML = activities.map(activity => `
                    <div class="timeline-item">
                        <div class="timeline-icon">${activity.icon}</div>
                        <div class="timeline-content">
                            <h4>${activity.title}</h4>
                            <p>${activity.description} - ${activity.time_ago}</p>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    // Initialize dashboard when tab is shown
    function initDashboard() {
        loadDashboardData();
        loadRecentActivity();
    }

    // Add event listener for dashboard tab button
    const dashboardTabButton = document.querySelector('[data-sub-tab="dashboard"]');
    if (dashboardTabButton) {
        dashboardTabButton.addEventListener('click', initDashboard);
    }

    // Initialize dashboard on page load if it's the active tab
    if (document.getElementById('dashboard').classList.contains('active')) {
        initDashboard();
    }

    // Mood Journal Functionality
    const moodEntryForm = document.getElementById('mood-entry-form');
    const moodGoalsForm = document.getElementById('mood-goals-form');
    const moodOptions = document.querySelectorAll('.mood-option');
    const moodRatingInput = document.getElementById('mood-rating');

    // Mood emoji mapping
    const moodEmojis = {
        1: '😢', 2: '😞', 3: '😐', 4: '🙂', 5: '😊', 6: '😄', 7: '🤩'
    };

    // Mood entry data storage
    let moodEntries = JSON.parse(localStorage.getItem('moodEntries')) || [];
    let wellnessGoals = JSON.parse(localStorage.getItem('wellnessGoals')) || [];

    // Mood option selection
    moodOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove selected class from all options
            moodOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            this.classList.add('selected');
            
            // Update hidden input
            const rating = this.getAttribute('data-rating');
            moodRatingInput.value = rating;
        });
    });

    // Mood entry form submission
    if (moodEntryForm) {
        moodEntryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!moodRatingInput.value) {
                showSnackbar('Please select a mood rating', 'error');
                return;
            }

            const formData = new FormData(moodEntryForm);
            const moodEntry = {
                id: Date.now(),
                date: new Date().toISOString().split('T')[0],
                timestamp: new Date().toISOString(),
                mood_rating: parseInt(formData.get('mood_rating')),
                mood_category: formData.get('mood_category'),
                energy_level: parseInt(formData.get('energy_level')),
                sleep_quality: formData.get('sleep_quality') ? parseInt(formData.get('sleep_quality')) : null,
                stress_level: formData.get('stress_level') ? parseInt(formData.get('stress_level')) : null,
                mood_triggers: formData.get('mood_triggers'),
                gratitude: formData.get('gratitude'),
                challenges: formData.get('challenges'),
                wins: formData.get('wins'),
                coping_strategies: formData.get('coping_strategies'),
                tomorrow_intentions: formData.get('tomorrow_intentions')
            };

            // Check if entry already exists for today
            const today = new Date().toISOString().split('T')[0];
            const existingEntryIndex = moodEntries.findIndex(entry => entry.date === today);
            
            if (existingEntryIndex !== -1) {
                moodEntries[existingEntryIndex] = moodEntry;
                showSnackbar('Mood entry updated for today! 📝', 'success');
            } else {
                moodEntries.push(moodEntry);
                showSnackbar('Mood entry saved! 💚', 'success');
            }

            saveMoodEntries();
            renderMoodEntries();
            updateMoodStats();
            generateMoodInsights();
            
            // Reset form
            moodEntryForm.reset();
            moodOptions.forEach(opt => opt.classList.remove('selected'));
            moodRatingInput.value = '';
        });
    }

    // Wellness goals form submission
    if (moodGoalsForm) {
        moodGoalsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(moodGoalsForm);
            const goal = {
                id: Date.now(),
                description: formData.get('goal_description'),
                deadline: formData.get('goal_deadline'),
                priority: formData.get('goal_priority'),
                created: new Date().toISOString(),
                completed: false
            };

            wellnessGoals.push(goal);
            saveWellnessGoals();
            renderWellnessGoals();
            
            moodGoalsForm.reset();
            showSnackbar('Wellness goal added! 🎯', 'success');
        });
    }

    // Save mood entries to localStorage
    function saveMoodEntries() {
        localStorage.setItem('moodEntries', JSON.stringify(moodEntries));
    }

    // Save wellness goals to localStorage
    function saveWellnessGoals() {
        localStorage.setItem('wellnessGoals', JSON.stringify(wellnessGoals));
    }

    // Render mood entries
    function renderMoodEntries() {
        const entriesList = document.getElementById('mood-entries-list');
        
        if (moodEntries.length === 0) {
            entriesList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No entries yet. Start your mood journal above!</p>';
            return;
        }

        // Sort entries by date (newest first)
        const sortedEntries = moodEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        entriesList.innerHTML = sortedEntries.slice(0, 5).map(entry => {
            const date = new Date(entry.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });

            return `
                <div class="mood-entry-item">
                    <div class="mood-entry-header">
                        <div class="mood-entry-date">${formattedDate}</div>
                        <div class="mood-entry-rating">
                            <span class="mood-entry-emoji">${moodEmojis[entry.mood_rating]}</span>
                            <span class="mood-entry-category">${entry.mood_category}</span>
                        </div>
                    </div>
                    <div class="mood-entry-content">
                        ${entry.gratitude ? `
                            <div class="mood-entry-field">
                                <h5>🙏 Gratitude</h5>
                                <p>${entry.gratitude}</p>
                            </div>
                        ` : ''}
                        ${entry.wins ? `
                            <div class="mood-entry-field">
                                <h5>🏆 Wins</h5>
                                <p>${entry.wins}</p>
                            </div>
                        ` : ''}
                        ${entry.challenges ? `
                            <div class="mood-entry-field">
                                <h5>💪 Challenges</h5>
                                <p>${entry.challenges}</p>
                            </div>
                        ` : ''}
                        ${entry.mood_triggers ? `
                            <div class="mood-entry-field">
                                <h5>🔍 Mood Triggers</h5>
                                <p>${entry.mood_triggers}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render wellness goals
    function renderWellnessGoals() {
        const goalsList = document.getElementById('mood-goals-list');
        
        if (wellnessGoals.length === 0) {
            goalsList.innerHTML = '<h4>Current Goals</h4><p>No wellness goals set yet.</p>';
            return;
        }

        goalsList.innerHTML = `
            <h4>Current Goals</h4>
            ${wellnessGoals.map(goal => {
                const deadline = new Date(goal.deadline);
                const today = new Date();
                const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
                
                let status = '';
                if (goal.completed) {
                    status = 'completed';
                } else if (daysLeft < 0) {
                    status = 'overdue';
                }

                return `
                    <div class="wellness-goal-item ${status}">
                        <div class="wellness-goal-header">
                            <div class="wellness-goal-description">${goal.description}</div>
                            <span class="wellness-goal-priority ${goal.priority}">${goal.priority.toUpperCase()}</span>
                        </div>
                        <div class="wellness-goal-details">
                            <p>Deadline: ${goal.deadline} ${!goal.completed && daysLeft >= 0 ? `(${daysLeft} days left)` : ''}</p>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }

    // Update mood statistics
    function updateMoodStats() {
        if (moodEntries.length === 0) return;

        // Calculate weekly average mood
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weeklyEntries = moodEntries.filter(entry => new Date(entry.date) >= oneWeekAgo);
        
        if (weeklyEntries.length > 0) {
            const avgMood = weeklyEntries.reduce((sum, entry) => sum + entry.mood_rating, 0) / weeklyEntries.length;
            document.getElementById('weekly-avg-mood').textContent = avgMood.toFixed(1);
            
            // Calculate trend
            const previousWeek = moodEntries.filter(entry => {
                const entryDate = new Date(entry.date);
                return entryDate >= new Date(oneWeekAgo.getTime() - 7 * 24 * 60 * 60 * 1000) && entryDate < oneWeekAgo;
            });
            
            if (previousWeek.length > 0) {
                const prevAvg = previousWeek.reduce((sum, entry) => sum + entry.mood_rating, 0) / previousWeek.length;
                const trend = avgMood - prevAvg;
                const trendElement = document.getElementById('weekly-mood-trend');
                
                if (trend > 0) {
                    trendElement.textContent = `+${trend.toFixed(1)} from last week`;
                    trendElement.classList.remove('negative');
                } else if (trend < 0) {
                    trendElement.textContent = `${trend.toFixed(1)} from last week`;
                    trendElement.classList.add('negative');
                } else {
                    trendElement.textContent = 'No change from last week';
                }
            }
        }

        // Most common mood
        const moodCounts = {};
        moodEntries.forEach(entry => {
            moodCounts[entry.mood_category] = (moodCounts[entry.mood_category] || 0) + 1;
        });
        
        const mostCommonMood = Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b);
        document.getElementById('common-mood').textContent = mostCommonMood;
        document.getElementById('mood-frequency').textContent = `${moodCounts[mostCommonMood]} times`;

        // Average sleep quality
        const sleepEntries = moodEntries.filter(entry => entry.sleep_quality !== null);
        if (sleepEntries.length > 0) {
            const avgSleep = sleepEntries.reduce((sum, entry) => sum + entry.sleep_quality, 0) / sleepEntries.length;
            document.getElementById('avg-sleep').textContent = avgSleep.toFixed(1);
        }

        // Average stress level
        const stressEntries = moodEntries.filter(entry => entry.stress_level !== null);
        if (stressEntries.length > 0) {
            const avgStress = stressEntries.reduce((sum, entry) => sum + entry.stress_level, 0) / stressEntries.length;
            document.getElementById('avg-stress').textContent = avgStress.toFixed(1);
        }
    }

    // Generate mood insights
    function generateMoodInsights() {
        if (moodEntries.length === 0) return;

        // Mood triggers insight
        const triggers = moodEntries
            .filter(entry => entry.mood_triggers)
            .map(entry => entry.mood_triggers.toLowerCase())
            .join(' ')
            .split(/[,\s]+/)
            .filter(word => word.length > 3);

        const triggerCounts = {};
        triggers.forEach(trigger => {
            triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
        });

        const topTriggers = Object.entries(triggerCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([trigger, count]) => `${trigger} (${count} times)`)
            .join(', ');

        if (topTriggers) {
            document.getElementById('mood-triggers-insight').innerHTML = `
                <p><strong>Top triggers:</strong> ${topTriggers}</p>
            `;
        }

        // Coping strategies insight
        const copingStrategies = moodEntries
            .filter(entry => entry.coping_strategies)
            .map(entry => entry.coping_strategies);

        if (copingStrategies.length > 0) {
            document.getElementById('coping-strategies-insight').innerHTML = `
                <p><strong>Recent strategies:</strong> ${copingStrategies.slice(-3).join(', ')}</p>
            `;
        }

        // Sleep impact insight
        const sleepMoodCorrelation = moodEntries
            .filter(entry => entry.sleep_quality !== null)
            .sort((a, b) => a.sleep_quality - b.sleep_quality);

        if (sleepMoodCorrelation.length > 0) {
            const lowSleepMood = sleepMoodCorrelation.slice(0, Math.ceil(sleepMoodCorrelation.length / 3))
                .reduce((sum, entry) => sum + entry.mood_rating, 0) / Math.ceil(sleepMoodCorrelation.length / 3);
            
            const highSleepMood = sleepMoodCorrelation.slice(-Math.ceil(sleepMoodCorrelation.length / 3))
                .reduce((sum, entry) => sum + entry.mood_rating, 0) / Math.ceil(sleepMoodCorrelation.length / 3);

            document.getElementById('sleep-impact-insight').innerHTML = `
                <p><strong>Sleep impact:</strong> Better sleep correlates with ${(highSleepMood - lowSleepMood).toFixed(1)} points higher mood</p>
            `;
        }

        // Gratitude practice insight
        const gratitudeEntries = moodEntries.filter(entry => entry.gratitude);
        const gratitudeMood = gratitudeEntries.reduce((sum, entry) => sum + entry.mood_rating, 0) / gratitudeEntries.length;
        const nonGratitudeMood = moodEntries
            .filter(entry => !entry.gratitude)
            .reduce((sum, entry) => sum + entry.mood_rating, 0) / moodEntries.filter(entry => !entry.gratitude).length;

        if (gratitudeEntries.length > 0 && moodEntries.filter(entry => !entry.gratitude).length > 0) {
            document.getElementById('gratitude-practice-insight').innerHTML = `
                <p><strong>Gratitude impact:</strong> Days with gratitude practice average ${gratitudeMood.toFixed(1)} vs ${nonGratitudeMood.toFixed(1)} without</p>
            `;
        }
    }

    // Initialize mood journal
    function initMoodJournal() {
        renderMoodEntries();
        renderWellnessGoals();
        updateMoodStats();
        generateMoodInsights();
    }

    // Initialize mood journal on page load
    initMoodJournal();

    // --- Exercise Category & Exercise Select Logic ---
    const exerciseCategorySelect = document.getElementById('exercise-category');
    const exerciseSelect = document.getElementById('exercise');

    async function loadExerciseCategories() {
        if (!exerciseCategorySelect) return;
        try {
            const response = await fetch('/fitness/api/exercise_categories');
            const categories = await response.json();
            exerciseCategorySelect.innerHTML = '<option value="">Select Category</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                exerciseCategorySelect.appendChild(option);
            });
        } catch (error) {
            exerciseCategorySelect.innerHTML = '<option value="">Error loading categories</option>';
        }
    }

    async function loadExercisesForCategory(categoryId) {
        if (!exerciseSelect) return;
        if (!categoryId) {
            exerciseSelect.innerHTML = '<option value="">Select Exercise</option>';
            return;
        }
        try {
            const response = await fetch(`/fitness/api/exercises/${categoryId}`);
            const exercises = await response.json();
            exerciseSelect.innerHTML = '<option value="">Select Exercise</option>';
            exercises.forEach(ex => {
                const option = document.createElement('option');
                option.value = ex.name;
                option.textContent = ex.name;
                exerciseSelect.appendChild(option);
            });
        } catch (error) {
            exerciseSelect.innerHTML = '<option value="">Error loading exercises</option>';
        }
    }

    if (exerciseCategorySelect) {
        exerciseCategorySelect.addEventListener('change', function() {
            loadExercisesForCategory(this.value);
        });
    }

    // Load categories when the workouts sub-tab is shown
    const workoutsSubTabButton = document.getElementById('activity-sub-tab-workouts');
    if (workoutsSubTabButton) {
        workoutsSubTabButton.addEventListener('click', loadExerciseCategories);
    }
    // Also load on page load if workouts sub-tab is active
    if (document.getElementById('activity-sub-content-workouts').classList.contains('active')) {
        loadExerciseCategories();
    }

    // --- New Workout Modal: Category/Exercise Selection ---
    let workoutTabNew = document.querySelector('#activity-sub-content-workouts #workout-tab-new');
    let workoutTabHistory = document.querySelector('#activity-sub-content-workouts #workout-tab-history');
    let workoutTabContentNew = document.querySelector('#activity-sub-content-workouts #workout-tab-content-new');
    let workoutTabContentHistory = document.querySelector('#activity-sub-content-workouts #workout-tab-content-history');
    let modalStepCategory = document.querySelector('#activity-sub-content-workouts #modal-step-category');
    let modalStepExercise = document.querySelector('#activity-sub-content-workouts #modal-step-exercise');
    let categoryList = document.querySelector('#activity-sub-content-workouts #category-list');
    let exerciseList = document.querySelector('#activity-sub-content-workouts #exercise-list');
    let backToCategoryBtn = document.querySelector('#activity-sub-content-workouts #back-to-category');
    let closeWorkoutModalBtn = document.querySelector('#activity-sub-content-workouts #close-workout-modal');
    let cancelWorkoutBtn = document.querySelector('#activity-sub-content-workouts #cancel-workout-btn');
    let workoutModal = document.querySelector('#activity-sub-content-workouts #workout-modal');

    // Function to initialize workout elements when workouts sub-tab is shown
    function initializeWorkoutElements() {
        console.log('Initializing workout elements...');
        workoutTabNew = document.querySelector('#activity-sub-content-workouts #workout-tab-new');
        workoutTabHistory = document.querySelector('#activity-sub-content-workouts #workout-tab-history');
        workoutTabContentNew = document.querySelector('#activity-sub-content-workouts #workout-tab-content-new');
        workoutTabContentHistory = document.querySelector('#activity-sub-content-workouts #workout-tab-content-history');
        modalStepCategory = document.querySelector('#activity-sub-content-workouts #modal-step-category');
        modalStepExercise = document.querySelector('#activity-sub-content-workouts #modal-step-exercise');
        categoryList = document.querySelector('#activity-sub-content-workouts #category-list');
        exerciseList = document.querySelector('#activity-sub-content-workouts #exercise-list');
        backToCategoryBtn = document.querySelector('#activity-sub-content-workouts #back-to-category');
        closeWorkoutModalBtn = document.querySelector('#activity-sub-content-workouts #close-workout-modal');
        cancelWorkoutBtn = document.querySelector('#activity-sub-content-workouts #cancel-workout-btn');
        workoutModal = document.querySelector('#activity-sub-content-workouts #workout-modal');
        
        console.log('Workout elements found:', {
            workoutTabNew, workoutTabHistory, workoutTabContentNew, 
            workoutTabContentHistory, workoutModal
        });

        // Set up event handlers
        if (workoutTabNew) {
            console.log('Setting up Start New Workout event handler');
            workoutTabNew.addEventListener('click', (e) => {
                console.log('Start New Workout clicked - event triggered');
                e.preventDefault();
                e.stopPropagation();
                setWorkoutTabActive(workoutTabNew);
                workoutTabContentNew.style.display = 'block';
                workoutTabContentHistory.style.display = 'none';
                loadTodaysWorkout();
            });
        }
        if (workoutTabHistory) {
            workoutTabHistory.addEventListener('click', () => {
                console.log('Workout History clicked');
                setWorkoutTabActive(workoutTabHistory);
                workoutTabContentNew.style.display = 'none';
                workoutTabContentHistory.style.display = 'block';
                loadFullWorkoutHistory();
            });
        }
        
        // Add event listener for the Create New Workout button
        const createWorkoutBtn = document.querySelector('#activity-sub-content-workouts #create-workout-btn');
        if (createWorkoutBtn) {
            console.log('Setting up Create New Workout button event handler');
            createWorkoutBtn.addEventListener('click', (e) => {
                console.log('Create New Workout button clicked');
                e.preventDefault();
                e.stopPropagation();
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
                if (workoutModal) workoutModal.style.display = 'none'; 
                resetWorkoutModal(); 
            });
        }
        if (cancelWorkoutBtn) {
            cancelWorkoutBtn.addEventListener('click', () => { 
                if (workoutModal) workoutModal.style.display = 'none'; 
                resetWorkoutModal(); 
            });
        }
        
        // Add event handlers for review step buttons
        const backToExerciseBtn = document.querySelector('#back-to-exercise');
        const addAnotherExerciseBtn = document.querySelector('#add-another-exercise-btn');
        const saveWorkoutPlanBtn = document.querySelector('#save-workout-plan');
        
        if (backToExerciseBtn) {
            backToExerciseBtn.addEventListener('click', () => {
                showStep('exercise');
            });
        }
        if (addAnotherExerciseBtn) {
            addAnotherExerciseBtn.addEventListener('click', () => {
                showStep('exercise');
            });
        }
        if (saveWorkoutPlanBtn) {
            saveWorkoutPlanBtn.addEventListener('click', async () => {
                await saveWorkoutPlan();
            });
        }
        
        if (workoutModal) {
            workoutModal.addEventListener('click', function(e) {
                if (e.target === workoutModal) {
                    workoutModal.style.display = 'none';
                    resetWorkoutModal();
                }
            });
        }
    }

    // Add style for category/exercise buttons
    function styleWorkoutButtons() {
        const btns = document.querySelectorAll('#category-list button, #exercise-list button');
        btns.forEach(btn => {
            // Skip styling if it's a favorite exercise (let CSS handle it)
            if (btn.classList.contains('favorite-exercise')) {
                return;
            }
            
            btn.style.borderRadius = '8px';
            btn.style.fontSize = '1.08em';
            btn.style.padding = '10px 18px';
            btn.style.background = '#f5f6fa';
            btn.style.color = '#222';
            btn.style.border = '1px solid #d1d5db';
            btn.style.transition = 'background 0.18s, color 0.18s';
            btn.onmouseenter = () => { btn.style.background = '#e0e7ff'; btn.style.color = '#1e40af'; };
            btn.onmouseleave = () => { btn.style.background = '#f5f6fa'; btn.style.color = '#222'; };
        });
    }

    function showStep(step) {
        const stepIndicator = document.getElementById('modal-step-indicator');
        const divider = document.getElementById('modal-divider');
        const catCancel = document.getElementById('modal-category-cancel');
        const modalStepReview = document.querySelector('#modal-step-review');
        
        if (step === 'category') {
            if (modalStepCategory) modalStepCategory.style.display = '';
            if (modalStepExercise) modalStepExercise.style.display = 'none';
            if (modalStepReview) modalStepReview.style.display = 'none';
            if (stepIndicator) stepIndicator.textContent = 'Step 1 of 3';
            if (divider) divider.style.display = 'none';
            if (catCancel) catCancel.style.display = 'flex';
        } else if (step === 'exercise') {
            if (modalStepCategory) modalStepCategory.style.display = 'none';
            if (modalStepExercise) modalStepExercise.style.display = '';
            if (modalStepReview) modalStepReview.style.display = 'none';
            if (stepIndicator) stepIndicator.textContent = 'Step 2 of 3';
            if (divider) divider.style.display = 'block';
            if (catCancel) catCancel.style.display = 'none';
        } else if (step === 'review') {
            if (modalStepCategory) modalStepCategory.style.display = 'none';
            if (modalStepExercise) modalStepExercise.style.display = 'none';
            if (modalStepReview) modalStepReview.style.display = '';
            if (stepIndicator) stepIndicator.textContent = 'Step 3 of 3';
            if (divider) divider.style.display = 'none';
            if (catCancel) catCancel.style.display = 'none';
            updateSelectedExercisesList();
        }
    }

    function resetWorkoutModal() {
        showStep('category');
        if (categoryList) categoryList.innerHTML = '';
        if (exerciseList) exerciseList.innerHTML = '';
        selectedExercises = [];
        const workoutNameInput = document.getElementById('workout-name');
        if (workoutNameInput) workoutNameInput.value = '';
    }

    async function openWorkoutModalNewFlow() {
        console.log('Opening workout modal...');
        resetWorkoutModal();
        if (workoutModal) {
            workoutModal.style.display = 'flex';
            console.log('Modal displayed');
        } else {
            console.error('Workout modal not found');
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
                btn.style.minWidth = '120px';
                btn.onclick = () => selectCategory(cat.id, cat.name);
                categoryList.appendChild(btn);
            });
            styleWorkoutButtons();
                console.log('Categories loaded successfully');
            } else {
                console.error('Category list element not found');
            }
        } catch (err) {
            console.error('Error loading categories:', err);
            if (categoryList) {
            categoryList.innerHTML = '<div style="color:red">Failed to load categories</div>';
            }
        }
    }

    async function selectCategory(categoryId, categoryName) {
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
                    btn.innerHTML = '<span class="star">★</span> ' + ex.name;
                    btn.title = 'Favorite';
                }
                btn.onclick = () => {
                    // Add exercise to workout plan instead of redirecting
                    const exerciseData = {
                        exercise_name: ex.name,
                        exercise_id: ex.id,
                        category_id: categoryId,
                        category_name: categoryName
                    };
                    addExerciseToPlan(exerciseData);
                    showStep('review');
                };
                exerciseList.appendChild(btn);
            });
            styleWorkoutButtons();
            setupCustomExerciseForm(categoryId, categoryName);
        } catch (err) {
            exerciseList.innerHTML = '<div style="color:red">Failed to load exercises</div>';
        }
    }

    function setupCustomExerciseForm(categoryId, categoryName) {
        const showCustomExerciseFormBtn = document.querySelector('#activity-sub-content-workouts #show-custom-exercise-form');
        const customExerciseForm = document.querySelector('#activity-sub-content-workouts #custom-exercise-form');
        const customExerciseNameInput = document.querySelector('#activity-sub-content-workouts #custom-exercise-name');

        if (!showCustomExerciseFormBtn || !customExerciseForm) return;

        // Remove previous listeners to avoid duplicates
        showCustomExerciseFormBtn.onclick = null;
        customExerciseForm.onsubmit = null;

        showCustomExerciseFormBtn.onclick = () => {
            customExerciseForm.style.display = 'block';
            showCustomExerciseFormBtn.style.display = 'none';
        };

        customExerciseForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = customExerciseNameInput.value.trim();
            
            if (!name || !categoryId) {
                showSnack('Exercise name is required.', 'error');
                return;
            }
            
            try {
                const resp = await fetch('/fitness/api/custom_exercises', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        category_id: categoryId
                    })
                });
                const data = await resp.json();
                if (!resp.ok) {
                    showSnack(data.error || 'Failed to create exercise', 'error');
                    return;
                }
                showSnack('Custom exercise created!', 'success');
                customExerciseForm.reset();
                customExerciseForm.style.display = 'none';
                showCustomExerciseFormBtn.style.display = 'inline-block';
                // Refresh exercise list
                await selectCategory(categoryId, categoryName);
            } catch (err) {
                showSnack('Failed to create exercise', 'error');
            }
        };
    }

    // Only call loadCurrentMilestone if milestone elements exist
    if (currentMilestoneSection) {
        loadCurrentMilestone();
    }

    // Optionally: Load current milestone on page load
    async function loadCurrentMilestone() {
        // Only load milestone if the element exists
        if (!currentMilestoneSection) {
            console.log('Milestone section not found, skipping milestone load');
            return;
        }
        
        try {
            const resp = await fetch('/fitness/current_milestone');
            const data = await resp.json();
            if (data.active && data.milestone) {
                showMilestone(data.milestone);
            } else {
                currentMilestoneSection.style.display = 'none';
            }
        } catch (err) {
            if (currentMilestoneSection) {
                currentMilestoneSection.style.display = 'none';
            }
        }
    }

    // Function to display milestone information
    function showMilestone(milestone) {
        if (!currentMilestoneSection) {
            console.log('Milestone section not found, cannot show milestone');
            return;
        }
        
        try {
            // Update milestone display elements
            const milestoneName = document.getElementById('milestone-name');
            const milestoneDescription = document.getElementById('milestone-description');
            const progressText = document.getElementById('progress-text');
            const progressPercentage = document.getElementById('progress-percentage');
            const progressFill = document.getElementById('progress-fill');
            const totalDistance = document.getElementById('total-distance');
            const completedDistance = document.getElementById('completed-distance');
            const remainingDistance = document.getElementById('remaining-distance');
            
            if (milestoneName) milestoneName.textContent = milestone.name;
            if (milestoneDescription) milestoneDescription.textContent = milestone.description || '';
            if (progressText) progressText.textContent = `${milestone.completed_distance} / ${milestone.total_distance} miles`;
            if (progressPercentage) progressPercentage.textContent = `${milestone.progress_percentage || 0}%`;
            if (progressFill) progressFill.style.width = `${milestone.progress_percentage || 0}%`;
            if (totalDistance) totalDistance.textContent = `${milestone.total_distance} miles`;
            if (completedDistance) completedDistance.textContent = `${milestone.completed_distance} miles`;
            if (remainingDistance) remainingDistance.textContent = `${milestone.remaining_distance || (milestone.total_distance - milestone.completed_distance)} miles`;
            
            // Show the milestone section
            currentMilestoneSection.style.display = 'block';
            
            console.log('Milestone displayed successfully:', milestone);
        } catch (error) {
            console.error('Error showing milestone:', error);
        }
    }

    // Optionally: Add logic for change/reset milestone buttons
    if (changeMilestoneBtn) {
        changeMilestoneBtn.addEventListener('click', function() {
            if (currentMilestoneSection) {
                currentMilestoneSection.style.display = 'none';
            }
            if (milestoneTrailSelect) {
                milestoneTrailSelect.value = '';
            }
        });
    }
    if (resetMilestoneBtn) {
        resetMilestoneBtn.addEventListener('click', async function() {
            try {
                const resp = await fetch('/fitness/reset_milestone', { method: 'POST' });
                const data = await resp.json();
                if (resp.ok && data.milestone) {
                    showMilestone(data.milestone);
                } else {
                    alert(data.error || 'Failed to reset milestone');
                }
            } catch (err) {
                alert('Error resetting milestone');
            }
        });
    }

    // Activity sub-tabs functionality
    const activitySubTabButtons = document.querySelectorAll('.activity-sub-tab-btn');
    const activitySubContents = document.querySelectorAll('.activity-sub-content');

    activitySubTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const subTabId = button.id;
            
            // Remove active class from all buttons and contents
            activitySubTabButtons.forEach(btn => btn.classList.remove('active'));
            activitySubContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding content
            if (subTabId === 'activity-sub-tab-activities') {
                const activitiesContent = document.getElementById('activity-sub-content-activities');
                activitiesContent.classList.add('active');
                activitiesContent.style.display = 'block';
                document.getElementById('activity-sub-content-workouts').style.display = 'none';
                loadActivities();
                loadTDEE();
                loadTDEEHistory();
            } else if (subTabId === 'activity-sub-tab-workouts') {
                console.log('Workouts sub-tab clicked, initializing...');
                const workoutsContent = document.getElementById('activity-sub-content-workouts');
                console.log('Workouts content element:', workoutsContent);
                workoutsContent.classList.add('active');
                workoutsContent.style.display = 'block';
                document.getElementById('activity-sub-content-activities').style.display = 'none';
                
                // Initialize workout functionality
                console.log('Calling initializeWorkoutElements...');
                initializeWorkoutElements(); // Initialize workout elements
                
                // Show the "Start New Workout" tab by default
                const workoutTabNew = document.getElementById('workout-tab-new');
                const workoutTabContentNew = document.getElementById('workout-tab-content-new');
                const workoutTabContentHistory = document.getElementById('workout-tab-content-history');
                console.log('Workout tab elements found:', {
                    workoutTabNew: !!workoutTabNew,
                    workoutTabContentNew: !!workoutTabContentNew,
                    workoutTabContentHistory: !!workoutTabContentHistory
                });
                
                if (workoutTabNew && workoutTabContentNew && workoutTabContentHistory) {
                    setWorkoutTabActive(workoutTabNew);
                    workoutTabContentNew.style.display = 'block';
                    workoutTabContentHistory.style.display = 'none';
                    console.log('Workouts sub-tab initialized successfully');
                    
                    // Ensure the workout table section is visible
                    const workoutTodaySection = document.getElementById('workout-today-section');
                    console.log('Workout today section element:', workoutTodaySection);
                    if (workoutTodaySection) {
                        workoutTodaySection.style.display = 'block';
                        console.log('Today\'s workout section made visible');
                    }
                    
                    // Now load the workout data AFTER ensuring visibility
                    setTimeout(() => {
                        console.log('Loading workout data...');
                        loadTodaysWorkout();
                        loadExerciseCategories();
                    }, 100);
                } else {
                    console.error('Could not find workout tab elements');
                }
            }
        });
    });



    // --- Leaderboard Tab ---
    async function loadLeaderboard() {
        const container = document.getElementById('leaderboard-table-container');
        container.innerHTML = '<div>Loading leaderboard...</div>';
        try {
            const response = await fetch('/fitness/api/leaderboard');
            const data = await response.json();
            let html = '';
            // Total Workouts
            html += '<h3>🏋️ Top by Total Workouts</h3>' + renderLeaderboardTable(data.total_workouts, ['Rank', 'Username', 'Total Workouts'], row => [row.username || 'Anonymous', row.workout_count]);
            // Days Active
            html += '<h3>📅 Most Consistent (Days Active)</h3>' + renderLeaderboardTable(data.days_active, ['Rank', 'Username', 'Days Active'], row => [row.username || 'Anonymous', row.days_active]);
            // Longest Streak (placeholder)
            html += '<h3>🔥 Longest Workout Streak</h3>' + (data.longest_streak && data.longest_streak.length ? renderLeaderboardTable(data.longest_streak, ['Rank', 'Username', 'Streak (days)'], row => [row.username || 'Anonymous', row.streak]) : '<div>Coming soon!</div>');
            // Miles Ran
            html += '<h3>🏃‍♂️ Top Miles Ran</h3>' + renderLeaderboardTable(data.miles_ran, ['Rank', 'Username', 'Miles Ran'], row => [row.username || 'Anonymous', row.miles.toFixed(2)]);
            // Miles Biked
            html += '<h3>🚴‍♂️ Top Miles Biked</h3>' + renderLeaderboardTable(data.miles_biked, ['Rank', 'Username', 'Miles Biked'], row => [row.username || 'Anonymous', row.miles.toFixed(2)]);
            // Miles Walked
            html += '<h3>🚶‍♂️ Top Miles Walked</h3>' + renderLeaderboardTable(data.miles_walked, ['Rank', 'Username', 'Miles Walked'], row => [row.username || 'Anonymous', row.miles.toFixed(2)]);
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<div>Error loading leaderboard.</div>';
        }
    }

    function renderLeaderboardTable(data, headers, rowFn) {
        if (!Array.isArray(data) || data.length === 0) return '<div>No data available.</div>';
        let html = '<table class="modern-table" style="width:100%;margin-bottom:32px;"><thead><tr>';
        html += '<th>Rank</th>';
        headers.slice(1).forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        data.forEach((row, i) => {
            const cells = rowFn(row);
            html += `<tr><td>${i+1}</td><td>${cells[0]}</td><td>${cells[1]}</td></tr>`;
        });
        html += '</tbody></table>';
        return html;
    }

    // Sub-tab switching logic
    document.querySelectorAll('.sub-tab-button').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sub-tab-button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.sub-tab-content').forEach(tab => tab.classList.remove('active'));
            const tabId = this.getAttribute('data-sub-tab');
            const tabContent = document.getElementById(tabId);
            if (tabContent) tabContent.classList.add('active');
            if (tabId === 'leaderboard') loadLeaderboard();
            // ... existing tab logic ...
        });
    });

    // Handle URL parameters for direct navigation
    function handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        
        if (tab === 'workouts') {
            // Switch to activity tab first
            const activityTab = document.querySelector('.tab-button[data-tab="activity"]');
            if (activityTab) {
                activityTab.click();
                
                // Then activate the workouts sub-tab
                setTimeout(() => {
                    const workoutsSubTab = document.getElementById('activity-sub-tab-workouts');
                    if (workoutsSubTab) {
                        workoutsSubTab.click();
                    }
                }, 100);
            }
        }
    }

    // Call URL parameter handler on page load
    handleURLParameters();

    function setWorkoutTabActive(tab) {
        [workoutTabNew, workoutTabHistory].forEach(btn => btn.classList.remove('active'));
        tab.classList.add('active');
    }

    function loadTDEE() {
        const today = new Date();
        const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const activityLevel = document.getElementById('daily-activity-level')?.value || 'light';
        
        fetch(`/api/tdee_calculate?date=${date}&activity_level=${activityLevel}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading TDEE:', data.error);
                    return;
                }
                
                // Update TDEE summary with real-time data
                document.getElementById('tdee-summary').innerHTML = `
                    <div class="tdee-card">
                        <h4>TDEE Summary for ${formatDate(date)}</h4>
                        <div class="tdee-grid">
                            <div class="tdee-item">
                                <span class="label">BMR:</span>
                                <span class="value">${data.bmr} cal</span>
                            </div>
                            <div class="tdee-item">
                                <span class="label">Activity Level:</span>
                                <span class="value">${data.activity_level_name}</span>
                            </div>
                            <div class="tdee-item">
                                <span class="label">Base TDEE:</span>
                                <span class="value">${data.base_tdee} cal</span>
                            </div>
                            <div class="tdee-item">
                                <span class="label">Workout Calories:</span>
                                <span class="value">${data.activity_calories} cal</span>
                            </div>
                            <div class="tdee-item highlight">
                                <span class="label">Total TDEE:</span>
                                <span class="value">${data.tdee} cal</span>
                            </div>
                            <div class="tdee-item">
                                <span class="label">Calorie Intake:</span>
                                <span class="value">${data.calorie_intake || 0} cal</span>
                            </div>
                            ${data.balance !== null ? `
                            <div class="tdee-item ${data.status.toLowerCase()}">
                                <span class="label">Balance:</span>
                                <span class="value">${data.balance > 0 ? '+' : ''}${data.balance} cal (${data.status})</span>
                            </div>
                            ` : ''}
                        </div>
                        <div class="tdee-actions">
                            <button type="button" class="btn btn-primary" onclick="saveDailyTDEE()">
                                <i class="fas fa-save"></i> Save Daily TDEE
                            </button>
                            <small class="text-muted">Save this TDEE calculation to your daily records</small>
                        </div>
                    </div>
                `;
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('tdee-summary').innerHTML = '<p class="text-muted">Unable to load TDEE summary</p>';
            });
    }

    async function loadTDEEHistory() {
        if (document.querySelector('#activity.sub-tab-content')?.style.display !== 'block') return;
        try {
            const response = await fetch('/api/tdee_history');
            const tdeeHistory = await response.json();
            const tdeeHistoryTable = document.getElementById('tdee-history-table')?.querySelector('tbody');
            if (tdeeHistoryTable) {
                tdeeHistoryTable.innerHTML = '';
                tdeeHistory.forEach(t => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${t.date}</td>
                        <td>${t.bmr || ''}</td>
                        <td>${t.base_tdee || ''}</td>
                        <td>${t.activity_calories || ''}</td>
                        <td>${t.tdee || ''}</td>
                        <td>${t.calorie_intake || ''}</td>
                        <td>${t.balance || 'N/A'}</td>
                        <td>${t.status || 'No data'}</td>
                        <td>
                            <button class="btn btn-sm btn-secondary edit-tdee-btn" data-id="${t.id}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </td>
                    `;
                    tdeeHistoryTable.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error loading TDEE history:', error);
            showSnack('Failed to load TDEE history', 'error');
        }
    }

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

    function saveDailyTDEE() {
        const date = new Date().toISOString().split('T')[0]; // Use current date
        
        fetch('/fitness/record_daily_tdee', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date: date })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error saving TDEE:', data.error);
                showSnack('Error: ' + data.error, 'error');
                return;
            }
            
            showSnack('Daily TDEE saved successfully!', 'success');
            loadTDEEHistory(); // Refresh the history table
        })
        .catch(error => {
            console.error('Error:', error);
            showSnack('Error saving TDEE', 'error');
        });
    }

    // Make saveDailyTDEE globally accessible
    window.saveDailyTDEE = saveDailyTDEE;

    // Audio manager for PR sounds
    const audioManager = {
        pr: new Audio('/static/sounds/pr-achievement.mp3'),
        milestone: new Audio('/static/sounds/milestone.mp3'),
        streak: new Audio('/static/sounds/streak.mp3')
    };

    // Initialize audio (call this after user interaction)
    function initAudio() {
        console.log('Initializing audio...');
        Object.values(audioManager).forEach(audio => {
            audio.volume = 0.6;
            audio.load(); // Preload audio
            console.log('Audio loaded:', audio.src);
        });
    }

    // Play PR sound
    function playPRSound(type = 'pr') {
        console.log('Attempting to play PR sound:', type);
        const audio = audioManager[type];
        if (audio) {
            console.log('Audio element found, playing...');
            audio.currentTime = 0;
            audio.play().then(() => {
                console.log('Audio played successfully!');
            }).catch(e => {
                console.log('Audio play failed:', e);
                console.log('Audio readyState:', audio.readyState);
                console.log('Audio error:', audio.error);
            });
        } else {
            console.log('Audio element not found for type:', type);
        }
    }

    // Handle PR achievement
    function handlePRAchievement(prsAchieved, exerciseName) {
        console.log('Handling PR achievement for exercise:', exerciseName);
        console.log('PRs achieved:', prsAchieved);
        
        // Play PR sound
        playPRSound('pr');
        
        // Show PR notification
        const prTypes = prsAchieved.map(pr => pr.pr_type).join(', ');
        showSnack(`🎉 New Personal Record! ${prTypes} for ${exerciseName}`, 'success');
    }

    // Milestone functions

    // --- Workout Plan Builder Logic ---
    let selectedExercises = [];

    function addExerciseToPlan(exercise) {
      selectedExercises.push(exercise);
      updateSelectedExercisesList();
    }

    function removeExerciseFromPlan(index) {
      selectedExercises.splice(index, 1);
      updateSelectedExercisesList();
    }

    function updateSelectedExercisesList() {
      const listDiv = document.getElementById('selected-exercises-list');
      listDiv.innerHTML = '';
      if (selectedExercises.length === 0) {
        listDiv.innerHTML = '<div class="empty">No exercises added yet.</div>';
        return;
      }
      selectedExercises.forEach((ex, idx) => {
        const exDiv = document.createElement('div');
        exDiv.className = 'selected-exercise-item';
        exDiv.innerHTML = `
          <span>${ex.name || ex.exercise_name}</span>
          <button class="btn btn-danger btn-sm" onclick="removeExerciseFromPlan(${idx})">Remove</button>
        `;
        listDiv.appendChild(exDiv);
      });
    }

    // Navigation logic
    const stepCategory = document.getElementById('modal-step-category');
    const stepExercise = document.getElementById('modal-step-exercise');
    const stepReview = document.getElementById('modal-step-review');

    function showStep(step) {
      [stepCategory, stepExercise, stepReview].forEach(s => s && (s.style.display = 'none'));
      if (step === 'category') stepCategory && (stepCategory.style.display = 'block');
      if (step === 'exercise') stepExercise && (stepExercise.style.display = 'block');
      if (step === 'review') stepReview && (stepReview.style.display = 'block');
    }

    // Add event listeners
    const addAnotherBtn = document.getElementById('add-another-exercise-btn');
    if (addAnotherBtn) {
      addAnotherBtn.addEventListener('click', () => {
        showStep('exercise');
      });
    }

    const saveWorkoutBtn = document.getElementById('save-workout-btn');
    if (saveWorkoutBtn) {
      saveWorkoutBtn.addEventListener('click', () => {
        const workoutName = document.getElementById('workout-name').value;
        if (selectedExercises.length === 0) {
          alert('Please add at least one exercise to your workout plan.');
          return;
        }
        // Send to backend
        fetch('/fitness/api/workout_sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: workoutName,
            exercises: selectedExercises
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert('Workout plan saved!');
            // Optionally, close modal and refresh
            location.reload();
          } else {
            alert('Error saving workout: ' + (data.message || 'Unknown error'));
          }
        })
        .catch(err => {
          alert('Error saving workout: ' + err);
        });
      });
    }

    // When user selects an exercise, call addExerciseToPlan(exerciseObj) and then showStep('review')
    // You may need to update your exercise selection logic to use this new flow.

    async function saveWorkoutPlan() {
        if (selectedExercises.length === 0) {
            showSnack('Please add at least one exercise to your workout plan.', 'error');
            return;
        }
        
        const workoutName = document.getElementById('workout-name')?.value || '';
        
        try {
            const response = await fetch('/fitness/api/workout_templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: workoutName || 'Workout Plan',
                    exercises: selectedExercises.map(ex => ({
                        exercise_id: ex.exercise_id,
                        order: selectedExercises.indexOf(ex) + 1
                    }))
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showSnack('Workout plan saved successfully!', 'success');
                // Reset the modal and selected exercises
                selectedExercises = [];
                if (workoutModal) workoutModal.style.display = 'none';
                resetWorkoutModal();
                // Optionally refresh the workout history
                loadTodaysWorkout();
            } else {
                showSnack(result.error || 'Failed to save workout plan', 'error');
            }
        } catch (error) {
            console.error('Error saving workout plan:', error);
            showSnack('Error saving workout plan: ' + error.message, 'error');
        }
    }
});