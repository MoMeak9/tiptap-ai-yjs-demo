import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Comment Extension - 评论扩展
 * 支持在文本上添加评论标记,并与 yjs 协同编辑集成
 */
export const Comment = Mark.create({
  name: "comment",

  // 扩展优先级,设置较高优先级确保评论标记能正确应用
  priority: 1000,

  // 配置选项
  addOptions() {
    return {
      HTMLAttributes: {
        class: "tiptap-comment",
      },
      // 当评论被激活时的回调
      onCommentActivated: (commentId) => {
        console.log("Comment activated:", commentId);
      },
    };
  },

  // 添加属性
  addAttributes() {
    return {
      commentId: {
        default: null,
        // 从 HTML 解析属性
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        // 渲染到 HTML
        renderHTML: (attributes) => {
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

  // 解析 HTML
  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (element) => {
          const commentId = element.getAttribute("data-comment-id");
          return commentId && commentId.trim() ? null : false;
        },
      },
    ];
  },

  // 渲染 HTML
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  // 添加存储,用于跟踪当前激活的评论
  addStorage() {
    return {
      activeCommentId: null,
    };
  },

  // 选中文本变化时触发
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

    const newActiveId = activeCommentMark?.attrs.commentId || null;

    // 只在 ID 变化时触发回调
    if (this.storage.activeCommentId !== newActiveId) {
      this.storage.activeCommentId = newActiveId;
      this.options.onCommentActivated(newActiveId);
    }
  },

  // 添加命令
  addCommands() {
    return {
      /**
       * 设置评论标记
       * @param {string} commentId - 评论ID
       */
      setComment:
        (commentId) =>
        ({ commands }) => {
          if (!commentId) {
            console.error("Comment ID is required");
            return false;
          }
          return commands.setMark(this.name, { commentId });
        },

      /**
       * 取消评论标记
       * @param {string} commentId - 评论ID
       */
      unsetComment:
        (commentId) =>
        ({ tr, dispatch }) => {
          if (!commentId) {
            console.error("Comment ID is required");
            return false;
          }

          const commentMarksWithRange = [];

          // 遍历文档找到所有匹配的评论标记
          tr.doc.descendants((node, pos) => {
            const commentMark = node.marks.find(
              (mark) =>
                mark.type.name === this.name &&
                mark.attrs.commentId === commentId
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
          });

          // 移除所有找到的评论标记
          commentMarksWithRange.forEach(({ mark, range }) => {
            tr.removeMark(range.from, range.to, mark);
          });

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },

      /**
       * 切换评论标记
       * @param {string} commentId - 评论ID
       */
      toggleComment:
        (commentId) =>
        ({ commands, editor }) => {
          if (!commentId) {
            console.error("Comment ID is required");
            return false;
          }

          // 检查当前选区是否已有该评论
          const { from, to } = editor.state.selection;
          let hasComment = false;

          editor.state.doc.nodesBetween(from, to, (node) => {
            if (hasComment) return false;
            const mark = node.marks.find(
              (m) =>
                m.type.name === this.name && m.attrs.commentId === commentId
            );
            if (mark) hasComment = true;
          });

          if (hasComment) {
            return commands.unsetComment(commentId);
          } else {
            return commands.setComment(commentId);
          }
        },
    };
  },

  // 添加键盘快捷键
  addKeyboardShortcuts() {
    return {
      // 可以在这里添加快捷键,例如 Ctrl+Shift+M 添加评论
      "Mod-Shift-m": () => {
        // 触发添加评论的操作
        const event = new CustomEvent("add-comment-shortcut");
        window.dispatchEvent(event);
        return true;
      },
    };
  },
});

export default Comment;
