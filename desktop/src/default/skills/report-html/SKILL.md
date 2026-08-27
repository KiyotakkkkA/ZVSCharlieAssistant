---
name: "report-html"
description: "Creates a single, self-contained HTML report or document that opens and reads well in any browser, with the design effort calibrated to what the request actually needs."
---

# HTML report creation

Use this skill when the user asks for a report, summary, overview, or reference document that should be delivered as an HTML page rather than a Word document or a chat reply. Prefer `reports_docx` instead when the user names GOST, MIREA, or another academic Word template specifically.

The result is one `.html` file, opened locally in a browser (`file://`), not a page hosted on a server. Everything the page needs — CSS, JavaScript, fonts, images — must live inside that one file.

## Procedure

1. Gather the real content first: figures, sections, tables. Never invent numbers, quotes, or filler text to fill space.
2. Decide the destination path. Save into a directory already permitted for this conversation — the same one the user's source files live in, or the one already in use for this task. Ask only when no such directory exists yet.
3. Choose a design level proportional to the deliverable (see below).
4. Write the complete HTML in one pass, then save it with `fs_write` for a short file, or with `fs_write_begin` → `fs_write_chunk` (repeated) → `fs_write_commit` once the content passes roughly 6000 characters.
5. Report the saved path back to the user in one short sentence.

## Calibrating the design level

Not every report deserves the same visual effort. Match it to the request:

- **Quick / internal** ("just dump this into a page", "so I can glance at it"): plain structure, system font stack, a single accent color, no illustrations. Minutes of work, not hours.
- **Standard report** (the default when nothing else is signaled): a clear heading hierarchy, one deliberate color palette, comfortable spacing and line length, tables and code blocks that actually look designed rather than raw HTML defaults.
- **Presentation-grade** (the user will show this to other people, print it, or asked for something polished): the above, plus real typographic care (a considered heading scale, generous whitespace, one or two well-chosen typefaces), and small inline SVG graphics or a simple `<canvas>`/SVG chart only where there is real data to visualize.

In every case, content density beats decoration: a report padded with empty cards, icon soup, or a hero section that says nothing is worse than a plain, well-organized page. Never add a feature (a chart, a filter, a collapsible section) the content does not need.

## Hard technical rules

- One file. No `<link rel="stylesheet" href="...">` to a separate file, no `<script src="...">` pointing outside the document. Inline all CSS in a single `<style>` block and all JavaScript in a single `<script>` block.
- No network dependencies. Do not reference a CDN, a web font service, or any other external URL — opened offline or on a machine with restricted network access, the page must still render exactly as intended. Use the system font stack (`system-ui, -apple-system, "Segoe UI", sans-serif` or a plain serif equivalent) unless the user supplied a font file to embed as a `data:` URI.
- Wide content (tables, code, long unbroken values) scrolls inside its own `overflow-x: auto` container. The page body itself must never scroll horizontally.
- Pick one coherent light-mode look and commit to it — this is a private local file, not a page other people load in their own browser theme, so a dark-mode media query is not required. Avoid pure `#000`/`#fff` for body text on background; use a slightly softened pair for comfortable reading.
- Use `<table>` for tabular data and semantic headings (`<h1>`–`<h3>`) for structure, not styled `<div>` stacks that only look like a table or a heading.
- State only what the source material supports. A number, a date, or a name the user did not provide does not belong in the report, however natural it would look filled in.

## Required call shape (short report)

```json
{
  "path": "C:\\Projects\\Example\\weekly-summary.html",
  "content": "<!doctype html>\n<html lang=\"ru\">\n<head>\n<meta charset=\"utf-8\">\n<title>Недельная сводка</title>\n<style>\n:root{--bg:#ffffff;--fg:#1c1e21;--accent:#2f6f4f;}\nbody{background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;max-width:760px;margin:0 auto;padding:2.5rem 1.5rem;line-height:1.6;}\nh1{font-size:1.6rem;border-bottom:2px solid var(--accent);padding-bottom:.4rem;}\ntable{border-collapse:collapse;width:100%;}\nth,td{border:1px solid #d8dbe0;padding:.5rem .7rem;text-align:left;}\n.scroll{overflow-x:auto;}\n</style>\n</head>\n<body>\n<h1>Недельная сводка</h1>\n<p>Здесь идёт реальное содержимое отчёта.</p>\n</body>\n</html>"
}
```

For a report longer than roughly 6000 characters, start with `fs_write_begin` (`path` only), send the HTML in ordered `fs_write_chunk` calls of up to 6000 characters each using the returned `sessionId` and `nextSequence`, and finish with `fs_write_commit`. Never split content mid-tag across chunk boundaries in a way that would corrupt an attribute.

## Language

Write the report in the language the user used for the request, or the language they explicitly asked for — unlike the agent- and skill-creation skills, there is no fixed interface language here.

## Failure modes

- A separate `.css` or `.js` file next to the HTML file — everything belongs inside the one document.
- A `<link>` or `<script src>` pointing at a CDN, which silently produces a blank, broken page offline.
- Placeholder numbers, "Lorem ipsum" text, or invented data points left in the final file.
- A wide table that pushes the whole page into horizontal scroll instead of scrolling only its own container.
- Heavy visual production (animations, gradients, multiple accent colors, decorative icons) applied to a report the user asked to keep quick and simple.
