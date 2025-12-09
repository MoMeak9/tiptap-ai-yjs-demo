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
  /** The outer DOM element (mermaid-viewer custom element) */
  dom: MermaidViewer;

  /** Current ProseMirror node */
  node: ProseMirrorNode;

  /** Tiptap editor instance */
  editor: Editor;

  /** Function to get node position in document */
  getPos: () => number | undefined;

  /** Extension configuration */
  extension: any;

  constructor({ node, editor, getPos, extension }: MermaidNodeViewProps) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;
    this.extension = extension;

    // Create the Lit component instance
    this.dom = document.createElement('mermaid-viewer') as MermaidViewer;

    // Set initial attributes
    this.dom.code = (node.attrs as MermaidAttributes).code || '';

    // Add wrapper class for styling
    this.dom.classList.add('tiptap-mermaid-node');

    // Bind event handlers
    this.dom.addEventListener('dblclick', this.handleDoubleClick);
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
    if (this.dom.code !== newCode) {
      this.dom.code = newCode;
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
    this.dom.selected = true;
  }

  /**
   * Called when the node is deselected
   */
  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode');
    this.dom.selected = false;
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
    this.dom.removeEventListener('dblclick', this.handleDoubleClick);
  }
}

export default MermaidNodeView;
