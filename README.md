# Tiptap 3 协作编辑器 Demo

这是一个基于 **Tiptap 3** 和 **Yjs** 的实时协作编辑器演示项目，使用 vanilla JavaScript 实现（框架无关）。

## ✨ 功能特性

- 🤝 **实时协作编辑** - 多人同时编辑同一文档
- 🎨 **富文本编辑** - 支持标题、列表、引用、代码块等格式
- 👥 **在线用户追踪** - 显示其他用户的光标位置和选择区域
- 🔗 **多媒体支持** - 插入链接、图片等
- 📊 **字符统计** - 实时显示字符数和单词数
- 🎯 **用户自定义** - 自定义用户名和光标颜色
- 💾 **本地存储** - 保存用户偏好设置

## 🛠️ 技术栈

- **[Tiptap 3](https://tiptap.dev/)** - 现代化的富文本编辑器
- **[Yjs](https://github.com/yjs/yjs)** - CRDT 协作框架
- **[y-websocket](https://github.com/yjs/y-websocket)** - WebSocket 提供者
- **[Vite](https://vitejs.dev/)** - 快速的前端构建工具

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动 WebSocket 服务器

在一个终端窗口中运行：

```bash
npm run server
```

WebSocket 服务器将在 `ws://localhost:1234` 上运行。

### 启动前端开发服务器

在另一个终端窗口中运行：

```bash
npm run dev
```

前端应用将在 `http://localhost:3000` 上运行。

### 测试协作功能

1. 在浏览器中打开 `http://localhost:3000`
2. 复制 URL 并在另一个浏览器标签页（或不同浏览器）中打开
3. 在任一标签页中输入内容，观察另一个标签页的实时同步
4. 你会看到其他用户的光标位置和选择区域

## 📦 构建生产版本

```bash
npm run build
```

构建产物将在 `dist` 目录中。

## 🎯 使用的 Tiptap 扩展

### 核心扩展
- **StarterKit** - 包含基础编辑功能（标题、列表、粗体、斜体等）
- **Collaboration** - Yjs 协作支持
- **CollaborationCursor** - 显示其他用户的光标

### 功能扩展
- **Highlight** - 文本高亮
- **Link** - 链接支持
- **Image** - 图片插入
- **Placeholder** - 占位符提示
- **CharacterCount** - 字符统计
- **TextStyle & Color** - 文本样式和颜色

## 📖 项目结构

```
tiptap-ai-yjs-demo/
├── index.html          # 主 HTML 文件
├── src/
│   ├── main.js        # 主 JavaScript 文件
│   └── styles.css     # 样式文件
├── server.js          # WebSocket 服务器
├── vite.config.js     # Vite 配置
├── package.json       # 项目依赖
└── README.md          # 项目文档
```

## 🔧 自定义配置

### WebSocket 服务器端口

在 `server.js` 中修改：

```javascript
const PORT = 1234 // 修改为你想要的端口
```

同时在 `src/main.js` 中更新连接地址：

```javascript
const provider = new WebsocketProvider(
  'ws://localhost:1234', // 更新端口
  'tiptap-collaboration-demo',
  ydoc
)
```

### 文档名称

在 `src/main.js` 中修改文档标识符：

```javascript
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  'your-document-name', // 修改文档名称
  ydoc
)
```

不同的文档名称会创建独立的协作空间。

## 🌐 部署

### 部署 WebSocket 服务器

你可以将 WebSocket 服务器部署到任何支持 Node.js 的平台：

- **Heroku**
- **DigitalOcean**
- **AWS EC2**
- **Railway**
- **Render**

### 部署前端应用

前端可以部署到任何静态托管服务：

- **Vercel**
- **Netlify**
- **GitHub Pages**
- **Cloudflare Pages**

记得更新前端代码中的 WebSocket 服务器地址为实际部署的地址。

## 📝 注意事项

1. **生产环境** - 当前 WebSocket 服务器是简单实现，生产环境建议使用更健壮的方案如 [Hocuspocus](https://tiptap.dev/docs/hocuspocus)
2. **数据持久化** - 当前数据仅存储在内存中，服务器重启后数据会丢失。可以集成数据库存储
3. **认证授权** - 生产环境需要添加用户认证和权限控制
4. **扩展性** - 对于大规模部署，考虑使用 Redis 等进行跨服务器同步

## 🔗 相关资源

- [Tiptap 文档](https://tiptap.dev/docs)
- [Yjs 文档](https://docs.yjs.dev/)
- [Tiptap Collaboration 指南](https://tiptap.dev/docs/collaboration/getting-started/install)

## 📄 License

MIT

---

**享受协作编辑的乐趣！** 🎉
