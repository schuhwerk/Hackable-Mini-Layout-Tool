import type { Parser, ParsedItemData } from './types';

// Define interfaces based on usage in the provided snippet
interface SongPart {
    chords: string;
    lyrics: string;
}

interface SongItem {
    filename: string;
    parts: SongPart[];
}

// Basic text parsing function (replace with actual parsing logic if available)
function parseSongText(content: string, filename: string): SongItem {
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


export const chordParser: Parser = {
    name: 'chord',
    async parse(content: string, filename: string = 'song.txt'): Promise<ParsedItemData> {
        const item = parseSongText(content, filename); // Parse the text content into SongItem

        let contentHtml = ''; // Initialize contentHtml


        // Generate song HTML (existing logic)
        contentHtml = `<h2>${item.filename.replace('.txt', '')}</h2>\n`; // Add song title first
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

            // Wrap "(2x)" specifically in a repetition span
            lineHtml = lineHtml.replace(/\(2x\)/g, '<span class="repetition">(2x)</span>'); // Use regex global flag

            contentHtml += `<div class="lyrics-line">${lineHtml}</div>\n`;
        }

        const container = document.createElement('div');
        container.innerHTML = contentHtml;
        container.classList.add('song-container'); // Add a class for potential styling

        return {
            element: container,
            parserName: chordParser.name // Use direct reference
        };
    }
};
