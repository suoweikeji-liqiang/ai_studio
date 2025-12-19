import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, ScatterChart as ScatterIcon, MessageSquare, 
  Sigma, GitCommit, Search, ArrowRight, BrainCircuit, 
  Bot, Send, Sparkles, TrendingUp, RefreshCw, ChevronDown, 
  MoreHorizontal, Download, Maximize2, X, Plus, Calculator,
  BarChart3, LineChart as LineChartIcon, FileText, PieChart,
  Binary, BoxSelect, CheckSquare, Square, Radar as RadarIcon, 
  Eye, EyeOff
} from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  ReferenceLine, Legend, Label, ComposedChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// ======================= 1. 工具函数与模拟数据 (Utils & Mock Data) =======================

// --- 生成符合某种物理规律的模拟数据 ---
const generateMockData = (count = 300) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    // 模拟变量：负载率 (0-100%)
    const load = 20 + Math.random() * 80;
    
    // 模拟变量：水泵频率 (30-50Hz)，模拟双峰分布
    let pump_freq;
    if (Math.random() > 0.6) {
        pump_freq = 45 + Math.random() * 5; // 高频段
    } else {
        pump_freq = 30 + Math.random() * 10; // 低频段
    }

    // 模拟变量：功耗 (与负载大致呈线性+二次关系，带噪声)
    const power = 10 + 2.5 * load + 0.01 * load * load + (Math.random() - 0.5) * 15;
    
    // 模拟变量：温度 (与功耗正相关，带滞后和噪声)
    const temp = 25 + 0.1 * power + (Math.random() - 0.5) * 5;
    
    // 模拟变量：效率 (COP)，随负载先升后降
    const efficiency = 3 + 0.05 * load - 0.0006 * load * load + (Math.random() - 0.5) * 0.2;
    
    // 模拟变量：震动 (随机噪声为主，高负载下略高)
    const vibration = 0.5 + 0.01 * load + Math.random() * 1.5;

    // 模拟聚类标签 (基于负载和效率)
    let cluster = 'Group A';
    if (load > 70 && efficiency > 3.5) cluster = 'Group B (高效)';
    else if (load > 80) cluster = 'Group C (高负荷)';
    
    // 模拟 PCA 投影坐标 (简化版，仅为可视化)
    const pca1 = (load - 50) * 2 + (power - 100) + Math.random() * 20;
    const pca2 = (efficiency - 4) * 50 + (temp - 30) * 2 + Math.random() * 20;

    data.push({
      id: i,
      load: Number(load.toFixed(2)),
      pump_freq: Number(pump_freq.toFixed(2)),
      power: Number(power.toFixed(2)),
      temp: Number(temp.toFixed(2)),
      efficiency: Number(efficiency.toFixed(2)),
      vibration: Number(vibration.toFixed(2)),
      cluster,
      pca1: Number(pca1.toFixed(2)),
      pca2: Number(pca2.toFixed(2))
    });
  }
  return data;
};

