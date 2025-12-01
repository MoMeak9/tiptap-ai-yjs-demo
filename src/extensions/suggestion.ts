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
 * Suggestion Extension - 为 Tiptap 提供 AI 驱动的文本建议功能
 * 支持显示原文与 AI 建议文本之间的 diff
 */
export const Suggestion = Mark.create<SuggestionOptions, SuggestionStorage>({
  name: "suggestion",

  // 更高的优先级确保 suggestion mark 被正确应用
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

  addStorage(): SuggestionStorage {
    return {
      activeDiffId: null,
      // 存储原始状态以支持正确的撤销行为
      originalState: null,
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
       * 将 AI 建议的 diff 应用到 editor
       * @param originalText - 被选中的原始文本
       * @param aiText - AI 建议的替换文本
       * @param from - 选区的起始位置
       * @param to - 选区的结束位置
       * @param groupId - 可选的组 ID，用于批量操作
       */
      applyAISuggestion:
        (
          originalText: string,
          aiText: string,
          from: number,
          to: number,
          groupId?: string
        ) =>
        ({ state, dispatch, editor }) => {
          if (!dispatch) return true;

          // 存储原始状态以支持撤销
          const storage = (editor.storage as unknown as Record<string, SuggestionStorage>).suggestion;
          storage.originalState = {
            from,
            to,
            content: originalText,
          };

          const dmp = new diff_match_patch();
          const diffs: Diff[] = dmp.diff_main(originalText, aiText);
          dmp.diff_cleanupSemantic(diffs);

          const schema = state.schema;
          const tr = state.tr;
          const gId = groupId || `g${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          // 先构建所有节点，然后一次性替换
          const nodes: ProseMirrorNode[] = [];

          diffs.forEach(([type, text]) => {
            if (!text) return;

            const diffId = `d${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            if (type === 0) {
              // 相同 - 纯文本，无 mark
              nodes.push(schema.text(text));
            } else if (type === 1) {
              // 插入 - AI 添加的文本（绿色）
              const mark = schema.marks.suggestion.create({
                type: "add" as SuggestionType,
                diffId,
                groupId: gId,
              });
              nodes.push(schema.text(text, [mark]));
            } else if (type === -1) {
              // 删除 - AI 想要移除的文本（红色删除线）
              const mark = schema.marks.suggestion.create({
                type: "delete" as SuggestionType,
                diffId,
                groupId: gId,
              });
              nodes.push(schema.text(text, [mark]));
            }
          });

          // 一次性将原始内容替换为带有 diff 标记的内容
          if (nodes.length > 0) {
            tr.replaceWith(from, to, Fragment.from(nodes));
          }

          // 将此事务标记为 suggestion 操作
          // 重要：不要添加到历史记录 - 中间的 diff 状态不应该可撤销
          tr.setMeta("suggestion", true);
          tr.setMeta("suggestionGroupId", gId);
          tr.setMeta("addToHistory", false);

          dispatch(tr);
          return true;
        },

      /**
       * 接受单个建议
       * - 对于 "add" 类型：保留文本，移除 mark
       * - 对于 "delete" 类型：完全删除文本
       */
      acceptSuggestion:
        (diffId: string) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const tr = state.tr;
          const nodesToRemove: { from: number; to: number }[] = [];
          const marksToRemove: { from: number; to: number; mark: PMMark }[] = [];

          // 查找所有具有此 diffId 的节点
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
                // 删除类型：接受意味着移除文本
                nodesToRemove.push({ from, to });
              } else {
                // 添加类型：接受意味着保留文本，移除 mark
                marksToRemove.push({ from, to, mark: suggestionMark });
              }
            }
            return true;
          });

          // 按相反顺序处理删除以保持位置
          nodesToRemove
            .sort((a, b) => b.from - a.from)
            .forEach(({ from, to }) => {
              tr.delete(from, to);
            });

          // 移除 mark（位置可能已移动，使用 mapping）
          marksToRemove.forEach(({ from, to, mark }) => {
            const mappedFrom = tr.mapping.map(from);
            const mappedTo = tr.mapping.map(to);
            tr.removeMark(mappedFrom, mappedTo, mark);
          });

          tr.setMeta("suggestion", true);
          tr.setMeta("addToHistory", false);
          dispatch(tr);
          return true;
        },

      /**
       * 拒绝单个建议
       * - 对于 "add" 类型：完全删除文本
       * - 对于 "delete" 类型：保留文本，移除 mark
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
                // 添加类型：拒绝意味着移除文本
                nodesToRemove.push({ from, to });
              } else {
                // 删除类型：拒绝意味着保留文本，移除 mark
                marksToRemove.push({ from, to, mark: suggestionMark });
              }
            }
            return true;
          });

          // 按相反顺序处理删除
          nodesToRemove
            .sort((a, b) => b.from - a.from)
            .forEach(({ from, to }) => {
              tr.delete(from, to);
            });

          // 移除 mark
          marksToRemove.forEach(({ from, to, mark }) => {
            const mappedFrom = tr.mapping.map(from);
            const mappedTo = tr.mapping.map(to);
            tr.removeMark(mappedFrom, mappedTo, mark);
          });

          tr.setMeta("suggestion", true);
          tr.setMeta("addToHistory", false);
          dispatch(tr);
          return true;
        },

      /**
       * 接受组中的所有建议（如果未提供 groupId，则接受全部）
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
          tr.setMeta("addToHistory", false);
          dispatch(tr);
          return true;
        },

      /**
       * 拒绝组中的所有建议（如果未提供 groupId，则拒绝全部）
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
          tr.setMeta("addToHistory", false);
          dispatch(tr);
          return true;
        },

      /**
       * 清除所有建议（不接受也不拒绝）
       * 对于删除恢复原始文本，对于添加则移除
       */
      clearAllSuggestions:
        () =>
        ({ commands }) => {
          return commands.rejectAllSuggestions();
        },

      /**
       * 完成建议处理 - 清除存储并创建历史记录
       * 在所有建议都已解决后调用此方法
       *
       * 行为：
       * - 创建一个会被记录到 history 的 transaction
       * - Ctrl+Z 可以撤销到接受前的最终状态
       * - 再次 Ctrl+Z 会回到 AI 处理前的状态
       */
      finalizeSuggestions:
        () =>
        ({ editor, state, dispatch }) => {
          const storage = (editor.storage as unknown as Record<string, SuggestionStorage>).suggestion;
          storage.originalState = null;

          if (dispatch) {
            // 创建一个会被记录到 history 的 transaction
            // 使用 setMeta 标记这是一个有意义的状态变更
            const tr = state.tr;
            tr.setMeta("suggestionFinalized", true);
            // 显式设置 addToHistory: true（默认行为，但明确表达意图）
            tr.setMeta("addToHistory", true);
            dispatch(tr);
          }

          return true;
        },
    };
  },
});

export default Suggestion;
