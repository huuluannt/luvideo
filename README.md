# ▶ LuVideo

A minimal, beautiful YouTube mini app. Search, watch, autoplay — nothing more.

**Live demo:** https://luvideo.vercel.app/

---

## Features

- 🔍 YouTube video search
- ▶ Embedded YouTube player
- ⟳ Autoplay next video
- ⏮⏭ Previous / Next controls
- 💾 Remembers your API key & autoplay preference (localStorage)
- 📱 Responsive (mobile + desktop)

---

## Setup

### 1. Get a YouTube Data API v3 Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable **YouTube Data API v3**
4. Create credentials → **API Key**
5. (Optional) Restrict key to your domain for security

### 2. Run Locally

No build step needed — plain HTML/CSS/JS.

```bash
git clone https://github.com/huuluannt/luvideo.git
cd luvideo

# Option A: VS Code Live Server
# Option B: Python
python3 -m http.server 3000

# Open http://localhost:3000
```

Enter your API key when prompted on first launch.

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo to Vercel for automatic deploys.

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- YouTube IFrame Player API
- YouTube Data API v3
- Zero dependencies, zero build step

---

## Project Structure

```
luvideo/
├── index.html    # App shell & markup
├── style.css     # All styles (dark theme, animations)
├── app.js        # Search, player, autoplay logic
└── README.md
```

---

## Notes

- The API key is stored in `localStorage` — it never leaves your browser
- YouTube Data API v3 has a free quota of 10,000 units/day (sufficient for personal use)
- No backend, no server — pure static site
