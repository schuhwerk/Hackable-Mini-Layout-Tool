import { loadPositions } from './persistence.js'; // Removed updateAndSavePositions as it's used in fileDrop now
import { initializeDragDropListeners } from './dragDrop.js';
import { initializeWheelTransformListener, initializeModifierKeyListeners } from './wheelTransform.js'; // Updated import
import { initializeUndoRedoListener } from './undoRedo.js';
import { initializeFileDropListeners } from './fileDrop.js'; // Import the new file drop initializer
import { showToast } from '../utils.js';
// Removed imports related to file drop as they are now in fileDrop.ts

/**
 * Main initialization function for the drag and drop logic.
 * Sets up all necessary event listeners and loads initial positions.
 */
function initializeDragLogic(): void {
    console.log("Initializing drag logic...");

    // Initialize all feature modules
    initializeDragDropListeners();
    initializeWheelTransformListener();
    initializeUndoRedoListener();
    initializeFileDropListeners(); // Initialize the file drop listeners
    initializeModifierKeyListeners(); // Added call

    // Load positions after setting up listeners (loadPositions calls applyPositions/initializeDefaultPositions)
    // Wait for the DOM to be fully loaded before trying to load/apply positions
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadPositions().catch(error => console.error("Error during initial position loading:", error));
        });
    } else {
        // DOM is already loaded
        loadPositions().catch(error => console.error("Error during initial position loading:", error));
    }

    console.log("Drag logic initialization complete.");

    // Show initial help toast after a short delay to ensure DOM is ready
    setTimeout(() => {
        showToast("Wheel + Ctrl/Shift/Alt over item to change Opacity/Scale/Rotation. Drag files to upload.", 5000); // Updated toast
    }, 500);

    // File drop listeners are now initialized by initializeFileDropListeners()
}

// File drop handlers (handleFileDragOver, handleFileDragLeave, handleFileDrop, addNewItemToPage) are removed.

// --- Start Initialization ---
initializeDragLogic();

// Export something minimal if needed for module identification, though likely not needed for IIFE.
// export const initialized = true;
