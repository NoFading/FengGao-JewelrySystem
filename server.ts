import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = './jewelry_data.json';
const STOCKTAKE_FILE = './stocktake_records.json';

// ================= 🔐 多账号密码配置区 =================
const ACCOUNTS: Record<string, string> = {
  "fenggao": "123456",  // 您的正式主账号
  "test": "123456"      // 专门给他人或自己测试的账号
};
// ===================================================================

const GH_TOKEN = process.env.GH_TOKEN;
const GH_REPO = process.env.GH_REPO;

function loadData(filepath: string = DATA_FILE): any[] {
  if (fs.existsSync(filepath)) {
    try {
      const content = fs.readFileSync(filepath, 'utf-8').trim();
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed;
        } else {
          console.error(`🚨 警告: ${filepath} 的内容不是数组类型，已自动重置为空数组。`);
          return [];
        }
      }
    } catch (e) {
      console.error(`加载 ${filepath} 失败:`, e);
    }
  }
  return [];
}

async function saveData(data: any, filepath: string = DATA_FILE, commitMsg: string = "🔄 数据同步") {
  const contentStr = JSON.stringify(data, null, 4);
  fs.writeFileSync(filepath, contentStr, 'utf-8');
  
  if (!GH_TOKEN || !GH_REPO) return;
  
  try {
    const filename = path.basename(filepath);
    const url = `https://api.github.com/repos/${GH_REPO}/contents/${filename}`;
    let sha: string | null = null;
    
    try {
      const getResp = await fetch(url, {
        headers: {
          'Authorization': `token ${GH_TOKEN}`,
          'User-Agent': 'Node-App-Sync'
        }
      });
      if (getResp.ok) {
        const getJson: any = await getResp.json();
        sha = getJson.sha;
      }
    } catch (e) {
      // Ignore reading error if file doesn't exist on git repo yet
    }
    
    const putData: any = {
      message: commitMsg,
      content: Buffer.from(contentStr, 'utf-8').toString('base64')
    };
    if (sha) {
      putData.sha = sha;
    }
    
    const putResp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Node-App-Sync'
      },
      body: JSON.stringify(putData)
    });
    
    if (putResp.ok) {
      console.log(`${filename} 同步到 GitHub 成功`);
    } else {
      const errText = await putResp.text();
      console.error(`${filename} 同步到 GitHub 失败:`, errText);
    }
  } catch (e: any) {
    console.error(`GitHub 同步网络错误:`, e.message);
  }
}

async function syncFromGitHubAtStartup() {
  if (!GH_TOKEN || !GH_REPO) {
    console.log("ℹ️ GitHub 环境变量（GH_TOKEN 或 GH_REPO）未配置，跳过启动时拉取最新数据。");
    return;
  }
  
  console.log("🔄 开始从 GitHub 拉取最新数据文件...");
  const filesToSync = [DATA_FILE, STOCKTAKE_FILE];
  
  for (const filepath of filesToSync) {
    try {
      const filename = path.basename(filepath);
      const url = `https://api.github.com/repos/${GH_REPO}/contents/${filename}`;
      const getResp = await fetch(url, {
        headers: {
          'Authorization': `token ${GH_TOKEN}`,
          'User-Agent': 'Node-App-Sync'
        }
      });
      if (getResp.ok) {
        const getJson: any = await getResp.json();
        const content = Buffer.from(getJson.content, 'base64').toString('utf-8');
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log(`✅ 成功拉取 ${filename} 并同步到本地。`);
      } else if (getResp.status === 404) {
        console.log(`ℹ️ GitHub 上未找到 ${filename} 文件。`);
      } else {
        console.error(`❌ 获取 ${filename} 失败，HTTP 状态码: ${getResp.status}`);
      }
    } catch (e: any) {
      console.error(`❌ 拉取 ${filepath} 发生网络异常:`, e.message);
    }
  }
}

function getBjToday(): string {
  // Bejing time is UTC+8
  const utc = new Date().getTime();
  const bjTime = new Date(utc + (3600000 * 8));
  
  const yyyy = bjTime.getUTCFullYear();
  const mm = String(bjTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(bjTime.getUTCDate()).padStart(2, '0');
  const hh = String(bjTime.getUTCHours()).padStart(2, '0');
  const min = String(bjTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(bjTime.getUTCSeconds()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

const get_current_user = (req: express.Request): string => {
  const username = req.headers['x-username'] as string;
  if (username && ACCOUNTS[username]) {
    return username;
  }
  return "guest";
};

const requires_auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const username = req.headers['x-username'] as string;
  const password = req.headers['x-password'] as string;
  
  if (username && password && ACCOUNTS[username] === password) {
    next();
  } else {
    res.status(401).json({ success: false, msg: '未授权访问，登录已过期或输入错误。' });
  }
};

// Multer storage for memory parsing
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ================= API Endpoints =================

// Verification Endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username && password && ACCOUNTS[username] === password) {
    res.json({ success: true, username });
  } else {
    res.status(401).json({ success: false, msg: '账号或密码不正确' });
  }
});

