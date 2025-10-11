import type { Parser, ParsedItemData } from './types';
import { parseSongText, generateSongHtml, createSongContainer } from './chordParserUtils';

export const chordTxtParser: Parser = {
    name: 'chordTxt',
    async parse(content: string, filename: string = 'song.txt'): Promise<ParsedItemData> {
        const item = parseSongText(content, filename);
        const contentHtml = generateSongHtml(item, '.txt');
        const container = createSongContainer(contentHtml);

        return {
            element: container,
            parserName: chordTxtParser.name
        };
    }
};
