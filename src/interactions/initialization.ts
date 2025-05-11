import { itemPositions, updateItemPosition, initializeHistory, getItemId } from './state.js'; // Removed clearItemPositions, added getItemId (might not be needed here)
import type { ItemPosition } from './types.js';
import { parseContent } from '../parsers/index.js'; // Import the unified parser

/**
 * Asynchronously applies the positions stored in the `itemPositions` state object.
 * If an element doesn't exist, it fetches its content based on `filepath`,
 * parses it using the stored `parser`, creates the element, and adds it to the page.
 * Then applies position, size, and transform styles.
 */
export async function applyPositions(): Promise<void> {
  console.log("Applying positions:", itemPositions);
  const itemIds = Object.keys(itemPositions);

  for (const id of itemIds) {
    let element = document.getElementById(id) as HTMLElement | null;
    const pos = itemPositions[id];

    if (!pos) {
        console.warn(`Position data missing for ID ${id} during applyPositions. Skipping.`);
        continue;
    }

    // --- Create element if it doesn't exist ---
    if (!element && pos.parser && pos.filepath) {
        console.log(`Element ${id} not found. Creating from path: ${pos.filepath} using parser: ${pos.parser}`);
        try {
            // 1. Fetch content (or use filepath directly for images)
            let content: string;
            const isImage = pos.parser === 'image';
            if (isImage) {
                content = pos.filepath; // Image parser expects URL
            } else {
                const response = await fetch(pos.filepath);
                if (!response.ok) throw new Error(`Failed to fetch content (${response.status}): ${pos.filepath}`);
                content = await response.text();
            }

            // 2. Parse content
            const filename = pos.filepath.split('/').pop() || id; // Derive filename
            const parsedData = await parseContent(filename, content); // Use the unified parser

            // 3. Create container element
            element = document.createElement('div');
            element.id = id;
            element.classList.add('draggable-item');
            element.draggable = true; // Make it draggable
            element.dataset.filename = filename;
            element.dataset.parser = pos.parser;
            element.appendChild(parsedData.element);

            // Add to DOM (initially hidden/off-screen before positioning?) - Appending later

        } catch (error) {
            console.error(`Failed to load and parse item ${id} (${pos.filepath}):`, error);
            // Optionally remove the faulty position from state?
            // delete itemPositions[id];
            element = null; // Ensure we don't try to style a non-existent element
        }
    } else if (!element) {
        console.warn(`Element with ID ${id} not found and no parser/filepath info available. Skipping.`);
        continue; // Skip to next item if element cannot be found or created
    }

    // --- Apply styles and position if element exists ---
    if (element && pos) {
      // Determine target page container
      const targetPageIndex = pos.pageIndex !== undefined ? pos.pageIndex : 0;
      const targetPageId = `page-${targetPageIndex}`;
      let targetPage = document.getElementById(targetPageId) as HTMLElement | null;

      // Fallback if target page doesn't exist
      if (!targetPage) {
        console.warn(`Target page ${targetPageId} not found for item ${id}. Placing on page 0.`);
        targetPage = document.getElementById('page-0') as HTMLElement | null;
        if (!targetPage) {
          console.error(`Default page 'page-0' not found. Cannot place item ${id}.`);
          continue; // Skip this item
        }
      }

      // Append element to the correct page if it's not already there
      if (element.parentElement !== targetPage) {
        targetPage.appendChild(element);
      }

      // Apply position
      element.style.left = pos.left;
      element.style.top = pos.top;
      element.style.position = 'absolute'; // Ensure it's positioned

      // Apply stored size (width/height) only if defined in pos
      if (pos.width !== undefined) {
        element.style.width = pos.width;
      } else {
        element.style.width = ''; // Explicitly reset if not defined
      }
      if (pos.height !== undefined) {
        element.style.height = pos.height;
      } else {
        element.style.height = ''; // Explicitly reset if not defined
      }

      // Apply stored opacity
      element.style.opacity = pos.opacity !== undefined ? String(pos.opacity) : ''; // Reset if not defined

      // Apply stored transform (rotation and scale)
      const rotation = pos.rotation || 0;
      const scale = pos.scale || '1';
      element.style.transform = `rotate(${rotation}deg) scale(${scale})`;

    }
  } // End of loop
  console.log("Finished applying positions.");
}

