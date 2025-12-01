import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Comment } from "./extensions/comment";
import { CommentManager } from "./extensions/commentManager";
import { CommentUI } from "./extensions/commentUI";
import type { User } from "./types";

// Random color generator
const getRandomColor = (): string => {
  const colors = [
    "#958DF1",
    "#F98181",
    "#FBBC88",
    "#FAF594",
    "#70CFF8",
    "#94FADB",
    "#B9F18D",
    "#FF6B9D",
    "#7C3AED",
    "#DB2777",
    "#EA580C",
    "#CA8A04",
    "#16A34A",
    "#0891B2",
    "#2563EB",
    "#4F46E5",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Random username generator
const getRandomName = (): string => {
  const adjectives = [
    "Happy",
    "Smart",
    "Brave",
    "Friendly",
    "Active",
    "Gentle",
  ];
  const nouns = ["Panda", "Fox", "Rabbit", "Cat", "Bird", "Dolphin"];
  return (
    adjectives[Math.floor(Math.random() * adjectives.length)] +
    " " +
    nouns[Math.floor(Math.random() * nouns.length)]
  );
};

// User state
let currentUser: User = {
  name: getRandomName(),
  color: getRandomColor(),
};

// Restore user info from localStorage
const savedUser = localStorage.getItem("tiptap-user");
if (savedUser) {
  currentUser = JSON.parse(savedUser) as User;
}

// Initialize Y.js document
const ydoc = new Y.Doc();

// Connect to WebSocket server
const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "tiptap-collaboration-demo",
  ydoc
);

// Set awareness state
provider.awareness.setLocalStateField("user", currentUser);

// Create comment manager
const commentManager = new CommentManager(ydoc, provider);

// Create editor
const editor = new Editor({
  element: document.querySelector("#editor") as HTMLElement,
  extensions: [
    StarterKit,
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCaret.configure({
      provider: provider,
      user: currentUser,
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "tiptap-link",
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: "tiptap-image",
      },
    }),
    Placeholder.configure({
      placeholder: "Start typing... Supports real-time collaboration ✨",
    }),
    CharacterCount,
    TextStyle,
    Color,
    Comment.configure({
      HTMLAttributes: {
        class: "tiptap-comment",
      },
      onCommentActivated: (commentId: string | null) => {
        commentManager.setActiveComment(commentId);
      },
    }),
  ],
  content: "",
  onUpdate: ({ editor }) => {
    updateCharacterCount(editor);
  },
  onCreate: ({ editor }) => {
    // Set initial content (only if document is empty)
    if (editor.isEmpty) {
      editor.commands.setContent(`
        <h1>Welcome to Tiptap Collaborative Editor! 🎉</h1>
        <p>This is a real-time collaborative editor demo using <strong>Tiptap 3</strong> and <strong>Yjs</strong>.</p>

        <h2>Features:</h2>
        <ul>
          <li>✨ Real-time multi-user collaboration</li>
          <li>🎨 Rich text formatting support</li>
          <li>👥 Online user cursor tracking</li>
          <li>🔗 Links, images, and media support</li>
          <li>📝 Character and word count</li>
          <li>💬 Collaborative comments</li>
        </ul>

        <h2>How to test collaboration?</h2>
        <ol>
          <li>Open this page in multiple browser tabs</li>
          <li>Type content in any tab</li>
          <li>Watch other tabs sync in real-time</li>
          <li>Select text and click the comment button to add comments</li>
        </ol>

        <blockquote>
          💡 Tip: You can see other users' cursor positions and selections!
        </blockquote>

        <p>Try typing something below!</p>
      `);
    }
    updateCharacterCount(editor);
  },
});

// Initialize comment UI
const commentUI = new CommentUI(editor, commentManager);

// Update character count
function updateCharacterCount(editorInstance: Editor): void {
  const storage = editorInstance.storage.characterCount as {
    characters: () => number;
    words: () => number;
  };
  const characters = storage.characters();
  const words = storage.words();
  const countEl = document.getElementById("character-count");
  if (countEl) {
    countEl.textContent = `Characters: ${characters} / Words: ${words}`;
  }
}

