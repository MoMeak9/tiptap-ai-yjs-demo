# Tiptap 3 协作编辑器 Demo (含评论功能)

这是一个基于 **Tiptap 3** 和 **Yjs** 的实时协作编辑器演示项目，使用 vanilla JavaScript 实现（框架无关）。新增了类似 Google Docs 的协同评论功能！

## ✨ 功能特性

- 🤝 **实时协作编辑** - 多人同时编辑同一文档
- 💬 **协同评论功能** - 类似 Google Docs 的评论系统，支持多人协同
- 🤖 **AI 文本建议** - 使用 DeepSeek AI 智能优化文本，带 diff 预览
- 🎨 **富文本编辑** - 支持标题、列表、引用、代码块等格式
- 👥 **在线用户追踪** - 显示其他用户的光标位置和选择区域
- 🔗 **多媒体支持** - 插入链接、图片等
- 📊 **字符统计** - 实时显示字符数和单词数
- 🎯 **用户自定义** - 自定义用户名和光标颜色
- 💾 **本地存储** - 保存用户偏好设置

## 🆕 评论功能亮点

- ✅ 选中文本添加评论,实时同步到所有用户
- ✅ 支持评论回复,构建完整的讨论线程
- ✅ 点击评论快速定位到对应文本
- ✅ 评论数据通过 Yjs 协同,多人同时评论无冲突
- ✅ 优雅的评论面板 UI,可折叠/展开
- ✅ 快捷键支持 (Ctrl+Shift+M)
- ✅ 显示评论时间和作者信息

## 🤖 AI 建议功能亮点

- ✅ **真实 AI 集成** - 使用 DeepSeek API 进行智能文本优化
- ✅ **Diff 可视化** - 绿色显示新增文本，红色删除线显示删除内容
- ✅ **逐项审阅** - 可以单独接受/拒绝每个建议
- ✅ **批量操作** - 一键接受或拒绝全部建议
- ✅ **加载状态** - 清晰的处理中提示和错误反馈
- ✅ **环境配置** - 灵活的 API URL 和密钥配置

## 🛠️ 技术栈

- **[Tiptap 3](https://tiptap.dev/)** - 现代化的富文本编辑器
- **[Yjs](https://github.com/yjs/yjs)** - CRDT 协作框架
- **[y-websocket](https://github.com/yjs/y-websocket)** - WebSocket 提供者
- **[Vite](https://vitejs.dev/)** - 快速的前端构建工具

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量（使用 AI 功能必需）

复制环境变量示例文件并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，添加你的 DeepSeek API 密钥：

```bash
# 前端配置
VITE_AI_API_URL=http://localhost:3001

# 后端配置（必需）
DEEPSEEK_API_KEY=your_deepseek_api_key_here
PORT=3001
```

> 获取 DeepSeek API 密钥: [https://platform.deepseek.com/](https://platform.deepseek.com/)

### 3. 启动服务器

**终端 1 - WebSocket 服务器** (协作功能):

```bash
node server.js
```

服务器将在 `ws://localhost:1234` 上运行。

**终端 2 - AI API 服务器** (AI 建议功能):

```bash
pnpm run server
```

服务器将在 `http://localhost:3001` 上运行。

### 4. 启动前端开发服务器

**终端 3 - 前端**:

```bash
pnpm run dev
```

前端应用将在 `http://localhost:3000` 上运行。

### 5. 测试功能

**测试 AI API 集成**:

```bash
./scripts/test-ai-api.sh
```

**浏览器测试**:

1. 打开 `http://localhost:3000`
2. **测试 AI 建议**:
   - 选中一段文本
   - 点击工具栏中的 "🤖 AI" 按钮
   - 等待 3-10 秒处理
   - 查看 diff 结果并接受/拒绝建议
3. **测试协作编辑**:
   - 在另一个标签页打开相同 URL
   - 在任一标签页输入内容
   - 观察实时同步和光标追踪
4. **测试评论功能**:
   - 选中文本，点击 "💬" 按钮
   - 添加评论并查看同步效果

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
- **Comment** - 协同评论功能 (自定义扩展)

## 📖 项目结构

```
tiptap-ai-yjs-demo/
├── index.html          # 主 HTML 文件
├── src/
│   ├── main.js        # 主 JavaScript 文件
│   ├── styles.css     # 样式文件
│   └── extensions/    # 自定义扩展
│       ├── comment.js          # 评论 Mark 扩展
│       ├── commentManager.js   # 评论数据管理
│       └── commentUI.js        # 评论 UI 组件
├── server.js          # WebSocket 服务器
├── vite.config.js     # Vite 配置
├── package.json       # 项目依赖
├── README.md          # 项目文档
├── COMMENT_GUIDE.md   # 评论功能详细文档
└── COMMENT_USAGE.md   # 评论功能使用示例
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

## � 评论功能使用指南

### 添加评论

1. 在编辑器中选中要评论的文本
2. 点击工具栏的 "💬 评论" 按钮，或按 `Ctrl+Shift+M` (Mac: `Cmd+Shift+M`)
3. 在右侧评论面板中输入评论内容

### 编辑和回复评论

- 点击评论项可激活编辑
- 在评论底部输入框中可添加回复
- 所有操作实时同步到其他用户

### 更多功能

- 📍 点击定位按钮跳转到评论对应的文本
- 🗑️ 点击删除按钮移除评论
- 折叠/展开评论面板

详细使用方法请查看 [评论功能使用指南](./COMMENT_USAGE.md) 和 [评论功能技术文档](./COMMENT_GUIDE.md)。

## �📝 注意事项

1. **生产环境** - 当前 WebSocket 服务器是简单实现，生产环境建议使用更健壮的方案如 [Hocuspocus](https://tiptap.dev/docs/hocuspocus)
2. **数据持久化** - 当前数据仅存储在内存中，服务器重启后数据会丢失。可以集成数据库存储
3. **认证授权** - 生产环境需要添加用户认证和权限控制
4. **扩展性** - 对于大规模部署，考虑使用 Redis 等进行跨服务器同步
5. **评论持久化** - 评论数据也需要持久化存储，可以监听 Yjs 的 update 事件保存到数据库

## 🎯 实现细节

### 评论功能架构

本项目参考了 [tiptap-comment-extension](https://github.com/sereneinserenade/tiptap-comment-extension) 的设计,并完全集成了 Yjs 协同编辑能力:

1. **Comment Extension** - 基于 Tiptap Mark 实现评论标记
2. **CommentManager** - 使用 Yjs Map 存储评论数据,实现多人协同
3. **CommentUI** - 评论界面组件,提供友好的交互体验

### Yjs 集成关键点

- 评论数据存储在 `ydoc.getMap('comments')` 中
- 通过 Yjs 的 CRDT 算法自动处理冲突
- WebSocket Provider 确保实时同步
- 支持离线编辑和冲突合并

## 🔗 相关资源

- [Tiptap 文档](https://tiptap.dev/docs)
- [Yjs 文档](https://docs.yjs.dev/)
- [Tiptap Collaboration 指南](https://tiptap.dev/docs/collaboration/getting-started/install)
- [tiptap-comment-extension](https://github.com/sereneinserenade/tiptap-comment-extension) - 评论功能参考实现

## 📄 License

MIT

---

**享受协作编辑和评论的乐趣！** 🎉💬
