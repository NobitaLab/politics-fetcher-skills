/**
 * 粉笔网周时政抓取脚本
 * 抓取本周时政汇总（时政板块第一篇）
 *
 * 输出：JSON 数据供 Claude 分析整理
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

// 默认浏览器路径
const DEFAULT_BROWSER = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// 加载配置
function loadConfig() {
  // 优先读取 config.json
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (config.browserPath && fs.existsSync(config.browserPath)) {
        return config.browserPath;
      }
    } catch (e) {}
  }

  // 使用默认路径
  if (fs.existsSync(DEFAULT_BROWSER)) {
    return DEFAULT_BROWSER;
  }

  console.error('❌ 未找到浏览器，请检查 config.json');
  process.exit(1);
}

async function fetchWeeklyPolitics() {
  const browserPath = loadConfig();

  console.log('🚀 启动浏览器...');
  console.log('   浏览器: ' + browserPath);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // 1. 访问粉笔时政列表
    console.log('📄 访问粉笔时政列表页...');
    await page.goto('https://www.fenbi.com/page/exams-preparation-materials-list/12?page=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 4000));

    // 2. 获取第一篇时政汇总文章
    const article = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="exam-preparation-material-detail"]'));
      const politicsLink = links.find(a => a.innerText.includes('时政汇总'));

      if (politicsLink) {
        return {
          href: politicsLink.href,
          title: politicsLink.innerText.split('\n')[0].trim()
        };
      }
      return links[0] ? { href: links[0].href, title: links[0].innerText.split('\n')[0].trim() } : null;
    });

    if (!article) {
      console.log('❌ 未找到文章');
      return null;
    }

    console.log('📌 文章: ' + article.title);

    // 3. 访问详情页
    console.log('📖 读取详情页...');
    await page.goto(article.href, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // 4. 提取时政条目
    const fullText = await page.evaluate(() => document.body.innerText);
    const lines = fullText.split('\n').filter(l => l.trim());
    const items = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      if (/^\d+$/.test(line)) {
        i++;
        if (i < lines.length) {
          const title = lines[i].trim();
          i++;

          let content = '';
          while (i < lines.length) {
            const next = lines[i].trim();
            if (/^\d+$/.test(next) || next.includes('相关文章') || next.includes('粉笔') || next.includes('客服')) break;
            if (next.length > 10) content += next + ' ';
            i++;
          }

          if (title.length > 5 && !title.includes('粉笔')) {
            items.push({ title, content: content.trim().slice(0, 200) });
          }
        }
      } else {
        i++;
      }
    }

    console.log('✅ 提取到 ' + items.length + ' 条时政');

    // 5. 输出 JSON 数据
    const dateStr = new Date().toISOString().slice(0, 10);
    const result = { article, items, date: dateStr };

    console.log('\n=== 时政数据 ===');
    console.log(JSON.stringify(result));

    return result;

  } finally {
    await browser.close();
    console.log('\n✨ 完成');
  }
}

fetchWeeklyPolitics()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });