import {
    draggedElement,
    setDraggedElement,
    dragOffsetX,
    dragOffsetY,
    setDragOffset,
    updateItemPosition,
    getItemPosition,
    currentlyHoveredItem,
    selectedElementId,
    setSelectedElementId,
    deleteItemPosition
} from './state.js';
import { updateAndSavePositions, savePositions } from './persistence.js';
import { showToast } from '../utils.js';

/**
 * Handles the click event for draggable items to select them.
 * @param event The MouseEvent.
 */
function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const draggableItem = target.closest<HTMLElement>('.draggable-item');

  if (draggableItem) {
    // Remove 'selected' class from previously selected element
    if (selectedElementId) {
      const prevSelected = document.getElementById(selectedElementId);
      if (prevSelected) {
        prevSelected.classList.remove('selected');
      }
    }

    // Add 'selected' class to the new selected element
    draggableItem.classList.add('selected');
    setSelectedElementId(draggableItem.id);
    console.log(`Selected element: ${draggableItem.id}`);
  } else {
    // Clicked outside a draggable item, deselect if anything is selected
    if (selectedElementId) {
      const prevSelected = document.getElementById(selectedElementId);
      if (prevSelected) {
        prevSelected.classList.remove('selected');
      }
      setSelectedElementId(null);
      console.log("Deselected element.");
    }
  }
}


/**
 * Handles the keydown event for deleting selected items.
 * @param event The KeyboardEvent.
 */
async function handleKeyDown(event: KeyboardEvent): Promise<void> {
  if (selectedElementId && (event.key === 'Delete' || event.key === 'Backspace')) {
    const elementToRemove = document.getElementById(selectedElementId);
    if (elementToRemove) {
      const itemName = elementToRemove.dataset.filename || selectedElementId; // Use filename if available
      const itemFilepath = getItemPosition(selectedElementId)?.filepath;

      const confirmMessage = `"${itemName}" will be removed from the layout. Also remove the file from the filesystem?`;
      const removeFromFileSystem = confirm(confirmMessage);

      // Remove from DOM
      elementToRemove.remove();

      // Remove from state
      deleteItemPosition(selectedElementId);

      // Save changes to settings.json
      await savePositions();
      showToast(`"${itemName}" removed from layout.`, 3000);

      if (removeFromFileSystem && itemFilepath) {
        try {
          const response = await fetch('/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: itemFilepath })
          });
          if (response.ok) {
            showToast(`File "${itemFilepath}" deleted from filesystem.`, 3000);
            console.log(`File deleted: ${itemFilepath}`);
          } else {
            const errorText = await response.text();
            showToast(`Error deleting file "${itemFilepath}": ${errorText}`, 5000);
            console.error(`Error deleting file: ${errorText}`);
          }
        } catch (error) {
          showToast(`Error sending delete request for "${itemFilepath}": ${error}`, 5000);
          console.error('Error sending delete file request:', error);
        }
      }

      const deletedItemId = selectedElementId; // Store for logging
      setSelectedElementId(null); // Deselect
      console.log(`Processed deletion for element: ${deletedItemId}`);
    }
  }
}


/**
 * Handles the dragstart event for draggable items.
 * Sets the dragged element state, calculates drag offset, and hides the default drag image.
 * @param event The DragEvent.
 */
function handleDragStart(event: DragEvent): void {
  const draggableTarget = (event.target as Element)?.closest<HTMLElement>('.draggable-item');
  if (draggableTarget) {
    setDraggedElement(draggableTarget);
    const pageContainer = draggedElement!.closest<HTMLElement>('.page-container');
    if (!pageContainer) return; // Should not happen if element is placed correctly

    // --- Reverted Offset Calculation ---
    // Calculate offset relative to the element's unrotated top-left corner within the page container.
    // This is necessary for correct positioning during drag when rotation is applied.
    const containerRect = pageContainer.getBoundingClientRect();
    // Use getComputedStyle to get the actual rendered left/top (layout position)
    const style = window.getComputedStyle(draggedElement!);
    const elementLeft = parseFloat(style.left || '0');
    const elementTop = parseFloat(style.top || '0');

    // Calculate the element's unrotated top-left corner position relative to the viewport
    const elementViewportX = containerRect.left + elementLeft;
    const elementViewportY = containerRect.top + elementTop;

    // Calculate the offset from the element's unrotated top-left corner to the mouse click
    const offsetX = event.clientX - elementViewportX;
    const offsetY = event.clientY - elementViewportY;
    setDragOffset(offsetX, offsetY);
    console.log(`Drag Start: Set draggedElement to ${draggableTarget.id}, Offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`); // Log start with offset

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // Hide the default browser drag preview
      const emptyImage = new Image();
      emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent GIF
      event.dataTransfer.setDragImage(emptyImage, 0, 0);
    }
    draggedElement!.classList.add('dragging');
    document.body.style.cursor = 'var(--cursor-grabbing)'; // Use CSS variable
  }
}

