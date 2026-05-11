# XSS Test Fixtures

This file contains intentionally malicious Markdown patterns used to verify the sanitizer.

## javascript: scheme in links

[javascript:alert('xss')](javascript:alert('xss'))

[click me](javascript:void(0))

## vbscript: scheme

[vbscript](vbscript:MsgBox('xss'))

## data: URIs

[data uri](data:text/html,<script>alert(1)</script>)

![data image](data:image/svg+xml,<svg onload=alert(1)>)

## file: scheme

[file link](file:///etc/passwd)

## HTML event handlers

<img src="x" onerror="alert(1)">

<div onclick="alert('xss')">click</div>

<svg onload="alert('xss')">

## SVG with script

<svg><script>alert('svg-xss')</script></svg>

## Nested encoding tricks

[encoded js](&#106;avascript:alert(1))

[whitespace js](javascript\t:alert(1))

## Mixed safe and unsafe

[safe link](https://example.com)

[unsafe link](javascript:alert('xss'))

## Markdown image with script

![alt](javascript:alert('img-xss'))

## Object/embed tags

<object data="javascript:alert(1)"></object>

<embed src="javascript:alert(1)">
