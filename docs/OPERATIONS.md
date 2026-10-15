# AI Frontier Radar 上线运行手册

## 自动运行与真实时间

`Daily Radar` 在每日 **UTC 00:17 / 北京时间 08:17** 计划启动。平台可能延迟或丢弃极少数定时运行；实际 `asOf` 取 Runner 启动 CLI 时的 UTC 时刻，不倒填计划时间。默认采集前一个已结束的上海自然日。手动运行入口：仓库 **Actions → Daily Radar → Run workflow**；`business_date` 可留空，或填写已结束的 `YYYY-MM-DD`。已存在更晚 latest 的旧日不能覆盖它；缺失业务日即便使用真实当前时间回补，也可能因为外部索引变化而不完整。过去 `--as-of` 只用于不发布的 Smoke/Diagnose；不把今天联网获得的观测冒充过去采集。未来 `--as-of` 一律拒绝，容差零秒。

`Deploy Site` 在用户正常 Push `main` 时运行，也可在 Actions 中手动运行。Daily Radar 使用内置 `GITHUB_TOKEN` 推送数据不会触发 Deploy Site，因此它自己的 Build 和 Deploy Job 会在同一次运行中发布。两个 Deploy Job 共用并发组，发布前检查 Artifact 的提交仍是最新 `main`；落后时跳过旧部署。

每次 Daily Radar 先运行 `npm ci`、test、lint、typecheck，再采集六源。只将通过校验的 `data/` 与 `public/data/` 变化提交到 `main`，使用非强制推送；没有变化就不产生 Commit。之后以数据提交 SHA 构建 `out/`、执行 `verify:export`、上传官方 Pages Artifact 并部署。构建时固定 `RADAR_BASE_PATH=/ai-frontier-radar`。自动提交不会修改源码、`node_modules/`、`out/` 或临时文件。

## 首次启用 GitHub Pages

仓库必须保持 Public。到 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；这是 Artifact 部署，不选择 branch `/docs`。到 **Settings → Actions → General → Workflow permissions** 确认内置 `GITHUB_TOKEN` 允许数据 Job 获得 `contents: write`；不需 Personal Access Token。必要时在 `github-pages` Environment 限制仅 `main` 部署。页面预期位于仓库项目子路径 `/ai-frontier-radar/`，但只有线上实际 HTTP 和浏览器检查通过后才能称为正式地址。所有步骤均使用标准 Ubuntu Runner 与公开免费 API。

## Vercel 公开镜像

Vercel Hobby 项目 `ai-frontier-radar` 的生产地址为 <https://ai-frontier-radar.vercel.app/>。首次 CLI 生产部署已完成，未登录访问首页、Explore、Health、`/data/latest.json` 与 CSS/JS 均返回 200；`/data/raw/`、每日历史和 `.env.local` 不在网站静态产物中。Vercel 构建不设置 `RADAR_BASE_PATH`，路由位于域名根路径；GitHub Pages 仍使用 `/ai-frontier-radar/`。两个主机消费同一仓库中经过验证的 `public/data/`，不在主机上采集。

当前 Vercel 项目尚未连接 GitHub：账号所有者需到 **Vercel Account Settings → Authentication → Login Connections** 连接仓库所属 GitHub 账号，再对该项目执行 `vercel git connect`，并通过新一次 `main` Push 验证自动部署。连接并验证之前，每日 GitHub Actions 更新只会自动发布到 GitHub Pages，Vercel 保留上一次成功部署的数据快照。需要手动同步时，在仓库最新 `main` 且工作区干净的前提下运行 `vercel deploy --prod`，然后核对生产域名的 `data/latest.json` 日期、数量和 `asOf`；CLI 登录状态与 `.vercel/` 项目关联保存在本机，不能提交 Token 或 `.env.local`。Vercel 生产域名若启用访问保护，应使用未登录请求验证公开性。

