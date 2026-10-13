# AI Frontier Radar 开发与协作规范

> T01 已建立并验证 Next.js 工程骨架。T04 已实现 GitHub Repository Search Collector（仓库搜索采集器）；当前首页仍是 Engineering Placeholder（工程占位页），尚无 Pipeline、真实产品页面、数据发布或部署工作流。

## 1. Local Development（本地开发）

正式仓库：<https://github.com/thienquynhhuynh18367-boop/ai-frontier-radar>。进入仓库后先阅读 [PRD.md](PRD.md)、[ARCHITECTURE.md](ARCHITECTURE.md) 和根目录 `AGENTS.md`。只使用 **npm**；不要改用 pnpm、yarn 或 bun。本次在 Windows 上以 Node.js 24.16.0、npm 11.13.0 验证。`package.json` 的 Node 要求为 `^24.0.0`，Node 类型包使用对应的 24.x 系列。

在仓库根目录执行 `npm install` 后，使用 `npm run dev` 启动本地开发服务器，默认访问 <http://localhost:3000>。T01 实测开发服务器返回 HTTP 200 和指定的工程占位文字。无需 `.env` 文件或任何 Token。

以下命令已在 T01 实际验证；`test` 使用一次性执行模式，结束后正常退出：

| 目的 | npm 命令 | 当前状态 |
| --- | --- | --- |
| 本地启动 | `npm run dev` | 通过；首页 HTTP 200 |
| Test（测试） | `npm run test` | 通过；Vitest 1 项冒烟测试 |
| Lint（代码检查） | `npm run lint` | 通过；ESLint CLI |
| Typecheck（类型检查） | `npm run typecheck` | 通过；`tsc --noEmit`，`strict: true` |
| Build（构建） | `npm run build` | 通过；`out/` 静态产物 |

关键版本（以 `package-lock.json` 锁定的实际安装结果为准）：Next.js 16.4.0、React 19.3.0、TypeScript 6.0.3、Tailwind CSS 4.3.3、shadcn/ui CLI 4.21.4、Vitest 5.0.4、ESLint 9.39.5。TypeScript 7 与当前 `eslint-config-next` 的 TypeScript ESLint 依赖不兼容，故使用兼容的稳定 6.0.3。Static Export（静态导出）通过 `next.config.ts` 的 `output: "export"` 实现；GitHub Pages 路径和部署留待部署 Task。

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

T01 只验证工程配置的 Smoke Test（冒烟测试）；业务测试须在对应业务 Task 中建立，不能用本测试替代。

## 6. 技术解释与注释

面向项目所有者的技术说明使用中文，并用 **English Name（中文解释）**标注关键概念。核心代码在 Collector、Pipeline、Deduplicate、Ranking、Trend、Retry、Schema 和复杂业务分支保留必要中文注释，解释“为什么这样做”和边界条件；不逐行翻译显而易见的代码。

## 7. 零成本与数据公开提醒

Monthly Cash Operating Cost = ¥0。引入任何外部服务前检查是否收费、是否需要信用卡、是否会自动超额计费、免费额度和替换成本。未经明确批准，不加入付费服务或 LLM / RAG / Embedding / Agent / Skill / Coze / 飞书能力。

公开 GitHub 仓库中的 `data/raw/` 仍然公开，只能保存重算所需的最小字段、来源 ID 和 URL，不保存没有必要的网页全文。**Raw Data 不进入网站静态发布产物。**
