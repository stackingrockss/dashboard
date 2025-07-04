import { showSnack } from './utils.js';

// --- Activities Logic ---
// (Moved from fitness.js)

// Place all activity tracking logic here, including:
// - Activity forms and event listeners
// - Activity history fetches and table rendering
// - Related helpers

// Example placeholder (replace with actual moved code):
// async function loadActivities() { ... }
// ...

// Export functions if using modules
// export { loadActivities, ... }; 

// --- Improved TDEE Summary Logic ---
function tdeeSummaryLoading() {
    const summaryDiv = document.getElementById('tdee-summary');
    if (summaryDiv) {
        summaryDiv.innerHTML = `<div class="tdee-loading"><span class="spinner"></span> Loading TDEE summary...</div>`;
    }
}

function getBalanceColor(balance) {
    if (typeof balance !== 'number') return 'gray';
    if (balance < -100) return 'green'; // Deficit
    if (balance > 100) return 'red';   // Surplus
    return 'gray';                     // Neutral
}

function getBalanceLabel(balance) {
    if (typeof balance !== 'number') return '--';
    if (balance < -100) return 'Deficit';
    if (balance > 100) return 'Surplus';
    return 'Neutral';
}

async function fetchTdeeSummary() {
    tdeeSummaryLoading();
    try {
        const response = await fetch('/api/tdee');
        const data = await response.json();
        const summaryDiv = document.getElementById('tdee-summary');
        if (data.error) {
            summaryDiv.innerHTML = `<div class="tdee-error">${data.message || data.error}</div>`;
            return;
        }
        const balanceColor = getBalanceColor(data.balance);
        const balanceLabel = getBalanceLabel(data.balance);
        summaryDiv.innerHTML = `
            <div class="tdee-card">
                <div class="tdee-row"><span class="tdee-icon">📅</span><strong>Date:</strong> <span>${data.date || '--'}</span></div>
                <div class="tdee-row"><span class="tdee-icon">🔥</span><strong>BMR:</strong> <span>${data.bmr || '--'} kcal</span></div>
                <div class="tdee-row"><span class="tdee-icon">🏃‍♂️</span><strong>Base TDEE:</strong> <span>${data.base_tdee || '--'} kcal</span></div>
                <div class="tdee-row"><span class="tdee-icon">💪</span><strong>Workout Calories:</strong> <span>${data.activity_calories || '--'} kcal</span></div>
                <div class="tdee-row"><span class="tdee-icon">⚡</span><strong>TDEE:</strong> <span>${data.tdee || '--'} kcal</span></div>
                <div class="tdee-row"><span class="tdee-icon">🍽️</span><strong>Calorie Intake:</strong> <span>${data.calorie_intake || '--'} kcal</span></div>
                <div class="tdee-row"><span class="tdee-icon">⚖️</span><strong>Balance:</strong> <span style="color:${balanceColor}; font-weight:bold;">${data.balance !== undefined && data.balance !== null ? data.balance + ' kcal' : '--'} (${balanceLabel})</span></div>
            </div>
            <button id="record-tdee-btn" class="btn">Record Today's TDEE</button>
        `;
        attachRecordTdeeHandler();
    } catch (e) {
        document.getElementById('tdee-summary').innerHTML = '<div class="tdee-error">Failed to load TDEE summary.</div>';
    }
}

function attachRecordTdeeHandler() {
    const btn = document.getElementById('record-tdee-btn');
    if (btn) {
        btn.onclick = async function() {
            btn.disabled = true;
            btn.textContent = 'Recording...';
            try {
                const activityLevel = document.getElementById('daily-activity-level')?.value || null;
                // Get today's date in YYYY-MM-DD format
                const today = new Date().toISOString().split('T')[0];
                const response = await fetch('/record_daily_tdee', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activity_level: activityLevel, date: today })
                });
                const data = await response.json();
                if (data.error) {
                    window.showSnack ? window.showSnack(data.error, 'error') : alert(data.error);
                } else {
                    window.showSnack ? window.showSnack('TDEE recorded!', 'success') : alert('TDEE recorded!');
                    afterTdeeRecorded();
                }
                await fetchTdeeSummary();
            } catch (e) {
                window.showSnack ? window.showSnack('Failed to record TDEE', 'error') : alert('Failed to record TDEE');
            } finally {
                btn.disabled = false;
                btn.textContent = "Record Today's TDEE";
            }
        };
    }
}

