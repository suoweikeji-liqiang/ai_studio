import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, Layers, GitBranch, Play, Clock, Database, 
  Settings, CheckCircle, AlertCircle, Download, Upload, 
  Cpu, Activity, Calendar, FileJson, MoreVertical, 
  ArrowRight, Search, Plus, Save, RotateCcw,
  BarChart, Server, Zap, Archive, ChevronRight,
  Workflow, FileCode, Share2, Container, Terminal, Code,
  GitCommit, Lock, Sparkles, MessageSquare, RefreshCw, X,
  Split, Table, ShieldCheck, Calculator, Eye, FileText, Link, 
  History, TrendingUp, AlertTriangle, Edit3, Key, Copy, CloudUpload, List,
  Globe, Command, StopCircle, Rocket, Check, ExternalLink, Hash, Filter, SlidersHorizontal, ChevronDown, ChevronLeft, Tag
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Legend 
} from 'recharts';

// ======================= 1. 深度类型定义 (Deep Types) =======================

type ModelStatus = 'training' | 'ready' | 'staging' | 'production' | 'archived' | 'failed';

type Artifact = {
    name: string; 
    size: string;
    type: 'model' | 'report' | 'metadata';
    url: string;
};

type SchemaField = { name: string; type: 'float' | 'int' | 'string' | 'bool'; desc?: string };

// MLflow-like Training Run Data
type TrainingRun = {
    runId: string;
    duration: string; // e.g. "2h 15m"
    hyperparameters: Record<string, string | number>; // Snapshot of params used
    metricsHistory: { step: number; loss: number; accuracy: number; val_loss?: number }[]; // For plotting charts
};

type ModelVersion = {
  version: string;
  tag?: string;
  createdTime: string;
  creator: string;
  status: ModelStatus;
  
  // Lineage
  datasetSnapshotId: string; 
  datasetTimeRange: string;
  
  // Metrics Snapshot (Final)
  metrics: { 
      primary: { name: string; value: string; delta?: 'up' | 'down' | 'flat' };
      details: { name: string; value: string }[]; 
  };
  
  // Detailed Training Process (MLflow style)
  trainingRun?: TrainingRun;

  // Artifacts
  artifacts: Artifact[];
  
  // Deployment Info (Only if status is production/staging)
  deployment?: {
      endpoint: string;
      authToken: string;
      qps: number;
      latency: string;
      uptime: string;
      totalCalls: string;
  };
};

type ModelConfig = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  type: 'regression' | 'classification' | 'forecasting';
  updatedAt: string;
  
  // --- 0. 构建模式 ---
  buildMode: 'template' | 'custom_image' | 'script' | 'import'; 

  // --- 1. 数据打通 ---
  dataSourceType?: 'dataset_pipeline' | 'metadata_direct';
  sourceId?: string;
  sourceName?: string;
  features?: string[]; 
  target?: string;     

  // --- 1b. 导入模式配置 ---
  importConfig?: {
      fileName: string;
      fileSize: string;
      framework: string;
      inputSchema: SchemaField[];
      outputSchema: SchemaField[];
  };
  
  // --- 2. 算法配置 ---
  algorithm?: string;
  hyperparams?: string; 
  imageConfig?: { imageUrl: string; command: string; envs: {key:string, value:string}[] };
  scriptConfig?: { sourceType: 'online_edit' | 'git_repo'; code?: string; gitUrl?: string; gitBranch?: string; };
  
  // --- 3. 调度配置 ---
  schedule: {
    enabled: boolean;
    cron: string;
    trigger: 'time' | 'data_ready' | 'manual';
    nextRun?: string;
  };

  versions: ModelVersion[];
};

// ======================= 2. Mock Data =======================

const generateTrainingCurve = (steps: number) => {
    const data = [];
    let loss = 0.9;
    let val_loss = 0.95;
    let acc = 0.4;
    for (let i = 0; i < steps; i++) {
        loss = Math.max(0.05, loss * 0.9 + (Math.random() - 0.5) * 0.05);
        val_loss = Math.max(0.08, loss + 0.05 + (Math.random() - 0.5) * 0.03); 
        acc = Math.min(0.99, acc * 1.05 + (Math.random() - 0.5) * 0.02);
        data.push({ step: (i + 1) * 100, loss: Number(loss.toFixed(4)), val_loss: Number(val_loss.toFixed(4)), accuracy: Number(acc.toFixed(4)) });
    }
    return data;
};

const MOCK_PIPELINES = [
  { id: 'pipe-001', name: '冷水机组_标准化清洗流', mode: 'metadata_mapped', schema: [{ name: 'inlet_temp', type: 'standard' }, { name: 'outlet_temp', type: 'standard' }, { name: 'feature_efficiency_cop', type: 'derived' }], lastSnapshot: 'snap-20231025-001' }
];

const MOCK_METADATA_TEMPLATES = [
  { id: 'meta-001', name: '冷水机组标准元数据', fields: ['load_rate', 'power_consumption', 'inlet_temp', 'outlet_temp', 'cooling_capacity'] },
];

const MOCK_ALGORITHMS = {
  regression: ['Linear Regression', 'XGBoost Regressor', 'Random Forest', 'SVR'],
  classification: ['Logistic Regression', 'XGBoost Classifier', 'SVC', 'LightGBM'],
  forecasting: ['ARIMA', 'Prophet', 'LSTM', 'Transformer']
};

