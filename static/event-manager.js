// Event management system for consistent event handling

class EventManager {
    constructor() {
        this.listeners = new Map();
        this.globalListeners = new Map();
    }

    // Add event listener with automatic cleanup
    addListener(element, event, handler, options = {}) {
        if (!element) return;
        
        const key = `${element.id || 'anonymous'}_${event}`;
        
        // Remove existing listener if any
        this.removeListener(key);
        
        // Add new listener
        element.addEventListener(event, handler, options);
        
        // Store for cleanup
        this.listeners.set(key, {
            element,
            event,
            handler,
            options
        });
    }

    // Remove specific event listener
    removeListener(key) {
        const listener = this.listeners.get(key);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            this.listeners.delete(key);
        }
    }

    // Add global event listener
    addGlobalListener(event, handler, options = {}) {
        const key = `global_${event}`;
        
        // Remove existing global listener if any
        this.removeGlobalListener(key);
        
        // Add new global listener
        document.addEventListener(event, handler, options);
        
        // Store for cleanup
        this.globalListeners.set(key, {
            event,
            handler,
            options
        });
    }

    // Remove global event listener
    removeGlobalListener(key) {
        const listener = this.globalListeners.get(key);
        if (listener) {
            document.removeEventListener(listener.event, listener.handler, listener.options);
            this.globalListeners.delete(key);
        }
    }

    // Clean up all listeners
    cleanup() {
        // Clean up element listeners
        this.listeners.forEach((listener, key) => {
            this.removeListener(key);
        });
        
        // Clean up global listeners
        this.globalListeners.forEach((listener, key) => {
            this.removeGlobalListener(key);
        });
    }

    // Utility method for form submissions
    addFormSubmitListener(formElement, endpoint, options = {}) {
        this.addListener(formElement, 'submit', async (e) => {
            e.preventDefault();
            
            try {
                const formData = new FormData(formElement);
                const response = await fetch(endpoint, {
                    method: options.method || 'POST',
                    body: formData,
                    ...options
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    if (typeof showSnack !== 'undefined') {
                        showSnack(data.message || 'Success!', 'success');
                    }
                    if (options.onSuccess) options.onSuccess(data);
                } else {
                    if (typeof showSnack !== 'undefined') {
                        showSnack(data.error || 'Failed to submit form', 'error');
                    }
                    if (options.onError) options.onError(data.error);
                }
            } catch (error) {
                console.error('Form submission error:', error);
                if (typeof showSnack !== 'undefined') {
                    showSnack('Network error. Please try again.', 'error');
                }
                if (options.onError) options.onError(error.message);
            }
        });
    }

    // Utility method for modal management
    addModalListeners(modalElement, openButton, closeButton) {
        if (openButton) {
            this.addListener(openButton, 'click', () => {
                modalElement.style.display = 'flex';
            });
        }
        
        if (closeButton) {
            this.addListener(closeButton, 'click', () => {
                modalElement.style.display = 'none';
            });
        }
        
        // Close on backdrop click
        this.addListener(modalElement, 'click', (e) => {
            if (e.target === modalElement) {
                modalElement.style.display = 'none';
            }
        });
    }

    // Utility method for tab switching
    addTabListeners(tabElements, contentElements) {
        tabElements.forEach((tab, index) => {
            this.addListener(tab, 'click', () => {
                // Remove active class from all tabs and content
                tabElements.forEach(t => t.classList.remove('active'));
                contentElements.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                if (contentElements[index]) {
                    contentElements[index].classList.add('active');
                }
            });
        });
    }

    // Utility method for debounced input handling
    addDebouncedInputListener(inputElement, handler, delay = 300) {
        let timeout;
        
        this.addListener(inputElement, 'input', (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => handler(...args), delay);
        });
    }
}

// Global event manager instance
const eventManager = new EventManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
}); 