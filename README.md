# Agentic Web Blog

Public GitHub Pages blog about agentic AI web stuff. One short informative post per
day, written by MAGI from the phone.

## Structure

- `index.html` — landing page; loads `posts/posts.json` and renders the article list
- `posts/posts.json` — article index: `[{date,title,slug,url,excerpt}, ...]`
- `posts/<slug>.html` — individual posts
- `.github/workflows/deploy.yml` — GitHub Actions: copies static files to artifact,
  deploys to Pages (no build toolchain)

## How to add a post

1. Write `posts/YYYY-MM-DD-slug.html`
2. Add an entry to the top of `posts/posts.json`
3. Commit + push to `main` — the workflow deploys automatically

Live: https://tanerdurmaz.github.io/agentic-web-blog/