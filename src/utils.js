export function sanitizeFilename(filename) {
  // Remove extension and replace non-alphanumeric characters (except hyphen) with underscore
  return filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9-]/g, '_') // Replace invalid chars with underscore
    .replace(/[^a-zA-Z0-9-]/g, '_') // Replace invalid chars with underscore
    .toLowerCase(); // Optional: make it lowercase
}

let currentToastElement = null;
let currentToastTimeoutId = null;

/**
 * Displays a single, short-lived toast message on the screen.
 * If a toast is already visible, updates its content and resets the timer.
 * Otherwise, creates and fades in a new toast.
 * @param {string} message The message to display.
 * @param {number} [duration=3000] How long the toast should be visible in milliseconds.
 */
export function showToast(message, duration = 3000) {
    // console.log('showToast called with message:', message, 'and duration:', duration);
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container not found!');
        return;
    }

    // Clear any existing timeout
    if (currentToastTimeoutId) {
        clearTimeout(currentToastTimeoutId);
        currentToastTimeoutId = null;
    }

    // Function to set the removal timeout
    const setRemovalTimeout = (toastElement, removalDuration) => {
        currentToastTimeoutId = setTimeout(() => {
            toastElement.classList.remove('show');
            // Remove the element after the fade-out transition completes
            const removeHandler = () => {
                if (toastElement.parentNode === container) {
                    container.removeChild(toastElement);
                }
                // Clear reference only if it's the currently tracked toast being removed
                if (currentToastElement === toastElement) {
                    currentToastElement = null;
                    currentToastTimeoutId = null; // Ensure timeout ID is cleared on removal
                }
            };
            toastElement.addEventListener('transitionend', removeHandler, { once: true });
            // Fallback removal if transitionend doesn't fire
            setTimeout(removeHandler, 500); // Corresponds to the CSS transition duration
        }, removalDuration);
    };

    // If a toast is already visible, update it
    if (currentToastElement && currentToastElement.parentNode === container && currentToastElement.classList.contains('show')) {
        currentToastElement.textContent = message; // Update text
        setRemovalTimeout(currentToastElement, duration); // Reset timer
    } else {
        // If an old toast exists but isn't visible/attached, remove it first
        if (currentToastElement && currentToastElement.parentNode === container) {
             container.removeChild(currentToastElement);
        }

        // Create and show a new toast
        const newToast = document.createElement('div');
        newToast.className = 'toast-message';
        newToast.textContent = message;
        container.appendChild(newToast);
        currentToastElement = newToast; // Track the new toast

        // Trigger reflow to ensure fade-in transition works
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                newToast.classList.add('show');
                setRemovalTimeout(newToast, duration); // Set timer after starting fade-in
            });
        });
    }
}
