# 《什么是 AI Agent？》源代码 · Source for "What Is an AI Agent?"

Hello Human #37 的小电影，画面和音乐都是代码逐帧生成的。
The film for Hello Human #37. Every frame and every note is generated in code.

- `lib.js` · `world.js` · `story.js`：Canvas 画面、房间与城市、整部片的时间线 / picture, world, timeline
- `music.py`：配乐与音效（numpy 合成，按 `cues.json` 对齐画面）/ score + sound effects
- `render.js`：用 Chromium 逐帧渲染、ffmpeg 编码 / frame renderer

重做一遍 · To rebuild:

```bash
npm i @fontsource/noto-serif-sc @fontsource/caveat @fontsource/fraunces @fontsource/jetbrains-mono lxgw-wenkai-webfont playwright
node dump.js && python3 music.py          # cues.json -> score.wav
node render.js && node render.js v         # landscape + vertical segments
ffmpeg -f concat -safe 0 -i segs_h.txt -i score.wav -c:v copy -c:a aac -shortest film_h.mp4
```
