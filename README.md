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
  <a href="https://github.com/video-db/call.md">
    <img src="resources/wordmark-color-black-bg.png" alt="Call.md Logo" width="300" height="">
  </a>

  <h1 align="center">Call.md</h1>

  <p align="center">
    Turn meetings into live agent loops. Record, transcribe, and analyze meetings with real-time AI intelligence — before, during, and after calls.
    <br />
    <a href="https://docs.videodb.io"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="#demo">View Demo</a>
    ·
    <a href="#quick-install">Install</a>
    ·
    <a href="https://github.com/video-db/call.md/issues">Report Bug</a>
  </p>
</p>

---

## Demo


https://github.com/user-attachments/assets/94470e99-c0f6-4e35-9d03-b28efa362b3b



## Quick Install

**macOS** (Apple Silicon & Intel):
```bash
curl -fsSL https://artifacts.videodb.io/call.md/install | bash
```

<p>
  <em>Currently available for macOS and Windows — Linux support coming soon</em>
</p>

After installation:
1. Launch Call.md from Applications or Spotlight
2. Grant system permissions when prompted (Microphone and Screen Recording required)
3. Register with your VideoDB API key ([get one free](https://console.videodb.io))

---

## Overview

Call.md turns meetings into live agent loops. It records locally, transcribes in real-time (you vs them), and provides live intelligence during calls. When the meeting ends, it generates summaries with action items and can send data to your workflow automation platforms.

## Features

### During the Meeting (Live Intelligence)
- **Dual-Channel Transcription** - Separate transcription for you (mic) vs them (system audio), powered by VideoDB
- **Live Assist** - AI generates contextual suggestions: things to say, questions to ask
- **Conversation Metrics** - Real-time monitoring of talk ratio, speaking pace (WPM), questions asked, monologue detection
- **Coaching Nudges** - Gentle rate-limited alerts when conversation needs steering
- **MCP Auto-Triggering** - Detects information needs from conversation and calls your MCP tools automatically
- **MCP Results Panel** - Inline display of tool outputs (markdown, links, structured data) during meetings
- **Bookmarking** - Mark important moments for easy reference later

### Post-Meeting Intelligence
- **AI-Generated Summaries** - Three parallel extractions:
  - Short overview (narrative summary)
  - Key points by topic (attributed to participants)
  - Action items (concrete next steps)
- **Structured Export** - Markdown export with full transcript, summary, and metrics
- **Workflow Webhooks** - Auto-send meeting data to n8n, Zapier, or CRMs when meeting ends

### Meeting Preparation
- **Meeting Setup Wizard** - AI-generated probing questions based on meeting description
- **Dynamic Checklist** - AI creates discussion checklist from meeting context
- **Google Calendar Integration** - Sync upcoming meetings

### Privacy & Storage
- **Local-First** - SQLite database, all data stored on your machine
- **Screen & Audio Recording** - Capture screen, microphone, and system audio simultaneously
- **Recording History** - Browse and review past recordings with full transcripts
- **VideoDB Integration** - Transcription and AI features require internet connectivity

## How It Works

**During Recording:**
- Captures dual-channel audio (you vs them) and sends to VideoDB for real-time transcription via WebSocket
- Runs live intelligence: metrics tracking, coaching nudges, and AI-generated assists
- MCP agent automatically detects information needs and triggers relevant tools

**After Recording:**
- Generates three-part summary: narrative overview, key points, and action items
- Sends meeting data to workflow automation platforms (n8n, Zapier, CRMs)
- Exports to markdown with full transcript and intelligence

## Tech Stack

- **Electron 34** - Desktop application framework
- **TypeScript 5.8** - Full type safety across main and renderer processes
- **React 19** - Modern UI framework with concurrent features
- **Tailwind CSS + shadcn/ui** - Utility-first styling with high-quality component primitives
- **tRPC 11** - End-to-end type-safe API layer between main and renderer
- **Hono** - Fast HTTP server for tRPC API endpoints
- **Drizzle ORM + SQLite** - Type-safe database operations with local storage
- **Zustand** - Lightweight state management
- **VideoDB SDK** (0.2.4) - Screen recording, transcription, and video processing
- **MCP SDK** (1.0.0) - Model Context Protocol for tool integrations
- **OpenAI SDK** (6.19.0) - LLM calls via VideoDB's OpenAI-compatible API
- **Vite** - Fast frontend bundling and hot module replacement

## Prerequisites

- macOS 12+ (Monterey or later)
- VideoDB API Key ([console.videodb.io](https://console.videodb.io))
- System permissions: Microphone and Screen Recording

For development: Node.js 18+ and npm 10+

## Getting Started (Users)

1. **Install:**
   ```bash
   curl -fsSL https://artifacts.videodb.io/call.md/install | bash
   ```

2. **Launch** the app and enter your VideoDB API key ([get one free](https://console.videodb.io))

3. **Grant permissions** when prompted (Microphone and Screen Recording)

4. **Start Recording** - Click "New Meeting" and begin your first session

The app will transcribe in real-time, show live assists, and generate a summary when you're done.

---

## Getting Started (Developers)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/video-db/call.md.git
   cd call-md
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

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode (main + renderer with hot reload) |
| `npm run build` | Build TypeScript and React for production |
| `npm run dist:mac` | Build macOS distributable DMG |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run rebuild` | Rebuild native modules for Electron |
| `npm run db:generate` | Generate database migration files |
| `npm run db:migrate` | Apply database migrations |

## MCP Server Setup

Connect MCP servers in **Settings → MCP Servers**:

1. Click **Add Server**
2. Choose transport: **stdio** (local) or **http** (remote)
3. Configure and click **Connect**

The MCP agent runs automatically during meetings, detects information needs from conversation, and triggers relevant tools. Results appear inline in the **MCP Results** panel.

## Development

### Project Structure

```
src/
├── main/                   # Electron Main Process
│   ├── db/                 # Database layer (Drizzle + SQLite)
│   ├── ipc/                # IPC handlers
│   ├── lib/                # Utilities (logger, paths, permissions)
│   ├── server/             # HTTP server (Hono + tRPC)
│   │   └── trpc/           # tRPC router and procedures
│   └── services/           # Business logic
│       ├── copilot/        # Meeting intelligence services
│       │   ├── context-manager.service.ts
│       │   ├── conversation-metrics.service.ts
│       │   ├── nudge-engine.service.ts
│       │   ├── sales-copilot.service.ts  # Core orchestrator
│       │   ├── summary-generator.service.ts
│       │   └── transcript-buffer.service.ts
│       ├── mcp/            # MCP orchestration and tool execution
│       │   ├── connection-orchestrator.service.ts
│       │   ├── intent-detector.service.ts
│       │   ├── mcp-agent.service.ts
│       │   ├── tool-aggregator.service.ts
│       │   └── result-handler.service.ts
│       ├── live-assist.service.ts
│       ├── mcp-inference.service.ts
│       ├── llm.service.ts
│       └── videodb.service.ts
├── preload/                # Preload scripts (IPC bridge)
├── renderer/               # React Frontend
│   ├── api/                # tRPC client
│   ├── components/         # UI components
│   │   ├── auth/           # Authentication modal
│   │   ├── calendar/       # Calendar integration UI
│   │   ├── copilot/        # Meeting intelligence UI
│   │   ├── history/        # Recording history views
│   │   ├── home/           # Home screen
│   │   ├── icons/          # Icon components
│   │   ├── layout/         # App layout (sidebar, titlebar)
│   │   ├── mcp/            # MCP results/status components
│   │   ├── meeting-setup/  # Meeting prep wizard
│   │   ├── recording/      # Recording controls & live assist
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

**Recording not starting:**
- Check microphone and screen recording permissions in System Settings
- Verify VideoDB API key is valid

**Transcription not appearing:**
- Ensure mic and system audio are enabled in settings
- Wait 5-10 seconds for first transcripts
- Check internet connectivity

**Development issues:**
- Rebuild native modules: `npm run rebuild`
- Check Node.js version (requires 18+)
- Review logs: `~/Library/Application Support/call-md/logs/`

## Data Storage

Application data is stored in:
```
~/Library/Application Support/call-md/
├── data/
│   └── call-md.db    # SQLite database
└── logs/
    └── app-YYYY-MM-DD.log  # Daily log files
```

## Community & Support

- **Documentation:** [docs.videodb.io](https://docs.videodb.io)
- **Issues:** [GitHub Issues](https://github.com/video-db/call.md/issues)
- **Discord:** [Join community](https://discord.gg/py9P639jGz)
- **API Key:** [VideoDB Console](https://console.videodb.io)

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
[stars-shield]: https://img.shields.io/github/stars/video-db/call.md.svg?style=for-the-badge
[stars-url]: https://github.com/video-db/call.md/stargazers
[issues-shield]: https://img.shields.io/github/issues/video-db/call.md.svg?style=for-the-badge
[issues-url]: https://github.com/video-db/call.md/issues
[website-shield]: https://img.shields.io/website?url=https%3A%2F%2Fvideodb.io%2F&style=for-the-badge&label=videodb.io
[website-url]: https://videodb.io/
