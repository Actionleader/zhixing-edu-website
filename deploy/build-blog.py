#!/usr/bin/env python3
"""
Build blog HTML pages from CMS markdown files.
Reads content/blog/*.md, converts to blog/articles/*.html,
and updates blog/index.html with article cards.
"""
import re
import os
import sys
import json
from datetime import datetime

SITE_DIR = "/var/www/actionleader.com.hk"
CONTENT_DIR = os.path.join(SITE_DIR, "content/blog")
ARTICLES_DIR = os.path.join(SITE_DIR, "blog/articles")
BLOG_INDEX = os.path.join(SITE_DIR, "blog/index.html")


def parse_frontmatter(text):
    """Parse YAML-like frontmatter from markdown text."""
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta = {}
    for line in parts[1].strip().split("\n"):
        line = line.strip()
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            meta[key] = val
    return meta, parts[2].strip()


def md_to_html(md_text):
    """Simple markdown to HTML converter."""
    lines = md_text.split("\n")
    html_parts = []
    i = 0
    in_list = False

    while i < len(lines):
        line = lines[i]

        # Blank line
        if not line.strip():
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            i += 1
            continue

        # Headers
        m = re.match(r"^(#{1,6})\s+(.+)$", line)
        if m:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            level = len(m.group(1))
            html_parts.append(f"<h{level}>{m.group(2)}</h{level}>")
            i += 1
            continue

        # Unordered list
        m = re.match(r"^[-*+]\s+(.+)$", line)
        if m:
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            html_parts.append(f"<li>{inline_md(m.group(1))}</li>")
            i += 1
            continue

        # Ordered list
        m = re.match(r"^\d+\.\s+(.+)$", line)
        if m:
            if not in_list:
                html_parts.append("<ol>")
                in_list = True
            html_parts.append(f"<li>{inline_md(m.group(1))}</li>")
            i += 1
            continue

        # Horizontal rule
        if re.match(r"^[-*_]{3,}$", line.strip()):
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append("<hr>")
            i += 1
            continue

        # Blockquote
        if line.startswith(">"):
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            content = re.sub(r"^>\s*", "", line)
            html_parts.append(f"<blockquote>{inline_md(content)}</blockquote>")
            i += 1
            continue

        # Regular paragraph
        if in_list:
            html_parts.append("</ul>")
            in_list = False
        html_parts.append(f"<p>{inline_md(line)}</p>")
        i += 1

    if in_list:
        html_parts.append("</ul>")

    return "\n".join(html_parts)


def inline_md(text):
    """Handle inline markdown: bold, italic, links, images, code."""
    # Images: ![alt](url)
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img src="\2" alt="\1" style="max-width:100%;border-radius:8px;margin:1em 0;">', text)
    # Links: [text](url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    # Bold: **text** or __text__
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"__(.+?)__", r"<strong>\1</strong>", text)
    # Italic: *text* or _text_
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"_(.+?)_", r"<em>\1</em>", text)
    # Inline code: `text`
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text


def generate_article_html(meta, body_html):
    """Generate full article HTML page using the template."""
    title = meta.get("title", "Untitled")
    date_str = meta.get("date", "")
    excerpt = meta.get("excerpt", "")
    tags = meta.get("tags", "")

    # Parse date for display
    try:
        dt = datetime.fromisoformat(date_str.replace("+08:00", "").replace("Z", ""))
        display_date = dt.strftime("%Y年%m月%d日")
        iso_date = dt.strftime("%Y-%m-%d")
    except:
        display_date = date_str
        iso_date = date_str[:10] if len(date_str) >= 10 else date_str

    # Read template
    template_path = os.path.join(ARTICLES_DIR, "_template.html")
    if os.path.exists(template_path):
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
        # Replace template placeholders (template uses [REPLACE_...] format)
        html = template.replace("[REPLACE_ARTICLE_TITLE]", title)
        html = html.replace("[REPLACE_ARTICLE_DESCRIPTION]", excerpt)

        # Generate slug from title
        import unicodedata
        slug = re.sub(r"[^\w\-]", "-", title.lower().replace(" ", "-"))
        slug = re.sub(r"-+", "-", slug).strip("-")[:60]
        html = html.replace("[REPLACE_ARTICLE_SLUG]", slug)

        html = html.replace("[REPLACE_DATE_YYYY-MM-DD]", iso_date)
        html = re.sub(r"\[REPLACE_DATE_YYYY年MM月DD日\]", display_date, html)

        # Replace the entire article content section (between <div class="article-content"> and <!-- ==== END ARTICLE CONTENT ==== -->)
        html = re.sub(
            r'(<div class="article-content">).*?(<!-- ==== END ARTICLE CONTENT ==== -->)',
            f'\\1\n{body_html}\n          \\2',
            html,
            flags=re.DOTALL,
        )

        # Clean up any remaining [REPLACE_...] placeholders
        html = re.sub(r"\[REPLACE_[^\]]+\]", "", html)

        # Fix share URL with the correct slug
        html = html.replace("[REPLACE_ARTICLE_SLUG]", slug)
        # Fix breadcrumb short title
        html = html.replace("[REPLACE_ARTICLE_TITLE_SHORT]", title[:15] + "..." if len(title) > 15 else title)

        # Fix JSON-LD dates
        html = html.replace("[REPLACE_DATE_YYYY-MM-DD]", iso_date)

        return html
    else:
        # Fallback: basic HTML wrapper
        return f"""<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | 知行教育中心</title>
  <link rel="stylesheet" href="../../assets/css/main.css">
  <link rel="stylesheet" href="../../assets/css/components.css">
  <link rel="stylesheet" href="../../assets/css/blog.css">
</head>
<body>
<main><div class="page-wrapper">
  <article class="blog-article">
    <header class="blog-article__header">
      <div class="blog-article__date">{display_date}</div>
      <h1>{title}</h1>
      <p class="blog-article__excerpt">{excerpt}</p>
    </header>
    <div class="blog-article__body">
      {body_html}
    </div>
  </article>
</div></main>
</body>
</html>"""


