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
  AlertCircle
} from 'lucide-react';

// ------------------- Mock Data -------------------

const PROJECTS = [
  { id: 'p1', name: '上海中心大厦' },
  { id: 'p2', name: '北京大兴机场' },
  { id: 'p3', name: '深圳湾壹号' },
  { id: 'p4', name: '广州塔' },
  { id: 'p5', name: '杭州博地中心' },
];

// --- 新增：算法模型元数据定义 (模拟你的外部定义) ---
// 这是一个标准的算法输入接口定义
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
  brand: ['格力 (Gree)', '美的 (Midea)', '开利 (Carrier)', '约克 (York)', '特灵 (Trane)'],
  area: ['华东区域', '华北区域', '华南区域'],
  usage: ['商业用电', '空调用电', '动力用电']
};

const DEVICE_TYPES = [
  { 
    id: 'chiller', 
    name: '冷水机组 (Chiller)', 
    tags: [
      { key: 'project_name', name: '所属项目', values: PROJECTS.map(p => p.name) }, 
      { key: 'brand', name: '设备品牌', values: TAG_VALUES.brand },
      { key: 'area', name: '所属区域', values: TAG_VALUES.area }
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
      { key: 'usage', name: '用电类型', values: TAG_VALUES.usage }
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
  ],
  elec_meter: [
    { id: 'meter_main_sh', name: '上海总进线柜', projectId: 'p1' },
    { id: 'meter_hvac_sh', name: '上海空调总表', projectId: 'p1' },
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
  // --- 新增：字段映射 ---
  targetField?: string; // 对应 MODEL_SCHEMA 中的 code
};

// ------------------- Components -------------------

export default function DataAnalysisBuilder() {
  const [mode, setMode] = useState<'raw' | 'aggregate'>('raw');
  const [interval, setInterval] = useState('1h'); 

  // Picker Context
  const [activeDeviceType, setActiveDeviceType] = useState(DEVICE_TYPES[0].id);
  const [pickerProjects, setPickerProjects] = useState<string[]>([PROJECTS[0].id]);
  const [checkedDevices, setCheckedDevices] = useState<string[]>([]); 
  const [selectAllDevices, setSelectAllDevices] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<Record<string, string[]>>({});
  const [checkedMetrics, setCheckedMetrics] = useState<string[]>([]);
  const [selectAllMetrics, setSelectAllMetrics] = useState(false);
  
  // Search Terms
  const [projectSearch, setProjectSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [metricSearch, setMetricSearch] = useState('');

  // Cart State
  const [selectedPoints, setSelectedPoints] = useState<SelectedPoint[]>([]);

  // Derived Data
  const currentDeviceType = DEVICE_TYPES.find(d => d.id === activeDeviceType) || DEVICE_TYPES[0];
  
  const filteredProjects = useMemo(() => {
    if (!projectSearch) return PROJECTS;
    return PROJECTS.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()));
  }, [projectSearch]);

  const availableDevices = useMemo(() => {
    let devices = (DEVICE_INSTANCES[activeDeviceType] || []).filter(
      d => pickerProjects.includes(d.projectId)
    );
    if (deviceSearch) {
      const term = deviceSearch.toLowerCase();
      devices = devices.filter(d => d.name.toLowerCase().includes(term) || d.id.toLowerCase().includes(term));
    }
    return devices;
  }, [activeDeviceType, pickerProjects, deviceSearch]);

  const devicesGroupedByProject = useMemo(() => {
    return availableDevices.reduce((acc, dev) => {
      if (!acc[dev.projectId]) acc[dev.projectId] = [];
      acc[dev.projectId].push(dev);
      return acc;
    }, {} as Record<string, typeof availableDevices>);
  }, [availableDevices]);

  const filteredMetrics = useMemo(() => {
    if (!metricSearch) return currentDeviceType.metrics;
    const term = metricSearch.toLowerCase();
    return currentDeviceType.metrics.filter(m => 
      m.name.toLowerCase().includes(term) || m.key.toLowerCase().includes(term)
    );
  }, [metricSearch, currentDeviceType]);

  // Effects
  useEffect(() => {
    setCheckedDevices([]);
    setSelectAllDevices(false);
    setCheckedMetrics([]);
    setSelectAllMetrics(false);
    setActiveTagFilters({});
    setDeviceSearch('');
    setMetricSearch('');
  }, [mode, activeDeviceType]);

  useEffect(() => {
    if (selectAllDevices) setCheckedDevices(availableDevices.map(d => d.id));
    else setCheckedDevices([]);
  }, [selectAllDevices]);

  useEffect(() => {
    if (selectAllMetrics) setCheckedMetrics(filteredMetrics.map(m => m.key));
    else setCheckedMetrics([]);
  }, [selectAllMetrics]);

  // Handlers
  const toggleProject = (pid: string) => {
    if (pickerProjects.includes(pid)) setPickerProjects(pickerProjects.filter(id => id !== pid));
    else setPickerProjects([...pickerProjects, pid]);
  };

  const toggleTagFilter = (tagKey: string, value: string) => {
    const currentValues = activeTagFilters[tagKey] || [];
    let newValues;
    if (currentValues.includes(value)) newValues = currentValues.filter(v => v !== value);
    else newValues = [...currentValues, value];
    
    const newFilters = { ...activeTagFilters };
    if (newValues.length > 0) newFilters[tagKey] = newValues;
    else delete newFilters[tagKey];
    setActiveTagFilters(newFilters);
  };

  const handleAddMetrics = () => {
    const newPoints: SelectedPoint[] = [];

    if (mode === 'raw') {
      const devicesToProcess = availableDevices.filter(d => checkedDevices.includes(d.id));
      if (devicesToProcess.length === 0) return;

      devicesToProcess.forEach(device => {
        const project = PROJECTS.find(p => p.id === device.projectId);
        checkedMetrics.forEach(metricKey => {
          const metric = currentDeviceType.metrics.find(m => m.key === metricKey);
          newPoints.push({
            id: `raw-${device.id}-${metricKey}-${Date.now()}`,
            mode: 'raw',
            projectId: project?.id,
            projectName: project?.name,
            deviceTypeId: currentDeviceType.id,
            deviceTypeName: currentDeviceType.name,
            deviceId: device.id,
            deviceName: device.name,
            metricKey: metricKey,
            metricName: metric?.name || metricKey,
            unit: metric?.unit || '',
            aggFunc: 'AVG'
          });
        });
      });
      setCheckedDevices([]);
      setSelectAllDevices(false);
    } else {
      if (checkedMetrics.length === 0) return;
      checkedMetrics.forEach(metricKey => {
        const metric = currentDeviceType.metrics.find(m => m.key === metricKey);
        newPoints.push({
          id: `agg-${currentDeviceType.id}-${metricKey}-${Date.now()}`,
          mode: 'aggregate',
          deviceTypeId: currentDeviceType.id,
          deviceTypeName: currentDeviceType.name,
          tagFilters: { ...activeTagFilters },
          metricKey: metricKey,
          metricName: metric?.name || metricKey,
          unit: metric?.unit || '',
          aggFunc: 'AVG'
        });
      });
      setCheckedMetrics([]);
      setSelectAllMetrics(false);
    }

    const existingIds = new Set(selectedPoints.map(p => `${p.deviceId}-${p.metricKey}-${JSON.stringify(p.tagFilters)}`));
    const filteredNew = newPoints.filter(p => !existingIds.has(`${p.deviceId}-${p.metricKey}-${JSON.stringify(p.tagFilters)}`));
    setSelectedPoints([...selectedPoints, ...filteredNew]);
  };

  const handleMapField = (pointId: string, targetField: string) => {
    const updatedPoints = selectedPoints.map(p => 
        p.id === pointId ? { ...p, targetField: targetField } : p
    );
    setSelectedPoints(updatedPoints);
  };

  const generateSQL = () => {
    if (selectedPoints.length === 0) return '-- 请先添加数据指标';

    const timeFilter = `WHERE ts >= NOW - 24h`;
    let sql = '';
    const rawPoints = selectedPoints.filter(p => p.mode === 'raw');
    const aggPoints = selectedPoints.filter(p => p.mode === 'aggregate');

    // --- RAW SQL ---
    if (rawPoints.length > 0) {
        sql += `-- === 明细模式 (Raw Data) ===\n`;
        // Check if mapping exists
        const hasMapping = rawPoints.some(p => p.targetField);
        if (hasMapping) sql += `-- 已应用元数据字段映射 (AS alias)\n`;

        const rawByTable = rawPoints.reduce((acc, p) => {
            if (!acc[p.deviceTypeId]) acc[p.deviceTypeId] = [];
            acc[p.deviceTypeId].push(p);
            return acc;
        }, {} as Record<string, SelectedPoint[]>);

        Object.keys(rawByTable).forEach(table => {
            const points = rawByTable[table];
            // When mapping is involved, we can't simple DISTINCT metrics, we need to iterate per required output column
            // Assuming 1-to-1 mapping for simplicity in raw mode usually means selecting specific columns
            // BUT if user mapped "outlet_temp" -> "feature_temp", we need `outlet_temp AS feature_temp`
            
            // To simplify raw SQL generation with potential duplicates (e.g. device A mapped to feature X, device B mapped to feature Y?)
            // Usually raw data is just dumping columns. 
            // Let's generate a simple column list, utilizing aliases if provided.
            
            const cols = Array.from(new Set(points.map(p => {
                const alias = p.targetField ? ` AS ${p.targetField}` : '';
                return `${p.metricKey}${alias}`;
            })));
            
            const devices = Array.from(new Set(points.map(p => p.deviceId))); 
            
            sql += `SELECT ts, tbname, ${cols.join(', ')} \n`;
            sql += `FROM ${table}_stable \n`;
            sql += `${timeFilter} AND tbname IN (${devices.map(d => `'${d}'`).join(', ')}) \n`;
            sql += `ORDER BY ts DESC;\n\n`;
        });
    }

    // --- AGGREGATE SQL ---
    if (aggPoints.length > 0) {
        sql += `-- === 聚合模式 (Aggregation) ===\n`;
        sql += `-- 结果集将严格按照 MODEL_SCHEMA 进行字段重命名\n`;

        aggPoints.forEach((point, idx) => {
            const tableName = `${point.deviceTypeId}_stable`;
            
            // Core Logic: Apply Mapping
            const alias = point.targetField || `${point.metricKey}_${point.aggFunc}`;
            const metricExpr = `${point.aggFunc}(${point.metricKey}) AS ${alias}`;
            
            const tagConditions: string[] = [];
            if (point.tagFilters) {
                Object.entries(point.tagFilters).forEach(([tag, values]) => {
                    if (values.length > 0) {
                        tagConditions.push(`${tag} IN (${values.map(v => `'${v}'`).join(', ')})`);
                    }
                });
            }
            const whereClause = tagConditions.length > 0 ? `AND ${tagConditions.join(' AND ')}` : '';

            sql += `SELECT ${metricExpr} FROM ${tableName} ${timeFilter} ${whereClause} INTERVAL(${interval}); -- 映射目标: [${point.targetField || '未映射'}]\n`;
        });
    }
    return sql;
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans">
      
      {/* ---------------- LEFT PANEL ---------------- */}
      <div className="w-[660px] flex flex-col border-r border-slate-200 bg-white shadow-xl z-20">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              数据分析定义器
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded border border-green-100">
                <FileJson className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">已关联元数据模型: v1.0.2</span>
            </div>
          </div>
          
          <div className="bg-slate-100 p-1 rounded-lg flex">
            <button 
              onClick={() => setMode('raw')}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                mode === 'raw' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ListFilter className="w-4 h-4" /> 明细模式 (Raw)
            </button>
            <button 
              onClick={() => setMode('aggregate')}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                mode === 'aggregate' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Tag className="w-4 h-4" /> 聚合模式 (Tags)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STEP 1: CONFIGURATION */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> 1. 配置数据源
            </label>
            
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4">
                
                {/* 1.1 Top Context */}
                <div className="space-y-3">
                    {mode === 'raw' && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> 项目筛选 ({pickerProjects.length} 已选)
                                </span>
                            </div>
                            
                            <div className="relative">
                                <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="搜索项目名称..." 
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-300 outline-none mb-2"
                                    value={projectSearch}
                                    onChange={(e) => setProjectSearch(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto content-start">
                                {filteredProjects.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => toggleProject(p.id)}
                                        className={`px-3 py-1 text-xs rounded-full border transition-all ${
                                            pickerProjects.includes(p.id)
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                             <Layers className="w-3 h-3" /> 
                             {mode === 'raw' ? '选择设备类型' : '选择超级表'}
                        </span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {DEVICE_TYPES.map(dt => (
                            <button
                              key={dt.id}
                              onClick={() => setActiveDeviceType(dt.id)}
                              className={`px-3 py-1.5 text-xs rounded border transition-colors whitespace-nowrap ${
                                activeDeviceType === dt.id
                                  ? (mode === 'raw' ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium')
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                              }`}
                            >
                              {dt.name}
                            </button>
                          ))}
                        </div>
                    </div>
                </div>

                {/* 1.2 Middle Area */}
                <div className="flex gap-3 h-[300px]">
                    
                    {/* LEFT COLUMN: DEVICES / FILTERS */}
                    {mode === 'raw' ? (
                        <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
                            {/* Header with Search */}
                            <div className="p-2 border-b border-slate-100 bg-slate-50 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-600">设备列表</span>
                                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
                                        <div className={`w-3 h-3 border rounded flex items-center justify-center ${selectAllDevices ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                            {selectAllDevices && <Check className="w-2 h-2 text-white" />}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="hidden"
                                            checked={selectAllDevices}
                                            onChange={(e) => setSelectAllDevices(e.target.checked)}
                                        />
                                        <span className="text-[10px]">全选</span>
                                    </label>
                                </div>
                                <div className="relative">
                                    <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="搜索设备..." 
                                        className="w-full pl-7 pr-2 py-1 text-[10px] border border-slate-200 rounded-md outline-none focus:border-blue-400"
                                        value={deviceSearch}
                                        onChange={(e) => setDeviceSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="overflow-y-auto p-1 flex-1">
                                {Object.keys(devicesGroupedByProject).length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                        <Search className="w-4 h-4 opacity-50" />
                                        <span className="text-[10px]">无匹配设备</span>
                                    </div>
                                ) : (
                                    Object.entries(devicesGroupedByProject).map(([pid, devs]) => {
                                        const projName = PROJECTS.find(p => p.id === pid)?.name;
                                        return (
                                            <div key={pid} className="mb-2">
                                                <div className="px-2 py-1 bg-slate-50/90 text-[10px] text-slate-400 font-bold uppercase sticky top-0 backdrop-blur-sm z-10 border-b border-slate-100">
                                                    {projName}
                                                </div>
                                                {devs.map(device => (
                                                    <label key={device.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 cursor-pointer group transition-colors">
                                                        <input 
                                                            type="checkbox"
                                                            className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                                                            checked={checkedDevices.includes(device.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setCheckedDevices([...checkedDevices, device.id]);
                                                                else {
                                                                    setCheckedDevices(checkedDevices.filter(id => id !== device.id));
                                                                    setSelectAllDevices(false);
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-xs text-slate-700 group-hover:text-blue-700 truncate" title={device.name}>{device.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
                            <div className="p-2 border-b border-slate-100 bg-indigo-50/50 flex items-center gap-2">
                                <Filter className="w-3 h-3 text-indigo-500" />
                                <span className="text-xs font-medium text-indigo-700">标签筛选</span>
                            </div>
                            <div className="overflow-y-auto p-2 flex-1 space-y-4">
                                {currentDeviceType.tags.map(tag => (
                                    <div key={tag.key} className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">{tag.name}</span>
                                            {activeTagFilters[tag.key]?.length > 0 && (
                                                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded">
                                                    已选 {activeTagFilters[tag.key].length}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {tag.values.map(val => {
                                                const isSelected = activeTagFilters[tag.key]?.includes(val);
                                                return (
                                                    <button
                                                        key={val}
                                                        onClick={() => toggleTagFilter(tag.key, val)}
                                                        className={`text-[10px] px-2 py-1 rounded border transition-all truncate max-w-full ${
                                                            isSelected
                                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium shadow-sm'
                                                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        {val}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* RIGHT COLUMN: METRICS */}
                    <div className="w-[200px] bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-slate-50 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-600">属性列表</span>
                                <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
                                    <div className={`w-3 h-3 border rounded flex items-center justify-center ${selectAllMetrics ? (mode==='raw'?'bg-blue-600 border-blue-600':'bg-indigo-600 border-indigo-600') : 'border-slate-300 bg-white'}`}>
                                        {selectAllMetrics && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={selectAllMetrics}
                                        onChange={(e) => setSelectAllMetrics(e.target.checked)}
                                    />
                                    <span className="text-[10px]">全选</span>
                                </label>
                            </div>
                            <div className="relative">
                                <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="搜属性名/代码..." 
                                    className="w-full pl-7 pr-2 py-1 text-[10px] border border-slate-200 rounded-md outline-none focus:border-blue-400"
                                    value={metricSearch}
                                    onChange={(e) => setMetricSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto p-1 space-y-0.5 flex-1">
                             {filteredMetrics.map(metric => (
                                <label key={metric.key} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer group transition-colors">
                                    <input 
                                        type="checkbox"
                                        className={`rounded border-slate-300 focus:ring-0 w-3.5 h-3.5 ${mode==='raw'?'text-blue-600':'text-indigo-600'}`}
                                        checked={checkedMetrics.includes(metric.key)}
                                        onChange={(e) => {
                                            if (e.target.checked) setCheckedMetrics([...checkedMetrics, metric.key]);
                                            else {
                                                setCheckedMetrics(checkedMetrics.filter(k => k !== metric.key));
                                                setSelectAllMetrics(false);
                                            }
                                        }}
                                    />
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs text-slate-700 truncate" title={metric.name}>{metric.name}</span>
                                        <span className="text-[9px] text-slate-400 font-mono">{metric.key}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 1.3 Add Action */}
                <button 
                    onClick={handleAddMetrics}
                    disabled={mode === 'raw' ? (checkedDevices.length === 0 || checkedMetrics.length === 0) : (checkedMetrics.length === 0)}
                    className={`w-full py-2 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] ${
                        mode === 'raw' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                >
                    <ArrowRight className="w-3.5 h-3.5" />
                    {mode === 'raw' 
                        ? `添加 ${checkedDevices.length} 个设备的 ${checkedMetrics.length} 个属性` 
                        : `添加 ${checkedMetrics.length} 个聚合指标`
                    }
                </button>
            </div>
          </div>

          {/* STEP 2: CART (Mapping Enabled) */}
          <div className="space-y-3 flex-1">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-600" /> 2. 已选指标 ({selectedPoints.length})
              </label>
              
              <div className="flex items-center gap-3">
                {selectedPoints.length > 0 && (
                    <button 
                        onClick={() => setSelectedPoints([])}
                        className="text-[10px] text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1"
                    >
                        <XCircle className="w-3 h-3" /> 清空
                    </button>
                )}
                <div className="flex items-center gap-2 text-xs bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-600 font-medium">窗口:</span>
                    <select 
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        className="bg-transparent border-none outline-none text-slate-800 font-bold py-0 cursor-pointer"
                    >
                        {INTERVALS.map(i => <option key={i.val} value={i.val}>{i.label}</option>)}
                    </select>
                </div>
              </div>
            </div>

            {selectedPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 gap-2">
                <Filter className="w-8 h-8 text-slate-300" />
                <div className="text-slate-400 text-xs text-center">暂无指标，请从上方添加</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 pb-4">
                {selectedPoints.map((point, idx) => (
                  <div key={point.id} className={`group bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 ${
                      point.mode === 'raw' ? 'border-slate-200 hover:border-blue-300' : 'border-indigo-100 hover:border-indigo-300'
                  }`}>
                    
                    {/* Top Row: Basic Info */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`shrink-0 w-1 h-8 rounded-full ${
                                point.mode === 'raw' ? 'bg-blue-500' : 'bg-indigo-500'
                            }`} />
                            <div className="flex flex-col min-w-0">
                                {/* Context Info */}
                                {point.mode === 'raw' ? (
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="bg-slate-100 text-slate-500 text-[9px] px-1 rounded border border-slate-200 truncate max-w-[80px]">{point.projectName}</span>
                                        <span className="text-[10px] text-slate-600 font-medium truncate max-w-[120px]">{point.deviceName}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 mb-0.5 flex-wrap h-4 overflow-hidden">
                                        {point.tagFilters && Object.keys(point.tagFilters).length > 0 ? (
                                            Object.entries(point.tagFilters).map(([k, v]) => (
                                                <span key={k} className="text-[9px] text-indigo-600 border border-indigo-100 px-1 rounded bg-indigo-50">{v[0]}...</span>
                                            ))
                                        ) : <span className="text-[9px] text-slate-400">无筛选</span>}
                                    </div>
                                )}
                                <div className="text-xs text-slate-700 font-bold flex items-center gap-1">
                                    {point.metricName} 
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                            <select 
                                value={point.aggFunc}
                                onChange={(e) => {
                                    const newPoints = [...selectedPoints];
                                    newPoints[idx].aggFunc = e.target.value;
                                    setSelectedPoints(newPoints);
                                }}
                                className="text-[9px] border border-slate-200 rounded px-1 py-0.5 bg-slate-50 font-mono text-slate-600 outline-none cursor-pointer"
                            >
                                {AGG_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <button 
                                onClick={() => setSelectedPoints(selectedPoints.filter(p => p.id !== point.id))}
                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Metadata Mapping */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        <ArrowRightLeft className={`w-3 h-3 ${point.targetField ? 'text-green-500' : 'text-slate-300'}`} />
                        <span className="text-[9px] text-slate-400 whitespace-nowrap">映射模型字段:</span>
                        <select
                            value={point.targetField || ''}
                            onChange={(e) => handleMapField(point.id, e.target.value)}
                            className={`flex-1 text-[10px] py-1 px-2 rounded border outline-none transition-colors ${
                                point.targetField 
                                ? 'bg-green-50 border-green-200 text-green-700 font-medium' 
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                        >
                            <option value="">-- 不映射 (保持原名) --</option>
                            {MODEL_SCHEMA.map(field => (
                                <option key={field.code} value={field.code}>
                                    {field.name} ({field.code}) [{field.type}]
                                </option>
                            ))}
                        </select>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-3 bg-white z-10">
          <button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg text-sm font-medium">
            <Play className="w-4 h-4 fill-current" />
            <span>执行分析 ({selectedPoints.length})</span>
          </button>
        </div>
      </div>

      {/* ---------------- RIGHT PANEL: PREVIEW ---------------- */}
      <div className="flex-1 flex flex-col bg-slate-100/50 overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />
        
        <div className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shadow-sm z-10">
          <h2 className="font-medium text-slate-700 text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-400" />
            查询预览 (TDengine SQL)
          </h2>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> 已映射</span>
             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> 原生字段</span>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto z-10">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-bold text-slate-600 uppercase">SQL Query</span>
              </div>
            </div>
            <div className="p-4 bg-[#1e1e1e] text-blue-200 font-mono text-xs leading-relaxed overflow-x-auto">
              <pre className="whitespace-pre-wrap">{generateSQL()}</pre>
            </div>
          </div>
          
          {/* Metadata Hint */}
          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                  <FileJson className="w-4 h-4 text-green-600" />
                  <h3 className="text-xs font-bold text-green-800">当前生效的模型元数据 (Model Schema)</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  {MODEL_SCHEMA.map(f => (
                      <div key={f.code} className="bg-white px-2 py-1.5 rounded border border-green-100 flex justify-between items-center">
                          <span className="text-[10px] font-mono text-green-700">{f.code}</span>
                          <span className="text-[10px] text-slate-500">{f.type}</span>
                      </div>
                  ))}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}