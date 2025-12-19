import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  Layers, 
  Code, 
  Play, 
  BarChart3, 
  Activity,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  Filter,
  Server,
  Building2,
  Search,
  Tag,
  ListFilter,
  XCircle,
  Check,
  FileJson,
  ArrowRightLeft,
  AlertCircle,
  Calendar,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  ArrowLeft,
  Save,
  Edit,
  RefreshCw,
  Settings,
  History,
  ChevronDown,
  ChevronRight,
  FileText,
  Copy,
  CalendarClock,
  Zap,
  Table as TableIcon,
  Sigma,
  HardDrive,
  BarChart4,
  ChevronUp,
  X
} from 'lucide-react';

// ------------------- Mock Data -------------------

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
  brand: ['格力 (Gree)', '美的 (Midea)', '开利 (Carrier)', '约克 (York)', '特灵 (Trane)', '麦克维尔 (McQuay)', '海尔 (Haier)', '顿汉布什 (Dunham-Bush)', 'LG', '大金 (Daikin)'],
  area: ['华东区域', '华北区域', '华南区域', '华中区域', '西南区域', '西北区域', '东北区域'],
  usage: ['商业用电', '空调用电', '动力用电', '照明用电', '特殊用电'],
  phase: ['一期工程', '二期工程', '三期扩建', '四期规划'],
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
    { id: 'chiller_01', name: '1# 离心式冷机', projectId: 'p1' },
    { id: 'chiller_02', name: '2# 螺杆式冷机', projectId: 'p1' },
    { id: 'chiller_dx_01', name: '大兴 1# 冷机', projectId: 'p2' },
    { id: 'chiller_sz_01', name: '深圳 1# 冷机', projectId: 'p3' },
    { id: 'chiller_gz_01', name: '广州塔 主冷机 A', projectId: 'p4' },
    { id: 'chiller_gz_02', name: '广州塔 主冷机 B', projectId: 'p4' },
    { id: 'chiller_hz_01', name: '博地中心 1#', projectId: 'p5' },
    { id: 'chiller_cd_01', name: '成都IFS 离心机组', projectId: 'p6' },
  ],
  elec_meter: [
    { id: 'meter_main_sh', name: '上海总进线柜', projectId: 'p1' },
    { id: 'meter_hvac_sh', name: '上海空调总表', projectId: 'p1' },
    { id: 'meter_main_bj', name: '北京总进线柜', projectId: 'p2' },
    { id: 'meter_gz_01', name: '广州塔 动力总表', projectId: 'p4' },
  ],
  water_pump: [
    { id: 'pump_cw_01', name: '1# 冷却泵', projectId: 'p1' },
    { id: 'pump_sz_01', name: '深圳 1# 水泵', projectId: 'p3' },
  ]
};

const AGG_FUNCTIONS = ['AVG', 'MAX', 'MIN', 'SUM', 'COUNT'];
const INTERVALS = [
  { val: '1m', label: '1 分钟' },
  { val: '15m', label: '15 分钟' },
  { val: '1h', label: '1 小时' },
  { val: '1d', label: '1 天' },
];

// ------------------- Types -------------------

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
  targetField?: string; 
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

type ScheduleConfig = {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; 
    dayOfWeek?: number; 
    dayOfMonth?: number; 
};

type DataTemplate = {
  id: string;
  name: string;
  desc?: string;
  lastUpdated: string;
  creator: string;
  interval: string;
  points: SelectedPoint[];
  schedule: ScheduleConfig;
  records: DataRecord[]; 
};

// New Type for Dynamic Filter Rows
type TagFilterRow = {
    id: string;
    tagKey: string;
    tagValue: string;
};

