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

// 生成随机颜色
const getRandomColor = () => {
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

// 生成随机用户名
const getRandomName = () => {
  const adjectives = [
    "快乐的",
    "聪明的",
    "勇敢的",
    "友好的",
    "活泼的",
    "温柔的",
  ];
  const nouns = ["熊猫", "狐狸", "兔子", "猫咪", "小鸟", "海豚"];
  return (
    adjectives[Math.floor(Math.random() * adjectives.length)] +
    nouns[Math.floor(Math.random() * nouns.length)]
  );
};

// 用户状态
let currentUser = {
  name: getRandomName(),
  color: getRandomColor(),
};

// 从localStorage恢复用户信息
const savedUser = localStorage.getItem("tiptap-user");
if (savedUser) {
  currentUser = JSON.parse(savedUser);
}

// 初始化Y.js文档
const ydoc = new Y.Doc();

// 连接到WebSocket服务器
const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "tiptap-collaboration-demo",
  ydoc
);

// 设置awareness状态
provider.awareness.setLocalStateField("user", currentUser);

// 创建编辑器
const editor = new Editor({
  element: document.querySelector("#editor"),
  extensions: [
    StarterKit.configure({
      // 禁用默认的History扩展，因为协作模式使用Yjs的历史记录
      history: false,
    }),
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
      placeholder: "开始输入内容... 支持多人协作编辑 ✨",
    }),
    CharacterCount,
    TextStyle,
    Color,
  ],
  content: "",
  onUpdate: ({ editor }) => {
    updateCharacterCount(editor);
  },
  onCreate: ({ editor }) => {
    // 设置初始内容（仅在文档为空时）
    if (editor.isEmpty) {
      editor.commands.setContent(`
        <h1>欢迎使用 Tiptap 协作编辑器! 🎉</h1>
        <p>这是一个基于 <strong>Tiptap 3</strong> 和 <strong>Yjs</strong> 的实时协作编辑器演示。</p>
        
        <h2>功能特性:</h2>
        <ul>
          <li>✨ 实时多人协作编辑</li>
          <li>🎨 富文本格式支持</li>
          <li>👥 在线用户光标追踪</li>
          <li>🔗 链接、图片等多媒体支持</li>
          <li>📝 字符和单词统计</li>
        </ul>

        <h2>如何测试协作?</h2>
        <ol>
          <li>在多个浏览器标签页中打开此页面</li>
          <li>在任意标签页中输入内容</li>
          <li>观察其他标签页实时同步更新</li>
        </ol>

        <blockquote>
          💡 提示: 你可以看到其他用户的光标位置和选择区域!
        </blockquote>

        <p>试试在下面输入一些内容吧!</p>
      `);
    }
    updateCharacterCount(editor);
  },
});

// 更新字符统计
function updateCharacterCount(editor) {
  const { characters, words } = editor.storage.characterCount;
  document.getElementById(
    "character-count"
  ).textContent = `字符数: ${characters} / 单词数: ${words}`;
}

// 工具栏事件处理
document.getElementById("toolbar").addEventListener("click", (e) => {
  const button = e.target.closest("button");
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
      editor
        .chain()
        .focus()
        .toggleHeading({ level: parseInt(level) })
        .run();
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
  }

  updateToolbarState();
});

// 更新工具栏按钮状态
function updateToolbarState() {
  document.querySelectorAll("#toolbar button").forEach((button) => {
    const action = button.dataset.action;
    const level = button.dataset.level;

    if (action === "heading" && level) {
      button.classList.toggle(
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
      button.classList.toggle("is-active", editor.isActive(action));
    }
  });
}

// 设置链接
function setLink() {
  const previousUrl = editor.getAttributes("link").href;
  const url = window.prompt("输入链接URL:", previousUrl);

  if (url === null) {
    return;
  }

  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

// 插入图片
function setImage() {
  const url = window.prompt("输入图片URL:");

  if (url) {
    editor.chain().focus().setImage({ src: url }).run();
  }
}

// 监听编辑器选择变化
editor.on("selectionUpdate", () => {
  updateToolbarState();
});

// 用户名输入框
const usernameInput = document.getElementById("username");
usernameInput.value = currentUser.name;

usernameInput.addEventListener("change", (e) => {
  currentUser.name = e.target.value || getRandomName();
  provider.awareness.setLocalStateField("user", currentUser);
  localStorage.setItem("tiptap-user", JSON.stringify(currentUser));
});

// 更换颜色按钮
document.getElementById("change-color").addEventListener("click", () => {
  currentUser.color = getRandomColor();
  provider.awareness.setLocalStateField("user", currentUser);
  localStorage.setItem("tiptap-user", JSON.stringify(currentUser));
});

// 监听连接状态
provider.on("status", ({ status }) => {
  const statusEl = document.getElementById("connection-status");
  if (status === "connected") {
    statusEl.textContent = "已连接";
    statusEl.className = "status-connected";
  } else if (status === "disconnected") {
    statusEl.textContent = "已断开";
    statusEl.className = "status-disconnected";
  } else {
    statusEl.textContent = "连接中...";
    statusEl.className = "status-connecting";
  }
});

// 监听在线用户变化
provider.awareness.on("change", () => {
  const states = Array.from(provider.awareness.getStates().values());
  const userCount = states.length;

  document.getElementById("user-count").textContent = `在线用户: ${userCount}`;

  // 更新用户列表
  const usersContainer = document.getElementById("users-container");
  usersContainer.innerHTML = states
    .map((state, index) => {
      const user = state.user || { name: `用户 ${index + 1}`, color: "#999" };
      return `
      <div class="user-item">
        <div class="user-color" style="background-color: ${user.color}"></div>
        <div class="user-name">${user.name}</div>
      </div>
    `;
    })
    .join("");
});

// 初始化触发一次
updateToolbarState();

// 清理资源
window.addEventListener("beforeunload", () => {
  provider.destroy();
  editor.destroy();
});

console.log("✨ Tiptap 协作编辑器已启动!");
console.log("📡 WebSocket Provider:", provider);
console.log("👤 当前用户:", currentUser);
