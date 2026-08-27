// 构建后处理:把 dist/**/*.html 里的 <link rel="stylesheet"> 原位替换为内联 <style>,
// 并删除已无引用的 css 产物。全部样式合起来 ~42KB(<typical first-visit RTT 的代价),
// 内联后首帧零请求、零阻塞、零闪烁。(qwik beta 的 inlineStylesUpToBytes 对此未生效)
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '../dist')
const link = /<link\b[^>]*\brel="stylesheet"[^>]*>/g
const href = (tag) => tag.match(/href="([^"]+)"/)?.[1]

const inlined = new Set()
for (const p of readdirSync(dist, { recursive: true })) {
  if (!p.endsWith('.html')) continue
  const f = join(dist, p)
  const html = readFileSync(f, 'utf8')
  const next = html.replace(link, (tag) => {
    const h = href(tag)
    if (!h) return tag
    inlined.add(h)
    return `<style data-src="${h}">${readFileSync(join(dist, h.slice(1)), 'utf8')}</style>`
  })
  if (next !== html) writeFileSync(f, next)
}

for (const h of inlined) {
  try {
    unlinkSync(join(dist, h.slice(1)))
  } catch {
    // 已不在磁盘上则忽略
  }
}
console.log(`inline-css: ${inlined.size} stylesheet(s) inlined`)
