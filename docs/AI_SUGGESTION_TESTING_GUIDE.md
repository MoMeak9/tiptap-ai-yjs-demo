# AI Suggestion 功能测试指南

## ✅ 修复完成

已完成两项关键修复：

1. **Fragment 实例不匹配错误** ✅
   - 修复了 `RangeError: Can not convert to a Fragment` 错误
   - 文件: [src/extensions/suggestion.ts:173](../src/extensions/suggestion.ts#L173)

2. **模拟 AI 函数改进** ✅
   - 改为确定性转换，产生明显的 diff
   - 文件: [src/main.ts:218-255](../src/main.ts#L218-L255)

---

## 🧪 测试步骤

### 准备工作

```bash
# 1. 启动开发服务器
pnpm run dev

# 2. 打开浏览器
# 访问 http://localhost:3000

# 3. 打开浏览器控制台 (F12)
# 用于查看日志和调试
```

### 测试场景 1: 基本 AI Suggestion

**步骤**:
1. 在编辑器中选中文本: `"Collaborative editor demo using Tiptap 3 and Yjs."`
2. 点击工具栏的 **AI Suggest** 按钮（💡 图标）
3. 观察结果

**预期效果**:

原文:
```
Collaborative editor demo using Tiptap 3 and Yjs.
```

AI 建议后:
```
Collaborative [advanced editor] [demonstration] [powered by] Tiptap 3 [(rich-text framework)] and Yjs [CRDT technology].
```

**视觉效果**:
- ❌ **红色删除线**: 原文中被删除的词（如 "editor", "demo", "using"）
- ✅ **绿色高亮**: AI 添加的新词（如 "advanced editor", "demonstration", "powered by"）

**控制台输出**:
```
Original: Collaborative editor demo using Tiptap 3 and Yjs.
AI Suggestion: Collaborative advanced editor demonstration powered by Tiptap 3 (rich-text framework) and Yjs CRDT technology.
```

### 测试场景 2: 接受/拒绝 Suggestions

**步骤 A - 接受单个建议**:
1. 应用 AI suggestion（按上述步骤）
2. 点击任一绿色高亮文本
3. 在右侧面板中点击 **Accept** 按钮
4. 观察：该绿色高亮消失，文本保留

**步骤 B - 拒绝单个建议**:
1. 点击任一绿色高亮文本
2. 在右侧面板中点击 **Reject** 按钮
3. 观察：该绿色高亮和文本都消失，恢复原文

**步骤 C - 接受全部**:
1. 应用 AI suggestion
2. 在右侧面板点击 **Accept All** 按钮
3. 观察：所有标记消失，保留 AI 建议的文本

**步骤 D - 拒绝全部**:
1. 应用 AI suggestion
2. 在右侧面板点击 **Reject All** 按钮
3. 观察：所有标记消失，恢复原始文本

### 测试场景 3: Undo/Redo

**步骤**:
1. 应用 AI suggestion
2. 点击 **Accept All**
3. 按 `Ctrl+Z` (Windows) 或 `Cmd+Z` (Mac)
4. 观察：应回到接受前的标记状态
5. 再按一次 `Ctrl+Z`
6. 观察：应回到 AI 处理前的原始文本

**预期行为**:
```
原始文本
  ↓ Apply AI Suggestion
AI Diff 标记状态 (绿色/红色)
  ↓ Accept All
最终接受状态
  ↓ Ctrl+Z (第一次)
AI Diff 标记状态 (恢复标记)
  ↓ Ctrl+Z (第二次)
原始文本 (完全恢复)
```

### 测试场景 4: 多段落测试

**步骤**:
1. 创建多段落文本:
   ```
   This is a very good editor.

   We can't use other editors.

   This demo is excellent.
   ```

2. 选中全部文本
3. 点击 AI Suggest
4. 观察多处改动

**预期效果**:
- "very good" → "extremely excellent"
- "can't" → "cannot"
- "demo" → "demonstration"
- "editor" → "advanced editor"

---

## 🔍 调试技巧

### 检查 DOM 中的 Suggestion Marks

在浏览器控制台执行:

```javascript
// 检查是否有 suggestion marks
const addMarks = document.querySelectorAll('.tiptap-suggestion-add');
const deleteMarks = document.querySelectorAll('.tiptap-suggestion-delete');

console.log('添加标记数量:', addMarks.length);
console.log('删除标记数量:', deleteMarks.length);

// 查看第一个添加标记的内容
if (addMarks.length > 0) {
  console.log('第一个添加标记:', addMarks[0].textContent);
}
```

### 检查 Editor HTML

```javascript
// 查看 editor 的 HTML 结构
console.log(editor.getHTML());

// 应该看到类似这样的结构:
// <span data-suggestion-type="add" class="tiptap-suggestion-add">advanced editor</span>
```

### 检查 Suggestion Manager 状态

```javascript
// 查看当前 suggestion 组
const groups = suggestionManager.getGroups();
console.log('Active groups:', groups);

// 查看当前组的 suggestions
const currentGroup = suggestionManager.getCurrentGroup();
if (currentGroup) {
  const suggestions = suggestionManager.getSuggestions(currentGroup.groupId);
  console.log('Current suggestions:', suggestions);
}
```

### 强制触发 UI 更新

```javascript
// 如果 UI 没有更新，手动触发
suggestionUI.show();
```

---

## 🐛 常见问题排查

### 问题 1: 看不到绿色/红色标记

**检查**:
```javascript
// 1. 检查 CSS 是否加载
const styles = document.styleSheets;
let hasSuggestionStyles = false;
for (let sheet of styles) {
  try {
    const rules = sheet.cssRules || sheet.rules;
    for (let rule of rules) {
      if (rule.selectorText && rule.selectorText.includes('tiptap-suggestion')) {
        hasSuggestionStyles = true;
        console.log('Found style:', rule.cssText);
      }
    }
  } catch (e) {
    // CORS 限制，跳过
  }
}
console.log('Has suggestion styles?', hasSuggestionStyles);
```

**解决方案**:
- 检查 `src/styles.css` 是否被正确导入
- 检查浏览器缓存，强制刷新 (Ctrl+Shift+R)

### 问题 2: 控制台报错

**常见错误**:
```
RangeError: Can not convert to a Fragment
```

**状态**: ✅ 已修复 - 如果仍然出现，请报告 bug

### 问题 3: Diff 标记太小，看不清楚

**解决方案**:
1. 选择包含以下关键词的文本进行测试:
   - "editor", "demo", "collaboration", "using"
   - "Tiptap 3", "Yjs"
   - "AI", "very good"

2. 这些词会触发确定性的替换，产生明显的 diff

**示例好的测试文本**:
```
This is a collaborative editor demo using Tiptap 3 and Yjs.
AI makes it very good.
We can't imagine better collaboration.
```

会产生**大量明显的绿色和红色标记**。

### 问题 4: 右侧面板没有出现

**检查**:
```javascript
// 检查 UI 是否初始化
console.log(suggestionUI);

// 手动显示
suggestionUI.show();
```

**解决方案**:
- 确保 `suggestionManager.registerGroup(groupId)` 被调用
- 确保 `suggestionUI.show()` 被调用

---

## 📊 性能测试

### 测试大文档性能

```javascript
// 创建大量文本
const largeText = "This is a very good editor demo using Tiptap 3 and Yjs. ".repeat(100);

// 测试应用 suggestion 的时间
console.time('Apply AI Suggestion');
editor.commands.applyAISuggestion(
  largeText,
  simulateAIRewrite(largeText),
  0,
  largeText.length
);
console.timeEnd('Apply AI Suggestion');

// 应该在 <100ms 完成
```

### 测试接受全部的性能

```javascript
console.time('Accept All');
editor.commands.acceptAllSuggestions();
console.timeEnd('Accept All');

// 应该在 <50ms 完成
```

---

## ✅ 验收标准

### 功能验收

- [ ] 点击 AI Suggest 按钮后，文本出现绿色/红色标记
- [ ] 可以逐个接受/拒绝 suggestion
- [ ] 可以一键接受/拒绝全部 suggestions
- [ ] Undo/Redo 功能正常工作
- [ ] 右侧面板正确显示 suggestion 详情
- [ ] 控制台没有错误信息

### 视觉验收

- [ ] 绿色标记清晰可见 (rgba(16, 185, 129, 0.25) 背景)
- [ ] 红色删除线清晰可见 (line-through + #ef4444 颜色)
- [ ] 鼠标悬停时有视觉反馈
- [ ] UI 响应流畅，无卡顿

### 性能验收

- [ ] 100 个词的文档，应用 suggestion < 100ms
- [ ] 接受全部 suggestions < 50ms
- [ ] UI 更新流畅，无明显延迟

---

## 🚀 下一步

### 立即可测试

1. **基本功能**: 按上述步骤测试所有场景
2. **边界情况**: 空选区、跨段落、特殊字符
3. **性能测试**: 大文档、连续操作

### Phase 2 准备

一旦基本功能验证通过，可以开始:

1. **集成 DeepSeek API**:
   - 替换 `simulateAIRewrite` 为真实 API 调用
   - 使用 Phase 1 PoC 的服务器端点
   - 处理加载状态和错误

2. **Token-based Diff**:
   - 实现 TokenCodec
   - 实现 StructuredDiff engine
   - 保留格式信息（加粗、斜体等）

3. **Fine-grained Undo**:
   - 每个 Accept/Reject 创建独立的历史记录
   - 冲突检测和解决

---

## 📞 报告问题

如果发现问题，请提供:

1. **复现步骤**: 详细的操作流程
2. **预期行为**: 应该发生什么
3. **实际行为**: 实际发生了什么
4. **控制台日志**: 完整的错误信息
5. **浏览器信息**: Chrome/Firefox/Safari + 版本号
6. **测试文本**: 使用的具体文本内容

**日志收集命令**:
```javascript
// 执行以下命令并复制输出
console.log('Editor HTML:', editor.getHTML());
console.log('Selection:', editor.state.selection);
console.log('Suggestion groups:', suggestionManager.getGroups());
```

---

**最后更新**: 2025-01-08
**状态**: ✅ Ready for Testing
**预期完成**: 所有功能应正常工作
