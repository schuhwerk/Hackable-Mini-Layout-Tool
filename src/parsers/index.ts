import type { Parser, ParsedItemData } from './types';
import { htmlParser } from './htmlParser';
import { svgParser } from './svgParser';
import { imageParser } from './imageParser';
import { chordParser } from './chordParser';

// Collection of all available parsers
export const parsers: Record<string, Parser> = {
  [htmlParser.name]: htmlParser,
  [svgParser.name]: svgParser,
  [imageParser.name]: imageParser,
  [chordParser.name]: chordParser,
};

/**
 * Determines the appropriate parser based on file extension or content sniffing.
 * @param filename The name of the file (including extension).
 * @param content The file content as a string.
 * @returns The identified Parser or undefined if none match.
 */
export function findParser(filename: string, content: string): Parser | undefined {
    const extension = filename.split('.').pop()?.toLowerCase();

    if (extension === 'html' || extension === 'htm') {
        return parsers.html;
    }
    if (extension === 'svg') {
        // Basic check if content looks like SVG
        if (content.trim().startsWith('<svg')) {
            return parsers.svg;
        }
    }
    if (extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'gif' || extension === 'webp' || extension === 'bmp') {
        // For images, the 'content' is expected to be a URL/path later
        return parsers.image;
    }
    if (extension === 'txt') {
        // Assume .txt files are chord sheets for now
        // More robust checking could be added here if needed
        return parsers.chord;
    }

    // Fallback: Try simple content sniffing if extension didn't match
    const trimmedContent = content.trim();
    if (trimmedContent.startsWith('<svg')) {
        return parsers.svg;
    }
    if (trimmedContent.startsWith('<') && trimmedContent.endsWith('>')) {
        // Basic check for HTML-like structure
        return parsers.html;
    }

    // Default to chord parser if no other match? Or return undefined?
    // Let's default to chord parser for unknown text-based files for now.
    // Consider making this stricter later.
    if (extension === 'txt' || !extension) { // Treat extensionless as potential chords
        return parsers.chord;
    }


    console.warn(`No specific parser found for file: ${filename}.`);
    return undefined; // Or potentially default to a text/chord parser?
}

/**
 * Parses content using the appropriate parser based on filename.
 * @param filename The name of the file.
 * @param content The file content (string for text/svg/html, URL/path for images).
 * @returns A promise resolving to the parsed item data including the parser name.
 */
export async function parseContent(filename: string, content: string): Promise<ParsedItemData> {
    const parser = findParser(filename, content);

    if (!parser) {
        throw new Error(`Could not find a suitable parser for file: ${filename}`);
    }

    // For the image parser, 'content' is the URL/path.
    // For other parsers, 'content' is the actual file content.
    // The parser.parse method for images expects the path directly.
    const contentToParse = content;

    try {
        // imageParser.parse only expects one argument (the path).
        // Other parsers might use the filename as a second argument if their signature allows.
        const { element, width, height } = await parser.parse(contentToParse, filename);
        return { element, width, height, parserName: parser.name };
    } catch (error) {
        console.error(`Error parsing ${filename} with ${parser.name} parser:`, error);
        throw new Error(`Failed to parse ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Re-export types for convenience
export type { Parser, ParsedItemData };
