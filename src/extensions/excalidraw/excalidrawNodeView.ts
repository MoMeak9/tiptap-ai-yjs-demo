/**
 * ExcalidrawNodeView - ProseMirror NodeView Bridge
 *
 * Bridges ProseMirror's synchronous update model with React-based
 * Excalidraw components. Handles:
 * - DOM creation and lifecycle
 * - Attribute synchronization
 * - Mutation isolation (ignoreMutation)
 * - Edit modal triggering
 */
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import type { ExcalidrawAttributes, OpenExcalidrawEditorDetail } from './types';

export interface ExcalidrawNodeViewProps {
  node: ProseMirrorNode;
  editor: Editor;
  getPos: () => number | undefined;
  extension: unknown;
}

/**
 * Custom event for triggering the edit modal
 */
export class OpenExcalidrawEditorEvent extends CustomEvent<OpenExcalidrawEditorDetail> {
  constructor(detail: OpenExcalidrawEditorDetail) {
    super('open-excalidraw-editor', {
      bubbles: true,
      composed: true,
      detail,
    });
  }
}

export class ExcalidrawNodeView implements NodeView {
  /** The outer DOM element */
  dom: HTMLElement;

  /** Content container for React to render into */
  contentDOM: HTMLElement | null = null;

  /** Current ProseMirror node */
  node: ProseMirrorNode;

  /** Tiptap editor instance */
  editor: Editor;

  /** Function to get node position in document */
  getPos: () => number | undefined;

  /** Extension configuration */
  extension: unknown;

  /** Whether the node is selected */
  isSelected = false;

  constructor({ node, editor, getPos, extension }: ExcalidrawNodeViewProps) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;
    this.extension = extension;

    // Create the container element
    this.dom = document.createElement('div');
    this.dom.className = 'tiptap-excalidraw-node';
    this.dom.setAttribute('data-type', 'excalidraw');

    // Create content area for preview
    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'excalidraw-preview-container';
    this.dom.appendChild(this.contentDOM);

    // Render initial preview
    this.renderPreview();

