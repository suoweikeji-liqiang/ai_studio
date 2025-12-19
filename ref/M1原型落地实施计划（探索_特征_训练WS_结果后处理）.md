## 目标与范围
- 落地数据探索与特征工程的轻量后端接口与前端对接，替换关键路径中的 Mock。
- 贯通训练作业与 WebSocket 事件，产出评估摘要与模型卡（简版）。
- 实施“结果后处理和格式化”，统一推理输出与错误格式，支撑发布与对外调用。

## 交付物
- 后端接口最小集：Explore/Features/Training/Registry/Deployments/Inference。
- WebSocket 事件协议：`log|metric|artifact|done|error`。
- 结果后处理与格式化规范及实现（单位/时间对齐/缺失策略/标准输出）。
- 前端改造：探索页与特征页联动、训练页接 WS、发布页保存输入映射与展示标准输出示例。

## 后端接口（原型）
- Explore：
  - `GET /api/explore/preview?datasetId` → {sampleRows, stats:{missingRate, mean, std, buckets}}
  - `POST /api/explore/suggest` → {charts:[...], features:[{op, params, reason}]}
- Features：
  - `POST /api/features/plans` 保存手工特征计划（lag/rolling/diff/seasonality/normalize等）
  - `POST /api/features/auto` 输入数据摘要与目标 → 自动建议计划
  - `GET /api/features/plans/:id` 拉取计划
- Training：
  - `POST /api/training/jobs`（datasetId, featurePlanId, algorithm）→ {jobId}
  - `GET /api/training/jobs/:id` → 作业状态与评估摘要
  - WS `/ws` 推送：`{type:'log'|'metric'|'artifact'|'done'|'error', payload}`
- Registry：
  - `POST /api/registry/models` 注册版本与工件路径/评估摘要
  - `GET /api/registry/models/:id`
- Deployments：
  - `POST /api/deployments` 将模型版本标记为可调用，生成 `apiUrl` 与静态 `apiToken`
  - `PUT /api/deployments/:id/mapping` 保存输入字段映射与单位
- Inference：
  - `POST /api/inference/predict` 标准输入 → 标准输出（含后处理与格式化）

## 结果后处理和格式化（规范）
- 输入合法化：
  - 字段齐备校验（含映射应用）
  - 单位统一：如 `kW→W`、`°C→K`（最小覆盖常用单位）
  - 时间对齐：采样间隔校验与插值策略（前向填充/线性插值，可配置）
  - 缺失处理：阈值与告警；超过阈值返回错误 `code:'INPUT_MISSING_EXCEEDS'`
- 标准输出结构：
  - `{ modelId, version, timestamp, values:[{t, y}], unit, intervals:{p05,p50,p95}, confidence, warnings:[...], meta:{datasetId, featurePlanId} }`
- 错误格式：
  - `{ code, message, details }`，覆盖：`INVALID_INPUT`, `UNIT_INCONSISTENT`, `INPUT_MISSING_EXCEEDS`, `INFERENCE_FAILED`

## 前端改造
- 探索页（AIExplorationPage）：
  - 接 `preview/suggest` 展示抽样数据与统计摘要；将建议一键加入特征计划
  - 增加箱线图/密度曲线；导出探索报告（markdown/PNG）
- 特征页（DatasetBuilderPage）：
  - 配置滞后/滑窗/差分/季节/归一化等算子；预览样本与成本评分
  - 支持“自动特征建议”作为候选，一键合并
- 训练页（ModelLabPage）：
  - 提交作业，WS 接收日志与指标（MAE/MAPE/分位误差）
  - 完成后可“一键注册→发布”
- 发布页（DeploymentPage）：
  - 保存输入映射与单位，用标准化输出示例替换纯示例文本
  - 展示 `apiUrl/apiToken`，复制调用示例（Python/curl）

## 数据契约与示例
- 提供 JSON Schema：`FeaturePlan.schema.json`、`InferenceInput.schema.json`、`InferenceOutput.schema.json`、`Error.schema.json`
- 示例 payload：探索建议、特征计划、训练事件、标准推理输出与错误输出

## 验证与演示
- Demo：负荷预测场景，预置示例数据与特征模板
- 验证：提交训练→WS 实时指标→注册与发布→标准推理输出；探索→建议→一键加入特征计划的闭环

## 实施顺序（M1）
1) 定义数据契约与结果格式化规范（文档+Schema）
2) 后端 Explore/Features/Training/WS 最小实现，复用现有 Python
3) 前端探索与特征对接接口，打通“一键加入特征计划”
4) 训练页接入 WS 与评估摘要、完成后注册与发布
5) 部署页落地输入映射与标准输出示例；建立推理接口调用演示

如确认以上 M1 计划，我将按该顺序推进实现（代码与接口文档），确保原型在“探索→特征→训练→发布→推理”主线下清晰、流畅并可对接第三方。