import { Mark, mergeAttributes } from "@tiptap/core";
import { Fragment, Node as ProseMirrorNode, Mark as PMMark } from "@tiptap/pm/model";
import { diff_match_patch, Diff } from "diff-match-patch";
import type {
  SuggestionOptions,
  SuggestionStorage,
  SuggestionAttributes,
  SuggestionType,
} from "../types";

/**
 * Suggestion Extension - AI-powered text suggestions for Tiptap
 * Supports showing diff between original and AI-suggested text
 */
export const Suggestion = Mark.create<SuggestionOptions, SuggestionStorage>({
  name: "suggestion",

  // Higher priority ensures suggestion marks are applied correctly
  priority: 1001,

  addOptions() {
    return {
      HTMLAttributes: {},
      onSuggestionActivated: () => {},
    };
  },

  addAttributes() {
    return {
      type: {
        default: "add" as SuggestionType,
        parseHTML: (element: HTMLElement) =>
          (element.getAttribute("data-suggestion-type") as SuggestionType) || "add",
        renderHTML: (attributes: SuggestionAttributes) => ({
          "data-suggestion-type": attributes.type,
        }),
      },
      diffId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-diff-id"),
        renderHTML: (attributes: SuggestionAttributes) => {
          if (!attributes.diffId) return {};
          return { "data-diff-id": attributes.diffId };
        },
      },
      groupId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-group-id"),
        renderHTML: (attributes: SuggestionAttributes) => {
          if (!attributes.groupId) return {};
          return { "data-group-id": attributes.groupId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-suggestion-type]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes["data-suggestion-type"] as SuggestionType;
    const className =
      type === "add" ? "tiptap-suggestion-add" : "tiptap-suggestion-delete";

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: className,
      }),
      0,
    ];
  },

  addStorage() {
    return {
      activeDiffId: null,
    };
  },

  onSelectionUpdate() {
    const { $from } = this.editor.state.selection;
    const marks = $from.marks();

    const suggestionMark = marks.find(
      (mark) => mark.type.name === this.name
    );

    const newActiveId =
      (suggestionMark?.attrs as SuggestionAttributes)?.diffId ?? null;

    if (this.storage.activeDiffId !== newActiveId) {
      this.storage.activeDiffId = newActiveId;
      this.options.onSuggestionActivated(newActiveId);
    }
  },

  addCommands() {
    return {
      /**
       * Apply AI suggestion diff to the editor
       * @param originalText - The original text that was selected
       * @param aiText - The AI-suggested replacement text
       * @param from - Start position of the selection
       * @param to - End position of the selection
       * @param groupId - Optional group ID for batch operations
       */
      applyAISuggestion:
        (
          originalText: string,
          aiText: string,
          from: number,
          to: number,
          groupId?: string
        ) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const dmp = new diff_match_patch();
          const diffs: Diff[] = dmp.diff_main(originalText, aiText);
          dmp.diff_cleanupSemantic(diffs);

          const schema = state.schema;
          const tr = state.tr;
          const gId = groupId || `g${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          // Build all nodes first, then replace in one operation
          const nodes: ProseMirrorNode[] = [];

          diffs.forEach(([type, text]) => {
            if (!text) return;

            const diffId = `d${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            if (type === 0) {
              // Equal - plain text, no mark
              nodes.push(schema.text(text));
            } else if (type === 1) {
              // Insert - AI added this text (green)
              const mark = schema.marks.suggestion.create({
                type: "add" as SuggestionType,
                diffId,
                groupId: gId,
              });
              nodes.push(schema.text(text, [mark]));
            } else if (type === -1) {
              // Delete - AI wants to remove this text (red strikethrough)
              const mark = schema.marks.suggestion.create({
                type: "delete" as SuggestionType,
                diffId,
                groupId: gId,
              });
              nodes.push(schema.text(text, [mark]));
            }
          });

          // Replace original content with diff-marked content in one operation
          if (nodes.length > 0) {
            tr.replaceWith(from, to, Fragment.from(nodes));
          }

          // Mark this transaction as a suggestion operation
          tr.setMeta("suggestion", true);
          tr.setMeta("suggestionGroupId", gId);

          dispatch(tr);
          return true;
        },

      /**
       * Accept a single suggestion
       * - For "add" type: keep the text, remove the mark
       * - For "delete" type: remove the text entirely
       */
      acceptSuggestion:
        (diffId: string) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const tr = state.tr;
          const nodesToRemove: { from: number; to: number }[] = [];
          const marksToRemove: { from: number; to: number; mark: PMMark }[] = [];

          // Find all nodes with this diffId
          state.doc.descendants((node, pos) => {
            const suggestionMark = node.marks.find(
              (mark) =>
                mark.type.name === "suggestion" &&
                (mark.attrs as SuggestionAttributes).diffId === diffId
            );

            if (suggestionMark) {
              const attrs = suggestionMark.attrs as SuggestionAttributes;
              const from = pos;
              const to = pos + node.nodeSize;

              if (attrs.type === "delete") {
                // Delete type: accepting means remove the text
                nodesToRemove.push({ from, to });
              } else {
                // Add type: accepting means keep text, remove mark
                marksToRemove.push({ from, to, mark: suggestionMark });
              }
            }
            return true;
          });

          // Process deletions in reverse order to maintain positions
          nodesToRemove
            .sort((a, b) => b.from - a.from)
            .forEach(({ from, to }) => {
              tr.delete(from, to);
            });

          // Remove marks (positions may have shifted, use mapping)
          marksToRemove.forEach(({ from, to, mark }) => {
            const mappedFrom = tr.mapping.map(from);
            const mappedTo = tr.mapping.map(to);
            tr.removeMark(mappedFrom, mappedTo, mark);
          });

          tr.setMeta("suggestion", true);
          dispatch(tr);
          return true;
        },

      /**
       * Reject a single suggestion
       * - For "add" type: remove the text entirely
       * - For "delete" type: keep the text, remove the mark
       */
      rejectSuggestion:
        (diffId: string) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const tr = state.tr;
          const nodesToRemove: { from: number; to: number }[] = [];
          const marksToRemove: { from: number; to: number; mark: PMMark }[] = [];

          state.doc.descendants((node, pos) => {
            const suggestionMark = node.marks.find(
              (mark) =>
                mark.type.name === "suggestion" &&
                (mark.attrs as SuggestionAttributes).diffId === diffId
            );

            if (suggestionMark) {
              const attrs = suggestionMark.attrs as SuggestionAttributes;
              const from = pos;
              const to = pos + node.nodeSize;

              if (attrs.type === "add") {
                // Add type: rejecting means remove the text
                nodesToRemove.push({ from, to });
              } else {
                // Delete type: rejecting means keep text, remove mark
                marksToRemove.push({ from, to, mark: suggestionMark });
              }
            }
            return true;
          });

          // Process deletions in reverse order
          nodesToRemove
            .sort((a, b) => b.from - a.from)
            .forEach(({ from, to }) => {
              tr.delete(from, to);
            });

          // Remove marks
          marksToRemove.forEach(({ from, to, mark }) => {
            const mappedFrom = tr.mapping.map(from);
            const mappedTo = tr.mapping.map(to);
            tr.removeMark(mappedFrom, mappedTo, mark);
          });

          tr.setMeta("suggestion", true);
          dispatch(tr);
          return true;
        },

      /**
       * Accept all suggestions in a group (or all if no groupId provided)
       */
      acceptAllSuggestions:
        (groupId?: string) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const tr = state.tr;
          const nodesToRemove: { from: number; to: number }[] = [];
          const marksToRemove: { from: number; to: number; mark: PMMark }[] = [];

          state.doc.descendants((node, pos) => {
            const suggestionMark = node.marks.find(
              (mark) =>
                mark.type.name === "suggestion" &&
                (!groupId ||
                  (mark.attrs as SuggestionAttributes).groupId === groupId)
            );

            if (suggestionMark) {
              const attrs = suggestionMark.attrs as SuggestionAttributes;
              const from = pos;
              const to = pos + node.nodeSize;

              if (attrs.type === "delete") {
                nodesToRemove.push({ from, to });
              } else {
                marksToRemove.push({ from, to, mark: suggestionMark });
              }
            }
            return true;
          });

          nodesToRemove
            .sort((a, b) => b.from - a.from)
            .forEach(({ from, to }) => {
              tr.delete(from, to);
            });

          marksToRemove.forEach(({ from, to, mark }) => {
            const mappedFrom = tr.mapping.map(from);
            const mappedTo = tr.mapping.map(to);
            tr.removeMark(mappedFrom, mappedTo, mark);
          });

          tr.setMeta("suggestion", true);
          dispatch(tr);
          return true;
        },

      /**
       * Reject all suggestions in a group (or all if no groupId provided)
       */
      rejectAllSuggestions:
        (groupId?: string) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const tr = state.tr;
          const nodesToRemove: { from: number; to: number }[] = [];
          const marksToRemove: { from: number; to: number; mark: PMMark }[] = [];

          state.doc.descendants((node, pos) => {
            const suggestionMark = node.marks.find(
              (mark) =>
                mark.type.name === "suggestion" &&
                (!groupId ||
                  (mark.attrs as SuggestionAttributes).groupId === groupId)
            );

            if (suggestionMark) {
              const attrs = suggestionMark.attrs as SuggestionAttributes;
              const from = pos;
              const to = pos + node.nodeSize;

              if (attrs.type === "add") {
                nodesToRemove.push({ from, to });
              } else {
                marksToRemove.push({ from, to, mark: suggestionMark });
              }
            }
            return true;
          });

          nodesToRemove
            .sort((a, b) => b.from - a.from)
            .forEach(({ from, to }) => {
              tr.delete(from, to);
            });

          marksToRemove.forEach(({ from, to, mark }) => {
            const mappedFrom = tr.mapping.map(from);
            const mappedTo = tr.mapping.map(to);
            tr.removeMark(mappedFrom, mappedTo, mark);
          });

          tr.setMeta("suggestion", true);
          dispatch(tr);
          return true;
        },

      /**
       * Clear all suggestions without accepting or rejecting
       * Restores original text for deletions, removes additions
       */
      clearAllSuggestions:
        () =>
        ({ commands }) => {
          return commands.rejectAllSuggestions();
        },
    };
  },
});

export default Suggestion;
