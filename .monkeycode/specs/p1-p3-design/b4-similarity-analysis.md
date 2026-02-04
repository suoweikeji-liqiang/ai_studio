# B4: 相似度分析（找与今天/明天类似的历史日期）

## 需求描述

基于天气、用能、节假日等关键特征，计算与指定日期（今天或明天）最相似的历史日期，输出参考指标及策略建议，帮助用户预测未来趋势。

## 功能需求

### 1. 特征选择

**输入特征**：
- **天气特征**：温度平均值 (temp_avg)、湿度平均值 (humidity_avg)、天气类型
- **用能特征**：总负荷 (load_total)、能效比 (cop_avg)
- **时间特征**：节假日标记 (holiday_flag)、季节标识、周几

**特征权重配置**：
- 支持用户调整各特征权重
- 预设权重配置：天气 40%、用能 40%、时间 20%

### 2. 相似度算法

**标准化**：
- Z-score 标准化：`(x - mean) / std`
- 适用于数值型特征

**距离计算**：
- **加权欧氏距离**：`d(x, y) = sqrt(Σ wi * (xi - yi)^2)`
- **DTW（动态时间规整）**：适用于时间序列对齐

**相似度分数**：
- 转换为 0-1 区间：`similarity = 1 / (1 + distance)`

### 3. 结果展示

**Top-N 相似日期列表**：
| 日期 | 相似度分数 | 温度 | 湿度 | 负荷 | COP | 节假日 |
|------|-----------|------|------|------|-----|--------|
| 2024-01-15 | 0.92 | 12.5 | 65 | 850 | 3.2 | 否 |
| 2024-01-08 | 0.88 | 11.8 | 63 | 820 | 3.1 | 否 |

**关键特征对比**：
- 并排展示目标日期与相似日期的特征差值
- 高亮差异较大的特征

**策略建议**：
- 基于相似日期的历史表现生成建议
- 示例："参考相似日期，建议明日负荷控制在 800-900kW"

### 4. 用户界面

**查询面板**：
- 选择目标日期（今天/明天/自定义）
- 设置相似度阈值（默认 0.7）
- 设置返回结果数量（默认 Top-10）

**结果展示区**：
- 相似日期表格（可排序）
- 特征对比雷达图
- 历史趋势线图（目标日期 vs 相似日期）
- 策略建议卡片

**参数配置**：
- 特征权重滑块
- 算法选择（欧氏距离/DTW）
- 时间窗口范围（最近 N 天）

## 数据结构设计

### 请求参数

```typescript
interface SimilarityQuery {
  targetDate: string;        // YYYY-MM-DD
  features: {
    weather: boolean;        // 包含天气特征
    energy: boolean;         // 包含用能特征
    time: boolean;           // 包含时间特征
  };
  weights: {
    weather: number;         // 天气权重 (0-1)
    energy: number;          // 用能权重 (0-1)
    time: number;            // 时间权重 (0-1)
  };
  algorithm: 'euclidean' | 'dtw';
  threshold: number;         // 相似度阈值
  topN: number;              // 返回结果数量
  windowDays: number;        // 历史窗口（天）
}
```

### 相似日期结果

```typescript
interface SimilarDate {
  date: string;
  similarityScore: number;
  distance: number;
  features: {
    tempAvg: number;
    humidityAvg: number;
    loadTotal: number;
    copAvg: number;
    holidayFlag: boolean;
  };
  diffFromTarget: {
    tempAvg: number;
    humidityAvg: number;
    loadTotal: number;
    copAvg: number;
  };
}

interface SimilarityResponse {
  targetDate: string;
  targetFeatures: SimilarDate['features'];
  results: SimilarDate[];
  strategy: string;          // 策略建议文本
}
```

## API 设计

### 查询相似日期

```
POST /api/explore/similarity
Body: SimilarityQuery
Response: SimilarityResponse
```

### 获取可用日期范围

```
GET /api/explore/similarity/range
Response:
{
  "minDate": "2023-01-01",
  "maxDate": "2024-02-04",
  "totalDays": 400
}
```

### 保存查询配置

```
POST /api/explore/similarity/config
Body: { name: "工作日模式", query: SimilarityQuery }
Response: { configId: "config-001" }
```

### 加载查询配置

```
GET /api/explore/similarity/config/:id
Response: { name, query, createdAt }
```

## 后端实现要点

### 1. 特征标准化

```python
import numpy as np
from sklearn.preprocessing import StandardScaler

class FeatureNormalizer:
    def __init__(self):
        self.scaler = StandardScaler()

    def fit(self, data: pd.DataFrame):
        self.scaler.fit(data)

    def transform(self, data: pd.DataFrame) -> np.ndarray:
        return self.scaler.transform(data)
```

