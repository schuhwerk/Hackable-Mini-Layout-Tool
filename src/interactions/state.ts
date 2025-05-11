import type { ItemPositions, ItemPosition } from './types';

// --- Centralized State ---
export const itemPositions: ItemPositions = {}; // Object to store positions { itemId: { left, top, width?, pageIndex?, opacity?, rotation? } }
export let positionHistory: ItemPositions[] = []; // Array to store snapshots of itemPositions
export let historyIndex: number = -1; // Pointer to the current state in positionHistory

export let dragOffsetX: number = 0;
export let dragOffsetY: number = 0;
export let draggedElement: HTMLElement | null = null;
export let currentlyHoveredItem: HTMLElement | null = null; // Track the item currently being hovered over
export let selectedElementId: string | null = null; // Track the currently selected element's ID

// --- State Modification Functions ---

export function setSelectedElementId(id: string | null): void {
  selectedElementId = id;
}

export function setDraggedElement(element: HTMLElement | null): void {
  draggedElement = element;
}

export function setDragOffset(x: number, y: number): void {
  dragOffsetX = x;
  dragOffsetY = y;
}

export function setCurrentlyHoveredItem(element: HTMLElement | null): void {
  currentlyHoveredItem = element;
}

/**
 * Updates or adds position data for a specific item.
 * Cleans up default opacity (>=1) and rotation (0).
 */
export function updateItemPosition(id: string, positionData: Partial<ItemPosition>): void {
    if (!itemPositions[id]) {
        // Initialize with defaults if it's a new item being tracked
        itemPositions[id] = { left: '0px', top: '0px' };
    }
    // Merge new data with existing data
    itemPositions[id] = { ...itemPositions[id], ...positionData };

    // Clean up default values
    if (itemPositions[id].opacity !== undefined && itemPositions[id].opacity! >= 1.0) {
        delete itemPositions[id].opacity;
    }
    if (itemPositions[id].rotation !== undefined && itemPositions[id].rotation === 0) {
        delete itemPositions[id].rotation;
    }
}

export function deleteItemPosition(id: string): void {
    delete itemPositions[id];
}

export function clearItemPositions(): void {
    Object.keys(itemPositions).forEach(key => delete itemPositions[key]);
}

export function getItemPosition(id: string): ItemPosition | undefined {
    return itemPositions[id];
}

/**
 * Generates a unique ID for a draggable item based on its filename.
 * Replaces non-alphanumeric characters (excluding spaces and periods) with underscores and adds a timestamp.
 * @param filename The original filename.
 * @returns A unique string ID.
 */
export function getItemId(filename: string): string {
    // Sanitize filename: replace non-alphanumeric (excluding spaces and periods) with underscores
    const sanitized = filename.replace(/[^a-zA-Z0-9. ]/g, '_');
    // Add timestamp for uniqueness (simple approach)
    const timestamp = Date.now();
    return `${sanitized}_${timestamp}`;
}

// --- History Management ---

/**
 * Adds the current state to the history stack.
 * Clears future history if branching off from an undo point.
 */
export function addStateToHistory(): void {
    // Create a deep copy of the current state for the history
    const currentState = JSON.parse(JSON.stringify(itemPositions));

    // If we undo and then make a new change, clear the 'future' history
    if (historyIndex < positionHistory.length - 1) {
        positionHistory = positionHistory.slice(0, historyIndex + 1);
    }

    // Add the new state to the history
    positionHistory.push(currentState);
    historyIndex++;

    // Limit history size (optional, e.g., keep last 100 states)
    const maxHistorySize = 100;
    if (positionHistory.length > maxHistorySize) {
        positionHistory.shift(); // Remove the oldest state
        historyIndex--; // Adjust index
    }
    console.log(`History updated. Index: ${historyIndex}, Size: ${positionHistory.length}`);
}

/**
 * Restores the previous state from history.
 * Returns the restored state or null if no history.
 */
export function undoHistory(): ItemPositions | null {
    if (historyIndex > 0) {
        historyIndex--;
        // Restore the previous state - IMPORTANT: deep copy to avoid modifying history
        const previousState = JSON.parse(JSON.stringify(positionHistory[historyIndex]));

        // Clear current itemPositions and assign the restored state
        clearItemPositions();
        Object.assign(itemPositions, previousState);

        console.log(`Rolled back to history index: ${historyIndex}`);
        return previousState;
    } else {
        console.log("No previous state in history to undo.");
        return null;
    }
}

/**
 * Restores the next state from history (redo).
 * Returns the restored state or null if at the end of history.
 */
export function redoHistory(): ItemPositions | null {
    if (historyIndex < positionHistory.length - 1) {
        historyIndex++;
        // Restore the next state - IMPORTANT: deep copy
        const nextState = JSON.parse(JSON.stringify(positionHistory[historyIndex]));

        // Clear current itemPositions and assign the restored state
        clearItemPositions();
        Object.assign(itemPositions, nextState);

        console.log(`Rolled forward to history index: ${historyIndex}`);
        return nextState;
    } else {
        console.log("No future state in history to redo.");
        return null;
    }
}

/**
 * Initializes the history with the given state.
 */
export function initializeHistory(initialState: ItemPositions): void {
    positionHistory = [JSON.parse(JSON.stringify(initialState))];
    historyIndex = 0;
    console.log("History initialized.");
}
