---
name: "Academic DOCX report formatting"
description: "Creates structured Word reports compliant with GOST 7.32-2017 and RTU MIREA academic formatting requirements."
---

# Academic DOCX report creation

Use `reports.docx` when the user asks for a report, coursework, practice report, or another academic Word document. Build the complete document in `blocks` and make one tool call. Do not send Markdown or HTML: document structure is expressed only through block types.

## Required call shape

```json
{
  "fileName": "practice-report",
  "template": "mirea-report-gost",
  "title": "Practice Report",
  "blocks": []
}
```

`fileName` may include or omit `.docx`. Use only the supported template `mirea-report-gost`. Use `title` only when a separate document title is required; it is rendered as a level-1 unnumbered heading.

## Heading blocks

Use `heading` with `level` 1, 2, or 3. Do not end heading text with a period. Set `numbered: false` for structural sections such as CONTENTS, INTRODUCTION, CONCLUSION, REFERENCES, and APPENDICES. Include the section number in `text` when the heading is numbered.

Level 1 example:

```json
{ "type": "heading", "level": 1, "text": "1 SYSTEM ANALYSIS", "numbered": true }
```

Level 2 example:

```json
{ "type": "heading", "level": 2, "text": "1.1 Subject area overview", "numbered": true }
```

Level 3 example:

```json
{ "type": "heading", "level": 3, "text": "1.1.1 Existing process limitations", "numbered": true }
```

Unnumbered section example:

```json
{ "type": "heading", "level": 1, "text": "INTRODUCTION", "numbered": false }
```

## Paragraph blocks

Use `paragraph` for body text. Every item in `paragraphs` becomes a separate indented paragraph. Do not insert newline characters to imitate paragraphs.

```json
{
  "type": "paragraph",
  "paragraphs": [
    "The purpose of this work is to analyse the existing information system and identify opportunities for improvement.",
    "The study covers the system architecture, data flows, and operational constraints."
  ]
}
```

## List blocks

Use `style: "bullet"` for unordered items. Write bullet items as sentence fragments starting with a lowercase letter; end intermediate items with semicolons and the last item with a period.

```json
{
  "type": "list",
  "style": "bullet",
  "items": [
    "collection of source requirements;",
    "analysis of the current process;",
    "preparation of the final recommendations."
  ]
}
```

Use `style: "numbered"` for ordered steps. Start each item with a capital letter and end it with a period.

```json
{
  "type": "list",
  "style": "numbered",
  "items": [
    "Collect the initial data.",
    "Validate the collected information.",
    "Prepare the final report."
  ]
}
```

## Table blocks

Use `table` for tabular data. `headers` defines the columns, and every array in `rows` must contain exactly the same number of values. Supply `number` in section-based form such as `2.1`. The renderer adds the word “Table” and the separator, so provide only the caption text in `title` and do not end it with a period.

```json
{
  "type": "table",
  "number": "2.1",
  "title": "Comparison of implementation options",
  "headers": ["Option", "Advantages", "Limitations"],
  "rows": [
    ["Desktop application", "Offline operation", "Platform-dependent delivery"],
    ["Web application", "Centralised updates", "Requires network access"]
  ]
}
```

## Code blocks

Use `code` for source code or configuration listings. Keep the original line breaks in `content`. Supply only the caption in `title`; the renderer adds the listing label.

```json
{
  "type": "code",
  "number": "3.1",
  "title": "Application entry point",
  "language": "typescript",
  "content": "export function main(): void {\n  console.log(\"Started\");\n}"
}
```

## Page breaks

Use `pageBreak` before an appendix or another section that must explicitly start on a new page. Level-1 headings already start on a new page, so do not add a redundant page break immediately before them.

```json
{ "type": "pageBreak" }
```

## Complete example

```json
{
  "fileName": "information-system-report.docx",
  "template": "mirea-report-gost",
  "blocks": [
    { "type": "heading", "level": 1, "text": "INTRODUCTION", "numbered": false },
    { "type": "paragraph", "paragraphs": ["The report describes the results of the completed practical work."] },
    { "type": "heading", "level": 1, "text": "1 SYSTEM ANALYSIS", "numbered": true },
    { "type": "heading", "level": 2, "text": "1.1 Requirements", "numbered": true },
    { "type": "list", "style": "bullet", "items": ["reliable data storage;", "controlled access;", "auditable operations."] },
    { "type": "table", "number": "1.1", "title": "System requirements", "headers": ["Requirement", "Priority"], "rows": [["Data integrity", "High"], ["Availability", "Medium"]] },
    { "type": "code", "number": "1.1", "title": "Configuration example", "language": "json", "content": "{\n  \"enabled\": true\n}" },
    { "type": "heading", "level": 1, "text": "CONCLUSION", "numbered": false },
    { "type": "paragraph", "paragraphs": ["The objectives of the work were achieved."] }
  ]
}
```

The template applies A4 paper, 30/10/20/20 mm margins, Times New Roman 14 pt body text, 1.5 line spacing, and a 1.25 cm first-line indent. Heading levels 1/2/3 use 18/16/14 pt bold text. Table captions are placed above tables. Code listings use a monospaced font and a caption.

After the tool succeeds, return the generated `path` to the user. Do not claim that a file was created unless the tool returned successfully.
