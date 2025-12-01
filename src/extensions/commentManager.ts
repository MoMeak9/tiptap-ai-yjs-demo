import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import type {
  User,
  Comment,
  CommentData,
  CommentReply,
  CommentsChangedCallback,
  ActiveCommentChangedCallback,
  ICommentManager,
} from "../types";

/**
 * CommentManager - Comment data manager with Yjs integration
 * Manages comment data and syncs across collaborative sessions
 */
export class CommentManager implements ICommentManager {
  private ydoc: Y.Doc;
  private provider: WebsocketProvider;
  private commentsMap: Y.Map<CommentData>;
  private comments: Comment[];
  private activeCommentId: string | null;
  private onCommentsChanged: CommentsChangedCallback | null;
  private onActiveCommentChanged: ActiveCommentChangedCallback | null;
  private boundHandleChange: (event: Y.YMapEvent<CommentData>) => void;

  constructor(ydoc: Y.Doc, provider: WebsocketProvider) {
    this.ydoc = ydoc;
    this.provider = provider;

    // Use Yjs Map for collaborative comment storage
    this.commentsMap = ydoc.getMap<CommentData>("comments");

    // Local comment cache
    this.comments = [];

    // Currently active comment ID
    this.activeCommentId = null;

    // Callbacks
    this.onCommentsChanged = null;
    this.onActiveCommentChanged = null;

    // Bind the handler to preserve context
    this.boundHandleChange = this._handleCommentsMapChange.bind(this);

    // Observe Yjs Map changes
    this.commentsMap.observe(this.boundHandleChange);

    // Load existing comments
    this._loadComments();
  }

  /**
   * Handle Yjs Map changes
   */
  private _handleCommentsMapChange(_event: Y.YMapEvent<CommentData>): void {
    this._loadComments();

    if (this.onCommentsChanged) {
      this.onCommentsChanged(this.comments);
    }
  }

  /**
   * Load comments from Yjs Map
   */
  private _loadComments(): void {
    this.comments = [];
    this.commentsMap.forEach((value: CommentData, key: string) => {
      this.comments.push({
        id: key,
        ...value,
        createdAt: new Date(value.createdAt),
        updatedAt: value.updatedAt ? new Date(value.updatedAt) : null,
      });
    });

    // Sort by creation time
    this.comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Generate unique comment ID
   */
  private _generateCommentId(): string {
    // Use timestamp and random string for unique ID
    // 'c' prefix ensures valid HTML ID
    return `c${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get current user info from awareness
   */
  private _getCurrentUser(): User {
    const awarenessStates = this.provider.awareness.getStates();
    const clientId = this.provider.awareness.clientID;
    const userState = awarenessStates.get(clientId) as { user?: User } | undefined;

    return (
      userState?.user ?? {
        name: "Anonymous",
        color: "#999999",
      }
    );
  }

  /**
   * Add a new comment
   */
  addComment(content: string = ""): string {
    const user = this._getCurrentUser();
    const commentId = this._generateCommentId();

    const comment: CommentData = {
      content,
      author: user.name,
      authorColor: user.color,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      replies: [],
    };

    // Use Yjs transaction for atomicity
    this.ydoc.transact(() => {
      this.commentsMap.set(commentId, comment);
    });

    return commentId;
  }

  /**
   * Update comment content
   */
  updateComment(commentId: string, content: string): boolean {
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
   * Delete a comment
   */
  deleteComment(commentId: string): boolean {
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
   * Add a reply to a comment
   */
  addReply(commentId: string, content: string): string | false {
    const comment = this.commentsMap.get(commentId);
    if (!comment) {
      console.error("Comment not found:", commentId);
      return false;
    }

    const user = this._getCurrentUser();
    const replyId = this._generateCommentId();

    const reply: CommentReply = {
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
   * Delete a reply
   */
  deleteReply(commentId: string, replyId: string): boolean {
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
   * Get all comments
   */
  getComments(): Comment[] {
    return this.comments;
  }

  /**
   * Get a single comment
   */
  getComment(commentId: string): Comment | undefined {
    return this.comments.find((c) => c.id === commentId);
  }

  /**
   * Set the active comment
   */
  setActiveComment(commentId: string | null): void {
    if (this.activeCommentId !== commentId) {
      this.activeCommentId = commentId;
      if (this.onActiveCommentChanged) {
        this.onActiveCommentChanged(commentId);
      }
    }
  }

  /**
   * Get the active comment ID
   */
  getActiveComment(): string | null {
    return this.activeCommentId;
  }

  /**
   * Clear the active comment
   */
  clearActiveComment(): void {
    this.setActiveComment(null);
  }

  /**
   * Set comments changed callback
   */
  onUpdate(callback: CommentsChangedCallback): void {
    this.onCommentsChanged = callback;
  }

  /**
   * Set active comment changed callback
   */
  onActiveUpdate(callback: ActiveCommentChangedCallback): void {
    this.onActiveCommentChanged = callback;
  }

  /**
   * Destroy the manager and clean up
   */
  destroy(): void {
    this.commentsMap.unobserve(this.boundHandleChange);
    this.comments = [];
    this.activeCommentId = null;
    this.onCommentsChanged = null;
    this.onActiveCommentChanged = null;
  }
}

export default CommentManager;
