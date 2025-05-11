import type { Parser } from './types';

export const htmlParser: Parser = {
  name: 'html', // Identifier for this parser

  async parse(content: string, filename?: string): Promise<{ element: HTMLElement; width: number; height: number }> {
    // Create a container div element
    const container = document.createElement('div');
    container.className = 'parsed-html-content'; // Add a class for potential styling

    // Set the innerHTML to the provided HTML content
    container.innerHTML = content || '';

    // Extract title from filename if provided and set it as a data attribute or title
    if (filename) {
      // Simple title extraction (consider using path module if available/needed in this context)
      const title = filename.split('/').pop()?.split('.').slice(0, -1).join('.') || filename;
      container.setAttribute('data-title', title);
    }
    
    return {
      element: container
    };
  }
};
