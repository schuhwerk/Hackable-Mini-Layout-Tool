import { showToast } from '../utils.js';
import { updateItemPosition, getItemId, draggedElement } from './state.js'; // Added draggedElement
import { parseContent } from '../parsers/index.js';
import type { ParsedItemData } from '../parsers/types.js';
import { updateAndSavePositions } from './persistence.js';

// --- File Drag and Drop Handlers ---

function handleFileDragOver(event: DragEvent): void {
    // Only show feedback if NOT dragging an internal element
    if (!draggedElement) {
        event.preventDefault();
        document.body.classList.add('file-drag-over');
    }
}

function handleFileDragLeave(event: DragEvent): void {
    // Remove feedback regardless
    document.body.classList.remove('file-drag-over');
}

async function handleFileDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    document.body.classList.remove('file-drag-over');

    // --- Prevent file drop if an element drag is in progress ---
    if (draggedElement) {
        console.log("File drop ignored because an element drag is active.");
        return;
    }
    // --- End Prevention ---

    if (event.dataTransfer?.files) {
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return;

        showToast(`Uploading ${files.length} file(s)...`, 2000);

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/user', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('Upload successful:', result);
                showToast(`Uploaded: ${file.name}`, 3000);

                // Add the new item to the page, using the original filename
                addNewItemToPage(file.name, result.path, event.clientX, event.clientY);

            } catch (error) {
                console.error('Error uploading file:', file.name, error);
                showToast(`Error uploading ${file.name}`, 3000);
            }
        }
    }
}

/**
 * Determines the type of item based on filename and potentially content.
 * Fetches content if necessary, parses it using the appropriate parser,
 * and adds the resulting element to the page at the drop location.
 */
async function addNewItemToPage(filename: string, filePath: string, dropX: number, dropY: number): Promise<void> {
    let content: string;
    let parsedData: ParsedItemData;

    try {
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(filename.split('.').pop()?.toLowerCase() || '');

        if (isImage) {
            // Assuming images are served from a /static/ path prefix,
            // and filePath is the filename relative to the server's static root.
            if (filePath.startsWith('data:')) { // Handle data URLs correctly
                content = filePath;
            } else {
                // filePath is expected to be the correct server path, e.g., /user/image.jpg
                // This path is returned by the server ('/user' endpoint in index.ts)
                content = filePath;
            }
        } else {
            // Assuming non-image text files are served from root or their path is already correct.
            // If they also need a /static/ prefix, this fetch URL would need adjustment too.
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch content for ${filename}: ${response.statusText}`);
            }
            content = await response.text();
        }

        parsedData = await parseContent(filename, content);

    } catch (error) {
        console.error(`Error processing file ${filename}:`, error);
        showToast(`Error processing ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`, 4000);
        return;
    }

    const newItemContainer = document.createElement('div');
    const newItemId = getItemId(filename);
    newItemContainer.id = newItemId;
    newItemContainer.classList.add('draggable-item');
    newItemContainer.draggable = true;
    newItemContainer.dataset.filename = filename;
    newItemContainer.dataset.parser = parsedData.parserName;

    newItemContainer.appendChild(parsedData.element);

    let dropTargetContainer = document.elementFromPoint(dropX, dropY) as HTMLElement | null;
    while (dropTargetContainer && !dropTargetContainer.classList.contains('page-container')) {
        dropTargetContainer = dropTargetContainer.parentElement as HTMLElement | null;
    }
    const targetPage = dropTargetContainer || document.getElementById('page-0');
    if (!targetPage) {
        console.error("Could not find a target page container.");
        showToast("Error: Could not find target page.", 3000);
        return;
    }

    const containerRect = targetPage.getBoundingClientRect();
    const initialLeft = dropX - containerRect.left;
    const initialTop = dropY - containerRect.top;
    const pageIndex = parseInt(targetPage.id.split('-')[1] || '0', 10);

    newItemContainer.style.position = 'absolute';
    newItemContainer.style.left = `${initialLeft}px`;
    newItemContainer.style.top = `${initialTop}px`;
    targetPage.appendChild(newItemContainer);

    // Prepare position data, conditionally adding width/height
    const positionData: any = { // Using 'any' temporarily for flexibility, consider a specific type
        left: `${initialLeft}px`,
        top: `${initialTop}px`,
        pageIndex: pageIndex,
        parser: parsedData.parserName,
        filepath: filePath, // Ensure filepath is included (added in previous step, verify it's here)
        opacity: 1,
        scale: '1',
        rotation: 0,
    };

    // Only add width/height if parser provided them (i.e., not htmlParser now)
    if (parsedData.width !== undefined && parsedData.height !== undefined) {
        positionData.width = `${parsedData.width}px`;
        positionData.height = `${parsedData.height}px`;
    }

    updateItemPosition(newItemId, positionData);
    updateAndSavePositions();
    showToast(`Added ${filename}`, 2000);
}

/**
 * Initializes the file drag and drop listeners on the body.
 */
export function initializeFileDropListeners(): void {
    const body = document.body;
    body.addEventListener('dragover', handleFileDragOver);
    body.addEventListener('dragleave', handleFileDragLeave);
    body.addEventListener('drop', handleFileDrop);
    console.log("File drop listeners initialized.");
}
