export interface ItemPosition {
  left: string; // e.g., '100px'
  top: string;  // e.g., '50px'
  width?: string; // e.g., '200px'
  height?: string; // e.g., '150px'
  pageIndex?: number; // e.g., 0, 1, ...
  opacity?: number; // e.g., 0.5, 1
  scale?: string; // e.g., '1.2', '0.8'
  rotation?: number; // e.g., 45, -10 (degrees)
  parser?: string; // e.g., 'chord', 'image', 'svg'
  filepath?: string; // Relative path to the source file (used for loading)
}

export interface ItemPositions {
  [itemId: string]: ItemPosition;
}

// SavedPositionData might become redundant if ItemPosition holds everything,
// but let's keep it for now in case of future distinctions.
// Ensure it aligns with ItemPosition.
export interface SavedPositionData extends ItemPosition {
  id?: string; // ID might be explicitly saved or derived from filename
  // All other properties are inherited from ItemPosition
}