// Toolbar event handling
const toolbar = document.getElementById("toolbar");
if (toolbar) {
  toolbar.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const level = button.dataset.level;

    switch (action) {
      case "bold":
        editor.chain().focus().toggleBold().run();
        break;
      case "italic":
        editor.chain().focus().toggleItalic().run();
        break;
      case "strike":
        editor.chain().focus().toggleStrike().run();
        break;
      case "code":
        editor.chain().focus().toggleCode().run();
        break;
      case "heading":
        if (level) {
          editor
            .chain()
            .focus()
            .toggleHeading({ level: parseInt(level) as 1 | 2 | 3 | 4 | 5 | 6 })
            .run();
        }
        break;
      case "paragraph":
        editor.chain().focus().setParagraph().run();
        break;
      case "bulletList":
        editor.chain().focus().toggleBulletList().run();
        break;
      case "orderedList":
        editor.chain().focus().toggleOrderedList().run();
        break;
      case "blockquote":
        editor.chain().focus().toggleBlockquote().run();
        break;
      case "codeBlock":
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case "highlight":
        editor.chain().focus().toggleHighlight().run();
        break;
      case "link":
        setLink();
        break;
      case "image":
        setImage();
        break;
      case "undo":
        editor.chain().focus().undo().run();
        break;
      case "redo":
        editor.chain().focus().redo().run();
        break;
      case "clear":
        editor.chain().focus().clearNodes().unsetAllMarks().run();
        break;
      case "comment":
        commentUI.addCommentFromSelection();
        break;
    }

    updateToolbarState();
  });
}

// Update toolbar button states
function updateToolbarState(): void {
  document.querySelectorAll("#toolbar button").forEach((button) => {
    const btn = button as HTMLButtonElement;
    const action = btn.dataset.action;
    const level = btn.dataset.level;

    if (action === "heading" && level) {
      btn.classList.toggle(
        "is-active",
        editor.isActive("heading", { level: parseInt(level) })
      );
    } else if (
      action &&
      action !== "link" &&
      action !== "image" &&
      action !== "undo" &&
      action !== "redo" &&
      action !== "clear"
    ) {
      btn.classList.toggle("is-active", editor.isActive(action));
    }
  });
}

// Set link
function setLink(): void {
  const previousUrl = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Enter link URL:", previousUrl);

  if (url === null) {
    return;
  }

  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

// Insert image
function setImage(): void {
  const url = window.prompt("Enter image URL:");

  if (url) {
    editor.chain().focus().setImage({ src: url }).run();
  }
}

// Listen for editor selection changes
editor.on("selectionUpdate", () => {
  updateToolbarState();
});

// Username input
const usernameInput = document.getElementById("username") as HTMLInputElement | null;
if (usernameInput) {
  usernameInput.value = currentUser.name;

  usernameInput.addEventListener("change", (e: Event) => {
    const target = e.target as HTMLInputElement;
    currentUser.name = target.value || getRandomName();
    provider.awareness.setLocalStateField("user", currentUser);
    localStorage.setItem("tiptap-user", JSON.stringify(currentUser));
  });
}

// Change color button
const changeColorBtn = document.getElementById("change-color");
if (changeColorBtn) {
  changeColorBtn.addEventListener("click", () => {
    currentUser.color = getRandomColor();
    provider.awareness.setLocalStateField("user", currentUser);
    localStorage.setItem("tiptap-user", JSON.stringify(currentUser));
  });
}

// Listen for connection status
provider.on("status", ({ status }: { status: string }) => {
  const statusEl = document.getElementById("connection-status");
  if (!statusEl) return;

  if (status === "connected") {
    statusEl.textContent = "Connected";
    statusEl.className = "status-connected";
  } else if (status === "disconnected") {
    statusEl.textContent = "Disconnected";
    statusEl.className = "status-disconnected";
  } else {
    statusEl.textContent = "Connecting...";
    statusEl.className = "status-connecting";
  }
});

// Listen for online user changes
provider.awareness.on("change", () => {
  const states = Array.from(provider.awareness.getStates().values()) as Array<{ user?: User }>;
  const userCount = states.length;

  const countEl = document.getElementById("user-count");
  if (countEl) {
    countEl.textContent = `Online users: ${userCount}`;
  }

  // Update user list
  const usersContainer = document.getElementById("users-container");
  if (usersContainer) {
    usersContainer.innerHTML = states
      .map((state, index) => {
        const user = state.user ?? { name: `User ${index + 1}`, color: "#999" };
        return `
        <div class="user-item">
          <div class="user-color" style="background-color: ${user.color}"></div>
          <div class="user-name">${user.name}</div>
        </div>
      `;
      })
      .join("");
  }
});

// Initial toolbar state
updateToolbarState();

// Cleanup resources
window.addEventListener("beforeunload", () => {
  commentManager.destroy();
  commentUI.destroy();
  provider.destroy();
  editor.destroy();
});

console.log("✨ Tiptap Collaborative Editor started!");
console.log("📡 WebSocket Provider:", provider);
console.log("👤 Current user:", currentUser);
