## 仓库初始化
- 在当前目录初始化 Git 仓库，创建 `.gitignore`（Node/TS、Python、`artifacts/`、`tmp/`、`dist/`、`node_modules/`、`.env*`、`.vercel/`、`.turbo/`）。
- 建立首个提交：保留现状代码与文档；标签 `v0.1-prototype-start` 便于回退。

## 分支策略（原型）
- `main`：稳定里程碑（M1/M2/M3）合并。
- `feat/explore-and-features`：数据探索与特征工程强化的前端对接与接口。
- `feat/training-and-deploy`：训练作业/评估摘要/注册与发布/输入映射与后处理。
- `feat/partner-integration`：合作模型导入与适配层。

## 提交规范
- 格式：`type(scope): subject`，如 `feat(features): add lag/rolling operators`。
- 常见 `type`：`feat`/`fix`/`docs`/`refactor`/`chore`。
- 里程碑打标签：`v0.2-M1`、`v0.3-M2` 等。

## 钩子与配置（可选，原型简化）
- `pre-commit`：前端 `lint --fix` 与 TypeScript 检查；后端与脚本跳过或仅基础检查。
- `commitlint`（可选）：统一消息格式；不强制可作为建议。

## 快速回退与存档
- 重要合并点创建轻量 tag 与 release note（本地 txt/markdown 亦可）。
- `artifacts/` 保留训练工件，但不入库；必要时在 release note 中记录工件路径。

## 近期落地顺序
- 步骤 1：初始化 Git 与 `.gitignore`、首个提交与标签。
- 步骤 2：创建分支并开始 M1（Explore/Features 接口与前端对接，WS 贯通）。
- 步骤 3：在每个里程碑合并至 `main` 并打标签，保证可回退。

确认后，我将执行仓库初始化与基础配置，并返回执行结果与文件清单，确保后续改动都可回退。