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
C:\Users\<用户名>\.claude\skills\时政抓取\
```

目录结构：
```
时政抓取/
├── SKILL.md                  # Skill 定义文件
├── fetch-weekly-politics.js  # 抓取脚本
├── package.json              # Node.js 依赖配置
├── config.json               # 浏览器路径配置
└── node_modules/             # Puppeteer 依赖
```

### 2. 安装依赖

如果 `node_modules` 未包含，需手动安装：

```bash
cd C:\Users\<用户名>\.claude\skills\时政抓取
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

2. 创建启动模板 `时政抓取.md`：
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
  const match = content.match(/^---[\r\n]+.*[\r\n]+date:\s*(\d{4}-\d{2}-\d{2})/);
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
  tp.system.execute(
    `claude -p "更新时政" --dangerously-skip-permissions --allowed-tools "Bash,Write,Read"`,
    vaultPath
  );
}
%>
```

> 注：修改 `notePath` 为你的笔记路径。

3. 添加到 Templater 启动模板列表：
```json
"startup_templates": ["时政抓取.md"]
```

4. 设置超时时间（抓取约需20秒）：
```json
"command_timeout": 60
```

---

## 原理说明

### 需要修改的内容

使用本 skill 需要根据你的环境修改以下内容：

| 文件 | 修改内容 | 说明 |
|------|---------|------|
| `config.json` | `browserPath` | 如使用非 Edge 浏览器 |
| Templater 模板 | `notePath` | 你的笔记 vault 相对路径 |

### 技术栈

| 技术 | 作用 |
|------|------|
| Claude Code | 核心：执行 skill、分析数据、写入笔记 |
| Claude CLI | Templater 调用 Claude 的桥梁 |
| Puppeteer | 控制 Edge 浏览器，抓取动态网页 |
| Node.js | 抓取脚本运行环境 |
| Obsidian Templater | 启动时自动触发 Claude |

### 执行流程

**Templater 自动化流程（推荐）：**

```
┌─────────────────────────────────────────────────────────┐
│                 Obsidian 启动                            │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Templater 执行启动模板                                   │
│  ├─ 读取笔记 frontmatter 中的 date                        │
│  ├─ 计算 date 所在周的周一                                │
│  ├─ 对比本周周一                                          │
│  ├─ 相同 → 跳过，结束                                     │
│  └─ 不同 → 继续执行                                       │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Templater 调用 Claude CLI                                │
│  claude -p "更新时政"                                     │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Claude 执行 Skill → 调用脚本抓取数据                      │
│  ├─ Puppeteer 启动浏览器                                  │
│  ├─ 访问粉笔网时政列表                                     │
│  ├─ 提取第一篇时政汇总                                     │
│  └─ 输出 JSON 数据                                        │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Claude 分析整理数据                                      │
│  ├─ 提取关键考点                                         │
│  ├─ 优化格式便于记忆                                     │
│  └─ 生成 YAML frontmatter                                │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Claude 使用 Write 工具写入笔记                           │
│  输出: 每日时政.md（含 date 属性）                         │
└─────────────────────────┬───────────────────────────────┘
                          ↓
                      ✅ 完成
```

**手动触发流程（方式一/二）：**

用户输入关键词 → Claude 执行 Skill → 抓取 → 分析 → 写入（无智能跳过）

### 智能跳过原理

**实现位置**：Templater 启动模板（而非脚本）

通过读取笔记的 YAML frontmatter `date` 属性判断：

```javascript
// Templater 模板中的判断逻辑
const lastMonday = getMonday(new Date(note.date));  // 笔记中的日期所在周一
const thisMonday = getMonday(new Date());           // 本周周一

if (lastMonday === thisMonday) {
  // 同一周，跳过执行
}
```

| 笔记 date | 计算周一 | 本周周一 | 结果 |
|-----------|---------|---------|------|
| 2026-04-22 | 2026-04-20 | 2026-04-20 | 跳过 |
| 2026-04-15 | 2026-04-13 | 2026-04-20 | 执行 |

**优点**：
- 利用笔记本身的数据，无需额外缓存文件
- Templater 层面拦截，不触发 Claude，更高效

---

## 文件说明

### SKILL.md

Skill 定义文件，Claude Code 识别 Skill 的入口。无需修改路径。

```yaml
---
name: 时政抓取
description: >
  从粉笔网抓取本周时政汇总。触发关键词：
  "更新时政"、"每周时政"、"时政汇总"...
---
```

### fetch-weekly-politics.js

纯抓取脚本，职责单一：
- Puppeteer 浏览器控制
- 粉笔网内容解析
- 输出 JSON 数据

> 智能跳过检查由 Templater 模板实现，脚本不包含此逻辑。

### package.json

Node.js 依赖配置：
```json
{
  "dependencies": {
    "puppeteer": "^24.0.0"
  }
}
```

### config.json

浏览器路径配置，预定义 Edge 浏览器：
```json
{
  "browserPath": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
}
```

如需使用其他浏览器，修改此文件即可。

### node_modules/

Puppeteer 及其依赖库，运行必需。

---

## 输出示例

生成的 `每日时政.md`：

```markdown
---
date: 2026-04-22
source: 粉笔网
tags:
  - 时政
  - 每周更新
  - 公考
---

# 📰 每周时政汇总

> 更新时间：2026-04-22
> 来源：时政汇总| 我国加快建设分级诊疗体系

## 📋 本周时政热点

### 1. 我国加快建设分级诊疗体系

2026年4月13日，国务院新闻办公室举行国务院政策例行吹风会...

### 2. 习近平会见西班牙首相

2026年4月14日上午，国家主席习近平在北京人民大会堂...

## 🔗 来源链接

- [粉笔网时政](https://www.fenbi.com/page/exams-preparation-materials-list/12)
- [本周原文](https://www.fenbi.com/page/exam-preparation-material-detail/12/xxx)
```

---

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

Claudian