import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Layers, Code, Play, BarChart3, Activity, Plus, Trash2, Clock, 
  ArrowRight, Filter, Server, Building2, Search, Tag, ListFilter, XCircle, 
  Check, FileJson, ArrowRightLeft, AlertCircle, Calendar, Download, 
  FileSpreadsheet, MoreHorizontal, ArrowLeft, Save, Edit, RefreshCw, 
  Settings, History, ChevronDown, ChevronRight, FileText, Copy, 
  CalendarClock, Zap, Table as TableIcon, Sigma, HardDrive, BarChart4, 
  ChevronUp, X, Workflow, Calculator, Eraser, TrendingUp, Split, 
  FunctionSquare, Variable, MousePointerClick, TrendingDown, Combine
} from 'lucide-react';

// ======================= 1. 类型定义 (Types) =======================

// --- 基础数据结构 ---
type SelectedPoint = {
  id: string; 
  mode: 'raw' | 'aggregate';
  deviceTypeId: string;
  deviceTypeName: string;
  projectId?: string;
  projectName?: string;
  deviceId?: string; 
  deviceName?: string; 
  tagFilters?: Record<string, string[]>; 
  metricKey: string;
  metricName: string;
  unit: string;
  aggFunc: string; 
  targetField?: string; // 元数据映射字段
};

// --- 特征工程 (Advanced) ---
type LogicVariable = {
    id: string;
    name: string; // e.g., 'v1', 'pump_current'
    sourcePointId: string; // Ref to SelectedPoint.id
};

// 升级：支持两种模式的计算特征
type ComputeFeature = {
    id: string;
    name: string; // e.g., 'ma_temp'
    desc?: string;
    mode: 'formula' | 'transform'; // 核心区分：公式计算 vs 时序变换
    
    // Formula Mode (v1 + v2)
    variables: LogicVariable[];
    expression: string;
    
    // Transform Mode (MA, DIFF)
    sourcePointId?: string; // 单源
    transformType?: 'ma' | 'diff' | 'lag' | 'std'; // 算子类型
    transformParams?: { 
        window?: number; // for ma, std
        periods?: number; // for diff, lag
    };
};

type ComplexFilter = {
    id: string;
    enabled: boolean;
    variables: LogicVariable[];
    expression: string; // e.g., "v1 > 0 || v2 > 0"
};

type ImputeConfig = {
    strategy: 'none' | 'ffill' | 'bfill' | 'linear' | 'zero' | 'mean';
    columns: string[]; // 'all' or specific fields
};

type ProcessingConfig = {
    impute: ImputeConfig;
    rowFilter: ComplexFilter;
    computedFeatures: ComputeFeature[];
};

// --- 调度与记录 ---
type ScheduleConfig = {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; 
    dayOfWeek?: number; 
    dayOfMonth?: number; 
};

type DataRecord = {
    id: string;
    templateId: string;
    status: 'success' | 'generating' | 'failed';
    timeRange: { start: string; end: string };
    rowCount: number;
    fileSize: string;
    executeTime: string; 
    executor: string; 
};

type DataTemplate = {
  id: string;
  name: string;
  system: string; // 所属系统
  desc?: string;
  lastUpdated: string;
  creator: string;
  mode: 'raw' | 'aggregate'; // 核心模式
  interval: string;
  points: SelectedPoint[];
  schedule: ScheduleConfig;
  processing: ProcessingConfig;
  records: DataRecord[]; 
};

type TagFilterRow = {
    id: string;
    tagKey: string;
    tagValue: string;
};

// ======================= 2. Mock Data =======================

const PROJECTS = [
  { id: 'p1', name: '上海中心大厦' },
  { id: 'p2', name: '北京大兴机场' },
  { id: 'p3', name: '深圳湾壹号' },
  { id: 'p4', name: '广州塔' },
  { id: 'p5', name: '杭州博地中心' },
];

const MODEL_SCHEMA = [
  { code: 'feature_temp_supply', name: '供水温度特征', type: 'FLOAT', desc: '核心热力学输入，单位℃' },
  { code: 'feature_temp_return', name: '回水温度特征', type: 'FLOAT', desc: '核心热力学输入，单位℃' },
  { code: 'feature_power_active', name: '有功功率特征', type: 'FLOAT', desc: '负荷指标，单位kW' },
  { code: 'feature_flow_rate', name: '流量特征', type: 'FLOAT', desc: '流体速率，单位m³/h' },
  { code: 'feature_energy_total', name: '累计能耗', type: 'DOUBLE', desc: '总能耗读数' },
  { code: 'label_efficiency', name: '能效标签(COP)', type: 'FLOAT', desc: '目标变量，用于训练' },
  { code: 'sys_status_bool', name: '系统启停状态', type: 'BOOL', desc: '0=停，1=开' }
];

