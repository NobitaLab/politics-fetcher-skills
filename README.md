# 每周时政抓取 Skill

从粉笔网自动抓取本周时政汇总，更新到 Obsidian 笔记。

## 功能介绍

- 🎯 **精准抓取**：自动获取粉笔网时政板块第一篇"时政汇总"文章
- 🧠 **智能分析**：Claude 分析整理数据，生成适合公考学习的笔记格式
- 📝 **格式化输出**：生成带 YAML frontmatter 的 Markdown 笔记
- 🔁 **智能跳过**：本周已抓取则自动跳过，避免重复请求
- ⏰ **自动更新**：支持 Obsidian Templater 启动模板，打开 Obsidian 即更新

## 安装方法

### 1. 创建 Skill 目录

将整个文件夹复制到 Claude Code 的 skills 目录：

```
C:\Users\<用户名>\.claude\skills\politics-fetcher-skills\
```

目录结构：
```
politics-fetcher-skills/
├── SKILL.md                  # Skill 定义文件
├── fetch-weekly-politics.js  # 抓取脚本
├── package.json              # Node.js 依赖配置
├── config.json               # 浏览器路径配置
└── node_modules/             # Puppeteer 依赖
```

### 2. 安装依赖

如果 `node_modules` 未包含，需手动安装：

```bash
cd C:\Users\<用户名>\.claude\skills\politics-fetcher-skills
npm install
```

**配置说明：**

`config.json` 预定义了 Edge 浏览器路径，通常无需修改。如需使用其他浏览器，编辑该文件：
```json
{
  "browserPath": "你的浏览器路径"
}
```

## 使用方法

### 方式一：Claude Code 触发

在 Claude Code 中输入以下关键词即可触发：

```
更新时政 / 更新每周时政 / 获取时政 / 抓取时政 / 每周时政 / 时政汇总 / 粉笔时政 / /时政抓取
```

### 方式二：Obsidian Templater 自动化

**最推荐的自动化方式！** 每次打开 Obsidian，自动检查本周是否已更新，未更新则执行抓取。

**工作流程：**
```
Obsidian 启动 → Templater 检查笔记 date → 本周已更新？跳过 → 未更新 → Claude 执行 → 抓取 → 分析 → 写入
```

**步骤：**

1. 启用 Templater 系统命令（`enable_system_commands: true`）

2. 设置超时时间（抓取约需20秒）：
```json
"command_timeout": 60
```

3. 创建启动模板 `时政抓取.md`：
```markdown
<%*
// 智能跳过：检查笔记 date 是否在本周
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

async function needsUpdate() {
  const notePath = '0.备忘/HomePage/每日时政.md';
  const file = app.vault.getAbstractFileByPath(notePath);
  if (!file) return true;
  
  const content = await app.vault.read(file);
  const match = content.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return true;
  
  const lastMonday = getMonday(new Date(match[1]));
  const thisMonday = getMonday(new Date());
  
  if (lastMonday === thisMonday) {
    console.log('📅 时政：本周已更新，跳过');
    return false;
  }
  return true;
}

if (await needsUpdate()) {
  const vaultPath = app.vault.adapter.basePath;
  const command = `claude -p "更新时政" --dangerously-skip-permissions --allowed-tools "Bash,Write,Read"`;
  
  const { exec } = require('child_process');
  exec(command, { cwd: vaultPath, maxBuffer: 1024 * 1024 * 10 });
}
%>
```

> 注：修改 `notePath` 为你的笔记路径。

4. 添加到 Templater 启动模板列表：
```json
"startup_templates": ["时政抓取.md"]
```

---

### 需要修改的内容

使用本 skill 需要根据你的环境修改以下内容：

| 文件 | 修改内容 | 说明 |
|------|---------|------|
| `config.json` | `browserPath` | 如使用非 Edge 浏览器 |
| Templater 模板 | `notePath` | 你的笔记 vault 相对路径 |

## 常见问题

### Q: 为什么需要浏览器？

粉笔网是动态网页，需要 Puppeteer 控制浏览器渲染后才能获取内容。

### Q: 可以用其他浏览器吗？

可以，修改 `config.json` 中的 `browserPath`：
```json
{
  "browserPath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
}
```

### Q: 抓取失败怎么办？

常见原因：
- 网络超时 → 检查网络连接
- 浏览器未找到 → 创建 `config.json` 指定 `browserPath`
- 粉笔网页面结构变化 → 可能需要更新解析逻辑

---

## 许可证

MIT License

## 作者

NobitaLab