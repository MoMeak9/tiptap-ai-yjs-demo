import type { Editor } from "@tiptap/core";
import type {
  SuggestionItem,
  SuggestionGroup,
  SuggestionAttributes,
  ISuggestionManager,
  SuggestionsChangedCallback,
} from "../types";

/**
 * SuggestionManager - AI 建议的本地状态管理器
 * 管理建议数据，不使用 Yjs 同步（仅本地预览）
 */
export class SuggestionManager implements ISuggestionManager {
  private editor: Editor;
  private groups: Map<string, SuggestionGroup>;
  private currentGroupId: string | null;
  private currentIndex: number;
  private onChangeCallback: SuggestionsChangedCallback | null;

  constructor(editor: Editor) {
    this.editor = editor;
    this.groups = new Map();
    this.currentGroupId = null;
    this.currentIndex = 0;
    this.onChangeCallback = null;

    this._attachEditorListeners();
  }

  /**
   * 附加 editor 事件监听器
   */
  private _attachEditorListeners(): void {
    // 监听可能使建议失效的文档更改
    this.editor.on("update", ({ transaction }) => {
      // 如果这是一个 suggestion 操作则跳过
      if (transaction.getMeta("suggestion")) {
        this._syncFromDocument();
        return;
      }

      // 检测到外部编辑 - 检查是否影响我们的建议
      if (transaction.docChanged && this.hasPendingSuggestions()) {
        this._handleExternalEdit();
      }
    });
  }

  /**
   * 处理可能影响建议的外部编辑
   */
  private _handleExternalEdit(): void {
    // 对于 MVP：在外部编辑时简单地使所有建议失效
    // 更复杂的冲突解决可以稍后添加
    const hadSuggestions = this.hasPendingSuggestions();

    if (hadSuggestions) {
      // 从文档同步以获取当前状态
      this._syncFromDocument();

      // 如果建议受到影响，则通知
      if (this.onChangeCallback) {
        this.onChangeCallback(this.getAllSuggestions());
      }
    }
  }

