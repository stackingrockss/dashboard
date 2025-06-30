// import { loadTradingSubTab } from './trading.js';
import { showSnack } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('main.js: DOMContentLoaded');
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const today = new Date().toISOString().split('T')[0];

    // Check for a 'tab' query parameter to set the active tab
    const urlParams = new URLSearchParams(window.location.search);
    const activeTabId = urlParams.get('tab') || 'fitness';

    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const tabToActivate = document.querySelector(`.tab-button[data-tab="${activeTabId}"]`);
    const contentToActivate = document.getElementById(activeTabId);

    if (tabToActivate && contentToActivate) {
        tabToActivate.classList.add('active');
        contentToActivate.classList.add('active');
    } else {
        // Fallback to the first tab if the specified tab is not found
        if (tabs.length > 0) tabs[0].classList.add('active');
        if (tabContents.length > 0) tabContents[0].classList.add('active');
    }

    // Handle tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            console.log(`main.js: Tab clicked: ${tab.getAttribute('data-tab')}`);
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            const content = document.getElementById(tabId);
            if (content) {
                content.classList.add('active');
                console.log(`main.js: Activated tab content: ${tabId}`);
                // Update URL with the active tab parameter
                const url = new URL(window.location);
                url.searchParams.set('tab', tabId);
                window.history.pushState({}, '', url);
                if (tabId === 'work') {
                    window.fetchWorkEntries();
                }
                if (tabId === 'trading') {
                    // Always load and visually activate the correct trading sub-tab
                    const tradingSubTabs = document.querySelectorAll('.sub-tab-button[data-trading-sub-tab]');
                    const tradingSubTabContents = document.querySelectorAll('#trading .sub-tab-content');
                    let subTab = 'trading-dashboard';
                    const activeTradingSubTab = document.querySelector('.sub-tab-button[data-trading-sub-tab].active');
                    if (activeTradingSubTab) {
                        subTab = 'trading-' + activeTradingSubTab.getAttribute('data-trading-sub-tab');
                    }
                    // Remove all active classes
                    tradingSubTabs.forEach(t => t.classList.remove('active'));
                    tradingSubTabContents.forEach(c => c.classList.remove('active'));
                    // Activate the correct sub-tab button and content
                    const btn = document.querySelector('.sub-tab-button[data-trading-sub-tab][data-trading-sub-tab="' + subTab.replace('trading-', '') + '"]');
                    const content = document.getElementById(subTab);
                    if (btn) btn.classList.add('active');
                    if (content) content.classList.add('active');
                    import('./trading.js').then(mod => {
                        if (mod.loadTradingSubTab) mod.loadTradingSubTab(subTab);
                    });
                }
            } else {
                console.error(`main.js: Tab content not found for ID: ${tabId}`);
            }
        });
    });

    // Set default date for date inputs
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.value = today;
    });

    // Handle fitness sub-tabs
    const fitnessSubTabs = document.querySelectorAll('.sub-tab-button[data-sub-tab]');
    fitnessSubTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            console.log(`main.js: Fitness sub-tab clicked: ${tab.getAttribute('data-sub-tab')}`);
            fitnessSubTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const subTabId = tab.getAttribute('data-sub-tab');
            const subTabContent = document.getElementById(subTabId);
            if (subTabContent) {
                subTabContent.classList.add('active');
                console.log(`main.js: Activated fitness sub-tab content: ${subTabId}`);
                
                // Update URL with the active sub-tab parameter
                const url = new URL(window.location);
                url.searchParams.set('subtab', subTabId);
                window.history.pushState({}, '', url);
            } else {
                console.error(`main.js: Fitness sub-tab content not found for ID: ${subTabId}`);
            }
        });
    });

    // Initialize Stats sub-tab or restore from URL parameter
    const urlSubTab = urlParams.get('subtab') || 'dashboard';
    const subTabToActivate = document.querySelector(`.sub-tab-button[data-sub-tab="${urlSubTab}"]`);
    const subTabContentToActivate = document.getElementById(urlSubTab);
    
    if (subTabToActivate && subTabContentToActivate) {
        fitnessSubTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
        subTabToActivate.classList.add('active');
        subTabContentToActivate.classList.add('active');
        console.log(`main.js: Restored sub-tab from URL: ${urlSubTab}`);
    } else {
        // Fallback to dashboard sub-tab
        const firstSubTab = document.querySelector('.sub-tab-button[data-sub-tab="dashboard"]');
        const firstSubTabContent = document.getElementById('dashboard');
        if (firstSubTab && firstSubTabContent) {
            fitnessSubTabs.forEach(t => t.classList.remove('active'));
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