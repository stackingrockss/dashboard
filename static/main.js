// import { loadTradingSubTab } from './trading.js';
import { showSnack } from './utils.js';

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
        });
    });

    // Set default date for date inputs
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.value = today;
    });

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