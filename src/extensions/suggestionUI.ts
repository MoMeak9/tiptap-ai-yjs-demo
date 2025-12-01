import type { Editor } from "@tiptap/core";
import type { ISuggestionManager, ISuggestionUI } from "../types";

/**
 * SuggestionUI - Bottom bar UI for reviewing AI suggestions
 * Provides accept/reject controls for individual and batch operations
 */
export class SuggestionUI implements ISuggestionUI {
  private suggestionManager: ISuggestionManager;
  private container: HTMLElement | null;
  private isVisible: boolean;

  constructor(_editor: Editor, suggestionManager: ISuggestionManager) {
    this.suggestionManager = suggestionManager;
    this.container = null;
    this.isVisible = false;

    this._init();
  }

  /**
   * Initialize UI
   */
  private _init(): void {
    this._createContainer();
    this._attachEventListeners();
  }

  /**
   * Create suggestion bar container
   */
  private _createContainer(): void {
    // Check if already exists
    const existing = document.getElementById("suggestion-bar");
    if (existing) {
      this.container = existing;
      return;
    }

    this.container = document.createElement("div");
    this.container.id = "suggestion-bar";
    this.container.className = "suggestion-bar hidden";
    this.container.innerHTML = this._getBarHTML();

    // Insert at the bottom of editor-wrapper
    const editorWrapper = document.querySelector(".editor-wrapper");
    if (editorWrapper) {
      editorWrapper.appendChild(this.container);
    } else {
      document.body.appendChild(this.container);
    }
  }

  /**
   * Get bar HTML template
   */
  private _getBarHTML(): string {
    return `
      <div class="suggestion-bar-content">
        <div class="suggestion-info">
          <span class="suggestion-icon">💡</span>
          <span class="suggestion-label">AI Suggestions</span>
          <span class="suggestion-progress">(0/0)</span>
        </div>

        <div class="suggestion-current">
          <span class="suggestion-type-badge">-</span>
          <span class="suggestion-preview">No suggestions</span>
        </div>

        <div class="suggestion-nav">
          <button class="suggestion-nav-btn" data-action="prev" title="Previous (←)">
            ←
          </button>
          <button class="suggestion-nav-btn" data-action="next" title="Next (→)">
            →
          </button>
        </div>

        <div class="suggestion-actions">
          <button class="suggestion-btn suggestion-btn-accept" data-action="accept" title="Accept (Enter)">
            ✓ Accept
          </button>
          <button class="suggestion-btn suggestion-btn-reject" data-action="reject" title="Reject (Backspace)">
            ✗ Reject
          </button>
        </div>

        <div class="suggestion-batch-actions">
          <button class="suggestion-btn suggestion-btn-accept-all" data-action="acceptAll" title="Accept All">
            ✓ All
          </button>
          <button class="suggestion-btn suggestion-btn-reject-all" data-action="rejectAll" title="Reject All">
            ✗ All
          </button>
        </div>

        <button class="suggestion-close-btn" data-action="close" title="Close">
          ×
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private _attachEventListeners(): void {
    if (!this.container) return;

    // Click handlers for buttons
    this.container.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;

      const action = button.dataset.action;
      this._handleAction(action);
    });

    // Listen for suggestion changes
    this.suggestionManager.onChange(() => {
      this._render();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.isVisible) return;

      // Don't intercept if user is typing in an input
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "Enter":
          e.preventDefault();
          this._handleAction("accept");
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          this._handleAction("reject");
          break;
        case "ArrowLeft":
          e.preventDefault();
          this._handleAction("prev");
          break;
        case "ArrowRight":
          e.preventDefault();
          this._handleAction("next");
          break;
        case "Escape":
          e.preventDefault();
          this._handleAction("close");
          break;
      }
    });
  }

  /**
   * Handle button actions
   */
  private _handleAction(action: string | undefined): void {
    if (!action) return;

    switch (action) {
      case "accept":
        this.suggestionManager.acceptCurrent();
        break;
      case "reject":
        this.suggestionManager.rejectCurrent();
        break;
      case "acceptAll":
        this.suggestionManager.acceptAll();
        break;
      case "rejectAll":
        this.suggestionManager.rejectAll();
        break;
      case "prev":
        this.suggestionManager.prevSuggestion();
        break;
      case "next":
        this.suggestionManager.nextSuggestion();
        break;
      case "close":
        this.hide();
        this.suggestionManager.rejectAll(); // Close = reject all pending
        break;
    }

    // Check if we should hide the bar
    if (!this.suggestionManager.hasPendingSuggestions()) {
      this.hide();
    }
  }

  /**
   * Render the suggestion bar
   */
  private _render(): void {
    if (!this.container) return;

    const current = this.suggestionManager.getCurrentSuggestion();
    const progress = this.suggestionManager.getProgress();

    // Update progress
    const progressEl = this.container.querySelector(".suggestion-progress");
    if (progressEl) {
      progressEl.textContent = `(${progress.pending}/${progress.total} pending)`;
    }

    // Update current suggestion info
    const typeEl = this.container.querySelector(".suggestion-type-badge");
    const previewEl = this.container.querySelector(".suggestion-preview");

    if (current) {
      if (typeEl) {
        typeEl.textContent = current.type === "add" ? "ADD" : "DELETE";
        typeEl.className = `suggestion-type-badge suggestion-type-${current.type}`;
      }
      if (previewEl) {
        const previewText = this._truncateText(current.text, 50);
        previewEl.textContent = `"${previewText}"`;
      }
    } else {
      if (typeEl) {
        typeEl.textContent = "-";
        typeEl.className = "suggestion-type-badge";
      }
      if (previewEl) {
        previewEl.textContent = progress.total > 0 ? "All reviewed!" : "No suggestions";
      }
    }

    // Update button states
    const hasPending = this.suggestionManager.hasPendingSuggestions();
    this.container
      .querySelectorAll(".suggestion-btn, .suggestion-nav-btn")
      .forEach((btn) => {
        (btn as HTMLButtonElement).disabled = !hasPending;
      });

    // Auto-hide if no pending suggestions
    if (!hasPending && this.isVisible) {
      setTimeout(() => {
        if (!this.suggestionManager.hasPendingSuggestions()) {
          this.hide();
        }
      }, 1500);
    }
  }

  /**
   * Truncate text for preview
   */
  private _truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Show the suggestion bar
   */
  show(): void {
    if (!this.container) return;
    this.isVisible = true;
    this.container.classList.remove("hidden");
    this._render();
  }

  /**
   * Hide the suggestion bar
   */
  hide(): void {
    if (!this.container) return;
    this.isVisible = false;
    this.container.classList.add("hidden");
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Destroy the UI
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default SuggestionUI;
