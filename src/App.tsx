import { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  FileSpreadsheet, 
  ClipboardCheck, 
  Search, 
  PlusCircle, 
  RotateCcw, 
  Camera, 
  Lock, 
  User, 
  ChevronRight, 
  ChevronLeft, 
  LogOut, 
  FileText, 
  CheckCircle2, 
  HelpCircle,
  Gem,
  Calculator,
  ArrowRightLeft
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface JewelryItem {
  code: string;
  name: string;
  category: string;
  weight: string;
  price?: string;
  fee?: string;
  tag_price?: string;
  wage?: string;
  status: '在售' | '已售出';
  sold_date?: string;
  sold_price?: string;
  owner?: string;
}

interface StocktakeItem extends JewelryItem {
  scanned: boolean;
}

interface StocktakeReport {
  timestamp: string;
  owner: string;
  total_expected: number;
  total_found: number;
  total_missing: number;
  missing_details: JewelryItem[];
}

export default function App() {
  // Authentication State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState('');

  // Main UI Data State
  const [activeInventory, setActiveInventory] = useState<JewelryItem[]>([]);
  const [soldInventory, setSoldInventory] = useState<JewelryItem[]>([]);
  const [todaySales, setTodaySales] = useState<JewelryItem[]>([]);
  const [todayAmount, setTodayAmount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [stocktakeHistory, setStocktakeHistory] = useState<StocktakeReport[]>([]);

  // Toggle state for today sold details
  const [showTodayDetails, setShowTodayDetails] = useState(false);

  // Active Tab Controls
  const [activeOpTab, setActiveOpTab] = useState<'sale' | 'import' | 'stocktake'>('sale');
  const [activeViewTab, setActiveViewTab] = useState<'inventory' | 'sold' | 'stocktakeHistory'>('inventory');

  // Operational State (Sale & Return)
  const [currentMode, setCurrentMode] = useState<'sale' | 'return'>('sale');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [actualPriceInput, setActualPriceInput] = useState('');

  // Scanner State
  const [scannerActive, setScannerActive] = useState(false);
  const [activeScannerType, setActiveScannerType] = useState<'sale' | 'stocktake' | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Bulk Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewList, setPreviewList] = useState<JewelryItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stocktake Operations State
  const [stocktakeActive, setStocktakeActive] = useState(false);
  const [localStocktakeItems, setLocalStocktakeItems] = useState<StocktakeItem[]>([]);
  const [isStCollapsed, setIsStCollapsed] = useState(true);
  const [stocktakeBarcodeInput, setStocktakeBarcodeInput] = useState('');
  const [stocktakeSearch, setStocktakeSearch] = useState('');
  const [stCurrentPage, setStCurrentPage] = useState(1);
  const stPageSize = 5;

  // Search Filters
  const [searchInventoryHost, setSearchInventoryHost] = useState('');
  const [searchSoldHost, setSearchSoldHost] = useState('');

  // Pagination Settings
  const [paginations, setPaginations] = useState({
    inventory: { current: 1, size: 5 },
    sold: { current: 1, size: 5 },
    today: { current: 1, size: 10 }
  });

  // Modal State for stocktake details
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<StocktakeReport | null>(null);

  // Initial Check for local credentials
  useEffect(() => {
    const savedUser = localStorage.getItem('township_jewelry_user');
    const savedPass = localStorage.getItem('township_jewelry_pass');
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setIsLoggedIn(true);
    }
  }, []);

  // Sync data when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadAllData();
    } else {
      // Clear data on logout
      setActiveInventory([]);
      setSoldInventory([]);
      setTodaySales([]);
      setTodayAmount(0);
      setTodayCount(0);
      setStocktakeHistory([]);
    }
  }, [isLoggedIn]);

  // Headers generator helper
  const getAuthHeaders = () => {
    const user = isLoggedIn ? username : localStorage.getItem('township_jewelry_user') || '';
    const pass = isLoggedIn ? password : localStorage.getItem('township_jewelry_pass') || '';
    return {
      'x-username': user,
      'x-password': pass,
      'Content-Type': 'application/json'
    };
  };

  const loadAllData = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch('/api/inventory', { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveInventory(data.active || []);
        setSoldInventory(data.sold || []);
        setTodaySales(data.today_list || []);
        setTodayAmount(data.today_money || 0);
        setTodayCount(data.today_count || 0);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (e) {
      console.error("加载数据失败", e);
    }
  };

  const loadStocktakeHistory = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch('/api/stocktake/history', { headers });
      if (res.ok) {
        const data = await res.json();
        setStocktakeHistory(data);
      }
    } catch (e) {
      console.error("加载盘点历史失败", e);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        localStorage.setItem('township_jewelry_user', username);
        localStorage.setItem('township_jewelry_pass', password);
        setIsLoggedIn(true);
      } else {
        const data = await res.json();
        setAuthError(data.msg || '登录未授权');
      }
    } catch (e) {
      setAuthError('由于网络问题，登录无法连接服务器');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('township_jewelry_user');
    localStorage.removeItem('township_jewelry_pass');
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
  };

  // Category Colors
  const getCategoryColor = (category: string) => {
    const val = String(category || '').trim();
    if (val.includes('戒') || val.includes('耳')) {
      return 'bg-pink-50 text-pink-600 border border-pink-200';
    } else if (val.includes('链')) {
      return 'bg-blue-50 text-blue-600 border border-blue-200';
    } else if (val.includes('镯')) {
      return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
    } else if (val.includes('坠')) {
      return 'bg-purple-50 text-purple-600 border border-purple-200';
    }
    return 'bg-gray-50 text-gray-600 border border-gray-200';
  };

  // Cam Scanning Methods
  const toggleScanner = async (type: 'sale' | 'stocktake') => {
    if (scannerActive) {
      await stopScanner();
    } else {
      setScannerActive(true);
      setActiveScannerType(type);
      const scannerId = type === 'sale' ? 'reader' : 'stocktakeReader';
      
      setTimeout(() => {
        const html5Qrcode = new Html5Qrcode(scannerId);
        scannerRef.current = html5Qrcode;
        html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (type === 'sale') {
              setBarcodeInput(decodedText);
              stopScanner();
            } else {
              processStocktakeCode(decodedText);
            }
          },
          () => {} // Silent errors from camera frame capture
        ).catch(err => {
          console.error(err);
          alert("无法启动摄像头：" + err);
          setScannerActive(false);
          setActiveScannerType(null);
        });
      }, 100);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Camera stop error:", e);
      }
      scannerRef.current = null;
    }
    setScannerActive(false);
    setActiveScannerType(null);
  };

  // Operation executor
  const handleExecuteOperation = async () => {
    const code = barcodeInput.trim();
    if (!code) {
      alert('请先输入或扫描货品条码！');
      return;
    }

    const headers = getAuthHeaders();
    if (currentMode === 'sale') {
      const price = actualPriceInput.trim();
      if (!price) {
        alert('请输入实收金额！');
        return;
      }
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers,
          body: JSON.stringify({ code, sold_price: price })
        });
        const data = await res.json();
        alert(data.msg);
        if (data.success) {
          setBarcodeInput('');
          setActualPriceInput('');
          loadAllData();
        }
      } catch (e) {
        alert('销售提交网络异常');
      }
    } else {
      if (!window.confirm(`确认办理条码【${code}】的退货并将其重新放回在售库存吗？`)) return;
      try {
        const res = await fetch('/api/return_item', {
          method: 'POST',
          headers,
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        alert(data.msg);
        if (data.success) {
          setBarcodeInput('');
          loadAllData();
        }
      } catch (e) {
        alert('退货提交网络异常');
      }
    }
  };

  // Excel handlers
  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
    }
  };

  const uploadExcel = async () => {
    if (!excelFile) {
      alert('请先选择 Excel 文件！');
      return;
    }
    const formData = new FormData();
    formData.append('file', excelFile);

    const user = username || localStorage.getItem('township_jewelry_user') || '';
    const pass = password || localStorage.getItem('township_jewelry_pass') || '';

    try {
      const res = await fetch('/api/parse_preview', {
        method: 'POST',
        headers: {
          'x-username': user,
          'x-password': pass,
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setPreviewList(data.data || []);
        setShowPreview(true);
      } else {
        alert('导入已被阻止原因:\n' + data.msg);
      }
    } catch (e) {
      alert('Excel 解析接口网络请求故障');
    }
  };

  const confirmImport = async () => {
    if (previewList.length === 0) return;
    try {
      const res = await fetch('/api/confirm_save', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: previewList })
      });
      const data = await res.json();
      alert(data.msg);
      cancelImport();
      loadAllData();
    } catch (e) {
      alert('上架确认请求失败');
    }
  };

  const cancelImport = () => {
    setPreviewList([]);
    setShowPreview(false);
    setExcelFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Stocktake Actions
  const startLocalStocktake = () => {
    if (activeInventory.length === 0) {
      alert("当前店内没有任何在售存货，无需开启盘点！");
      return;
    }
    const items = activeInventory.map(item => ({
      ...item,
      scanned: false
    }));
    setLocalStocktakeItems(items);
    setStocktakeActive(true);
    setIsStCollapsed(true);
    setStCurrentPage(1);
    setStocktakeBarcodeInput('');
    setStocktakeSearch('');
  };

  const processStocktakeCode = (code: string) => {
    const rawCode = String(code).trim();
    if (!rawCode) return;

    let found = false;
    const updated = localStocktakeItems.map(item => {
      if (String(item.code).trim() === rawCode) {
        found = true;
        return { ...item, scanned: true };
      }
      return item;
    });

    if (!found) {
      alert(`⚠️ 警告: 条码【${rawCode}】不属于【${username}】的店内在售库存！`);
    } else {
      setLocalStocktakeItems(updated);
    }
  };

  const handleManualStocktakeCheck = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && stocktakeBarcodeInput.trim()) {
      processStocktakeCode(stocktakeBarcodeInput.trim());
      setStocktakeBarcodeInput('');
    }
  };

  const handleManualStocktakeClick = () => {
    if (stocktakeBarcodeInput.trim()) {
      processStocktakeCode(stocktakeBarcodeInput.trim());
      setStocktakeBarcodeInput('');
    }
  };

  const finishStocktakeSubmit = async () => {
    const missing = localStocktakeItems.filter(item => !item.scanned);
    const foundCount = localStocktakeItems.filter(item => item.scanned).length;
    
    if (missing.length > 0) {
      if (!window.confirm(`⚠️ 盘点发现账面缺失【${missing.length}】件货品！\n如果是因丢件、错帐，请点击“确定”保存该盘亏报告；\n若只是漏网了，可点“取消”之后继续扫码补抓。`)) {
        return;
      }
    } else {
      alert('🎉 恭喜！全盘皆齐，无账面资产流失！');
    }

    const report = {
      total_expected: localStocktakeItems.length,
      total_found: foundCount,
      total_missing: missing.length,
      missing_details: missing
    };

    try {
      const res = await fetch('/api/stocktake/submit', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(report)
      });
      const data = await res.json();
      alert(data.msg);
      setStocktakeActive(false);
      loadAllData();
      if (activeViewTab === 'stocktakeHistory') {
        loadStocktakeHistory();
      }
    } catch (e) {
      alert('上传盘点报告网络错误');
    }
  };

  const cancelStocktakeReset = () => {
    if (window.confirm("确定放弃本次盘点吗？已扫码标记的数据将会丢失。")) {
      setStocktakeActive(false);
      setLocalStocktakeItems([]);
    }
  };

  // Table Pagination Helpers
  const getPagedData = (data: any[], type: 'inventory' | 'sold' | 'today') => {
    const config = paginations[type];
    
    // Sort logic if needed, otherwise filter first
    let filtered = data;
    if (type === 'inventory' && searchInventoryHost.trim()) {
      const q = searchInventoryHost.trim().toLowerCase();
      filtered = data.filter(i => 
        String(i.code).toLowerCase().includes(q) || 
        String(i.name).toLowerCase().includes(q) || 
        String(i.category).toLowerCase().includes(q)
      );
    } else if (type === 'sold' && searchSoldHost.trim()) {
      const q = searchSoldHost.trim().toLowerCase();
      filtered = data.filter(i => 
        String(i.code).toLowerCase().includes(q) || 
        String(i.name).toLowerCase().includes(q) || 
        String(i.category).toLowerCase().includes(q)
      );
    }

    const totalPages = Math.ceil(filtered.length / config.size) || 1;
    const current = Math.min(config.current, totalPages);
    const start = (current - 1) * config.size;
    const end = start + config.size;

    return {
      items: filtered.slice(start, end),
      current,
      totalPages,
      totalCount: filtered.length
    };
  };

  const changePage = (type: 'inventory' | 'sold' | 'today', direction: 'prev' | 'next') => {
    setPaginations(prev => {
      const config = prev[type];
      let newPage = config.current;
      if (direction === 'prev') {
        newPage = Math.max(1, config.current - 1);
      } else {
        newPage = config.current + 1; // getPagedData bounds it anyway
      }
      return {
        ...prev,
        [type]: { ...config, current: newPage }
      };
    });
  };

  // Stocktake Missing List View
  const getStocktakeMissingData = () => {
    let filtered = localStocktakeItems.filter(item => !item.scanned);
    if (stocktakeSearch.trim()) {
      const q = stocktakeSearch.trim().toLowerCase();
      filtered = filtered.filter(item => 
        String(item.code).toLowerCase().includes(q) || 
        String(item.name).toLowerCase().includes(q) || 
        String(item.category).toLowerCase().includes(q)
      );
    }
    
    const count = filtered.length;
    let displayed = filtered;
    if (isStCollapsed) {
      displayed = filtered.slice(0, 5);
    } else {
      const totalPages = Math.ceil(count / stPageSize) || 1;
      const current = Math.min(stCurrentPage, totalPages);
      const start = (current - 1) * stPageSize;
      const end = start + stPageSize;
      displayed = filtered.slice(start, end);
    }

    return {
      displayed,
      count,
      totalPages: Math.ceil(count / stPageSize) || 1
    };
  };

  const { displayed: stocktakeMissingItems, count: stocktakeMissingCount, totalPages: stTotalPages } = getStocktakeMissingData();

  // If not logged in, display authentic style Login Gate
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8 select-none">
        <div id="login-container" className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl border border-slate-100 transition-all">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center text-white mb-3 shadow-md shadow-amber-500/20">
              <Gem className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-red-600 bg-clip-text text-transparent">峰高珠宝管理系统</h1>
            <p className="text-slate-400 text-xs mt-1">乡镇手机极速版 • 零售与盘点终端</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-500 text-xs font-semibold mb-1">管理员账号</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入您的登录用户名" 
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 text-xs font-semibold mb-1">系统密码</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入您的登录密码" 
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-2.5 rounded-lg flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-semibold text-sm py-2.5 rounded-xl shadow-lg shadow-red-500/10 active:scale-[0.98] transition-all"
            >
              登录并解锁系统
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-4 text-[10px] text-slate-300">
            © 2026 峰高黄金珠宝专营店 • 所有数据已实施多重保密同步
          </div>
        </div>
      </div>
    );
  }

  // Header stats pagination helper
  const inventoryPaged = getPagedData(activeInventory, 'inventory');
  const soldPaged = getPagedData(soldInventory, 'sold');
  const todayPaged = getPagedData(todaySales, 'today');

  return (
    <div id="main-app" className="min-h-screen bg-slate-50 select-none pb-12">
      {/* Top Navigation Frame */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white">
            <Gem className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">峰高珠宝管理终端</h1>
            <p className="text-[10px] text-slate-400 font-medium">账户: {username} • v7.6 极速款</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-1 py-1 px-2.5 border border-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-xs font-semibold active:scale-95 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>登出</span>
        </button>
      </header>

      {/* Main Body */}
      <main className="max-w-md mx-auto p-3.5 space-y-3.5">
        
        {/* Core Sales Cumulative Dashboard Panel */}
        <section 
          onClick={() => setShowTodayDetails(!showTodayDetails)}
          className="bg-gradient-to-br from-amber-500 to-rose-600 text-white rounded-2xl p-4.5 shadow-md shadow-red-500/10 relative overflow-hidden active:opacity-95 cursor-pointer select-none transition-all"
        >
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-15 select-none pointer-events-none">
            <Calculator className="w-36 h-36 rotate-12" />
          </div>
          
          <div className="relative">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-75">💰 今日累计实收销售额</span>
            <div className="text-3xl font-extrabold mt-1 tracking-tight">
              ¥ {todayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs opacity-90 mt-2 font-medium flex items-center gap-1.5 justify-start">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
              <span>今日已售出: {todayCount} 件货品 (点击查看底细)</span>
            </div>
          </div>
        </section>

        {/* Today Sales Ledger Collapse Box */}
        {showTodayDetails && (
          <section id="todayDetailBox" className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-1.5 border-l-4 border-rose-500 pl-2 mb-3">
              <ShoppingBag className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-800">🛍️ 今日卖出商品明细</h2>
            </div>
            
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-rose-50 text-rose-700">
                    <th className="p-2.5 font-bold">条码</th>
                    <th className="p-2.5 font-bold">货品名称</th>
                    <th className="p-2.5 font-bold">品类</th>
                    <th className="p-2.5 font-bold">金重(g)</th>
                    <th className="p-2.5 font-bold">实际售价</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {todayPaged.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 bg-slate-50/50">
                        今日暂未开单
                      </td>
                    </tr>
                  ) : (
                    todayPaged.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 select-text">
                        <td className="p-2.5 font-bold text-amber-600">{item.code}</td>
                        <td className="p-2.5 text-slate-700">{item.name}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getCategoryColor(item.category)}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500">{item.weight}g</td>
                        <td className="p-2.5 text-rose-600 font-bold">¥{item.sold_price}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for today details */}
            {todayPaged.totalCount > paginations.today.size && (
              <div className="flex items-center justify-between mt-3 text-xs text-slate-500" id="pagerToday">
                <span>共 {todayPaged.totalCount} 条</span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => changePage('today', 'prev')} 
                    disabled={todayPaged.current === 1}
                    className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 transition-all font-bold active:bg-slate-100"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-slate-700">{todayPaged.current} / {todayPaged.totalPages}</span>
                  <button 
                    onClick={() => changePage('today', 'next')} 
                    disabled={todayPaged.current === todayPaged.totalPages}
                    className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 transition-all font-bold active:bg-slate-100"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Operating Suite Tab Block */}
        <section className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm space-y-3.5">
          {/* Top segment control */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold text-slate-500 text-center">
            <button 
              onClick={() => { setActiveOpTab('sale'); stopScanner(); }}
              className={`py-2 rounded-lg transition-all ${activeOpTab === 'sale' ? 'bg-white text-rose-600 border-b-2 border-rose-500 shadow-sm' : 'hover:bg-white/50'}`}
            >
              🛒 柜台商品销售
            </button>
            <button 
              onClick={() => { setActiveOpTab('import'); stopScanner(); }}
              className={`py-2 rounded-lg transition-all ${activeOpTab === 'import' ? 'bg-white text-blue-600 border-b-2 border-blue-500 shadow-sm' : 'hover:bg-white/50'}`}
            >
              📦 批量货品入库
            </button>
            <button 
              onClick={() => { setActiveOpTab('stocktake'); stopScanner(); }}
              className={`py-2 rounded-lg transition-all ${activeOpTab === 'stocktake' ? 'bg-white text-purple-600 border-b-2 border-purple-500 shadow-sm' : 'hover:bg-white/50'}`}
            >
              🔍 手机极速盘点
            </button>
          </div>

          {/* Op Content Blocks */}

          {/* TAB 1: COUNTER SALES AND RETURN */}
          {activeOpTab === 'sale' && (
            <div id="contentOp1" className="space-y-3.5">
              <button 
                onClick={() => toggleScanner('sale')}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm text-white transition-all active:scale-95 ${scannerActive && activeScannerType === 'sale' ? 'bg-rose-600' : 'bg-rose-500 hover:bg-rose-600'}`}
              >
                <Camera className="w-4 h-4" />
                <span>{scannerActive && activeScannerType === 'sale' ? '📷 关闭摄像头扫码' : '📷 开启极速扫码销售'}</span>
              </button>

              <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-black transition-all" style={{ display: scannerActive && activeScannerType === 'sale' ? 'block' : 'none' }}></div>

              <div className="border-t border-slate-100 pt-3 flex flex-col gap-1">
                <span className="text-[11px] text-slate-500 font-semibold mb-1">请选择当前柜台操作行为:</span>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button 
                    onClick={() => setCurrentMode('sale')}
                    className={`py-2 border rounded-xl transition-all ${currentMode === 'sale' ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    🛍️ 正常销售记账
                  </button>
                  <button 
                    onClick={() => setCurrentMode('return')}
                    className={`py-2 border rounded-xl transition-all ${currentMode === 'return' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    🔄 办理退货核销
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1" id="barcodeTitle">
                    第一步: 输入或扫描货品条码
                  </label>
                  <input 
                    type="text" 
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="请扫码或在此手动输入条码号"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 select-text text-amber-700 font-bold tracking-wider placeholder:text-slate-300"
                  />
                </div>

                {currentMode === 'sale' && (
                  <div id="priceInputArea" className="relative animate-fadeIn">
                    <label className="block text-[11px] font-semibold text-rose-500 mb-1">
                      第二步: 实收客户金额 (实际售价 ¥)
                    </label>
                    <input 
                      type="number" 
                      value={actualPriceInput}
                      onChange={(e) => setActualPriceInput(e.target.value)}
                      placeholder="请输入最终实收总价金额"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 select-text text-slate-800 font-bold placeholder:text-slate-300"
                    />
                  </div>
                )}
              </div>

              <button 
                onClick={handleExecuteOperation}
                className={`w-full font-bold text-sm text-white py-2.5 rounded-xl transition-all active:scale-[0.98] ${currentMode === 'sale' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/10' : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10'}`}
              >
                {currentMode === 'sale' ? '💰 确认销售并记账' : '🔄 确认退货并恢复库存'}
              </button>
            </div>
          )}

          {/* TAB 2: EXCEL IMPORT TICKET */}
          {activeOpTab === 'import' && (
            <div id="contentOp2" className="space-y-3">
              <div className="bg-rose-50 border border-rose-200/60 p-3 rounded-xl text-[11px] text-rose-900 leading-relaxed font-medium space-y-1">
                <span className="font-extrabold text-[12px] text-rose-700 flex items-center gap-1.5 mb-1.5">
                  ⚠️ 批量导入 Excel 严格规范说明:
                </span>
                <p>
                  表格首行<b>必须完整包含以下 6 核心标题</b> (顺序可不限, 列字不能错):
                </p>
                <div className="flex flex-wrap gap-1 py-1">
                  {['条码', '货品名称', '品类', '金重', '标价', '工费'].map((item, idx) => (
                    <span key={idx} className="bg-white border border-rose-300 text-rose-700 px-1.5 py-0.5 rounded font-extrabold text-[10px]">
                      {item}
                    </span>
                  ))}
                </div>
                <p className="text-slate-500 text-[10px] mt-1 font-normal">
                  💡 提示：系统支持模糊匹配这些列标题。
                </p>
              </div>

              <div className="space-y-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleExcelSelect} 
                  accept=".xlsx, .xls"
                  className="w-full text-xs font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 active:bg-slate-100 transition-all"
                />
                
                <button 
                  onClick={uploadExcel}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  选择并解析新货 Excel
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PHONE STOCKTAKE ACCELERATION */}
          {activeOpTab === 'stocktake' && (
            <div id="contentOp3" className="space-y-3">
              {!stocktakeActive ? (
                <div id="stocktakeSetup" className="py-2.5">
                  <button 
                    onClick={startLocalStocktake}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm py-2.5 rounded-xl shadow-md shadow-purple-600/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>🟢 开启手机离线盘点</span>
                  </button>
                </div>
              ) : (
                <div id="stocktakeActiveZone" className="space-y-3 animate-fadeIn">
                  <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-3 flex justify-between items-center select-none text-xs">
                    <span className="font-bold text-purple-800">📊 盘点进度：</span>
                    <span className="text-sm font-extrabold text-purple-700" id="stProgressText">
                      {localStocktakeItems.filter(i => i.scanned).length} 已盘 / {localStocktakeItems.length} 总在售数
                    </span>
                  </div>

                  <button 
                    onClick={() => toggleScanner('stocktake')}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm text-white transition-all active:scale-95 ${scannerActive && activeScannerType === 'stocktake' ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>{scannerActive && activeScannerType === 'stocktake' ? '📷 关闭摄像头盘点' : '📷 开启盘点专用扫码'}</span>
                  </button>

                  <div id="stocktakeReader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-black" style={{ display: scannerActive && activeScannerType === 'stocktake' ? 'block' : 'none' }}></div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={stocktakeBarcodeInput}
                      onChange={(e) => setStocktakeBarcodeInput(e.target.value)}
                      onKeyDown={handleManualStocktakeCheck}
                      placeholder="条码漏打可手输, 按回车查"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold select-text placeholder:text-slate-300"
                    />
                    <button 
                      onClick={handleManualStocktakeClick}
                      className="bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 px-3 py-1 flex items-center justify-center font-bold text-xs rounded-xl active:scale-95 transition-all"
                    >
                      检入
                    </button>
                  </div>

                  {/* Missing items display area */}
                  <div className="border border-purple-100 rounded-xl p-2.5 bg-white space-y-2.5">
                    <div className="flex items-center justify-between border-b border-purple-50 pb-2">
                      <span className="text-xs font-bold text-amber-700">缺失警报 ({stocktakeMissingCount}件未核对)</span>
                      <input 
                        type="text" 
                        value={stocktakeSearch}
                        onChange={(e) => { setStocktakeSearch(e.target.value); setStCurrentPage(1); }}
                        placeholder="智能检索缺失项..."
                        className="text-[10px] w-36 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 placeholder:text-slate-300 select-text"
                      />
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse" id="stocktakeListWrapper">
                        <thead>
                          <tr className="bg-purple-50 text-purple-800">
                            <th className="p-1.5 font-bold">条码</th>
                            <th className="p-1.5 font-bold">货品名称</th>
                            <th className="p-1.5 font-bold">品类</th>
                            <th className="p-1.5 font-bold">金重</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50 font-medium">
                          {stocktakeMissingItems.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-3 text-center text-emerald-600 bg-emerald-50/50 font-bold">
                                🎉 已全盘齐！
                              </td>
                            </tr>
                          ) : (
                            stocktakeMissingItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 select-text">
                                <td className="p-1.5 font-bold text-amber-700">{item.code}</td>
                                <td className="p-1.5 text-slate-700">{item.name}</td>
                                <td className="p-1.5">
                                  <span className={`px-1 rounded text-[9px] font-bold ${getCategoryColor(item.category)}`}>
                                    {item.category}
                                  </span>
                                </td>
                                <td className="p-1.5 text-slate-500">{item.weight}g</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Show All Toggle */}
                    {stocktakeMissingCount > 5 && (
                      <button 
                        onClick={() => setIsStCollapsed(!isStCollapsed)}
                        className="w-full py-1 bg-slate-50 hover:bg-slate-100 border border-dashed border-purple-300 text-purple-700 font-extrabold text-[10px] rounded-lg active:scale-98 transition-all"
                        id="toggleShowAllBtn"
                      >
                        {isStCollapsed ? `展开完整名单 (查余下 ${stocktakeMissingCount - 5} 件)` : '折叠展现行数'}
                      </button>
                    )}

                    {/* Stocktake Local Pagination */}
                    {!isStCollapsed && stocktakeMissingCount > stPageSize && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500" id="stocktakeLocalPager">
                        <span>共 {stocktakeMissingCount} 条</span>
                        <div className="flex items-center gap-1 p-0.5">
                          <button 
                            disabled={stCurrentPage === 1}
                            onClick={() => setStCurrentPage(p => Math.max(1, p - 1))}
                            className="px-1.5 py-0.5 border border-slate-100 rounded bg-slate-50 disabled:opacity-40"
                          >
                            ◀
                          </button>
                          <span className="font-extrabold">{stCurrentPage} / {stTotalPages}</span>
                          <button 
                            disabled={stCurrentPage === stTotalPages}
                            onClick={() => setStCurrentPage(p => Math.min(stTotalPages, p + 1))}
                            className="px-1.5 py-0.5 border border-slate-100 rounded bg-slate-50 disabled:opacity-40"
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={finishStocktakeSubmit}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      🏁 结束盘点并保存报告
                    </button>
                    <button 
                      onClick={cancelStocktakeReset}
                      className="w-20 bg-slate-500 hover:bg-slate-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      放弃
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Inbound Preview Zone Card */}
        {showPreview && previewList.length > 0 && (
          <section id="previewZone" className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl shadow-sm animate-fadeIn space-y-3">
            <div className="flex items-center gap-1 border-l-4 border-amber-500 pl-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-amber-900">⚠️ 待入库新货安全预览</h2>
            </div>

            <div className="overflow-x-auto max-h-48 border border-amber-100 rounded-xl bg-white select-text">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-amber-50 text-amber-800">
                    <th className="p-2 font-bold">条码</th>
                    <th className="p-2 font-bold">货品名称</th>
                    <th className="p-2 font-bold">品类</th>
                    <th className="p-2 font-bold">金重</th>
                    <th className="p-2 font-bold">标签标价</th>
                    <th className="p-2 font-bold">工费</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 font-medium">
                  {previewList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/30">
                      <td className="p-2 font-bold text-amber-600">{item.code}</td>
                      <td className="p-2 text-slate-800">{item.name}</td>
                      <td className="p-2 text-slate-500">{item.category}</td>
                      <td className="p-2 text-slate-500">{item.weight}g</td>
                      <td className="p-2 text-slate-700">¥{item.price}</td>
                      <td className="p-2 text-slate-500">¥{item.fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-1.5">
              <button 
                onClick={confirmImport}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-sm active:scale-95"
              >
                确认锁库存上架
              </button>
              <button 
                onClick={cancelImport}
                className="bg-slate-500 hover:bg-slate-600 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-sm active:scale-95"
              >
                取消
              </button>
            </div>
          </section>
        )}

        {/* View Suite Tab Block (Tables and Reports) */}
        <section className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm space-y-3.5">
          {/* View Tab selectors */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold text-slate-505 text-center">
            <button 
              onClick={() => setActiveViewTab('inventory')}
              className={`py-2 rounded-lg transition-all ${activeViewTab === 'inventory' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500 shadow-sm' : 'hover:bg-white/50 text-slate-500'}`}
            >
              🟢 店内在售
            </button>
            <button 
              onClick={() => setActiveViewTab('sold')}
              className={`py-2 rounded-lg transition-all ${activeViewTab === 'sold' ? 'bg-white text-amber-600 border-b-2 border-amber-500 shadow-sm' : 'hover:bg-white/50 text-slate-500'}`}
            >
              📜 已售账本
            </button>
            <button 
              onClick={() => { setActiveViewTab('stocktakeHistory'); loadStocktakeHistory(); }}
              className={`py-2 rounded-lg transition-all ${activeViewTab === 'stocktakeHistory' ? 'bg-white text-indigo-600 border-b-2 border-indigo-500 shadow-sm' : 'hover:bg-white/50 text-slate-500'}`}
            >
              📋 盘点报告
            </button>
          </div>

          {/* Table Contents */}

          {/* SUB-TAB 1: STORE INVENTORY */}
          {activeViewTab === 'inventory' && (
            <div id="contentView1" className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={searchInventoryHost}
                  onChange={(e) => { setSearchInventoryHost(e.target.value); setPaginations(prev => ({ ...prev, inventory: { ...prev.inventory, current: 1 } })); }}
                  id="inventorySearchInput"
                  placeholder="⚡ 输入条码、货名或品类实时过滤..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border-2 border-emerald-500 rounded-xl focus:outline-none placeholder:text-slate-300 font-medium select-text"
                />
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-100">
                      <th className="p-2.5 font-bold">条码</th>
                      <th className="p-2.5 font-bold">货品名称</th>
                      <th className="p-2.5 font-bold">品类</th>
                      <th className="p-2.5 font-bold">金重</th>
                      <th className="p-2.5 font-bold">标价</th>
                      <th className="p-2.5 font-bold">工费</th>
                      <th className="p-2.5 font-bold text-emerald-600">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {inventoryPaged.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          🔍 未找到相关匹配存货记录
                        </td>
                      </tr>
                    ) : (
                      inventoryPaged.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 select-text">
                          <td className="p-2.5 font-bold text-slate-800">{item.code}</td>
                          <td className="p-2.5 text-slate-700">{item.name}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getCategoryColor(item.category)}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-500">{item.weight}g</td>
                          <td className="p-2.5 text-slate-750 font-bold">{item.price ? `¥${item.price}` : '-'}</td>
                          <td className="p-2.5 text-slate-400">{item.fee ? `¥${item.fee}` : '-'}</td>
                          <td className="p-2.5 text-emerald-500 font-bold">在售</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination for Inventory */}
              {inventoryPaged.totalCount > paginations.inventory.size && (
                <div className="flex items-center justify-between text-xs text-slate-500" id="pagerInventory">
                  <span>共 {inventoryPaged.totalCount} 条</span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => changePage('inventory', 'prev')} 
                      disabled={inventoryPaged.current === 1}
                      className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 transition-all font-bold active:bg-slate-100"
                    >
                      ◀
                    </button>
                    <span className="font-bold text-slate-700">{inventoryPaged.current} / {inventoryPaged.totalPages}</span>
                    <button 
                      onClick={() => changePage('inventory', 'next')} 
                      disabled={inventoryPaged.current === inventoryPaged.totalPages}
                      className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 transition-all font-bold active:bg-slate-100"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: HISTORICAL SOLD LEDGER */}
          {activeViewTab === 'sold' && (
            <div id="contentView2" className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={searchSoldHost}
                  onChange={(e) => { setSearchSoldHost(e.target.value); setPaginations(prev => ({ ...prev, sold: { ...prev.sold, current: 1 } })); }}
                  id="soldSearchInput"
                  placeholder="⚡ 闪电查历史老账..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border-2 border-amber-500 rounded-xl focus:outline-none placeholder:text-slate-300 font-medium select-text"
                />
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-orange-50 text-orange-950 border-b border-orange-100">
                      <th className="p-2.5 font-bold">条码</th>
                      <th className="p-2.5 font-bold">货品名称</th>
                      <th className="p-2.5 font-bold">品类</th>
                      <th className="p-2.5 font-bold">金重</th>
                      <th className="p-2.5 font-bold">标签价</th>
                      <th className="p-2.5 font-bold text-rose-600">实际售价</th>
                      <th className="p-2.5 font-bold">售出日期</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {soldPaged.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          🔍 未找到相关历史售出记录
                        </td>
                      </tr>
                    ) : (
                      soldPaged.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 select-text">
                          <td className="p-2.5 line-through font-bold text-slate-400">{item.code}</td>
                          <td className="p-2.5 text-slate-700">{item.name}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getCategoryColor(item.category)}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400">{item.weight}g</td>
                          <td className="p-2.5 text-slate-400">{item.price ? `¥${item.price}` : '-'}</td>
                          <td className="p-2.5 text-rose-600 font-extrabold text-[13px]">¥{item.sold_price}</td>
                          <td className="p-2.5 text-slate-500">{item.sold_date}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination for Sold records */}
              {soldPaged.totalCount > paginations.sold.size && (
                <div className="flex items-center justify-between text-xs text-slate-500" id="pagerSold">
                  <span>共 {soldPaged.totalCount} 条</span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => changePage('sold', 'prev')} 
                      disabled={soldPaged.current === 1}
                      className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 transition-all font-bold active:bg-slate-100"
                    >
                      ◀
                    </button>
                    <span className="font-bold text-slate-700">{soldPaged.current} / {soldPaged.totalPages}</span>
                    <button 
                      onClick={() => changePage('sold', 'next')} 
                      disabled={soldPaged.current === soldPaged.totalPages}
                      className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 transition-all font-bold active:bg-slate-100"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 3: STOCKTAKE REPORTS HISTORY */}
          {activeViewTab === 'stocktakeHistory' && (
            <div id="contentView3" className="space-y-3">
              <div className="overflow-x-auto border border-slate-105 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-105">
                      <th className="p-2.5 font-bold">盘点时间</th>
                      <th className="p-2.5 font-bold">账面应有</th>
                      <th className="p-2.5 font-bold">实盘抓到</th>
                      <th className="p-2.5 font-bold text-rose-600">盘亏件数</th>
                      <th className="p-2.5 font-bold text-indigo-600">明细</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {stocktakeHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          暂无任何上传的历史盘点报告
                        </td>
                      </tr>
                    ) : (
                      [...stocktakeHistory].reverse().map((report, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 text-slate-500 font-bold select-text">{report.timestamp}</td>
                          <td className="p-2.5 text-slate-700">{report.total_expected} 件</td>
                          <td className="p-2.5 text-slate-700">{report.total_found} 件</td>
                          <td className={`p-2.5 font-bold ${report.total_missing > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-600'}`}>
                            {report.total_missing} 件
                          </td>
                          <td className="p-2.5">
                            {report.total_missing > 0 ? (
                              <button 
                                onClick={() => { setSelectedReport(report); setModalOpen(true); }}
                                className="bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 px-2 py-0.5 rounded text-[10px] font-bold transition-all active:scale-95"
                              >
                                查阅缺失名单
                              </button>
                            ) : (
                              <span className="text-emerald-500 font-bold text-[10px]">全额盘齐</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal Popup overlay for historic report details */}
      {modalOpen && selectedReport && (
        <div 
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
          id="detailModal"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-sm p-4.5 shadow-2xl border border-slate-100 space-y-3.5 transform transition-all overflow-hidden"
          >
            <div className="flex items-center gap-1.5 border-l-4 border-rose-500 pl-2">
              <FileText className="w-4 h-4 text-rose-500 animate-pulse" />
              <h2 className="text-sm font-bold text-rose-950">❌ 缺失盘亏详情名单</h2>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              账单时间: {selectedReport.timestamp} • 账面盈缺: 缺失 {selectedReport.total_missing} 件
            </p>

            <div className="overflow-x-auto max-h-56 border border-slate-100 rounded-xl select-text">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-rose-50 text-rose-900 border-b border-rose-100 sticky top-0">
                    <th className="p-2 font-bold">条码</th>
                    <th className="p-2 font-bold">名称</th>
                    <th className="p-2 font-bold">品类</th>
                    <th className="p-2 font-bold">重</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 font-medium">
                  {selectedReport.missing_details.map((item, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/20">
                      <td className="p-2 font-bold text-amber-700">{item.code}</td>
                      <td className="p-2 text-slate-700">{item.name}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="p-2 text-slate-500">{item.weight}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button 
              onClick={() => setModalOpen(false)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 rounded-xl transition-all shadow-sm active:scale-95"
            >
              关闭窗口
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
