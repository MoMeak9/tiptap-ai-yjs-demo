import type { Editor } from "@tiptap/core";
import type { Comment, ICommentUI, ICommentManager, CommentReply } from "../types";

/**
 * CommentUI - Comment panel UI manager
 * Renders and manages the comment sidebar UI
 */
export class CommentUI implements ICommentUI {
  private editor: Editor;
  private commentManager: ICommentManager;
  private container: HTMLElement | null;
  private isVisible: boolean;

  constructor(editor: Editor, commentManager: ICommentManager) {
    this.editor = editor;
    this.commentManager = commentManager;
    this.container = null;
    this.isVisible = true;

    this._init();
  }

  /**
   * Initialize UI
   */
  private _init(): void {
    this._createContainer();
    this._attachEventListeners();
    this._render();
  }

  /**
   * Create comment panel container
   */
  private _createContainer(): void {
    // Check if already exists
    const existing = document.getElementById("comment-sidebar");
    if (existing) {
      this.container = existing;
      return;
    }

    this.container = document.createElement("div");
    this.container.id = "comment-sidebar";
    this.container.className = "comment-sidebar";
    this.container.innerHTML = `
      <div class="comment-sidebar-header">
        <h3>Comments</h3>
        <button class="comment-toggle-btn" title="Hide comment panel">
          <span>-</span>
        </button>
      </div>
      <div class="comment-sidebar-content">
        <div class="comment-list"></div>
      </div>
    `;

    // Insert into editor wrapper
    const editorWrapper = document.querySelector(".editor-wrapper");
    if (editorWrapper) {
      editorWrapper.appendChild(this.container);
    } else {
      document.body.appendChild(this.container);
    }
  }

  /**
   * Attach event listeners
   */
  private _attachEventListeners(): void {
    if (!this.container) return;

    // Toggle panel visibility
    const toggleBtn = this.container.querySelector(".comment-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggle());
    }

    // Listen for comment changes
    this.commentManager.onUpdate((_comments: Comment[]) => {
      this._render();
    });

    // Listen for active comment changes
    this.commentManager.onActiveUpdate((commentId: string | null) => {
      this._highlightActiveComment(commentId);
    });

    // Listen for keyboard shortcut
    window.addEventListener("add-comment-shortcut", () => {
      this.addCommentFromSelection();
    });
  }

  /**
   * Render comment list
   */
  private _render(): void {
    if (!this.container) return;

    const comments = this.commentManager.getComments();
    const listContainer = this.container.querySelector(".comment-list");

    if (!listContainer) return;

    if (comments.length === 0) {
      listContainer.innerHTML = `
        <div class="comment-empty">
          <p>No comments</p>
          <p class="comment-hint">Select text and click the comment button to add a comment</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = comments
      .map((comment) => this._renderCommentItem(comment))
      .join("");

    // Attach events for each comment item
    comments.forEach((comment) => {
      this._attachCommentEvents(comment.id);
    });
  }

  /**
   * Render a single comment item
   */
  private _renderCommentItem(comment: Comment): string {
    const isActive = this.commentManager.getActiveComment() === comment.id;
    const replies = comment.replies || [];

    return `
      <div class="comment-item ${isActive ? "active" : ""}" data-comment-id="${comment.id}">
        <div class="comment-header">
          <div class="comment-author" style="color: ${comment.authorColor}">
            <span class="comment-author-avatar" style="background-color: ${comment.authorColor}">
              ${comment.author.charAt(0).toUpperCase()}
            </span>
            <span class="comment-author-name">${this._escapeHtml(comment.author)}</span>
          </div>
          <div class="comment-actions">
            <button class="comment-locate-btn" data-comment-id="${comment.id}" title="Locate text">
              📍
            </button>
            <button class="comment-delete-btn" data-comment-id="${comment.id}" title="Delete comment">
              🗑️
            </button>
          </div>
        </div>

        <div class="comment-content">
          <textarea
            class="comment-textarea"
            data-comment-id="${comment.id}"
            placeholder="Enter comment..."
            ${isActive ? "" : "readonly"}
          >${this._escapeHtml(comment.content || "")}</textarea>
        </div>

        <div class="comment-meta">
          <span class="comment-time">${this._formatTime(comment.createdAt)}</span>
          ${comment.updatedAt ? `<span class="comment-updated">(edited)</span>` : ""}
        </div>

        ${
          replies.length > 0
            ? `
          <div class="comment-replies">
            ${replies.map((reply) => this._renderReply(comment.id, reply)).join("")}
          </div>
        `
            : ""
        }

        <div class="comment-reply-form">
          <input
            type="text"
            class="comment-reply-input"
            placeholder="Add reply..."
            data-comment-id="${comment.id}"
          />
          <button class="comment-reply-btn" data-comment-id="${comment.id}">Reply</button>
        </div>
      </div>
    `;
  }

  /**
   * Render a reply
   */
  private _renderReply(commentId: string, reply: CommentReply): string {
    return `
      <div class="comment-reply" data-reply-id="${reply.id}">
        <div class="comment-reply-header">
          <span class="comment-author" style="color: ${reply.authorColor}">
            <span class="comment-author-avatar" style="background-color: ${reply.authorColor}">
              ${reply.author.charAt(0).toUpperCase()}
            </span>
            ${this._escapeHtml(reply.author)}
          </span>
          <button class="comment-reply-delete-btn" data-comment-id="${commentId}" data-reply-id="${reply.id}" title="Delete reply">
            ×
          </button>
        </div>
        <div class="comment-reply-content">${this._escapeHtml(reply.content)}</div>
        <div class="comment-reply-time">${this._formatTime(new Date(reply.createdAt))}</div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private _escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attach events to a comment item
   */
  private _attachCommentEvents(commentId: string): void {
    if (!this.container) return;

    const commentItem = this.container.querySelector(
      `.comment-item[data-comment-id="${commentId}"]`
    );
    if (!commentItem) return;

    // Click to activate comment
    commentItem.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT"
      ) {
        return;
      }
      this._activateComment(commentId);
    });

