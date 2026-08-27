# foyer-web

Qwik v2(beta)+ TS + Vite。构建产物为纯静态 HTML/CSS/JS,由仓库根目录的 Go 二进制
`go:embed` 后直接伺服(`/`、`/status`、`/admin` 走干净链接回退)。

## 结构

- `src/routes/` 三条路由:`index.tsx`(面板)、`status/`(监控)、`admin/`(管理台)
- `src/components/` 页面级组件,目录式聚合(`name/name.tsx + name.module.css`)
- `src/lib/` 类型 / 格式化 / sessionStorage 缓存 / 错误翻译 / 暗色图标判定
- `src/styles/` 设计令牌(tokens)与全局基线(base)/ UI 原语(ui),经 `src/global.css` 汇入
- `adapters/ssg/vite.config.ts` 静态生成适配器(官方 ssgAdapter 模板)

## 约定

- 组件样式一律 CSS Modules(`*.module.css`),类名驼峰;跨组件原语(`btn`/`input`
  /`card`/`dot`… 与 `mono`)在 `styles/ui.css` 全局提供,不进模块
- 浏览器副作用(EventSource、轮询、sessionStorage、焦点管理)收敛在
  `useVisibleTask$`,SSG 构建期不会执行;纯派生用 `useComputed$`
- API 一律相对路径,dev 由 vite 代理到 `127.0.0.1:3002`(Go: `FOYER_DEV=1 go run .`)

## 常用命令

```sh
bun install
bun run dev            # SSR dev(:5173),需另起 FOYER_DEV=1 go run .
bun run build          # 客户端产物 + SSG → dist/
bun run check          # tsc --noEmit
```

部署走仓库根目录 `./deploy.sh gxd`(先前端构建再编译 Go 嵌入)。
