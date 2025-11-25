/**
 * CommentUI - 评论界面管理
 * 负责渲染和管理评论面板UI
 */
export class CommentUI {
  constructor(editor, commentManager) {
    this.editor = editor;
    this.commentManager = commentManager;
    this.container = null;
    this.isVisible = true;

    this._init();
  }

  /**
   * 初始化UI
   */
  _init() {
    this._createContainer();
    this._attachEventListeners();
    this._render();
  }

  /**
   * 创建评论面板容器
   */
  _createContainer() {
    // 检查是否已存在
    let existing = document.getElementById("comment-sidebar");
    if (existing) {
      this.container = existing;
      return;
    }

    this.container = document.createElement("div");
    this.container.id = "comment-sidebar";
    this.container.className = "comment-sidebar";
    this.container.innerHTML = `
      <div class="comment-sidebar-header">
        <h3>💬 评论</h3>
        <button class="comment-toggle-btn" title="隐藏评论面板">
          <span>−</span>
        </button>
      </div>
      <div class="comment-sidebar-content">
        <div class="comment-list"></div>
      </div>
    `;

    // 插入到编辑器包装器中
    const editorWrapper = document.querySelector(".editor-wrapper");
    if (editorWrapper) {
      editorWrapper.appendChild(this.container);
    } else {
      document.body.appendChild(this.container);
    }
  }

  /**
   * 附加事件监听器
   */
  _attachEventListeners() {
    // 切换面板显示/隐藏
    const toggleBtn = this.container.querySelector(".comment-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggle());
    }

    // 监听评论变化
    this.commentManager.onUpdate((comments) => {
      this._render();
    });

    // 监听激活评论变化
    this.commentManager.onActiveUpdate((commentId) => {
      this._highlightActiveComment(commentId);
    });

    // 监听快捷键添加评论
    window.addEventListener("add-comment-shortcut", () => {
      this.addCommentFromSelection();
    });
  }