const MOCK_MODELS: ModelConfig[] = [
  {
    id: 'm-001', name: '冷机COP实时预测模型', description: '基于标准化流水线构建，预测能效比。用于实时优化控制策略。', tags: ['能效', '冷机', '关键资产'], type: 'regression', updatedAt: '2023-10-26 14:30', buildMode: 'template', dataSourceType: 'dataset_pipeline', sourceId: 'pipe-001', sourceName: '冷水机组_标准化清洗流', features: ['inlet_temp', 'outlet_temp'], target: 'feature_efficiency_cop', algorithm: 'XGBoost Regressor', hyperparams: '{"n_estimators": 100}', schedule: { enabled: true, cron: '0 2 * * 1', trigger: 'data_ready', nextRun: '2023-10-30 02:00' },
    versions: [
      { version: 'v1.2.0', tag: 'Prod', createdTime: '2023-10-25 02:00', creator: 'Auto-Scheduler', status: 'production', datasetSnapshotId: 'snap-20231025-001', datasetTimeRange: '2023-01-01 ~ 2023-10-24', metrics: { primary: {name:'R²', value:'0.94', delta:'up'}, details: [] }, artifacts: [{ name: 'model.onnx', size: '45MB', type: 'model', url: '#' }], deployment: { endpoint: 'https://api.iot-ai.com/v1/models/cop-pred', authToken: 'sk-live-8f7a9d...', qps: 245, latency: '45ms', uptime: '12d 4h', totalCalls: '1.2M' }, trainingRun: { runId: 'run-839201', duration: '45m', hyperparameters: { n_estimators: 100 }, metricsHistory: generateTrainingCurve(20) } }
    ]
  },
  {
    id: 'm-002', name: '产线电机故障分类', description: '通过电流波形识别电机轴承故障类型。', tags: ['故障诊断', '电机', '分类'], type: 'classification', updatedAt: '2023-11-01 09:00', buildMode: 'script', dataSourceType: 'dataset_pipeline', sourceId: 'pipe-002', sourceName: '电机震动数据流', features: ['current_a', 'vibration_x'], target: 'fault_type', scriptConfig: { sourceType: 'git_repo', gitUrl: 'https://git.corp.com/ai/motor-fault.git' }, schedule: { enabled: true, cron: '0 0 * * 0', trigger: 'time' },
    versions: [
        { version: 'v2.1.0', tag: 'Staging', createdTime: '2023-11-01 08:30', creator: 'Dev_Team', status: 'staging', datasetSnapshotId: 'snap-motor-v2', datasetTimeRange: 'Last 30 days', metrics: { primary: {name:'Accuracy', value:'96.5%'}, details: [] }, artifacts: [{ name: 'model.h5', size: '120MB', type: 'model', url: '#' }] }
    ]
  },
  {
    id: 'm-003', name: '园区总能耗预测 (LSTM)', description: '基于历史气象数据预测未来24小时园区总用电量。', tags: ['能耗', '预测', '时序'], type: 'forecasting', updatedAt: '2023-10-20 16:15', buildMode: 'template', dataSourceType: 'metadata_direct', sourceId: 'meta-003', sourceName: '园区总表', features: ['temp', 'humidity', 'is_holiday'], target: 'total_kwh', algorithm: 'LSTM', hyperparams: '{"units": 50}', schedule: { enabled: false, cron: '', trigger: 'manual' },
    versions: [
        { version: 'v1.0.1', createdTime: '2023-10-20 16:00', creator: 'Analyst_A', status: 'ready', datasetSnapshotId: 'manual-upload-01', datasetTimeRange: '2022-2023', metrics: { primary: {name:'MAPE', value:'8.2%'}, details: [] }, artifacts: [{ name: 'lstm_model.zip', size: '200MB', type: 'model', url: '#' }] }
    ]
  },
  {
    id: 'm-005', name: '第三方_视觉质检模型', description: '从外部供应商导入的 YOLOv8 缺陷检测模型。', tags: ['视觉', '导入', '边缘计算', '质检'], type: 'classification', updatedAt: '2023-11-06 09:15', buildMode: 'import', importConfig: { fileName: 'yolov8_defect_v1.pt', fileSize: '128MB', framework: 'pytorch', inputSchema: [], outputSchema: [] }, schedule: { enabled: false, cron: '', trigger: 'manual' },
    versions: [
        { version: 'v1.0.0', tag: 'Imported', createdTime: '2023-11-06 09:15', creator: 'Admin', status: 'ready', datasetSnapshotId: 'N/A', datasetTimeRange: '-', metrics: { primary: {name:'mAP', value:'0.88'}, details: [] }, artifacts: [{ name: 'yolov8.pt', size: '128MB', type: 'model', url: '#' }] }
    ]
  }
];

// ======================= 3. Main Component =======================

export default function AIModelCenter() {
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [models, setModels] = useState<ModelConfig[]>(MOCK_MODELS);

  const handleEditConfig = (model: ModelConfig) => { setSelectedModel(model); setView('edit'); };
  const handleViewDetail = (model: ModelConfig) => { setSelectedModel(model); setView('detail'); };
  const handleCreate = () => { setSelectedModel(null); setView('create'); };
  
  const handleSaveModel = (newModel: ModelConfig) => {
      // Ensure safe defaults
      const safeModel = {
          ...newModel,
          id: newModel.id || `model-${Date.now()}`,
          name: newModel.name || '未命名模型',
          description: newModel.description || '',
          tags: newModel.tags || [],
          versions: newModel.versions || [],
          updatedAt: new Date().toLocaleString()
      };
      
      if (view === 'edit') { 
          setModels(prev => prev.map(m => m.id === safeModel.id ? safeModel as ModelConfig : m)); 
      } else { 
          setModels(prev => [safeModel as ModelConfig, ...prev]); 
      }
      setView('list');
  };

  const handleUpdateVersionStatus = (modelId: string, version: string, newStatus: ModelStatus) => {
      setModels(prev => prev.map(m => {
          if (m.id !== modelId) return m;
          return {
              ...m,
              versions: m.versions.map(v => {
                  if (v.version === version) return { ...v, status: newStatus };
                  return v;
              })
          };
      }));
      if (selectedModel && selectedModel.id === modelId) {
          setSelectedModel(prev => prev ? {
              ...prev,
              versions: prev.versions.map(v => v.version === version ? { ...v, status: newStatus } : v)
          } : null);
      }
  };

  const handleUpdateModelTags = (modelId: string, newTags: string[]) => {
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, tags: newTags } : m));
      // 如果当前详情页正在展示该模型，也同步更新
      if (selectedModel && selectedModel.id === modelId) {
          setSelectedModel(prev => prev ? { ...prev, tags: newTags } : null);
      }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 font-sans flex overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-950">
          <Cpu className="w-6 h-6 text-indigo-400" />
          <span className="font-bold text-white text-lg tracking-tight">AI 模型中心</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavButton active={view === 'list'} onClick={() => setView('list')} icon={<Box className="w-4 h-4"/>} label="模型仓库 (Models)" />
          <NavButton active={false} icon={<Activity className="w-4 h-4"/>} label="任务监控 (Jobs)" />
          <NavButton active={false} icon={<Server className="w-4 h-4"/>} label="在线服务 (Serving)" />
          <div className="mt-8 px-4 text-xs font-bold text-slate-500 uppercase">资产管理</div>
          <NavButton active={false} icon={<Database className="w-4 h-4"/>} label="特征库 (Feature Store)" />
          <NavButton active={false} icon={<Container className="w-4 h-4"/>} label="镜像仓库 (Registry)" />
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'list' && <ModelListView models={models} onSelect={handleViewDetail} onCreate={handleCreate} onUpdateTags={handleUpdateModelTags} />}
        {(view === 'create' || view === 'edit') && (
            <ModelWizard 
                initialData={selectedModel} 
                isEdit={view === 'edit'}
                existingTags={Array.from(new Set(models.flatMap(m => m.tags || [])))} 
                onBack={() => view === 'edit' && selectedModel ? setView('detail') : setView('list')} 
                onSave={handleSaveModel}
            />
        )}
        {view === 'detail' && selectedModel && (
            <ModelDetailView 
                model={selectedModel} 
                onBack={() => setView('list')} 
                onEdit={() => handleEditConfig(selectedModel)}
                onUpdateStatus={handleUpdateVersionStatus}
            />
        )}
      </div>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
    {icon}<span className="text-sm font-medium">{label}</span>
  </button>
);

