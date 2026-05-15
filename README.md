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
```
<%*
/**
 * 时政抓取启动模板
 * Templater 检查是否需要更新，然后调用 Claude 执行 skill
 * Claude 自动完成：抓取数据 → 分析整理 → 更新笔记
 */
// “最近周三”计算（含今天如果是周三）
function getLastWednesday(today = new Date()) {
  const day = today.getDay(); // 0=周日, 1=周一, ..., 3=周三
  // 核心逻辑：(day - 3 + 7) % 7 确保结果非负
  const diff = (day - 3 + 7) % 7;
  const lastWed = new Date(today);
  lastWed.setDate(today.getDate() - diff);
  return lastWed.toISOString().slice(0, 10);
}

// 封装：从内容中读取 Frontmatter 的 date 字段
function getFrontmatterDate(content) {
  const match = content.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// 封装：检查是否需要更新
async function needsUpdate() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const targetWednesdayStr = getLastWednesday(today);
  const notePath = '0.备忘/HomePage/每周时政.md';
  const file = app.vault.getAbstractFileByPath(notePath);

  // 情况1：文件不存在
  if (!file) {
    console.log('📅 时政：文件不存在，需要创建');
    return true;
  }

  try {
    const content = await app.vault.read(file);
    const lastDate = getFrontmatterDate(content);

    // 情况2：Frontmatter 没有 date 字段
    if (!lastDate) {
      console.log('📅 时政：未找到上次更新日期，需要更新');
      return true;
    }

    // 情况3：判断是否需要更新
    const isWednesdayAndNotUpdated = today.getDay() === 3 && lastDate < todayStr;
    const isOutdated = lastDate < targetWednesdayStr;

    if (isOutdated) {
      console.log(`📅 时政：上次更新（${lastDate}）早于目标周三（${targetWednesdayStr}），需要补更`);
    }

    if (isWednesdayAndNotUpdated || isOutdated) {
      return true;
    }

    console.log(`📅 时政：无需更新（上次：${lastDate}，目标周三：${targetWednesdayStr}）`);
    return false;
  } catch (e) {
    console.error('📅 时政：读取文件失败，强制更新', e.message);
    return true;
  }
}

// 封装：执行 Claude 命令
async function runClaudeUpdate() {
  const vaultPath = app.vault.adapter.basePath;
  const command = `claude -p "更新时政" --dangerously-skip-permissions --allowed-tools "Bash,Write,Read"`;
  const { exec } = require('child_process');

  return new Promise((resolve, reject) => {
    exec(command, { cwd: vaultPath, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// 主流程
try {
  const shouldUpdate = await needsUpdate();

  if (shouldUpdate) {
    console.log('📰 开始抓取时政...');
    new Notice('📰 开始抓取时政...');
    await runClaudeUpdate();
    console.log('✅ 时政抓取完成');
    new Notice('✅ 时政抓取完成');
  } else {
    new Notice('📅 时政本周已更新，跳过');
  }
} catch (error) {
  console.error('❌ 时政抓取失败:', error.message);
  new Notice(`❌ 时政抓取失败: ${error.message}`);
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