// Shared utilities for common functions across the application

// Query parameter utilities
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

// Audio utilities
function initAudio(audioPath = '/static/sounds/pr-achievement.mp3') {
    try {
        const audio = new Audio(audioPath);
        audio.preload = 'auto';
        console.log('Audio initialized successfully');
        return audio;
    } catch (error) {
        console.error('Failed to initialize audio:', error);
        return null;
    }
}

function playSound(audio, type = 'pr') {
    if (audio) {
        try {
            audio.currentTime = 0;
            audio.play().catch(error => {
                console.error('Failed to play sound:', error);
            });
            console.log('Playing sound');
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    } else {
        console.warn('Audio not initialized');
    }
}

// Timer utilities
class TimerManager {
    constructor() {
        this.timers = new Map();
        this.intervals = new Map();
    }

    setTimeout(id, callback, delay) {
        this.clearTimeout(id);
        const timerId = setTimeout(callback, delay);
        this.timers.set(id, timerId);
        return timerId;
    }

    clearTimeout(id) {
        const timerId = this.timers.get(id);
        if (timerId) {
            clearTimeout(timerId);
            this.timers.delete(id);
        }
    }

    setInterval(id, callback, delay) {
        this.clearInterval(id);
        const intervalId = setInterval(callback, delay);
        this.intervals.set(id, intervalId);
        return intervalId;
    }

    clearInterval(id) {
        const intervalId = this.intervals.get(id);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(id);
        }
    }

    clearAll() {
        this.timers.forEach(timerId => clearTimeout(timerId));
        this.intervals.forEach(intervalId => clearInterval(intervalId));
        this.timers.clear();
        this.intervals.clear();
    }
}

// Storage utilities
class StorageManager {
    constructor(prefix = 'dashboard_') {
        this.prefix = prefix;
    }

    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    clear(pattern = null) {
        try {
            if (pattern) {
                // Remove items matching pattern
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(this.prefix) && key.includes(pattern)) {
                        localStorage.removeItem(key);
                    }
                });
            } else {
                // Remove all prefixed items
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(this.prefix)) {
                        localStorage.removeItem(key);
                    }
                });
            }
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }
}

// Modal utilities
class ModalManager {
    constructor() {
        this.activeModals = new Set();
    }

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            this.activeModals.add(modalId);
            this.setupModalListeners(modal, modalId);
        }
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            this.activeModals.delete(modalId);
        }
    }

    setupModalListeners(modal, modalId) {
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close(modalId);
            }
        });

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape' && this.activeModals.has(modalId)) {
                this.close(modalId);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    closeAll() {
        this.activeModals.forEach(modalId => this.close(modalId));
    }
}

// Form utilities
class FormManager {
    static async submitForm(formElement, endpoint, options = {}) {
        const formData = new FormData(formElement);
        
        try {
            const response = await fetch(endpoint, {
                method: options.method || 'POST',
                body: formData,
                ...options
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSnack(data.message || 'Success!', 'success');
                return { success: true, data };
            } else {
                showSnack(data.error || 'Failed to submit form', 'error');
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Form submission error:', error);
            showSnack('Network error. Please try again.', 'error');
            return { success: false, error: error.message };
        }
    }

    static resetForm(formElement) {
        if (formElement) {
            formElement.reset();
        }
    }

    static validateForm(formElement, validators = {}) {
        const errors = [];
        const formData = new FormData(formElement);
        
        for (const [fieldName, validator] of Object.entries(validators)) {
            const value = formData.get(fieldName);
            const error = validator(value);
            if (error) {
                errors.push({ field: fieldName, message: error });
            }
        }
        
        return errors;
    }
}

// Time formatting utilities
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Global instances
const timerManager = new TimerManager();
const storageManager = new StorageManager();
const modalManager = new ModalManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    timerManager.clearAll();
}); 