const TAG_VALUES: Record<string, string[]> = {
  brand: ['格力 (Gree)', '美的 (Midea)', '开利 (Carrier)', '约克 (York)', '特灵 (Trane)', '麦克维尔 (McQuay)'],
  area: ['华东区域', '华北区域', '华南区域', '华中区域', '西南区域', '西北区域', '东北区域'],
  usage: ['商业用电', '空调用电', '动力用电', '照明用电', '特殊用电'],
  phase: ['一期工程', '二期工程', '三期扩建'],
  status: ['在运', '备用', '维修', '报废']
};

const DEVICE_TYPES = [
  { 
    id: 'chiller', 
    name: '冷水机组 (Chiller)', 
    tags: [
      { key: 'project_name', name: '所属项目', values: PROJECTS.map(p => p.name) }, 
      { key: 'brand', name: '设备品牌', values: TAG_VALUES.brand },
      { key: 'area', name: '所属区域', values: TAG_VALUES.area },
      { key: 'status', name: '设备状态', values: TAG_VALUES.status }
    ],
    metrics: [
      { key: 'outlet_temp', name: '出水温度', unit: '℃' },
      { key: 'inlet_temp', name: '回水温度', unit: '℃' },
      { key: 'load_rate', name: '负载率', unit: '%' },
      { key: 'cop', name: '能效比', unit: '' },
      { key: 'power', name: '运行功率', unit: 'kW' },
      { key: 'current_a', name: 'A相电流', unit: 'A' },
      { key: 'alarm_count', name: '报警次数', unit: '' },
    ]
  },
  { 
    id: 'elec_meter', 
    name: '智能电表 (Meter)', 
    tags: [
      { key: 'project_name', name: '所属项目', values: PROJECTS.map(p => p.name) },
      { key: 'usage', name: '用电类型', values: TAG_VALUES.usage },
      { key: 'phase', name: '建设期数', values: TAG_VALUES.phase }
    ],
    metrics: [
      { key: 'active_power', name: '有功功率', unit: 'kW' },
      { key: 'energy_total', name: '总能耗', unit: 'kWh' },
      { key: 'voltage_a', name: 'A相电压', unit: 'V' }
    ]
  }
];

const DEVICE_INSTANCES: Record<string, {id: string, name: string, projectId: string}[]> = {
  chiller: [
    { id: 'ch-1', name: '1# 离心机', projectId: 'p1' },
    { id: 'ch-2', name: '2# 螺杆机', projectId: 'p1' },
    { id: 'ch-3', name: '3# 离心机', projectId: 'p1' },
    { id: 'ch-4', name: '大兴 1# 冷机', projectId: 'p2' },
    { id: 'ch-5', name: '大兴 2# 冷机', projectId: 'p2' },
    { id: 'ch-6', name: '深圳 1# 冷机', projectId: 'p3' },
  ],
  elec_meter: [
    { id: 'm-1', name: '上海总进线柜', projectId: 'p1' },
    { id: 'm-2', name: '上海空调总表', projectId: 'p1' },
    { id: 'm-3', name: '北京总进线柜', projectId: 'p2' },
  ]
};

const AGG_FUNCTIONS = ['AVG', 'MAX', 'MIN', 'SUM', 'COUNT'];
const INTERVALS = [
  { val: 'raw', label: '原始数据' },
  { val: '1m', label: '1 分钟' },
  { val: '15m', label: '15 分钟' },
  { val: '1h', label: '1 小时' },
  { val: '1d', label: '1 天' },
];