Vercel [Hobby 方案](https://vercel.com/docs/plans/hobby)只允许个人非商业使用，超出免费额度可能暂停服务；项目不得升级付费计划或添加收费功能以绕过零成本约束。Vercel [中国大陆访问说明](https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china)指出默认 `vercel.app` 域名可能被阻断；广州、杭州外部节点在本次验收中连接超时，因此不能把 Vercel 镜像视为手机访问问题的保证修复。继续保留 GitHub Pages 地址，并以实际手机网络测试为准。

## 失败保护与重试

| 情况 | 数据与网站结果 | 操作 |
| --- | --- | --- |
| 六源成功 | 新历史、latest、Health 提交并在同一 Run 部署 | 核对 Run 和线上日期、数量 |
| 部分来源失败 | 成功来源新数据与失败来源旧条目一起验证发布；Health 标出 `carriedCount` 和最后成功时间 | 查看来源错误码、限流和原始 API 可用性；不要把旧条目称为今日新发现 |
| 全部来源失败或整批校验失败 | 仅安全 Health 状态可提交；Collect Job 报错，旧 latest 与旧网站不被覆盖 | 待外部来源恢复后手动重新运行；不盲目无限重试 |
| 构建、Artifact 或 Pages 部署失败 | 旧网站保留；若数据 Commit 已推送，可手动运行 Deploy Site 重新部署该提交 | 检查 Node、Pages Source、`verify:export` 与部署日志 |
| 推送冲突或 Token 无写权限 | 非强制推送失败；不部署本次 Artifact | 检查 `main` 新提交和 Settings → Actions → General 权限，再手动重跑 |
| 重复运行 | 同一业务日历史文件按稳定 ID 重算，不新增第二个日期；无 Diff 不 Commit | 对比 `asOf`、来源响应与条目数；实时 API 结果可能变化 |

GitHub Search 出现 403/429 时看 `rate_limited`、Reset/Retry-After 的安全元数据，不在日志打印 Token、完整 Header、URL query 或原始响应。arXiv 继续保持单轮一次请求；HTTP Client 已设 Timeout（超时）与有限 Retry（重试）。静态路径 404 时检查 `RADAR_BASE_PATH`、`out/explore/index.html`、`out/data/latest.json` 与页面的 `_next` 路径。Pages 已配置但部署失败时优先查看 Deploy Job、Environment 分支限制与 Pages 设置；只有本地 Build 通过不足以证明云端正常。

## 验收清单与数据体量

每次上线后分别确认 Actions Run 的 collect/build/deploy 结果、远端数据 Commit、Pages 的最新部署、线上首页与 `/data/latest.json` 的 `date/asOf/itemCount`。浏览器抽查 Today、Explore、GitHub、Products、Research、Career、Detail 直达/刷新、Saved 收藏/已读/隐藏/导入导出、Trends 历史不足提示和 Health 来源状态；手机宽度检查横向滚动和 CSS/JS 404。`out/data/` 仅应有 `latest.json`、`manifest.json`、`sources-status.json`，Raw、Token 与 `.env` 不得出现。

当前正常单轮约 24 个来源请求（GitHub 8、HN 8、arXiv 1、OpenAI 5、Anthropic 1、岗位 1），HTTP 重试可能增加。2026-10-14 六源样本：Raw 约 0.60 MB、单日 items 约 0.96 MB、发布 latest 约 0.96 MB、完整 `out/` 约 20.8 MB。按一次每日 Run 粗略估计采集、测试、构建与部署为数分钟，实际应以 Actions Run 计时为准。历史保留会持续增长；数据提交前 `verify:data-budget` 对当前 `data/` 工作树设置 750 MiB 人工复核门槛，静态导出另设 200 MiB 站点和 10 MiB latest 的人工复核门槛。超过时停止新提交/部署，绝不自动删除旧数据。这不能限制 Git 对象历史大小，因此仍须至少每月检查 Git 仓库和 Artifact Storage 体积；若接近 GitHub Pages 站点 1 GB、源仓库建议 1 GB 或免费存储边界，先做经过审查的保留/归档策略。上传 Pages Artifact 使用短期默认保留，站点仍只发布最新三个 JSON。

GitHub 官方说明：公开仓库的标准 GitHub-hosted Runner 和 Pages 可免费使用，但 [Actions 计费与存储](https://docs.github.com/en/billing/concepts/product-billing/github-actions)、[Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) 和来源 API 额度都可能变化。定时工作流可能延迟；公开仓库长期无活动时可能被自动停用。每月查看 Actions 是否仍运行与月现金成本是否保持 **¥0**，不启用 Larger Runner、收费域名、信用卡服务或付费 API。

## 安全审计记录

生产依赖执行 `npm audit --omit=dev`；本阶段新增的 YAML 开发解析器已更新到不受已知栈溢出公告影响的版本。完整开发依赖审计仍报告高危项，集中在 `eslint-config-next` 与 `shadcn` 的传递依赖。`shadcn/tailwind.css` 是当前网站样式构建依赖，不能直接卸载；`eslint-config-next` 的审计建议是降级到不兼容 Next 16 的旧大版本。未以破坏构建或禁用 lint 的方式压告警；这些包只在开发/构建阶段使用，生产静态页面不执行其代码。应随上游安全修复重新审计并升级。具体数量以本次 Task 最终 `npm audit` 结果为准。
