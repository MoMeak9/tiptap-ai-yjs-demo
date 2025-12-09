/**
 * Excalidraw Extension - Main Export
 *
 * Exports all components for Excalidraw integration with Tiptap.
 */

// Extension
export { ExcalidrawExtension } from './excalidrawExtension';
export type { ExcalidrawOptions, ExcalidrawStorage } from './excalidrawExtension';

// Manager
export { ExcalidrawManager } from './excalidrawManager';

// Modal
export { initExcalidrawModal, getExcalidrawModal } from './excalidrawModal';
export type { ExcalidrawModalInstance } from './excalidrawModal';

// Mermaid Converter
export {
  convertMermaidToExcalidraw,
  validateMermaidCode,
  detectDiagramType,
  getDiagramTypeName,
} from './mermaidConverter';
export type { MermaidConversionResult, DiagramType } from './mermaidConverter';

// Types
export type {
  ExcalidrawAttributes,
  ExcalidrawCollaborator,
  ExcalidrawManagerOptions,
  OpenExcalidrawEditorDetail,
} from './types';

// Styles (import for side effects)
import './excalidrawStyles.css';
