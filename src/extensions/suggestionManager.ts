import type { Editor } from "@tiptap/core";
import type {
  SuggestionItem,
  SuggestionGroup,
  SuggestionAttributes,
  ISuggestionManager,
  SuggestionsChangedCallback,
} from "../types";

/**
 * SuggestionManager - Local state manager for AI suggestions
 * Manages suggestion data without Yjs synchronization (local preview only)
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
   * Attach editor event listeners
   */
  private _attachEditorListeners(): void {
    // Listen for document changes that might invalidate suggestions
    this.editor.on("update", ({ transaction }) => {
      // Skip if this is a suggestion operation
      if (transaction.getMeta("suggestion")) {
        this._syncFromDocument();
        return;
      }

      // External edit detected - check if it affects our suggestions
      if (transaction.docChanged && this.hasPendingSuggestions()) {
        this._handleExternalEdit();
      }
    });
  }

  /**
   * Handle external edits that might affect suggestions
   */
  private _handleExternalEdit(): void {
    // For MVP: simply invalidate all suggestions on external edit
    // More sophisticated conflict resolution can be added later
    const hadSuggestions = this.hasPendingSuggestions();

    if (hadSuggestions) {
      // Sync from document to get current state
      this._syncFromDocument();

      // If suggestions were affected, notify
      if (this.onChangeCallback) {
        this.onChangeCallback(this.getAllSuggestions());
      }
    }
  }

  /**
   * Sync suggestion state from the actual document
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

    // Update groups
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

    // Update current group if it no longer exists
    if (this.currentGroupId && !this.groups.has(this.currentGroupId)) {
      const firstGroup = this.groups.keys().next().value;
      this.currentGroupId = firstGroup || null;
      this.currentIndex = 0;
    }

    // Notify listeners
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getAllSuggestions());
    }
  }

  /**
   * Register a new suggestion group after applying AI suggestion
   */
  registerGroup(groupId: string): void {
    this.currentGroupId = groupId;
    this.currentIndex = 0;
    this._syncFromDocument();
  }

  /**
   * Get all suggestions
   */
  getAllSuggestions(): SuggestionItem[] {
    const all: SuggestionItem[] = [];
    this.groups.forEach((group) => {
      all.push(...group.suggestions);
    });
    return all;
  }

  /**
   * Get suggestions for current group
   */
  getCurrentGroupSuggestions(): SuggestionItem[] {
    if (!this.currentGroupId) return [];
    const group = this.groups.get(this.currentGroupId);
    return group?.suggestions || [];
  }

  /**
   * Get current suggestion being reviewed
   */
  getCurrentSuggestion(): SuggestionItem | null {
    const suggestions = this.getCurrentGroupSuggestions();
    if (suggestions.length === 0) return null;

    // Filter only pending suggestions
    const pending = suggestions.filter((s) => s.status === "pending");
    if (pending.length === 0) return null;

    // Clamp index to valid range
    const index = Math.min(this.currentIndex, pending.length - 1);
    return pending[index] || null;
  }

  /**
   * Get progress info
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
   * Check if there are pending suggestions
   */
  hasPendingSuggestions(): boolean {
    return this.getAllSuggestions().some((s) => s.status === "pending");
  }

  /**
   * Accept current suggestion
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
   * Reject current suggestion
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
   * Accept all suggestions
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

    this._notifyChange();
  }

  /**
   * Reject all suggestions
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

    this._notifyChange();
  }

  /**
   * Navigate to next suggestion
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
   * Navigate to previous suggestion
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
   * Move to next pending suggestion
   */
  private _moveToNextPending(): void {
    const pending = this.getCurrentGroupSuggestions().filter(
      (s) => s.status === "pending"
    );

    if (pending.length === 0) {
      this.currentIndex = 0;
      // Check if group is fully resolved
      const group = this.currentGroupId
        ? this.groups.get(this.currentGroupId)
        : null;
      if (group) {
        group.status = "resolved";
      }
    } else {
      // Keep index in range
      this.currentIndex = Math.min(this.currentIndex, pending.length - 1);
      this._focusCurrentSuggestion();
    }
  }

  /**
   * Focus editor on current suggestion
   */
  private _focusCurrentSuggestion(): void {
    const current = this.getCurrentSuggestion();
    if (!current) return;

    // Find the actual position in the document
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

      // Scroll into view
      const domAtPos = this.editor.view.domAtPos(foundPos);
      if (domAtPos.node instanceof Element) {
        domAtPos.node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  /**
   * Notify change listeners
   */
  private _notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getAllSuggestions());
    }
  }

  /**
   * Set change callback
   */
  onChange(callback: SuggestionsChangedCallback): void {
    this.onChangeCallback = callback;
  }

  /**
   * Get current group ID
   */
  getCurrentGroupId(): string | null {
    return this.currentGroupId;
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.groups.clear();
    this.currentGroupId = null;
    this.currentIndex = 0;
    this._notifyChange();
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.groups.clear();
    this.currentGroupId = null;
    this.currentIndex = 0;
    this.onChangeCallback = null;
  }
}

export default SuggestionManager;
