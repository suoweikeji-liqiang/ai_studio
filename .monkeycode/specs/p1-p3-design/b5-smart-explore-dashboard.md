# B5: 分类式智能探索面板

## 需求描述

以分类卡片形式沉淀常见问题与分析场景（如能效、异常、设备健康），并通过工况分类（舒适/炎热/检修/故障）呈现，支持一键跳转至对应分析视图，降低数据探索门槛。

## 功能需求

### 1. 分类体系

**一级分类（分析场景）**：
- 能效分析：系统效率、能耗趋势、节能潜力
- 异常检测：数据异常、设备故障、性能退化
- 设备健康：运行状态、维护周期、寿命预测

**二级分类（工况分类）**：
- 舒适：正常工作状态下的运行指标
- 炎热：高温环境下的性能表现
- 正常：标准运行参数范围
- 故障：异常事件与故障特征
- 检修：维护期间的数据特征

### 2. 卡片式展示

**分析场景卡片**：
| 卡片标题 | 图标 | 描述 | 快速入口 |
|---------|------|------|---------|
| 能效分析 | 📊 | 分析系统能效比与能耗趋势 | 查看详情 |
| 异常检测 | ⚠️ | 检测数据异常与设备故障 | 查看详情 |
| 设备健康 | 🔧 | 监控设备状态与维护周期 | 查看详情 |

**工况分类子卡片**：
- 显示工况名称、数据量占比、平均指标
- 热力图/进度条展示该工况的关键指标分布
- 点击跳转到对应的数据探索视图

### 3. 智能导航

**快速跳转**：
- 点击卡片 → 自动配置数据集和筛选条件
- 自动应用对应的可视化模板
- 预加载常用的分析视图

**上下文保持**：
- 记录用户浏览历史
- 推荐相关的分析场景
- 支持收藏常用卡片

### 4. 用户界面

**主面板布局**：
- 顶部搜索栏：搜索卡片和工况
- 左侧分类树：场景分类导航
- 中间卡片网格：展示所有分析场景
- 右侧统计面板：全局统计与推荐

**详情视图**：
- 场景概览：标题、描述、关键指标
- 工况分布：各工况的数据占比与趋势
- 快速操作：一键分析、导出报告、设置提醒

**设置面板**：
- 自定义卡片布局
- 调整工况标签
- 配置分析模板

## 数据结构设计

### 分类配置

```typescript
interface AnalysisCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  priority: number;
  templates: AnalysisTemplate[];
}

interface AnalysisTemplate {
  id: string;
  name: string;
  description: string;
  datasetId?: string;
  filters: FilterCondition[];
  visualizations: VisualizationConfig[];
  defaultView: 'explore' | 'time-series' | 'comparison';
}

interface FilterCondition {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'in' | 'regex';
  value: any;
}

interface VisualizationConfig {
  type: 'scatter' | 'histogram' | 'line' | 'heatmap' | 'bar';
  x?: string;
  y?: string[];
  color?: string;
  aggregation?: 'mean' | 'sum' | 'count';
}
```

### 工况标签

```typescript
interface WorkCondition {
  id: string;
  name: string;
  categoryId: string;
  color: string;
  dataPoints: number;
  percentage: number;
  metrics: {
    avgLoad: number;
    avgCOP: number;
    avgTemp: number;
  };
  filter: FilterCondition[];
}
```

### 面板配置

```typescript
interface DashboardConfig {
  layout: 'grid' | 'list' | 'masonry';
  categoryOrder: string[];
  hiddenCards: string[];
  pinnedCards: string[];
  customCards: CustomCard[];
}

interface CustomCard {
  id: string;
  name: string;
  categoryId: string;
  filter: FilterCondition[];
  visualization: VisualizationConfig;
}
```

## API 设计

### 获取分类体系

```
GET /api/explore/categories

Response:
{
  "categories": [
    {
      "id": "efficiency",
      "name": "能效分析",
      "icon": "chart-line",
      "description": "分析系统能效比与能耗趋势",
      "priority": 1,
      "templates": [...]
    }
  ]
}
```

### 获取工况统计

```
GET /api/explore/work-conditions?categoryId={categoryId}

Response:
{
  "categoryId": "efficiency",
  "conditions": [
    {
      "id": "comfort",
      "name": "舒适",
      "color": "#10B981",
      "dataPoints": 1520,
      "percentage": 65,
      "metrics": { ... },
      "filter": [...]
    }
  ]
}
```

### 获取分析模板

```
GET /api/explore/templates/:templateId

Response:
{
  "id": "efficiency-trend",
  "name": "能效趋势分析",
  "datasetId": "ds-001",
  "filters": [...],
  "visualizations": [...],
  "defaultView": "time-series"
}
```

### 保存面板配置

```
PUT /api/explore/dashboard/config
Body: DashboardConfig
Response: { success: true }
```

### 创建自定义卡片

```
POST /api/explore/custom-cards
Body: { name, categoryId, filter, visualization }
Response: { cardId: "custom-001" }
```

## 前端实现要点

### 1. 主面板组件

```typescript
const SmartExploreDashboard: React.FC = () => {
  const [categories, setCategories] = useState<AnalysisCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = useMemo(() => {
    return categories.filter(cat =>
      cat.name.includes(searchQuery) ||
      cat.description.includes(searchQuery)
    );
  }, [categories, searchQuery]);

  return (
    <div className="explore-dashboard">
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <LayoutToggle layout={layout} onChange={setLayout} />

      <div className="dashboard-content">
        <CategoryTree
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
        <CategoryCardsGrid
          categories={filteredCategories}
          layout={layout}
          onSelect={handleCardSelect}
        />
        <StatisticsPanel categories={categories} />
      </div>
    </div>
  );
};
```

