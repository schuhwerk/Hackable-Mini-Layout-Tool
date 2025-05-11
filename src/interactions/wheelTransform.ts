import { updateItemPosition, getItemPosition } from './state.js';
import { updateAndSavePositions } from './persistence.js';
import { showToast } from '../utils.js'; // Import showToast

/**
 * Handles wheel events on draggable items for scaling, opacity, and rotation adjustments.
 * - Shift + Wheel: Scale width
 * - Ctrl + Wheel: Adjust opacity
 * - Alt + Wheel: Adjust rotation
 * @param event The WheelEvent.
 */
function handleWheelTransform(event: WheelEvent): void {
  const targetItem = (event.target as Element)?.closest<HTMLElement>('.draggable-item');
  if (!targetItem) return; // Exit if not on a draggable item

  const itemId = targetItem.id;
  if (!itemId) {
      console.warn("Wheel event on draggable item without ID.", targetItem);
      return;
  }

  const image = targetItem.querySelector('.draggable-image');
  const svgContent = targetItem.querySelector('.embedded-svg-content');
  // const isTransformable = image || svgContent; // Check if item contains image or SVG

  // // Only act with Shift/Ctrl/Alt on items containing an image or SVG for scaling/opacity/rotation
  // // Commented out: Allow transform attempts on any draggable item when modifier key is pressed
  // if (!isTransformable && (event.shiftKey || event.ctrlKey || event.altKey)) return;

  const parentPage = targetItem.closest<HTMLElement>('.page-container');
  const pageIndex = parentPage ? parseInt(parentPage.id.split('-')[1] || '0', 10) : 0;

  // Ensure item position exists in state, initialize if not (should be rare)
  let currentPosition = getItemPosition(itemId);
  if (!currentPosition) {
      updateItemPosition(itemId, {
          left: targetItem.style.left || '0px',
          top: targetItem.style.top || '0px',
          pageIndex: pageIndex
      });
      currentPosition = getItemPosition(itemId)!; // Get the newly created position
  }

  let needsSave = false;
  let updatedPositionData: Partial<typeof currentPosition> = {};

  if (event.shiftKey) {
    // --- Opacity Adjustment ---
    event.preventDefault(); // Prevent default browser zoom on Ctrl+Scroll
    const opacityStep = 0.05;
    let currentOpacity = targetItem.style.opacity !== '' ? parseFloat(targetItem.style.opacity) : 1.0;

    currentOpacity += event.deltaY < 0 ? opacityStep : -opacityStep;
    currentOpacity = Math.max(0, Math.min(1, currentOpacity)); // Clamp 0-1

    targetItem.style.opacity = currentOpacity < 1.0 ? String(currentOpacity) : ''; // Set style, use empty for 1
    updatedPositionData.opacity = currentOpacity < 1.0 ? currentOpacity : undefined; // Store value, undefined if 1
    needsSave = true;
    showToast(`Opacity: ${currentOpacity.toFixed(2)}`, 1000); // Show toast

  } else if (event.ctrlKey) {
    // --- Scaling Adjustment (using transform: scale) ---
    event.preventDefault(); // Prevent default horizontal scroll on Shift+Scroll
    const scaleStep = 0.05; // Adjust scale by 5% per step
    let currentScale = parseFloat(currentPosition?.scale || '1'); // Get current scale from state

    currentScale += event.deltaY < 0 ? scaleStep : -scaleStep;
    currentScale = Math.max(0.1, currentScale); // Minimum scale 0.1 (10%)

    // Get current rotation from state to preserve it
    const currentRotation = currentPosition?.rotation || 0;

    // Apply combined transform
    const newScaleStr = String(currentScale);
    targetItem.style.transform = `rotate(${currentRotation}deg) scale(${newScaleStr})`;

    updatedPositionData.scale = newScaleStr !== '1' ? newScaleStr : undefined; // Store value, undefined if 1
    needsSave = true;
    showToast(`Scale: ${currentScale.toFixed(2)}`, 1000); // Show toast

  } else if (event.altKey) {
    // --- Rotation Adjustment ---
    event.preventDefault(); // Prevent default browser actions
    const rotateStep = 5; // Degrees per step
    let currentRotation = currentPosition?.rotation || 0; // Get current from state or default 0

    const newRotation = (currentPosition?.rotation || 0) + (event.deltaY < 0 ? rotateStep : -rotateStep);
    // Optional: Normalize rotation % 360
    // const normalizedRotation = newRotation % 360;

    // Get current scale from state to preserve it
    const currentScale = currentPosition?.scale || '1';

    // Apply combined transform
    targetItem.style.transform = `rotate(${newRotation}deg) scale(${currentScale})`;

    updatedPositionData.rotation = newRotation !== 0 ? newRotation : undefined; // Store value, undefined if 0
    needsSave = true;
    showToast(`Rotation: ${newRotation}°`, 1000); // Show toast
  }
  // If none of Ctrl, Shift, Alt is pressed, do nothing and allow default scroll

  if (needsSave) {
    // Update common position info only if a change occurred
    updatedPositionData.left = targetItem.style.left;
    updatedPositionData.top = targetItem.style.top;
    updatedPositionData.pageIndex = pageIndex;

    updateItemPosition(itemId, updatedPositionData); // Update the central state
    updateAndSavePositions(); // Update history and save
  }
}

