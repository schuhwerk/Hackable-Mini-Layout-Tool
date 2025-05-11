export interface Parser {
  name: string;
  // Make width and height optional in the return type
  parse(content: string, filename?: string): Promise<{ element: HTMLElement | SVGElement; width?: number; height?: number }>;
}

export interface ParsedItemData {
  element: HTMLElement | SVGElement;
  // Make width and height optional here too
  width?: number;
  height?: number;
  parserName: string;
}
