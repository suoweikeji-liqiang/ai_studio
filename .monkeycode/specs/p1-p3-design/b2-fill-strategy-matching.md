# B2: 按列名/正则自动匹配默认填充策略

## 需求描述

当用户在数据集构建器中新增数据列时，系统应能够根据列名或正则表达式规则自动匹配并应用预设的缺失值填充策略。

## 功能需求

### 1. 策略定义

支持以下填充策略：
- **ForwardFill (ffill)**: 用前一个有效值填充
- **BackwardFill (bfill)**: 用后一个有效值填充
- **Zero**: 用 0 填充
- **Mean**: 用列均值填充
- **Median**: 用列中位数填充
- **Custom**: 自定义值或表达式

### 2. 规则匹配机制

**按列名匹配**：
- 精确匹配：列名完全等于规则名称
- 前缀匹配：列名以规则前缀开头
- 包含匹配：列名包含规则关键词

**按正则表达式匹配**：
- 支持用户自定义正则表达式
- 匹配顺序：正则 > 前缀 > 包含 > 精确

### 3. 预设规则示例

| 规则名称 | 匹配模式 | 策略 | 适用场景 |
|---------|---------|------|---------|
| temperature | `temp.*`.*`| `*ForwardFill` | 温度传感器数据 |
| humidity | `.*humid.*` | `ForwardFill` | 湿度传感器数据 |
| load | `.*load.*` | `Mean` | 负荷数据 |
| status | `.*status.*|.*state.*` | `ForwardFill` | 设备状态 |
| flag | `.*flag.*` | `Zero` | 标记字段 |

### 4. 用户界面

**配置面板**：
- 策略列表管理（增删改查）
- 规则编辑器（列名/正则 + 策略下拉）
- 规则优先级排序（上移/下移）
- 规则测试预览（输入列名 → 显示匹配策略）

**数据集构建器集成**：
- 新增列时自动显示匹配的策略
- 允许用户覆盖默认策略
- 显示策略匹配来源（规则名称）

## 数据结构设计

### 策略配置存储

```typescript
interface FillStrategy {
  id: string;
  name: string;
  type: 'exact' | 'prefix' | 'contains' | 'regex';
  pattern: string;
  strategy: 'ffill' | 'bfill' | 'zero' | 'mean' | 'median' | 'custom';
  customValue?: any;
  priority: number;
}

interface FillStrategyConfig {
  global: FillStrategy[];
  datasetSpecific: {
    [datasetId: string]: FillStrategy[];
  };
}
```

### 特征计划扩展

```typescript
interface FeaturePlanColumn {
  name: string;
  fillStrategy?: {
    strategy: string;
    source: 'global' | 'dataset' | 'manual';
    ruleId?: string;
  };
  // ... 其他字段
}
```

## API 设计

### 获取策略配置

```
GET /api/fill-strategies?datasetId={datasetId}

Response:
{
  "global": [...],
  "datasetSpecific": [...],
  "defaultStrategy": "ffill"
}
```

### 更新策略配置

```
PUT /api/fill-strategies
Body: { global: [...], datasetSpecific: {...] }
Response: { success: true }
```

### 匹配列策略

```
POST /api/fill-strategies/match
Body: { datasetId, columnNames: ["temp_avg", "load_total"] }
Response:
{
  "temp_avg": { strategy: "ffill", source: "global", ruleId: "temp-rule" },
  "load_total": { strategy: "mean", source: "global", ruleId: "load-rule" }
}
```

## 前端实现要点

### 1. 策略配置页面

- 使用 React Query 管理策略配置
- 表单验证：正则表达式语法校验
- 规则测试功能：实时预览匹配结果

### 2. 数据集构建器集成

- 监听列变化事件
- 自动调用匹配接口
- 显示策略来源标签（全局/自定义）

### 3. 预览功能

- 在预览表格中显示填充策略应用后的效果
- 标注填充值的来源位置

## 后端实现要点

### 1. 规则匹配引擎

```python
class FillStrategyMatcher:
    def match(self, column_name: str, strategies: List[FillStrategy]) -> Optional[FillStrategy]:
        # 按优先级排序后匹配
        sorted_strategies = sorted(strategies, key=lambda x: x.priority)
        for strategy in sorted_strategies:
            if self._match_pattern(column_name, strategy):
                return strategy
        return None

    def _match_pattern(self, column_name: str, strategy: FillStrategy) -> bool:
        if strategy.type == 'exact':
            return column_name == strategy.pattern
        elif strategy.type == 'prefix':
            return column_name.startswith(strategy.pattern)
        elif strategy.type == 'contains':
            return strategy.pattern in column_name
        elif strategy.type == 'regex':
            return re.match(strategy.pattern, column_name) is not None
        return False
```

### 2. 策略应用

```python
class FillStrategyApplicator:
    def apply(self, df: pd.DataFrame, column_name: str, strategy: FillStrategy) -> pd.Series:
        if strategy.strategy == 'ffill':
            return df[column_name].ffill()
        elif strategy.strategy == 'bfill':
            return df[column_name].bfill()
        elif strategy.strategy == 'zero':
            return df[column_name].fillna(0)
        elif strategy.strategy == 'mean':
            return df[column_name].fillna(df[column_name].mean())
        elif strategy.strategy == 'median':
            return df[column_name].fillna(df[column_name].median())
        elif strategy.strategy == 'custom':
            return df[column_name].fillna(strategy.customValue)
```

## 验收标准

1. 新增列时自动应用匹配的填充策略，无需用户手动选择
2. 预览数据中正确反映填充策略的效果
3. 用户可覆盖默认策略并保存到特征计划
4. 规则测试功能可验证匹配逻辑
5. 支持数据集级别的策略覆盖全局策略
6. 策略配置可导出/导入用于跨项目复用