/**
 * Initializes the wheel event listener for transformations.
 */
export function initializeWheelTransformListener(): void {
  // Need passive: false to preventDefault for zoom/scroll hijacking
  document.addEventListener('wheel', handleWheelTransform, { passive: false });
  console.log("Wheel transform listener initialized.");
}

// --- Modifier Key Held Toast Notifications (moved from initialization.ts) ---

const activeModifierToasts: { [key: string]: { id: string; element: HTMLElement } | null } = {
  alt: null,
  shift: null,
  ctrl: null,
};

function showModifierKeyToast(message: string, keyName: 'alt' | 'shift' | 'ctrl'): void {
  if (activeModifierToasts[keyName]) {
    return; // Toast for this key already shown
  }

  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    console.warn('Modifier key toast: Toast container not found!');
    return;
  }

  const toastId = `toast-modifier-${keyName}-${Date.now()}`;
  const toastElement = document.createElement('div');
  toastElement.id = toastId;
  toastElement.classList.add('toast-message'); // Use 'toast-message' class for styling
  toastElement.textContent = message;

  toastContainer.appendChild(toastElement);
  // Trigger fade-in by adding 'show' class after a brief moment
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        toastElement.classList.add('show');
    });
  });

  activeModifierToasts[keyName] = { id: toastId, element: toastElement };
}

function removeModifierKeyToast(keyName: 'alt' | 'shift' | 'ctrl'): void {
  const activeToast = activeModifierToasts[keyName];
  if (activeToast) {
    activeToast.element.classList.remove('show'); // Trigger fade-out

    const transitionDuration = 500; // Must match CSS transition duration for opacity
    setTimeout(() => {
      activeToast.element.remove();
    }, transitionDuration);

    activeModifierToasts[keyName] = null;
  }
}

export function initializeModifierKeyListeners(): void {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.repeat) return;

    const targetElement = event.target as HTMLElement;
    if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable)) {
        return;
    }

    if (event.altKey && !activeModifierToasts.alt) {
      showModifierKeyToast('Holding Alt. Mousewheel to rotate.', 'alt');
    }
    if (event.shiftKey && !activeModifierToasts.shift) {
      showModifierKeyToast('Holding Shift. Mousewheel to change opacity.', 'shift');
    }
    if (event.ctrlKey && !activeModifierToasts.ctrl) {
      showModifierKeyToast('Holding Ctrl. Mousewheel to scale.', 'ctrl');
    }
  });

  document.addEventListener('keyup', (event: KeyboardEvent) => {
    if (event.key === 'Alt') {
      removeModifierKeyToast('alt');
    }
    if (event.key === 'Shift') {
      removeModifierKeyToast('shift');
    }
    if (event.key === 'Control') {
      removeModifierKeyToast('ctrl');
    }
  });

  window.addEventListener('blur', () => {
    removeModifierKeyToast('alt');
    removeModifierKeyToast('shift');
    removeModifierKeyToast('ctrl');
  });

  console.log("Modifier key (for wheel transform hints) listeners initialized.");
}
