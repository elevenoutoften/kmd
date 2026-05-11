# GFM Test Fixture

This file exercises GitHub Flavored Markdown features.

## Tables

| Feature | Priority | Notes |
| --- | ---: | --- |
| GFM baseline | P0 | Tables, tasks, footnotes, autolinks |
| GitHub alerts | P1 | Note, Tip, Important, Warning, Caution |
| Mermaid | P1 | Sandboxed renderer |
| Math | P1 | KaTeX preferred |

Alignment test:

| Left | Center | Right |
| :--- | :----: | ----: |
| a | b | c |
| long text | middle | 999 |

## Task Lists

- [x] Implement parser
- [x] Add GFM support
- [ ] Add Mermaid
- [ ] Add math support

Nested:

- [ ] Parent task
  - [x] Subtask A
  - [ ] Subtask B

## Footnotes

Here is a sentence with a footnote.[^1] And another with two.[^2]

[^1]: This is the first footnote with **bold** and `code`.
[^2]: Second footnote.

    Multi-paragraph footnotes are supported too.

## Strikethrough

~~This text is deleted.~~ And ~~this too~~.

## Autolinks

URL autolink: https://github.com

Email autolink: contact@example.com

## Nested Lists

1. First
2. Second
   - Nested bullet
   - Another bullet
     - Deep nested
3. Third
   1. Ordered sub-item
   2. Another ordered sub-item

## Blockquotes

> Single blockquote paragraph.

> Nested blockquote:
> > This is nested inside.
>
> Back to outer level.

> > Double nested from start.

## Escaping

\*not italic\* and \`not code\`

## HTML (should be sanitized)

<script>alert("xss")</script>
<img src="x" onerror="alert(1)">
<a href="javascript:alert(1)">click me</a>
<a href="https://safe.example.com">safe link</a>
