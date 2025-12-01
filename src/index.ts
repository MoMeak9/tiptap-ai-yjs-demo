// Core extensions - Comments
export { Comment } from "./extensions/comment";
export { CommentManager } from "./extensions/commentManager";
export { CommentUI } from "./extensions/commentUI";

// Core extensions - AI Suggestions
export { Suggestion } from "./extensions/suggestion";
export { SuggestionManager } from "./extensions/suggestionManager";
export { SuggestionUI } from "./extensions/suggestionUI";

// Types - Comments
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

// Types - Suggestions
export type {
  SuggestionType,
  SuggestionStatus,
  SuggestionItem,
  SuggestionGroup,
  SuggestionOptions,
  SuggestionStorage,
  SuggestionAttributes,
  SuggestionsChangedCallback,
  ISuggestionManager,
  ISuggestionUI,
} from "./types";

// Default export
export { Comment as default } from "./extensions/comment";
