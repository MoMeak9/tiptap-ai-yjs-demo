/**
 * MermaidModal - Edit Modal for Mermaid Diagrams
 *
 * Provides a modal dialog with:
 * - Left panel: textarea for code editing
 * - Right panel: real-time preview (debounced)
 * - Save/Cancel buttons
 */
import type { OpenMermaidEditorDetail } from './mermaidNodeView';

// Ensure mermaid-viewer is registered for preview
import './mermaid-viewer';

export interface MermaidModalOptions {
  debounceMs?: number;
}

export class MermaidModal {
  private modal: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private preview: HTMLElement | null = null;
  private debounceTimer: number | null = null;
  private currentCallback: ((code: string) => void) | null = null;
  private cancelCallback: (() => void) | null = null;

  private options: Required<MermaidModalOptions>;

  constructor(options: MermaidModalOptions = {}) {
    this.options = {
      debounceMs: options.debounceMs ?? 300,
    };

    this.createModal();
    this.bindGlobalEvents();
  }

  /**
   * Create the modal DOM structure
   */
  private createModal() {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'mermaid-modal-overlay';
    this.modal.innerHTML = `
      <div class="mermaid-modal">
        <div class="mermaid-modal-header">
          <h3>Edit Mermaid Diagram</h3>
          <button class="mermaid-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="mermaid-modal-body">
          <div class="mermaid-modal-editor">
            <label for="mermaid-code">Diagram Code</label>
            <textarea id="mermaid-code" placeholder="Enter Mermaid diagram code..."></textarea>
          </div>
          <div class="mermaid-modal-preview">
            <label>Preview</label>
            <div class="mermaid-modal-preview-container">
              <mermaid-viewer></mermaid-viewer>
            </div>
          </div>
        </div>
        <div class="mermaid-modal-footer">
          <button class="mermaid-modal-btn mermaid-modal-btn-secondary" data-action="cancel">Cancel</button>
          <button class="mermaid-modal-btn mermaid-modal-btn-primary" data-action="save">Save</button>
        </div>
      </div>
    `;

    // Get references to key elements
    this.textarea = this.modal.querySelector('#mermaid-code');
    this.preview = this.modal.querySelector('mermaid-viewer');

    // Bind button events
    const closeBtn = this.modal.querySelector('.mermaid-modal-close');
    closeBtn?.addEventListener('click', () => this.cancel());

    const cancelBtn = this.modal.querySelector('[data-action="cancel"]');
    cancelBtn?.addEventListener('click', () => this.cancel());

    const saveBtn = this.modal.querySelector('[data-action="save"]');
    saveBtn?.addEventListener('click', () => this.save());

    // Bind textarea input for live preview
    this.textarea?.addEventListener('input', () => this.onCodeChange());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.cancel();
      }
    });

    // Append to body (hidden by default)
    document.body.appendChild(this.modal);
  }

  /**
   * Bind global events for keyboard shortcuts
   */
  private bindGlobalEvents() {
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;

      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }

      // Ctrl/Cmd + Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.save();
      }
    });

    // Listen for open-mermaid-editor events
    document.addEventListener('open-mermaid-editor', ((e: CustomEvent<OpenMermaidEditorDetail>) => {
      this.open(e.detail.code, e.detail.onSave, e.detail.onCancel);
    }) as EventListener);
  }

  /**
   * Handle code input change with debounce
   */
  private onCodeChange() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.updatePreview();
    }, this.options.debounceMs);
  }

  /**
   * Update the preview pane
   */
  private updatePreview() {
    if (!this.preview || !this.textarea) return;

    const code = this.textarea.value;
    (this.preview as any).code = code;
  }

  /**
   * Open the modal with given code
   */
  open(code: string, onSave: (code: string) => void, onCancel?: () => void) {
    if (!this.modal || !this.textarea) return;

    this.currentCallback = onSave;
    this.cancelCallback = onCancel || null;

    // Set initial values
    this.textarea.value = code;
    this.updatePreview();

    // Show modal
    this.modal.classList.add('mermaid-modal-visible');

    // Focus textarea
    setTimeout(() => {
      this.textarea?.focus();
      // Move cursor to end
      this.textarea?.setSelectionRange(
        this.textarea.value.length,
        this.textarea.value.length
      );
    }, 100);
  }

  /**
   * Save and close the modal
   */
  save() {
    if (!this.textarea || !this.currentCallback) return;

    const code = this.textarea.value;
    this.currentCallback(code);
    this.close();
  }

  /**
   * Cancel and close the modal
   */
  cancel() {
    this.cancelCallback?.();
    this.close();
  }

  /**
   * Close the modal
   */
  close() {
    if (!this.modal) return;

    this.modal.classList.remove('mermaid-modal-visible');
    this.currentCallback = null;
    this.cancelCallback = null;

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Check if modal is currently open
   */
  isOpen(): boolean {
    return this.modal?.classList.contains('mermaid-modal-visible') ?? false;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.modal?.remove();
    this.modal = null;
    this.textarea = null;
    this.preview = null;
  }
}

// Singleton instance
let modalInstance: MermaidModal | null = null;

/**
 * Get or create the modal singleton
 */
export function getMermaidModal(options?: MermaidModalOptions): MermaidModal {
  if (!modalInstance) {
    modalInstance = new MermaidModal(options);
  }
  return modalInstance;
}

/**
 * Initialize the modal (call once in app setup)
 */
export function initMermaidModal(options?: MermaidModalOptions): MermaidModal {
  return getMermaidModal(options);
}

export default MermaidModal;