// --- initializeDefaultPositions remains largely the same, but might be less needed ---
// It now primarily serves to position items already in the initial HTML
// that *don't* have saved positions, which might be rare.
// It also initializes the history *after* defaults are applied.

/**
 * Calculates and applies default positions for any draggable items
 * that don't already have a position defined in the `itemPositions` state.
 * Arranges items in columns on available pages.
 * Initializes history with the current state after defaults are applied.
 */
export function initializeDefaultPositions(): void {
  console.log("Initializing default positions for any unpositioned items found in DOM...");

  const allItems = document.querySelectorAll<HTMLElement>('.draggable-item');
  const pageContainers = document.querySelectorAll<HTMLElement>('.page-container');
  if (!pageContainers.length) {
      console.error("No page containers found. Cannot initialize default positions.");
      return;
  }

  let currentTop = 20; // Initial top padding
  let currentLeft = 20; // Initial left padding
  const padding = 20;
  const defaultItemHeight = 100; // Fallback height
  const itemSpacing = 15; // Vertical space between items

  let currentPageIndex = 0;
  let currentPageContainer = pageContainers[currentPageIndex];
  if (!currentPageContainer) return; // Should have at least one

  const containerWidth = currentPageContainer.offsetWidth;
  const containerHeight = currentPageContainer.offsetHeight;
  const columnWidth = (containerWidth - 3 * padding) / 2; // Example: 2 columns

  allItems.forEach((element) => {
    const elementId = element.id;
    if (!elementId) {
        console.warn("Draggable item found without an ID. Skipping default positioning.", element);
        return;
    }

    // Only position if not already in the state
    if (!itemPositions[elementId]) {
      element.style.position = 'absolute'; // Ensure positioning context
      const elementHeight = element.offsetHeight || defaultItemHeight;

      // Check if item fits in current column/page
      if (currentTop + elementHeight > containerHeight - padding) {
        // Move to next column
        currentLeft += columnWidth + padding;
        currentTop = padding;

        // Check if item fits in next column (or if we need a new page)
        if (currentLeft + columnWidth > containerWidth - padding) {
          // Move to next page
          currentPageIndex++;
          if (currentPageIndex < pageContainers.length) {
            currentPageContainer = pageContainers[currentPageIndex];
            currentLeft = padding; // Reset to first column
            currentTop = padding; // Reset top
          } else {
            // Out of pages, place on the last page, potentially overlapping
            console.warn(`Not enough pages for default placement of item: ${elementId}. Placing on last page.`);
            currentPageContainer = pageContainers[pageContainers.length - 1];
            // Place in the second column of the last page if possible, otherwise overlap
            currentLeft = padding + columnWidth + padding;
            currentTop = padding; // Reset top for the new column/page attempt
            currentPageIndex = pageContainers.length - 1; // Stay on last page index
          }
        }
      }

      // Append to the determined page container if not already there
      if (currentPageContainer && element.parentElement !== currentPageContainer) { // Add check for currentPageContainer
          currentPageContainer.appendChild(element);
      }

      // Apply calculated position
      const finalLeft = `${currentLeft}px`;
      const finalTop = `${currentTop}px`;
      element.style.left = finalLeft;
      element.style.top = finalTop;

      // Update the state with the default position
      updateItemPosition(elementId, {
        left: finalLeft,
        top: finalTop,
        pageIndex: currentPageIndex
        // Width, Opacity, Rotation remain undefined (default)
      });

      // Move down for the next item
      currentTop += elementHeight + itemSpacing;
    } else {
        // If item already has a position, ensure it's on the correct page
        const pos = itemPositions[elementId];
        const targetPageIndex = pos.pageIndex ?? 0;
        const targetPageId = `page-${targetPageIndex}`;
        const targetPage = document.getElementById(targetPageId);
        if (targetPage && element.parentElement !== targetPage) {
            console.log(`Moving item ${elementId} to its designated page ${targetPageIndex}.`);
            targetPage.appendChild(element);
        }
    }
  });

  // Initialize history *after* potentially adding default positions to the state
  initializeHistory(itemPositions);
  console.log("Default positions checked and history initialized.");
  // We don't save here, saving happens on user interaction or explicit save action.
}

// Modifier Key Toast Notifications and initializeModifierKeyListeners() have been moved to wheelTransform.ts
