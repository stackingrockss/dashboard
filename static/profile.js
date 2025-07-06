import { showSnack } from './utils.js';
import {
    getQueryParam, initAudio, playSound, timerManager, storageManager,
    modalManager, formatTime
} from './shared-utils.js';
import { eventManager } from './event-manager.js';

// Profile and Settings Management
class ProfileManager {
    constructor() {
        this.profileData = null;
        this.settingsData = null;
        this.init();
    }

    async init() {
        await this.loadProfileData();
        this.setupEventListeners();
        this.populateForms();
    }

    async loadProfileData() {
        try {
            const response = await fetch('/profile/api/profile');
            if (!response.ok) throw new Error('Failed to load profile data');
            
            const data = await response.json();
            this.profileData = data.user;
            this.settingsData = data.settings;
        } catch (error) {
            console.error('Error loading profile data:', error);
            this.showMessage('Error loading profile data', 'error');
        }
    }

    setupEventListeners() {
        // Profile form
        document.getElementById('profile-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        // Settings forms
        document.getElementById('display-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateSettings('display');
        });

        document.getElementById('fitness-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateSettings('fitness');
        });

        document.getElementById('notification-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateSettings('notification');
        });

        document.getElementById('privacy-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateSettings('privacy');
        });

        document.getElementById('data-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateSettings('data');
        });

        // Account actions
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('delete-account-btn').addEventListener('click', () => {
            this.showDeleteModal();
        });

        // Delete modal
        document.getElementById('confirm-delete').addEventListener('click', () => {
            this.deleteAccount();
        });

        document.getElementById('cancel-delete').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        // Close modal when clicking outside
        document.getElementById('delete-modal').addEventListener('click', (e) => {
            if (e.target.id === 'delete-modal') {
                this.hideDeleteModal();
            }
        });
    }

    populateForms() {
        if (!this.profileData || !this.settingsData) return;

        // Populate profile form
        document.getElementById('first_name').value = this.profileData.first_name || '';
        document.getElementById('last_name').value = this.profileData.last_name || '';
        document.getElementById('username').value = this.profileData.username || '';
        document.getElementById('email').value = this.profileData.email || '';
        document.getElementById('weight').value = this.profileData.weight || '';
        document.getElementById('height').value = this.profileData.height || '';
        document.getElementById('birthdate').value = this.profileData.birthdate || '';
        document.getElementById('age').value = this.profileData.age || '';
        document.getElementById('sex').value = this.profileData.sex || '';

        // Populate settings forms
        document.getElementById('theme').value = this.settingsData.theme || 'light';
        document.getElementById('units').value = this.settingsData.units || 'imperial';
        document.getElementById('date-format').value = this.settingsData.date_format || 'MM/DD/YYYY';
        
        document.getElementById('activity-level').value = this.settingsData.activity_level || 'moderate';
        document.getElementById('goal').value = this.settingsData.goal || 'maintain';
        document.getElementById('weekly-goal').value = this.settingsData.weekly_goal || 0.5;
        document.getElementById('calorie-deficit').value = this.settingsData.calorie_deficit || 500;
        
        document.getElementById('email-notifications').checked = this.settingsData.email_notifications || false;
        document.getElementById('reminder-frequency').value = this.settingsData.reminder_frequency || 'daily';
        document.getElementById('reminder-time').value = this.settingsData.reminder_time || '09:00';
        
        document.getElementById('profile-visibility').value = this.settingsData.profile_visibility || 'private';
        document.getElementById('share-progress').checked = this.settingsData.share_progress || false;
        
        document.getElementById('auto-backup').checked = this.settingsData.auto_backup || true;
        document.getElementById('data-retention-days').value = this.settingsData.data_retention_days || 365;
    }

    async updateProfile() {
        const form = document.getElementById('profile-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/profile/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to update profile');

            const result = await response.json();
            this.showMessage(result.message || 'Profile updated successfully', 'success');
            
            // Reload profile data
            await this.loadProfileData();
            
            // Refresh dashboard stats if weight was updated
            if (data.weight && window.refreshDashboardStats) {
                window.refreshDashboardStats();
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showMessage('Error updating profile', 'error');
        }
    }

    async updateSettings(type) {
        const form = document.getElementById(`${type}-settings-form`);
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Convert checkbox values to boolean
        Object.keys(data).forEach(key => {
            if (data[key] === 'on') {
                data[key] = true;
            } else if (data[key] === '') {
                data[key] = false;
            }
        });

        try {
            const response = await fetch('/profile/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to update settings');

            const result = await response.json();
            this.showMessage(result.message || 'Settings updated successfully', 'success');
            
            // Reload settings data
            await this.loadProfileData();
        } catch (error) {
            console.error('Error updating settings:', error);
            this.showMessage('Error updating settings', 'error');
        }
    }

    async exportData() {
        try {
            const response = await fetch('/profile/api/data/export');
            if (!response.ok) throw new Error('Failed to export data');

            const data = await response.json();
            
            // Create and download file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showMessage('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showMessage('Error exporting data', 'error');
        }
    }

    showDeleteModal() {
        document.getElementById('delete-modal').style.display = 'block';
    }

    hideDeleteModal() {
        document.getElementById('delete-modal').style.display = 'none';
    }

    async deleteAccount() {
        try {
            const response = await fetch('/profile/api/account/delete', {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete account');

            const result = await response.json();
            this.showMessage(result.message || 'Account deleted successfully', 'success');
            
            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showMessage('Error deleting account', 'error');
        } finally {
            this.hideDeleteModal();
        }
    }

    showMessage(message, type = 'success') {
        showSnack(message, type);
    }

    // Apply theme based on settings
    applyTheme() {
        if (this.settingsData && this.settingsData.theme) {
            document.documentElement.setAttribute('data-theme', this.settingsData.theme);
        }
    }
}

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});

// Theme switcher functionality
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Check for saved theme preference or default to light
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

// Listen for theme changes
document.addEventListener('themeChange', (e) => {
    applyTheme(e.detail.theme);
});

// Export functions if using modules
// export { loadStats, ... }; 