// Update styles for full-width, responsive TDEE summary
function injectTdeeSummaryStyles() {
    if (document.getElementById('tdee-summary-styles')) return;
    const style = document.createElement('style');
    style.id = 'tdee-summary-styles';
    style.textContent = `
        .tdee-card {
            background: #f8f9fa;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.07);
            padding: 24px 32px 16px 32px;
            margin-bottom: 16px;
            width: 100%;
            border: 1.5px solid #e0e4ea;
            box-sizing: border-box;
            display: flex;
            flex-wrap: wrap;
            gap: 24px 32px;
            justify-content: space-between;
        }
        .tdee-row {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.08em;
            margin-bottom: 0;
            min-width: 220px;
            flex: 1 1 220px;
        }
        .tdee-icon {
            font-size: 1.2em;
            width: 1.5em;
            text-align: center;
        }
        .tdee-error {
            color: #dc3545;
            background: #fff0f0;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            margin-bottom: 10px;
        }
        .tdee-loading {
            text-align: center;
            color: #888;
            padding: 18px 0;
        }
        .spinner {
            display: inline-block;
            width: 22px;
            height: 22px;
            border: 3px solid #eee;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            animation: tdee-spin 1s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes tdee-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @media (max-width: 700px) {
            .tdee-card {
                flex-direction: column;
                gap: 12px;
                padding: 18px 8px 12px 8px;
            }
            .tdee-row {
                min-width: 0;
                font-size: 1em;
            }
        }
    `;
    document.head.appendChild(style);
}

