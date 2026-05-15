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
const OUTPUT_FILE = path.join(__dirname, 'weekly-politics.json');
const DEFAULT_BROWSER = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// 加载配置
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (config.browserPath && fs.existsSync(config.browserPath)) {
        return config.browserPath;
      }
    } catch (e) {
      console.warn('⚠️  config.json 读取失败，使用默认浏览器路径');
    }
  }
  if (fs.existsSync(DEFAULT_BROWSER)) {
    return DEFAULT_BROWSER;
  }
  console.error('❌ 未找到浏览器，请检查 config.json 中的 browserPath');
  process.exit(1);
}

// 校验内容完整性
function checkContentComplete(content) {
  if (!content) return false;
  const trimmed = content.trim();
  const completeEndings = ['。', '！', '；', '》', '）', '"', "'", '”', '’'];
  return completeEndings.includes(trimmed.slice(-1));
}

async function fetchWeeklyPolitics() {
  const browserPath = loadConfig();
  console.log('🚀 启动浏览器...');
  console.log('   浏览器: ' + browserPath);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    // 1. 访问粉笔时政列表（优化等待策略）
    console.log('📄 访问粉笔时政列表页...');
    await page.goto('https://www.fenbi.com/page/exams-preparation-materials-list/12?page=1', {
      waitUntil: 'networkidle2',
      timeout: 60000 // 延长超时时间
    });
    await page.waitForSelector('a[href*="exam-preparation-material-detail"]', { visible: true, timeout: 30000 });

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
      console.log('❌ 未找到任何时政汇总文章');
      return null;
    }
    console.log('📌 找到目标文章: ' + article.title);

    // 3. 访问详情页（优化等待策略）
    console.log('📖 读取文章详情...');
    await page.goto(article.href, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('body', { visible: true, timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000)); // 保留短时间等待，确保动态内容渲染

    // 4. 提取时政条目（核心优化：完整提取+完整性校验）
    const fullText = await page.evaluate(() => document.body.innerText);
    const lines = fullText.split('\n').filter(l => l.trim());
    const items = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      // 匹配数字编号开头的时政条目
      if (/^\d+$/.test(line)) {
        i++;
        if (i >= lines.length) break;

        const title = lines[i].trim();
        i++;
        let content = '';

        // 提取完整内容，直到下一个条目或无关内容
        while (i < lines.length) {
          const nextLine = lines[i].trim();
          // 终止条件：下一个数字编号、相关文章、粉笔广告、客服信息
          if (/^\d+$/.test(nextLine) 
              || nextLine.includes('相关文章') 
              || nextLine.includes('粉笔') 
              || nextLine.includes('客服')
              || nextLine.includes('扫码')
              || nextLine.includes('下载')) {
            break;
          }
          content += nextLine + ' ';
          i++;
        }

        // 过滤无效条目
        if (title.length > 5 && content.trim().length > 10) {
          const trimmedContent = content.trim().replace(/\s+/g, ' ');
          items.push({
            title: title,
            content: trimmedContent,
            isComplete: checkContentComplete(trimmedContent)
          });
        }
      } else {
        i++;
      }
    }

    console.log(`✅ 成功提取 ${items.length} 条时政`);
    
    // 统计不完整条目
    const incompleteItems = items.filter(item => !item.isComplete);
    if (incompleteItems.length > 0) {
      console.log(`⚠️  发现 ${incompleteItems.length} 条可能不完整的内容，请手动核对：`);
      incompleteItems.forEach((item, index) => {
        console.log(`   ${index+1}. ${item.title}`);
      });
    }

    // 5. 输出结果（控制台+文件）
    const dateStr = new Date().toISOString().slice(0, 10);
    const result = {
      article: article,
      items: items,
      date: dateStr,
      total: items.length,
      incomplete: incompleteItems.length
    };

    // 保存到文件
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n💾 数据已保存到: ${OUTPUT_FILE}`);
    
    console.log('\n=== 时政数据预览 ===');
    items.forEach((item, index) => {
      const status = item.isComplete ? '✅' : '⚠️';
      console.log(`${status} ${index+1}. ${item.title}`);
    });

    return result;
  } finally {
    await browser.close();
    console.log('\n✨ 抓取完成');
  }
}

fetchWeeklyPolitics()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ 抓取失败:', err.message);
    console.error('   请检查网络连接或页面结构是否变更');
    process.exit(1);
  });