  /**
   * 渲染评论列表
   */
  _render() {
    const comments = this.commentManager.getComments();
    const listContainer = this.container.querySelector(".comment-list");

    if (!listContainer) return;

    if (comments.length === 0) {
      listContainer.innerHTML = `
        <div class="comment-empty">
          <p>暂无评论</p>
          <p class="comment-hint">选中文本后点击工具栏的评论按钮添加评论</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = comments
      .map((comment) => this._renderCommentItem(comment))
      .join("");

    // 为每个评论项附加事件
    comments.forEach((comment) => {
      this._attachCommentEvents(comment.id);
    });
  }

  /**
   * 渲染单个评论项
   */
  _renderCommentItem(comment) {
    const isActive = this.commentManager.getActiveComment() === comment.id;
    const replies = comment.replies || [];

    return `
      <div class="comment-item ${isActive ? "active" : ""}" data-comment-id="${
      comment.id
    }">
        <div class="comment-header">
          <div class="comment-author" style="color: ${comment.authorColor}">
            <span class="comment-author-avatar" style="background-color: ${
              comment.authorColor
            }">
              ${comment.author.charAt(0).toUpperCase()}
            </span>
            <span class="comment-author-name">${comment.author}</span>
          </div>
          <div class="comment-actions">
            <button class="comment-locate-btn" data-comment-id="${
              comment.id
            }" title="定位到文本">
              📍
            </button>
            <button class="comment-delete-btn" data-comment-id="${
              comment.id
            }" title="删除评论">
              🗑️
            </button>
          </div>
        </div>
        
        <div class="comment-content">
          <textarea 
            class="comment-textarea" 
            data-comment-id="${comment.id}"
            placeholder="输入评论内容..."
            ${isActive ? "" : "readonly"}
          >${comment.content || ""}</textarea>
        </div>

        <div class="comment-meta">
          <span class="comment-time">${this._formatTime(
            comment.createdAt
          )}</span>
          ${
            comment.updatedAt
              ? `<span class="comment-updated">(已编辑)</span>`
              : ""
          }
        </div>

        ${
          replies.length > 0
            ? `
          <div class="comment-replies">
            ${replies.map((reply) => this._renderReply(reply)).join("")}
          </div>
        `
            : ""
        }

        <div class="comment-reply-form">
          <input 
            type="text" 
            class="comment-reply-input" 
            placeholder="添加回复..."
            data-comment-id="${comment.id}"
          />
          <button class="comment-reply-btn" data-comment-id="${
            comment.id
          }">回复</button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染回复
   */
  _renderReply(reply) {
    return `
      <div class="comment-reply" data-reply-id="${reply.id}">
        <div class="comment-reply-header">
          <span class="comment-author" style="color: ${reply.authorColor}">
            <span class="comment-author-avatar" style="background-color: ${
              reply.authorColor
            }">
              ${reply.author.charAt(0).toUpperCase()}
            </span>
            ${reply.author}
          </span>
          <button class="comment-reply-delete-btn" data-reply-id="${
            reply.id
          }" title="删除回复">
            ×
          </button>
        </div>
        <div class="comment-reply-content">${reply.content}</div>
        <div class="comment-reply-time">${this._formatTime(
          new Date(reply.createdAt)
        )}</div>
      </div>
    `;
  }

  /**
   * 为评论项附加事件
   */
  _attachCommentEvents(commentId) {
    const commentItem = this.container.querySelector(
      `.comment-item[data-comment-id="${commentId}"]`
    );
    if (!commentItem) return;

    // 点击评论项激活
    commentItem.addEventListener("click", (e) => {
      if (
        e.target.tagName === "BUTTON" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "INPUT"
      ) {
        return;
      }
      this._activateComment(commentId);
    });

    // 评论内容变化
    const textarea = commentItem.querySelector(".comment-textarea");
    if (textarea) {
      textarea.addEventListener("input", (e) => {
        this.commentManager.updateComment(commentId, e.target.value);
      });
    }

    // 删除评论
    const deleteBtn = commentItem.querySelector(".comment-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._deleteComment(commentId);
      });
    }

    // 定位到文本
    const locateBtn = commentItem.querySelector(".comment-locate-btn");
    if (locateBtn) {
      locateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._locateComment(commentId);
      });
    }

    // 添加回复
    const replyInput = commentItem.querySelector(".comment-reply-input");
    const replyBtn = commentItem.querySelector(".comment-reply-btn");
    if (replyInput && replyBtn) {
      const addReply = () => {
        const content = replyInput.value.trim();
        if (content) {
          this.commentManager.addReply(commentId, content);
          replyInput.value = "";
        }
      };

      replyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        addReply();
      });

      replyInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addReply();
        }
      });
    }

    // 删除回复
    const replyDeleteBtns = commentItem.querySelectorAll(
      ".comment-reply-delete-btn"
    );
    replyDeleteBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const replyId = btn.dataset.replyId;
        this.commentManager.deleteReply(commentId, replyId);
      });
    });
  }

  /**
   * 激活评论
   */
  _activateComment(commentId) {
    this.commentManager.setActiveComment(commentId);
    this._highlightActiveComment(commentId);

    // 聚焦到对应文本
    this._locateComment(commentId);
  }

  /**
   * 高亮激活的评论
   */
  _highlightActiveComment(commentId) {
    // 移除所有激活状态
    this.container
      .querySelectorAll(".comment-item.active")
      .forEach((item) => item.classList.remove("active"));

    // 添加新的激活状态
    if (commentId) {
      const activeItem = this.container.querySelector(
        `.comment-item[data-comment-id="${commentId}"]`
      );
      if (activeItem) {
        activeItem.classList.add("active");
        activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });

        // 使 textarea 可编辑
        const textarea = activeItem.querySelector(".comment-textarea");
        if (textarea) {
          textarea.removeAttribute("readonly");
          textarea.focus();
        }
      }
    }

    // 设置所有非激活的 textarea 为只读
    this.container
      .querySelectorAll(".comment-item:not(.active) .comment-textarea")
      .forEach((textarea) => {
        textarea.setAttribute("readonly", "");
      });
  }

  /**
   * 定位到评论对应的文本
   */
  _locateComment(commentId) {
    const { state } = this.editor;
    const { doc } = state;

    let found = false;
    let foundPos = null;

    // 查找包含该评论的文本位置
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
    });

    if (found && foundPos !== null) {
      // 滚动到该位置并选中
      this.editor.commands.focus();
      this.editor.commands.setTextSelection(foundPos);

      // 滚动编辑器到可见区域
      const editorElement = this.editor.view.dom;
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          editorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }

  /**
   * 删除评论
   */
  _deleteComment(commentId) {
    if (confirm("确定要删除这条评论吗?")) {
      // 从编辑器中移除标记
      this.editor.commands.unsetComment(commentId);

      // 从管理器中删除
      this.commentManager.deleteComment(commentId);

      // 如果是当前激活的评论,清除激活状态
      if (this.commentManager.getActiveComment() === commentId) {
        this.commentManager.clearActiveComment();
      }
    }
  }

  /**
   * 从选区添加评论
   */
  addCommentFromSelection() {
    const { from, to } = this.editor.state.selection;

    if (from === to) {
      alert("请先选择要评论的文本");
      return;
    }

    // 创建新评论
    const commentId = this.commentManager.addComment("");

    // 应用评论标记
    this.editor.commands.setComment(commentId);

    // 激活该评论
    this.commentManager.setActiveComment(commentId);

    // 聚焦到评论输入框
    setTimeout(() => {
      const textarea = this.container.querySelector(
        `.comment-item[data-comment-id="${commentId}"] .comment-textarea`
      );
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  /**
   * 格式化时间
   */
  _formatTime(date) {
    if (!date) return "";

    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60 * 1000) {
      return "刚刚";
    }

    // 小于1小时
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}分钟前`;
    }

    // 小于1天
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}小时前`;
    }

    // 显示日期
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * 切换显示/隐藏
   */
  toggle() {
    this.isVisible = !this.isVisible;
    this.container.classList.toggle("collapsed", !this.isVisible);

    const toggleBtn = this.container.querySelector(".comment-toggle-btn span");
    if (toggleBtn) {
      toggleBtn.textContent = this.isVisible ? "−" : "+";
    }
  }

  /**
   * 显示面板
   */
  show() {
    this.isVisible = true;
    this.container.classList.remove("collapsed");
  }

  /**
   * 隐藏面板
   */
  hide() {
    this.isVisible = false;
    this.container.classList.add("collapsed");
  }

  /**
   * 销毁UI
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default CommentUI;
