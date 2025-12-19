import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Layers, Code, Play, BarChart3, Activity, Plus, Trash2, Clock, 
  ArrowRight, Filter, Server, Building2, Search, Tag, ListFilter, XCircle, 
  Check, FileJson, ArrowRightLeft, AlertCircle, Calendar, Download, 
  FileSpreadsheet, MoreHorizontal, ArrowLeft, Save, Edit, RefreshCw, 
  Settings, History, ChevronDown, ChevronRight, FileText, Copy, 
  CalendarClock, Zap, Table as TableIcon, Sigma, HardDrive, BarChart4, 
  ChevronUp, X, Workflow, Calculator, Eraser, TrendingUp, Split, 
  FunctionSquare, Variable, MousePointerClick
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

type ComputeFeature = {
    id: string;
    name: string; // e.g., 'total_power'
    desc?: string;
    variables: LogicVariable[];
    expression: string; // e.g., "v1 + v2"
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
          { id: 'pt-2', mode: 'raw', deviceTypeId: 'chiller', deviceTypeName: '冷水机组', projectId: 'p1', projectName: '上海中心', deviceId: 'ch-2', deviceName: '2# 螺杆机', metricKey: 'outlet_temp', metricName: '出水温度', unit: '℃', aggFunc: 'AVG', targetField: 'feature_temp_return' },
      ],
      processing: {
          impute: { strategy: 'none', columns: [] },
          rowFilter: { id: 'flt-1', enabled: false, variables: [], expression: '' },
          computedFeatures: []
      },
      schedule: { enabled: false, frequency: 'daily', time: '00:00' },
      records: [
          { id: 'rec-1', templateId: 'tpl-001', status: 'success', timeRange: {start: '2025-08-01 00:00', end: '2025-08-05 00:00'}, rowCount: 1200, fileSize: '2.4 MB', executeTime: '2025-08-04 14:10:37', executor: '刘洋' },
          { id: 'rec-2', templateId: 'tpl-001', status: 'success', timeRange: {start: '2025-08-01 00:00', end: '2025-08-05 00:00'}, rowCount: 1200, fileSize: '2.4 MB', executeTime: '2025-08-04 11:46:43', executor: '刘洋' }
      ]
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

