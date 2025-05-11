import type { Parser } from './types';

export const imageParser: Parser = {
  name: 'image',
  async parse(content: string): Promise<{ element: HTMLImageElement; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => {
        resolve({ element, width: element.naturalWidth, height: element.naturalHeight });
      };
      element.onerror = (error) => {
        console.error('Image loading error:', error);
        reject(new Error(`Failed to load image: ${content}`));
      };
      element.src = content; // content is expected to be the image URL or data URL
    });
  }
};
