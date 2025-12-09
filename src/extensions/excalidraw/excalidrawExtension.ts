/**
 * Excalidraw Extension - Tiptap Node Extension
 *
 * Provides a block-level node for embedding Excalidraw diagrams in the editor.
 * Supports Yjs collaboration through a dedicated ExcalidrawManager.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { ExcalidrawNodeView } from './excalidrawNodeView';
import type { ExcalidrawAttributes } from './types';

// Generate unique node ID
const generateNodeId = (): string => {
  return `excalidraw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export interface ExcalidrawOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface ExcalidrawStorage {
  // Storage for extension state
}

export const ExcalidrawExtension = Node.create<ExcalidrawOptions, ExcalidrawStorage>({
  name: 'excalidraw',

  // Block-level element
  group: 'block',

  // Atomic node - cursor cannot enter, treated as single unit
  atom: true,

  // Allow dragging
  draggable: true,

  // Isolate from surrounding content
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'tiptap-excalidraw',
      },
    };
  },

  addAttributes() {
    return {
      nodeId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-node-id') || generateNodeId(),
        renderHTML: (attributes) => ({
          'data-node-id': (attributes as ExcalidrawAttributes).nodeId,
        }),
      },
      initialElements: {
        default: '[]',
        parseHTML: (element) => element.getAttribute('data-elements') || '[]',
        renderHTML: (attributes) => ({
          'data-elements': (attributes as ExcalidrawAttributes).initialElements,
        }),
      },
      initialFiles: {
        default: '{}',
        parseHTML: (element) => element.getAttribute('data-files') || '{}',
        renderHTML: (attributes) => ({
          'data-files': (attributes as ExcalidrawAttributes).initialFiles,
        }),
      },
      sourceMermaid: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-source-mermaid'),
        renderHTML: (attributes) => {
          const sourceMermaid = (attributes as ExcalidrawAttributes).sourceMermaid;
          return sourceMermaid ? { 'data-source-mermaid': sourceMermaid } : {};
        },
      },
      lastModifiedAt: {
        default: Date.now(),
        parseHTML: (element) => {
          const value = element.getAttribute('data-modified-at');
          return value ? parseInt(value, 10) : Date.now();
        },
        renderHTML: (attributes) => ({
          'data-modified-at': String((attributes as ExcalidrawAttributes).lastModifiedAt),
        }),
      },
      lastModifiedBy: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-modified-by'),
        renderHTML: (attributes) => {
          const modifiedBy = (attributes as ExcalidrawAttributes).lastModifiedBy;
          return modifiedBy ? { 'data-modified-by': modifiedBy } : {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="excalidraw"]',
      },
      {
        tag: 'excalidraw-viewer',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'excalidraw',
      }),
    ];
  },

  addStorage() {
    return {};
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      return new ExcalidrawNodeView({
        node,
        editor,
        getPos: getPos as () => number | undefined,
        extension: this,
      });
    };
  },

  addCommands() {
    return {
      /**
       * Insert a new Excalidraw diagram at current selection
       */
      insertExcalidraw:
        (elements?: unknown[], files?: Record<string, unknown>) =>
        ({ commands }) => {
          const nodeId = generateNodeId();
          return commands.insertContent({
            type: this.name,
            attrs: {
              nodeId,
              initialElements: JSON.stringify(elements || []),
              initialFiles: JSON.stringify(files || {}),
              lastModifiedAt: Date.now(),
            },
          });
        },

      /**
       * Update the elements of an Excalidraw node at a specific position
       */
      updateExcalidraw:
        (pos: number, elements: unknown[], files?: Record<string, unknown>) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const node = tr.doc.nodeAt(pos);
            if (node?.type.name === this.name) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                initialElements: JSON.stringify(elements),
                initialFiles: files ? JSON.stringify(files) : node.attrs.initialFiles,
                lastModifiedAt: Date.now(),
              });
              dispatch(tr);
            }
          }
          return true;
        },

      /**
       * Delete the Excalidraw node at current selection
       */
      deleteExcalidraw:
        () =>
        ({ commands }) => {
          return commands.deleteSelection();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Delete node when backspace is pressed while selected
      Backspace: () => {
        const { selection } = this.editor.state;
        const node = selection.$anchor.nodeAfter;

        if (node?.type.name === this.name) {
          return this.editor.commands.deleteExcalidraw();
        }

        return false;
      },

      // Delete node when delete key is pressed while selected
      Delete: () => {
        const { selection } = this.editor.state;
        const node = selection.$anchor.nodeAfter;

        if (node?.type.name === this.name) {
          return this.editor.commands.deleteExcalidraw();
        }

        return false;
      },
    };
  },
});

export default ExcalidrawExtension;
