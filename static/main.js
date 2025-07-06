// Functions are now available globally from utility files

// Dashboard stats loading function
async function loadDashboardStats() {
    console.log('loadDashboardStats: Starting to load dashboard stats...');
    try {
        // Load current weight
        console.log('loadDashboardStats: Fetching latest weight...');
        const weightResponse = await fetch('/fitness/api/latest_weight');
        console.log('loadDashboardStats: Weight response status:', weightResponse.status);
        
        if (weightResponse.ok) {
            const weightData = await weightResponse.json();
            console.log('loadDashboardStats: Weight data received:', weightData);
            
            const currentWeightElement = document.getElementById('current-weight');
            const weightChangeElement = document.getElementById('weight-change');
            
            console.log('loadDashboardStats: Current weight element found:', !!currentWeightElement);
            console.log('loadDashboardStats: Weight change element found:', !!weightChangeElement);
            
            if (currentWeightElement) {
                if (weightData.weight) {
                    currentWeightElement.textContent = `${weightData.weight} lbs`;
                    console.log('loadDashboardStats: Set current weight to:', `${weightData.weight} lbs`);
                    
                    if (weightData.date) {
                        const date = new Date(weightData.date);
                        const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
                        if (daysAgo === 0) {
                            weightChangeElement.textContent = 'Today';
                        } else if (daysAgo === 1) {
                            weightChangeElement.textContent = 'Yesterday';
                        } else {
                            weightChangeElement.textContent = `${daysAgo} days ago`;
                        }
                        console.log('loadDashboardStats: Set weight change to:', weightChangeElement.textContent);
                    } else if (weightData.source === 'profile') {
                        weightChangeElement.textContent = 'From Profile';
                        console.log('loadDashboardStats: Weight from profile, set change to "From Profile"');
                    } else {
                        weightChangeElement.textContent = 'No date';
                        console.log('loadDashboardStats: Weight has no date, set change to "No date"');
                    }
                } else {
                    currentWeightElement.textContent = '--';
                    weightChangeElement.textContent = 'No data';
                    console.log('loadDashboardStats: No weight data available, set to --');
                }
            } else {
                console.error('loadDashboardStats: Current weight element not found!');
            }
        } else {
            console.error('loadDashboardStats: Weight response not ok:', weightResponse.status);
        }
        
        // Load other dashboard stats (calories, workouts, goals)
        // TODO: Add API endpoints for these stats
        const todayCaloriesElement = document.getElementById('today-calories');
        const weeklyWorkoutsElement = document.getElementById('weekly-workouts');
        const activeGoalsElement = document.getElementById('active-goals');
        
        if (todayCaloriesElement) todayCaloriesElement.textContent = '--';
        if (weeklyWorkoutsElement) weeklyWorkoutsElement.textContent = '--';
        if (activeGoalsElement) activeGoalsElement.textContent = '--';
        
        console.log('loadDashboardStats: Dashboard stats loading completed');
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Function to refresh dashboard stats (called after weight updates)
window.refreshDashboardStats = loadDashboardStats;
// Make loadDashboardStats globally available for testing
window.loadDashboardStats = loadDashboardStats;

document.addEventListener('DOMContentLoaded', () => {
    console.log('main.js: DOMContentLoaded');
    const tabContents = document.querySelectorAll('.tab-content');
    const sidebarLinks = document.querySelectorAll('.sidebar-item');
    const today = new Date().toISOString().split('T')[0];

    // Check for a 'tab' query parameter to set the active section
    const urlParams = new URLSearchParams(window.location.search);
    const activeSectionId = urlParams.get('tab') || 'fitness';

    // Remove all active classes
    tabContents.forEach(c => c.classList.remove('active'));
    sidebarLinks.forEach(l => l.classList.remove('active'));

    // Activate the correct section and sidebar item
    const contentToActivate = document.getElementById(activeSectionId);
    const sidebarToActivate = document.querySelector(`.sidebar-item[data-section="${activeSectionId}"]`);
    if (contentToActivate) contentToActivate.classList.add('active');
    if (sidebarToActivate) sidebarToActivate.classList.add('active');

    // Load dashboard stats when dashboard is active
    if (activeSectionId === 'fitness') {
        console.log('main.js: Fitness tab is active, loading dashboard stats...');
        // Add a small delay to ensure DOM is fully loaded
        setTimeout(() => {
            loadDashboardStats();
        }, 100);
    }

    // Sidebar navigation logic
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (!section) return;
            // Hide all tab contents
            tabContents.forEach(c => c.classList.remove('active'));
            // Show the selected section
            const content = document.getElementById(section);
            if (content) content.classList.add('active');
            // Update sidebar active state
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('tab', section);
            window.history.pushState({}, '', url);
            
            // Load dashboard stats when switching to fitness tab
            if (section === 'fitness') {
                console.log('main.js: Switching to fitness tab, loading dashboard stats...');
                // Add a small delay to ensure DOM is fully loaded
                setTimeout(() => {
                    loadDashboardStats();
                }, 100);
            }
        });
    });

    // Set default date for date inputs
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.value = today;
    });

    // Debug: Check if dashboard elements exist
    console.log('main.js: Checking for dashboard elements...');
    const currentWeightElement = document.getElementById('current-weight');
    const weightChangeElement = document.getElementById('weight-change');
    console.log('main.js: current-weight element exists:', !!currentWeightElement);
    console.log('main.js: weight-change element exists:', !!weightChangeElement);
    
    // Add test function to console for debugging
    window.testDashboardStats = () => {
        console.log('Testing dashboard stats loading...');
        loadDashboardStats();
    };

    // DRY sub-tab switching logic for fitness, mood, and work
    function setupSubTabs({
        tabButtonSelector,
        tabContentSelector,
        dataAttr,
        contentIdPrefix,
        useDisplayNone = false
    }) {
        const subTabs = document.querySelectorAll(tabButtonSelector);
        const subTabContents = document.querySelectorAll(tabContentSelector);
        subTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                subTabs.forEach(t => t.classList.remove('active'));
                subTabContents.forEach(c => {
                    c.classList.remove('active');
                    if (useDisplayNone) c.style.display = 'none';
                });
                tab.classList.add('active');
                const subTabId = tab.getAttribute(dataAttr);
                const subTabContent = document.getElementById(`${contentIdPrefix}${subTabId}`);
                if (subTabContent) {
                    subTabContent.classList.add('active');
                    if (useDisplayNone) subTabContent.style.display = 'block';
                }
            });
        });
    }

    // Setup sub-tabs for fitness, mood, and work
    setupSubTabs({
        tabButtonSelector: '.sub-tab-button[data-sub-tab]',
        tabContentSelector: '.sub-tab-content',
        dataAttr: 'data-sub-tab',
        contentIdPrefix: '',
        useDisplayNone: false
    });

    // Add event listener for dashboard sub-tab to load stats
    const dashboardSubTab = document.querySelector('.sub-tab-button[data-sub-tab="dashboard"]');
    if (dashboardSubTab) {
        dashboardSubTab.addEventListener('click', () => {
            console.log('main.js: Dashboard sub-tab clicked, loading stats...');
            setTimeout(() => {
                loadDashboardStats();
            }, 100);
        });
    }
    setupSubTabs({
        tabButtonSelector: '.mood-sub-tab-button',
        tabContentSelector: '.mood-sub-tab-content',
        dataAttr: 'data-mood-sub-tab',
        contentIdPrefix: 'mood-',
        useDisplayNone: false
    });
    setupSubTabs({
        tabButtonSelector: '.work-sub-tab-button',
        tabContentSelector: '.work-sub-tab-content',
        dataAttr: 'data-work-sub-tab',
        contentIdPrefix: 'work-',
        useDisplayNone: true // work sub-tabs use display:none in HTML
    });

    // Initialize Stats sub-tab or restore from URL parameter
    const urlSubTab = urlParams.get('subtab') || 'dashboard';
    const subTabToActivate = document.querySelector(`.sub-tab-button[data-sub-tab="${urlSubTab}"]`);
    const subTabContentToActivate = document.getElementById(urlSubTab);
    if (subTabToActivate && subTabContentToActivate) {
        document.querySelectorAll('.sub-tab-button[data-sub-tab]').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
        subTabToActivate.classList.add('active');
        subTabContentToActivate.classList.add('active');
        console.log(`main.js: Restored sub-tab from URL: ${urlSubTab}`);
    } else {
        // Fallback to dashboard sub-tab
        const firstSubTab = document.querySelector('.sub-tab-button[data-sub-tab="dashboard"]');
        const firstSubTabContent = document.getElementById('dashboard');
        if (firstSubTab && firstSubTabContent) {
            document.querySelectorAll('.sub-tab-button[data-sub-tab]').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
            firstSubTab.classList.add('active');
            firstSubTabContent.classList.add('active');
            console.log('main.js: Initialized Dashboard sub-tab as active');
        } else {
            console.error('main.js: Dashboard sub-tab or content not found');
        }
    }

    // Handle stats form submission
    const statsForm = document.getElementById('stats-form');
    if (statsForm) {
        statsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(statsForm);
            const success = await addMetric(formData);
            if (success) {
                statsForm.reset();
                // Set default date
                const dateInput = statsForm.querySelector('input[type="date"]');
                if (dateInput) {
                    dateInput.value = today;
                }
            }
        });
    }

    // Handle edit stat form submission
    const editStatForm = document.getElementById('edit-stat-form');
    if (editStatForm) {
        editStatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(editStatForm);
            const statId = formData.get('id');
            
            try {
                const response = await fetch(`/fitness/edit_stat/${statId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(Object.fromEntries(formData))
                });
                
                const result = await response.json();
                if (response.ok) {
                    showSnack(result.message || 'Stat updated successfully', 'success');
                    // Close modal
                    const modal = document.getElementById('edit-stat-modal');
                    if (modal) modal.style.display = 'none';
                    // Refresh dashboard stats
                    if (window.refreshDashboardStats) {
                        window.refreshDashboardStats();
                    }
                } else {
                    showSnack(result.error || 'Failed to update stat', 'error');
                }
            } catch (error) {
                showSnack('Failed to update stat', 'error');
            }
        });
    }
});

export async function addMetric(formData) {
    try {
        const response = await fetch('/add_metric', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            showSnack(result.message);
            // Refresh dashboard stats after successful metric addition
            if (window.refreshDashboardStats) {
                window.refreshDashboardStats();
            }
            return true;
        } else {
            showSnack(result.error || 'Failed to add metric', 'error');
            return false;
        }
    } catch (error) {
        showSnack('Failed to add metric', 'error');
        return false;
    }
}