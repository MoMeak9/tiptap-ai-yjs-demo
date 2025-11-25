import * as Y from "yjs";

/**
 * CommentManager - 评论管理器
 * 负责管理评论数据,并与 Yjs 集成实现多人协同
 */
export class CommentManager {
  constructor(ydoc, provider) {
    this.ydoc = ydoc;
    this.provider = provider;

    // 使用 Yjs Map 存储评论数据,实现多人协同
    this.commentsMap = ydoc.getMap("comments");

    // 本地评论列表缓存
    this.comments = [];

    // 当前激活的评论ID
    this.activeCommentId = null;

    // 回调函数
    this.onCommentsChanged = null;
    this.onActiveCommentChanged = null;

    // 监听 Yjs Map 变化
    this.commentsMap.observe(this._handleCommentsMapChange.bind(this));

    // 初始化加载现有评论
    this._loadComments();
  }

  /**
   * 处理 Yjs Map 变化
   */
  _handleCommentsMapChange(event) {
    this._loadComments();

    if (this.onCommentsChanged) {
      this.onCommentsChanged(this.comments);
    }
  }

  /**
   * 从 Yjs Map 加载评论
   */
  _loadComments() {
    this.comments = [];
    this.commentsMap.forEach((value, key) => {
      this.comments.push({
        id: key,
        ...value,
        createdAt: new Date(value.createdAt),
        updatedAt: value.updatedAt ? new Date(value.updatedAt) : null,
      });
    });

    // 按创建时间排序
    this.comments.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * 生成唯一的评论ID
   */
  _generateCommentId() {
    // 使用时间戳和随机数生成唯一ID
    // 添加 'c' 前缀确保ID是有效的HTML ID
    return `c${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取当前用户信息
   */
  _getCurrentUser() {
    const awarenessStates = this.provider.awareness.getStates();
    const clientId = this.provider.awareness.clientID;
    const userState = awarenessStates.get(clientId);

    return (
      userState?.user || {
        name: "匿名用户",
        color: "#999999",
      }
    );
  }

  /**
   * 添加新评论
   */
  addComment(content = "") {
    const user = this._getCurrentUser();
    const commentId = this._generateCommentId();

    const comment = {
      content,
      author: user.name,
      authorColor: user.color,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      replies: [],
    };

    // 使用 Yjs 事务更新,确保原子性
    this.ydoc.transact(() => {
      this.commentsMap.set(commentId, comment);
    });

    return commentId;
  }

  /**
   * 更新评论内容
   */
  updateComment(commentId, content) {
    const comment = this.commentsMap.get(commentId);
    if (!comment) {
      console.error("Comment not found:", commentId);
      return false;
    }

    this.ydoc.transact(() => {
      this.commentsMap.set(commentId, {
        ...comment,
        content,
        updatedAt: new Date().toISOString(),
      });
    });

    return true;
  }

  /**
   * 删除评论
   */
  deleteComment(commentId) {
    if (!this.commentsMap.has(commentId)) {
      console.error("Comment not found:", commentId);
      return false;
    }

    this.ydoc.transact(() => {
      this.commentsMap.delete(commentId);
    });

    return true;
  }

  /**
   * 添加回复
   */
  addReply(commentId, content) {
    const comment = this.commentsMap.get(commentId);
    if (!comment) {
      console.error("Comment not found:", commentId);
      return false;
    }

    const user = this._getCurrentUser();
    const replyId = this._generateCommentId();

    const reply = {
      id: replyId,
      content,
      author: user.name,
      authorColor: user.color,
      createdAt: new Date().toISOString(),
    };

    this.ydoc.transact(() => {
      const updatedReplies = [...(comment.replies || []), reply];
      this.commentsMap.set(commentId, {
        ...comment,
        replies: updatedReplies,
        updatedAt: new Date().toISOString(),
      });
    });

    return replyId;
  }

  /**
   * 删除回复
   */
  deleteReply(commentId, replyId) {
    const comment = this.commentsMap.get(commentId);
    if (!comment) {
      console.error("Comment not found:", commentId);
      return false;
    }

    this.ydoc.transact(() => {
      const updatedReplies = (comment.replies || []).filter(
        (r) => r.id !== replyId
      );
      this.commentsMap.set(commentId, {
        ...comment,
        replies: updatedReplies,
        updatedAt: new Date().toISOString(),
      });
    });

    return true;
  }

  /**
   * 获取所有评论
   */
  getComments() {
    return this.comments;
  }

  /**
   * 获取单个评论
   */
  getComment(commentId) {
    return this.comments.find((c) => c.id === commentId);
  }

  /**
   * 设置激活的评论
   */
  setActiveComment(commentId) {
    if (this.activeCommentId !== commentId) {
      this.activeCommentId = commentId;
      if (this.onActiveCommentChanged) {
        this.onActiveCommentChanged(commentId);
      }
    }
  }

  /**
   * 获取激活的评论
   */
  getActiveComment() {
    return this.activeCommentId;
  }

  /**
   * 清除激活的评论
   */
  clearActiveComment() {
    this.setActiveComment(null);
  }

  /**
   * 设置评论变化回调
   */
  onUpdate(callback) {
    this.onCommentsChanged = callback;
  }

  /**
   * 设置激活评论变化回调
   */
  onActiveUpdate(callback) {
    this.onActiveCommentChanged = callback;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.commentsMap.unobserve(this._handleCommentsMapChange);
    this.comments = [];
    this.activeCommentId = null;
    this.onCommentsChanged = null;
    this.onActiveCommentChanged = null;
  }
}

export default CommentManager;