// ======================= 3. Main Application =======================

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [currentTemplate, setCurrentTemplate] = useState<DataTemplate | null>(null);
  
  // Mock Database
  const [templates, setTemplates] = useState<DataTemplate[]>([
    {
      id: 'tpl-001',
      name: '焊接室温度对比情况',
      system: '测试系统',
      desc: '用于分析不同焊接室在工作周期的温度波动',
      lastUpdated: '2025-08-04 11:28:58',
      creator: '刘洋',
      mode: 'raw',
      interval: '1h',
      points: [
          { id: 'pt-1', mode: 'raw', deviceTypeId: 'chiller', deviceTypeName: '冷水机组', projectId: 'p1', projectName: '上海中心', deviceId: 'ch-1', deviceName: '1# 离心机', metricKey: 'outlet_temp', metricName: '出水温度', unit: '℃', aggFunc: 'AVG', targetField: 'feature_temp_supply' },
      ],
      processing: {
          impute: { strategy: 'none', columns: [] },
          rowFilter: { id: 'flt-1', enabled: false, variables: [], expression: '' },
          computedFeatures: [
              // 示例：单列变换
              { 
                  id: 'feat-1', name: 'temp_ma_5', mode: 'transform', 
                  sourcePointId: 'pt-1', transformType: 'ma', transformParams: { window: 5 },
                  variables: [], expression: ''
              }
          ]
      },
      schedule: { enabled: false, frequency: 'daily', time: '00:00' },
      records: []
    }
  ]);

  const handleEdit = (tpl: DataTemplate) => {
    setCurrentTemplate(tpl);
    setView('editor');
  };

  const handleCreate = () => {
    setCurrentTemplate(null);
    setView('editor');
  };

  const handleSave = (config: DataTemplate) => {
    if (templates.find(d => d.id === config.id)) {
      setTemplates(templates.map(d => d.id === config.id ? config : d));
    } else {
      setTemplates([config, ...templates]);
    }
    setView('dashboard');
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {view === 'dashboard' ? (
        <DashboardView 
          templates={templates} 
          onCreate={handleCreate} 
          onEdit={handleEdit}
        />
      ) : (
        <EditorView 
          initialData={currentTemplate} 
          onSave={handleSave} 
          onBack={() => setView('dashboard')} 
        />
      )}
    </div>
  );
}

// ======================= 4. Dashboard View =======================