/**
 * Handles the dragover event.
 * Prevents default handling, calculates the new position based on mouse movement,
 * updates the element's style to follow the cursor, and moves the element between pages if necessary.
 * Updates the body cursor based on modifier keys.
 * @param event The DragEvent.
 */
function handleDragOver(event: DragEvent): void {
  event.preventDefault(); // Necessary to allow dropping

  if (draggedElement) {
    // Find the page container the mouse is currently over
    let currentTargetPage = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    while (currentTargetPage && !currentTargetPage.classList.contains('page-container')) {
        currentTargetPage = currentTargetPage.parentElement as HTMLElement | null;
    }
    // Fallback to the original page if not over any specific page
    const originalPage = draggedElement.closest<HTMLElement>('.page-container');
    const pageContainer = currentTargetPage || originalPage;

    if (!pageContainer) return; // Should not happen

    // Calculate position relative to the current page container
    const containerRect = pageContainer.getBoundingClientRect();
    let newLeft = event.clientX - containerRect.left - dragOffsetX;
    let newTop = event.clientY - containerRect.top - dragOffsetY;

    // Update the element's style directly to make it follow the mouse
    draggedElement.style.left = `${newLeft}px`;
    draggedElement.style.top = `${newTop}px`;

    // If the element is dragged over a *different* page, temporarily move it in the DOM
    if (pageContainer !== draggedElement.parentElement) {
        pageContainer.appendChild(draggedElement);
        // Re-apply position after DOM move to be sure
        draggedElement.style.left = `${newLeft}px`;
        draggedElement.style.top = `${newTop}px`;
    }
  }
}

/**
 * Handles the drop event.
 * Prevents default handling, determines the final page container, calculates the final position,
 * updates the element's style and the central state, and triggers history update and save.
 * @param event The DragEvent.
 */
function handleDrop(event: DragEvent): void {
  event.preventDefault();
  if (draggedElement) {
    let dropTargetContainer = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    while (dropTargetContainer && !dropTargetContainer.classList.contains('page-container')) {
      dropTargetContainer = dropTargetContainer.parentElement as HTMLElement | null;
    }
    const originalContainer = draggedElement.closest<HTMLElement>('.page-container');
    const pageContainer = dropTargetContainer || originalContainer;

    if (!pageContainer) return; // Should not happen

    const containerRect = pageContainer.getBoundingClientRect();
    let finalLeft = event.clientX - containerRect.left - dragOffsetX;
    let finalTop = event.clientY - containerRect.top - dragOffsetY;

    // Ensure the element is in the final container's DOM
    if (pageContainer !== draggedElement.parentElement) {
      pageContainer.appendChild(draggedElement);
    }

    // Apply final position
    const finalLeftPx = `${finalLeft}px`;
    const finalTopPx = `${finalTop}px`;
    draggedElement.style.left = finalLeftPx;
    draggedElement.style.top = finalTopPx;

    const pageIndex = parseInt(pageContainer.id.split('-')[1] || '0', 10);
    const itemId = draggedElement.id;

    // Update stored position in the central state
    // Preserve existing width, opacity, rotation if they exist
    const existingPosition = getItemPosition(itemId);
    updateItemPosition(itemId, {
      left: finalLeftPx,
      top: finalTopPx,
      pageIndex: pageIndex,
      width: existingPosition?.width, // Preserve existing
      opacity: existingPosition?.opacity, // Preserve existing
      rotation: existingPosition?.rotation // Preserve existing
    });

    updateAndSavePositions(); // Update history and save
  }
}

/**
 * Handles the dragend event.
 * Cleans up by removing the 'dragging' class, resetting cursors, and clearing the dragged element state.
 * @param event The DragEvent.
 */
function handleDragEnd(event: DragEvent): void {
  console.log(`Drag End: Entered. Current draggedElement: ${draggedElement?.id ?? 'null'}`); // Log entry
  // Reset body cursor first, regardless of draggedElement state
  document.body.style.cursor = '';

  if (draggedElement) {
    const endedElementId = draggedElement.id; // Store ID before potential nulling
    draggedElement.classList.remove('dragging');

    // Reset item cursor based on whether it's still hovered
    if (document.body.contains(draggedElement)) { // Check if element still exists
        // Simplified cursor reset
        draggedElement.style.cursor = '';
        console.log(`Drag End: Reset cursor for ${endedElementId}`);
    } else {
        console.log(`Drag End: Element ${endedElementId} no longer in DOM?`);
    }

    console.log(`Drag End: Clearing draggedElement (was ${endedElementId})`);
    setDraggedElement(null); // Clear the state
    console.log(`Drag End: State cleared. draggedElement is now: ${draggedElement?.id ?? 'null'}`); // Verify clear
  } else {
    console.log("Drag End: No draggedElement was set.");
  }
   // Reset body cursor even if no draggedElement was tracked (safety)
   document.body.style.cursor = '';
}


/**
 * Initializes all drag and drop event listeners.
 */
export function initializeDragDropListeners(): void {
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('drop', handleDrop);
  document.addEventListener('dragend', handleDragEnd);
  console.log("Drag and drop listeners initialized.");
}
