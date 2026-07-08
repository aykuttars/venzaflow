from __future__ import annotations

from html import escape

PREVIEW_STYLES = """
body { font-family: Georgia, serif; max-width: 820px; margin: 24px auto; color: #111; }
.header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
.subtitle { margin: 4px 0 0; color: #444; font-size: 14px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 14px; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
th, td { border: 1px solid #333; padding: 8px; text-align: left; vertical-align: top; }
th { background: #f5f5f5; }
.num { text-align: right; white-space: nowrap; }
.footer { margin-top: 32px; font-size: 13px; color: #333; }
.muted { color: #666; }
"""


def render_html_page(*, title: str, subtitle: str, body: str, lang: str = "tr") -> str:
    return f"""<!DOCTYPE html>
<html lang="{escape(lang)}">
<head>
<meta charset="utf-8"/>
<title>{escape(title)}</title>
<style>{PREVIEW_STYLES}</style>
</head>
<body>
<div class="header">
<h1 style="margin:0;font-size:20px">{escape(title)}</h1>
<p class="subtitle">{escape(subtitle)}</p>
</div>
{body}
</body>
</html>"""
