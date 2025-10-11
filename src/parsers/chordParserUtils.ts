// Shared utilities for chord parsing

// Define interfaces based on usage
export interface SongPart {
    chords: string;
    lyrics: string;
}

export interface SongItem {
    filename: string;
    parts: SongPart[];
}

/**
 * Parses text content into song parts with chords and lyrics
 * @param content The text content to parse
 * @param filename The filename for reference
 * @returns A SongItem with parsed parts
 */
export function parseSongText(content: string, filename: string): SongItem {
    const lines = content.split('\n');
    const parts: SongPart[] = [];
    for (let i = 0; i < lines.length; i += 2) {
        const chordLine = lines[i] ?? ''; // Default to empty string if undefined
        const lyricLine = lines[i + 1] ?? ''; // Default to empty string if undefined

        if (i + 1 < lines.length) {
            parts.push({
                chords: chordLine,
                lyrics: lyricLine
            });
        } else if (chordLine.trim()) {
            // Handle potential last line if it's just chords or lyrics without a pair
            parts.push({ chords: chordLine, lyrics: '' });
        }
    }
    return {
        filename: filename,
        parts: parts
    };
}

/**
 * Generates HTML content from parsed song item
 * @param item The parsed song item
 * @param extensionToRemove The file extension to remove from the title (e.g., '.txt', '.md')
 * @returns HTML string for the song
 */
export function generateSongHtml(item: SongItem, extensionToRemove: string = ''): string {
    let contentHtml = '';

    // Add song title
    const title = extensionToRemove
        ? item.filename.replace(extensionToRemove, '')
        : item.filename;
    contentHtml = `<h2>${title}</h2>\n`;

    for (const part of item.parts) {
        let lineHtml = '';
        // Pre-process chord line to find chord start indices and text
        const chordMap = new Map<number, string>();
        let chordText = '';
        for (let i = 0; i < part.chords.length; i++) {
            const char = part.chords[i];
            if (char !== ' ') {
                chordText += char;
            } else {
                if (chordText) {
                    // Store chord at the starting index
                    chordMap.set(i - chordText.length, chordText);
                    chordText = '';
                }
            }
        }
        // Add any trailing chord
        if (chordText) {
            chordMap.set(part.chords.length - chordText.length, chordText);
        }

        // Iterate through lyrics line
        for (let i = 0; i < part.lyrics.length; i++) {
            const lyricChar = part.lyrics[i];
            let chordSpan = '';

            // Check if a chord starts at this character index
            if (chordMap.has(i)) {
                // Ensure chordMap.get(i) is not undefined before using it
                const chordValue = chordMap.get(i);
                if (chordValue !== undefined) {
                    chordSpan = `<span class="chord">${chordValue}</span>`;
                }
            }

            // Check if the lyric character is a space
            const charToAdd = lyricChar === ' ' ? '&nbsp;' : lyricChar;

            if (chordSpan) {
                // Wrap the lyric character and add the absolutely positioned chord
                lineHtml += `<span class="char-container">${chordSpan}${charToAdd}</span>`;
            } else {
                // Just add the lyric character
                lineHtml += charToAdd;
            }
        }
        // Add any remaining chords that might be positioned after the lyrics end
        chordMap.forEach((chord, index) => {
            if (index >= part.lyrics.length) {
                // Add a non-breaking space as an anchor with the chord
                lineHtml += `<span class="char-container"><span class="chord">${chord}</span>&nbsp;</span>`;
            }
        });

        // Wrap any text in round or square brackets in an annotation span
        lineHtml = lineHtml.replace(/(\([^\)]+\)|\[[^\]]+\])/g, '<span class="annotation">$1</span>');

        contentHtml += `<div class="lyrics-line">${lineHtml}</div>\n`;
    }

    return contentHtml;
}

/**
 * Creates a DOM element container for the song
 * @param htmlContent The HTML content string
 * @returns The DOM element container
 */
export function createSongContainer(htmlContent: string): HTMLDivElement {
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.classList.add('song-container');
    return container;
}