// ======================= 4. Dashboard View (还原表格) =======================

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
                <button className="bg-orange-400 hover:bg-orange-500 text-white px-4 py-1.5 rounded text-sm transition-all">清除</button>
                <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-1 shadow-sm transition-all">
                    <Plus className="w-3.5 h-3.5" /> 新增
                </button>
                <button className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-1.5 rounded text-sm transition-all">删除</button>
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
          <div className="col-span-1">分组间隔</div>
          <div className="col-span-2">特征工程</div>
          <div className="col-span-1">创建人</div>
          <div className="col-span-2 text-right">操作</div>
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
                <div className="col-span-1">{tpl.mode === 'raw' ? '-' : tpl.interval}</div>
                <div className="col-span-2">
                   {tpl.processing.rowFilter.enabled || tpl.processing.computedFeatures.length > 0 ? (
                       <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs border border-indigo-100">
                           <Workflow className="w-3 h-3" /> 已配置
                       </span>
                   ) : <span className="text-slate-300 text-xs">-</span>}
                </div>
                <div className="col-span-1">{tpl.creator}</div>
                <div className="col-span-2 flex justify-end gap-3 text-blue-600">
                    <button onClick={() => onEdit(tpl)} title="立即执行"><Play className="w-4 h-4"/></button>
                    <button onClick={() => onEdit(tpl)} title="编辑"><Edit className="w-4 h-4"/></button>
                    <button title="删除"><Trash2 className="w-4 h-4"/></button>
                    <button title="配置"><Settings className="w-4 h-4"/></button>
                </div>
              </div>

              {/* Expanded History Table */}
              {expandedRow === tpl.id && (
                  <div className="bg-slate-50 border-b border-slate-200 p-4 pl-12">
                      <div className="bg-white border border-slate-200 shadow-sm">
                          {tpl.records.length === 0 ? (
                              <div className="text-center py-6 text-xs text-slate-400">暂无记录</div>
                          ) : (
                              <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                      <tr><th className="p-3 font-medium">数据导出模版名称</th><th className="p-3 font-medium">所属系统</th><th className="p-3 font-medium">聚合方式</th><th className="p-3 font-medium">时间周期</th><th className="p-3 font-medium">导出人</th><th className="p-3 font-medium">导出时间</th><th className="p-3 font-medium">执行结果</th><th className="p-3 font-medium text-right">操作</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-600">
                                      {tpl.records.map(rec => (
                                          <tr key={rec.id} className="hover:bg-slate-50">
                                              <td className="p-3">{tpl.name}</td>
                                              <td className="p-3">{tpl.system}</td>
                                              <td className="p-3">{tpl.mode === 'raw' ? '否' : '是'}</td>
                                              <td className="p-3 font-mono">{rec.timeRange.start} - {rec.timeRange.end}</td>
                                              <td className="p-3">{rec.executor}</td>
                                              <td className="p-3">{rec.executeTime}</td>
                                              <td className="p-3"><span className="text-green-600">成功</span></td>
                                              <td className="p-3 text-right"><button className="text-blue-600 hover:underline"><Download className="w-4 h-4 ml-auto" /></button></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          )}
                      </div>
                  </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================= 5. Editor View (融合式编辑器) =======================

function EditorView({ initialData, onSave, onBack }: any) {
  // --- UI State ---
  const [activeTab, setActiveTab] = useState<'extract' | 'process' | 'schedule'>('extract');
  
  // --- Form Data State ---
  const [templateName, setTemplateName] = useState(initialData?.name || '');
  const [templateSystem, setTemplateSystem] = useState(initialData?.system || '测试系统');
  
  // Tab 1: Extraction
  const [mode, setMode] = useState<'raw' | 'aggregate'>(initialData?.mode || 'raw');
  const [interval, setInterval] = useState(initialData?.interval || '1h');
  const [selectedPoints, setSelectedPoints] = useState<SelectedPoint[]>(initialData?.points || []);
  
  // Tab 2: Processing (Feature Engineering)
  const [imputeConfig, setImputeConfig] = useState<ImputeConfig>(initialData?.processing?.impute || { strategy: 'none', columns: [] });
  const [filterLogic, setFilterLogic] = useState<ComplexFilter>(initialData?.processing?.rowFilter || { id: 'flt-def', enabled: false, variables: [], expression: '' });
  const [computedFeatures, setComputedFeatures] = useState<ComputeFeature[]>(initialData?.processing?.computedFeatures || []);

  // Tab 3: Schedule
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(initialData?.schedule || { enabled: false, frequency: 'daily', time: '00:00' });

  // --- Helper State for Extraction UI ---
  const [activeDeviceType, setActiveDeviceType] = useState(DEVICE_TYPES[0].id);
  const [activeProject, setActiveProject] = useState(PROJECTS[0].id);
  const [checkedDevices, setCheckedDevices] = useState<string[]>([]);
  const [checkedMetrics, setCheckedMetrics] = useState<string[]>([]);
  const [tagRows, setTagRows] = useState<TagFilterRow[]>([]);

  // --- Derived ---
  const currentDeviceType = DEVICE_TYPES.find(d => d.id === activeDeviceType) || DEVICE_TYPES[0];
  const availableDevices = (DEVICE_INSTANCES[activeDeviceType] || []).filter(d => d.projectId === activeProject);

  // --- Actions ---
  const handleAddPoints = () => {
      // 兼容两种模式的添加逻辑
      if (mode === 'raw') {
          // 明细模式：添加具体设备点位
          const newPoints = availableDevices
            .filter(d => checkedDevices.includes(d.id))
            .flatMap(d => checkedMetrics.map(mKey => {
                const metric = currentDeviceType.metrics.find(m => m.key === mKey)!;
                return {
                    id: `${d.id}-${mKey}`,
                    mode: 'raw',
                    deviceTypeId: currentDeviceType.id,
                    deviceTypeName: currentDeviceType.name,
                    projectId: activeProject,
                    projectName: PROJECTS.find(p => p.id === activeProject)?.name,
                    deviceId: d.id,
                    deviceName: d.name,
                    metricKey: mKey,
                    metricName: metric.name,
                    unit: metric.unit,
                    aggFunc: 'AVG'
                } as SelectedPoint;
            }));
          const uniquePoints = newPoints.filter(np => !selectedPoints.some(sp => sp.id === np.id));
          setSelectedPoints([...selectedPoints, ...uniquePoints]);
      } else {
          // 聚合模式：添加聚合规则
          const filters: Record<string, string[]> = {};
          tagRows.forEach(r => { if (r.tagKey && r.tagValue) filters[r.tagKey] = [r.tagValue]; });
          
          const newPoints = checkedMetrics.map(mKey => {
              const metric = currentDeviceType.metrics.find(m => m.key === mKey)!;
              return {
                  id: `agg-${currentDeviceType.id}-${mKey}-${Date.now()}`,
                  mode: 'aggregate',
                  deviceTypeId: currentDeviceType.id,
                  deviceTypeName: currentDeviceType.name,
                  tagFilters: filters,
                  metricKey: mKey,
                  metricName: metric.name,
                  unit: metric.unit,
                  aggFunc: 'AVG' // Default
              } as SelectedPoint;
          });
          setSelectedPoints([...selectedPoints, ...newPoints]);
      }
      
      setCheckedDevices([]);
      setCheckedMetrics([]);
  };

  // Tag Row Helpers
  const addTagRow = () => setTagRows([...tagRows, { id: `row-${Date.now()}`, tagKey: '', tagValue: '' }]);
  const removeTagRow = (id: string) => setTagRows(tagRows.filter(r => r.id !== id));
  const updateTagRow = (id: string, field: 'tagKey' | 'tagValue', val: string) => setTagRows(tagRows.map(r => r.id===id ? {...r, [field]: val} : r));
  const getAvailableTagKeys = (currentRowId: string) => {
      const usedKeys = tagRows.filter(r => r.id !== currentRowId && r.tagKey).map(r => r.tagKey);
      return currentDeviceType.tags.filter(t => !usedKeys.includes(t.key));
  };

  const handleFinalSave = () => {
      if(!templateName) return alert("请输入模版名称");
      onSave({
          id: initialData?.id || `tpl-${Date.now()}`,
          name: templateName, system: templateSystem, desc: '', lastUpdated: new Date().toLocaleString(), creator: 'User',
          mode, interval, points: selectedPoints,
          schedule: scheduleConfig,
          processing: { impute: imputeConfig, rowFilter: filterLogic, computedFeatures },
          records: initialData?.records || []
      });
  };

  return (
    <div className="flex h-full flex-col bg-slate-50">
        {/* Top Bar */}
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft className="w-5 h-5"/></button>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span className="text-sm font-medium text-slate-600">模版名称</span>
                        <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="输入名称"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">所属系统</span>
                        <select className="border border-slate-300 rounded px-3 py-1.5 text-sm w-40 outline-none" value={templateSystem} onChange={e => setTemplateSystem(e.target.value)}>
                            <option>测试系统</option><option>空调系统</option><option>照明系统</option>
                        </select>
                    </div>
                </div>
            </div>
            
            {/* Step Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setActiveTab('extract')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'extract' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Database className="w-4 h-4" /> 1. 数据提取
                </button>
                <button onClick={() => setActiveTab('process')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'process' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <FunctionSquare className="w-4 h-4" /> 2. 特征工程
                </button>
                <button onClick={() => setActiveTab('schedule')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'schedule' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <CalendarClock className="w-4 h-4" /> 3. 计划任务
                </button>
            </div>

            <button onClick={handleFinalSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md shadow-blue-100 flex items-center gap-2">
                <Save className="w-4 h-4"/> 确认并保存
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: Configuration */}
            <div className="flex-1 overflow-y-auto p-8 border-r border-slate-200 bg-white max-w-4xl">
                {activeTab === 'extract' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
                        {/* Mode & Global Settings */}
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
                                <select className="border border-slate-300 rounded px-2 py-1 text-xs bg-white outline-none" value={interval} onChange={e => setInterval(e.target.value)}>
                                    {INTERVALS.map(i => <option key={i.val} value={i.val}>{i.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Selection Area */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-blue-500"/> 配置数据源
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Left: Scope & Filters */}
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 block mb-1">所属项目</label>
                                            <select className="w-full border rounded p-2 text-xs" value={activeProject} onChange={e => {setActiveProject(e.target.value); setCheckedDevices([])}}>
                                                {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 block mb-1">设备类型</label>
                                            <select className="w-full border rounded p-2 text-xs" value={activeDeviceType} onChange={e => {setActiveDeviceType(e.target.value); setCheckedMetrics([])}}>
                                                {DEVICE_TYPES.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {mode === 'raw' ? (
                                        <div className="border rounded-lg h-48 overflow-hidden flex flex-col">
                                            <div className="bg-slate-50 px-3 py-2 border-b text-xs font-medium text-slate-600 flex justify-between">
                                                <span>设备列表</span>
                                                <button onClick={() => setCheckedDevices(availableDevices.map(d => d.id))} className="text-blue-600 hover:underline">全选</button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                                {availableDevices.map(d => (
                                                    <label key={d.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                                        <input type="checkbox" checked={checkedDevices.includes(d.id)} onChange={e => e.target.checked ? setCheckedDevices([...checkedDevices, d.id]) : setCheckedDevices(checkedDevices.filter(x => x !== d.id))} className="rounded border-slate-300 text-blue-600 focus:ring-0"/>
                                                        <span className="text-xs">{d.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border rounded-lg h-48 overflow-hidden flex flex-col">
                                            <div className="bg-slate-50 px-3 py-2 border-b text-xs font-medium text-indigo-600 flex justify-between">
                                                <span>标签筛选 (动态添加)</span>
                                                <button onClick={addTagRow} className="text-indigo-600 hover:bg-indigo-50 rounded px-1"><Plus className="w-3 h-3"/></button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                                {tagRows.map((row) => {
                                                    const availableKeys = getAvailableTagKeys(row.id);
                                                    const allKeys = availableKeys; // Corrected logic
                                                    const currentTag = currentDeviceType.tags.find(t => t.key === row.tagKey);
                                                    return (
                                                        <div key={row.id} className="flex items-center gap-1">
                                                            <select className="w-24 text-[10px] border rounded" value={row.tagKey} onChange={e => updateTagRow(row.id, 'tagKey', e.target.value)}>
                                                                <option value="">标签...</option>
                                                                {allKeys.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
                                                            </select>
                                                            <select className="flex-1 text-[10px] border rounded" value={row.tagValue} onChange={e => updateTagRow(row.id, 'tagValue', e.target.value)}>
                                                                <option value="">值...</option>
                                                                {currentTag?.values.map(v => <option key={v} value={v}>{v}</option>)}
                                                            </select>
                                                            <button onClick={() => removeTagRow(row.id)} className="text-red-400"><X className="w-3 h-3"/></button>
                                                        </div>
                                                    )
                                                })}
                                                {tagRows.length === 0 && <div className="text-[10px] text-slate-400 text-center mt-4">未配置筛选，默认全量聚合</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Metrics */}
                                <div className="flex flex-col gap-4">
                                    <div className="border rounded-lg h-full overflow-hidden flex flex-col">
                                        <div className="bg-slate-50 px-3 py-2 border-b text-xs font-medium text-slate-600 flex justify-between">
                                            <span>选择属性</span>
                                            <button onClick={() => setCheckedMetrics(currentDeviceType.metrics.map(m => m.key))} className="text-blue-600 hover:underline">全选</button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                            {currentDeviceType.metrics.map(m => (
                                                <label key={m.key} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-100">
                                                    <input type="checkbox" checked={checkedMetrics.includes(m.key)} onChange={e => e.target.checked ? setCheckedMetrics([...checkedMetrics, m.key]) : setCheckedMetrics(checkedMetrics.filter(x => x !== m.key))} className="rounded border-slate-300 text-blue-600 focus:ring-0"/>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-slate-700">{m.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{m.key}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={handleAddPoints} disabled={checkedMetrics.length === 0} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-all disabled:opacity-50">
                                        添加至下方列表 <ArrowRight className="w-3 h-3 inline ml-1"/>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Selected Points Table */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-slate-700">已选指标 ({selectedPoints.length})</h3>
                                <button onClick={() => setSelectedPoints([])} className="text-xs text-red-500 hover:underline">清空全部</button>
                            </div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="p-2 border-r">数据源</th>
                                            <th className="p-2 border-r">属性</th>
                                            {mode === 'aggregate' && <th className="p-2 border-r">聚合函数</th>}
                                            <th className="p-2 border-r text-green-700 font-bold bg-green-50/50">元数据映射 (Mapping)</th>
                                            <th className="p-2 w-10">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedPoints.map((p, idx) => (
                                            <tr key={p.id} className="hover:bg-slate-50">
                                                <td className="p-2 border-r">
                                                    {p.mode === 'raw' ? (
                                                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{p.deviceName}</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(p.tagFilters || {}).map(([k,v]) => <span key={k} className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded">{v[0]}</span>)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2 border-r font-medium">{p.metricName}</td>
                                                {mode === 'aggregate' && (
                                                    <td className="p-2 border-r">
                                                        <select value={p.aggFunc} onChange={e => {const n=[...selectedPoints]; n[idx].aggFunc=e.target.value; setSelectedPoints(n)}} className="border rounded p-1 bg-white">
                                                            {AGG_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                                        </select>
                                                    </td>
                                                )}
                                                <td className="p-2 border-r bg-green-50/10">
                                                    <div className="flex items-center gap-1">
                                                        <ArrowRightLeft className="w-3 h-3 text-slate-300"/>
                                                        <select value={p.targetField||''} onChange={e => {const n=[...selectedPoints]; n[idx].targetField=e.target.value; setSelectedPoints(n)}} className="flex-1 border border-green-200 rounded p-1 bg-white text-green-700 font-mono">
                                                            <option value="">保持原名</option>
                                                            {MODEL_SCHEMA.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button onClick={() => setSelectedPoints(selectedPoints.filter(x => x.id !== p.id))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {selectedPoints.length === 0 && <div className="text-center py-8 text-slate-400 text-xs">暂无数据，请从上方添加</div>}
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

                {activeTab === 'schedule' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <CalendarClock className="w-5 h-5 text-orange-500"/> 定时执行配置
                                </h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={scheduleConfig.enabled} onChange={e => setScheduleConfig({...scheduleConfig, enabled: e.target.checked})} className="sr-only peer"/>
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    <span className="ml-3 text-sm font-medium text-slate-900">{scheduleConfig.enabled ? '已启用' : '未启用'}</span>
                                </label>
                            </div>
                            
                            {scheduleConfig.enabled && (
                                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">执行频率</label>
                                        <select 
                                            className="w-full border border-slate-300 rounded p-2 text-sm"
                                            value={scheduleConfig.frequency}
                                            onChange={e => setScheduleConfig({...scheduleConfig, frequency: e.target.value as any})}
                                        >
                                            <option value="daily">每天 (Daily)</option>
                                            <option value="weekly">每周 (Weekly)</option>
                                            <option value="monthly">每月 (Monthly)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">执行时间 (24h)</label>
                                        <input 
                                            type="time" 
                                            className="w-full border border-slate-300 rounded p-2 text-sm"
                                            value={scheduleConfig.time}
                                            onChange={e => setScheduleConfig({...scheduleConfig, time: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel: Data Preview & Shape */}
            <DataPreviewPanel selectedPoints={selectedPoints} computedFeatures={computedFeatures} />
        </div>
    </div>
  );
}

// ======================= 6. Sub-Components (Feature Eng & Preview) =======================

// --- Feature Engineering Panel ---
function FeatureEngineeringPanel({ selectedPoints, imputeConfig, setImputeConfig, filterLogic, setFilterLogic, computedFeatures, setComputedFeatures }: any) {
    
    // ... [Same implementation as previous step, ensuring variables reference selectedPoints] ...
    const addVariable = (target: 'filter' | string) => {
        const newVar = { id: `v-${Date.now()}`, name: `v${Date.now() % 1000}`, sourcePointId: '' };
        if (target === 'filter') setFilterLogic({ ...filterLogic, variables: [...filterLogic.variables, newVar] });
        else setComputedFeatures(computedFeatures.map((f: any) => f.id === target ? { ...f, variables: [...f.variables, newVar] } : f));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 pb-20">
            {/* 1. Cleaning */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Eraser className="w-4 h-4 text-orange-500"/> 1. 数据清洗 (Cleaning)</h3>
                <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-500">缺失值填充策略:</span>
                    <div className="flex gap-2">
                        {['none', 'ffill', 'zero', 'linear'].map(s => (
                            <button key={s} onClick={() => setImputeConfig({...imputeConfig, strategy: s})} className={`px-3 py-1.5 rounded border transition-colors ${imputeConfig.strategy === s ? 'bg-orange-50 border-orange-200 text-orange-700 font-medium' : 'bg-white border-slate-200 text-slate-600'}`}>{s}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Filter */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Filter className="w-4 h-4 text-blue-500"/> 2. 复杂行筛选 (Row Filter)</h3>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filterLogic.enabled} onChange={e => setFilterLogic({...filterLogic, enabled: e.target.checked})} className="rounded text-blue-600 focus:ring-0"/><span className="text-xs text-slate-600">启用</span></label>
                </div>
                {filterLogic.enabled && (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-400 font-medium uppercase"><span>定义变量 (Variables)</span><button onClick={() => addVariable('filter')} className="text-blue-600 hover:underline">+ 新增变量</button></div>
                            {filterLogic.variables.map((v: any, idx: number) => (
                                <div key={v.id} className="flex items-center gap-2 bg-white p-1 rounded border border-slate-200">
                                    <input className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-600 w-20 text-center" value={v.name} onChange={e => {const n=[...filterLogic.variables]; n[idx].name=e.target.value; setFilterLogic({...filterLogic, variables:n})}} />
                                    <span className="text-slate-300">=</span>
                                    <select className="flex-1 text-xs border-none outline-none bg-transparent" value={v.sourcePointId} onChange={e => {const n=[...filterLogic.variables]; n[idx].sourcePointId=e.target.value; setFilterLogic({...filterLogic, variables:n})}}>
                                        <option value="">选择数据源...</option>
                                        {selectedPoints.map((p: any) => <option key={p.id} value={p.id}>{p.deviceName || '聚合'} - {p.metricName}</option>)}
                                    </select>
                                    <button onClick={() => setFilterLogic({...filterLogic, variables: filterLogic.variables.filter((xv:any) => xv.id !== v.id)})} className="text-slate-300 hover:text-red-500 px-2"><X className="w-3 h-3"/></button>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs text-slate-400 font-medium uppercase">筛选公式 (Expression)</div>
                            <input className="w-full border border-slate-300 rounded p-2 text-sm font-mono focus:border-blue-500 outline-none" placeholder="e.g. v1 > 0 || v2 > 10" value={filterLogic.expression} onChange={e => setFilterLogic({...filterLogic, expression: e.target.value})}/>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Computed Features */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calculator className="w-4 h-4 text-indigo-500"/> 3. 构造新特征 (Calculated Fields)</h3>
                    <button onClick={() => setComputedFeatures([...computedFeatures, { id: `feat-${Date.now()}`, name: 'new_feature', variables: [], expression: '' }])} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors">+ 新增计算列</button>
                </div>
                <div className="space-y-4">
                    {computedFeatures.length === 0 && <div className="text-center text-xs text-slate-400 py-4">暂无计算特征</div>}
                    {computedFeatures.map((feat: any, fIdx: number) => (
                        <div key={feat.id} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-white bg-indigo-400 px-1.5 rounded">F{fIdx+1}</span><input className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0" value={feat.name} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].name=e.target.value; setComputedFeatures(n)}} /></div>
                                <button onClick={() => setComputedFeatures(computedFeatures.filter((f:any) => f.id !== feat.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-4">
                                <div className="space-y-2 border-r border-slate-100 pr-4">
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase"><span>参数映射</span><button onClick={() => addVariable(feat.id)} className="text-indigo-600 hover:underline">+ 添加</button></div>
                                    <div className="space-y-1">
                                        {feat.variables.map((v: any, vIdx: number) => (
                                            <div key={v.id} className="flex items-center gap-1">
                                                <input className="w-16 text-[10px] border rounded p-1 text-center bg-slate-50" value={v.name} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].variables[vIdx].name=e.target.value; setComputedFeatures(n)}} />
                                                <span className="text-slate-300 text-[10px]">=</span>
                                                <select className="flex-1 text-[10px] border rounded p-1" value={v.sourcePointId} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].variables[vIdx].sourcePointId=e.target.value; setComputedFeatures(n)}}>
                                                    <option value="">指标...</option>
                                                    {selectedPoints.map((p: any) => <option key={p.id} value={p.id}>{p.deviceName || '聚合'}-{p.metricName}</option>)}
                                                </select>
                                                <button onClick={() => {const n=[...computedFeatures]; n[fIdx].variables=n[fIdx].variables.filter((xv:any)=>xv.id!==v.id); setComputedFeatures(n)}} className="text-slate-300 hover:text-red-400"><X className="w-3 h-3"/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">计算公式</div>
                                    <textarea className="w-full h-20 border border-slate-200 rounded p-2 text-xs font-mono resize-none focus:border-indigo-500 outline-none" placeholder="(v1 + v2) / 2" value={feat.expression} onChange={(e) => {const n=[...computedFeatures]; n[fIdx].expression=e.target.value; setComputedFeatures(n)}} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// --- Data Preview Panel (增强版：含统计行) ---
function DataPreviewPanel({ selectedPoints, computedFeatures }: any) {
    const columns = useMemo(() => {
        return [
            ...selectedPoints.map((p: any) => ({ 
                id: p.id, 
                // 优先展示映射后的字段名，否则展示原始名
                name: p.targetField || p.metricName, 
                sub: p.targetField ? `(原: ${p.metricKey})` : (p.deviceName || '聚合'), 
                type: 'raw',
                isMapped: !!p.targetField
            })),
            ...computedFeatures.map((f: any) => ({ id: f.id, name: f.name, sub: 'Calculated', type: 'calc' }))
        ];
    }, [selectedPoints, computedFeatures]);

    // Mock Data & Stats
    const { data, stats } = useMemo(() => {
        if (selectedPoints.length === 0) return { data: [], stats: {} };
        
        // Mock Stats Logic
        const colStats: any = {};
        columns.forEach(c => {
            colStats[c.id] = {
                min: (Math.random() * 10).toFixed(1),
                max: (Math.random() * 100 + 50).toFixed(1),
                avg: (Math.random() * 50 + 20).toFixed(1),
                nulls: '0%'
            };
        });

        // Mock Rows
        const rows = Array.from({length: 12}).map((_, i) => {
            const row: any = { ts: `2023-12-10 0${i}:00` };
            columns.forEach(col => {
                row[col.id] = (Math.random() * 100).toFixed(2);
            });
            return row;
        });
        return { data: rows, stats: colStats };
    }, [columns]);

    return (
        <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col relative p-6">
            <div className="absolute inset-0 bg-grid-slate-200/50 pointer-events-none" />
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex-1 flex flex-col overflow-hidden z-10">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-2">
                        <TableIcon className="w-5 h-5 text-slate-400" />
                        <span className="font-bold text-slate-700">处理后数据概览 (Data Profile)</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                        {data.length} Rows x {columns.length} Columns
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto">
                    {columns.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <TableIcon className="w-16 h-16 opacity-20 mb-4"/>
                            <p className="text-sm">请先配置提取数据</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                {/* Header Row 1: Names */}
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-500 border-b border-r border-slate-100 w-32 bg-slate-50">时间戳</th>
                                    {columns.map(col => (
                                        <th key={col.id} className={`px-4 py-3 font-semibold border-b border-r border-slate-100 min-w-[140px] ${col.type === 'calc' ? 'bg-indigo-50/50 text-indigo-700' : col.isMapped ? 'bg-green-50/50 text-green-700' : 'bg-slate-50 text-slate-500'}`}>
                                            <div className="flex flex-col">
                                                <span>{col.name}</span>
                                                <span className="text-[9px] font-normal opacity-70 mt-0.5 truncate">{col.sub}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                                {/* Header Row 2: Stats */}
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    <td className="px-4 py-2 font-bold text-slate-400 border-r border-slate-100 text-[10px] uppercase">Stats</td>
                                    {columns.map(col => (
                                        <td key={col.id} className="px-4 py-1 border-r border-slate-100">
                                            <div className="grid grid-cols-2 gap-x-2 text-[9px] text-slate-400 leading-tight">
                                                <span>Min: <span className="text-slate-600">{stats[col.id]?.min}</span></span>
                                                <span>Avg: <span className="text-blue-600 font-medium">{stats[col.id]?.avg}</span></span>
                                                <span>Max: <span className="text-slate-600">{stats[col.id]?.max}</span></span>
                                                <span>Null: <span className="text-slate-600">{stats[col.id]?.nulls}</span></span>
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.map((row: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-blue-50/30">
                                        <td className="px-4 py-2 font-mono text-slate-500 border-r border-slate-50">{row.ts.split(' ')[1]}</td>
                                        {columns.map(col => (
                                            <td key={col.id} className={`px-4 py-2 font-mono border-r border-slate-50 ${col.type === 'calc' ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}>
                                                {row[col.id]}
                                            </td>
                                        ))}
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