def generate_article_card(meta, slug):
    """Generate an article card HTML snippet for the blog index."""
    title = meta.get("title", slug)
    date_str = meta.get("date", "")
    excerpt = meta.get("excerpt", "")
    tags = meta.get("tags", "")

    try:
        dt = datetime.fromisoformat(date_str.replace("+08:00", "").replace("Z", ""))
        display_date = dt.strftime("%Y年%m月%d日")
    except:
        display_date = date_str

    tags_html = ""
    if tags:
        tags_html = "\n".join([f'                <span class="tag">{t.strip()}</span>' for t in tags.split(",")])

    return f"""          <article class="blog-card" style="display:flex;flex-direction:row;gap:0;">
            <div class="blog-card__body">
              <div class="blog-card__date">{display_date}</div>
              <h3><a href="articles/{slug}.html">{title}</a></h3>
              <p class="blog-card__excerpt">{excerpt}</p>
              <div style="margin-top:0.5em;">
{tags_html}
              </div>
            </div>
          </article>"""


def update_blog_index(articles):
    """Update blog/index.html with new article cards."""
    with open(BLOG_INDEX, "r", encoding="utf-8") as f:
        content = f.read()

    # Find the marker where articles are inserted
    marker = "<!-- More articles will be added here as they are published -->"
    if marker not in content:
        # Find the closing of the blog-grid div
        alt_marker = '<div class="blog-grid" style="grid-template-columns:1fr;">'
        if alt_marker in content:
            # Find the last </article> before the closing </div> and placeholder
            pass
        print(f"  WARNING: Could not find article insertion marker in {BLOG_INDEX}")
        print(f"  Please add this comment where articles should be inserted:")
        print(f"  <!-- More articles will be added here as they are published -->")
        return False

    # Generate cards for all articles
    cards = []
    for a in articles:
        cards.append(generate_article_card(a["meta"], a["slug"]))

    new_cards = "\n\n".join(cards)

    # If marker exists, insert cards before it
    if marker in content:
        # Check if there are already dynamically inserted cards
        dyn_marker = "<!-- DYNAMIC ARTICLES START -->"
        dyn_end = "<!-- DYNAMIC ARTICLES END -->"
        if dyn_marker in content and dyn_end in content:
            # Replace existing dynamic section
            content = re.sub(
                f"{dyn_marker}.*?{dyn_end}",
                f"{dyn_marker}\n{new_cards}\n          {dyn_end}",
                content,
                flags=re.DOTALL,
            )
        else:
            # Insert before marker with dynamic markers
            content = content.replace(
                marker,
                f"<!-- DYNAMIC ARTICLES START -->\n{new_cards}\n          <!-- DYNAMIC ARTICLES END -->\n          {marker}",
            )

    with open(BLOG_INDEX, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def main():
    print(f"[build-blog] Starting at {datetime.now().isoformat()}")
    print(f"  Content dir: {CONTENT_DIR}")
    print(f"  Articles dir: {ARTICLES_DIR}")
    print(f"  Blog index: {BLOG_INDEX}")

    if not os.path.isdir(CONTENT_DIR):
        print(f"  SKIP: content/blog/ does not exist yet")
        return

    # Find all .md files
    md_files = sorted([f for f in os.listdir(CONTENT_DIR) if f.endswith(".md")])
    if not md_files:
        print(f"  No .md files found in {CONTENT_DIR}")
        return

    print(f"  Found {len(md_files)} .md file(s)")

    articles = []
    for md_file in md_files:
        md_path = os.path.join(CONTENT_DIR, md_file)
        # Generate safe ASCII slug from filename: extract date + create transliterated slug
        base = md_file.replace(".md", "")
        # Extract date prefix if present (YYYY-MM-DD-)
        date_match = re.match(r"^(\d{4}-\d{2}-\d{2})-", base)
        date_prefix = date_match.group(1) if date_match else ""
        # Generate ASCII-safe slug: strip non-ASCII, keep only word chars and hyphens
        safe_slug = re.sub(r"[^\x00-\x7F]", "", base)  # remove non-ASCII
        safe_slug = re.sub(r"[^\w\-]", "", safe_slug.lower().replace(" ", "-"))
        safe_slug = re.sub(r"-+", "-", safe_slug).strip("-")
        # If slug is mostly empty (Chinese chars stripped), use date + hash
        if len(safe_slug) < 5:
            import hashlib
            short_hash = hashlib.md5(base.encode()).hexdigest()[:8]
            safe_slug = f"{date_prefix}-article-{short_hash}" if date_prefix else f"article-{short_hash}"
        else:
            safe_slug = safe_slug[:60]
        html_file = f"{safe_slug}.html"
        html_path = os.path.join(ARTICLES_DIR, html_file)

        # Read markdown
        with open(md_path, "r", encoding="utf-8") as f:
            md_content = f.read()

        # Parse frontmatter and body
        meta, body_md = parse_frontmatter(md_content)
        body_html = md_to_html(body_md)

        # Generate and write HTML
        html = generate_article_html(meta, body_html)
        os.makedirs(ARTICLES_DIR, exist_ok=True)
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)

        print(f"  -> {html_file} ({len(html)} bytes)")

        articles.append({"meta": meta, "slug": safe_slug})

    # Update blog index (newest first)
    articles.reverse()
    if update_blog_index(articles):
        print(f"  Updated blog/index.html with {len(articles)} article(s)")

    print(f"[build-blog] Done.")


if __name__ == "__main__":
    main()