function DashboardView({ templates, onCreate, onEdit }: any) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
      return templates.filter((t: any) => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [templates, searchTerm]);

  return (
    <div className="max-w-[1400px] mx-auto p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-6 h-6 text-blue-600" />
                数据导出模版
            </h1>
            <div className="flex items-center gap-2">
                <input 
                    type="text" 
                    placeholder="请输入数据导出模版名称" 
                    className="pl-3 pr-4 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64 bg-white"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm transition-all">搜索</button>
                <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-1 shadow-sm transition-all">
                    <Plus className="w-3.5 h-3.5" /> 新增
                </button>
            </div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50/80 text-xs font-bold text-slate-600">
          <div className="col-span-1 text-center"><input type="checkbox" className="rounded"/></div>
          <div className="col-span-3">数据导出模版名称</div>
          <div className="col-span-1">所属系统</div>
          <div className="col-span-1">聚合方式</div>
          <div className="col-span-2">特征工程</div>
          <div className="col-span-1">创建人</div>
          <div className="col-span-3 text-right">操作</div>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {filteredTemplates.map((tpl: DataTemplate) => (
            <React.Fragment key={tpl.id}>
              <div className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-100 items-center transition-colors text-sm text-slate-600 ${expandedRow === tpl.id ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
                <div className="col-span-1 flex justify-center items-center gap-2">
                  <input type="checkbox" className="rounded"/>
                  <button onClick={() => setExpandedRow(expandedRow === tpl.id ? null : tpl.id)} className="p-1 rounded hover:bg-slate-200 text-slate-400">
                    {expandedRow === tpl.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                  </button>
                </div>
                <div className="col-span-3">
                  <div className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => onEdit(tpl)}>{tpl.name}</div>
                </div>
                <div className="col-span-1">{tpl.system || '-'}</div>
                <div className="col-span-1">{tpl.mode === 'raw' ? '否' : '是'}</div>
                <div className="col-span-2">
                   {tpl.processing.rowFilter.enabled || tpl.processing.computedFeatures.length > 0 ? (
                       <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs border border-indigo-100">
                           <Workflow className="w-3 h-3" /> 已配置
                       </span>
                   ) : <span className="text-slate-300 text-xs">-</span>}
                </div>
                <div className="col-span-1">{tpl.creator}</div>
                <div className="col-span-3 flex justify-end gap-3 text-blue-600">
                    <button onClick={() => onEdit(tpl)} title="立即执行"><Play className="w-4 h-4"/></button>
                    <button onClick={() => onEdit(tpl)} title="编辑"><Edit className="w-4 h-4"/></button>
                    <button title="删除"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================= 5. Editor View =======================

function EditorView({ initialData, onSave, onBack }: any) {
  const [activeTab, setActiveTab] = useState<'extract' | 'process' | 'schedule'>('extract');
  
  // Data State
  const [templateName, setTemplateName] = useState(initialData?.name || '');
  const [templateSystem, setTemplateSystem] = useState(initialData?.system || '测试系统');
  const [mode, setMode] = useState<'raw' | 'aggregate'>(initialData?.mode || 'raw');
  const [interval, setInterval] = useState(initialData?.interval || '1h');
  const [selectedPoints, setSelectedPoints] = useState<SelectedPoint[]>(initialData?.points || []);
  const [imputeConfig, setImputeConfig] = useState<ImputeConfig>(initialData?.processing?.impute || { strategy: 'none', columns: [] });
  const [filterLogic, setFilterLogic] = useState<ComplexFilter>(initialData?.processing?.rowFilter || { id: 'flt-def', enabled: false, variables: [], expression: '' });
  const [computedFeatures, setComputedFeatures] = useState<ComputeFeature[]>(initialData?.processing?.computedFeatures || []);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(initialData?.schedule || { enabled: false, frequency: 'daily', time: '00:00' });

  // Helpers for Extraction
  const [activeDeviceType, setActiveDeviceType] = useState(DEVICE_TYPES[0].id);
  const [activeProject, setActiveProject] = useState(PROJECTS[0].id);
  const [checkedDevices, setCheckedDevices] = useState<string[]>([]);
  const [checkedMetrics, setCheckedMetrics] = useState<string[]>([]);
  const [tagRows, setTagRows] = useState<TagFilterRow[]>([]);

  const currentDeviceType = DEVICE_TYPES.find(d => d.id === activeDeviceType) || DEVICE_TYPES[0];
  const availableDevices = (DEVICE_INSTANCES[activeDeviceType] || []).filter(d => d.projectId === activeProject);

  const handleAddPoints = () => {
      // (Implementation same as before, simplified for brevity)
      if (mode === 'raw') {
          const newPoints = availableDevices.filter(d => checkedDevices.includes(d.id)).flatMap(d => checkedMetrics.map(mKey => {
             const metric = currentDeviceType.metrics.find(m => m.key === mKey)!;
             return { id: `${d.id}-${mKey}`, mode: 'raw', deviceTypeId: currentDeviceType.id, deviceTypeName: currentDeviceType.name, projectId: activeProject, projectName: PROJECTS.find(p=>p.id===activeProject)?.name, deviceId: d.id, deviceName: d.name, metricKey: mKey, metricName: metric.name, unit: metric.unit, aggFunc: 'AVG' } as SelectedPoint;
          }));
          const uniquePoints = newPoints.filter(np => !selectedPoints.some(sp => sp.id === np.id));
          setSelectedPoints([...selectedPoints, ...uniquePoints]);
      } else {
          // Aggregate logic
          const filters: Record<string, string[]> = {};
          tagRows.forEach(r => { if (r.tagKey && r.tagValue) filters[r.tagKey] = [r.tagValue]; });
          const newPoints = checkedMetrics.map(mKey => ({ id: `agg-${Date.now()}-${mKey}`, mode: 'aggregate', deviceTypeId: currentDeviceType.id, deviceTypeName: currentDeviceType.name, tagFilters: filters, metricKey: mKey, metricName: currentDeviceType.metrics.find(m=>m.key===mKey)?.name || mKey, unit: '', aggFunc: 'AVG' } as SelectedPoint));
          setSelectedPoints([...selectedPoints, ...newPoints]);
      }
      setCheckedDevices([]); setCheckedMetrics([]);
  };

  const handleFinalSave = () => {
      if(!templateName) return alert("请输入模版名称");
      onSave({
          id: initialData?.id || `tpl-${Date.now()}`,
          name: templateName, system: templateSystem, desc: '', lastUpdated: new Date().toLocaleString(), creator: 'User',
          mode, interval, points: selectedPoints, schedule: scheduleConfig,
          processing: { impute: imputeConfig, rowFilter: filterLogic, computedFeatures }, records: initialData?.records || []
      });
  };

  // Tag Helpers
  const addTagRow = () => setTagRows([...tagRows, { id: `row-${Date.now()}`, tagKey: '', tagValue: '' }]);
  const removeTagRow = (id: string) => setTagRows(tagRows.filter(r => r.id !== id));
  const updateTagRow = (id: string, f: 'tagKey'|'tagValue', v: string) => setTagRows(tagRows.map(r => r.id===id ? {...r, [f]: v} : r));
  const getAvailableTagKeys = (rId: string) => {
      const used = tagRows.filter(r => r.id !== rId && r.tagKey).map(r => r.tagKey);
      return currentDeviceType.tags.filter(t => !used.includes(t.key));
  };

  return (
    <div className="flex h-full flex-col bg-slate-50">
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft className="w-5 h-5"/></button>
                <div className="flex items-center gap-4">
                    <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="输入名称"/>
                    <select className="border border-slate-300 rounded px-3 py-1.5 text-sm w-40 outline-none" value={templateSystem} onChange={e => setTemplateSystem(e.target.value)}><option>测试系统</option><option>空调系统</option></select>
                </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
                {[
                    {id: 'extract', label: '1. 数据提取', icon: Database},
                    {id: 'process', label: '2. 特征工程', icon: FunctionSquare},
                    {id: 'schedule', label: '3. 计划任务', icon: CalendarClock}
                ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>
            <button onClick={handleFinalSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md flex items-center gap-2"><Save className="w-4 h-4"/> 确认并保存</button>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 border-r border-slate-200 bg-white max-w-4xl">
                {activeTab === 'extract' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
                        <div className="flex items-center gap-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700">数据模式:</span>
                                <div className="flex bg-white rounded-lg p-1 border border-blue-100">
                                    <button onClick={() => setMode('raw')} className={`px-4 py-1 text-xs rounded transition-colors ${mode==='raw'?'bg-blue-100 text-blue-700 font-medium':'text-slate-500 hover:bg-slate-50'}`}>明细模式 (Raw)</button>
                                    <button onClick={() => setMode('aggregate')} className={`px-4 py-1 text-xs rounded transition-colors ${mode==='aggregate'?'bg-indigo-100 text-indigo-700 font-medium':'text-slate-500 hover:bg-slate-50'}`}>聚合模式 (Agg)</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700">时间粒度:</span>
                                <select className="border border-slate-300 rounded px-2 py-1 text-xs bg-white outline-none" value={interval} onChange={e => setInterval(e.target.value)}>{INTERVALS.map(i => <option key={i.val} value={i.val}>{i.label}</option>)}</select>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Plus className="w-4 h-4 text-blue-500"/> 配置数据源</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <select className="flex-1 border rounded p-2 text-xs" value={activeProject} onChange={e => {setActiveProject(e.target.value); setCheckedDevices([])}}>{PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                        <select className="flex-1 border rounded p-2 text-xs" value={activeDeviceType} onChange={e => {setActiveDeviceType(e.target.value); setCheckedMetrics([])}}>{DEVICE_TYPES.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}</select>
                                    </div>
                                    {mode === 'raw' ? (
                                        <div className="border rounded-lg h-48 overflow-y-auto p-2">
                                            {availableDevices.map(d => (
                                                <label key={d.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                                    <input type="checkbox" checked={checkedDevices.includes(d.id)} onChange={e => e.target.checked ? setCheckedDevices([...checkedDevices, d.id]) : setCheckedDevices(checkedDevices.filter(x => x !== d.id))} className="rounded text-blue-600"/>
                                                    <span className="text-xs">{d.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="border rounded-lg h-48 overflow-y-auto p-2 space-y-2">
                                            <div className="flex justify-between items-center pb-2 border-b mb-1"><span className="text-xs font-bold text-indigo-600">标签筛选</span><button onClick={addTagRow}><Plus className="w-3 h-3 text-indigo-600"/></button></div>
                                            {tagRows.map(row => {
                                                const keys = getAvailableTagKeys(row.id);
                                                const vals = currentDeviceType.tags.find(t => t.key === row.tagKey)?.values || [];
                                                return (
                                                    <div key={row.id} className="flex gap-1 items-center">
                                                        <select className="w-24 text-[10px] border rounded" value={row.tagKey} onChange={e => updateTagRow(row.id, 'tagKey', e.target.value)}><option value="">标签...</option>{keys.map(k => <option key={k.key} value={k.key}>{k.name}</option>)}</select>
                                                        <select className="flex-1 text-[10px] border rounded" value={row.tagValue} onChange={e => updateTagRow(row.id, 'tagValue', e.target.value)}><option value="">值...</option>{vals.map(v => <option key={v} value={v}>{v}</option>)}</select>
                                                        <button onClick={() => removeTagRow(row.id)} className="text-red-400"><X className="w-3 h-3"/></button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-4">
                                    <div className="border rounded-lg h-full overflow-y-auto p-2">
                                        {currentDeviceType.metrics.map(m => (
                                            <label key={m.key} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                                <input type="checkbox" checked={checkedMetrics.includes(m.key)} onChange={e => e.target.checked ? setCheckedMetrics([...checkedMetrics, m.key]) : setCheckedMetrics(checkedMetrics.filter(x => x !== m.key))} className="rounded text-blue-600"/>
                                                <div className="flex flex-col"><span className="text-xs text-slate-700">{m.name}</span><span className="text-[10px] text-slate-400 font-mono">{m.key}</span></div>
                                            </label>
                                        ))}
                                    </div>
                                    <button onClick={handleAddPoints} disabled={checkedMetrics.length === 0} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm disabled:opacity-50">添加至列表 <ArrowRight className="w-3 h-3 inline ml-1"/></button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-700 flex justify-between"><span>已选指标 ({selectedPoints.length})</span><button onClick={()=>setSelectedPoints([])} className="text-xs text-red-500">清空</button></h3>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr><th className="p-2 border-r">数据源</th><th className="p-2 border-r">属性</th>{mode==='aggregate' && <th className="p-2 border-r">聚合</th>}<th className="p-2 border-r bg-green-50">元数据映射</th><th className="p-2 w-10">操作</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedPoints.map((p, idx) => (
                                            <tr key={p.id} className="hover:bg-slate-50">
                                                <td className="p-2 border-r">{p.mode==='raw'?<span className="bg-blue-50 text-blue-700 px-1 rounded">{p.deviceName}</span> : '聚合数据'}</td>
                                                <td className="p-2 border-r">{p.metricName}</td>
                                                {mode==='aggregate' && <td className="p-2 border-r"><select value={p.aggFunc} onChange={e=>{const n=[...selectedPoints];n[idx].aggFunc=e.target.value;setSelectedPoints(n)}} className="bg-transparent"><option>AVG</option><option>MAX</option></select></td>}
                                                <td className="p-2 border-r bg-green-50/20">
                                                    <select value={p.targetField||''} onChange={e=>{const n=[...selectedPoints];n[idx].targetField=e.target.value;setSelectedPoints(n)}} className="w-full bg-transparent text-green-700"><option value="">原名</option>{MODEL_SCHEMA.map(f=><option key={f.code} value={f.code}>{f.name}</option>)}</select>
                                                </td>
                                                <td className="p-2 text-center"><button onClick={()=>setSelectedPoints(selectedPoints.filter(x=>x.id!==p.id))} className="text-red-400"><Trash2 className="w-3 h-3"/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'process' && (
                    <FeatureEngineeringPanel 
                        selectedPoints={selectedPoints} 
                        imputeConfig={imputeConfig} setImputeConfig={setImputeConfig}
                        filterLogic={filterLogic} setFilterLogic={setFilterLogic}
                        computedFeatures={computedFeatures} setComputedFeatures={setComputedFeatures}
                    />
                )}
                
                {/* Schedule Tab omitted for brevity, same as before */}
            </div>

            <DataPreviewPanel selectedPoints={selectedPoints} computedFeatures={computedFeatures} />
        </div>
    </div>
  );
}

// --- Feature Engineering Panel (Refined with Modes) ---
function FeatureEngineeringPanel({ selectedPoints, imputeConfig, setImputeConfig, filterLogic, setFilterLogic, computedFeatures, setComputedFeatures }: any) {
    
    const addVariable = (targetId: string, isFilter: boolean) => {
        const newVar = { id: `v-${Date.now()}`, name: `v${Date.now() % 1000}`, sourcePointId: '' };
        if (isFilter) setFilterLogic({ ...filterLogic, variables: [...filterLogic.variables, newVar] });
        else setComputedFeatures(computedFeatures.map((f: any) => f.id === targetId ? { ...f, variables: [...f.variables, newVar] } : f));
    };

    const addFeature = (mode: 'formula' | 'transform') => {
        setComputedFeatures([...computedFeatures, { 
            id: `feat-${Date.now()}`, name: mode === 'formula' ? 'new_formula' : 'new_transform', 
            mode, variables: [], expression: '', 
            transformType: 'ma', transformParams: { window: 5 }
        }]);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 pb-20">
            {/* 1. Cleaning */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Eraser className="w-4 h-4 text-orange-500"/> 1. 数据清洗 (Cleaning)</h3>
                <div className="flex gap-2">
                    {['none', 'ffill', 'zero', 'linear'].map(s => (
                        <button key={s} onClick={() => setImputeConfig({...imputeConfig, strategy: s})} className={`px-3 py-1.5 rounded border text-xs ${imputeConfig.strategy === s ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white'}`}>{s}</button>
                    ))}
                </div>
            </div>

            {/* 2. Filter */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Filter className="w-4 h-4 text-blue-500"/> 2. 复杂行筛选 (Row Filter)</h3>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={filterLogic.enabled} onChange={e => setFilterLogic({...filterLogic, enabled: e.target.checked})} className="rounded text-blue-600"/><span className="text-xs">启用</span></label>
                </div>
                {filterLogic.enabled && (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-400 font-bold uppercase"><span>定义变量</span><button onClick={() => addVariable('', true)} className="text-blue-600">+ 变量</button></div>
                            {filterLogic.variables.map((v: any, idx: number) => (
                                <div key={v.id} className="flex items-center gap-2">
                                    <input className="w-16 text-xs border rounded p-1 text-center" value={v.name} onChange={e => {const n=[...filterLogic.variables]; n[idx].name=e.target.value; setFilterLogic({...filterLogic, variables:n})}} />
                                    <span className="text-slate-300">=</span>
                                    <select className="flex-1 text-xs border rounded p-1" value={v.sourcePointId} onChange={e => {const n=[...filterLogic.variables]; n[idx].sourcePointId=e.target.value; setFilterLogic({...filterLogic, variables:n})}}>
                                        <option value="">数据源...</option>
                                        {selectedPoints.map((p: any) => <option key={p.id} value={p.id}>{p.targetField || p.metricName} ({p.deviceName})</option>)}
                                    </select>
                                    <button onClick={() => setFilterLogic({...filterLogic, variables: filterLogic.variables.filter((xv:any)=>xv.id!==v.id)})} className="text-red-400"><X className="w-3 h-3"/></button>
                                </div>
                            ))}
                        </div>
                        <input className="w-full border rounded p-2 text-sm font-mono focus:border-blue-500 outline-none" placeholder="e.g. v1 > 0 || v2 > 10" value={filterLogic.expression} onChange={e => setFilterLogic({...filterLogic, expression: e.target.value})}/>
                    </div>
                )}
            </div>

            {/* 3. Computed Features (Dual Mode) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calculator className="w-4 h-4 text-indigo-500"/> 3. 构造新特征</h3>
                    <div className="flex gap-2">
                        <button onClick={() => addFeature('formula')} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100">+ 自定义公式</button>
                        <button onClick={() => addFeature('transform')} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100">+ 时序变换 (MA/Diff)</button>
                    </div>
                </div>
                <div className="space-y-4">
                    {computedFeatures.map((feat: any, fIdx: number) => (
                        <div key={feat.id} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold text-white px-1.5 rounded ${feat.mode === 'formula' ? 'bg-indigo-400' : 'bg-purple-400'}`}>{feat.mode === 'formula' ? '公式' : '变换'}</span>
                                    <input className="bg-transparent border-none text-xs font-bold text-slate-700 p-0 focus:ring-0" value={feat.name} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].name=e.target.value; setComputedFeatures(n)}} />
                                </div>
                                <button onClick={() => setComputedFeatures(computedFeatures.filter((f:any) => f.id !== feat.id))} className="text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                            <div className="p-3">
                                {feat.mode === 'formula' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 border-r pr-4">
                                            <div className="flex justify-between text-[10px] uppercase text-slate-400 font-bold"><span>参数</span><button onClick={() => addVariable(feat.id, false)} className="text-blue-600">+ 添加</button></div>
                                            <div className="space-y-1">
                                                {feat.variables.map((v: any, vIdx: number) => (
                                                    <div key={v.id} className="flex gap-1 items-center">
                                                        <input className="w-12 text-[10px] border rounded p-1" value={v.name} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].variables[vIdx].name=e.target.value; setComputedFeatures(n)}} />
                                                        <select className="flex-1 text-[10px] border rounded p-1" value={v.sourcePointId} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].variables[vIdx].sourcePointId=e.target.value; setComputedFeatures(n)}}><option value="">选择...</option>{selectedPoints.map((p: any) => <option key={p.id} value={p.id}>{p.targetField || p.metricName}</option>)}</select>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <textarea className="w-full h-20 border rounded p-2 text-xs font-mono" placeholder="v1 + v2" value={feat.expression} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].expression=e.target.value; setComputedFeatures(n)}} />
                                    </div>
                                ) : (
                                    <div className="flex gap-3 items-center">
                                        <span className="text-xs text-slate-500">对</span>
                                        <select className="border rounded p-1 text-xs w-40" value={feat.sourcePointId} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].sourcePointId=e.target.value; setComputedFeatures(n)}}><option value="">选择数据源...</option>{selectedPoints.map((p: any) => <option key={p.id} value={p.id}>{p.targetField || p.metricName}</option>)}</select>
                                        <span className="text-xs text-slate-500">执行</span>
                                        <select className="border rounded p-1 text-xs w-24" value={feat.transformType} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].transformType=e.target.value; setComputedFeatures(n)}}><option value="ma">滑动平均</option><option value="diff">一阶差分</option><option value="lag">滞后(Lag)</option></select>
                                        <span className="text-xs text-slate-500">参数</span>
                                        <input type="number" className="border rounded p-1 text-xs w-16" value={feat.transformParams?.window || feat.transformParams?.periods} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].transformParams = { window: Number(e.target.value), periods: Number(e.target.value) }; setComputedFeatures(n)}} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// --- Data Preview Panel ---
function DataPreviewPanel({ selectedPoints, computedFeatures }: any) {
    const columns = useMemo(() => [
        ...selectedPoints.map((p: any) => ({ id: p.id, name: p.targetField || p.metricName, sub: p.deviceName || 'Agg', type: 'raw' })),
        ...computedFeatures.map((f: any) => ({ id: f.id, name: f.name, sub: f.mode === 'formula' ? 'Formula' : 'Transform', type: 'calc' }))
    ], [selectedPoints, computedFeatures]);

    const { data, stats } = useMemo(() => {
        if (selectedPoints.length === 0) return { data: [], stats: {} };
        const rows = Array.from({length: 10}).map((_, i) => {
            const row: any = { ts: `2023-12-10 0${i}:00` };
            columns.forEach(col => row[col.id] = (Math.random() * 100).toFixed(2));
            return row;
        });
        const colStats: any = {};
        columns.forEach(c => colStats[c.id] = { min: '0.0', max: '100.0', avg: '50.0', nulls: '0%' });
        return { data: rows, stats: colStats };
    }, [columns]);

    return (
        <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col relative p-6">
            <div className="absolute inset-0 bg-grid-slate-200/50 pointer-events-none" />
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex-1 flex flex-col overflow-hidden z-10">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-2"><TableIcon className="w-5 h-5 text-slate-400" /><span className="font-bold text-slate-700">数据预览 (Preview)</span></div>
                    <div className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">{data.length} Rows x {columns.length} Cols</div>
                </div>
                <div className="flex-1 overflow-auto">
                    {columns.length === 0 ? <div className="h-full flex items-center justify-center text-slate-300">请配置数据源</div> : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-500 border-b border-r w-32 bg-slate-50">时间戳</th>
                                    {columns.map(col => (
                                        <th key={col.id} className={`px-4 py-3 font-semibold border-b border-r min-w-[120px] ${col.type === 'calc' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50'}`}>
                                            <div><span>{col.name}</span><span className="block text-[9px] opacity-70 font-normal">{col.sub}</span></div>
                                        </th>
                                    ))}
                                </tr>
                                <tr className="bg-slate-50 border-b">
                                    <td className="px-4 py-1 text-[10px] font-bold text-slate-400 border-r">STATS</td>
                                    {columns.map(col => <td key={col.id} className="px-4 py-1 border-r text-[9px] text-slate-400">Avg: {stats[col.id]?.avg} | Max: {stats[col.id]?.max}</td>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.map((row: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-blue-50/30">
                                        <td className="px-4 py-2 font-mono text-slate-500 border-r">{row.ts.split(' ')[1]}</td>
                                        {columns.map(col => <td key={col.id} className={`px-4 py-2 font-mono border-r ${col.type === 'calc' ? 'text-indigo-600' : 'text-slate-600'}`}>{row[col.id]}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}