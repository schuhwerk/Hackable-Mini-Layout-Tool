import type { Parser } from './types';

export const svgParser: Parser = {
  name: 'svg',
  async parse(content: string): Promise<{ element: SVGElement; width: number; height: number }> {
    // --- Start: Replicate original SVG string manipulation ---
    let svgContent = content;
    let originalWidthStr: string | null = null;
    let originalHeightStr: string | null = null;
    let hasViewBox = /<svg[^>]*?viewBox\s*=/i.test(svgContent);

    // Capture and remove width attribute
    svgContent = svgContent.replace(/<svg([^>]*?)\s+width\s*=\s*"([^"]+)"/i, (match, g1, g2) => {
        originalWidthStr = g2.replace(/px$/i, ''); // Remove 'px' if present
        return `<svg${g1}`; // Remove the width attribute
    });

    // Capture and remove height attribute
    svgContent = svgContent.replace(/<svg([^>]*?)\s+height\s*=\s*"([^"]+)"/i, (match, g1, g2) => {
        originalHeightStr = g2.replace(/px$/i, ''); // Remove 'px' if present
        return `<svg${g1}`; // Remove the height attribute
    });

    // Ensure preserveAspectRatio="xMidYMid meet" is set
    if (/preserveAspectRatio\s*=/.test(svgContent)) {
        // Replace existing preserveAspectRatio
        svgContent = svgContent.replace(/<svg([^>]*?)\s+preserveAspectRatio\s*=\s*"[^"]*"/i, '<svg$1 preserveAspectRatio="xMidYMid meet"');
    } else {
        // Add preserveAspectRatio if missing
        svgContent = svgContent.replace(/<svg/i, '<svg preserveAspectRatio="xMidYMid meet"');
    }

    // Add viewBox if missing and we captured width/height
    if (!hasViewBox && originalWidthStr && originalHeightStr) {
        const viewBoxValue = `0 0 ${originalWidthStr} ${originalHeightStr}`;
        svgContent = svgContent.replace(/<svg/i, `<svg viewBox="${viewBoxValue}"`);
        console.log(`Added viewBox="${viewBoxValue}" based on original width/height.`);
    }

    // Clean up potential double spaces added during replacements
    svgContent = svgContent.replace(/<svg\s+>/i, '<svg>');
    svgContent = svgContent.replace(/\s\s+/g, ' ');
    // --- End: SVG string manipulation ---

    // Now parse the potentially modified SVG string
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const element = doc.documentElement; // Keep as Element initially

    // Check if it's an SVGElement and not a parser error
    if (!(element instanceof SVGElement) || element.tagName.toLowerCase() === 'parsererror') {
        const errorMsg = element.querySelector('parsererror div')?.textContent;
        throw new Error(`Invalid SVG content: ${errorMsg || 'Unknown parsing error'}`);
    }

    // --- Dimension Calculation ---
    let width = 0;
    let height = 0;

    // 1. Prioritize original width/height captured from attributes
    if (originalWidthStr) width = parseFloat(originalWidthStr);
    if (originalHeightStr) height = parseFloat(originalHeightStr);

    // 2. If still missing, try viewBox (which might have been added above)
    const viewBoxAttr = element.getAttribute('viewBox');
    if ((width <= 0 || height <= 0) && viewBoxAttr) {
        const viewBox = viewBoxAttr.split(/[\s,]+/); // Split by space or comma
        if (viewBox.length === 4) {
            const vbWidth = parseFloat(viewBox[2] || '0');
            const vbHeight = parseFloat(viewBox[3] || '0');
            if (width <= 0) width = vbWidth;
            if (height <= 0) height = vbHeight;
        }
    }

    // 3. Fallback: Append to DOM to measure if still unknown
    if (width <= 0 || height <= 0) {
        console.warn("SVG dimensions not found in attributes or viewBox, measuring element...");
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.visibility = 'hidden';
        container.style.width = 'auto'; // Allow natural sizing
        container.style.height = 'auto';
        const clonedElement = element.cloneNode(true) as SVGElement; // Clone to avoid side effects
        container.appendChild(clonedElement);
        document.body.appendChild(container);
        // Use getBoundingClientRect for potentially more accurate measurement
        const rect = clonedElement.getBoundingClientRect();
        if (width <= 0) width = rect.width;
        if (height <= 0) height = rect.height;
        document.body.removeChild(container);
    }

    // 4. Final fallback
    if (width <= 0 || height <= 0) {
        console.warn('Could not determine SVG dimensions. Using default 100x100.');
        width = 100;
        height = 100;
    }

    return { element, width, height };
  }
};
