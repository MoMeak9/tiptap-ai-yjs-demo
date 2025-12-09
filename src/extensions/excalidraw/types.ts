/**
 * Excalidraw Extension Types
 *
 * Type definitions for Excalidraw integration.
 * Uses 'unknown' for Excalidraw types to avoid conflicts with internal types.
 */

// ============================================
// Core Excalidraw Types (use unknown to avoid type conflicts)
// ============================================

/**
 * Excalidraw element - use unknown to allow flexibility with Excalidraw's internal types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExcalidrawElement = any;

/**
 * Binary files - use unknown to allow flexibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BinaryFiles = Record<string, any>;

/**
 * App state - use unknown to allow flexibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppState = any;

/**
 * Collaborator - use unknown to allow flexibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Collaborator = any;

/**
 * Excalidraw imperative API - use unknown to allow flexibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExcalidrawImperativeAPI = any;

// ============================================
// Extension-Specific Types
// ============================================

/**
 * Excalidraw node attributes stored in Tiptap
 */
export interface ExcalidrawAttributes {
  /** Unique identifier for this excalidraw node */
  nodeId: string;
  /** Initial elements (JSON serialized) - used for initial load */
  initialElements: string;
  /** Initial files (JSON serialized) - for images/assets */
  initialFiles: string;
  /** Source mermaid code if converted from mermaid */
  sourceMermaid: string | null;
  /** Last modified timestamp */
  lastModifiedAt: number;
  /** Last modified user ID */
  lastModifiedBy: string | null;
}

/**
 * Excalidraw collaborator presence data
 */
export interface ExcalidrawCollaborator {
  nodeId: string;
  pointer: { x: number; y: number } | null;
  selectedElementIds: string[];
  user: {
    name: string;
    color: string;
  };
}

/**
 * Excalidraw manager options
 */
export interface ExcalidrawManagerOptions {
  /** Debounce time for syncing changes (ms) */
  syncDebounceMs?: number;
  /** Whether to enable cursor sync */
  enableCursorSync?: boolean;
}

/**
 * Mermaid conversion result
 */
export interface MermaidConversionResult {
  success: boolean;
  elements: ExcalidrawElement[];
  files: BinaryFiles;
  diagramType?: 'flowchart' | 'sequence' | 'class' | 'unsupported';
  error?: string;
}

/**
 * Event detail for opening the Excalidraw editor modal
 */
export interface OpenExcalidrawEditorDetail {
  nodeId: string;
  elements: ExcalidrawElement[];
  files: BinaryFiles;
  onSave: (elements: ExcalidrawElement[], files: BinaryFiles) => void;
  onCancel: () => void;
}
