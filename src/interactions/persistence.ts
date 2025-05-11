import { sanitizeFilename } from '../utils.js';
import type { ItemPositions, SavedPositionData, ItemPosition } from './types.js';
import { itemPositions, clearItemPositions, initializeHistory, addStateToHistory, getItemId } from './state.js';
import { applyPositions, initializeDefaultPositions } from './initialization.js';

/**
 * Saves the current item positions to the server.
 * Converts internal state (itemPositions) to the format expected by the server
 * (an array of objects, including filepath and parser).
 */
export function savePositions(): void {
  const positionsToSave: SavedPositionData[] = Object.entries(itemPositions).map(([id, posData]) => {
    // Create a copy to avoid modifying the original state object directly
    const dataToSave: SavedPositionData = { ...posData };

    // Ensure essential fields exist, provide defaults if necessary (though state should be reliable)
    // No, we want to save exactly what's in the state. If left/top are undefined, they stay undefined.
    // dataToSave.left = dataToSave.left ?? '0px';
    // dataToSave.top = dataToSave.top ?? '0px';

    // Clean up default values before saving to keep JSON smaller
    if (dataToSave.opacity !== undefined && dataToSave.opacity >= 1.0) {
      delete dataToSave.opacity;
    }
    if (dataToSave.rotation !== undefined && dataToSave.rotation === 0) {
      delete dataToSave.rotation;
    }
    if (dataToSave.scale !== undefined && dataToSave.scale === '1') {
        delete dataToSave.scale;
    }
    // We need filepath to reload, so ensure it's present
    if (!dataToSave.filepath) {
        console.warn(`Item with ID ${id} is missing filepath. It might not reload correctly.`);
        // Optionally add the id as a fallback if filepath is crucial
        dataToSave.id = id;
    }

    return dataToSave;
  });

  fetch('/save-positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objects: positionsToSave }, null, 2) // Send the array wrapped in "objects"
  })
  .then(response => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
  .then(data => console.log('Positions saved:', data))
  .catch(error => console.error('Error saving positions:', error));
}

/**
 * Updates the history stack with the current state and then saves positions.
 */
export function updateAndSavePositions(): void {
  addStateToHistory(); // Update history first
  savePositions();     // Then save the current state
}

/**
 * Loads item positions from the server.
 * Parses the server response (array format) and updates the internal state.
 * Initializes history with the loaded state.
 * Applies the loaded positions to the DOM elements.
 */
export async function loadPositions(): Promise<void> {
  try {
    const response = await fetch('/load-positions');
    if (!response.ok) {
      if (response.status === 404) {
        console.log('No saved settings found, initializing defaults.'); // Updated message
        initializeDefaultPositions(); // Place items initially if no file
        return; // Exit if file not found
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const settingsData = await response.json(); // This will be an object like { objects: [] }
    const loadedPositionsArray: SavedPositionData[] = settingsData.objects || []; // Access the array under "objects"

    clearItemPositions(); // Clear current state before loading

    // Process the loaded array and populate the itemPositions state
    loadedPositionsArray.forEach(itemData => {
      if (!itemData.filepath && !itemData.id) {
          console.warn("Loaded item data is missing 'filepath' and 'id'. Skipping.", itemData);
          return; // Skip this item if no identifier
      }

      // Determine the ID for the state object. Prefer ID if present, otherwise generate from filepath.
      let itemId: string;
      if (itemData.id) {
          itemId = itemData.id;
      } else if (itemData.filepath) {
          const filename = itemData.filepath.split(/[\\/]/).pop();
          if (filename) {
              // Use a consistent ID generation method (like the one used when adding items)
              // Assuming getItemId can handle just a filename/filepath fragment
              // If getItemId adds timestamps, loading might create different IDs than expected.
              // Let's use sanitizeFilename directly for loading consistency if getItemId is problematic.
              itemId = sanitizeFilename(filename); // Use sanitizeFilename for predictable ID from filepath
              // Alternative: If ID was saved based on timestamp, we might need to store the ID explicitly.
          } else {
              console.warn("Could not extract filename to generate ID from filepath:", itemData.filepath);
              itemId = `unknown_${Math.random().toString(36).substring(7)}`; // Fallback ID
          }
      } else {
           // Should be caught by the initial check, but as a safeguard:
           itemId = `unknown_${Math.random().toString(36).substring(7)}`;
      }


      // Store the complete item data (including filepath, parser, etc.) in the state
      // No need to destructure 'id' or 'filepath' out, ItemPosition includes them
      itemPositions[itemId] = itemData as ItemPosition; // Cast might be needed if types slightly diverge
    });

    // ApplyPositions is now async, ensure we await it
    await applyPositions();

    // Initialize history with the loaded state
    initializeHistory(itemPositions);

  } catch (error) {
    console.error('Error loading positions:', error);
    initializeDefaultPositions(); // Fallback to default placement on error
  }
}