### 2. 相似度计算引擎

```python
class SimilarityEngine:
    def __init__(self, weights: dict):
        self.weights = weights

    def calculate_distance(self, target: np.ndarray, candidate: np.ndarray, method='euclidean') -> float:
        if method == 'euclidean':
            return self._weighted_euclidean(target, candidate)
        elif method == 'dtw':
            return self._dtw_distance(target, candidate)

    def _weighted_euclidean(self, x: np.ndarray, y: np.ndarray) -> float:
        diff = x - y
        weighted_diff = diff * np.sqrt(list(self.weights.values()))
        return np.sqrt(np.sum(weighted_diff ** 2))

    def _dtw_distance(self, x: np.ndarray, y: np.ndarray) -> float:
        # 实现 DTW 算法
        n, m = len(x), len(y)
        dtw_matrix = np.full((n+1, m+1), np.inf)
        dtw_matrix[0, 0] = 0

        for i in range(1, n+1):
            for j in range(1, m+1):
                cost = abs(x[i-1] - y[j-1])
                dtw_matrix[i, j] = cost + min(
                    dtw_matrix[i-1, j],     # 插入
                    dtw_matrix[i, j-1],     # 删除
                    dtw_matrix[i-1, j-1]    # 匹配
                )
        return dtw_matrix[n, m]

    def find_similar_dates(self, target: np.ndarray, candidates: np.ndarray,
                          dates: list, topN: int) -> list:
        distances = [self.calculate_distance(target, candidate)
                     for candidate in candidates]
        similarity_scores = [1 / (1 + d) for d in distances]

        sorted_indices = np.argsort(similarity_scores)[::-1][:topN]
        return [
            {
                'date': dates[i],
                'similarityScore': similarity_scores[i],
                'distance': distances[i]
            }
            for i in sorted_indices
        ]
```

### 3. 策略生成

```python
class StrategyGenerator:
    def generate(self, target_date: str, similar_dates: list,
                 load_history: pd.DataFrame) -> str:
        if not similar_dates:
            return "暂无相似历史数据，建议参考平均值"

        top_similar = similar_dates[0]
        similar_date = top_similar['date']

        avg_load = load_history[similar_date]['load_total']
        std_load = load_history[similar_date]['load_std']

        recommendation = (
            f"参考最相似日期 {similar_date}（相似度 {top_similar['similarityScore']:.2f}），"
            f"历史平均负荷为 {avg_load:.0f}kW（波动 ±{std_load:.0f}kW）。"
            f"建议目标日期负荷控制在 {avg_load - std_load:.0f}-{avg_load + std_load:.0f}kW 之间。"
        )

        return recommendation
```

## 前端实现要点

### 1. 相似度分析卡片组件

```typescript
const SimilarityAnalysisCard: React.FC = () => {
  const [query, setQuery] = useState<SimilarityQuery>(defaultQuery);
  const [results, setResults] = useState<SimilarityResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const data = await api.explore.similarity(query);
    setResults(data);
    setLoading(false);
  };

  return (
    <Card>
      <QueryPanel query={query} onChange={setQuery} onSearch={handleSearch} />
      {loading && <Spinner />}
      {results && (
        <>
          <SimilarDatesTable data={results.results} />
          <FeatureComparison target={results.targetFeatures} similar={results.results[0]} />
          <StrategyCard text={results.strategy} />
        </>
      )}
    </Card>
  );
};
```

### 2. 特征对比雷达图

```typescript
const FeatureComparisonRadar: React.FC<{ target, similar }> = ({ target, similar }) => {
  const data = {
    labels: ['温度', '湿度', '负荷', 'COP'],
    datasets: [
      {
        label: '目标日期',
        data: [target.tempAvg, target.humidityAvg, target.loadTotal, target.copAvg],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      },
      {
        label: '相似日期',
        data: [similar.tempAvg, similar.humidityAvg, similar.loadTotal, similar.copAvg],
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
      },
    ],
  };

  return <Radar data={data} options={radarOptions} />;
};
```

## 验收标准

1. 可选择目标日期并查询历史相似日期
2. 正确计算相似度分数并按降序展示
3. Top-N 相似日期展示包含日期、相似度分值、关键特征
4. 特征对比图直观展示目标日期与相似日期的差异
5. 根据相似日期历史表现生成合理的策略建议
6. 支持自定义特征权重和相似度阈值
7. 查询配置可保存和加载
8. 响应时间 < 2 秒（查询 365 天历史数据）
