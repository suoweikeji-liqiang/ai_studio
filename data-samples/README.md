# data-samples 指南

为便于在单台 16C CPU / 96GB RAM + RTX 3090 的环境下迭代，样本数据仅存放轻量占位文件，随开发逐步替换为真实脱敏数据。

## 1. similarity/
- **expected schema** (CSV/Parquet)：`timestamp, project_id, temp_avg, humidity_avg, load_total, cop_avg, holiday_flag`。
- **window**：至少最近 365 天，按 1h/1d 聚合均可。
- **usage**：用于相似度分析 PoC，可先构造 7~14 天的 mock 数据，命名 `similarity/mock-{date}.csv`。

## 2. autotuning/
- **expected schema**：`dataset_id, algorithm, param_grid(json), metric, value`（可为 JSONL）。
- **usage**：记录 Auto Tuning 试验输入/输出示例，便于在 Airflow+MLflow 测试时复用。
- **naming**：`autotuning/sample-{algo}.jsonl`。

> 所有样本仅做开发验证，禁止上传包含真实客户敏感信息的数据。
