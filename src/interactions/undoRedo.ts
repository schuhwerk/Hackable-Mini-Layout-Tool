import { undoHistory, redoHistory } from './state.js';
import { applyPositions } from './initialization.js';
import { savePositions } from './persistence.js'; // Need to save after undo/redo

/**
 * Handles keydown events specifically for Undo (Ctrl+Z) and Redo (Ctrl+Y).
 * @param event The KeyboardEvent.
 */
function handleUndoRedoKeys(event: KeyboardEvent): void {
  // --- Undo ---
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault(); // Prevent default browser undo action
    console.log("Undo triggered (Ctrl+Z)");

    const restoredState = undoHistory();
    if (restoredState) {
      applyPositions(); // Update the visual positions of elements
      savePositions();  // Save the undone state to the server
    }
  }
  // --- Redo ---
  else if (event.ctrlKey && event.key === 'y') {
    event.preventDefault(); // Prevent default browser redo action
    console.log("Redo triggered (Ctrl+Y)");

    const restoredState = redoHistory();
    if (restoredState) {
        applyPositions(); // Update the visual positions of elements
        savePositions();  // Save the redone state to the server
    }
  }
}

/**
 * Initializes the keydown listener for undo/redo actions.
 */
export function initializeUndoRedoListener(): void {
  document.addEventListener('keydown', handleUndoRedoKeys);
  console.log("Undo/Redo listener initialized.");
}
