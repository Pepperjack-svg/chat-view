# ChatView

A fast, private, browser-based chat viewer for **WhatsApp** and **Telegram** exported chats. No server. No uploads. Your data never leaves your device.

![ChatView](https://img.shields.io/badge/ChatView-v0.0.0-3b82f6?style=flat-square)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?style=flat-square&logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **100% client-side** — all parsing happens in the browser using the Web APIs
- **WhatsApp support** — parses both iOS (`[DD/MM/YY, H:MM:SS AM] Sender: msg`) and Android (`DD/MM/YY, H:MM - Sender: msg`) export formats
- **Telegram support** — parses `result.json` from Telegram Desktop exports (ZIP or raw JSON)
- **Media rendering** — images, videos, and audio files from `.zip` exports are displayed inline via Blob URLs
- **Clickable URLs** — hyperlinks in messages are detected and rendered as clickable anchors
- **Virtualised list** — only visible messages are rendered via `@tanstack/react-virtual`, making even 50,000-message chats smooth
- **Animated upload page** — GPU dithering shader background via `@paper-design/shaders-react`
- **Dark theme** — professional black & blue design system with Tailwind CSS v4
- **Per-sender colours** — deterministic colour assignment per sender name

---

## Supported Export Formats

| Platform  | Format                        | Media |
|-----------|-------------------------------|-------|
| WhatsApp  | `.zip` (exported with media)  | ✅ Inline display |
| WhatsApp  | `.txt` (text only)            | ⚠️ "Media omitted" placeholder |
| Telegram  | `.zip` (exported with media)  | ✅ Inline display |
| Telegram  | `result.json` (JSON only)     | ⚠️ No media |

### How to Export

**WhatsApp (iOS / Android)**
1. Open a chat → tap the contact name → **Export Chat**
2. Choose **"Attach Media"** for the `.zip` version or **"Without Media"** for `.txt`

**Telegram Desktop**
1. Open a chat → click the **⋮** menu → **Export Chat History**
2. Select JSON format and include media if needed
3. A folder is created — compress it as a `.zip` or upload `result.json` directly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 |
| Language | TypeScript 5.9 + JavaScript (JSX) |
| Styling | Tailwind CSS v4 + custom CSS |
| Shader | `@paper-design/shaders-react` |
| Virtualisation | `@tanstack/react-virtual` |
| ZIP parsing | `jszip` |
| Icons | `lucide-react` |
| Utilities | `clsx` + `tailwind-merge` |

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/chatview.git
cd chatview/chat-viewer-app

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

Output is placed in the `dist/` folder. Serve it with any static host (Vercel, Netlify, GitHub Pages, etc.).

```bash
# Preview the production build locally
npm run preview
```

---

## Project Structure

```
chat-viewer-app/
├── public/                     # Static assets
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   └── hero-dithering-card.tsx   # Upload page hero component
│   │   └── ChatViewer.jsx                # Virtualised chat renderer
│   ├── lib/
│   │   └── utils.ts                      # cn() utility (clsx + tailwind-merge)
│   ├── utils/
│   │   ├── whatsappParser.js             # WhatsApp TXT/ZIP parser + format dispatcher
│   │   ├── telegramParser.js             # Telegram JSON/ZIP parser
│   │   └── colors.js                     # Deterministic per-sender colour palette
│   ├── App.jsx                           # Root component (upload ↔ chat toggle)
│   ├── main.jsx                          # React entry point
│   └── index.css                         # Global styles + Tailwind directives
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

---

## Privacy

ChatView is **entirely client-side**. It does not:
- Send any data to a server
- Make any network requests with your chat content
- Store anything in localStorage or cookies

All file parsing, media extraction, and rendering happens locally in your browser tab.

---

## License

MIT © 2026