// ------------------- Main Component -------------------

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [currentTemplate, setCurrentTemplate] = useState<DataTemplate | null>(null);
  
  const [templates, setTemplates] = useState<DataTemplate[]>([
    {
      id: 'tpl-001',
      name: '焊接室温度对比情况',
      desc: '用于分析不同焊接室在工作周期的温度波动',
      lastUpdated: '2025-08-04 11:28:58',
      creator: '刘洋',
      interval: '1h',
      points: [], 
      schedule: { enabled: false, frequency: 'daily', time: '00:00' },
      records: [
          { id: 'rec-1', templateId: 'tpl-001', status: 'success', timeRange: {start: '2025-08-01 00:00', end: '2025-08-05 00:00'}, rowCount: 1200, fileSize: '2.4 MB', executeTime: '2025-08-04 14:10:37', executor: '刘洋' },
          { id: 'rec-2', templateId: 'tpl-001', status: 'success', timeRange: {start: '2025-08-01 00:00', end: '2025-08-05 00:00'}, rowCount: 1200, fileSize: '2.4 MB', executeTime: '2025-08-04 11:46:43', executor: '刘洋' }
      ]
    },
    {
      id: 'tpl-002',
      name: '大兴机场能耗训练集 (V2)',
      desc: '包含所有电表的有功功率，用于训练负荷预测模型',
      lastUpdated: '2025-12-10 09:15',
      creator: '系统管理员',
      interval: '15m',
      points: [],
      schedule: { enabled: true, frequency: 'daily', time: '02:00' },
      records: [
          { id: 'rec-3', templateId: 'tpl-002', status: 'generating', timeRange: {start: '2025-11-01 00:00', end: '2025-11-30 00:00'}, rowCount: 0, fileSize: '-', executeTime: '2025-12-10 09:16:22', executor: '自动调度' }
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
      setTemplates(templates.map(d => d.id === config.id ? {...d, ...config} : d));
    } else {
      setTemplates([config, ...templates]);
    }
    setView('dashboard');
  };

  const handleGenerateRecord = (tplId: string, start: string, end: string) => {
      const newRec: DataRecord = {
          id: `rec-${Date.now()}`,
          templateId: tplId,
          status: 'generating',
          timeRange: { start, end },
          rowCount: 0,
          fileSize: '-',
          executeTime: new Date().toLocaleString(),
          executor: '当前用户'
      };
      setTemplates(templates.map(t => {
          if (t.id === tplId) {
              return { ...t, records: [newRec, ...t.records] };
          }
          return t;
      }));
      setTimeout(() => {
          setTemplates(prev => prev.map(t => {
              if (t.id === tplId) {
                  return {
                      ...t,
                      records: t.records.map(r => r.id === newRec.id ? { ...r, status: 'success', rowCount: 5600, fileSize: '8.2 MB' } : r)
                  };
              }
              return t;
          }));
      }, 2000);
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {view === 'dashboard' ? (
        <DashboardView 
          templates={templates} 
          onCreate={handleCreate} 
          onEdit={handleEdit}
          onGenerate={handleGenerateRecord}
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

// ------------------- Dashboard View -------------------

function DashboardView({ templates, onCreate, onEdit, onGenerate }: { 
  templates: DataTemplate[], 
  onCreate: () => void,
  onEdit: (tpl: DataTemplate) => void,
  onGenerate: (tplId: string, start: string, end: string) => void
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showRunModal, setShowRunModal] = useState<string | null>(null);
  const [runStart, setRunStart] = useState('2025-12-09 00:00');
  const [runEnd, setRunEnd] = useState('2025-12-10 00:00');

  const toggleExpand = (id: string) => setExpandedRow(expandedRow === id ? null : id);
  const openRunModal = (id: string) => setShowRunModal(id);
  const confirmRun = () => {
      if (showRunModal) {
          onGenerate(showRunModal, runStart, runEnd);
          setShowRunModal(null);
          setExpandedRow(showRunModal);
      }
  };
  const getScheduleText = (s: ScheduleConfig) => {
      if (!s.enabled) return '未启用';
      if (s.frequency === 'daily') return `每天 ${s.time}`;
      if (s.frequency === 'weekly') {
          const days = ['周日','周一','周二','周三','周四','周五','周六'];
          return `每周${days[s.dayOfWeek || 1]} ${s.time}`;
      }
      if (s.frequency === 'monthly') return `每月${s.dayOfMonth || 1}号 ${s.time}`;
      return '自定义';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            数据导出模版管理
          </h1>
          <p className="text-xs text-slate-500 mt-1">定义数据提取规则，按需生成历史数据快照。</p>
        </div>
        <div className="flex gap-3">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input type="text" placeholder="搜索模版名称..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64 bg-white" />
            </div>
            <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> 新建模版
            </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/80 text-xs font-bold text-slate-500">
          <div className="col-span-1"></div>
          <div className="col-span-3">数据导出模版名称</div>
          <div className="col-span-2">自动化调度</div>
          <div className="col-span-2">创建人</div>
          <div className="col-span-2">最后定义时间</div>
          <div className="col-span-2 text-right">操作</div>
        </div>
        <div className="overflow-y-auto flex-1">
          {templates.map(tpl => {
              const isScheduled = tpl.schedule.enabled;
              return (
                <React.Fragment key={tpl.id}>
                    <div className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 items-center transition-colors ${expandedRow === tpl.id ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                    <div className="col-span-1 flex justify-center">
                        <button onClick={() => toggleExpand(tpl.id)} className="p-1 rounded hover:bg-slate-200 text-slate-400">
                            {expandedRow === tpl.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="col-span-3">
                        <div className="font-semibold text-slate-800 text-sm cursor-pointer hover:text-blue-600" onClick={() => onEdit(tpl)}>{tpl.name}</div>
                        {tpl.desc && <div className="text-xs text-slate-400 mt-0.5 truncate">{tpl.desc}</div>}
                    </div>
                    <div className="col-span-2">
                        {isScheduled ? (
                            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100 w-fit">
                                <CalendarClock className="w-3.5 h-3.5" /> <span className="font-medium">{getScheduleText(tpl.schedule)}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> 未启用</div>
                        )}
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-bold">{tpl.creator[0]}</div>
                        <span className="text-sm text-slate-600">{tpl.creator}</span>
                    </div>
                    <div className="col-span-2 text-sm text-slate-600 font-mono">{tpl.lastUpdated}</div>
                    <div className="col-span-2 flex justify-end gap-2">
                        <button onClick={() => openRunModal(tpl.id)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="立即执行"><Play className="w-4 h-4" /></button>
                        <button onClick={() => onEdit(tpl)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors" title="编辑模版"><Edit className="w-4 h-4" /></button>
                        <button className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    </div>
                    {expandedRow === tpl.id && (
                        <div className="bg-slate-50 border-b border-slate-200 p-4 pl-16">
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-inner">
                                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-slate-500 flex items-center gap-2"><History className="w-3 h-3" /> 导出历史记录</h3>
                                    <span className="text-[10px] text-slate-400">共 {tpl.records.length} 条记录</span>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {tpl.records.length === 0 ? <div className="text-center py-6 text-xs text-slate-400">暂无导出记录</div> : (
                                        <table className="w-full text-left text-xs">
                                            <thead className="text-slate-400 bg-white sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 font-medium">状态</th>
                                                    <th className="px-4 py-2 font-medium">数据时间周期</th>
                                                    <th className="px-4 py-2 font-medium text-right">记录数</th>
                                                    <th className="px-4 py-2 font-medium text-right">文件大小</th>
                                                    <th className="px-4 py-2 font-medium">导出方式</th>
                                                    <th className="px-4 py-2 font-medium">导出时间</th>
                                                    <th className="px-4 py-2 font-medium text-right">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {tpl.records.map(rec => (
                                                    <tr key={rec.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2.5">
                                                            {rec.status === 'success' && <span className="text-green-600 font-medium">成功</span>}
                                                            {rec.status === 'generating' && <span className="text-blue-600 font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/> 生成中</span>}
                                                            {rec.status === 'failed' && <span className="text-red-600 font-medium">失败</span>}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-slate-600">{rec.timeRange.start} - {rec.timeRange.end}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono">{rec.rowCount > 0 ? rec.rowCount : '-'}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono">{rec.fileSize}</td>
                                                        <td className="px-4 py-2.5">{rec.executor === '自动调度' ? <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><Zap className="w-3 h-3 text-orange-400" /> 自动</span> : rec.executor}</td>
                                                        <td className="px-4 py-2.5 text-slate-400">{rec.executeTime}</td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            {rec.status === 'success' ? <button className="text-blue-600 hover:underline inline-flex items-center gap-1"><Download className="w-3 h-3" /> 下载</button> : <span className="text-slate-300">-</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </React.Fragment>
              );
          })}
        </div>
      </div>

      {showRunModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Play className="w-4 h-4 text-blue-600" /> 新建导出任务</h3>
                      <button onClick={() => setShowRunModal(null)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-6">
                      <div className="space-y-2"><label className="text-sm font-medium text-slate-700">模版名称</label><div className="px-3 py-2 bg-slate-100 rounded text-sm text-slate-600 border border-slate-200">{templates.find(t => t.id === showRunModal)?.name}</div></div>
                      <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Calendar className="w-4 h-4" /> 选择时间周期</label>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1"><span className="text-xs text-slate-400">开始时间</span><input type="datetime-local" value={runStart} onChange={e => setRunStart(e.target.value)} className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                              <div className="space-y-1"><span className="text-xs text-slate-400">结束时间</span><input type="datetime-local" value={runEnd} onChange={e => setRunEnd(e.target.value)} className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                          </div>
                      </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                      <button onClick={() => setShowRunModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
                      <button onClick={confirmRun} className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-md">确认并导出数据</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

// ------------------- Editor View -------------------

function EditorView({ initialData, onSave, onBack }: { 
  initialData: DataTemplate | null, 
  onSave: (data: DataTemplate) => void,
  onBack: () => void
}) {
  const [templateName, setTemplateName] = useState(initialData?.name || '未命名模版');
  const [templateDesc, setTemplateDesc] = useState(initialData?.desc || '');
  const [scheduleEnabled, setScheduleEnabled] = useState(initialData?.schedule?.enabled || false);
  const [scheduleFreq, setScheduleFreq] = useState<ScheduleConfig['frequency']>(initialData?.schedule?.frequency || 'daily');
  const [scheduleTime, setScheduleTime] = useState(initialData?.schedule?.time || '00:00');
  const [scheduleDay, setScheduleDay] = useState(initialData?.schedule?.dayOfWeek || 1);
  const [scheduleMonthDay, setScheduleMonthDay] = useState(initialData?.schedule?.dayOfMonth || 1);
  const [previewStart, setPreviewStart] = useState('2025-12-09 00:00');
  const [previewEnd, setPreviewEnd] = useState('2025-12-10 00:00');
  const [mode, setMode] = useState<'raw' | 'aggregate'>('raw');
  const [interval, setInterval] = useState(initialData?.interval || '1h'); 
  const [selectedPoints, setSelectedPoints] = useState<SelectedPoint[]>(initialData?.points || []);
  const [activeDeviceType, setActiveDeviceType] = useState(DEVICE_TYPES[0].id);
  const [pickerProjects, setPickerProjects] = useState<string[]>([PROJECTS[0].id]);
  const [checkedDevices, setCheckedDevices] = useState<string[]>([]); 
  const [selectAllDevices, setSelectAllDevices] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<Record<string, string[]>>({});
  const [checkedMetrics, setCheckedMetrics] = useState<string[]>([]);
  const [selectAllMetrics, setSelectAllMetrics] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [metricSearch, setMetricSearch] = useState('');
  
  // --- New State for Dynamic Tag Rows ---
  const [tagRows, setTagRows] = useState<TagFilterRow[]>([]);

  const currentDeviceType = DEVICE_TYPES.find(d => d.id === activeDeviceType) || DEVICE_TYPES[0];
  const filteredProjects = useMemo(() => {
    if (!projectSearch) return PROJECTS;
    return PROJECTS.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()));
  }, [projectSearch]);
  const availableDevices = useMemo(() => {
    let devices = (DEVICE_INSTANCES[activeDeviceType] || []).filter(d => pickerProjects.includes(d.projectId));
    if (deviceSearch) { const term = deviceSearch.toLowerCase(); devices = devices.filter(d => d.name.toLowerCase().includes(term) || d.id.toLowerCase().includes(term)); }
    return devices;
  }, [activeDeviceType, pickerProjects, deviceSearch]);
  const devicesGroupedByProject = useMemo(() => {
    return availableDevices.reduce((acc, dev) => { if (!acc[dev.projectId]) acc[dev.projectId] = []; acc[dev.projectId].push(dev); return acc; }, {} as Record<string, typeof availableDevices>);
  }, [availableDevices]);
  const filteredMetrics = useMemo(() => {
    if (!metricSearch) return currentDeviceType.metrics;
    const term = metricSearch.toLowerCase();
    return currentDeviceType.metrics.filter(m => m.name.toLowerCase().includes(term) || m.key.toLowerCase().includes(term));
  }, [metricSearch, currentDeviceType]);

  useEffect(() => { setCheckedDevices([]); setSelectAllDevices(false); setCheckedMetrics([]); setSelectAllMetrics(false); setTagRows([]); setDeviceSearch(''); setMetricSearch(''); }, [mode, activeDeviceType]);
  useEffect(() => { if (selectAllDevices) setCheckedDevices(availableDevices.map(d => d.id)); else setCheckedDevices([]); }, [selectAllDevices]); 
  useEffect(() => { if (selectAllMetrics) setCheckedMetrics(filteredMetrics.map(m => m.key)); else setCheckedMetrics([]); }, [selectAllMetrics]);

  const handleFinalSave = () => {
    if (!templateName.trim()) { alert('请输入模版名称'); return; }
    if (selectedPoints.length === 0) { alert('请至少添加一个数据指标'); return; }
    const newTemplate: DataTemplate = {
        id: initialData?.id || `tpl-${Date.now()}`,
        name: templateName, desc: templateDesc, lastUpdated: new Date().toLocaleString(), creator: initialData?.creator || '当前用户',
        interval, points: selectedPoints,
        schedule: { enabled: scheduleEnabled, frequency: scheduleFreq, time: scheduleTime, dayOfWeek: scheduleDay, dayOfMonth: scheduleMonthDay },
        records: initialData?.records || [] 
    };
    onSave(newTemplate);
  };

  const toggleProject = (pid: string) => { if (pickerProjects.includes(pid)) setPickerProjects(pickerProjects.filter(id => id !== pid)); else setPickerProjects([...pickerProjects, pid]); };
  
  // --- New Tag Row Handlers ---
  const addTagRow = () => {
      setTagRows([...tagRows, { id: `row-${Date.now()}`, tagKey: '', tagValue: '' }]);
  };

  const removeTagRow = (id: string) => {
      setTagRows(tagRows.filter(r => r.id !== id));
  };

  const updateTagRow = (id: string, field: 'tagKey' | 'tagValue', val: string) => {
      setTagRows(tagRows.map(r => {
          if (r.id === id) {
              if (field === 'tagKey') {
                  // Reset value if key changes
                  return { ...r, tagKey: val, tagValue: '' };
              }
              return { ...r, [field]: val };
          }
          return r;
      }));
  };

  const getAvailableTagKeys = (currentRowId: string) => {
      // Allow keys that are not selected in other rows
      const usedKeys = tagRows.filter(r => r.id !== currentRowId && r.tagKey).map(r => r.tagKey);
      return currentDeviceType.tags.filter(t => !usedKeys.includes(t.key));
  };

  // Convert TagRows to Record<string, string[]> for existing logic compatibility
  // Note: logic was updated to avoid object-in-jsx error by ensuring strings are handled
  useEffect(() => {
      const filters: Record<string, string[]> = {};
      tagRows.forEach(r => {
          if (r.tagKey && r.tagValue) {
              filters[r.tagKey] = [r.tagValue]; // Single select wrapped in array
          }
      });
      setActiveTagFilters(filters);
  }, [tagRows]);

  const handleAddMetrics = () => {
     const newPoints: SelectedPoint[] = [];
     if (mode === 'raw') {
       const devicesToProcess = availableDevices.filter(d => checkedDevices.includes(d.id));
       if (devicesToProcess.length === 0) return;
       devicesToProcess.forEach(device => {
         const project = PROJECTS.find(p => p.id === device.projectId);
         checkedMetrics.forEach(metricKey => {
           const metric = currentDeviceType.metrics.find(m => m.key === metricKey);
           newPoints.push({ id: `raw-${device.id}-${metricKey}-${Date.now()}`, mode: 'raw', projectId: project?.id, projectName: project?.name, deviceTypeId: currentDeviceType.id, deviceTypeName: currentDeviceType.name, deviceId: device.id, deviceName: device.name, metricKey: metricKey, metricName: metric?.name || metricKey, unit: metric?.unit || '', aggFunc: 'AVG' });
         });
       });
       setCheckedDevices([]); setSelectAllDevices(false);
     } else {
       if (checkedMetrics.length === 0) return;
       checkedMetrics.forEach(metricKey => {
         const metric = currentDeviceType.metrics.find(m => m.key === metricKey);
         newPoints.push({ id: `agg-${currentDeviceType.id}-${metricKey}-${Date.now()}`, mode: 'aggregate', deviceTypeId: currentDeviceType.id, deviceTypeName: currentDeviceType.name, tagFilters: { ...activeTagFilters }, metricKey: metricKey, metricName: metric?.name || metricKey, unit: metric?.unit || '', aggFunc: 'AVG' });
       });
       setCheckedMetrics([]); setSelectAllMetrics(false);
     }
     const existingIds = new Set(selectedPoints.map(p => `${p.deviceId}-${p.metricKey}-${JSON.stringify(p.tagFilters)}`));
     const filteredNew = newPoints.filter(p => !existingIds.has(`${p.deviceId}-${p.metricKey}-${JSON.stringify(p.tagFilters)}`));
     setSelectedPoints([...selectedPoints, ...filteredNew]);
  };
  const handleMapField = (pointId: string, targetField: string) => { setSelectedPoints(selectedPoints.map(p => p.id === pointId ? { ...p, targetField } : p)); };
  
  // --- Data & Stats Logic ---
  const estimatedRows = useMemo(() => {
      const start = new Date(previewStart).getTime();
      const end = new Date(previewEnd).getTime();
      const diffMinutes = Math.max(0, (end - start) / (1000 * 60));
      let count = 0;
      if (mode === 'raw') {
          const deviceCount = new Set(selectedPoints.map(p => p.deviceId)).size || 1;
          count = diffMinutes * deviceCount; 
      } else {
          let divisor = 1;
          if (interval === '15m') divisor = 15;
          if (interval === '1h') divisor = 60;
          if (interval === '1d') divisor = 1440;
          count = Math.floor(diffMinutes / divisor);
      }
      return count;
  }, [previewStart, previewEnd, interval, mode, selectedPoints]);

  const previewColumns = useMemo(() => {
      return selectedPoints.map(p => {
          let label = p.targetField;
          if (!label) {
              label = p.mode === 'aggregate' ? `${p.aggFunc}(${p.metricKey})` : p.metricKey;
          }
          return { id: p.id, label, subLabel: p.mode === 'raw' ? p.deviceName : '聚合数据', metricKey: p.metricKey };
      });
  }, [selectedPoints]);

  const columnStats = useMemo(() => {
      return selectedPoints.reduce((acc, p) => {
          // Mock stats logic similar to pandas describe
          let base = 50;
          if (p.metricKey.includes('temp')) base = 25;
          else if (p.metricKey.includes('power')) base = 1200;
          else if (p.metricKey.includes('efficiency') || p.metricKey.includes('cop')) base = 4.5;
          else if (p.metricKey.includes('current')) base = 80;
          
          acc[p.id] = {
              min: (base * (0.8 + Math.random() * 0.1)).toFixed(2),
              max: (base * (1.1 + Math.random() * 0.1)).toFixed(2),
              avg: base.toFixed(2),
              std: (base * 0.05).toFixed(3),
              missing: (Math.random()).toFixed(1) + '%'
          };
          return acc;
      }, {} as any);
  }, [selectedPoints]);

  const previewTableData = useMemo(() => {
      if (selectedPoints.length === 0) return [];
      const rows = [];
      const rowCount = 10; 
      for (let i = 0; i < rowCount; i++) {
          const row: any = { ts: new Date(new Date(previewStart).getTime() + i * 1000 * 60 * (interval === '1h' ? 60 : 15)).toLocaleString() };
          selectedPoints.forEach((p, idx) => {
              const stats = columnStats[p.id];
              const base = parseFloat(stats.avg);
              const val = base + (Math.random() - 0.5) * (base * 0.1); 
              
              const key = p.targetField || (p.mode === 'aggregate' ? `${p.aggFunc}(${p.metricKey})` : p.metricKey);
              row[key] = val.toFixed(2);
          });
          rows.push(row);
      }
      return rows;
  }, [selectedPoints, previewStart, interval, columnStats]);

  const estimatedSize = useMemo(() => {
      const bytesPerRow = 8 + (selectedPoints.length * 8); 
      const totalBytes = estimatedRows * bytesPerRow;
      if (totalBytes > 1024 * 1024) return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
      return `${(totalBytes / 1024).toFixed(2)} KB`;
  }, [estimatedRows, selectedPoints]);


  return (
    <div className="flex h-full bg-slate-50 text-slate-800 font-sans">
        {/* Left Panel */}
        <div className="w-[660px] flex flex-col border-r border-slate-200 bg-white shadow-xl z-20">
            {/* Header with Navigation */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white space-y-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                    <div className="flex-1">
                        <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="输入模版名称..." className="text-lg font-bold text-slate-800 border-none outline-none focus:ring-0 placeholder:text-slate-300 w-full" />
                        <input type="text" value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} placeholder="添加模版描述 (可选)..." className="text-xs text-slate-500 border-none outline-none focus:ring-0 placeholder:text-slate-300 w-full mt-1" />
                    </div>
                </div>
                <div className="bg-slate-100 p-1 rounded-lg flex">
                    <button onClick={() => setMode('raw')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-2 ${mode === 'raw' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><ListFilter className="w-3.5 h-3.5" /> 明细模式</button>
                    <button onClick={() => setMode('aggregate')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-2 ${mode === 'aggregate' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><Tag className="w-3.5 h-3.5" /> 聚合模式</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                     <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4">
                         <div className="space-y-3">
                             {mode === 'raw' && (
                                 <div className="space-y-1.5">
                                     <div className="flex justify-between items-center text-xs font-medium text-slate-500"><span>项目筛选 ({pickerProjects.length} 已选)</span></div>
                                     <div className="relative"><Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" /><input type="text" placeholder="搜索项目..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-300 outline-none mb-2" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} /></div>
                                     <div className="flex flex-wrap gap-2 max-h-[60px] overflow-y-auto content-start">{filteredProjects.map(p => (<button key={p.id} onClick={() => toggleProject(p.id)} className={`px-2 py-1 text-[10px] rounded-full border transition-all ${pickerProjects.includes(p.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{p.name}</button>))}</div>
                                 </div>
                             )}
                             <div className="flex gap-2 overflow-x-auto pb-1">{DEVICE_TYPES.map(dt => (<button key={dt.id} onClick={() => setActiveDeviceType(dt.id)} className={`px-3 py-1 text-xs rounded border transition-colors whitespace-nowrap ${activeDeviceType === dt.id ? (mode==='raw'?'bg-blue-50 border-blue-200 text-blue-700 font-medium':'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium') : 'bg-white border-slate-200 text-slate-600'}`}>{dt.name}</button>))}</div>
                         </div>
                         <div className="flex gap-3 h-[240px]">
                             {mode === 'raw' ? (
                                 <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
                                     <div className="p-2 border-b border-slate-100 bg-slate-50 flex flex-col gap-2"><div className="flex justify-between items-center text-xs text-slate-600 font-medium"><span>设备</span><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={selectAllDevices} onChange={e=>setSelectAllDevices(e.target.checked)} className="rounded text-blue-600 w-3 h-3" /><span className="text-[10px]">全选</span></label></div><input type="text" placeholder="搜设备..." className="w-full px-2 py-1 text-[10px] border border-slate-200 rounded" value={deviceSearch} onChange={e=>setDeviceSearch(e.target.value)} /></div>
                                     <div className="overflow-y-auto p-1 flex-1">{Object.entries(devicesGroupedByProject).map(([pid, devs]) => (<div key={pid} className="mb-2"><div className="px-2 py-0.5 bg-slate-100 text-[9px] text-slate-500 font-bold uppercase sticky top-0">{PROJECTS.find(p=>p.id===pid)?.name}</div>{devs.map(d=>(<label key={d.id} className="flex items-center gap-2 px-2 py-1 hover:bg-blue-50 cursor-pointer"><input type="checkbox" checked={checkedDevices.includes(d.id)} onChange={e=>{if(e.target.checked)setCheckedDevices([...checkedDevices,d.id]);else{setCheckedDevices(checkedDevices.filter(x=>x!==d.id));setSelectAllDevices(false)}}} className="rounded w-3 h-3 text-blue-600" /><span className="text-[10px] truncate">{d.name}</span></label>))}</div>))}</div>
                                 </div>
                             ) : (
                                 /* AGGREGATE MODE: NEW DYNAMIC ROW BUILDER */
                                 <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
                                     <div className="p-2 border-b border-slate-100 bg-indigo-50/50 flex items-center justify-between">
                                         <div className="flex items-center gap-2">
                                            <Filter className="w-3 h-3 text-indigo-500"/>
                                            <span className="text-xs font-medium text-indigo-700">标签筛选 (Tag Filters)</span>
                                         </div>
                                     </div>
                                     <div className="overflow-y-auto p-2 flex-1 space-y-2">
                                        {tagRows.map((row, idx) => {
                                            const availableKeys = getAvailableTagKeys(row.id);
                                            // The fix: availableKeys already contains the current key because it's not excluded by "other rows".
                                            // We don't need to manually append it again.
                                            const allKeys = availableKeys;
                                            
                                            // Get values for selected key
                                            const currentTag = currentDeviceType.tags.find(t => t.key === row.tagKey);
                                            const availableValues = currentTag ? currentTag.values : [];

                                            return (
                                                <div key={row.id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                                                    {/* Key Select */}
                                                    <div className="flex-1 min-w-0">
                                                        <select 
                                                            className="w-full text-[10px] border border-slate-200 rounded p-1 outline-none bg-white focus:border-indigo-300"
                                                            value={row.tagKey}
                                                            onChange={(e) => updateTagRow(row.id, 'tagKey', e.target.value)}
                                                        >
                                                            <option value="">选择标签键...</option>
                                                            {allKeys.map((t: any) => (
                                                                <option key={t.key} value={t.key}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <span className="text-slate-300 text-[10px]">:</span>
                                                    {/* Value Select */}
                                                    <div className="flex-1 min-w-0">
                                                        <select 
                                                            className="w-full text-[10px] border border-slate-200 rounded p-1 outline-none bg-white focus:border-indigo-300 disabled:bg-slate-100 disabled:text-slate-400"
                                                            value={row.tagValue}
                                                            onChange={(e) => updateTagRow(row.id, 'tagValue', e.target.value)}
                                                            disabled={!row.tagKey}
                                                        >
                                                            <option value="">选择标签值...</option>
                                                            {availableValues.map(val => (
                                                                <option key={val} value={val}>{val}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {/* Delete */}
                                                    <button 
                                                        onClick={() => removeTagRow(row.id)}
                                                        className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {tagRows.length < currentDeviceType.tags.length && (
                                            <button 
                                                onClick={addTagRow}
                                                className="w-full py-1.5 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-md border-dashed flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> 新增筛选条件
                                            </button>
                                        )}
                                     </div>
                                 </div>
                             )}
                             <div className="w-[160px] bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
                                 <div className="p-2 border-b border-slate-100 bg-slate-50 flex flex-col gap-2"><div className="flex justify-between items-center text-xs text-slate-600 font-medium"><span>属性</span><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={selectAllMetrics} onChange={e=>setSelectAllMetrics(e.target.checked)} className="rounded w-3 h-3" /><span className="text-[10px]">全选</span></label></div><input type="text" placeholder="搜属性..." className="w-full px-2 py-1 text-[10px] border border-slate-200 rounded" value={metricSearch} onChange={e=>setMetricSearch(e.target.value)} /></div>
                                 <div className="overflow-y-auto p-1 flex-1">{filteredMetrics.map(m=>(<label key={m.key} className="flex items-center gap-2 p-1 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={checkedMetrics.includes(m.key)} onChange={e=>{if(e.target.checked)setCheckedMetrics([...checkedMetrics,m.key]);else{setCheckedMetrics(checkedMetrics.filter(x=>x!==m.key));setSelectAllMetrics(false)}}} className="rounded w-3 h-3" /><div className="flex flex-col min-w-0"><span className="text-[10px] truncate">{m.name}</span><span className="text-[8px] text-slate-400 font-mono">{m.key}</span></div></label>))}</div>
                             </div>
                         </div>
                         <button onClick={handleAddMetrics} className={`w-full py-2 text-white rounded-lg text-xs font-medium ${mode==='raw'?'bg-slate-800 hover:bg-slate-700':'bg-indigo-600 hover:bg-indigo-700'}`}>添加指标</button>
                     </div>
                </div>

                <div className="space-y-3">
                     <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                         <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">已定义指标 ({selectedPoints.length})</label>
                         <div className="flex items-center gap-2 text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200">
                             <Clock className="w-3 h-3 text-slate-500" /><span>粒度:</span><select value={interval} onChange={e=>setInterval(e.target.value)} className="bg-transparent border-none outline-none font-bold py-0"><option value="1m">1分钟</option><option value="15m">15分钟</option><option value="1h">1小时</option></select>
                         </div>
                     </div>
                     {selectedPoints.length === 0 ? (
                         <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-400">暂无指标</div>
                     ) : (
                         <div className="space-y-2 max-h-[300px] overflow-y-auto">
                             {selectedPoints.map((p, i) => (
                                 <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col gap-2">
                                     <div className="flex justify-between items-start">
                                         <div className="flex items-center gap-2"><div className={`w-1 h-6 rounded-full ${p.mode==='raw'?'bg-blue-500':'bg-indigo-500'}`}/><div><div className="text-[10px] text-slate-500">{p.mode==='raw' ? `${p.projectName} / ${p.deviceName}` : `${p.deviceTypeName} (聚合)`}</div><div className="text-xs font-bold">{p.metricName}</div></div></div>
                                         <div className="flex items-center gap-2">
                                            {p.mode === 'aggregate' && (
                                                <select 
                                                    value={p.aggFunc}
                                                    onChange={(e) => {
                                                        const newPoints = [...selectedPoints];
                                                        newPoints[i] = { ...newPoints[i], aggFunc: e.target.value };
                                                        setSelectedPoints(newPoints);
                                                    }}
                                                    className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-slate-50 font-mono text-indigo-600 outline-none cursor-pointer"
                                                >
                                                    {AGG_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                            )}
                                            <button onClick={()=>setSelectedPoints(selectedPoints.filter(x=>x.id!==p.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                         </div>
                                     </div>
                                     <div className="pt-2 border-t border-slate-100 flex items-center gap-2"><ArrowRightLeft className={`w-3 h-3 ${p.targetField?'text-green-500':'text-slate-300'}`} /><select value={p.targetField||''} onChange={e=>handleMapField(p.id,e.target.value)} className={`flex-1 text-[10px] py-1 px-2 rounded border outline-none ${p.targetField?'bg-green-50 border-green-200 text-green-700':'bg-slate-50 border-slate-200'}`}><option value="">映射字段...</option>{MODEL_SCHEMA.map(f=><option key={f.code} value={f.code}>{f.name}</option>)}</select></div>
                                 </div>
                             ))}
                         </div>
                     )}
                </div>

                {/* 3. Scheduling Area - Reused */}
                <div className="space-y-3 pb-8">
                     <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2"><CalendarClock className="w-4 h-4 text-orange-500" /> 自动化调度配置</label>
                     <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={scheduleEnabled} onChange={e => setScheduleEnabled(e.target.checked)} /><div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div></label><span className="text-sm font-medium text-slate-700">启用定时导出</span></div>
                            {scheduleEnabled && <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">调度已激活</span>}
                        </div>
                        {scheduleEnabled && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1"><span className="text-xs text-slate-500">执行频率</span><select value={scheduleFreq} onChange={e => setScheduleFreq(e.target.value as any)} className="w-full text-sm border border-slate-200 rounded p-2 bg-slate-50 outline-none focus:border-blue-500"><option value="daily">每天 (Daily)</option><option value="weekly">每周 (Weekly)</option><option value="monthly">每月 (Monthly)</option></select></div>
                                <div className="space-y-1"><span className="text-xs text-slate-500">执行时间</span><input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full text-sm border border-slate-200 rounded p-2 outline-none focus:border-blue-500" /></div>
                                {scheduleFreq === 'weekly' && (<div className="col-span-2 space-y-1"><span className="text-xs text-slate-500">重复日期</span><div className="flex gap-2">{['一','二','三','四','五','六','日'].map((d, i) => (<button key={i} onClick={() => setScheduleDay(i + 1)} className={`w-8 h-8 rounded text-xs flex items-center justify-center transition-all ${scheduleDay === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{d}</button>))}</div></div>)}
                                {scheduleFreq === 'monthly' && (<div className="col-span-2 space-y-1"><span className="text-xs text-slate-500">每月几号</span><input type="number" min="1" max="31" value={scheduleMonthDay} onChange={e => setScheduleMonthDay(parseInt(e.target.value))} className="w-full text-sm border border-slate-200 rounded p-2 outline-none" /></div>)}
                            </div>
                        )}
                     </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
                <button onClick={handleFinalSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-200 font-bold transition-all"><Save className="w-5 h-5" /> 保存模版配置</button>
            </div>
        </div>

        {/* Right Panel: Data Preview */}
        <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-slate-200/50 pointer-events-none" />
            <div className="p-6 overflow-y-auto z-10 flex-1 flex flex-col">
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full">
                     {/* Preview Header */}
                     <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                         <div className="flex items-center gap-2">
                             <TableIcon className="w-5 h-5 text-slate-400" />
                             <span className="font-bold text-slate-700">数据概览 & 形状统计 (Data Profile)</span>
                         </div>
                         
                         {/* Preview Time Control */}
                         <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-500 shadow-sm">
                            <span className="font-medium text-slate-400">预估范围:</span>
                            <input type="datetime-local" value={previewStart} onChange={e=>setPreviewStart(e.target.value)} className="bg-transparent w-32 border-none outline-none text-slate-600" />
                            <span className="text-slate-300">~</span>
                            <input type="datetime-local" value={previewEnd} onChange={e=>setPreviewEnd(e.target.value)} className="bg-transparent w-32 border-none outline-none text-slate-600" />
                         </div>
                     </div>

                     {/* Stats Cards */}
                     <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50/50 border-b border-slate-100">
                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><ListFilter className="w-3 h-3"/> 预计行数 (Rows)</div>
                            <div className="text-xl font-bold text-slate-700">{estimatedRows.toLocaleString()}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><MoreHorizontal className="w-3 h-3"/> 列数 (Columns)</div>
                            <div className="text-xl font-bold text-slate-700">{previewColumns.length + 1}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><HardDrive className="w-3 h-3"/> 预估大小 (Size)</div>
                            <div className="text-xl font-bold text-blue-600">{estimatedSize}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Sigma className="w-3 h-3"/> 数据完整度</div>
                            <div className="text-xl font-bold text-green-600">~99.8%</div>
                        </div>
                     </div>

                     {/* Data Table with Column Stats */}
                     <div className="flex-1 overflow-auto bg-white relative">
                         {selectedPoints.length > 0 ? (
                             <table className="w-full text-left border-collapse">
                                 <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                     {/* 1. Field Names */}
                                     <tr>
                                         <th className="px-4 py-3 text-xs font-semibold text-slate-500 border-b border-r border-slate-100 w-40 bg-slate-50">时间戳 (Timestamp)</th>
                                         {previewColumns.map(col => (
                                             <th key={col.id} className="px-4 py-3 text-xs font-semibold text-slate-500 border-b border-r border-slate-100 min-w-[140px] bg-slate-50">
                                                 <div className="flex flex-col">
                                                     <span className="text-slate-700">{col.label}</span>
                                                     <span className="text-[9px] font-normal text-slate-400 mt-0.5 truncate max-w-[120px]">{col.subLabel}</span>
                                                 </div>
                                             </th>
                                         ))}
                                     </tr>
                                     {/* 2. Column Statistics (Summary Row) */}
                                     <tr className="bg-slate-50/50 border-b border-slate-200 shadow-inner">
                                         <td className="px-4 py-2 text-[10px] font-bold text-slate-400 border-r border-slate-100 bg-slate-100/50 uppercase tracking-wider flex items-center gap-1 h-full">
                                             <BarChart4 className="w-3 h-3" />
                                             Column Stats
                                         </td>
                                         {previewColumns.map(col => {
                                             const stats = columnStats[col.id];
                                             return (
                                                <td key={col.id} className="px-4 py-1.5 border-r border-slate-100 bg-slate-50/30">
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
                                                        <div className="flex justify-between text-slate-400"><span>Min</span> <span className="font-mono text-slate-600">{stats?.min}</span></div>
                                                        <div className="flex justify-between text-slate-400"><span>Max</span> <span className="font-mono text-slate-600">{stats?.max}</span></div>
                                                        <div className="flex justify-between text-slate-400 font-medium"><span>Avg</span> <span className="font-mono text-blue-600 bg-blue-50 px-1 rounded">{stats?.avg}</span></div>
                                                        <div className="flex justify-between text-slate-400"><span>Null%</span> <span className="font-mono text-slate-600">{stats?.missing}</span></div>
                                                    </div>
                                                </td>
                                             )
                                         })}
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-50">
                                     {previewTableData.map((row, idx) => (
                                         <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                             <td className="px-4 py-2 text-xs font-mono text-slate-500 border-r border-slate-50">{row.ts}</td>
                                             {previewColumns.map(col => (
                                                 <td key={col.id} className="px-4 py-2 text-xs font-mono text-slate-700 border-r border-slate-50">
                                                     {row[col.label]}
                                                 </td>
                                             ))}
                                         </tr>
                                     ))}
                                     <tr>
                                         <td colSpan={previewColumns.length + 1} className="px-4 py-3 text-center text-xs text-slate-400 bg-slate-50/30 italic">
                                             ... 剩余 {Math.max(0, estimatedRows - 10).toLocaleString()} 行数据未加载 ...
                                         </td>
                                     </tr>
                                 </tbody>
                             </table>
                         ) : (
                             <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                                 <TableIcon className="w-16 h-16 opacity-20" />
                                 <p className="text-sm">请在左侧配置指标以查看数据概览</p>
                             </div>
                         )}
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
}