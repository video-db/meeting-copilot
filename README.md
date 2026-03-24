<!-- PROJECT SHIELDS -->
[![Electron][electron-shield]][electron-url]
[![Node][node-shield]][node-url]
[![React][react-shield]][react-url]
[![TypeScript][typescript-shield]][typescript-url]
[![License][license-shield]][license-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Website][website-shield]][website-url]

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://videodb.io/">
    <img src="https://codaio.imgix.net/docs/_s5lUnUCIU/blobs/bl-RgjcFrrJjj/d3cbc44f8584ecd42f2a97d981a144dce6a66d83ddd5864f723b7808c7d1dfbc25034f2f25e1b2188e78f78f37bcb79d3c34ca937cbb08ca8b3da1526c29da9a897ab38eb39d084fd715028b7cc60eb595c68ecfa6fa0bb125ec2b09da65664a4f172c2f" alt="Logo" width="300" height="">
  </a>

  <h1 align="center">Notter</h1>

  <p align="center">
    Real-time AI meeting assistant with live transcription, sentiment analysis, cue cards, and post-meeting summaries — powered by <a href="https://videodb.io">VideoDB</a>.
    <br />
    <a href="https://docs.videodb.io"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="#demo">View Demo</a>
    ·
    <a href="#download">Download</a>
    ·
    <a href="https://github.com/video-db/sales-copilot/issues">Report Bug</a>
  </p>
</p>

---

## Demo

https://github.com/user-attachments/assets/e3cd2dcc-d9ab-4f5f-8904-52c56133ed2d

## Download