    // Comment content change
    const textarea = commentItem.querySelector(".comment-textarea") as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.addEventListener("input", (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        this.commentManager.updateComment(commentId, target.value);
      });
    }

    // Delete comment
    const deleteBtn = commentItem.querySelector(".comment-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        this._deleteComment(commentId);
      });
    }

    // Locate text
    const locateBtn = commentItem.querySelector(".comment-locate-btn");
    if (locateBtn) {
      locateBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        this._locateComment(commentId);
      });
    }

    // Add reply
    const replyInput = commentItem.querySelector(".comment-reply-input") as HTMLInputElement | null;
    const replyBtn = commentItem.querySelector(".comment-reply-btn");
    if (replyInput && replyBtn) {
      const addReply = (): void => {
        const content = replyInput.value.trim();
        if (content) {
          this.commentManager.addReply(commentId, content);
          replyInput.value = "";
        }
      };

      replyBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        addReply();
      });

      replyInput.addEventListener("keypress", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addReply();
        }
      });
    }

    // Delete reply
    const replyDeleteBtns = commentItem.querySelectorAll(".comment-reply-delete-btn");
    replyDeleteBtns.forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const replyId = target.dataset.replyId;
        if (replyId) {
          this.commentManager.deleteReply(commentId, replyId);
        }
      });
    });
  }

  /**
   * Activate a comment
   */
  private _activateComment(commentId: string): void {
    this.commentManager.setActiveComment(commentId);
    this._highlightActiveComment(commentId);

    // Focus on the corresponding text
    this._locateComment(commentId);
  }

  /**
   * Highlight the active comment
   */
  private _highlightActiveComment(commentId: string | null): void {
    if (!this.container) return;

    // Remove all active states
    this.container
      .querySelectorAll(".comment-item.active")
      .forEach((item) => item.classList.remove("active"));

    // Add new active state
    if (commentId) {
      const activeItem = this.container.querySelector(
        `.comment-item[data-comment-id="${commentId}"]`
      );
      if (activeItem) {
        activeItem.classList.add("active");
        activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });

        // Make textarea editable
        const textarea = activeItem.querySelector(".comment-textarea") as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.removeAttribute("readonly");
          textarea.focus();
        }
      }
    }

    // Set all non-active textareas to readonly
    this.container
      .querySelectorAll(".comment-item:not(.active) .comment-textarea")
      .forEach((textarea) => {
        textarea.setAttribute("readonly", "");
      });
  }

  /**
   * Locate the text corresponding to a comment
   */
  private _locateComment(commentId: string): void {
    const { state } = this.editor;
    const { doc } = state;

    let found = false;
    let foundPos: number | null = null;

    // Find the text position containing this comment
    doc.descendants((node, pos) => {
      if (found) return false;

      const commentMark = node.marks.find(
        (mark) =>
          mark.type.name === "comment" && mark.attrs.commentId === commentId
      );

      if (commentMark) {
        found = true;
        foundPos = pos;
      }
      return true;
    });

    if (found && foundPos !== null) {
      // Scroll to position and select
      this.editor.commands.focus();
      this.editor.commands.setTextSelection(foundPos);

      // Scroll editor into view
      const editorElement = this.editor.view.dom;
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          editorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }

  /**
   * Delete a comment
   */
  private _deleteComment(commentId: string): void {
    if (confirm("Are you sure you want to delete this comment?")) {
      // Remove mark from editor
      this.editor.commands.unsetComment(commentId);

      // Delete from manager
      this.commentManager.deleteComment(commentId);

      // Clear active state if this was the active comment
      if (this.commentManager.getActiveComment() === commentId) {
        this.commentManager.clearActiveComment();
      }
    }
  }

  /**
   * Add comment from current selection
   */
  addCommentFromSelection(): void {
    const { from, to } = this.editor.state.selection;

    if (from === to) {
      alert("Please select text to comment on");
      return;
    }

    // Create new comment
    const commentId = this.commentManager.addComment("");

    // Apply comment mark
    this.editor.commands.setComment(commentId);

    // Activate the comment
    this.commentManager.setActiveComment(commentId);

    // Focus on comment input
    setTimeout(() => {
      if (!this.container) return;
      const textarea = this.container.querySelector(
        `.comment-item[data-comment-id="${commentId}"] .comment-textarea`
      ) as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  /**
   * Format time for display
   */
  private _formatTime(date: Date | null): string {
    if (!date) return "";

    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60 * 1000) {
      return "Just now";
    }

    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}m ago`;
    }

    // Less than 1 day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}h ago`;
    }

    // Show date
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Toggle panel visibility
   */
  toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.container) {
      this.container.classList.toggle("collapsed", !this.isVisible);
    }

    const toggleBtn = this.container?.querySelector(".comment-toggle-btn span");
    if (toggleBtn) {
      toggleBtn.textContent = this.isVisible ? "-" : "+";
    }
  }

  /**
   * Show the panel
   */
  show(): void {
    this.isVisible = true;
    if (this.container) {
      this.container.classList.remove("collapsed");
    }
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.classList.add("collapsed");
    }
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

export default CommentUI;