// --- Load and Render Daily Activities ---
async function loadDailyActivities() {
    const activityList = document.getElementById('activity-list');
    const activityDateInput = document.getElementById('activity-date');
    if (!activityList || !activityDateInput) return;
    const date = activityDateInput.value;
    try {
        const response = await fetch(`/fitness/api/activities?date=${date}`);
        const activities = await response.json();
        if (Array.isArray(activities)) {
            if (activities.length === 0) {
                activityList.innerHTML = '<div style="text-align:center; color:#888;">No activities logged for today.</div>';
            } else {
                activityList.innerHTML = activities.map(a => `
                    <div class="activity-card">
                        <div class="activity-icon">${getActivityIcon(a.activity_type)}</div>
                        <div class="activity-details">
                            <div class="activity-type">${a.activity_type || 'Activity'}</div>
                            <div class="activity-meta">
                                <span title="Duration"><b>⏱️</b> ${a.duration} min</span>
                                ${a.miles !== null && a.miles !== undefined ? `<span title="Miles"><b>🚶</b> ${a.miles} mi</span>` : ''}
                                <span title="Intensity"><b>💪</b> ${a.intensity}</span>
                                <span title="Calories Burned"><b>🔥</b> ${a.calories_burned}</span>
                            </div>
                        </div>
                        <div class="activity-actions">
                            <button class="activity-action-btn activity-edit-btn" title="Edit Activity" aria-label="Edit Activity" onclick="editActivity('${a.id}')">
                                <span style="font-size:1.2em;">✏️</span>
                            </button>
                            <button class="activity-action-btn activity-delete-btn" title="Delete Activity" aria-label="Delete Activity" onclick="deleteActivity('${a.id}')" style="color:#dc3545;">
                                <span style="font-size:1.2em;">🗑️</span>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } else {
            activityList.innerHTML = '<div style="text-align:center; color:#888;">Failed to load activities.</div>';
        }
    } catch (error) {
        activityList.innerHTML = '<div style="text-align:center; color:#888;">Error loading activities.</div>';
    }
}

function getActivityIcon(type) {
    switch ((type || '').toLowerCase()) {
        case 'walking': return '🚶';
        case 'running': return '🏃';
        case 'cycling': return '🚴';
        case 'mowing lawn': return '🌱';
        case 'strength training': return '🏋️';
        case 'other': return '⚡';
        default: return '🏃';
    }
}

// --- Milestone Logic ---
const TRAIL_INFO = {
    appalachian: {
        name: 'Appalachian Trail',
        description: 'Hike from Georgia to Maine across 14 states',
        distance: 2190
    },
    pacific_crest: {
        name: 'Pacific Crest Trail',
        description: 'Hike from Mexico to Canada through California, Oregon, and Washington',
        distance: 2650
    },
    continental_divide: {
        name: 'Continental Divide Trail',
        description: 'Hike from Mexico to Canada along the Rocky Mountains',
        distance: 3100
    },
    camino_santiago: {
        name: 'Camino de Santiago',
        description: 'Pilgrimage route in Spain',
        distance: 500
    },
    john_muir: {
        name: 'John Muir Trail',
        description: 'Hike in the Sierra Nevada mountains of California',
        distance: 211
    },
    tahoe_rim: {
        name: 'Tahoe Rim Trail',
        description: 'Loop trail around Lake Tahoe',
        distance: 165
    },
    wonderland: {
        name: 'Wonderland Trail',
        description: 'Loop trail around Mount Rainier',
        distance: 93
    },
    angels_landing: {
        name: 'Angels Landing',
        description: 'Iconic hike in Zion National Park',
        distance: 5.4
    }
};

async function fetchCurrentMilestone() {
    try {
        const res = await fetch('/fitness/current_milestone');
        const data = await res.json();
        if (data.milestone) {
            renderMilestone(data.milestone);
        } else {
            renderNoMilestone();
        }
    } catch (e) {
        renderNoMilestone();
    }
}

function renderMilestone(milestone) {
    const milestoneDiv = document.getElementById('current-milestone');
    if (!milestoneDiv) return;
    document.getElementById('milestone-name').textContent = milestone.name;
    document.getElementById('milestone-description').textContent = TRAIL_INFO[getTrailKeyByName(milestone.name)]?.description || '';
    document.getElementById('total-distance').textContent = `${milestone.total_distance} miles`;
    document.getElementById('completed-distance').textContent = `${milestone.completed_distance} miles`;
    document.getElementById('remaining-distance').textContent = `${milestone.total_distance - milestone.completed_distance} miles`;
    document.getElementById('progress-text').textContent = `${milestone.completed_distance} / ${milestone.total_distance} miles`;
    const percent = Math.round((milestone.completed_distance / milestone.total_distance) * 100);
    document.getElementById('progress-percentage').textContent = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;
    milestoneDiv.style.display = '';
}

function renderNoMilestone() {
    const milestoneDiv = document.getElementById('current-milestone');
    if (milestoneDiv) milestoneDiv.style.display = 'none';
}

function getTrailKeyByName(name) {
    return Object.keys(TRAIL_INFO).find(key => TRAIL_INFO[key].name === name);
}

// --- Edit and Delete Activity Logic ---
window.editActivity = async function(id) {
    const modal = document.getElementById('edit-activity-modal');
    const form = document.getElementById('edit-activity-form');
    if (!modal || !form) return;
    // Fetch activity data
    try {
        const res = await fetch(`/fitness/api/activity/${id}`);
        const data = await res.json();
        if (!data || data.error) {
            showSnack(data.error || 'Failed to load activity', 'error');
            return;
        }
        // Populate form fields
        form.elements['id'].value = data.id;
        form.elements['edit-activity-type'].value = data.activity_type;
        form.elements['edit-custom-activity-type'].value = data.custom_activity_type || '';
        form.elements['edit-duration'].value = data.duration;
        form.elements['edit-intensity'].value = data.intensity;
        form.elements['edit-activity-date'].value = data.activity_date || data.date || '';
        form.elements['edit-miles'].value = data.miles || '';
        // Show modal
        modal.style.display = 'block';
    } catch (e) {
        showSnack('Failed to load activity', 'error');
    }
};

window.deleteActivity = async function(id) {
    if (!confirm('Delete this activity?')) return;
    try {
        const res = await fetch(`/fitness/delete_activity/${id}`);
        const data = await res.json();
        if (res.ok) {
            showSnack(data.message || 'Activity deleted!', 'success');
            loadDailyActivities();
        } else {
            showSnack(data.error || 'Failed to delete activity', 'error');
        }
    } catch (e) {
        showSnack('Failed to delete activity', 'error');
    }
};

// Modal close logic for edit-activity-modal
const editActivityModal = document.getElementById('edit-activity-modal');
if (editActivityModal) {
    const closeBtn = editActivityModal.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = () => { editActivityModal.style.display = 'none'; };
    }
    // Cancel button logic
    const cancelBtn = editActivityModal.querySelector('.cancel');
    if (cancelBtn) {
        cancelBtn.onclick = () => { editActivityModal.style.display = 'none'; };
    }
    // Optional: close modal on outside click
    window.onclick = function(event) {
        if (event.target === editActivityModal) {
            editActivityModal.style.display = 'none';
        }
    };
}

// --- Chart.js TDEE History with Moving Average and Status Colors ---
let tdeeChartInstance = null;
function renderTdeeChart(data, canvas) {
    if (!window.Chart) return;
    const labels = data.map(row => row.date).reverse();
    const tdeeData = data.map(row => row.tdee).reverse();
    const statusData = data.map(row => row.status).reverse();
    const today = new Date().toISOString().split('T')[0];
    // Moving average (7-day)
    const movingAvg = tdeeData.map((_, i, arr) => {
        const start = Math.max(0, i - 3), end = Math.min(arr.length, i + 4);
        const slice = arr.slice(start, end).filter(x => typeof x === 'number');
        return slice.length ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) : null;
    });
    // Point background color by status
    const pointColors = statusData.map((s, i) => {
        if (labels[i] === today) return '#ff9800'; // Highlight today
        if (s === 'Deficit') return '#43a047';
        if (s === 'Surplus') return '#e53935';
        if (s === 'Maintenance') return '#607d8b';
        return '#bdbdbd';
    });
    // Line color by status (use main color for all, but could be segmented)
    if (tdeeChartInstance) tdeeChartInstance.destroy();
    tdeeChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'TDEE (kcal)',
                    data: tdeeData,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0,123,255,0.08)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 4,
                    pointBackgroundColor: pointColors,
                    pointBorderWidth: 2,
                    pointBorderColor: pointColors,
                    segment: {
                        borderColor: ctx => pointColors[ctx.p0DataIndex] || '#007bff',
                    },
                },
                {
                    label: '7-day Moving Avg',
                    data: movingAvg,
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255,152,0,0.07)',
                    fill: false,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    tension: 0.2,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, labels: { boxWidth: 18 } },
                title: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(ctx) {
                            if (ctx.dataset.label === '7-day Moving Avg') {
                                return `7-day Avg: ${ctx.parsed.y?.toLocaleString() || '--'} kcal`;
                            }
                            const idx = ctx.dataIndex;
                            return [
                                `TDEE: ${tdeeData[idx]?.toLocaleString() || '--'} kcal`,
                                `Status: ${statusData[idx] || '--'}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Date' }, grid: { display: false } },
                y: { title: { display: true, text: 'TDEE (kcal)' }, beginAtZero: true, grid: { color: '#eee' } }
            },
            elements: {
                line: { borderWidth: 3 },
                point: { hoverRadius: 7 }
            },
            layout: { padding: 16 }
        }
    });
}