  /**
   * 从实际文档同步建议状态
   */
  private _syncFromDocument(): void {
    const suggestions = new Map<string, SuggestionItem>();
    const groupIds = new Set<string>();

    this.editor.state.doc.descendants((node, pos) => {
      const suggestionMark = node.marks.find(
        (mark) => mark.type.name === "suggestion"
      );

      if (suggestionMark) {
        const attrs = suggestionMark.attrs as SuggestionAttributes;
        if (attrs.diffId && attrs.groupId) {
          suggestions.set(attrs.diffId, {
            diffId: attrs.diffId,
            groupId: attrs.groupId,
            type: attrs.type,
            text: node.text || "",
            from: pos,
            to: pos + node.nodeSize,
            status: "pending",
          });
          groupIds.add(attrs.groupId);
        }
      }
      return true;
    });

    // 更新组
    this.groups.clear();
    groupIds.forEach((groupId) => {
      const groupSuggestions = Array.from(suggestions.values()).filter(
        (s) => s.groupId === groupId
      );

      if (groupSuggestions.length > 0) {
        this.groups.set(groupId, {
          groupId,
          suggestions: groupSuggestions,
          createdAt: new Date().toISOString(),
          status: "pending",
        });
      }
    });

    // 如果当前组不再存在则更新
    if (this.currentGroupId && !this.groups.has(this.currentGroupId)) {
      const firstGroup = this.groups.keys().next().value;
      this.currentGroupId = firstGroup || null;
      this.currentIndex = 0;
    }

    // 通知监听器
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getAllSuggestions());
    }
  }

  /**
   * 在应用 AI 建议后注册新的建议组
   */
  registerGroup(groupId: string): void {
    this.currentGroupId = groupId;
    this.currentIndex = 0;
    this._syncFromDocument();
  }

  /**
   * 获取所有建议
   */
  getAllSuggestions(): SuggestionItem[] {
    const all: SuggestionItem[] = [];
    this.groups.forEach((group) => {
      all.push(...group.suggestions);
    });
    return all;
  }

  /**
   * 获取当前组的建议
   */
  getCurrentGroupSuggestions(): SuggestionItem[] {
    if (!this.currentGroupId) return [];
    const group = this.groups.get(this.currentGroupId);
    return group?.suggestions || [];
  }

  /**
   * 获取当前正在审阅的建议
   */
  getCurrentSuggestion(): SuggestionItem | null {
    const suggestions = this.getCurrentGroupSuggestions();
    if (suggestions.length === 0) return null;

    // 仅筛选待处理的建议
    const pending = suggestions.filter((s) => s.status === "pending");
    if (pending.length === 0) return null;

    // 将索引限制在有效范围内
    const index = Math.min(this.currentIndex, pending.length - 1);
    return pending[index] || null;
  }

  /**
   * 获取进度信息
   */
  getProgress(): { current: number; total: number; pending: number } {
    const suggestions = this.getCurrentGroupSuggestions();
    const pending = suggestions.filter((s) => s.status === "pending");

    return {
      current: this.currentIndex + 1,
      total: suggestions.length,
      pending: pending.length,
    };
  }

  /**
   * 检查是否有待处理的建议
   */
  hasPendingSuggestions(): boolean {
    return this.getAllSuggestions().some((s) => s.status === "pending");
  }

  /**
   * 接受当前建议
   */
  acceptCurrent(): boolean {
    const current = this.getCurrentSuggestion();
    if (!current) return false;

    this.editor.commands.acceptSuggestion(current.diffId);
    current.status = "accepted";

    this._moveToNextPending();
    this._notifyChange();
    return true;
  }

  /**
   * 拒绝当前建议
   */
  rejectCurrent(): boolean {
    const current = this.getCurrentSuggestion();
    if (!current) return false;

    this.editor.commands.rejectSuggestion(current.diffId);
    current.status = "rejected";

    this._moveToNextPending();
    this._notifyChange();
    return true;
  }

  /**
   * 接受所有建议
   */
  acceptAll(): void {
    if (!this.currentGroupId) return;

    this.editor.commands.acceptAllSuggestions(this.currentGroupId);

    const group = this.groups.get(this.currentGroupId);
    if (group) {
      group.suggestions.forEach((s) => {
        s.status = "accepted";
      });
      group.status = "resolved";
    }

    // 完成 - 清除原始状态存储
    this.editor.commands.finalizeSuggestions();
    this._notifyChange();
  }

  /**
   * 拒绝所有建议
   */
  rejectAll(): void {
    if (!this.currentGroupId) return;

    this.editor.commands.rejectAllSuggestions(this.currentGroupId);

    const group = this.groups.get(this.currentGroupId);
    if (group) {
      group.suggestions.forEach((s) => {
        s.status = "rejected";
      });
      group.status = "resolved";
    }

    // 完成 - 清除原始状态存储
    this.editor.commands.finalizeSuggestions();

    this._notifyChange();
  }

  /**
   * 导航到下一个建议
   */
  nextSuggestion(): void {
    const pending = this.getCurrentGroupSuggestions().filter(
      (s) => s.status === "pending"
    );
    if (pending.length === 0) return;

    this.currentIndex = (this.currentIndex + 1) % pending.length;
    this._focusCurrentSuggestion();
    this._notifyChange();
  }

  /**
   * 导航到上一个建议
   */
  prevSuggestion(): void {
    const pending = this.getCurrentGroupSuggestions().filter(
      (s) => s.status === "pending"
    );
    if (pending.length === 0) return;

    this.currentIndex = (this.currentIndex - 1 + pending.length) % pending.length;
    this._focusCurrentSuggestion();
    this._notifyChange();
  }

  /**
   * 移动到下一个待处理的建议
   */
  private _moveToNextPending(): void {
    const pending = this.getCurrentGroupSuggestions().filter(
      (s) => s.status === "pending"
    );

    if (pending.length === 0) {
      this.currentIndex = 0;
      // 检查组是否已完全解决
      const group = this.currentGroupId
        ? this.groups.get(this.currentGroupId)
        : null;
      if (group) {
        group.status = "resolved";
      }
      // 所有建议已解决 - 完成以清理存储
      this.editor.commands.finalizeSuggestions();
    } else {
      // 将索引保持在范围内
      this.currentIndex = Math.min(this.currentIndex, pending.length - 1);
      this._focusCurrentSuggestion();
    }
  }

  /**
   * 将 editor 焦点移到当前建议
   */
  private _focusCurrentSuggestion(): void {
    const current = this.getCurrentSuggestion();
    if (!current) return;

    // 在文档中查找实际位置
    let foundPos: number | null = null;
    this.editor.state.doc.descendants((node, pos) => {
      if (foundPos !== null) return false;

      const mark = node.marks.find(
        (m) =>
          m.type.name === "suggestion" &&
          (m.attrs as SuggestionAttributes).diffId === current.diffId
      );

      if (mark) {
        foundPos = pos;
        return false;
      }
      return true;
    });

    if (foundPos !== null) {
      this.editor.commands.focus();
      this.editor.commands.setTextSelection(foundPos);

      // 滚动到可见区域
      const domAtPos = this.editor.view.domAtPos(foundPos);
      if (domAtPos.node instanceof Element) {
        domAtPos.node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  /**
   * 通知更改监听器
   */
  private _notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getAllSuggestions());
    }
  }

  /**
   * 设置更改回调
   */
  onChange(callback: SuggestionsChangedCallback): void {
    this.onChangeCallback = callback;
  }

  /**
   * 获取当前组 ID
   */
  getCurrentGroupId(): string | null {
    return this.currentGroupId;
  }

  /**
   * 清除所有状态
   */
  clear(): void {
    this.groups.clear();
    this.currentGroupId = null;
    this.currentIndex = 0;
    this._notifyChange();
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.groups.clear();
    this.currentGroupId = null;
    this.currentIndex = 0;
    this.onChangeCallback = null;
  }
}

export default SuggestionManager;
