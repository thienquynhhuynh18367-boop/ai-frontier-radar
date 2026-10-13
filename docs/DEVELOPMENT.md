# AI Frontier Radar 开发与协作规范

> 当前仓库处于 Task 00.5：只有文档与工程约束，尚无 `package.json`、Next.js 骨架、Collector 或产品页面。下述命令约定供 T01 建立脚本时实现，不能把它们描述为当前已可运行。

## 1. Local Development（本地开发）

正式仓库：<https://github.com/thienquynhhuynh18367-boop/ai-frontier-radar>。进入仓库后先阅读 [PRD.md](PRD.md)、[ARCHITECTURE.md](ARCHITECTURE.md) 和根目录 `AGENTS.md`。目前可直接阅读和编辑文档；**当前尚不能启动 Web**。T01 建立 Next.js（Web 框架）、TypeScript（类型化 JavaScript）、Tailwind CSS 与 shadcn/ui 骨架后，再在 README 中填写经过实际验证的安装和启动命令。

T01 应在 `package.json` 建立以下统一脚本，并在完成时记录实际包管理器与版本：

| 目的 | 计划脚本 | 当前状态 |
| --- | --- | --- |
| 本地启动 | `npm run dev` | 不可运行；尚无 `package.json` |
| Test（测试） | `npm run test` | 不可运行；尚无测试框架与脚本 |
| Lint（代码检查） | `npm run lint` | 不可运行；尚无配置与脚本 |
| Typecheck（类型检查） | `npm run typecheck` | 不可运行；尚无 TypeScript 配置与脚本 |
| Build（构建） | `npm run build` | 不可运行；尚无 Next.js 项目 |

若 T01 选择其他包管理器，必须同步更新本表、README 和 CI（持续集成）命令；实际可运行性以 `package.json` 为准，不靠文档猜测。每个后续 Task 尽量运行上述四项；若某项确实尚不存在，报告原因和补齐它的 Task，不能虚报通过。

## 2. Task 执行顺序

每个 Task 遵循：Read（阅读）→ Analyze（分析）→ Plan（方案）→ Files（涉及文件）→ Implement（实施）→ Test（测试）→ Lint（代码检查）→ Typecheck（类型检查）→ Build（构建）→ Diff（差异检查）→ Report（中文汇报）→ Commit（提交）。

1. 阅读该 Task 相关的 PRD、Architecture、AGENTS 与现有代码。
2. 说明目标、影响层级、涉及文件、数据流与风险；只修改当前 Task 的必要文件。
3. 实施后运行相关单元、契约或集成测试，以及可用的 lint、typecheck、build。
4. 使用 `git diff --check` 和 `git diff` 检查空白错误及无关改动；新文件也要检查内容。
5. 用中文报告完成内容、修改文件、数据流变化、技术解释、验证结果、已知问题与一个最合理的下一 Task。
6. 验证通过后形成一个职责清楚的 Commit（提交）；失败时不能声称 Task 已完成。

工程施工顺序不代表新的产品版本。不得自行扩展 [PRD.md](PRD.md) 的当前范围，也不因一次 Task 顺手重构稳定模块。

## 3. Git / Commit（版本控制与提交）

- 开始前检查仓库根路径、当前 Branch（分支）、Remote（远端）和 `git status`，保留已有未提交改动。
- 一个可验收 Task 对应一个可运行、可测试、可回滚的清晰 Commit；提交信息使用 `docs:`、`feat:`、`fix:`、`test:` 等明确前缀，例如 `docs: establish repository foundation`。
- 提交前先检查 Diff（差异），避免把自动格式化整个仓库、缓存、原始网页全文、Token 或无关修改一起提交。
- 改动 Schema（数据结构规范）时列出 Collector、Pipeline、JSON、Web、测试与历史数据的影响，并同步相关文档和测试。
- 严重回归优先回到已知稳定 Commit，再复现和定位，不靠大范围试错修复。
- 不覆盖或丢弃他人未提交的工作。推送前确认 Remote 和 Branch；公开仓库中的文件默认可被任何人阅读。

## 4. Bug 处理规则

1. **Reproduce（复现）：**记录输入、日期、页面或来源，以及预期和实际结果。
2. **Check Logs（查看日志）：**检查浏览器控制台、Pipeline 日志、GitHub Actions 日志与来源健康状态。
3. **Locate Layer（定位层级）：**Collector、Normalize、Deduplicate、Classification、Ranking、Trend、Data 或 Web。
4. **Root Cause Analysis（根因分析）：**说明造成错误的最小原因，而不是仅描述页面症状。
5. **Affected Files（涉及文件）：**列出实际要修改的文件和上下游影响。
6. **Minimal Fix（最小修复）：**先说明方案，再实施。
7. **Regression Test（回归测试）：**覆盖原故障及受影响路径，运行相关检查并查看 Diff。

单源失败时先确定是正常空数据、限流、超时、Schema 变化还是解析错误；不能简单把空数组当作健康成功。昨日数百条而今日零条时，先检查 Data Anomaly（数据异常）和各来源覆盖，不发布误导性的 `latest.json`。

## 5. 测试层级

| 层级 | 主要验证 |
| --- | --- |
| Unit Test（单元测试） | URL、标题、Hash、去重、规则分类、评分分项、趋势窗口 |
| Collector Contract Test（采集器契约测试） | 固定响应样本、空值、缺失字段、超时、429、HTML 结构变化 |
| Integration Test（集成测试） | Raw Data → IntelligenceItem → JSON、部分失败、异常阻断、增量 Cursor |
| Schema Test（结构验证） | `latest.json`、历史、趋势、Health 的字段与版本 |
| UI Test（界面测试） | 页面读取、搜索筛选、收藏、已读、隐藏与导出 |
| E2E Test（端到端测试） | 自动任务产出数据后静态 Web 可读取，失败时显示过期状态 |

当前 Task 00.5 只进行文档内容检查和 Git Diff 检查；业务测试从 T01 建立项目骨架后开始。

## 6. 技术解释与注释

面向项目所有者的技术说明使用中文，并用 **English Name（中文解释）**标注关键概念。核心代码在 Collector、Pipeline、Deduplicate、Ranking、Trend、Retry、Schema 和复杂业务分支保留必要中文注释，解释“为什么这样做”和边界条件；不逐行翻译显而易见的代码。

## 7. 零成本与数据公开提醒

Monthly Cash Operating Cost = ¥0。引入任何外部服务前检查是否收费、是否需要信用卡、是否会自动超额计费、免费额度和替换成本。未经明确批准，不加入付费服务或 LLM / RAG / Embedding / Agent / Skill / Coze / 飞书能力。

公开 GitHub 仓库中的 `data/raw/` 仍然公开，只能保存重算所需的最小字段、来源 ID 和 URL，不保存没有必要的网页全文。**Raw Data 不进入网站静态发布产物。**
