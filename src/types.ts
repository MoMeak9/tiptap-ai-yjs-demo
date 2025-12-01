/**
 * User information for collaborative editing
 */
export interface User {
  name: string;
  color: string;
}

/**
 * Reply to a comment
 */
export interface CommentReply {
  id: string;
  content: string;
  author: string;
  authorColor: string;
  createdAt: string;
}

/**
 * Comment data stored in Yjs
 */
export interface CommentData {
  content: string;
  author: string;
  authorColor: string;
  createdAt: string;
  updatedAt: string | null;
  replies: CommentReply[];
}

/**
 * Comment with parsed dates
 */
export interface Comment extends Omit<CommentData, "createdAt" | "updatedAt"> {
  id: string;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Comment extension options
 */
export interface CommentOptions {
  HTMLAttributes: Record<string, string>;
  onCommentActivated: (commentId: string | null) => void;
}

/**
 * Comment extension storage
 */
export interface CommentStorage {
  activeCommentId: string | null;
}

/**
 * Comment mark attributes
 */
export interface CommentAttributes {
  commentId: string | null;
}

/**
 * Comment manager callback types
 */
export type CommentsChangedCallback = (comments: Comment[]) => void;
export type ActiveCommentChangedCallback = (commentId: string | null) => void;

/**
 * Comment manager interface
 */
export interface ICommentManager {
  addComment(content?: string): string;
  updateComment(commentId: string, content: string): boolean;
  deleteComment(commentId: string): boolean;
  addReply(commentId: string, content: string): string | false;
  deleteReply(commentId: string, replyId: string): boolean;
  getComments(): Comment[];
  getComment(commentId: string): Comment | undefined;
  setActiveComment(commentId: string | null): void;
  getActiveComment(): string | null;
  clearActiveComment(): void;
  onUpdate(callback: CommentsChangedCallback): void;
  onActiveUpdate(callback: ActiveCommentChangedCallback): void;
  destroy(): void;
}

/**
 * Comment UI interface
 */
export interface ICommentUI {
  addCommentFromSelection(): void;
  toggle(): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

/**
 * Declare module augmentation for Editor commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType;
      unsetComment: (commentId: string) => ReturnType;
      toggleComment: (commentId: string) => ReturnType;
    };
  }
}
