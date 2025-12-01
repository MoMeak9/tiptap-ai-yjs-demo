// Core extensions
export { Comment } from "./extensions/comment";
export { CommentManager } from "./extensions/commentManager";
export { CommentUI } from "./extensions/commentUI";

// Types
export type {
  User,
  CommentReply,
  CommentData,
  Comment as CommentType,
  CommentOptions,
  CommentStorage,
  CommentAttributes,
  CommentsChangedCallback,
  ActiveCommentChangedCallback,
  ICommentManager,
  ICommentUI,
} from "./types";

// Default export
export { Comment as default } from "./extensions/comment";
