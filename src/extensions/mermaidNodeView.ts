/**
 * MermaidNodeView - Native JavaScript Node View Bridge
 *
 * Bridges ProseMirror's synchronous update model with the Lit-based
 * <mermaid-viewer> Web Component. Handles:
 * - DOM creation and lifecycle
 * - Attribute synchronization
 * - Mutation isolation (ignoreMutation)
 * - Edit modal triggering
 */
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import type { MermaidViewer } from './mermaid-viewer';
import type { MermaidAttributes } from '../types';

// Ensure the Web Component is registered
import './mermaid-viewer';

export interface MermaidNodeViewProps {
  node: ProseMirrorNode;
  editor: Editor;
  getPos: () => number | undefined;
  extension: any;
}

/**
 * Event detail for opening the Mermaid editor modal
 */
export interface OpenMermaidEditorDetail {
  code: string;
  onSave: (newCode: string) => void;
  onCancel: () => void;
}

/**
 * Custom event for triggering the edit modal
 */
export class OpenMermaidEditorEvent extends CustomEvent<OpenMermaidEditorDetail> {
  constructor(detail: OpenMermaidEditorDetail) {
    super('open-mermaid-editor', {
      bubbles: true,
      composed: true,
      detail,
    });
  }
}

export class MermaidNodeView implements NodeView {
  /** The outer DOM element (wrapper div) */
  dom: HTMLElement;

  /** The mermaid-viewer custom element */
  private viewer: MermaidViewer;

  /** Current ProseMirror node */
  node: ProseMirrorNode;

  /** Tiptap editor instance */
  editor: Editor;

  /** Function to get node position in document */
  getPos: () => number | undefined;

  /** Extension configuration */
  extension: any;

  /** Convert to Excalidraw button */
  private convertButton: HTMLButtonElement | null = null;

  constructor({ node, editor, getPos, extension }: MermaidNodeViewProps) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;
    this.extension = extension;

    // Create wrapper element
    this.dom = document.createElement('div');
    this.dom.className = 'tiptap-mermaid-node-wrapper';

    // Create the Lit component instance
    this.viewer = document.createElement('mermaid-viewer') as MermaidViewer;

    // Set initial attributes
    this.viewer.code = (node.attrs as MermaidAttributes).code || '';

    // Add wrapper class for styling
    this.viewer.classList.add('tiptap-mermaid-node');

    // Create toolbar with convert button
    const toolbar = document.createElement('div');
    toolbar.className = 'mermaid-node-toolbar';

    this.convertButton = document.createElement('button');
    this.convertButton.className = 'mermaid-convert-btn';
    this.convertButton.innerHTML = '🎨 Convert to Excalidraw';
    this.convertButton.title = 'Convert this Mermaid diagram to an editable Excalidraw diagram';
    this.convertButton.addEventListener('click', this.handleConvertToExcalidraw);

    toolbar.appendChild(this.convertButton);

    // Assemble DOM
    this.dom.appendChild(toolbar);
    this.dom.appendChild(this.viewer);

    // Bind event handlers
    this.viewer.addEventListener('dblclick', this.handleDoubleClick);
  }

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
    const currentCode = (this.node.attrs as MermaidAttributes).code || '';

    const event = new OpenMermaidEditorEvent({
      code: currentCode,
      onSave: (newCode: string) => {
        this.applyChange(newCode);
      },
      onCancel: () => {
        // No action needed on cancel
      },
    });

    this.dom.dispatchEvent(event);
  }

  /**
   * Handle convert to Excalidraw button click
   */
  private handleConvertToExcalidraw = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const currentCode = (this.node.attrs as MermaidAttributes).code || '';
    if (!currentCode.trim()) {
      alert('No Mermaid code to convert');
      return;
    }

    // Disable button during conversion
    if (this.convertButton) {
      this.convertButton.disabled = true;
      this.convertButton.textContent = '⏳ Converting...';
    }

    try {
      // Dynamic import to avoid loading until needed
      const { convertMermaidToExcalidraw, getDiagramTypeName } = await import('./excalidraw/mermaidConverter');

      const result = await convertMermaidToExcalidraw(currentCode);

      if (!result.success) {
        alert(`Conversion failed: ${result.error}`);
        return;
      }

      console.log(`[Mermaid→Excalidraw] Converted ${getDiagramTypeName(result.diagramType)} with ${result.elements.length} elements`);

      // Get position and replace mermaid node with excalidraw node
      const pos = this.getPos();
      if (typeof pos !== 'number') return;

      // Create transaction to replace this node with excalidraw
      const { tr, schema } = this.editor.state;
      const excalidrawNodeType = schema.nodes.excalidraw;

      if (!excalidrawNodeType) {
        alert('Excalidraw extension is not installed. Please add ExcalidrawExtension to your editor.');
        return;
      }

      const nodeId = `excalidraw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const excalidrawNode = excalidrawNodeType.create({
        nodeId,
        initialElements: JSON.stringify(result.elements),
        initialFiles: JSON.stringify(result.files),
        sourceMermaid: currentCode,
        lastModifiedAt: Date.now(),
      });

      // Replace the mermaid node with excalidraw node
      tr.replaceWith(pos, pos + this.node.nodeSize, excalidrawNode);
      this.editor.view.dispatch(tr);

    } catch (error) {
      console.error('[Mermaid→Excalidraw] Conversion error:', error);
      alert(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Restore button state
      if (this.convertButton) {
        this.convertButton.disabled = false;
        this.convertButton.innerHTML = '🎨 Convert to Excalidraw';
      }
    }
  };

  /**
   * Apply code change to the document via Tiptap transaction
   */
  private applyChange(newCode: string) {
    const pos = this.getPos();
    if (typeof pos !== 'number') return;

    // Create transaction to update node attributes
    const { tr } = this.editor.state;
    tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      code: newCode,
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
    if (node.type.name !== 'mermaid') {
      return false;
    }

    // Update internal reference
    this.node = node;

    // Sync code attribute to Lit component
    const newCode = (node.attrs as MermaidAttributes).code || '';
    if (this.viewer.code !== newCode) {
      this.viewer.code = newCode;
    }

    // Return true to indicate we handled the update
    return true;
  }

  /**
   * Tell ProseMirror to ignore DOM mutations inside the component.
   * This is CRITICAL for Lit components that modify their own DOM.
   */
  ignoreMutation(): boolean {
    // Ignore all mutations within the mermaid-viewer
    // The Lit component manages its own DOM
    return true;
  }

  /**
   * Called when the node is selected
   */
  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode');
    this.viewer.selected = true;
  }

  /**
   * Called when the node is deselected
   */
  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode');
    this.viewer.selected = false;
  }

  /**
   * Prevent default behavior for Enter and Delete keys on atom nodes
   */
  stopEvent(event: Event): boolean {
    // Allow double-click for editing
    if (event.type === 'dblclick') {
      return true;
    }
    return false;
  }

  /**
   * Cleanup when the node view is destroyed
   */
  destroy() {
    this.viewer.removeEventListener('dblclick', this.handleDoubleClick);
    this.convertButton?.removeEventListener('click', this.handleConvertToExcalidraw);
  }
}

export default MermaidNodeView;