// --- 直方图分箱计算 ---
const calculateHistogram = (data: any[], key: string, binCount: number = 20) => {
    if (!data.length) return [];
    const values = data.map(d => d[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / binCount;
    
    const bins = Array.from({length: binCount}, (_, i) => ({
        range: `${(min + i * step).toFixed(1)}-${(min + (i+1) * step).toFixed(1)}`,
        min: min + i * step,
        max: min + (i+1) * step,
        count: 0
    }));

    values.forEach(v => {
        const binIndex = Math.min(Math.floor((v - min) / step), binCount - 1);
        bins[binIndex].count++;
    });

    return bins;
};

// --- 箱线图统计计算 ---
const calculateBoxPlotStats = (data: any[], key: string) => {
    if (!data.length) return null;
    const values = data.map(d => d[key]).sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const median = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const min = values[0];
    const max = values[values.length - 1];
    const outliers = values.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
    return { min, q1, median, q3, max, outliers };
};

// --- 简单线性回归计算 (Least Squares) ---
const calculateLinearRegression = (data: any[], xKey: string, yKey: string) => {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0, points: [] };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  data.forEach(d => {
    sumX += d[xKey];
    sumY += d[yKey];
    sumXY += d[xKey] * d[yKey];
    sumXX += d[xKey] * d[xKey];
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // 计算 R2
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  const points = data.map(d => {
    const fittedY = slope * d[xKey] + intercept;
    ssTot += Math.pow(d[yKey] - meanY, 2);
    ssRes += Math.pow(d[yKey] - fittedY, 2);
    return { [xKey]: d[xKey], fitted: fittedY };
  }).sort((a, b) => a[xKey] - b[xKey]); 

  const r2 = 1 - (ssRes / ssTot);

  return { slope, intercept, r2, points: [points[0], points[points.length-1]] };
};

// --- 多项式回归模拟 ---
const calculatePolyRegression = (data: any[], xKey: string, yKey: string, degree: number = 2) => {
  const sortedData = [...data].sort((a, b) => a[xKey] - b[xKey]);
  const xMin = sortedData[0][xKey];
  const xMax = sortedData[sortedData.length - 1][xKey];
  
  const points = [];
  const steps = 20;
  for(let i=0; i<=steps; i++) {
     const x = xMin + (xMax - xMin) * (i / steps);
     const linearRes = calculateLinearRegression(data, xKey, yKey);
     const y = linearRes.slope * x + linearRes.intercept + (x - (xMin+xMax)/2)**2 * 0.005; 
     points.push({ [xKey]: x, fitted: y });
  }
  return { r2: 0.85, points }; 
};

// --- 模拟多元回归 (Mock Multiple Regression) ---
const calculateMultipleRegression = (data: any[], xKeys: string[], yKey: string) => {
    if (xKeys.length === 0) return { r2: 0, points: [], coefficients: [] };

    // 1. Mock Coefficients based on simple single correlation
    const coefficients = xKeys.map(key => {
        const simpleReg = calculateLinearRegression(data, key, yKey);
        return { name: key, value: simpleReg.slope * (0.5 + Math.random() * 0.4) }; 
    });
    
    const intercept = calculateLinearRegression(data, xKeys[0], yKey).intercept * 0.8;

    // 2. Predict
    let sumDiffSq = 0;
    let sumTotSq = 0;
    const yValues = data.map(d => d[yKey]);
    const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;

    const points = data.map(d => {
        let predicted = intercept;
        xKeys.forEach((key, idx) => {
            predicted += d[key] * coefficients[idx].value;
        });
        predicted += (Math.random() - 0.5) * (yMean * 0.1);

        sumDiffSq += Math.pow(d[yKey] - predicted, 2);
        sumTotSq += Math.pow(d[yKey] - yMean, 2);

        return { actual: d[yKey], predicted: predicted };
    });

    const r2 = Math.max(0, 1 - (sumDiffSq / sumTotSq));

    return { 
        r2: Math.min(r2 + 0.1, 0.99), 
        points, 
        coefficients,
        intercept
    };
};

const FIELDS = [
  { key: 'pump_freq', name: '水泵频率 (Hz)', color: '#0ea5e9', short: 'Freq' },
  { key: 'load', name: '设备负载率 (%)', color: '#3b82f6', short: 'Load' },
  { key: 'power', name: '运行功耗 (kW)', color: '#8b5cf6', short: 'Power' },
  { key: 'temp', name: '核心温度 (°C)', color: '#ef4444', short: 'Temp' },
  { key: 'efficiency', name: '能效比 (COP)', color: '#10b981', short: 'Eff' },
  { key: 'vibration', name: '震动幅度 (mm)', color: '#f59e0b', short: 'Vib' },
];

const CLUSTERS_CONFIG = [
    { name: 'Group A', color: '#3b82f6', desc: '低负荷平稳区 (Low Load)' },
    { name: 'Group B (高效)', color: '#10b981', desc: '最佳能效区 (High Eff)' },
    { name: 'Group C (高负荷)', color: '#ef4444', desc: '故障预警区 (Warning)' }
];

// ======================= 2. 主应用组件 (Main App) =======================

export default function DataExplorationBoard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'distribution' | 'correlation' | 'regression' | 'clustering' | 'ai'>('overview');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化数据
  useEffect(() => {
    setTimeout(() => {
      setData(generateMockData(500));
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-800">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-950">
          <BrainCircuit className="w-6 h-6 text-indigo-400" />
          <span className="font-bold text-white text-lg tracking-tight">智能探索工台</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase px-3 mb-2 mt-4">基础分析</div>
          
          <NavButton 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
            icon={<LayoutDashboard className="w-4 h-4"/>} 
            label="数据全景概览" 
            desc="指标卡片 · 统计表"
          />
          <NavButton 
            active={activeTab === 'distribution'} 
            onClick={() => setActiveTab('distribution')} 
            icon={<BarChart3 className="w-4 h-4"/>} 
            label="深度分布分析" 
            desc="直方图 · 箱线图"
          />
          <NavButton 
            active={activeTab === 'correlation'} 
            onClick={() => setActiveTab('correlation')} 
            icon={<GitCommit className="w-4 h-4"/>} 
            label="相关性分析" 
            desc="热力图 · 因子挖掘"
          />

          <div className="text-xs font-semibold text-slate-500 uppercase px-3 mb-2 mt-6">机器学习</div>
          
          <NavButton 
            active={activeTab === 'regression'} 
            onClick={() => setActiveTab('regression')} 
            icon={<TrendingUp className="w-4 h-4"/>} 
            label="回归拟合实验" 
            desc="多元回归 · 预测评估"
          />
           <NavButton 
            active={activeTab === 'clustering'} 
            onClick={() => setActiveTab('clustering')} 
            icon={<BoxSelect className="w-4 h-4"/>} 
            label="聚类与降维" 
            desc="画像 · 因子解读"
            highlight={activeTab === 'clustering'}
          />
          
          <div className="text-xs font-semibold text-slate-500 uppercase px-3 mb-2 mt-6">AI 增强</div>
          <NavButton 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')} 
            icon={<Bot className="w-4 h-4 text-indigo-400"/>} 
            label="AI 问数助手" 
            desc="自然语言交互分析"
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
            <div className="flex flex-col">
              <span className="text-slate-200 font-medium">Dataset_V2.csv</span>
              <span className="text-slate-500">500 rows • 6 cols</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            {activeTab === 'overview' && <><LayoutDashboard className="w-5 h-5 text-blue-500"/> 数据分布特征概览</>}
            {activeTab === 'distribution' && <><BarChart3 className="w-5 h-5 text-pink-500"/> 深度分布分析 (直方图/箱线图)</>}
            {activeTab === 'correlation' && <><GitCommit className="w-5 h-5 text-purple-500"/> 多变量相关性矩阵</>}
            {activeTab === 'regression' && <><TrendingUp className="w-5 h-5 text-orange-500"/> 交互式回归拟合实验室</>}
            {activeTab === 'clustering' && <><BoxSelect className="w-5 h-5 text-emerald-500"/> 聚类画像与 PCA 降维分析</>}
            {activeTab === 'ai' && <><Sparkles className="w-5 h-5 text-indigo-500"/> Copilot 智能问数</>}
          </h2>
          <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                <RefreshCw className="w-3.5 h-3.5"/> 刷新数据
             </button>
             <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm shadow-blue-200 transition-colors">
                <Download className="w-3.5 h-3.5"/> 导出报告
             </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-auto bg-slate-50 p-8">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500"/>
                <p>正在计算统计指标...</p>
             </div>
          ) : (
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              {activeTab === 'overview' && <OverviewPanel data={data} />}
              {activeTab === 'distribution' && <DistributionPanel data={data} />}
              {activeTab === 'correlation' && <CorrelationPanel data={data} />}
              {activeTab === 'regression' && <RegressionPanel data={data} />}
              {activeTab === 'clustering' && <ClusteringPanel data={data} />}
              {activeTab === 'ai' && <AIChatPanel data={data} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ======================= 3. 子功能模块 (Sub Components) =======================

// --- 3.1 侧边栏按钮 ---
const NavButton = ({ active, onClick, icon, label, desc, highlight }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative overflow-hidden ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
        : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
    }`}
  >
    {highlight && !active && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-50"/>}
    <div className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{icon}</div>
    <div className="text-left flex-1">
      <div className="text-sm font-medium leading-none mb-1">{label}</div>
      <div className={`text-[10px] ${active ? 'text-indigo-200' : 'text-slate-600 group-hover:text-slate-500'}`}>{desc}</div>
    </div>
    {active && <ChevronDown className="w-3 h-3 -rotate-90 opacity-50"/>}
  </button>
);

// --- 3.2 概览面板 (Overview) ---
function OverviewPanel({ data }: { data: any[] }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       {/* Metric Cards */}
       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {FIELDS.map(field => {
             const values = data.map(d => d[field.key]);
             const mean = (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1);
             const max = Math.max(...values).toFixed(1);
             const min = Math.min(...values).toFixed(1);
             
             return (
               <div key={field.key} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1 truncate">{field.name}</div>
                  <div className="text-xl font-bold text-slate-800 mb-2">{mean} <span className="text-xs text-slate-400 font-normal">avg</span></div>
                  
                  {/* Tiny Histogram Simulation */}
                  <div className="h-8 flex items-end gap-[2px] opacity-80">
                     {[...Array(10)].map((_, i) => (
                        <div key={i} className="flex-1 rounded-t-sm" style={{ backgroundColor: field.color, height: `${20 + Math.random() * 80}%`, opacity: 0.5 + (i/20) }} />
                     ))}
                  </div>
               </div>
             )
          })}
       </div>

       {/* Detailed Stats Table */}
       <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
             <h3 className="font-bold text-slate-700">字段详情统计表</h3>
             <button className="text-indigo-600 text-sm hover:underline">下载统计 CSV</button>
          </div>
          <table className="w-full text-left text-sm text-slate-600">
             <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                   <th className="px-6 py-3">字段名称</th>
                   <th className="px-6 py-3">数据类型</th>
                   <th className="px-6 py-3">样本数 (Count)</th>
                   <th className="px-6 py-3">缺失率 (Missing)</th>
                   <th className="px-6 py-3">标准差 (Std Dev)</th>
                   <th className="px-6 py-3">偏度 (Skewness)</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {FIELDS.map((f, i) => (
                   <tr key={f.key} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3 font-medium text-slate-800 flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full" style={{background: f.color}}/>
                         {f.name}
                      </td>
                      <td className="px-6 py-3"><span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-mono">Float64</span></td>
                      <td className="px-6 py-3 font-mono">{data.length}</td>
                      <td className="px-6 py-3 font-mono text-green-600">0.00%</td>
                      <td className="px-6 py-3 font-mono">{(Math.random() * 10).toFixed(2)}</td>
                      <td className="px-6 py-3 font-mono">{(Math.random() - 0.5).toFixed(2)}</td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  )
}

// --- 3.2.1 深度分布分析面板 (Distribution) ---
function DistributionPanel({ data }: { data: any[] }) {
    const [selectedKey, setSelectedKey] = useState('pump_freq');
    const [binCount, setBinCount] = useState(20);

    const histogramData = useMemo(() => calculateHistogram(data, selectedKey, binCount), [data, selectedKey, binCount]);
    const boxStats = useMemo(() => calculateBoxPlotStats(data, selectedKey), [data, selectedKey]);
    const fieldInfo = FIELDS.find(f => f.key === selectedKey);

    return (
        <div className="h-full flex gap-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex-1 flex flex-col gap-6">
                 {/* Histogram */}
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                             <BarChart3 className="w-5 h-5 text-slate-500" />
                             <h3 className="font-bold text-slate-700">频次分布直方图 (Histogram)</h3>
                        </div>
                        <div className="flex items-center gap-3">
                             <span className="text-xs text-slate-500">分箱数: {binCount}</span>
                             <input type="range" min="5" max="50" value={binCount} onChange={e => setBinCount(Number(e.target.value))} className="w-32 accent-indigo-600"/>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histogramData} barCategoryGap={1}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                                <XAxis dataKey="range" fontSize={10} tick={{fill: '#94a3b8'}} />
                                <YAxis fontSize={10} tick={{fill: '#94a3b8'}} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                                <Bar dataKey="count" fill={fieldInfo?.color || '#3b82f6'} radius={[4, 4, 0, 0]} name="频次" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Box Plot Simulation */}
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-48 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-slate-700">箱线图 (Box Plot) & 统计摘要</h3>
                         <div className="text-xs text-slate-400">检测异常值与四分位分布</div>
                    </div>
                    {boxStats && (
                        <div className="flex items-center gap-8 h-full">
                            {/* Visual Representation (Simplified Box Plot) */}
                            <div className="flex-1 h-20 relative flex items-center">
                                {/* Whisker Line */}
                                <div className="absolute left-0 right-0 h-[2px] bg-slate-200 top-1/2 -translate-y-1/2 w-full"></div>
                                {/* Min/Max Ticks */}
                                <div className="absolute left-0 h-4 w-[2px] bg-slate-400 top-1/2 -translate-y-1/2"></div>
                                <div className="absolute right-0 h-4 w-[2px] bg-slate-400 top-1/2 -translate-y-1/2"></div>
                                {/* Box */}
                                <div className="absolute h-12 bg-indigo-100 border-2 border-indigo-500 rounded top-1/2 -translate-y-1/2 flex items-center justify-center" 
                                     style={{
                                         left: `${((boxStats.q1 - boxStats.min) / (boxStats.max - boxStats.min)) * 100}%`,
                                         width: `${((boxStats.q3 - boxStats.q1) / (boxStats.max - boxStats.min)) * 100}%`
                                     }}>
                                     {/* Median Line */}
                                     <div className="h-full w-[2px] bg-indigo-600" style={{position: 'absolute', left: `${((boxStats.median - boxStats.q1) / (boxStats.q3 - boxStats.q1)) * 100}%`}}></div>
                                </div>
                                {/* Outliers (Mock) */}
                                {boxStats.outliers.slice(0, 5).map((v, i) => (
                                    <div key={i} className="absolute w-2 h-2 rounded-full border border-red-500 bg-red-100 top-1/2 -translate-y-1/2" 
                                        style={{left: `${((v - boxStats.min) / (boxStats.max - boxStats.min)) * 100}%`}}
                                        title={`Outlier: ${v}`}
                                    />
                                ))}
                            </div>
                            
                            {/* Stats Text */}
                            <div className="w-64 grid grid-cols-2 gap-4 text-xs">
                                <div><span className="text-slate-400 block">Maximum</span><span className="font-mono text-slate-700 font-bold">{boxStats.max.toFixed(2)}</span></div>
                                <div><span className="text-slate-400 block">Upper Q3</span><span className="font-mono text-slate-700 font-bold">{boxStats.q3.toFixed(2)}</span></div>
                                <div><span className="text-slate-400 block">Median</span><span className="font-mono text-indigo-600 font-bold">{boxStats.median.toFixed(2)}</span></div>
                                <div><span className="text-slate-400 block">Lower Q1</span><span className="font-mono text-slate-700 font-bold">{boxStats.q1.toFixed(2)}</span></div>
                                <div><span className="text-slate-400 block">Minimum</span><span className="font-mono text-slate-700 font-bold">{boxStats.min.toFixed(2)}</span></div>
                                <div><span className="text-slate-400 block">IQR</span><span className="font-mono text-slate-700 font-bold">{(boxStats.q3 - boxStats.q1).toFixed(2)}</span></div>
                            </div>
                        </div>
                    )}
                 </div>
            </div>

            {/* Sidebar Controls */}
            <div className="w-72 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">选择分析字段</label>
                    <div className="space-y-2">
                        {FIELDS.map(f => (
                            <button 
                                key={f.key} 
                                onClick={() => setSelectedKey(f.key)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all border ${selectedKey === f.key ? 'bg-slate-50 border-indigo-500 shadow-sm ring-1 ring-indigo-100' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{background: f.color}}></div>
                                    {f.name}
                                </div>
                                {selectedKey === f.key && <CheckIcon className="w-4 h-4 text-indigo-600"/>}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs text-slate-500 leading-relaxed">
                    <p className="font-bold text-slate-700 mb-2">💡 分析提示</p>
                    <p>如果直方图呈现<b>双峰分布</b>（如水泵频率），可能意味着设备存在两个主要工作工况（例如：工频与变频切换）。</p>
                    <p className="mt-2">箱线图中的红点代表<b>离群值</b>，通常是数据质量问题或设备故障的早期信号。</p>
                </div>
            </div>
        </div>
    );
}

const CheckIcon = ({className}: any) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>

// --- 3.3 相关性分析面板 (Correlation) ---
function CorrelationPanel({ data }: { data: any[] }) {
  // Mock Correlation Matrix Calculation
  const matrix = useMemo(() => {
     return FIELDS.map(row => {
        return FIELDS.map(col => {
           if (row.key === col.key) return 1;
           // Mock logic: Power & Load highly correlated, Temp & Power correlated, etc.
           if ((row.key === 'power' && col.key === 'load') || (row.key === 'load' && col.key === 'power')) return 0.92;
           if ((row.key === 'temp' && col.key === 'power') || (row.key === 'power' && col.key === 'temp')) return 0.75;
           if ((row.key === 'efficiency' && col.key === 'load') || (row.key === 'load' && col.key === 'efficiency')) return -0.45;
           return (Math.random() * 0.4 - 0.2); // Random noise for others
        })
     })
  }, []);

  return (
    <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
       <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col items-center justify-center relative">
          <h3 className="absolute top-6 left-6 font-bold text-slate-700">Pearson 相关系数矩阵</h3>
          
          <div className="grid grid-cols-7 gap-1 p-8 bg-slate-50 rounded-2xl">
             {/* Header Row */}
             <div className="w-20 h-12"></div>
             {FIELDS.map(f => (
                <div key={f.key} className="w-20 h-12 flex items-center justify-center text-[10px] font-bold text-slate-500 text-center leading-tight">
                   {f.name.split(' ')[0]}
                </div>
             ))}

             {/* Matrix Rows */}
             {FIELDS.map((row, i) => (
                <React.Fragment key={row.key}>
                   <div className="w-20 h-20 flex items-center justify-end pr-4 text-[10px] font-bold text-slate-500 text-right leading-tight">
                      {row.name.split(' ')[0]}
                   </div>
                   {FIELDS.map((col, j) => {
                      const val = matrix[i][j];
                      const opacity = Math.abs(val);
                      const color = val > 0 ? `rgba(59, 130, 246, ${opacity})` : `rgba(239, 68, 68, ${opacity})`; // Blue pos, Red neg
                      
                      return (
                         <div key={`${i}-${j}`} className="w-20 h-20 rounded-lg flex flex-col items-center justify-center transition-transform hover:scale-105 hover:shadow-xl cursor-pointer border border-white" style={{backgroundColor: color}}>
                            <span className={`text-xs font-bold ${opacity > 0.5 ? 'text-white' : 'text-slate-700'}`}>{val.toFixed(2)}</span>
                         </div>
                      )
                   })}
                </React.Fragment>
             ))}
          </div>
       </div>
    </div>
  )
}

// --- 3.4 回归实验室面板 (Regression Lab) ---
function RegressionPanel({ data }: { data: any[] }) {
   const [mode, setMode] = useState<'linear' | 'poly' | 'multiple'>('linear');
   const [xKey, setXKey] = useState('load'); // Single X for linear/poly
   const [xKeys, setXKeys] = useState<string[]>(['load', 'temp']); // Multi X for multiple
   const [yKey, setYKey] = useState('power');
   
   const result = useMemo(() => {
      if (mode === 'linear') {
         return calculateLinearRegression(data, xKey, yKey);
      } else if (mode === 'poly') {
         return calculatePolyRegression(data, xKey, yKey, 2);
      } else {
         return calculateMultipleRegression(data, xKeys, yKey);
      }
   }, [data, xKey, xKeys, yKey, mode]);

   const scatterData = useMemo(() => {
       if (mode === 'multiple') {
           return result.points.map((p: any) => ({ x: p.predicted, y: p.actual }));
       } else {
           return data.map(d => ({ x: d[xKey], y: d[yKey] }));
       }
   }, [data, result, mode, xKey, yKey]);

   // Helper for multi-select
   const toggleXKey = (key: string) => {
       if (xKeys.includes(key)) {
           setXKeys(xKeys.filter(k => k !== key));
       } else {
           setXKeys([...xKeys, key]);
       }
   }

   return (
     <div className="h-full flex gap-6 animate-in slide-in-from-right-8 duration-500">
        {/* Chart Area */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col p-4">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700">
                  {mode === 'multiple' ? '真实值 vs 预测值 (Actual vs Predicted)' : '拟合分析图表'}
              </h3>
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                 <button onClick={() => setMode('linear')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'linear' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>线性 (Linear)</button>
                 <button onClick={() => setMode('poly')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'poly' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>多项式 (Poly)</button>
                 <button onClick={() => setMode('multiple')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'multiple' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>多元 (Multiple)</button>
              </div>
           </div>
           
           <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                 <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                        type="number" 
                        dataKey="x" 
                        name={mode === 'multiple' ? 'Predicted Y' : FIELDS.find(f=>f.key===xKey)?.name} 
                        unit="" 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        label={mode === 'multiple' ? { value: '预测值 (Predicted)', position: 'bottom', offset: 0, fontSize: 12, fill: '#94a3b8' } : undefined}
                    />
                    <YAxis 
                        type="number" 
                        dataKey="y" 
                        name={mode === 'multiple' ? 'Actual Y' : FIELDS.find(f=>f.key===yKey)?.name} 
                        unit="" 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        label={mode === 'multiple' ? { value: '真实值 (Actual)', angle: -90, position: 'left', offset: 0, fontSize: 12, fill: '#94a3b8' } : undefined}
                    />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Legend />
                    
                    <Scatter 
                        name={mode === 'multiple' ? "数据点" : "原始观测值"} 
                        data={scatterData} 
                        fill={mode === 'multiple' ? "#8b5cf6" : "#3b82f6"} 
                        fillOpacity={0.6} 
                        shape="circle" 
                    />
                    
                    {mode !== 'multiple' && (
                        <Scatter name={mode === 'poly' ? "多项式拟合" : "线性拟合"} data={result.points} line={{ stroke: '#f97316', strokeWidth: 3 }} shape={() => null} legendType="line" />
                    )}
                    
                    {mode === 'multiple' && (
                        <ReferenceLine 
                            segment={[{ x: 0, y: 0 }, { x: 200, y: 200 }]} // Simplified diagonal
                            stroke="#cbd5e1" 
                            strokeDasharray="3 3" 
                            label={{ value: '理想预测线 (Ideal)', position: 'insideTopLeft', fontSize: 10, fill: '#cbd5e1' }}
                        />
                    )}
                 </ScatterChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Configuration Panel */}
        <div className="w-80 flex flex-col gap-6">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="space-y-3">
                 <label className="text-xs font-bold text-slate-400 uppercase">Y 轴 (因变量/Target)</label>
                 <select value={yKey} onChange={e => setYKey(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none">
                    {FIELDS.map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
                 </select>
              </div>

              <div className="flex justify-center"><ArrowRight className="w-5 h-5 text-slate-300 rotate-90"/></div>

              <div className="space-y-3">
                 <label className="text-xs font-bold text-slate-400 uppercase flex justify-between">
                     <span>X 轴 (自变量/Features)</span>
                     {mode === 'multiple' && <span className="text-indigo-500 font-normal">多选</span>}
                 </label>
                 
                 {mode === 'multiple' ? (
                     <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                         {FIELDS.filter(f => f.key !== yKey).map(f => (
                             <button 
                                key={f.key}
                                onClick={() => toggleXKey(f.key)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${xKeys.includes(f.key) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                             >
                                 {xKeys.includes(f.key) ? <CheckSquare className="w-4 h-4 text-indigo-500"/> : <Square className="w-4 h-4 text-slate-300"/>}
                                 {f.name}
                             </button>
                         ))}
                     </div>
                 ) : (
                     <select value={xKey} onChange={e => setXKey(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none">
                        {FIELDS.filter(f => f.key !== yKey).map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
                     </select>
                 )}
              </div>
           </div>

           <div className="bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 p-6 text-white space-y-4">
              <div className="flex items-center gap-2 mb-2">
                 <Sigma className="w-5 h-5 opacity-80"/>
                 <h3 className="font-bold">模型评估</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-indigo-200 mb-1">R² (Score)</div>
                    <div className="text-2xl font-mono font-bold">{result.r2?.toFixed(4) || '0.00'}</div>
                 </div>
                 <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-indigo-200 mb-1">MSE</div>
                    <div className="text-2xl font-mono font-bold">{(Math.random() * 5 + 1).toFixed(2)}</div>
                 </div>
              </div>
              
              {mode === 'multiple' && result.coefficients && (
                  <div className="mt-4 pt-4 border-t border-indigo-500/50">
                      <div className="text-xs text-indigo-200 mb-2 uppercase font-bold">特征权重 (Coefficients)</div>
                      <div className="space-y-2">
                          {result.coefficients.map((c: any) => (
                              <div key={c.name} className="flex items-center gap-2 text-xs">
                                  <div className="w-16 truncate text-indigo-100">{FIELDS.find(f=>f.key===c.name)?.name.split(' ')[0]}</div>
                                  <div className="flex-1 bg-black/20 rounded-full h-1.5 overflow-hidden">
                                      <div className="h-full bg-white/80" style={{width: `${Math.min(Math.abs(c.value) * 20, 100)}%`}}></div>
                                  </div>
                                  <div className="w-10 font-mono text-right">{c.value.toFixed(2)}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
           </div>
        </div>
     </div>
   )
}

// --- 3.5 新增优化：聚类与降维面板 (Clustering) ---
function ClusteringPanel({ data }: { data: any[] }) {
    const [hiddenClusters, setHiddenClusters] = useState<string[]>([]);
    
    // 计算每个 Cluster 在各个维度上的平均特征（归一化用于雷达图）
    const clusterStats = useMemo(() => {
        return CLUSTERS_CONFIG.map(cluster => {
            const clusterData = data.filter(d => d.cluster === cluster.name);
            if (!clusterData.length) return null;
            
            // 计算各字段的平均值
            const stats: any = { subject: cluster.name, fullMark: 100 };
            FIELDS.forEach(f => {
                // 简单的归一化模拟：假设 min=0, max=avg*2 (这里简化处理，实际应基于全局极值)
                // 为了演示效果，我们根据 Mock 数据的特性手动加一点偏移
                const avg = clusterData.reduce((a, b) => a + b[f.key], 0) / clusterData.length;
                let normalized = 50; 
                // Mock Normalization logic based on known ranges
                if (f.key === 'load') normalized = avg; 
                if (f.key === 'efficiency') normalized = avg * 20; 
                if (f.key === 'vibration') normalized = avg * 30; 
                if (f.key === 'temp') normalized = (avg - 20) * 3;
                stats[f.short] = Math.min(Math.max(normalized, 10), 100);
            });
            return { ...stats, color: cluster.color };
        }).filter(Boolean);
    }, [data]);

    const toggleCluster = (name: string) => {
        setHiddenClusters(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
    };

    return (
        <div className="h-full flex gap-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Left: PCA Scatter Plot */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col p-5">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <ScatterIcon className="w-5 h-5 text-emerald-500" />
                        PCA 降维分布 (2D Projection)
                     </h3>
                     <div className="flex items-center gap-2">
                         {CLUSTERS_CONFIG.map(c => (
                             <button 
                                key={c.name} 
                                onClick={() => toggleCluster(c.name)}
                                className={`text-[10px] px-2 py-1 rounded-full border transition-all flex items-center gap-1 ${hiddenClusters.includes(c.name) ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}
                             >
                                 <div className={`w-2 h-2 rounded-full ${hiddenClusters.includes(c.name) ? 'bg-slate-300' : ''}`} style={{background: hiddenClusters.includes(c.name) ? undefined : c.color}}/>
                                 {c.name}
                                 {hiddenClusters.includes(c.name) ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                             </button>
                         ))}
                     </div>
                </div>
                <div className="flex-1 w-full min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" dataKey="pca1" name="PC1" unit="" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis type="number" dataKey="pca2" name="PC2" unit="" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({active, payload}) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg text-xs">
                                            <div className="font-bold mb-1" style={{color: CLUSTERS_CONFIG.find(c=>c.name===d.cluster)?.color}}>{d.cluster}</div>
                                            <div>Load: {d.load}%</div>
                                            <div>Eff: {d.efficiency}</div>
                                        </div>
                                    );
                                }
                                return null;
                            }} />
                            <Legend verticalAlign="top" height={36}/>
                            {CLUSTERS_CONFIG.map(c => (
                                <Scatter 
                                    key={c.name} 
                                    name={c.name} 
                                    data={hiddenClusters.includes(c.name) ? [] : data.filter(d => d.cluster === c.name)} 
                                    fill={c.color} 
                                    fillOpacity={0.7} 
                                />
                            ))}
                        </ScatterChart>
                    </ResponsiveContainer>
                    
                    {/* PCA Axis Meaning Interpretation */}
                    <div className="absolute bottom-2 left-2 bg-slate-50/90 backdrop-blur border border-slate-100 p-2 rounded text-[10px] text-slate-500 shadow-sm">
                        <div className="font-bold mb-1">PCA 因子解读 (Factor Loadings)</div>
                        <div className="flex items-center gap-2"><span>X轴 (PC1):</span> <span className="font-mono text-slate-700">Load (0.85), Power (0.72)</span></div>
                        <div className="flex items-center gap-2"><span>Y轴 (PC2):</span> <span className="font-mono text-slate-700">Eff (0.65), Temp (-0.3)</span></div>
                    </div>
                </div>
            </div>

            {/* Right: Cluster Profiling Radar Chart */}
            <div className="w-96 flex flex-col gap-4">
                {/* Radar Chart Panel */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-1/2 min-h-[300px]">
                    <div className="flex items-center gap-2 mb-2">
                        <RadarIcon className="w-5 h-5 text-indigo-500"/>
                        <h3 className="font-bold text-slate-700">聚类特征画像 (Cluster Profile)</h3>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        {/* Correct Radar Implementation */}
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={FIELDS.map(f => {
                                const obj: any = { subject: f.short };
                                clusterStats?.forEach((c: any) => obj[c.subject] = c[f.short]);
                                return obj;
                            })}>
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                              {CLUSTERS_CONFIG.map(c => !hiddenClusters.includes(c.name) && (
                                  <Radar key={c.name} name={c.name} dataKey={c.name} stroke={c.color} fill={c.color} fillOpacity={0.2} />
                              ))}
                              <Legend wrapperStyle={{fontSize: '10px'}}/>
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-center text-[10px] text-slate-400 mt-2">
                        各聚类中心在不同维度上的归一化均值对比
                    </div>
                </div>

                {/* Cluster Description List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 overflow-y-auto">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">分组业务含义解读</h4>
                    <div className="space-y-3">
                        {CLUSTERS_CONFIG.map(c => (
                            <div key={c.name} className={`p-3 rounded-lg border transition-all ${hiddenClusters.includes(c.name) ? 'opacity-50 border-slate-100 bg-slate-50' : 'border-slate-100 bg-white shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{background: c.color}}></div>
                                        {c.name}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight">{c.desc}</div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-4 bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-[10px] text-emerald-800 leading-relaxed">
                        <span className="font-bold block mb-1">🤖 AI 诊断建议:</span>
                        通过雷达图可见，<b>Group C</b> (红色) 在 Load 和 Vibration 维度显著突出，建议重点检查该工况下的机械紧固件状态。
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- 3.6 AI 问数面板 (AI Chat) ---
function AIChatPanel({ data }: { data: any[] }) {
   const [messages, setMessages] = useState<any[]>([
      { id: 1, type: 'bot', content: '你好！我是您的智能数据分析助手。我已经读取了当前数据集（500条记录）。您可以问我：\n\n1. "分析一下功耗和温度的关系"\n2. "找出效率异常的设备点"\n3. "水泵频率分布情况如何？"' }
   ]);
   const [input, setInput] = useState('');
   const scrollRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
   }, [messages]);

   const handleSend = () => {
      if (!input.trim()) return;
      
      const userMsg = { id: Date.now(), type: 'user', content: input };
      setMessages(prev => [...prev, userMsg]);
      setInput('');

      // Mock AI Response Logic
      setTimeout(() => {
         let botContent = { id: Date.now()+1, type: 'bot', content: '', chart: null };
         
         if (input.includes('关系') || input.includes('相关')) {
            botContent.content = '根据数据分析，**功耗 (Power)** 与 **温度 (Temp)** 呈现出显著的正相关性 (Correlation: 0.78)。当设备功耗超过 50kW 时，温度上升趋势明显加剧。';
            botContent.chart = 'scatter';
         } else if (input.includes('异常') || input.includes('错误')) {
            botContent.content = '我检测到 **3 个异常数据点**，它们的震动值 (Vibration) 超过了 3σ 阈值（> 2.8mm）。这些异常主要集中在负载率 > 90% 的区间。';
            botContent.chart = 'bar';
         } else if (input.includes('频率') || input.includes('分布')) {
            botContent.content = '水泵频率呈现典型的**双峰分布**，主要集中在 **32Hz** (低频巡航) 和 **48Hz** (高频满载) 两个区间。这通常意味着设备在两种截然不同的工况下运行。';
            botContent.chart = 'histogram';
         } else {
            botContent.content = '这是一个很好的问题。建议您查看“深度分布分析”面板，使用直方图和箱线图进一步探索数据特征。';
         }
         
         setMessages(prev => [...prev, botContent]);
      }, 1000);
   };

   return (
      <div className="h-full flex gap-6">
         {/* Chat Area */}
         <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50" ref={scrollRef}>
               {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-4 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.type === 'user' ? 'bg-slate-200' : 'bg-indigo-600 text-white'}`}>
                        {msg.type === 'user' ? <div className="text-xs font-bold text-slate-600">ME</div> : <Bot className="w-6 h-6"/>}
                     </div>
                     <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.type === 'user' ? 'bg-white border border-slate-200 text-slate-700' : 'bg-white border border-indigo-100 text-slate-800'}`}>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                        
                        {/* Mock Embedded Charts in Chat */}
                        {msg.chart === 'scatter' && (
                           <div className="mt-4 h-48 bg-slate-50 rounded-lg border border-slate-100 p-2">
                              <ResponsiveContainer width="100%" height="100%">
                                 <ScatterChart>
                                    <XAxis type="number" dataKey="load" hide />
                                    <YAxis type="number" dataKey="temp" hide />
                                    <Scatter data={data.slice(0, 50)} fill="#8884d8" />
                                 </ScatterChart>
                              </ResponsiveContainer>
                              <div className="text-center text-[10px] text-slate-400 mt-1">图表：功耗 vs 温度预览</div>
                           </div>
                        )}
                        
                        {msg.chart === 'histogram' && (
                           <div className="mt-4 h-48 bg-slate-50 rounded-lg border border-slate-100 p-2">
                              <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={[{range:'30-35', v:15}, {range:'35-40', v:5}, {range:'40-45', v:8}, {range:'45-50', v:22}]}>
                                    <Bar dataKey="v" fill="#0ea5e9" />
                                 </BarChart>
                              </ResponsiveContainer>
                              <div className="text-center text-[10px] text-slate-400 mt-1">图表：频率分布预览</div>
                           </div>
                        )}
                     </div>
                  </div>
               ))}
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100">
               <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2 border border-transparent focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                  <Search className="w-5 h-5 text-slate-400"/>
                  <input 
                     className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400" 
                     placeholder="输入您的问题，例如：水泵频率分布情况如何？"
                     value={input}
                     onChange={e => setInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleSend()}
                  />
                  <button onClick={handleSend} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                     <Send className="w-4 h-4"/>
                  </button>
               </div>
            </div>
         </div>

         {/* Suggested Questions Sidebar */}
         <div className="w-72 flex flex-col gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
               <Sparkles className="w-8 h-8 mb-4 text-yellow-300"/>
               <h3 className="font-bold text-lg mb-2">智能洞察</h3>
               <p className="text-sm text-indigo-100 leading-relaxed">基于对数据的初步扫描，我发现水泵频率存在明显的**双峰效应**。这通常意味着系统在“低频节能”和“高频满载”两种模式间切换。</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
               <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">推荐问题</h4>
               <div className="space-y-2">
                  {['水泵频率分布情况如何', '分析聚类分组的特征', '预测未来24小时能耗'].map((q, i) => (
                     <button key={i} onClick={() => setInput(q)} className="w-full text-left text-sm p-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center justify-between group">
                        {q}
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors"/>
                     </button>
                  ))}
               </div>
            </div>
         </div>
      </div>
   )
}