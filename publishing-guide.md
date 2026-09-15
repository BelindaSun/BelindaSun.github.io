# 博客发布指南 · Blog Publishing Guide

给小缪（或任何接手发布工作的同事）的操作手册。
Written by 小德 (Claude), September 2026.

---

## 一、两个专栏的区别

| | Hello World（你好世界） | Hello Human（你好人类） |
|---|---|---|
| 内容 | Belinda 自己写的 | AI 们写的 |
| 副标题 | 无 | 有（文：XXX / By XXX） |
| Giscus 评论区 | **有** | **无** |
| 左栏高亮 | `hello-world-index.html` 加 `rail-on` | `hello-human-index.html` 加 `rail-on` |
| 模板参考 | hello-world-31.html | hello-human-30.html |

---

## 二、每篇文章要做的事（Checklist）

### 1. 创建文章文件（中文 + 英文 = 2 个文件）

以 `hello-world-32.html` 为例：

- [ ] 复制同专栏最新一篇作为模板
- [ ] 修改 `<title>` — 格式：`标题 — Belinda Sun`
- [ ] 修改 `<meta name="description">` — 格式：`标题 · 一句话简介`
- [ ] 修改 `<link rel="canonical">` — 指向自己的文件名
- [ ] 修改 `og:title`, `og:description`, `og:url` — 同上
- [ ] 修改 `twitter:title`, `twitter:description` — 同上
- [ ] 修改语言切换链接 — `rail-lang` 区域的中/EN 链接指向对应的中英文件
- [ ] 修改 `article-date` — 中文格式 `2026年9月12日`，英文格式 `September 12, 2026`
- [ ] 修改 `article-title`
- [ ] 如果是 Hello Human：修改 `article-subtitle`（文：XXX / By XXX）
- [ ] 替换 `article-body` 内容
- [ ] 修改 `article-nav`：prev 链接指向上一篇，next 写 `<span>未完待续</span>` / `<span>To be continued</span>`

**英文版额外注意：**
- `<html lang="en">`
- `<body class="lang-en">`
- `og:locale` 改为 `en_US`
- TTS 的 `u.lang = "en-US"`
- TTS 按钮文字：`🔊 Read aloud` / `⏸ Pause` / `▶ Resume`
- 如果有 giscus：`data-lang="en"`（中文版是 `data-lang="zh-CN"`）

### 2. 更新上一篇的导航

- [ ] 上一篇中文版：`未完待续` → `<a href="新文件.html">下一篇 →</a>`
- [ ] 上一篇英文版：`To be continued` → `<a href="新文件-en.html">Next →</a>`

### 3. 更新专栏目录页

**hello-world-index.html** 或 **hello-human-index.html**：

- [ ] 在 `post-list` 最顶部插入新条目，格式：
```html
<div class="post-item"><span class="post-num">32</span>
  <span class="post-main"><span class="post-title"><span data-lang="zh"><a href="hello-world-32.html">中文标题</a></span><span data-lang="en"><a href="hello-world-32-en.html">English Title</a></span></span></span>
  <span class="post-leader"></span><span class="post-date">Sep 12th, 2026</span></div>
```

注意：hello-human-index.html 的缩进风格略有不同（多两个空格），照着已有条目对齐即可。

### 4. 更新首页 Recent 列表

**index.html** 的 `<!-- RECENT -->` 区域：

- [ ] 在列表最顶部插入新条目
- [ ] 删除列表最底部的条目，**始终保持 8 条**
- [ ] 如果同时发多篇：后发表的排在前面（更靠顶部）

条目格式：
```html
<div class="post-item"><span class="post-col"><span data-lang="zh">你好世界</span><span data-lang="en">Hello World</span></span>
  <span class="post-title"><span data-lang="zh"><a href="hello-world-32.html">中文标题</a></span><span data-lang="en"><a href="hello-world-32-en.html">English Title</a></span></span>
  <span class="post-leader"></span><span class="post-date"><span data-lang="zh">2026.09.12</span><span data-lang="en">Sep 12, 2026</span></span></div>
```

### 5. 提交和推送

```bash
git add 新文件.html 新文件-en.html 上一篇.html 上一篇-en.html hello-world-index.html hello-human-index.html index.html
git commit -m "Add Hello World #32 中文标题 / English Title"
git push
```

---

## 三、特殊内容的 HTML 写法

| 源文本格式 | HTML |
|---|---|
| 普通段落 | `<p>内容</p>` |
| **加粗** | `<strong>内容</strong>` |
| 分隔线 | `<hr style="border:none;border-top:0.5px solid var(--border);margin:2.5rem 0;" />` |
| 小标题（### 标记） | `<h3>标题</h3>`（需要在 CSS 里加 h3 样式，见下方） |
| 引用块 | `<blockquote><p>内容</p></blockquote>` |
| 无序列表 | `<ul><li>条目</li></ul>` |
| 有序列表 | `<ol><li>条目</li></ol>` |
| 图片 | `<figure><img src="文件名.jpg" alt="描述"><figcaption>说明</figcaption></figure>` |
| 视频 | `<figure><video src="文件名.mp4" controls playsinline preload="metadata"></video><figcaption>说明</figcaption></figure>` |
| 结尾署名 | `<p class="closing">—— 署名</p>` |
| 换行不分段 | `<br/>` |

**如果文章用到了 h3 小标题**，需要在第二个 `<style>` 块（rail 样式那个）中加一行：
```css
.article-body h3 { font-family:var(--serif); font-size:1.15rem; font-weight:700; color:var(--accent); margin:2.5rem 0 1rem; }
```
位置：放在 `.article-body blockquote` 那行之后、`body > nav` 那行之前。

---

## 四、Giscus 评论区（仅 Hello World）

中文版：
```html
<div class="giscus" style="max-width: 800px; margin: 0 auto; padding: 0 2rem 3rem"></div>
<script src="https://giscus.app/client.js"
  data-repo="BelindaSun/BelindaSun.github.io"
  data-repo-id="R_kgDOSVl7Iw"
  data-category="Announcements"
  data-category-id="DIC_kwDOSVl7I84C8scG"
  data-mapping="pathname"
  data-strict="0"
  data-reactions-enabled="1"
  data-emit-metadata="0"
  data-input-position="bottom"
  data-theme="light"
  data-lang="zh-CN"
  crossorigin="anonymous"
  async></script>
```

英文版把 `data-lang="zh-CN"` 改为 `data-lang="en"`。

位置：放在 `</article>` 之后、`<div class="article-nav">` 之前。

CSS 里需要有 `.giscus { max-width: 800px !important; }`（Hello World 模板已自带）。

---

## 五、Web3Forms 留言模态框

每个页面末尾都有留言弹窗的脚本，**不需要修改**，直接从模板复制过来即可。

API Key：`1a2bceeb-4fca-4466-8494-dfc1dd9f562b`

---

## 六、常见坑

1. **别忘了英文版的 `<body class="lang-en">`** — 没有这个 class，页面会显示中文
2. **canonical URL 要改** — 否则 SEO 会指向模板原文
3. **语言切换链接要改** — rail-lang 区域的中/EN 链接必须指向当前文章的对应版本
4. **同日多篇的 Recent 排序** — 后发表的在上面
5. **Recent 列表永远 8 条** — 加几条就删几条（从底部删）
6. **Hello Human 没有 giscus** — 如果从 Hello World 模板复制，记得删掉 giscus 部分
7. **图片/视频文件** — 放在根目录或 `pic/` 目录下，文件名建议 `hello-world-32-1.jpg` 格式
