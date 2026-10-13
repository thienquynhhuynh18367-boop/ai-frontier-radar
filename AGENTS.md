# AI Frontier Radar Codex 工程约束

本文件适用于仓库内的工程任务。项目所有者的当前明确指令优先；执行任何 Task 前，先核对本文件、[docs/PRD.md](docs/PRD.md) 与 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 产品与成本硬约束

1. **Monthly Cash Operating Cost = ¥0。**未经项目所有者明确批准，不加入付费 API、数据库、搜索、抓取、存储、部署或其他付费服务；先核查信用卡要求、自动超额计费、免费额度和可替换性。
2. 当前产品禁止 LLM、RAG、Embedding、Vector Database、AI Chat、Ask AI、Agent、Skill、Coze、飞书和任何模型 API。这里的 Agent 指产品功能，不妨碍 Codex 作为工程工具工作。
3. 不加入用户注册、多用户、云端个人状态或通知渠道；不自行修改 PRD 产品范围。

## 修改与架构约束

4. 修改代码前先读 PRD、Architecture、相关现有文件和测试；先分析问题、说明方案及涉及文件，再实施。
5. 一个 Task 只解决一个明确问题；禁止无关重构、无关格式化和顺手扩大功能。
6. Collector（数据采集器）与 Web（网站展示）必须解耦。Collector 只输出 Raw Data（原始数据），所有来源经 Normalize（标准化）、Deduplicate（去重）、Classification（规则分类）和 Ranking（排序）后才能交给 Web。前端不承担核心清洗、去重和评分。
7. 所有核心业务逻辑必须可独立测试。Pipeline（处理流水线）、Collector、Schema（数据结构规范）、Ranking 和 Trend Statistics（趋势统计）的修改必须配套有意义的测试。
8. 修改 Schema 时必须说明 Collector、Pipeline、历史 JSON、Web、测试及迁移/重算的影响范围；同步更新对应契约和文档。
9. Public GitHub Repository（公开 GitHub 仓库）中的 `data/raw/` 本身公开。Raw Data 只留重算所需的最小字段、来源 ID 和 URL，不保存没有必要的网页全文；Raw Data 不进入网站静态发布产物。任何 Token、密钥和私密数据不得提交。

## Bug、验证与提交

10. Bug 必须先 Reproduce（复现）、Check Logs（查看日志）、Locate Layer（定位层级）并做 Root Cause Analysis（根因分析）；列出涉及文件和最小修复方案后再改。修复后运行 Regression Test（回归测试）。
11. 每个实施 Task 完成后运行 `test`、`lint`、`typecheck`、`build`。若项目骨架尚未提供某命令，明确报告“未运行”和原因，不能声称通过；T01 应建立统一脚本。
12. Commit（提交）前必须检查 `git diff --check`、Git Diff（修改差异）、未跟踪文件和 Git Status（仓库状态），确认没有无关改动。一个可验收 Task 对应一个清晰、可回滚的 Commit。
13. 测试或构建失败时不声称 Task 完成；不得用删除测试、放宽类型或跳过验证掩盖问题。

## 沟通与可维护性

14. 技术解释和 Task 汇报使用中文；关键概念写作 **English Name（中文解释）**。完成时说明修改文件、数据流变化、技术原因、验证命令与结果、已知问题和一个最合理的下一 Task。
15. Collector、Pipeline、Deduplicate、Ranking、Trend、Retry、Schema、复杂业务逻辑与 GitHub Actions 关键节点保留必要中文注释，解释规则或边界；不逐行翻译代码。
16. 遵循 Read → Analyze → Plan → Files → Implement → Test → Lint → Typecheck → Build → Diff → Report → Commit。用户明确要求只做设计或文档时，不开始页面、Collector 或 API 接入。