- **Apple Silicon**: [sales-copilot-1.0.0-arm64.dmg](https://artifacts.videodb.io/sales-copilot/sales-copilot-1.0.0-arm64.dmg)
- **Apple Intel**: [sales-copilot-1.0.0.dmg](https://artifacts.videodb.io/sales-copilot/sales-copilot-1.0.0.dmg)

<p>
  <em>Currently available for macOS — Windows and Linux support coming soon</em>
</p>

---

## Installation (Pre-built App)

If you downloaded the pre-built app from the links above:

1. **Mount the DMG** and drag Notter to your Applications folder

2. **Remove quarantine attributes** to allow the app to run:
   ```bash
   xattr -cr /Applications/Meeting\ Copilot.app
   ```

3. **Launch the app** from Applications or Spotlight

4. **Grant system permissions** when prompted (Microphone and Screen Recording are required)

---

## Overview

Notter records your meetings and provides real-time insights while you talk. It captures screen, microphone, and system audio through VideoDB's capture SDK, runs dual-channel transcription (your mic vs. other participants' system audio), and feeds the conversation into a parallel analysis pipeline that produces sentiment scores, cue cards, nudges, talk ratio monitoring, and playbook tracking — all updated live during the meeting. When the meeting ends, it generates a structured summary with action items, objections, and risk assessment.

## Features

### Recording & Transcription
- **Screen & Audio Recording** - Capture screen, microphone, and system audio simultaneously
- **Real-time Transcription** - Live speech-to-text powered by VideoDB
- **Recording History** - Browse and review past recordings with full transcripts

### AI Notter
- **Cue Cards** - Context-aware prompts and talking points based on conversation
- **Sentiment Analysis** - Track participant sentiment throughout the meeting
- **Conversation Metrics** - Monitor talk ratio, speaking pace, questions asked, and more
- **Playbook Tracking** - Ensure you cover all discussion items with progress tracking
- **Nudges** - Timely reminders based on conversation context (e.g., "You haven't covered budget")
- **Meeting Summary** - AI-generated summary with key points, action items, objections, and risks
- **Bookmarking** - Mark important moments during meetings for easy reference
- **MCP Agent Support** - Connect MCP servers and let the app auto-trigger tool calls from conversation context
- **MCP Result Cards** - Inline tool outputs (including links) shown live during meetings

### Technical
- **Modern UI** - Built with React, Tailwind CSS, and shadcn/ui
- **Type-safe API** - End-to-end type safety with tRPC
- **Local Database** - SQLite with Drizzle ORM for offline-first storage
- **Secure Webhooks** - Cloudflare tunnel for receiving real-time transcription events

## Architecture

![Notter Architecture](assets/sales-copilot-architecture.png)

## How the Copilot Works

The copilot pipeline processes conversation in real-time through several parallel analyzers:

- **Dual-channel transcription** — Mic is labeled as "you", system audio as other participants. This separation powers all downstream analysis.
- **Sentiment analysis** — Tracks participant sentiment using pattern-based detection and optional LLM analysis. Sentiment is scored per transcript segment and trended over time.
- **Talk ratio monitoring** — Calculates the balance between your speaking time and others. Alerts when ratio drifts outside the ideal 40-60% range.
- **Cue card engine** — Detects objection types (pricing, competition, timing, authority) from participant speech and surfaces matching response suggestions in real-time.
- **Nudge engine** — Generates contextual alerts: monologue warnings when you've been talking too long, sentiment dip alerts when participant tone drops, and ratio alerts when conversation is one-sided.
- **Playbook tracker** — Tracks which discussion items from your playbook have been covered, showing completion percentage and highlighting gaps.
- **Post-meeting summary** — When the meeting ends, runs parallel extraction of action items, objections raised, competitive mentions, risks identified, and next steps.

## Tech Stack

- **Electron 34** - Desktop application shell
- **TypeScript 5.8** - Full type coverage
- **React 19** - Modern UI framework
- **Tailwind CSS** - Utility-first styling with Geist font
- **shadcn/ui** - High-quality component primitives
- **tRPC 11** - Type-safe API layer
- **Hono** - Fast HTTP server for webhooks
- **Drizzle ORM** - Type-safe database operations
- **Zustand** - Lightweight state management
- **Vite** - Fast frontend bundling
- **VideoDB SDK** - Screen recording and transcription (includes OpenAI-compatible API for LLM calls)

## Prerequisites

- **Operating System**: macOS 12+ (for screen recording features)
- **Node.js**: 18 or higher
- **npm**: 10 or higher
- **VideoDB API Key**: Sign up at [console.videodb.io](https://console.videodb.io)

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/video-db/notter.git
   cd notter
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild native modules for Electron:**
   ```bash
   npm run rebuild
   ```

4. **Start development mode:**
   ```bash
   npm run dev
   ```

5. **Register with your VideoDB API key** when the app opens

## MCP Server Setup

### Where to Configure

Open **Settings → MCP Servers** in the app.

### How to Add a Server

1. Click **Add Server**
2. Choose transport:
   - **stdio** (local command-based MCP server)
   - **http** (remote MCP endpoint)
3. Fill required fields (command/args/env or URL/headers)
4. Save and click **Connect**

### Triggering Behavior

- MCP agent runs automatically during active meetings when trigger keywords are detected in transcript context.
- You can customize trigger keywords from the MCP settings panel.
- Tool outputs appear in the **MCP Results** panel during the call.

### Capabilities

- Multiple MCP server connections
- Aggregated tool discovery across connected servers
- Auto-triggered tool execution from call context
- Live MCP result rendering (cards, markdown, links, structured fields)
- Result actions like pin/dismiss while in-meeting

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode (main + renderer) |
| `npm run build` | Build for production |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run rebuild` | Rebuild native modules for Electron |
| `npm run db:generate` | Generate database migration files |
| `npm run db:migrate` | Apply database migrations |

### Project Structure

```
src/
├── main/                   # Electron Main Process
│   ├── db/                 # Database layer (Drizzle + SQLite)
│   ├── ipc/                # IPC handlers
│   ├── lib/                # Utilities (logger, paths, permissions)
│   ├── server/             # HTTP server (Hono + tRPC)
│   │   ├── routes/         # Webhook routes
│   │   └── trpc/           # tRPC router and procedures
│   └── services/           # Business logic
│       ├── copilot/        # AI copilot services
│       │   ├── context-manager.service.ts
│       │   ├── conversation-metrics.service.ts
│       │   ├── cue-card-engine.service.ts
│       │   ├── nudge-engine.service.ts
│       │   ├── playbook-tracker.service.ts
│       │   ├── sales-copilot.service.ts
│       │   ├── sentiment-analyzer.service.ts
│       │   ├── summary-generator.service.ts
│       │   └── transcript-buffer.service.ts
│       ├── mcp/            # MCP orchestration and tool execution services
│       ├── llm.service.ts
│       ├── tunnel.service.ts
│       └── videodb.service.ts
├── preload/                # Preload scripts (IPC bridge)
├── renderer/               # React Frontend
│   ├── api/                # tRPC client
│   ├── components/         # UI components
│   │   ├── auth/           # Authentication modal
│   │   ├── copilot/        # Copilot UI components
│   │   ├── history/        # Recording history views
│   │   ├── layout/         # App layout (sidebar, titlebar)
│   │   ├── mcp/            # MCP results/status components
│   │   ├── recording/      # Recording controls
│   │   ├── settings/       # Settings editors
│   │   ├── transcription/  # Live transcription panel
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities
│   └── stores/             # Zustand state stores (session, copilot, mcp)
└── shared/                 # Shared types & schemas
    ├── schemas/            # Zod validation schemas
    └── types/              # TypeScript types
```

### IPC API

The app exposes IPC APIs through the preload script:

- `window.electronAPI.mcp.*` - MCP server and tool operations
- `window.electronAPI.mcpOn.*` - MCP event subscriptions

## Permissions (macOS)

The app requires the following permissions:
- **Microphone** - For voice recording
- **Screen Recording** - For screen capture

Grant these in **System Preferences > Privacy & Security**.

## Troubleshooting

### Recording not starting
- Verify VideoDB API key is registered (enter via registration modal on first launch)
- Check microphone and screen recording permissions in System Settings
- Try `npm run rebuild` to rebuild native modules

### Transcription not appearing
- Ensure both mic and system audio are enabled in recording settings
- Check that the Cloudflare tunnel is active (shown in recording status)
- Wait 5-10 seconds for first transcripts to appear

### Copilot features not updating
- Verify that transcription is working first
- Check that at least 2-3 transcript segments exist
- Some features (cue cards, nudges) require specific conversation patterns

### Build/Installation issues
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Rebuild native modules: `npm run rebuild`
- Check Node.js version: `node --version` (requires 18+)
- Review logs in `~/Library/Application Support/notter/logs/`

### Webhook delivery fails
- Cloudflare tunnel auto-creates on recording start
- Check internet connectivity
- Restart the recording to reinitialize tunnel

## Data Storage

Application data is stored in:
```
~/Library/Application Support/notter/
├── data/
│   └── notter.db    # SQLite database
└── logs/
    └── app-YYYY-MM-DD.log  # Daily log files
```

## Community & Support

- **Docs**: [docs.videodb.io](https://docs.videodb.io)
- **Issues**: [GitHub Issues](https://github.com/video-db/sales-copilot/issues)
- **Discord**: [Join community](https://discord.gg/py9P639jGz)
- **Console**: [Get API key](https://console.videodb.io)

---

<p align="center">Made with ❤️ by the <a href="https://videodb.io">VideoDB</a> team</p>

---

<!-- MARKDOWN LINKS & IMAGES -->
[electron-shield]: https://img.shields.io/badge/Electron-34-47848F?style=for-the-badge&logo=electron&logoColor=white
[electron-url]: https://www.electronjs.org/
[node-shield]: https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white
[node-url]: https://nodejs.org/
[react-shield]: https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black
[react-url]: https://reactjs.org/
[typescript-shield]: https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
[license-shield]: https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge
[license-url]: https://opensource.org/licenses/MIT
[stars-shield]: https://img.shields.io/github/stars/video-db/sales-copilot.svg?style=for-the-badge
[stars-url]: https://github.com/video-db/sales-copilot/stargazers
[issues-shield]: https://img.shields.io/github/issues/video-db/sales-copilot.svg?style=for-the-badge
[issues-url]: https://github.com/video-db/sales-copilot/issues
[website-shield]: https://img.shields.io/website?url=https%3A%2F%2Fvideodb.io%2F&style=for-the-badge&label=videodb.io
[website-url]: https://videodb.io/