    // Bind event handlers
    this.dom.addEventListener('dblclick', this.handleDoubleClick);
    this.dom.addEventListener('click', this.handleClick);
  }

  /**
   * Render the preview state
   */
  private renderPreview() {
    if (!this.contentDOM) return;

    const attrs = this.node.attrs as ExcalidrawAttributes;
    let elements: unknown[] = [];

    try {
      elements = JSON.parse(attrs.initialElements || '[]');
    } catch {
      elements = [];
    }

    const elementCount = elements.length;
    const hasSourceMermaid = !!attrs.sourceMermaid;

    // Simple preview UI - will be enhanced with actual Excalidraw preview
    this.contentDOM.innerHTML = `
      <div class="excalidraw-preview">
        <div class="excalidraw-preview-header">
          <span class="excalidraw-icon">🎨</span>
          <span class="excalidraw-label">Excalidraw Diagram</span>
          ${hasSourceMermaid ? '<span class="excalidraw-badge">From Mermaid</span>' : ''}
        </div>
        <div class="excalidraw-preview-info">
          <span>${elementCount} element${elementCount !== 1 ? 's' : ''}</span>
          <span class="excalidraw-hint">Double-click to edit</span>
        </div>
        <div class="excalidraw-preview-canvas" id="preview-${attrs.nodeId}">
          <!-- React will render Excalidraw preview here -->
        </div>
      </div>
    `;

    // Lazy load the actual preview renderer
    this.loadPreviewRenderer(attrs.nodeId, elements);
  }

  /**
   * Load and render the Excalidraw preview
   */
  private async loadPreviewRenderer(nodeId: string, elements: unknown[]) {
    const container = this.contentDOM?.querySelector(`#preview-${nodeId}`);
    if (!container || elements.length === 0) return;

    try {
      // Dynamic import to avoid loading React/Excalidraw until needed
      const { renderExcalidrawPreview } = await import('./excalidrawPreview');
      renderExcalidrawPreview(container as HTMLElement, elements, nodeId);
    } catch (error) {
      console.error('[ExcalidrawNodeView] Failed to load preview:', error);
      container.innerHTML = '<div class="excalidraw-preview-placeholder">Preview unavailable</div>';
    }
  }

  /**
   * Handle click to select
   */
  private handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    // Selection is handled by ProseMirror
  };

  /**
   * Handle double-click to open edit modal
   */
  private handleDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.openEditModal();
  };

  /**
   * Open the edit modal by dispatching a custom event
   */
  private openEditModal() {
    const attrs = this.node.attrs as ExcalidrawAttributes;

    let elements: unknown[] = [];
    let files: Record<string, unknown> = {};

    try {
      elements = JSON.parse(attrs.initialElements || '[]');
      files = JSON.parse(attrs.initialFiles || '{}');
    } catch {
      elements = [];
      files = {};
    }

    const event = new OpenExcalidrawEditorEvent({
      nodeId: attrs.nodeId,
      elements: elements as OpenExcalidrawEditorDetail['elements'],
      files: files as OpenExcalidrawEditorDetail['files'],
      onSave: (newElements, newFiles) => {
        this.applyChange(newElements, newFiles);
      },
      onCancel: () => {
        // No action needed on cancel
      },
    });

    this.dom.dispatchEvent(event);
  }

  /**
   * Apply element changes to the document via Tiptap transaction
   */
  private applyChange(elements: unknown[], files: Record<string, unknown>) {
    const pos = this.getPos();
    if (typeof pos !== 'number') return;

    // Create transaction to update node attributes
    const { tr } = this.editor.state;
    tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      initialElements: JSON.stringify(elements),
      initialFiles: JSON.stringify(files),
      lastModifiedAt: Date.now(),
    });

    // Dispatch the transaction
    this.editor.view.dispatch(tr);
  }

  /**
   * Called when the node's attributes change.
   * Returns true if we handled the update, false to trigger full re-render.
   */
  update(node: ProseMirrorNode): boolean {
    // Only handle same node type
    if (node.type.name !== 'excalidraw') {
      return false;
    }

    // Check if nodeId changed (different node)
    const oldNodeId = (this.node.attrs as ExcalidrawAttributes).nodeId;
    const newNodeId = (node.attrs as ExcalidrawAttributes).nodeId;
    if (oldNodeId !== newNodeId) {
      return false; // Force re-render for different node
    }

    // Update internal reference
    this.node = node;

    // Re-render preview with new data
    this.renderPreview();

    // Return true to indicate we handled the update
    return true;
  }

  /**
   * Tell ProseMirror to ignore DOM mutations inside the component.
   * This is CRITICAL for React components that modify their own DOM.
   */
  ignoreMutation(): boolean {
    // Ignore all mutations within the excalidraw container
    // React manages its own DOM
    return true;
  }

  /**
   * Called when the node is selected
   */
  selectNode() {
    this.isSelected = true;
    this.dom.classList.add('ProseMirror-selectednode');
  }

  /**
   * Called when the node is deselected
   */
  deselectNode() {
    this.isSelected = false;
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  /**
   * Prevent default behavior for certain events on atom nodes
   * Return true to stop the event from being handled by ProseMirror
   * Return false to let ProseMirror handle the event
   */
  stopEvent(_event: Event): boolean {
    // Let all events through - we handle them ourselves
    // Return false means "don't stop the event"
    return false;
  }

  /**
   * Cleanup when the node view is destroyed
   */
  destroy() {
    this.dom.removeEventListener('dblclick', this.handleDoubleClick);
    this.dom.removeEventListener('click', this.handleClick);

    // Cleanup React if rendered
    const previewContainer = this.contentDOM?.querySelector('.excalidraw-preview-canvas');
    if (previewContainer) {
      // Let React cleanup happen through its own lifecycle
      import('./excalidrawPreview').then(({ unmountExcalidrawPreview }) => {
        unmountExcalidrawPreview(previewContainer as HTMLElement);
      }).catch(() => {
        // Ignore cleanup errors
      });
    }
  }
}

export default ExcalidrawNodeView;