// --- TDEE History Table Modern Styles ---
(function injectTdeeHistoryStyles() {
    if (document.getElementById('tdee-history-styles')) return;
    const style = document.createElement('style');
    style.id = 'tdee-history-styles';
    style.textContent = `
        #tdee-history-table tr.tdee-row-deficit { background: #e8f5e9; }
        #tdee-history-table tr.tdee-row-surplus { background: #ffebee; }
        #tdee-history-table tr.tdee-row-maintenance { background: #eceff1; }
        #tdee-history-table tr.tdee-row-today { outline: 2px solid #ff9800; font-weight: bold; }
        #tdee-history-table thead th { position: sticky; top: 0; background: #fff; z-index: 2; }
        #tdee-history-table { border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        #tdee-history-table tr:hover { background: #f5f5f5 !important; }
        #tdee-history-table td, #tdee-history-table th { padding: 8px 10px; text-align: center; }
    `;
    document.head.appendChild(style);
})();

// Update TDEE history after recording TDEE
function afterTdeeRecorded() {
    loadTdeeHistory();
}

async function loadMilesSummary() {
    const timeframe = document.getElementById('miles-timeframe').value;
    const resultsDiv = document.getElementById('miles-summary-results');
    resultsDiv.innerHTML = 'Loading...';
    try {
        const res = await fetch(`/fitness/api/activity_miles_summary?timeframe=${timeframe}`);
        const data = await res.json();
        if (data.summary) {
            resultsDiv.innerHTML = `
                <div class="miles-summary-stats">
                  <div class="miles-summary-pill">
                    <span class="miles-summary-icon">🚶</span>
                    <span class="miles-summary-value">${data.summary.Walking}</span>
                    <span class="miles-summary-label">Walking</span>
                  </div>
                  <div class="miles-summary-pill">
                    <span class="miles-summary-icon">🏃</span>
                    <span class="miles-summary-value">${data.summary.Running}</span>
                    <span class="miles-summary-label">Running</span>
                  </div>
                  <div class="miles-summary-pill">
                    <span class="miles-summary-icon">🚴</span>
                    <span class="miles-summary-value">${data.summary.Cycling}</span>
                    <span class="miles-summary-label">Cycling</span>
                  </div>
                </div>
                <div class="miles-summary-dates">From ${data.start_date} to ${data.end_date}</div>
            `;
        } else {
            resultsDiv.innerHTML = '<div style="color:#888;">No data found.</div>';
        }
    } catch (e) {
        resultsDiv.innerHTML = '<div style="color:#888;">Error loading summary.</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    injectTdeeSummaryStyles();
    if (document.getElementById('tdee-summary')) {
        fetchTdeeSummary();
    }

    // Set activity_date to today by default
    const activityDateInput = document.getElementById('activity-date');
    if (activityDateInput) {
        const today = new Date().toISOString().split('T')[0];
        activityDateInput.value = today;
    }

    // Load activities on page load
    loadDailyActivities();

    // Handle activity form submission via AJAX and stay on activities sub-tab
    const activityForm = document.getElementById('activity-form');
    if (activityForm) {
        activityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(activityForm);
            try {
                const response = await fetch('/fitness/add_activity', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message || 'Activity saved!', 'success');
                    activityForm.reset();
                    // Reset date to today after reset
                    const activityDateInput = document.getElementById('activity-date');
                    if (activityDateInput) {
                        const today = new Date().toISOString().split('T')[0];
                        activityDateInput.value = today;
                    }
                    loadDailyActivities();
                    // Close the modal after saving
                    const logActivityModal = document.getElementById('log-activity-modal');
                    if (logActivityModal) logActivityModal.style.display = 'none';
                } else {
                    showSnack(result.error || 'Failed to save activity', 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }

    // Milestone: Set
    const setMilestoneBtn = document.getElementById('set-milestone-btn');
    if (setMilestoneBtn) {
        setMilestoneBtn.addEventListener('click', async () => {
            const select = document.getElementById('milestone-trail');
            const trailKey = select.value;
            if (!trailKey) {
                showSnack('Please select a trail.', 'error');
                return;
            }
            setMilestoneBtn.disabled = true;
            try {
                const res = await fetch('/fitness/set_milestone', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trail_name: trailKey })
                });
                const data = await res.json();
                if (res.ok && data.milestone) {
                    showSnack(data.message || 'Milestone set!', 'success');
                    fetchCurrentMilestone();
                } else {
                    showSnack(data.error || 'Failed to set milestone', 'error');
                }
            } catch (e) {
                showSnack('Failed to set milestone', 'error');
            } finally {
                setMilestoneBtn.disabled = false;
            }
        });
    }

    // Milestone: Reset
    const resetMilestoneBtn = document.getElementById('reset-milestone-btn');
    if (resetMilestoneBtn) {
        resetMilestoneBtn.addEventListener('click', async () => {
            resetMilestoneBtn.disabled = true;
            try {
                const res = await fetch('/fitness/reset_milestone', { method: 'POST' });
                const data = await res.json();
                if (res.ok && data.milestone) {
                    showSnack(data.message || 'Milestone reset!', 'success');
                    fetchCurrentMilestone();
                } else {
                    showSnack(data.error || 'Failed to reset milestone', 'error');
                }
            } catch (e) {
                showSnack('Failed to reset milestone', 'error');
            } finally {
                resetMilestoneBtn.disabled = false;
            }
        });
    }

    // Initial milestone fetch
    fetchCurrentMilestone();

    // Minimalist Activity Level Button/Modal Logic
    const activityLevelBtn = document.getElementById('daily-activity-level-btn');
    const activityLevelModal = document.getElementById('activity-level-modal');
    const closeActivityLevelModal = document.getElementById('close-activity-level-modal');
    const activityLevelInput = document.getElementById('daily-activity-level');
    const activityLevelOptions = document.querySelectorAll('.activity-level-option');
    const activityLevelLabel = activityLevelBtn?.querySelector('.activity-pill-label');
    const activityLevelLabels = {
        'sedentary': 'Sedentary',
        'light': 'Light',
        'moderate': 'Moderate',
        'active': 'Active',
        'very_active': 'Very Active'
    };
    if (activityLevelBtn && activityLevelModal && activityLevelInput) {
        activityLevelBtn.onclick = function() {
            activityLevelModal.style.display = 'flex';
        };
        if (closeActivityLevelModal) {
            closeActivityLevelModal.onclick = function() {
                activityLevelModal.style.display = 'none';
            };
        }
        window.addEventListener('click', function(event) {
            if (event.target === activityLevelModal) {
                activityLevelModal.style.display = 'none';
            }
        });
        activityLevelOptions.forEach(btn => {
            btn.onclick = function() {
                const value = btn.getAttribute('data-value');
                activityLevelInput.value = value;
                if (activityLevelLabel) activityLevelLabel.textContent = activityLevelLabels[value];
                activityLevelModal.style.display = 'none';
                // Trigger TDEE update logic if needed
                if (typeof loadMilesSummary === 'function') loadMilesSummary();
                if (typeof fetchTdeeSummary === 'function') fetchTdeeSummary();
            };
        });
    }

    loadTdeeHistory();

    const milesTimeframe = document.getElementById('miles-timeframe');
    if (milesTimeframe) {
        milesTimeframe.addEventListener('change', loadMilesSummary);
        loadMilesSummary();
    }

    // Log Activity Modal logic
    const openLogActivityBtn = document.getElementById('open-log-activity-modal');
    const logActivityModal = document.getElementById('log-activity-modal');
    const closeLogActivityModal = document.getElementById('close-log-activity-modal');
    const cancelActivityBtn = document.getElementById('cancel-activity-btn');
    // Use the same activityForm variable for both modal and form logic
    if (openLogActivityBtn && logActivityModal) {
        openLogActivityBtn.onclick = () => {
            logActivityModal.style.display = 'flex';
            if (activityForm) activityForm.reset();
            // Set date to today
            const activityDateInput = document.getElementById('activity-date');
            if (activityDateInput) activityDateInput.value = new Date().toISOString().split('T')[0];
        };
    }
    if (closeLogActivityModal && logActivityModal) {
        closeLogActivityModal.onclick = () => { logActivityModal.style.display = 'none'; };
    }
    if (cancelActivityBtn && logActivityModal) {
        cancelActivityBtn.onclick = () => { logActivityModal.style.display = 'none'; };
    }
    window.onclick = function(event) {
        if (event.target === logActivityModal) {
            logActivityModal.style.display = 'none';
        }
    };

    // Edit Activity Form AJAX submission
    const editActivityForm = document.getElementById('edit-activity-form');
    if (editActivityForm) {
        editActivityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(editActivityForm);
            const id = formData.get('id');
            try {
                const response = await fetch(`/fitness/edit_activity/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        activity_date: formData.get('activity_date'),
                        activity_type: formData.get('activity_type'),
                        custom_activity_type: formData.get('custom_activity_type'),
                        duration: formData.get('duration'),
                        intensity: formData.get('intensity'),
                        miles: formData.get('miles')
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message || 'Activity updated!', 'success');
                    loadDailyActivities();
                    // Close the modal after updating
                    const editActivityModal = document.getElementById('edit-activity-modal');
                    if (editActivityModal) editActivityModal.style.display = 'none';
                    // Ensure the activities sub-tab is active
                    const activitiesTabBtn = document.getElementById('activity-sub-tab-activities');
                    if (activitiesTabBtn) activitiesTabBtn.click();
                } else {
                    showSnack(result.error || 'Failed to update activity', 'error');
                }
            } catch (error) {
                showSnack('Error: ' + error.message, 'error');
            }
        });
    }
}); 