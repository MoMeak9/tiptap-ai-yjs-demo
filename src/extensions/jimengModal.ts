/**
 * Jimeng Prompt Modal - Allow user to review and edit the optimized prompt
 *
 * Features:
 * - Display original selected text (read-only)
 * - Editable textarea for optimized prompt
 * - Confirm/Cancel actions with Promise-based result
 */

import type { IJimengModal, JimengModalResult } from '../types';

/**
 * Jimeng Prompt Modal for editing AI-optimized prompts before image generation
 */
export class JimengPromptModal implements IJimengModal {
  private container: HTMLElement | null = null;
  private resolvePromise: ((result: JimengModalResult) => void) | null = null;
  private promptTextarea: HTMLTextAreaElement | null = null;

  constructor() {
    this.createContainer();
  }

  /**
   * Create the modal container element
   */
  private createContainer(): void {
    // Remove existing container if any
    const existing = document.getElementById('jimeng-modal-container');
    if (existing) {
      existing.remove();
    }

    this.container = document.createElement('div');
    this.container.id = 'jimeng-modal-container';
    this.container.className = 'jimeng-modal-overlay';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);

    // Close on overlay click
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.handleCancel();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', this.handleKeydown);
  }

  /**
   * Handle keyboard events
   */
  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.container?.style.display !== 'none') {
      this.handleCancel();
    }
  };

  /**
   * Render the modal content
   */
  private render(originalText: string, optimizedPrompt: string): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="jimeng-modal">
        <div class="jimeng-modal-header">
          <h3>🎨 AI 绘图 - 提示词编辑</h3>
          <button class="jimeng-modal-close" title="关闭">&times;</button>
        </div>

        <div class="jimeng-modal-body">
          <div class="jimeng-field">
            <label>原文：</label>
            <div class="jimeng-original-text">${this.escapeHtml(originalText)}</div>
          </div>

          <div class="jimeng-field">
            <label for="jimeng-prompt">优化后的绘画提示词：</label>
            <textarea
              id="jimeng-prompt"
              class="jimeng-prompt-textarea"
              rows="6"
              placeholder="输入绘画提示词..."
            >${this.escapeHtml(optimizedPrompt)}</textarea>
          </div>

          <div class="jimeng-hint">
            💡 提示：您可以修改提示词以获得更好的效果。建议包含主体描述、环境光影、风格修饰词和画质词。
          </div>
        </div>

        <div class="jimeng-modal-footer">
          <button class="jimeng-btn jimeng-btn-cancel">取消</button>
          <button class="jimeng-btn jimeng-btn-confirm">🎨 生成图片</button>
        </div>
      </div>
    `;

    // Get textarea reference
    this.promptTextarea = this.container.querySelector('#jimeng-prompt');

    // Bind event listeners
    const closeBtn = this.container.querySelector('.jimeng-modal-close');
    const cancelBtn = this.container.querySelector('.jimeng-btn-cancel');
    const confirmBtn = this.container.querySelector('.jimeng-btn-confirm');

    closeBtn?.addEventListener('click', () => this.handleCancel());
    cancelBtn?.addEventListener('click', () => this.handleCancel());
    confirmBtn?.addEventListener('click', () => this.handleConfirm());
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Handle confirm action
   */
  private handleConfirm(): void {
    if (this.resolvePromise && this.promptTextarea) {
      const prompt = this.promptTextarea.value.trim();
      if (!prompt) {
        alert('请输入绘画提示词');
        return;
      }
      this.resolvePromise({
        action: 'confirm',
        prompt,
      });
      this.resolvePromise = null;
      this.close();
    }
  }

  /**
   * Handle cancel action
   */
  private handleCancel(): void {
    if (this.resolvePromise) {
      this.resolvePromise({
        action: 'cancel',
      });
      this.resolvePromise = null;
      this.close();
    }
  }

  /**
   * Open the modal and return a Promise that resolves when user takes action
   */
  open(originalText: string, optimizedPrompt: string): Promise<JimengModalResult> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.render(originalText, optimizedPrompt);

      if (this.container) {
        this.container.style.display = 'flex';
        // Focus the textarea after a short delay
        setTimeout(() => {
          this.promptTextarea?.focus();
          this.promptTextarea?.select();
        }, 100);
      }
    });
  }

  /**
   * Close the modal
   */
  close(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Destroy the modal and clean up
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeydown);
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.resolvePromise = null;
    this.promptTextarea = null;
  }
}

// Singleton instance
let modalInstance: JimengPromptModal | null = null;

/**
 * Initialize and return the Jimeng modal singleton
 */
export function initJimengModal(): JimengPromptModal {
  if (!modalInstance) {
    modalInstance = new JimengPromptModal();
  }
  return modalInstance;
}

export default JimengPromptModal;
