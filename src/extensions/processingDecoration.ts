import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Processing state interface
 */
export interface ProcessingState {
  /** Whether AI is currently processing */
  isProcessing: boolean;
  /** Start position of selection when processing started */
  from: number;
  /** End position of selection when processing started */
  to: number;
}

/**
 * Plugin key for accessing processing state
 */
export const processingPluginKey = new PluginKey<ProcessingState>("processing");

/**
 * Meta key for setting processing state
 */
const PROCESSING_META_KEY = "setProcessing";

/**
 * Create decorations for paragraphs in the given range
 */
function createProcessingDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  from: number,
  to: number
): DecorationSet {
  const decorations: Decoration[] = [];

  // Ensure valid range
  const safeFrom = Math.max(0, Math.min(from, doc.content.size));
  const safeTo = Math.max(safeFrom, Math.min(to, doc.content.size));

  if (safeFrom >= safeTo) {
    return DecorationSet.create(doc, []);
  }

  // Find all block nodes (paragraphs) that overlap with the selection
  doc.nodesBetween(safeFrom, safeTo, (node, pos) => {
    // Only decorate block-level nodes (paragraphs, headings, list items, etc.)
    if (node.isBlock && node.isTextblock) {
      const nodeEnd = pos + node.nodeSize;

      // Create a node decoration for the entire block
      decorations.push(
        Decoration.node(pos, nodeEnd, {
          class: "ai-processing",
        })
      );

      return false; // Don't descend into this node
    }
    return true; // Continue traversal
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * ProcessingDecoration Extension
 *
 * Provides visual feedback (animated underline) for text being processed by AI.
 * Uses ProseMirror Decoration to highlight entire paragraphs containing the selection.
 */
export const ProcessingDecoration = Extension.create({
  name: "processingDecoration",

  addStorage() {
    return {
      isProcessing: false,
      from: 0,
      to: 0,
    } as ProcessingState;
  },

  addCommands() {
    return {
      /**
       * Set processing state - shows animated underline on paragraphs
       * @param from - Start position of selection
       * @param to - End position of selection
       */
      setProcessing:
        (from: number, to: number) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(PROCESSING_META_KEY, { isProcessing: true, from, to });
            dispatch(tr);
          }
          return true;
        },

      /**
       * Clear processing state - removes animated underline
       */
      clearProcessing:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(PROCESSING_META_KEY, { isProcessing: false, from: 0, to: 0 });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    const plugin = new Plugin({
      key: processingPluginKey,

      state: {
        init(): ProcessingState {
          return { isProcessing: false, from: 0, to: 0 };
        },

        apply(tr, oldState: ProcessingState): ProcessingState {
          const meta = tr.getMeta(PROCESSING_META_KEY) as ProcessingState | undefined;

          if (meta !== undefined) {
            // Update extension storage
            extension.storage.isProcessing = meta.isProcessing;
            extension.storage.from = meta.from;
            extension.storage.to = meta.to;
            return meta;
          }

          // Map positions through document changes
          if (tr.docChanged && oldState.isProcessing) {
            try {
              const mappedFrom = tr.mapping.map(oldState.from);
              const mappedTo = tr.mapping.map(oldState.to);
              const newState = { ...oldState, from: mappedFrom, to: mappedTo };
              // Update storage with mapped positions
              extension.storage.from = mappedFrom;
              extension.storage.to = mappedTo;
              return newState;
            } catch {
              // If mapping fails, clear the state
              extension.storage.isProcessing = false;
              return { isProcessing: false, from: 0, to: 0 };
            }
          }

          return oldState;
        },
      },

      props: {
        decorations(state): DecorationSet | null {
          const pluginState = processingPluginKey.getState(state);

          // Return null when no plugin state (ProseMirror handles null gracefully)
          if (!pluginState || !pluginState.isProcessing) {
            return null;
          }

          // Generate decorations dynamically based on state
          return createProcessingDecorations(state.doc, pluginState.from, pluginState.to);
        },
      },
    });

    return [plugin];
  },
});

// Declare module augmentation for commands
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    processingDecoration: {
      /**
       * Set processing state with selection range
       */
      setProcessing: (from: number, to: number) => ReturnType;
      /**
       * Clear processing state
       */
      clearProcessing: () => ReturnType;
    };
  }
}

export default ProcessingDecoration;
