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

// ============================================
// Suggestion Types (AI Diff)
// ============================================

/**
 * Suggestion type - add or delete
 */
export type SuggestionType = "add" | "delete";

/**
 * Suggestion status
 */
export type SuggestionStatus = "pending" | "accepted" | "rejected";

/**
 * Individual suggestion item
 */
export interface SuggestionItem {
  diffId: string;
  groupId: string;
  type: SuggestionType;
  text: string;
  from: number;
  to: number;
  status: SuggestionStatus;
}

/**
 * Group of suggestions from one AI operation
 */
export interface SuggestionGroup {
  groupId: string;
  suggestions: SuggestionItem[];
  createdAt: string;
  status: "pending" | "partial" | "resolved";
}

/**
 * Suggestion extension options
 */
export interface SuggestionOptions {
  HTMLAttributes: Record<string, string>;
  onSuggestionActivated: (diffId: string | null) => void;
}

/**
 * Suggestion extension storage
 */
export interface SuggestionStorage {
  activeDiffId: string | null;
}

/**
 * Suggestion mark attributes
 */
export interface SuggestionAttributes {
  type: SuggestionType;
  diffId: string | null;
  groupId: string | null;
}

/**
 * Suggestion manager callback type
 */
export type SuggestionsChangedCallback = (suggestions: SuggestionItem[]) => void;

/**
 * Suggestion manager interface
 */
export interface ISuggestionManager {
  registerGroup(groupId: string): void;
  getAllSuggestions(): SuggestionItem[];
  getCurrentGroupSuggestions(): SuggestionItem[];
  getCurrentSuggestion(): SuggestionItem | null;
  getProgress(): { current: number; total: number; pending: number };
  hasPendingSuggestions(): boolean;
  acceptCurrent(): boolean;
  rejectCurrent(): boolean;
  acceptAll(): void;
  rejectAll(): void;
  nextSuggestion(): void;
  prevSuggestion(): void;
  onChange(callback: SuggestionsChangedCallback): void;
  getCurrentGroupId(): string | null;
  clear(): void;
  destroy(): void;
}

/**
 * Suggestion UI interface
 */
export interface ISuggestionUI {
  show(): void;
  hide(): void;
  toggle(): void;
  getIsVisible(): boolean;
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
    suggestion: {
      applyAISuggestion: (
        originalText: string,
        aiText: string,
        from: number,
        to: number,
        groupId?: string
      ) => ReturnType;
      acceptSuggestion: (diffId: string) => ReturnType;
      rejectSuggestion: (diffId: string) => ReturnType;
      acceptAllSuggestions: (groupId?: string) => ReturnType;
      rejectAllSuggestions: (groupId?: string) => ReturnType;
      clearAllSuggestions: () => ReturnType;
    };
  }
}