### 2. 分类卡片组件

```typescript
const CategoryCard: React.FC<{ category: AnalysisCategory; onSelect }> = ({ category, onSelect }) => {
  const [conditions, setConditions] = useState<WorkCondition[]>([]);

  useEffect(() => {
    api.explore.workConditions(category.id).then(setConditions);
  }, [category.id]);

  return (
    <Card className="category-card" onClick={() => onSelect(category)}>
      <div className="card-header">
        <Icon name={category.icon} />
        <h3>{category.name}</h3>
      </div>
      <p className="card-description">{category.description}</p>

      <div className="work-conditions">
        {conditions.map(condition => (
          <ConditionBadge key={condition.id} condition={condition} />
        ))}
      </div>

      <div className="card-actions">
        <Button variant="primary">查看详情</Button>
        <Button variant="secondary">配置模板</Button>
      </div>
    </Card>
  );
};
```

### 3. 工况分布图

```typescript
const ConditionDistributionChart: React.FC<{ conditions: WorkCondition[] }> = ({ conditions }) => {
  const data = {
    labels: conditions.map(c => c.name),
    datasets: [{
      data: conditions.map(c => c.percentage),
      backgroundColor: conditions.map(c => c.color),
      borderWidth: 0,
    }]
  };

  return (
    <div className="condition-distribution">
      <Doughnut data={data} options={doughnutOptions} />
      <Legend items={conditions.map(c => ({
        label: c.name,
        value: `${c.percentage}%`,
        color: c.color
      }))} />
    </div>
  );
};
```

## 后端实现要点

### 1. 工况识别引擎

```python
class WorkConditionClassifier:
    def __init__(self, condition_rules: List[Dict]):
        self.rules = condition_rules

    def classify(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        根据规则对数据进行工况分类
        """
        results = data.copy()
        results['condition_id'] = 'normal'

        for rule in self.rules:
            mask = self._apply_rule(data, rule['filter'])
            results.loc[mask, 'condition_id'] = rule['id']

        return results

    def _apply_rule(self, data: pd.DataFrame, filter_config: Dict) -> pd.Series:
        """
        应用筛选条件
        """
        mask = pd.Series([True] * len(data))

        for condition in filter_config:
            if condition['operator'] == 'gt':
                mask &= data[condition['field']] > condition['value']
            elif condition['operator'] == 'lt':
                mask &= data[condition['field']] < condition['value']
            elif condition['operator'] == 'in':
                mask &= data[condition['field']].isin(condition['value'])
            elif condition['operator'] == 'regex':
                mask &= data[condition['field']].str.match(condition['value'])

        return mask

    def get_statistics(self, classified_data: pd.DataFrame) -> List[Dict]:
        """
        计算各工况的统计信息
        """
        stats = []

        for condition_id in classified_data['condition_id'].unique():
            condition_data = classified_data[classified_data['condition_id'] == condition_id]

            stats.append({
                'id': condition_id,
                'dataPoints': len(condition_data),
                'percentage': len(condition_data) / len(classified_data) * 100,
                'metrics': {
                    'avgLoad': condition_data['load_total'].mean(),
                    'avgCOP': condition_data['cop_avg'].mean(),
                    'avgTemp': condition_data['temp_avg'].mean(),
                }
            })

        return stats
```

### 2. 模板管理服务

```python
class TemplateService:
    def __init__(self, template_repo: TemplateRepository):
        self.repo = template_repo

    def get_template(self, template_id: str) -> Dict:
        """
        获取分析模板
        """
        template = self.repo.find_by_id(template_id)

        # 应用模板到数据集
        if template['datasetId']:
            data = self._load_dataset(template['datasetId'])
            filtered_data = self._apply_filters(data, template['filters'])
            visualizations = self._generate_visualizations(
                filtered_data,
                template['visualizations']
            )

            return {
                **template,
                'preview': {
                    'data': filtered_data.head(100).to_dict('records'),
                    'visualizations': visualizations
                }
            }

        return template

    def _apply_filters(self, data: pd.DataFrame, filters: List[Dict]) -> pd.DataFrame:
        """
        应用筛选条件
        """
        filtered_data = data.copy()

        for filter_config in filters:
            if filter_config['operator'] == 'eq':
                filtered_data = filtered_data[filtered_data[filter_config['field']] == filter_config['value']]
            elif filter_config['operator'] == 'gt':
                filtered_data = filtered_data[filtered_data[filter_config['field']] > filter_config['value']]
            # ... 其他操作符

        return filtered_data

    def _generate_visualizations(self, data: pd.DataFrame,
                                  configs: List[Dict]) -> List[Dict]:
        """
        生成可视化配置
        """
        visualizations = []

        for config in configs:
            if config['type'] == 'scatter':
                viz_data = {
                    'x': data[config['x']].tolist(),
                    'y': [data[col].tolist() for col in config['y']],
                    'color': data[config['color']].tolist() if config.get('color') else None
                }
                visualizations.append({ **config, 'data': viz_data })

            elif config['type'] == 'histogram':
                viz_data = {
                    'values': data[config['y'][0]].tolist(),
                    'bins': config.get('bins', 20)
                }
                visualizations.append({ **config, 'data': viz_data })

        return visualizations
```

## 验收标准

1. 分类式智能探索面板展示所有分析场景卡片
2. 卡片点击后自动配置筛选条件并跳转到对应分析视图
3. 工况分类准确，数据占比计算正确
4. 支持快速搜索卡片和工况
5. 可自定义卡片布局和隐藏不常用卡片
6. 支持创建自定义卡片并保存筛选条件
7. 响应时间 < 1 秒（加载面板）
8. 支持数据集级别的工况标签配置
