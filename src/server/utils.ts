import { readFile, mkdir } from 'fs/promises';
import path from 'path';

export const USER_DIR = 'user';
export const POSITIONS_FILE = 'user/settings.json';

// Ensure user directory exists
export async function ensureUserDirectory() {
  try {
    await mkdir(USER_DIR, { recursive: true });
    console.log(`Directory ./${USER_DIR} ensured.`);
  } catch (error) {
    console.error(`Error creating directory ./${USER_DIR}:`, error);
  }
}

// Helper to get content type based on file extension
export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js': return 'application/javascript';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

// Check if settings.json has required configuration
export async function hasValidSettings(): Promise<boolean> {
  try {
    const data = await readFile(POSITIONS_FILE, 'utf-8');
    const settings = JSON.parse(data);
    return (
      typeof settings.pageCount === 'number' &&
      typeof settings.pageWidth === 'number' &&
      typeof settings.pageHeight === 'number' &&
      typeof settings.baseDir === 'string'
    );
  } catch (error) {
    return false;
  }
}
