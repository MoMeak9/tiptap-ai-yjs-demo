import type { Editor } from "@tiptap/core";
import type { ISuggestionManager, ISuggestionUI } from "../types";

/**
 * SuggestionUI - 用于审阅 AI 建议的底部工具栏 UI
 * 提供单个和批量操作的接受/拒绝控制
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
   * 初始化 UI
   */
  private _init(): void {
    this._createContainer();
    this._attachEventListeners();
  }

  /**
   * 创建建议栏容器
   */
  private _createContainer(): void {
    // 检查是否已存在
    const existing = document.getElementById("suggestion-bar");
    if (existing) {
      this.container = existing;
      return;
    }

    this.container = document.createElement("div");
    this.container.id = "suggestion-bar";
    this.container.className = "suggestion-bar hidden";
    this.container.innerHTML = this._getBarHTML();

    // 插入到 editor-wrapper 底部
    const editorWrapper = document.querySelector(".editor-wrapper");
    if (editorWrapper) {
      editorWrapper.appendChild(this.container);
    } else {
      document.body.appendChild(this.container);
    }
  }

  /**
   * 获取工具栏 HTML 模板
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
   * 附加事件监听器
   */
  private _attachEventListeners(): void {
    if (!this.container) return;

    // 按钮的点击处理器
    this.container.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;

      const action = button.dataset.action;
      this._handleAction(action);
    });

    // 监听建议更改
    this.suggestionManager.onChange(() => {
      this._render();
    });

    // 键盘快捷键
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.isVisible) return;

      // 如果用户正在输入框中输入则不拦截
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
   * 处理按钮操作
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
        this.suggestionManager.rejectAll(); // 关闭 = 拒绝所有待处理的建议
        break;
    }

    // 检查是否应该隐藏工具栏
    if (!this.suggestionManager.hasPendingSuggestions()) {
      this.hide();
    }
  }

  /**
   * 渲染建议栏
   */
  private _render(): void {
    if (!this.container) return;

    const current = this.suggestionManager.getCurrentSuggestion();
    const progress = this.suggestionManager.getProgress();

    // 更新进度
    const progressEl = this.container.querySelector(".suggestion-progress");
    if (progressEl) {
      progressEl.textContent = `(${progress.pending}/${progress.total} pending)`;
    }

    // 更新当前建议信息
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

    // 更新按钮状态
    const hasPending = this.suggestionManager.hasPendingSuggestions();
    this.container
      .querySelectorAll(".suggestion-btn, .suggestion-nav-btn")
      .forEach((btn) => {
        (btn as HTMLButtonElement).disabled = !hasPending;
      });

    // 如果没有待处理的建议则自动隐藏
    if (!hasPending && this.isVisible) {
      setTimeout(() => {
        if (!this.suggestionManager.hasPendingSuggestions()) {
          this.hide();
        }
      }, 1500);
    }
  }

  /**
   * 截断文本用于预览
   */
  private _truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * 显示建议栏
   */
  show(): void {
    if (!this.container) return;
    this.isVisible = true;
    this.container.classList.remove("hidden");
    this._render();
  }

  /**
   * 隐藏建议栏
   */
  hide(): void {
    if (!this.container) return;
    this.isVisible = false;
    this.container.classList.add("hidden");
  }

  /**
   * 切换可见性
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * 检查是否可见
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * 销毁 UI
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default SuggestionUI;
