/**
 * Mermaid Extension - Tiptap Node Extension
 *
 * Provides a block-level node for embedding Mermaid diagrams in the editor.
 * Supports Yjs collaboration through attribute synchronization.
 *
 * @example
 * editor.commands.insertMermaid('graph TD; A-->B')
 * editor.commands.updateMermaid(pos, 'graph LR; A-->B')
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { MermaidNodeView } from './mermaidNodeView';
import type { MermaidOptions, MermaidStorage, MermaidAttributes } from '../types';

// Default Mermaid diagram for new nodes
const DEFAULT_MERMAID_CODE = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;

export const Mermaid = Node.create<MermaidOptions, MermaidStorage>({
  name: 'mermaid',

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
        class: 'tiptap-mermaid',
      },
      defaultCode: DEFAULT_MERMAID_CODE,
    };
  },

  addAttributes() {
    return {
      code: {
        default: this.options.defaultCode,
        parseHTML: (element) => {
          // Try to get code from attribute first
          const codeAttr = element.getAttribute('data-code');
          if (codeAttr) return codeAttr;

          // Fallback: check for code in text content (for copy-paste)
          const codeElement = element.querySelector('code');
          if (codeElement) return codeElement.textContent || '';

          return this.options.defaultCode;
        },
        renderHTML: (attributes) => {
          return {
            'data-code': (attributes as MermaidAttributes).code || '',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        // Parse <mermaid-viewer> elements
        tag: 'mermaid-viewer',
      },
      {
        // Parse div with mermaid class (common export format)
        tag: 'div.mermaid',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const code = element.textContent || '';
          return { code };
        },
      },
      {
        // Parse pre.mermaid blocks
        tag: 'pre.mermaid',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const code = element.textContent || '';
          return { code };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mermaid-viewer',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ];
  },

  addStorage() {
    return {
      // Can be used to track active mermaid node
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      return new MermaidNodeView({
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
       * Insert a new Mermaid diagram at current selection
       */
      insertMermaid:
        (code?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              code: code || this.options.defaultCode,
            },
          });
        },

      /**
       * Update the code of a Mermaid node at a specific position
       */
      updateMermaid:
        (pos: number, code: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, { code });
            dispatch(tr);
          }
          return true;
        },

      /**
       * Delete the Mermaid node at current selection
       */
      deleteMermaid:
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
          return this.editor.commands.deleteMermaid();
        }

        return false;
      },

      // Delete node when delete key is pressed while selected
      Delete: () => {
        const { selection } = this.editor.state;
        const node = selection.$anchor.nodeAfter;

        if (node?.type.name === this.name) {
          return this.editor.commands.deleteMermaid();
        }

        return false;
      },
    };
  },
});

export default Mermaid;
