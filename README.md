# AI Frontier Radar

AI Frontier Radar 是供本人长期使用的 AI 行业前沿信息雷达 Web 产品，目标是从公开信息中筛出值得关注的内容，并用历史数据展示可核验的趋势。

## 核心价值

围绕 AI 技术、Agent、RAG、MCP、AI Coding、产品、创业公司、融资、开源项目、论文和职业市场，建立“采集 → 标准化 → 去重 → 分类 → 排序 → 趋势统计 → Web 展示”的确定性数据链路，让每天的前沿输入更聚焦、可追溯、可沉淀。

## 当前技术架构

当前已建立 Next.js App Router（应用路由）、TypeScript（类型检查）、Tailwind CSS（样式）、shadcn/ui（组件配置）和 Vitest（测试）的工程骨架，以及数据契约、HttpClient 与首个 GitHub Repository Search Collector（仓库搜索采集器）。`next.config.ts` 启用 Static Export（静态导出），构建产物位于 `out/`。首页目前只是工程占位页；尚无 Pipeline、真实数据发布或每日工作流。Collector 与 Web 分离；未来静态 Web 只读取通过验证的 JSON。

## 当前目录

```text
ai-frontier-radar/
├─ app/                    # App Router 与工程占位页
├─ collectors/github/      # GitHub Repository Search Collector
├─ config/sources/         # 数据源查询与请求规模配置
├─ components/ui/button.tsx # shadcn/ui 初始化生成的基础组件
├─ lib/                    # HTTP Client 与共享工具
├─ types/                  # RawItem、Collector 等运行时契约
├─ tests/                  # 离线契约与 Collector 测试
├─ docs/                   # PRD、架构、数据源与开发规范
├─ AGENTS.md               # Codex 工程约束
├─ README.md               # 项目入口
├─ components.json         # shadcn/ui 配置
├─ next.config.ts          # Static Export 配置
├─ eslint.config.mjs       # ESLint 配置
├─ postcss.config.mjs      # Tailwind CSS 构建配置
├─ tsconfig.json           # TypeScript 严格模式配置
├─ package.json            # npm 脚本和依赖
└─ package-lock.json       # npm 锁定版本
```

Pipeline、数据目录和自动化工作流将在后续明确 Task 中按依赖建立。

## 本地开发入口

使用 Node.js 24（本次验证版本 24.16.0）和 npm（本次验证版本 11.13.0）。在仓库根目录执行：

```bash
npm install
npm run dev
```

开发服务器启动后访问 <http://localhost:3000>。本次已实际验证 `npm run dev` 可启动并返回首页。其他已验证命令：

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

`npm run build` 在 `out/` 生成静态 HTML、JavaScript 和 CSS；目前尚未配置 GitHub Pages 的 `basePath`、`assetPrefix` 或部署工作流。详细规范见 [DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 文档入口

- [PRD.md](docs/PRD.md)：最终产品范围、来源原则、页面与验收。
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)：系统架构、Data Flow（数据流）、Schema（数据结构规范）、稳定性设计。
- [DATA-SOURCES.md](docs/DATA-SOURCES.md)：Data Source Registry（数据源注册表）及接入状态。
- [DEVELOPMENT.md](docs/DEVELOPMENT.md)：开发、测试、Git、Bug 与 Task 规则。
- [AGENTS.md](AGENTS.md)：Codex 工程硬约束。

## Zero Cost Constraint（零现金成本约束）

**Monthly Cash Operating Cost = ¥0。**当前不接付费 API、模型、数据库或收费部署；新增依赖前核查收费、信用卡、自动超额计费和免费额度。公开 GitHub 仓库中的文件默认公开，Raw Data（原始数据）只保存必要字段，且不进入网站静态发布产物。
