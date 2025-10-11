import type { Parser, ParsedItemData } from './types';
import { parseSongText, generateSongHtml, createSongContainer } from './chordParserUtils';

/**
 * Extracts content from the first code block in markdown
 * @param markdown The markdown content
 * @returns The content within the first code block, or empty string if none found
 */
function extractFirstCodeBlock(markdown: string): string {
    // Match first code block with triple backticks
    const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/;
    const match = markdown.match(codeBlockRegex);

    if (match && match[1]) {
        return match[1];
    }

    return '';
}

export const chordMdParser: Parser = {
    name: 'chordMd',
    async parse(content: string, filename: string = 'song.md'): Promise<ParsedItemData> {
        // Extract content from first code block
        const codeBlockContent = extractFirstCodeBlock(content);

        if (!codeBlockContent) {
            console.warn(`No code block found in markdown file: ${filename}`);
            // Return empty container if no code block found
            const container = createSongContainer('');
            return {
                element: container,
                parserName: chordMdParser.name
            };
        }

        // Parse the extracted content using shared utilities
        const item = parseSongText(codeBlockContent, filename);
        const contentHtml = generateSongHtml(item, '.song.md');
        const container = createSongContainer(contentHtml );

        return {
            element: container,
            parserName: chordMdParser.name
        };
    }
};
