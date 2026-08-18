---
name: publish-article
description: Publish a new article to belindasun.github.io from a zh + en text pair — duplicate the column template, place images into pic/, and register the post on its section index and the homepage Recent list. Use when the user hands over a my-life / hello-world / hello-human / yesterthoughts .txt (+ -en.txt) and asks to process, commit, and push it.
---

# Publish a new article

Hand-authored static site, no build step. Every post is a **pair**: `<column>-N.html` (`lang="zh"`) and `<column>-N-en.html` (`lang="en"`), served from repo root. Columns: `my-life`, `hello-world`, `hello-human`, `yesterthoughts`. Images live in `pic/`.

**Golden rule: never write a page from scratch. Copy the previous post in the same column and swap content.** That preserves nav, text-size control, TTS, music, giscus, the leave-a-note modal, and the 中/EN toggle.

## Inputs
- `<column>-N.txt` (Chinese) and `<column>-N-en.txt` (English). N = next number in the column.
- Zero or more images. In the text the author marks placement inline, e.g. `(my-life-3-1.JPG)` or `(insert pic my-life-3-1.JPG)`. Image files are usually in `~/Downloads/` with the target name already.

## Steps

### 1. Pick the template = the current highest-numbered post in that column
```bash
ls <column>-*.html | sort -V | tail        # find N-1 (the newest zh + en pair)
cp <column>-<N-1>.html   <column>-<N>.html
cp <column>-<N-1>-en.html <column>-<N>-en.html
```

### 2. Copy images into pic/ (keep the author's exact filenames)
```bash
cp ~/Downloads/<column>-<N>-1.JPG pic/
```

### 3. Swap metadata + links (run on BOTH files; -en gets English strings)
In each file replace, using the OLD post's values as the search text:
- `<title>` / `og:title` / `twitter:title` → `新标题 — Belinda Sun` (zh) / `New Title — Belinda Sun` (en)
- `name="description"` / `og:description` / `twitter:description` → new one-line blurb
- `canonical` + `og:url` → `https://belindasun.github.io/<column>-<N>.html` (and `-en.html`)
- rail-lang links (bottom of the left rail): point `中`→`<column>-<N>.html`, `EN`→`<column>-<N>-en.html`; keep `rail-lang-on` on the current language
- prev/next nav near the footer: set `← 上一篇 / ← Previous` to `<column>-<N-1>...`; the old post's `未完待续 / To be continued` can become a forward link `下一篇 → / Next →` to the new post

### 4. Article header
- `.article-date` → the date at the bottom of the .txt (zh: `2026年8月11日`; en: `August 11th 2026`)
- `.article-title` → new title
- If the .txt has a subtitle line, add `<p class="article-subtitle">…</p>` right after the title. **If the template lacks `.article-subtitle` CSS, add it** (the en file often does): put it in the reskin `<style>` block near `article, .article-nav { max-width: 800px; }`:
  ```css
  .article-subtitle { font-size:.9rem; color:var(--text-muted); margin:-.2rem 0 1.4rem; font-style:italic; }
  ```

### 5. Article body — replace everything inside `<div class="article-body" id="articleBody"> … </div>`
- One `<p>` per paragraph. Keep the author's emoji and punctuation verbatim; do not paraphrase.
- Dialogue / quoted AI replies → `<div class="dialogue"><p>…</p></div>`.
- Drafted posts, tweets, block quotes → `<blockquote>…</blockquote>` (use `<br />` for internal line breaks).
- Section breaks in en posts → `<span class="scene-break">⸻</span>`.
- Sign-off (`Belinda` + date) → `<p class="byline">Belinda<br />…</p>`.
- **Images**: at the marked spot insert
  ```html
  <figure><img src="pic/<file>" alt="descriptive alt" width="100%" /></figure>
  ```
  Remove the `(filename)` marker text from the prose. If the template lacks image CSS, add to the reskin `<style>`:
  ```css
  .article-body img { max-width:100%; height:auto; margin:1.6rem 0; border-radius:12px; display:block; }
  .article-body figure { margin:1.6rem 0; }
  ```

For a large body swap, write the new inner HTML to a scratch file and replace the block with a small Python `re.subn` (anchor: `<div class="article-body" id="articleBody">` … `</div>\n</article>` or `</div>\n    </article>`) — assert exactly 1 match.

### 6. Register the post (so it's linked from the site)
- **Section index** `<column>-index.html`: add a `.post-item` at the TOP of `.post-list` with num `0N`, both-language titles, and the date. Copy the shape of the existing top item.
- **Homepage** `index.html`: add a `.post-item` to the `<!-- SELECTED -->`-preceding **最新 / Recent** `.post-list`, inserted in date order; drop the oldest so the list stays ~4 items. Date format there is `2026.08.11` (zh) / `Aug 11, 2026` (en), and each item carries a `.post-col` column tag.

### 7. Verify, then commit + push
```bash
# leftover template text from the OLD post must be gone (expect 0):
grep -c "<distinctive phrase from previous post body>" <column>-<N>.html <column>-<N>-en.html
python3 -c "from PIL import Image; print(Image.open('pic/<file>').size)"   # image is valid
```
Also load `file://…/<column>-<N>.html` in the browser and screenshot to confirm layout (the pan photo may show broken in the sandbox preview — that's a preview-only limitation, verify the file+path instead).

```bash
git add <column>-<N>.html <column>-<N>-en.html <column>-<N-1>.html <column>-<N-1>-en.html <column>-index.html index.html pic/<file>
git commit -m "Add <Column> #N <zh title> / <en title>"
git push origin main
```
End the commit body with:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Gotchas
- Keep giscus `data-lang` as `zh-CN` in the zh file, `en` in the en file (already correct after the copy — don't touch).
- The 10 standalone game/tool pages have no site nav; never touch them.
- Don't invent a subtitle, don't translate/rewrite body text, don't reorder the author's paragraphs.