app.get('/api/inventory', requires_auth, async (req, res) => {
  const currentUser = get_current_user(req);
  const allData = loadData(DATA_FILE);
  const todayStr = getBjToday().split(' ')[0];
  
  const active_list: any[] = [];
  const sold_list: any[] = [];
  const today_sales_list: any[] = [];
  let today_money = 0.0;
  
  for (const item of allData) {
    const itemOwner = item.owner || 'fenggao';
    if (itemOwner !== currentUser) {
      continue;
    }
    
    const status = item.status || '在售';
    if (status === '已售出') {
      sold_list.push(item);
      if (item.sold_date === todayStr) {
        today_sales_list.push(item);
        try {
          const price = parseFloat(item.sold_price || 0);
          if (!isNaN(price)) today_money += price;
        } catch (e) {}
      }
    } else {
      active_list.push(item);
    }
  }
  
  res.json({
    active: active_list,
    sold: sold_list,
    today_count: today_sales_list.length,
    today_money: today_money,
    today_list: today_sales_list
  });
});

app.post('/api/parse_preview', requires_auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, msg: '未找到上传的文件' });
  }
  
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json<any>(worksheet);
    
    if (rawRows.length === 0) {
      return res.json({ success: false, msg: 'Excel文件内容为空' });
    }
    
    const sheetRowsArray = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    const headers = (sheetRowsArray[0] || []).map(h => String(h || '').trim()).filter(Boolean);
    let code_col: string | null = null;
    let name_col: string | null = null;
    let cate_col: string | null = null;
    let weight_col: string | null = null;
    let price_col: string | null = null;
    let fee_col: string | null = null;
    
    for (const col of headers) {
      const low_col = col.toLowerCase().trim();
      if (['条码', '标签', '编码', '码', 'code'].some(k => low_col.includes(k))) code_col = col;
      else if (['货品名称', '名称', '款式', 'name'].some(k => low_col.includes(k))) name_col = col;
      else if (['品类', '类型', '分类', 'category'].some(k => low_col.includes(k))) cate_col = col;
      else if (['克重', '金重', '重量', 'weight'].some(k => low_col.includes(k))) weight_col = col;
      else if (['标价', '标签价', '售价', 'price'].some(k => low_col.includes(k))) price_col = col;
      else if (['工费', '手艺费', '加工费', 'fee'].some(k => low_col.includes(k))) fee_col = col;
    }
    
    const missing_cols: string[] = [];
    if (!code_col) missing_cols.push("【条码】");
    if (!name_col) missing_cols.push("【货品名称】");
    if (!cate_col) missing_cols.push("【品类】");
    if (!weight_col) missing_cols.push("【金重】");
    if (!price_col) missing_cols.push("【标价】");
    if (!fee_col) missing_cols.push("【工费】");
    
    if (missing_cols.length > 0) {
      return res.json({ success: false, msg: `Excel 格式不合格！缺少必填列: ${missing_cols.join('')}，请修改后重新上传。` });
    }
    
    const preview_list: any[] = [];
    for (const row of rawRows) {
      const raw_code = row[code_col!];
      if (raw_code === undefined || raw_code === null) continue;
      const code_str = String(raw_code).trim().split('.')[0];
      if (!code_str) continue;
      
      const name_val = row[name_col!] !== undefined ? String(row[name_col!]).trim() : "未命名";
      const cate_val = row[cate_col!] !== undefined ? String(row[cate_col!]).trim() : "其他";
      
      const weight_num = parseFloat(row[weight_col!]);
      const weight_val = !isNaN(weight_num) ? String(Math.round(weight_num * 1000) / 1000) : "0";
      
      const price_num = parseFloat(row[price_col!]);
      const price_val = !isNaN(price_num) ? String(Math.round(price_num * 100) / 100) : "0";
      
      const fee_num = parseFloat(row[fee_col!]);
      const fee_val = !isNaN(fee_num) ? String(Math.round(fee_num * 100) / 100) : "0";
      
      preview_list.push({
        code: code_str,
        name: name_val,
        category: cate_val,
        weight: weight_val,
        price: price_val,
        fee: fee_val
      });
    }
    
    res.json({ success: true, data: preview_list });
  } catch (e: any) {
    res.json({ success: false, msg: `解析出错，请检查内容格式。原因: ${e.message}` });
  }
});

