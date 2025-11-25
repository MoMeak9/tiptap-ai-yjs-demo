# Tiptap 评论功能示例

## 快速开始

1. 启动 WebSocket 服务器:
```bash
npm run server
```

2. 启动开发服务器:
```bash
npm run dev
```

3. 在浏览器中打开 `http://localhost:5173`

## 测试评论功能

### 场景 1: 添加评论

1. 在编辑器中选中一段文本
2. 点击工具栏的 "💬 评论" 按钮
3. 在右侧评论面板中输入评论内容
4. 评论会自动保存

### 场景 2: 多人协同评论

1. 在多个浏览器标签页中打开应用
2. 在标签页 A 中添加评论
3. 观察标签页 B 中评论实时出现
4. 在标签页 B 中编辑评论
5. 观察标签页 A 中评论实时更新

### 场景 3: 评论回复

1. 点击一个评论项激活它
2. 在评论底部的输入框中输入回复
3. 点击 "回复" 按钮或按 Enter
4. 回复会出现在评论下方
5. 其他用户会实时看到回复

### 场景 4: 定位评论

1. 滚动编辑器到看不到评论标记的位置
2. 在评论面板中点击 📍 按钮
3. 编辑器会自动滚动并选中对应文本

### 场景 5: 删除评论

1. 点击评论的 🗑️ 按钮
2. 确认删除
3. 评论及其标记都会被移除
4. 其他用户会实时看到删除

## 快捷键

- `Ctrl+Shift+M` (Mac: `Cmd+Shift+M`): 为选中文本添加评论

## 技术细节

### Yjs 数据同步

评论数据存储在 Yjs 的 Map 中,结构如下:

```javascript
ydoc.getMap('comments')
  ├── commentId1: { content, author, createdAt, replies: [...] }
  ├── commentId2: { content, author, createdAt, replies: [...] }
  └── ...
```

所有对 Map 的修改都会通过 WebSocket 自动同步到其他客户端。

### 评论标记

评论通过 Tiptap Mark 实现,每个标记包含:
- `commentId`: 唯一标识符,用于关联评论数据
- HTML 属性: `data-comment-id="xxx"`

### 冲突处理

Yjs 使用 CRDT (Conflict-free Replicated Data Type) 算法自动处理冲突:
- 多个用户同时编辑同一评论时,最后写入的内容会保留
- 添加/删除操作会自动合并
- 不会出现数据丢失或损坏

## 故障排除

### 评论不同步

1. 检查 WebSocket 连接状态
2. 确保服务器正在运行 (`npm run server`)
3. 查看浏览器控制台错误信息

### 评论面板不显示

1. 检查浏览器宽度是否足够 (建议 > 1200px)
2. 尝试刷新页面
3. 检查浏览器控制台错误

### 无法添加评论

1. 确保选中了文本
2. 检查是否有 JavaScript 错误
3. 尝试使用快捷键 `Ctrl+Shift+M`

## 进阶使用

### 自定义评论样式

在 `src/styles.css` 中修改:

```css
.tiptap-comment {
  background-color: #your-color;
  border-bottom: 2px solid #your-border-color;
}
```

### 自定义评论面板位置

在 `src/styles.css` 中修改:

```css
.comment-sidebar {
  right: 0; /* 改为 left: 0 显示在左侧 */
  width: 360px; /* 修改宽度 */
}
```

### 禁用快捷键

在 `src/extensions/comment.js` 中注释掉:

```javascript
addKeyboardShortcuts() {
  return {
    // "Mod-Shift-m": () => { ... }
  };
}
```

## 性能优化

1. **大量评论**: Yjs 会自动优化数据结构,支持数千条评论
2. **实时同步**: WebSocket 连接复用,延迟通常 < 100ms
3. **内存使用**: 评论数据压缩存储,内存占用很小

## 常见问题

**Q: 评论数据保存在哪里?**
A: 评论数据通过 Yjs 同步,存储在每个客户端的内存中。可以配置持久化到数据库。

**Q: 支持离线编辑吗?**
A: 目前不支持。断网后无法添加评论,重连后会自动同步其他用户的更改。

**Q: 如何导出评论?**
A: 可以通过 `commentManager.getComments()` 获取所有评论数据,然后导出为 JSON。

**Q: 评论会影响文档内容吗?**
A: 不会。评论是 Mark 标记,不会修改文档的文本内容,只是添加了元数据。

## 更多资源

- [完整文档](./COMMENT_GUIDE.md)
- [Tiptap 官方文档](https://tiptap.dev)
- [Yjs 官方文档](https://docs.yjs.dev)