// --- 4.1 Model List View (Optimized for Scale & Quick Edit) ---
function ModelListView({ models, onSelect, onCreate, onUpdateTags }: any) {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Quick Edit State
  const [editingTagsModelId, setEditingTagsModelId] = useState<string | null>(null);
  
  // Extract all unique tags safely
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      models.forEach(m => (m.tags || []).forEach(t => tags.add(t)));
      return Array.from(tags);
  }, [models]);

  // Filter Logic
  const filteredModels = useMemo(() => {
      return models.filter(m => {
          const name = m.name || '';
          const id = m.id || '';
          const tags = m.tags || [];
          
          const matchSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || id.toLowerCase().includes(searchTerm.toLowerCase());
          const matchType = selectedType === 'all' || m.type === selectedType;
          const matchMode = selectedMode === 'all' || m.buildMode === selectedMode;
          const latestStatus = m.versions?.[0]?.status || 'draft';
          const matchStatus = selectedStatus === 'all' || latestStatus === selectedStatus;
          const matchTags = selectedTags.length === 0 || selectedTags.every(tag => tags.includes(tag));

          return matchSearch && matchType && matchMode && matchStatus && matchTags;
      });
  }, [models, searchTerm, selectedType, selectedStatus, selectedMode, selectedTags]);

  const toggleTag = (tag: string) => {
      setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col h-full" onClick={() => setEditingTagsModelId(null)}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">模型仓库</h1>
          <p className="text-slate-500 text-sm mt-1">集中管理您的工业 AI 资产，支持多维检索与版本控制。</p>
        </div>
        <button onClick={onCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
            <Plus className="w-4 h-4"/> 新建模型
        </button>
      </div>

      {/* Advanced Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex gap-4">
              <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input 
                    type="text" 
                    placeholder="搜索模型名称或 ID..." 
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-indigo-100 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="flex gap-2">
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none" value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                      <option value="all">所有类型</option>
                      <option value="regression">数值预测 (Regression)</option>
                      <option value="classification">状态分类 (Classification)</option>
                      <option value="forecasting">时序预测 (Forecasting)</option>
                  </select>
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                      <option value="all">所有状态</option>
                      <option value="production">已发布 (Production)</option>
                      <option value="staging">测试中 (Staging)</option>
                      <option value="training">训练中 (Training)</option>
                  </select>
                  <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none" value={selectedMode} onChange={e => setSelectedMode(e.target.value)}>
                      <option value="all">构建模式</option>
                      <option value="template">低代码模板</option>
                      <option value="script">脚本开发</option>
                      <option value="custom_image">自定义镜像</option>
                      <option value="import">外部导入</option>
                  </select>
              </div>
          </div>
          
          {/* Tag Cloud */}
          <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Hash className="w-3 h-3"/> 标签筛选:</span>
              {allTags.map(tag => (
                  <button 
                    key={tag} 
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 rounded text-xs transition-colors border ${selectedTags.includes(tag) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                      {tag}
                  </button>
              ))}
              {selectedTags.length > 0 && (
                  <button onClick={() => setSelectedTags([])} className="text-xs text-slate-400 hover:text-red-500 ml-2">清除标签</button>
              )}
          </div>
      </div>

      {/* Model Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                  <tr>
                      <th className="px-6 py-4">模型名称 / ID</th>
                      <th className="px-6 py-4">类型 & 模式</th>
                      <th className="px-6 py-4">最新版本</th>
                      <th className="px-6 py-4">状态</th>
                      <th className="px-6 py-4">标签 (Quick Edit)</th>
                      <th className="px-6 py-4">更新时间</th>
                      <th className="px-6 py-4 text-right">操作</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {filteredModels.length > 0 ? filteredModels.map((model: ModelConfig) => {
                      const latestVer = model.versions && model.versions.length > 0 ? model.versions[0] : null;
                      const isEditingTags = editingTagsModelId === model.id;
                      
                      return (
                        <tr key={model.id} onClick={() => onSelect(model)} className="hover:bg-slate-50 transition-colors cursor-pointer group relative">
                            <td className="px-6 py-4">
                                <div className="font-bold text-indigo-600 group-hover:underline">{model.name}</div>
                                <div className="text-xs text-slate-400 font-mono mt-0.5">{model.id}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className="capitalize text-slate-600 font-medium">{model.type}</span>
                                    <span className={`text-[10px] w-fit px-1.5 py-0.5 rounded border ${model.buildMode === 'import' ? 'border-purple-100 bg-purple-50 text-purple-700' : model.buildMode === 'script' ? 'border-pink-100 bg-pink-50 text-pink-700' : model.buildMode === 'custom_image' ? 'border-orange-100 bg-orange-50 text-orange-700' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>
                                        {model.buildMode === 'import' ? 'Import' : model.buildMode === 'custom_image' ? 'Image' : model.buildMode === 'script' ? 'Script' : 'Template'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <GitBranch className="w-3.5 h-3.5 text-slate-400"/>
                                    <span className="font-mono">{latestVer?.version || '-'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <StatusBadge status={latestVer?.status || 'draft'} />
                            </td>
                            
                            {/* --- Quick Tag Editor Cell --- */}
                            <td className="px-6 py-4 relative" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-1 items-center min-h-[24px]">
                                    {(model.tags || []).slice(0, isEditingTags ? undefined : 3).map(t => (
                                        <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] flex items-center gap-1 border border-slate-200">
                                            {t}
                                            {isEditingTags && <button onClick={() => onUpdateTags(model.id, model.tags.filter(x => x !== t))} className="hover:text-red-500"><X className="w-2.5 h-2.5"/></button>}
                                        </span>
                                    ))}
                                    {!isEditingTags && (model.tags?.length || 0) > 3 && <span className="text-[10px] text-slate-400">+{model.tags.length - 3}</span>}
                                    
                                    {/* Edit Trigger */}
                                    {!isEditingTags && (
                                        <button 
                                            onClick={() => setEditingTagsModelId(model.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-400 transition-opacity"
                                        >
                                            <Edit3 className="w-3 h-3"/>
                                        </button>
                                    )}
                                </div>

                                {/* Floating Tag Editor */}
                                {isEditingTags && (
                                    <div className="absolute top-12 left-0 z-20 bg-white border border-slate-200 shadow-xl rounded-lg p-3 w-64 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-slate-600">编辑标签</span>
                                            <button onClick={() => setEditingTagsModelId(null)}><X className="w-3 h-3 text-slate-400"/></button>
                                        </div>
                                        <input 
                                            autoFocus
                                            type="text" 
                                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs mb-2 focus:ring-2 focus:ring-indigo-100 outline-none"
                                            placeholder="输入标签按回车..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const val = e.currentTarget.value.trim();
                                                    if (val && !model.tags.includes(val)) {
                                                        onUpdateTags(model.id, [...model.tags, val]);
                                                        e.currentTarget.value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <div className="text-[10px] text-slate-400 mb-1">推荐标签:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {allTags.filter(t => !model.tags.includes(t)).slice(0, 6).map(t => (
                                                <button 
                                                    key={t} 
                                                    onClick={() => onUpdateTags(model.id, [...model.tags, t])}
                                                    className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                                                >
                                                    + {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </td>

                            <td className="px-6 py-4 text-xs text-slate-500">
                                {model.updatedAt}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"><MoreVertical className="w-4 h-4"/></button>
                            </td>
                        </tr>
                      )
                  }) : (
                      <tr>
                          <td colSpan={7} className="text-center py-20 text-slate-400">
                              <div className="flex flex-col items-center">
                                  <Search className="w-10 h-10 mb-2 opacity-20"/>
                                  没有找到匹配的模型
                              </div>
                          </td>
                      </tr>
                  )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Mock */}
          <div className="bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center text-xs text-slate-500">
              <div>显示 {filteredModels.length} 个模型 (共 {models.length})</div>
              <div className="flex gap-2">
                  <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>上一页</button>
                  <button className="px-3 py-1 border border-slate-200 rounded bg-indigo-50 text-indigo-600 font-medium">1</button>
                  <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">2</button>
                  <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">3</button>
                  <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">下一页</button>
              </div>
          </div>
      </div>
    </div>
  );
}

const StatusBadge = ({ status }: { status: ModelStatus }) => {
    switch (status) {
        case 'production':
            return <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-1 rounded-full text-xs font-bold w-fit border border-green-200"><Rocket className="w-3 h-3"/> Prod</div>;
        case 'staging':
            return <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium w-fit border border-blue-200"><Server className="w-3 h-3"/> Stage</div>;
        case 'training':
            return <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full text-xs font-medium w-fit border border-indigo-200"><RefreshCw className="w-3 h-3 animate-spin"/> Train</div>;
        case 'ready':
            return <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-2 py-1 rounded-full text-xs font-medium w-fit border border-slate-200"><CheckCircle className="w-3 h-3"/> Ready</div>;
        default:
            return <span className="text-slate-500 text-xs bg-slate-100 px-2 py-1 rounded-full">{status}</span>;
    }
}

// --- 4.2 Create/Edit Model Wizard ---
function ModelWizard({ initialData, isEdit, existingTags = [], onBack, onSave }: any) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ModelConfig>>({
    id: `model-${Date.now()}`,
    type: 'regression',
    buildMode: 'template',
    dataSourceType: 'dataset_pipeline',
    sourceId: MOCK_PIPELINES[0].id,
    algorithm: 'XGBoost Regressor',
    hyperparams: '{\n  "n_estimators": 100,\n  "learning_rate": 0.1\n}',
    schedule: { enabled: false, cron: '0 0 * * *', trigger: 'manual' },
    scriptConfig: { sourceType: 'online_edit', code: '# 训练脚本\nimport pandas as pd...' },
    importConfig: { fileName: '', fileSize: '', framework: 'sklearn', inputSchema: [], outputSchema: [] },
    versions: [], 
    tags: [],
    features: [],
    ...initialData
  });

  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
      if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
          setFormData({ ...formData, tags: [...(formData.tags || []), tagInput.trim()] });
          setTagInput('');
      }
  };

  const handleRemoveTag = (tag: string) => {
      setFormData({ ...formData, tags: (formData.tags || []).filter(t => t !== tag) });
  };

  const handleQuickAddTag = (tag: string) => {
      if (!formData.tags?.includes(tag)) {
          setFormData({ ...formData, tags: [...(formData.tags || []), tag] });
      }
  };

  const selectedPipeline = MOCK_PIPELINES.find(p => p.id === formData.sourceId);
  const pipelineSchema = selectedPipeline?.schema || [];

  // AI & Sandbox State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);

  // Handlers
  const handleAiGenerate = () => { 
      setIsGenerating(true); 
      setTimeout(() => { 
          setAiSuggestion(`# Generated by AI for ${aiPrompt}\nimport sklearn\n\n# Your logic here...`); 
          setIsGenerating(false); 
      }, 1000); 
  };
  const handleApplyCode = () => { 
      if (aiSuggestion) { 
          setFormData({...formData, scriptConfig: {...formData.scriptConfig!, code: aiSuggestion}}); 
          setAiSuggestion(null); 
      } 
  };
  const handleRunSandbox = () => { 
      setSandboxStatus('running'); 
      setSandboxLogs(['> Initializing environment...', '> Pip installing dependencies...', '> Running script...']);
      setTimeout(() => { 
          setSandboxLogs(prev => [...prev, '[INFO] Training started', '[SUCCESS] Model saved to /output/model.pkl']); 
          setSandboxStatus('success');
      }, 1500); 
  };
  const handleFileUpload = () => {
      setTimeout(() => {
          setFormData({
              ...formData, 
              importConfig: { 
                  ...formData.importConfig!, 
                  fileName: 'offline_model_v1.pkl', 
                  fileSize: '45MB',
                  inputSchema: [{name: 'input_1', type: 'float'}, {name: 'input_2', type: 'float'}], 
                  outputSchema: [{name: 'score', type: 'float'}]
              }
          });
      }, 800);
  };

  const steps = [
    { id: 1, title: '基础信息 & 模式', icon: <FileCode className="w-4 h-4"/> },
    { id: 2, title: formData.buildMode === 'import' ? '文件与契约' : '数据契约绑定', icon: formData.buildMode === 'import' ? <CloudUpload className="w-4 h-4"/> : <Workflow className="w-4 h-4"/> },
    { id: 3, title: formData.buildMode === 'import' ? '环境配置' : '开发与配置', icon: <Code className="w-4 h-4"/> },
    { id: 4, title: '生命周期', icon: <Calendar className="w-4 h-4"/> },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowRight className="w-5 h-5 rotate-180"/></button>
          <h2 className="text-lg font-bold text-slate-800">{isEdit ? '编辑模型' : '新建 AI 模型'}</h2>
        </div>
        <div className="flex gap-2">
           {steps.map(s => (
             <div key={s.id} onClick={() => setStep(s.id)} className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step === s.id ? 'bg-indigo-600 text-white' : step > s.id ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
               {step > s.id ? <CheckCircle className="w-3 h-3"/> : s.icon}
               {s.title}
             </div>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 flex justify-center">
        <div className={`w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 min-h-[500px] flex flex-col ${step === 3 && formData.buildMode === 'script' ? 'max-w-6xl' : 'max-w-3xl'}`}>
          <div className="flex-1">
            
            {/* --- STEP 1: Basic Info (UPDATED WITH TAGS) --- */}
            {step === 1 && (
               <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                   <h3 className="text-lg font-bold text-slate-800 mb-6">Step 1: 定义模型与构建模式</h3>
                   <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none" 
                                placeholder="例如：高校合作_震动检测模型"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                            <textarea 
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none h-20 resize-none" 
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                        </div>

                        {/* --- TAG MANAGEMENT --- */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">模型标签</label>
                            <div className="border border-slate-300 rounded-lg px-2 py-2 flex flex-wrap gap-2 items-center bg-white focus-within:ring-2 focus-within:ring-indigo-200">
                                {formData.tags?.map(tag => (
                                    <span key={tag} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs">
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-indigo-900"><X className="w-3 h-3"/></button>
                                    </span>
                                ))}
                                <input 
                                    type="text" 
                                    className="flex-1 min-w-[100px] outline-none text-sm p-1"
                                    placeholder={formData.tags?.length === 0 ? "输入标签按回车添加..." : ""}
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                                />
                            </div>
                            {/* Recommended Tags */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-xs text-slate-400">推荐:</span>
                                {existingTags.filter((t: string) => !formData.tags?.includes(t)).slice(0, 5).map((t: string) => (
                                    <button 
                                        key={t} 
                                        onClick={() => handleQuickAddTag(t)}
                                        className="text-xs text-slate-500 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-0.5 rounded transition-colors"
                                    >
                                        + {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">构建模式</label>
                            <div className="grid grid-cols-2 gap-4">
                                {['template', 'script', 'custom_image', 'import'].map(m => (
                                    <div key={m} onClick={() => setFormData({...formData, buildMode: m as any})} className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col gap-2 ${formData.buildMode === m ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <div className="font-bold text-slate-800 text-sm capitalize flex items-center gap-2">
                                            {m === 'import' && <CloudUpload className="w-4 h-4"/>}
                                            {m === 'import' ? '导入已有模型 (Import)' : m.replace('_', ' ')}
                                        </div>
                                        <div className="text-[10px] text-slate-500 leading-tight">
                                            {m === 'import' ? '上传 .pkl/.onnx 等离线文件，手动定义输入输出。' : m === 'template' ? '使用内置算法，快速配置。' : m === 'script' ? '在线编写 Python 代码，支持 Git 同步。' : '上传 Docker 镜像 (黑盒)。'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                   </div>
               </div>
            )}

            {/* --- STEP 2 (IMPORT): File Upload & Schema --- */}
            {step === 2 && formData.buildMode === 'import' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Step 2: 上传文件与定义契约</h3>
                    <p className="text-sm text-slate-500 mb-6">为了让平台能提供服务 API，您需要手动定义模型的输入输出 Schema。</p>
                    
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={handleFileUpload}>
                        {formData.importConfig?.fileName ? (
                            <div className="text-center">
                                <FileJson className="w-12 h-12 text-green-500 mx-auto mb-2"/>
                                <div className="font-bold text-slate-700">{formData.importConfig.fileName}</div>
                                <div className="text-xs text-slate-400">{formData.importConfig.fileSize} • Uploaded</div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <CloudUpload className="w-10 h-10 text-slate-400 mx-auto mb-2"/>
                                <div className="text-sm text-slate-600 font-medium">点击上传模型文件</div>
                                <div className="text-xs text-slate-400 mt-1">支持 .pkl, .onnx, .pt, .h5</div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="border border-slate-200 rounded-lg p-4">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">入参定义 (Input Schema)</div>
                            <div className="space-y-2">
                                {formData.importConfig?.inputSchema.map((field, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className="border rounded px-2 py-1 text-xs w-1/3" value={field.name} readOnly/>
                                        <select className="border rounded px-2 py-1 text-xs"><option>{field.type}</option></select>
                                    </div>
                                ))}
                                <button className="text-xs text-indigo-600 flex items-center gap-1 mt-2">+ 添加字段</button>
                            </div>
                        </div>
                        <div className="border border-slate-200 rounded-lg p-4">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">出参定义 (Output Schema)</div>
                            <div className="space-y-2">
                                {formData.importConfig?.outputSchema.map((field, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className="border rounded px-2 py-1 text-xs w-1/3" value={field.name} readOnly/>
                                        <select className="border rounded px-2 py-1 text-xs"><option>{field.type}</option></select>
                                    </div>
                                ))}
                                <button className="text-xs text-indigo-600 flex items-center gap-1 mt-2">+ 添加字段</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- STEP 2 (STANDARD): Pipeline Binding --- */}
            {step === 2 && formData.buildMode !== 'import' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Step 2: 数据流水线契约绑定</h3>
                <p className="text-sm text-slate-500 mb-6">模型将基于选定流水线的 <b>Output Schema</b> 构建。</p>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">选择数据流水线</label>
                    <select 
                        className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm bg-white"
                        value={formData.sourceId}
                        onChange={e => {
                            const p = MOCK_PIPELINES.find(pi => pi.id === e.target.value);
                            setFormData({...formData, sourceId: e.target.value, sourceName: p?.name});
                        }}
                    >
                        {MOCK_PIPELINES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">特征输入 (X)</label>
                    <div className="border border-slate-200 rounded-lg h-64 overflow-y-auto bg-white p-2 space-y-1">
                        {pipelineSchema.map((field, idx) => (
                            <label key={idx} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-100">
                                <input 
                                    type="checkbox" 
                                    className="rounded text-indigo-600" 
                                    checked={formData.features?.includes(field.name)}
                                    onChange={e => {
                                        const newFeatures = e.target.checked 
                                            ? [...(formData.features || []), field.name]
                                            : (formData.features || []).filter(f => f !== field.name);
                                        setFormData({...formData, features: newFeatures});
                                    }}
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-mono text-slate-700">{field.name}</span>
                                        {field.type === 'derived' && <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded">Calc</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-400">{field.desc}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">预测目标 (Y)</label>
                    <div className="border border-slate-200 rounded-lg h-64 overflow-y-auto p-2 space-y-1 bg-white">
                      {pipelineSchema.map((field, idx) => (
                        <label key={idx} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                          <input 
                            type="radio" 
                            name="target" 
                            className="text-indigo-600" 
                            checked={formData.target === field.name}
                            onChange={() => setFormData({...formData, target: field.name})}
                          />
                          <span className="text-sm font-mono text-slate-600">{field.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 3: Development / Config --- */}
            {step === 3 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 fade-in h-full flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4">
                    {formData.buildMode === 'import' ? 'Step 3: 运行环境' : 'Step 3: 开发与配置'}
                </h3>

                {/* 3A. Template Mode */}
                {formData.buildMode === 'template' && (
                    <div className="space-y-6 max-w-xl">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">选择算法</label>
                            <select 
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm bg-white"
                                value={formData.algorithm}
                                onChange={e => setFormData({...formData, algorithm: e.target.value})}
                            >
                                {MOCK_ALGORITHMS[formData.type as keyof typeof MOCK_ALGORITHMS]?.map(a => <option key={a}>{a}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">超参数 (JSON)</label>
                            <textarea 
                                className="w-full border border-slate-300 rounded-lg p-4 text-xs font-mono h-40 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none"
                                value={formData.hyperparams}
                                onChange={e => setFormData({...formData, hyperparams: e.target.value})}
                            />
                        </div>
                    </div>
                )}

                {/* 3B. Script Mode */}
                {formData.buildMode === 'script' && (
                    <div className="flex gap-6 flex-1 min-h-[400px]">
                        <div className="flex-1 flex flex-col gap-4">
                            <div className="bg-slate-100 p-2 rounded-lg flex items-center gap-2 border border-slate-200">
                                <select 
                                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={formData.scriptConfig?.sourceType}
                                    onChange={e => setFormData({...formData, scriptConfig: {...formData.scriptConfig!, sourceType: e.target.value as any}})}
                                >
                                    <option value="online_edit">在线编辑</option>
                                    <option value="git_repo">Git 仓库</option>
                                </select>
                                {formData.scriptConfig?.sourceType === 'git_repo' && (
                                    <input 
                                        type="text" 
                                        className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs" 
                                        placeholder="https://github.com/..." 
                                        value={formData.scriptConfig?.gitUrl}
                                        onChange={e => setFormData({...formData, scriptConfig: {...formData.scriptConfig!, gitUrl: e.target.value}})}
                                    />
                                )}
                            </div>
                            <div className="flex-1 bg-[#1e1e1e] rounded-xl overflow-hidden flex flex-col relative border border-slate-300 shadow-inner">
                                <textarea 
                                    className="flex-1 bg-transparent text-[#d4d4d4] p-4 font-mono text-sm outline-none resize-none"
                                    value={formData.scriptConfig?.code}
                                    onChange={e => setFormData({...formData, scriptConfig: {...formData.scriptConfig!, code: e.target.value}})}
                                    spellCheck={false}
                                />
                                <div className="absolute bottom-4 right-4">
                                    <button onClick={handleRunSandbox} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs transition-colors shadow-lg">
                                        <Play className="w-3 h-3"/> Run Sandbox
                                    </button>
                                </div>
                                {sandboxStatus !== 'idle' && (
                                    <div className="absolute bottom-0 w-full h-32 bg-black/90 text-slate-300 p-3 font-mono text-xs overflow-y-auto border-t border-slate-700">
                                        {sandboxLogs.map((l, i) => <div key={i}>{l}</div>)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="w-72 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
                            <div className="bg-indigo-600 p-3 text-white flex items-center gap-2"><Sparkles className="w-4 h-4"/> AI Copilot</div>
                            <div className="flex-1 p-3 bg-slate-50 overflow-y-auto">
                                {aiSuggestion && (
                                    <div className="bg-white p-2 rounded border border-indigo-100 text-xs shadow-sm">
                                        <pre className="overflow-x-auto">{aiSuggestion}</pre>
                                        <button onClick={handleApplyCode} className="w-full mt-2 bg-indigo-50 text-indigo-600 py-1 rounded hover:bg-indigo-100">Apply</button>
                                    </div>
                                )}
                            </div>
                            <div className="p-3 border-t bg-white">
                                <div className="relative">
                                    <input 
                                        className="w-full border rounded-lg pl-2 pr-8 py-2 text-xs" 
                                        placeholder="Generate code..." 
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                    />
                                    <button onClick={handleAiGenerate} disabled={isGenerating} className="absolute right-1 top-1 p-1 text-indigo-600"><Sparkles className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3C. Custom Image & Import Mode Config */}
                {(formData.buildMode === 'custom_image' || formData.buildMode === 'import') && (
                    <div className="space-y-6 max-w-xl">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
                            {formData.buildMode === 'import' 
                                ? '导入的模型将运行在通用推理容器中。如果需要特殊环境，请配置基础镜像。'
                                : '请确保镜像能从 /input 读取数据并输出到 /output。'}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {formData.buildMode === 'import' ? '基础推理镜像 (可选)' : '镜像地址'}
                            </label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm font-mono" 
                                placeholder={formData.buildMode === 'import' ? 'default: python:3.9-slim' : 'docker.io/my-org/model:v1'}
                                value={formData.imageConfig?.imageUrl}
                                onChange={e => setFormData({...formData, imageConfig: {...formData.imageConfig!, imageUrl: e.target.value}})}
                            />
                        </div>
                    </div>
                )}
              </div>
            )}

            {/* --- STEP 4: Schedule --- */}
            {step === 4 && (
               <div className="space-y-6 animate-in slide-in-from-right-4 fade-in max-w-2xl">
                   <h3 className="text-lg font-bold text-slate-800 mb-6">Step 4: 自动化训练调度</h3>
                   <div className="bg-white border border-slate-200 rounded-lg p-6">
                       <div className="flex items-center justify-between mb-6">
                           <div className="flex items-center gap-3">
                               <div className="bg-green-100 p-2 rounded text-green-600"><RotateCcw className="w-5 h-5"/></div>
                               <div>
                                   <div className="font-bold text-slate-700">启用自动重训练</div>
                                   <div className="text-xs text-slate-500">当数据更新或到达时间时触发</div>
                               </div>
                           </div>
                           <input 
                                type="checkbox" 
                                className="w-5 h-5 accent-indigo-600"
                                checked={formData.schedule?.enabled}
                                onChange={e => setFormData({...formData, schedule: {...formData.schedule!, enabled: e.target.checked}})}
                           />
                       </div>
                       
                       {formData.schedule?.enabled && (
                           <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                               <div>
                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">触发条件</label>
                                   <select 
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={formData.schedule.trigger}
                                        onChange={e => setFormData({...formData, schedule: {...formData.schedule!, trigger: e.target.value as any}})}
                                   >
                                       <option value="data_ready">数据流水线完成时</option>
                                       <option value="time">Cron 定时任务</option>
                                   </select>
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">CRON 表达式</label>
                                   <input 
                                        type="text" 
                                        className="w-full border rounded px-3 py-2 text-sm font-mono"
                                        value={formData.schedule.cron}
                                        onChange={e => setFormData({...formData, schedule: {...formData.schedule!, cron: e.target.value}})}
                                   />
                               </div>
                           </div>
                       )}
                   </div>
               </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-between mt-auto">
            <button onClick={() => step > 1 ? setStep(step - 1) : onBack()} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium">{step === 1 ? '取消' : '上一步'}</button>
            <button 
                onClick={() => step < 4 ? setStep(step + 1) : onSave(formData)} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
                {step === 4 ? '完成并保存' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 4.3 Model Detail View (ENHANCED with Full Features) ---
function ModelDetailView({ model, onBack, onEdit, onUpdateStatus }: { model: ModelConfig, onBack: any, onEdit: any, onUpdateStatus: (id: string, ver: string, status: ModelStatus) => void }) {
  const [activeTab, setActiveTab] = useState<'versions' | 'config'>('versions');
  const [expandedVersion, setExpandedVersion] = useState<string | null>(model.versions && model.versions[0] ? model.versions[0].version : null);
  const [activeSubTab, setActiveSubTab] = useState<'training' | 'api' | 'download'>('training');
  const [apiMode, setApiMode] = useState<'specific' | 'latest'>('specific');
  const [showArtifactLinks, setShowArtifactLinks] = useState<string | null>(null);

  const generateCurl = (v: ModelVersion) => {
      const url = apiMode === 'specific' 
        ? `${v.deployment?.endpoint || 'https://api.iot.com'}/versions/${v.version}:predict`
        : `${v.deployment?.endpoint || 'https://api.iot.com'}/latest:predict`;
      const features = model.features || ['feature1', 'feature2'];
      const jsonBody = features.reduce((acc:any, f) => { acc[f] = 0.5; return acc; }, {});
      return `curl -X POST "${url}" \\\n  -H "Authorization: Bearer ${v.deployment?.authToken || 'sk-token'}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(jsonBody, null, 2)}'`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Detail Header (Information Rich) */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-4">
                <button onClick={onBack} className="mt-1 p-1 hover:bg-slate-100 rounded text-slate-400"><ArrowRight className="w-5 h-5 rotate-180"/></button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-800">{model.name}</h1>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${model.buildMode === 'import' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            {model.buildMode}
                        </span>
                        {model.schedule.enabled && <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-100"><RotateCcw className="w-3 h-3"/> Auto</span>}
                    </div>
                    <p className="text-slate-500 text-sm mt-2 max-w-2xl">{model.description}</p>
                    <div className="flex gap-2 mt-3">
                        {model.tags?.map(t => <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">#{t}</span>)}
                    </div>
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={onEdit} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                    <Edit3 className="w-4 h-4"/> 配置
                </button>
                {model.buildMode !== 'import' && (
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <Play className="w-4 h-4"/> 训练
                    </button>
                )}
            </div>
        </div>

        {/* Info Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-xs text-slate-400 mb-1">Total Calls</div>
                <div className="text-lg font-bold text-slate-700">{model.versions[0]?.deployment?.totalCalls || '0'}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-xs text-slate-400 mb-1">Avg Latency</div>
                <div className="text-lg font-bold text-slate-700">{model.versions[0]?.deployment?.latency || '-'}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-xs text-slate-400 mb-1">Input Features</div>
                <div className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    {model.features?.length || model.importConfig?.inputSchema.length || 0} <span className="text-xs font-normal text-slate-400">Fields</span>
                </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-xs text-slate-400 mb-1">Output Target</div>
                <div className="text-sm font-bold text-slate-700 truncate pt-1">{model.target || model.importConfig?.outputSchema[0]?.name || '-'}</div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="border-b px-6 py-4 bg-slate-50 font-bold text-slate-700 text-sm flex justify-between">
                <span>版本管理 (Version History)</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                <tr>
                    <th className="w-10"></th>
                    <th className="px-6 py-3">版本号</th>
                    <th className="px-6 py-3">数据来源</th>
                    <th className="px-6 py-3">评估指标</th>
                    <th className="px-6 py-3">状态</th>
                    <th className="px-6 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {model.versions.map(v => (
                    <React.Fragment key={v.version}>
                        <tr className={`hover:bg-slate-50 ${expandedVersion === v.version ? 'bg-slate-50' : ''}`}>
                            <td className="pl-4">
                                <button onClick={() => setExpandedVersion(expandedVersion === v.version ? null : v.version)} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                                    <ChevronRight className={`w-4 h-4 transition-transform ${expandedVersion === v.version ? 'rotate-90' : ''}`}/>
                                </button>
                            </td>
                            <td className="px-6 py-4 font-mono font-medium text-slate-700">{v.version}</td>
                            <td className="px-6 py-4 text-xs font-mono bg-slate-100 rounded px-2 py-1 w-fit">{v.datasetSnapshotId}</td>
                            <td className="px-6 py-4 text-green-600 font-bold font-mono">{v.metrics.primary.value}</td>
                            <td className="px-6 py-4"><StatusBadge status={v.status} /></td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                {/* Deployment Actions */}
                                {v.status === 'ready' && (
                                    <button onClick={() => onUpdateStatus(model.id, v.version, 'staging')} className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200">
                                        🚀 发布
                                    </button>
                                )}
                                {v.status === 'production' && (
                                    <button onClick={() => onUpdateStatus(model.id, v.version, 'ready')} className="text-slate-500 hover:bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">
                                        下线
                                    </button>
                                )}
                            </td>
                        </tr>
                        
                        {/* EXPANDED PANEL: Training Charts & Artifacts */}
                        {expandedVersion === v.version && (
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <td colSpan={6} className="p-0">
                                    <div className="border-b border-slate-200 px-6 flex gap-6">
                                        <button onClick={() => setActiveSubTab('training')} className={`py-3 text-xs font-medium border-b-2 transition-colors ${activeSubTab==='training'?'border-indigo-600 text-indigo-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>训练监控 (Training)</button>
                                        <button onClick={() => setActiveSubTab('api')} className={`py-3 text-xs font-medium border-b-2 transition-colors ${activeSubTab==='api'?'border-indigo-600 text-indigo-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>服务调用 (API)</button>
                                        <button onClick={() => setActiveSubTab('download')} className={`py-3 text-xs font-medium border-b-2 transition-colors ${activeSubTab==='download'?'border-indigo-600 text-indigo-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>产物下载 (Artifacts)</button>
                                    </div>
                                    
                                    <div className="p-6">
                                        {/* TAB 1: TRAINING */}
                                        {activeSubTab === 'training' && (
                                            <div className="flex gap-6">
                                                <div className="w-1/3 bg-white p-4 rounded-lg border border-slate-200">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">训练元数据</h4>
                                                    <div className="text-xs space-y-2">
                                                        <div className="flex justify-between"><span>Duration:</span> <span className="font-mono">{v.trainingRun?.duration || '-'}</span></div>
                                                        <div className="flex justify-between"><span>Run ID:</span> <span className="font-mono">{v.trainingRun?.runId || '-'}</span></div>
                                                        <pre className="bg-slate-50 p-2 rounded font-mono text-[10px] text-slate-600 mt-2">{JSON.stringify(v.trainingRun?.hyperparameters || {}, null, 2)}</pre>
                                                    </div>
                                                </div>
                                                <div className="flex-1 bg-white p-4 rounded-lg border border-slate-200 h-64">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">MLflow Metrics</h4>
                                                    {v.trainingRun ? (
                                                        <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={v.trainingRun.metricsHistory}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="step" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><RechartsTooltip/><Legend/><Line type="monotone" dataKey="loss" stroke="#ef4444" dot={false} isAnimationActive={false}/><Line type="monotone" dataKey="accuracy" stroke="#10b981" dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>
                                                    ) : <div className="text-center text-slate-300 mt-10">No metrics available</div>}
                                                </div>
                                            </div>
                                        )}

                                        {/* TAB 2: API */}
                                        {activeSubTab === 'api' && (
                                            <div className="flex gap-6">
                                                <div className="w-1/3 space-y-4">
                                                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">调用配置</h4>
                                                        <div className="flex gap-2 mb-4">
                                                            <button onClick={() => setApiMode('specific')} className={`flex-1 py-1 text-xs rounded border ${apiMode==='specific'?'bg-indigo-50 border-indigo-200 text-indigo-700':'border-slate-200'}`}>锁定版本 {v.version}</button>
                                                            <button onClick={() => setApiMode('latest')} className={`flex-1 py-1 text-xs rounded border ${apiMode==='latest'?'bg-indigo-50 border-indigo-200 text-indigo-700':'border-slate-200'}`}>始终最新 Latest</button>
                                                        </div>
                                                        <div className="text-xs text-slate-400 mb-1">Auth Token</div>
                                                        <code className="bg-slate-50 p-2 rounded block text-[10px] break-all border border-slate-100">{v.deployment?.authToken || 'N/A'}</code>
                                                    </div>
                                                </div>
                                                <div className="flex-1 bg-[#1e1e1e] p-4 rounded-lg border border-slate-700 text-green-400 font-mono text-xs overflow-x-auto relative">
                                                    <pre>{generateCurl(v)}</pre>
                                                    <button className="absolute top-2 right-2 text-slate-500 hover:text-white"><Copy className="w-4 h-4"/></button>
                                                </div>
                                            </div>
                                        )}

                                        {/* TAB 3: DOWNLOAD */}
                                        {activeSubTab === 'download' && (
                                            <div className="space-y-3">
                                                {v.artifacts.map((art, idx) => (
                                                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-slate-100 rounded text-slate-500"><FileJson className="w-4 h-4"/></div>
                                                            <div>
                                                                <div className="text-sm font-medium text-slate-700">{art.name}</div>
                                                                <div className="text-xs text-slate-400">{art.size} • {art.type}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1 text-slate-600"><Terminal className="w-3 h-3"/> Copy wget</button>
                                                            <button className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"><Download className="w-3 h-3"/> 下载链接</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
