import { Mark, mergeAttributes } from "@tiptap/core";
import type { Mark as PMMark } from "@tiptap/pm/model";
import type { CommentOptions, CommentStorage, CommentAttributes } from "../types";

interface MarkWithRange {
  mark: PMMark;
  range: { from: number; to: number };
}

/**
 * Comment Extension - Collaborative comment marks for Tiptap
 * Supports adding comment marks to text with Yjs integration
 */
export const Comment = Mark.create<CommentOptions, CommentStorage>({
  name: "comment",

  // Higher priority ensures comment marks are applied correctly
  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "tiptap-comment",
      },
      onCommentActivated: (commentId: string | null) => {
        console.log("Comment activated:", commentId);
      },
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes: CommentAttributes) => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            "data-comment-id": attributes.commentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === "string") return false;
          const commentId = element.getAttribute("data-comment-id");
          return commentId && commentId.trim() ? null : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addStorage() {
    return {
      activeCommentId: null,
    };
  },

  onSelectionUpdate() {
    const { $from } = this.editor.state.selection;
    const marks = $from.marks();

    if (!marks.length) {
      this.storage.activeCommentId = null;
      this.options.onCommentActivated(null);
      return;
    }

    const commentMark = this.editor.schema.marks.comment;
    const activeCommentMark = marks.find((mark) => mark.type === commentMark);

    const newActiveId = (activeCommentMark?.attrs as CommentAttributes)?.commentId ?? null;

    // Only trigger callback when ID changes
    if (this.storage.activeCommentId !== newActiveId) {
      this.storage.activeCommentId = newActiveId;
      this.options.onCommentActivated(newActiveId);
    }
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) => {
          if (!commentId) {
            console.error("Comment ID is required");
            return false;
          }
          return commands.setMark(this.name, { commentId });
        },

      unsetComment:
        (commentId: string) =>
        ({ tr, dispatch }) => {
          if (!commentId) {
            console.error("Comment ID is required");
            return false;
          }

          const commentMarksWithRange: MarkWithRange[] = [];

          // Find all matching comment marks in the document
          tr.doc.descendants((node, pos) => {
            const commentMark = node.marks.find(
              (mark) =>
                mark.type.name === this.name &&
                (mark.attrs as CommentAttributes).commentId === commentId
            );

            if (commentMark) {
              commentMarksWithRange.push({
                mark: commentMark,
                range: {
                  from: pos,
                  to: pos + node.nodeSize,
                },
              });
            }
            return true;
          });

          // Remove all found comment marks
          commentMarksWithRange.forEach(({ mark, range }) => {
            tr.removeMark(range.from, range.to, mark);
          });

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },

      toggleComment:
        (commentId: string) =>
        ({ commands, editor }) => {
          if (!commentId) {
            console.error("Comment ID is required");
            return false;
          }

          // Check if current selection already has this comment
          const { from, to } = editor.state.selection;
          let hasComment = false;

          editor.state.doc.nodesBetween(from, to, (node) => {
            if (hasComment) return false;
            const mark = node.marks.find(
              (m) =>
                m.type.name === this.name &&
                (m.attrs as CommentAttributes).commentId === commentId
            );
            if (mark) hasComment = true;
            return true;
          });

          if (hasComment) {
            return commands.unsetComment(commentId);
          } else {
            return commands.setComment(commentId);
          }
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-m": () => {
        const event = new CustomEvent("add-comment-shortcut");
        window.dispatchEvent(event);
        return true;
      },
    };
  },
});

export default Comment;