app.post('/api/confirm_save', requires_auth, async (req, res) => {
  const currentUser = get_current_user(req);
  const new_items: any[] = req.body.data || [];
  const current_data = loadData(DATA_FILE);
  
  const user_item_map: Record<string, number> = {};
  for (let i = 0; i < current_data.length; i++) {
    const item = current_data[i];
    if ((item.owner || 'fenggao') === currentUser) {
      user_item_map[String(item.code).trim()] = i;
    }
  }
  
  let added_count = 0;
  let updated_count = 0;
  let skipped_sold_count = 0;
  
  for (const item of new_items) {
    const code_str = String(item.code).trim();
    
    if (code_str in user_item_map) {
      const idx = user_item_map[code_str];
      if (current_data[idx].status === '已售出') {
        skipped_sold_count++;
        continue;
      }
      
      current_data[idx].name = item.name;
      current_data[idx].category = item.category;
      current_data[idx].weight = item.weight;
      current_data[idx].price = item.price;
      current_data[idx].fee = item.fee;
      updated_count++;
    } else {
      current_data.push({
        code: code_str,
        name: item.name,
        category: item.category,
        weight: item.weight,
        price: item.price,
        fee: item.fee,
        status: "在售",
        owner: currentUser
      });
      user_item_map[code_str] = current_data.length - 1;
      added_count++;
    }
  }
  
  const commit_msg = `🔄 批量入库同步：新增 ${added_count} 件，更新 ${updated_count} 件，跳过已售货品 ${skipped_sold_count} 件 (账户: ${currentUser})`;
  await saveData(current_data, DATA_FILE, commit_msg);
  
  let msg_details = `🎉 入库处理完毕！\n➕ 成功上架新品：${added_count} 件\n🔄 覆盖更新旧货：${updated_count} 件`;
  if (skipped_sold_count > 0) {
    msg_details += `\n⚠️ 自动跳过已售出历史条码：${skipped_sold_count} 件（已锁定保护）`;
  }
  
  res.json({ success: true, msg: msg_details });
});

app.post('/api/checkout', requires_auth, async (req, res) => {
  const currentUser = get_current_user(req);
  const code = String(req.body.code || '').trim();
  const sold_price = String(req.body.sold_price || '').trim();
  const current_data = loadData(DATA_FILE);
  const todayStr = getBjToday().split(' ')[0];
  
  let found = false;
  for (const item of current_data) {
    if (String(item.code).trim() === code && (item.owner || 'fenggao') === currentUser) {
      if (item.status === '已售出') {
        return res.json({ success: false, msg: '⚠️ 该货品已售出' });
      }
      item.status = '已售出';
      item.sold_date = todayStr;
      item.sold_price = sold_price;
      found = true;
      break;
    }
  }
  
  if (found) {
    await saveData(current_data, DATA_FILE, `🛍 账户(${currentUser})货品 ${code} 售出记账`);
    res.json({ success: true, msg: '🛍 销售成功！' });
  } else {
    res.json({ success: false, msg: '❌ 未找到属于您的此货品' });
  }
});

app.post('/api/return_item', requires_auth, async (req, res) => {
  const currentUser = get_current_user(req);
  const code = String(req.body.code || '').trim();
  const current_data = loadData(DATA_FILE);
  
  let found = false;
  for (const item of current_data) {
    if (String(item.code).trim() === code && (item.owner || 'fenggao') === currentUser) {
      if (item.status === '在售') {
        return res.json({ success: false, msg: '⚠️ 该货品当前在售' });
      }
      item.status = '在售';
      delete item.sold_date;
      delete item.sold_price;
      found = true;
      break;
    }
  }
  
  if (found) {
    await saveData(current_data, DATA_FILE, `🔄 账户(${currentUser})货品 ${code} 退货核销`);
    res.json({ success: true, msg: '🔄 退货核销成功！' });
  } else {
    res.json({ success: false, msg: '❌ 未找到记录' });
  }
});

app.post('/api/stocktake/submit', requires_auth, async (req, res) => {
  const currentUser = get_current_user(req);
  const report = req.body || {};
  report.timestamp = getBjToday();
  report.owner = currentUser;
  
  const history = loadData(STOCKTAKE_FILE);
  history.push(report);
  
  await saveData(history, STOCKTAKE_FILE, `📋 账户(${currentUser})上传盘点报告`);
  res.json({ success: true, msg: '🏁 盘点报告已成功上传！' });
});

app.get('/api/stocktake/history', requires_auth, async (req, res) => {
  const currentUser = get_current_user(req);
  const allHistory = loadData(STOCKTAKE_FILE);
  const userHistory = allHistory.filter(h => (h.owner || 'fenggao') === currentUser);
  res.json(userHistory);
});

// Configure serving frontend static files
const isProd = process.env.NODE_ENV === 'production';
if (!isProd) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Use dist/ directory for static files in production
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = 3000;
await syncFromGitHubAtStartup();
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
