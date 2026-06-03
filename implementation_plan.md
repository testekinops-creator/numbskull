# Numbskull — Multiplayer Number Game Platform

## Implementation Plan

Based on: [BRD v3](file:///C:/Users/Deepak.Hegde/Downloads/Guess_The_Number_BRD_v3.md) + [Numbskull Design Brief](file:///C:/Users/Deepak.Hegde/Downloads/numbskull_design_brief.html)

---

## 1. Problem Statement & Background

Build **Numbskull** — *"The number game that roasts you."* — a real-time, multiplayer number game platform with **five game modes** (2 at launch, 3 post-launch):

#### Launch Game Modes (Phase 1–2)

### Game Mode 1: 🎯 Guess The Number
Classic higher/lower number guessing within a configurable range (1–100, 1–500, etc.). Feedback: Too High / Too Low / Correct + proximity warmth indicators.

### Game Mode 2: 🐂 Bulls & Cows (4-Digit Code Breaker)
Classic code-breaking game. Each player picks a secret 4-digit code (digits 0–9, all unique). Opponent guesses 4-digit codes and receives feedback:
- **Bulls** 🐂 = correct digit in the correct position
- **Cows** 🐄 = correct digit in the wrong position
- Goal: crack the exact code in the fewest attempts

#### Post-Launch Game Modes (Phase 7) ★

### Game Mode 3: 🔢 Countdown (Target Number)
Both players get the **same 6 random numbers** and a **target number** (e.g., make 437 from 2, 4, 7, 10, 25, 50). Use +, −, ×, ÷ within 60 seconds. Closest to target wins. See §6.13.1.

### Game Mode 4: 🧮 Number Chain (Strategic Duel)
Start from a seed number, take alternating turns applying operations (+, −, ×, ÷) with numbers 1–9 to reach a target. The only **adversarial** game — your move directly affects your opponent's options. See §6.13.2.

### Game Mode 5: 🏗️ Number Towers (Risk/Reward Placement)
Both players see the same random numbers revealed one at a time. Place each into a 5-slot tower. Goal: numbers must be in ascending order bottom-to-top. Every placement is a gamble. See §6.13.3.

### Shared Platform Features
- Room-based multiplayer gameplay with WebSocket synchronization
- Single-player AI mode with multiple difficulty levels
- Sarcastic, personality-driven feedback (the game roasts you)
- User registration, profiles, badges, leaderboards
- Daily challenges, social sharing, friends system
- PWA installability and push notifications
- Full accessibility (WCAG 2.1 AA), analytics, and GDPR compliance

The application targets desktop and mobile browsers with no installation required, and must support 20K concurrent users / 10K concurrent rooms.

---

## Decisions (Resolved)

| Decision | Choice | Rationale |
|----------|--------|----------|
| **Delivery approach** | Sequential, one phase at a time | Per user preference. Each phase is a complete, testable milestone. |
| **Tech stack** | React 19 + Vite 6 / Node.js 22 + Express 5 + Socket.io 4 / PostgreSQL 16 / Redis 7 | Best-fit stack for real-time multiplayer with user accounts (confirmed). |
| **Hosting** | **Vercel** (frontend) + **Railway** (backend + PG + Redis) | Zero-config deploys, generous free tier, WebSocket support on Railway, great DX. |
| **Google OAuth** | Stubbed initially, wired in Phase 4 | Will use a placeholder "coming soon" button until credentials are provided. |
| **Analytics** | **Plausible** (self-hosted or cloud) | Privacy-respecting, lightweight (<1KB script), no cookie banner needed for basic analytics. GDPR-friendly. |
| **Email service** | **Resend** | Modern API, generous free tier (3K emails/month), excellent DX, React Email templates. |
| **Avatar storage** | **Cloudinary** (free tier: 25K transforms/month) | On-the-fly resizing, CDN delivery, no server storage management. |
| **Scope** | All v1 + v2 + v3 features, implemented phase by phase | Complete feature set delivered incrementally. |

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend Framework** | React 19 + Vite 6 | Fast build, HMR, modern React features |
| **Styling** | Vanilla CSS with CSS Custom Properties | Per project guidelines; design tokens, themes |
| **State Management** | React Context + useReducer | Sufficient for game state; avoids external deps |
| **Real-time Comms** | Socket.io Client | Robust WebSocket with auto-reconnect |
| **Routing** | React Router v7 | Client-side routing, deep-link support |
| **Backend Runtime** | Node.js 22 + Express 5 | Mature ecosystem, Socket.io integration |
| **WebSocket Server** | Socket.io 4 | Room management, broadcasting, reconnection |
| **Database** | PostgreSQL 16 | Relational data model, JSONB for configs |
| **ORM** | Prisma | Type-safe queries, migrations, seeding |
| **Cache / Pub-Sub** | Redis 7 | Leaderboard caching, Socket.io adapter for horizontal scaling |
| **Auth** | JWT (access + refresh tokens) + bcrypt | Stateless auth, secure password hashing |
| **PWA** | Workbox | Service worker generation, precaching |
| **Testing** | Vitest (unit), Playwright (E2E) | Fast unit tests, cross-browser E2E |
| **Linting/Format** | ESLint + Prettier | Code quality |

---

## 3. Architecture Overview

```mermaid
graph TD
    subgraph Client["Client (React + Vite)"]
        UI["React Components"]
        SC["Socket.io Client"]
        SW["Service Worker (PWA)"]
    end

    subgraph Server["Server (Node.js + Express)"]
        API["REST API (Express)"]
        SIO["Socket.io Server"]
        GL["Game Logic Engine"]
        AUTH["Auth Middleware (JWT)"]
        ANA["Analytics Collector"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL"]
        RD["Redis"]
    end

    UI --> SC
    UI --> API
    SC <--> SIO
    API --> AUTH
    API --> PG
    API --> RD
    SIO --> GL
    GL --> PG
    GL --> RD
    SIO --> RD
    API --> ANA
```

### Key Architectural Decisions

1. **Server-authoritative game logic**: All guess evaluation, turn enforcement, secret number storage, and scoring happens server-side. The client is display-only (per BRD security requirements).
2. **Socket.io rooms for game state**: Each game room maps to a Socket.io room. Redis adapter enables horizontal scaling.
3. **Monorepo structure**: Single repository with `client/` and `server/` directories for simplicity.
4. **Stateless API**: JWT tokens, no server-side sessions. Redis used only for caching and Socket.io pub-sub.

---

## 4. Project Structure

```
NewGame/
├── client/                          # React frontend (Vite)
│   ├── public/
│   │   ├── manifest.json            # PWA manifest
│   │   ├── icons/                   # App icons (192, 512)
│   │   └── sounds/                  # Audio assets
│   ├── src/
│   │   ├── main.jsx                 # Entry point
│   │   ├── App.jsx                  # Router + layout
│   │   ├── index.css                # Design system + global styles
│   │   ├── assets/                  # Static assets (images, fonts)
│   │   ├── components/              # Reusable UI components
│   │   │   ├── common/              # Button, Modal, Toast, Input, Timer, etc.
│   │   │   ├── game/                # Shared: GameBoard, GuessHistory, Timer, etc.
│   │   │   ├── guess-number/        # GTN-specific: NumberInput, RangeBar, ProximityFeedback
│   │   │   ├── bulls-cows/          # B&C-specific: DigitInput, BullsCowsFeedback, DigitTracker
│   │   │   ├── lobby/               # RoomCode, PlayerList, ReadyToggle, Chat, GameModeSelector
│   │   │   ├── layout/              # Header, Footer, Sidebar, Navigation
│   │   │   └── social/              # ShareCard, BadgeDisplay, LeaderboardTable
│   │   ├── pages/                   # Page-level components
│   │   │   ├── Home.jsx
│   │   │   ├── CreateRoom.jsx
│   │   │   ├── JoinRoom.jsx
│   │   │   ├── BrowseRooms.jsx
│   │   │   ├── Lobby.jsx
│   │   │   ├── Game.jsx
│   │   │   ├── GameResult.jsx
│   │   │   ├── SinglePlayer.jsx
│   │   │   ├── DailyChallenge.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Settings.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── NotFound.jsx
│   │   ├── contexts/                # React contexts
│   │   │   ├── AuthContext.jsx
│   │   │   ├── GameContext.jsx
│   │   │   ├── SocketContext.jsx
│   │   │   ├── ThemeContext.jsx
│   │   │   └── SettingsContext.jsx
│   │   ├── hooks/                   # Custom hooks
│   │   │   ├── useSocket.js
│   │   │   ├── useGame.js
│   │   │   ├── useTimer.js
│   │   │   ├── useAuth.js
│   │   │   └── useSound.js
│   │   ├── services/                # API + Socket service layers
│   │   │   ├── api.js               # REST API client (fetch wrapper)
│   │   │   ├── socket.js            # Socket.io client singleton
│   │   │   └── analytics.js         # Event tracking
│   │   └── utils/                   # Pure utility functions
│   │       ├── gameLogic.js         # Client-side validation helpers
│   │       ├── constants.js
│   │       └── formatters.js
│   ├── sw.js                        # Service worker (Workbox)
│   ├── vite.config.js
│   └── package.json
│
├── server/                          # Node.js backend
│   ├── src/
│   │   ├── index.js                 # Entry point (Express + Socket.io bootstrap)
│   │   ├── config/
│   │   │   ├── database.js          # Prisma client init
│   │   │   ├── redis.js             # Redis client init
│   │   │   └── env.js               # Environment validation
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT verification
│   │   │   ├── rateLimiter.js       # Rate limiting
│   │   │   ├── validation.js        # Input validation (Zod)
│   │   │   └── errorHandler.js      # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.js              # /api/auth/*
│   │   │   ├── rooms.js             # /api/rooms/*
│   │   │   ├── users.js             # /api/users/*
│   │   │   ├── friends.js           # /api/friends/*
│   │   │   ├── leaderboard.js       # /api/leaderboard
│   │   │   ├── dailyChallenge.js    # /api/daily-challenge/*
│   │   │   └── settings.js          # /api/users/me/settings
│   │   ├── socket/
│   │   │   ├── handler.js           # Socket.io connection handler
│   │   │   ├── roomEvents.js        # Room lifecycle events
│   │   │   ├── gameEvents.js        # Gameplay events
│   │   │   ├── chatEvents.js        # Reactions / chat events
│   │   │   └── reconnectHandler.js  # Reconnection logic
│   │   ├── game/
│   │   │   ├── IGameEngine.js       # Shared interface (strategy pattern)
│   │   │   ├── GuessTheNumberEngine.js  # GTN: higher/lower evaluation
│   │   │   ├── BullsCowsEngine.js   # B&C: bulls/cows evaluation
│   │   │   ├── engineFactory.js     # Creates engine by game mode
│   │   │   ├── ai/
│   │   │   │   ├── gtnAI.js          # GTN AI (binary search, random, adaptive)
│   │   │   │   └── bullsCowsAI.js   # B&C AI (Knuth's minimax algorithm)
│   │   │   ├── roomManager.js       # In-memory room state management
│   │   │   ├── timerManager.js      # Turn timers, forfeit logic
│   │   │   └── badgeEvaluator.js    # Badge condition checks
│   │   ├── services/
│   │   │   ├── authService.js       # Registration, login, token management
│   │   │   ├── userService.js       # Profile, stats queries
│   │   │   ├── leaderboardService.js# Leaderboard computation + caching
│   │   │   ├── dailyChallengeService.js
│   │   │   ├── friendService.js
│   │   │   └── emailService.js      # Email sending (verification, etc.)
│   │   └── utils/
│   │       ├── roomCodeGenerator.js # Unique code gen (no O/0/I/l)
│   │       ├── scoring.js           # Efficiency score calculation
│   │       └── validators.js        # Shared validation schemas (Zod)
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   ├── migrations/              # Auto-generated migrations
│   │   └── seed.js                  # Seed data (badges, daily challenge)
│   ├── tests/
│   │   ├── unit/                    # Vitest unit tests
│   │   └── integration/             # API + Socket integration tests
│   └── package.json
│
├── e2e/                             # Playwright E2E tests
│   ├── tests/
│   │   ├── multiplayer.spec.js
│   │   ├── singlePlayer.spec.js
│   │   ├── dailyChallenge.spec.js
│   │   └── auth.spec.js
│   └── playwright.config.js
│
├── docker-compose.yml               # PostgreSQL + Redis for local dev
├── .env.example                     # Environment variables template
├── .gitignore
├── README.md
└── package.json                     # Root workspace config
```

---

## 5. Phased Delivery Plan

### Phase 1 — Core Infrastructure & Single-Player MVP
**Goal**: Playable single-player game with polished UI + Numbskull personality.

| # | Feature Area | BRD Refs | Details |
|---|-------------|----------|---------|
| 1.1 | Project scaffolding | — | Vite + React setup, Express server, Docker Compose (PG + Redis), Prisma init |
| 1.2 | Design system (Numbskull identity) | Design Brief | `index.css`: Full Numbskull design token system — deep-purple palette, system serif/sans-serif/monospace typography, motion tokens (shake, pulse, scale, slide-up), sarcastic tone-of-voice string constants, responsive breakpoints (see §6.6 below) |
| 1.3 | **Game state machine** | ★ Veteran | Formal FSM with explicit states: `IDLE → LOBBY → CONFIGURING → COUNTDOWN → SECRET_SUBMISSION → PLAYING → INTERMISSION → TIEBREAKER → RESULT → REMATCH_PENDING → IDLE`. Each state defines: valid actions, valid transitions, timeout behavior, UI shown. Prevents invalid state bugs. See §6.10 |
| 1.4 | Loading screen | Design Brief | Deep `#1C1842` bg, skull logo scale-up entrance, wordmark, tagline fade-in, purple progress bar. First thing users see. |
| 1.5 | Home screen | FR-001, Design Brief | Numbskull skull logo with "?" glyph, tagline, **game mode selector** (🎯 GTN / 🐂 B&C — **B&C locked until 3 GTN wins**), CTA hierarchy (Create Room, Join Room, **Quick Match**, vs AI, Daily Challenge), Login/Register button, live room counter, system announcement banner (if active), bottom nav |
| 1.6 | **Interactive tutorial (FTUE)** | ★ Veteran | First-time user experience: auto-launches guided GTN game vs Easy AI with tooltip walkthrough. ~60 seconds, unskippable on first play, skippable after. Teaches input, feedback, roasts, hints. See §6.10 |
| 1.7 | **Difficulty unlock progression** | ★ Veteran | Hard & Custom locked until player beats Medium. B&C unlocked after 3 GTN wins. Creates discovery moments and prevents overwhelm. Locked items show padlock + unlock condition. See §6.10 |
| 1.8 | Game engine (strategy pattern) | — | `IGameEngine` interface + `GuessTheNumberEngine` + `BullsCowsEngine` + `engineFactory` (see §6.1) |
| 1.9 | 🎯 GTN: Single-player game | FR-014, FR-015 | AI mode: Easy/Medium/Hard/Adaptive, random secret number, AI "personality" delay |
| 1.10 | 🎯 GTN: Game board UI | FR-007–FR-011 | Number input, feedback display (Too Low/High/Correct + proximity), dynamic range bar (**own range only — opponent range hidden**), guess history with most-recent highlighting, attempt counter, efficiency score |
| 1.11 | 🐂 B&C: Single-player game | — | AI mode using Knuth's minimax algorithm (see §6.3), 4-digit secret code, AI thinking delay |
| 1.12 | 🐂 B&C: Game board UI | — | 4-digit input (individual digit fields, auto-advance, mobile keyboard optimized), bulls/cows visual feedback (🐂 green / 🐄 yellow indicators), digit elimination tracker, guess history with B/C counts |
| 1.13 | Timer system | FR-017 | Circular countdown ring: **Green → Yellow at 50% → Red at 20%**, optional audio tick in last 5s, timer pause on disconnect |
| 1.14 | Hint system | FR-016 | GTN: Binary search assistant. B&C: Reveal one bull position. Both with +1 penalty + rate limiting (min 1 real guess between hints) |
| 1.15 | Game rules modal | FR-001 | Rules explanation overlay (tabbed: GTN rules / B&C rules) |
| 1.16 | Round/match flow | FR-012, FR-013 | Multi-round support, **3-2-1 countdown** before gameplay starts, winner determination, tiebreaker round, 10s intermission screen with scores. **Round forfeit on timer expiry = loss with max-attempts penalty**. **Last-attempt drama**: screen darkens, skull warns *"Last chance, Numbskull..."* See §6.10 |
| 1.17 | Game result screen | FR-020 | **Win**: confetti + skull grudging praise + triumphant chord. **Loss**: rain/storm particles + skull roast + low tone. **First-ever win**: special mega-celebration with unique animation + *"Beginner's luck. Don't get comfortable."* See §6.10 |
| 1.18 | Basic settings | FR-033 | **Sound effects** (on/off), **background music** (on/off, default off), **timer tick sound** (on/off), theme, font size, animations toggle (Full/Reduced/Off), stored in localStorage |
| 1.19 | Mobile gameplay UX | — | Virtual keyboard handling (input at bottom, game board scrolls up), **portrait orientation lock**, responsive layout for keyboard-visible state. See §6.9 |
| 1.20 | Background tab handling | — | `visibilitychange` API: flash document title *"(!) Your Turn — Numbskull"* when tab is unfocused, browser notification via Notification API. See §6.9 |
| 1.21 | 🧠 **Numbskull Personality Evolution** | ★ Unique | Evolving roast tiers based on play count: Hostile (1–10) → Grudging (11–50) → Backhanded (51–100) → Rivalry (100+). Stored in localStorage/profile. See §6.8 |
| 1.22 | 🎵 **Musical Guess Feedback** | ★ Unique | Web Audio API: pitch maps to guess proximity — low note for far, ascending pitch as closer, satisfying chord on correct. Toggleable in settings. See §6.8 |
| 1.23 | 😤 **Pressure Meter** | ★ Unique | Real-time thinking-time display: *"You've been staring for 31 seconds."* Single-player shows time vs optimal AI. See §6.8 |
| 1.24 | 📳 **Haptic Feedback** | — | Vibration API on mobile: short pulse on correct guess, subtle buzz on wrong, rhythmic vibration on timer warning. Toggleable. |

---

### Phase 2 — Multiplayer Core
**Goal**: Two-player real-time multiplayer with polished UX.

| # | Feature Area | BRD Refs | Details |
|---|-------------|----------|---------|
| 2.1 | Room creation | FR-002 | Room code generation (no ambiguous chars), host settings, public/private visibility, **game mode selection** (GTN or B&C). **Hard mode validation**: secret cannot equal boundary min/max |
| 2.2 | Room joining | FR-003 | Code input, validation, deep-link support (`/join/:code`), game mode shown in room info |
| 2.3 | Browse public rooms | FR-003B | List open rooms with **game mode badge** (🎯/🐂), 5-second auto-refresh, join button |
| 2.4 | ⚡ **Quick Match** | ★ New | Auto-matchmaking button: adds player to queue → server pairs with another waiting player of similar skill → auto-creates room. Fallback: "No opponents found, create a room?" after 15s. See §6.9 |
| 2.5 | 👁️ **Watch Live (Spectator Discovery)** | ★ Veteran | "Watch Live" section on home screen / browse page showing active public games with spectator count. Lets users discover and spectate ongoing matches. See §6.10 |
| 2.6 | Lobby screen | FR-004 | Room code display, game mode indicator, copy invite link, QR code, player list with avatars, ready toggle, start button (host only), pre-game **moderated chat** (profanity filter, rate limited, mute option), game config summary (read-only for non-host), "Change Settings" (host only), host kick |
| 2.7 | Game config | FR-005 | **GTN config**: range, rounds, timer, difficulty preset, hints, proximity toggle. **B&C config**: code length (4, default), allow repeats (no, default), rounds, timer. Validation: min < max, range > 10, rounds 1–10, timer 15–300s |
| 2.8 | Secret submission | FR-006 | **GTN**: single number in range (not equal to min/max on Hard). **B&C**: 4-digit code (unique digits 0–9). Confirmation step ("Are you sure?"), countdown, auto-assign on timeout. **"Waiting for opponent to submit..."** state displayed. **Reconnect during submission**: resume countdown from where it paused, notify if auto-assigned |
| 2.9 | **3-2-1 Game start countdown** | — | After both players ready + host starts: animated 3-2-1 countdown overlay before gameplay begins. See §6.9 |
| 2.10 | Multiplayer game loop | FR-007–FR-009 | Turn-based guessing via Socket.io, server-enforced turn order, "thinking" indicator, **"Opponent guessed!" flash** before result appears. Engine dispatches to correct evaluator based on game mode. **Max match duration: 30 minutes** → auto-draw if exceeded |
| 2.11 | **Race condition handling** | ★ Veteran | Server-side mutex/lock on room state for every write operation. Handles: simultaneous secret submission, guess + timer expiry at same moment, dual rematch/home clicks, concurrent Quick Match slot claims. See §6.10 |
| 2.12 | **Guess confirmation (multiplayer)** | — | Before submitting guess: "Submit guess: 73? [Confirm] [Cancel]" — prevents costly mis-types in multiplayer. See §6.9 |
| 2.13 | **Turn audio + visual cues** | — | Distinct chime when it becomes your turn, visual pulse on game board, "Opponent guessed" notification sound |
| 2.14 | Spectator mode | FR-026 | Watch-only view, 2-second delay, spectator count, no secret numbers exposed, spectators removed on game completion |
| 2.15 | Reconnection handling | FR-019 | 30-second grace period, timer pause, session token reconnect, full state sync |
| 2.16 | In-game reactions | FR-021 | Emoji reactions (👍 😮 🔥 😂 🤔 GG), rate limited (1 per 5s), non-intrusive overlay, not shown to spectators |
| 2.17 | **Rematch flow** | FR-020 | Player A clicks Rematch → Player B sees prompt with [Accept] / [Decline]. 15s timeout. Same room reused with reset state. See §6.9 |
| 2.18 | **Connection quality indicator** | — | Ping/latency dot (🟢 <100ms, 🟡 100–300ms, 🔴 >300ms) in header. "Your connection is unstable" warning banner. See §6.9 |
| 2.19 | **Multi-tab prevention** | — | Server rejects second socket connection from same session: *"You're already connected in another tab."* |
| 2.20 | **Anti-stalling / AFK detection** | — | If player submits no guess for 2 consecutive turns: AFK warning. 3 consecutive: auto-forfeit. See §6.9 |
| 2.21 | **Game pause (mutual consent)** | — | Either player requests pause → opponent accepts/declines. Max 2 pauses per match, 60s each. Timer pauses for both. See §6.9 |
| 2.22 | **Server memory management** | ★ Veteran | Room eviction: LRU + 10min TTL. Max 5,000 rooms per instance. Each room ~2KB. Memory budget: ~10MB for rooms. Redis backing for persistence across restarts. Health check endpoint reports room count + memory usage |
| 2.23 | 😤 **Pressure Meter (multiplayer)** | ★ Unique | Shows opponent's thinking time comparison live: *"Your opponent guessed in 2.3s. You've been staring for 47s. No pressure."* |

---

### Phase 3 — Engagement Features
**Goal**: Retention mechanics and daily play loops.

| # | Feature Area | BRD Refs | Details |
|---|-------------|----------|---------|
| 3.1 | Database schema | Data Model (§7) | Full Prisma schema: Users, Rooms, Games, Rounds, Guesses, Badges, DailyChallenges, DailyChallengeEntries, FeatureUnlocks, WeeklyQuests |
| 3.2 | Daily challenge | FR-022 | Server-generated seed, one attempt/day, streak counter, daily leaderboard, reminder banner. **Alternates between GTN and B&C** (odd days = GTN, even days = B&C). **Enforcement**: per-device fingerprint (guest) or per-account (registered) |
| 3.3 | Badge system | FR-024 | 11 original badges + **2 B&C badges** + **4 unique feature badges** (Ghost Buster, Poker Face, AI Whisperer, Self-Improvement) = **17 total**. See §6.7, §6.8 |
| 3.4 | Leaderboard | FR-025 | All-time, weekly, daily challenge, **friends leaderboard** tabs. Pagination (top 100 + own rank), anti-cheat filtering (min 10 games) |
| 3.5 | **Viral loop optimization** | ★ Veteran | Prompted share modal on dramatic wins (first-guess, comeback, perfect efficiency): *"You just won in 2 guesses! That's top 3%. Share this?"* Share card includes **one-tap play link** — recipient opens and plays same seed vs AI. See §6.10 |
| 3.6 | Score sharing | FR-018 | Share card (PNG), social share buttons, Wordle-style emoji string, UTM-tagged deep links |
| 3.7 | Guess history persistence | FR-010 | localStorage for guests (last 5), server-side for registered users, CSV export |
| 3.8 | Notifications | FR-027 | In-app notification system: toasts for game events, badge earned, friend activity |
| 3.9 | 🔄 **Weekly quest system** | ★ Veteran | 3 rotating weekly goals (e.g., "Win 5 games", "Beat Hard AI", "Play B&C 3 times"). Rewards: XP bonus + leaderboard score multiplier. Resets Monday 00:00 UTC. See §6.10 |
| 3.10 | 📊 **Post-Game Roast Report** | ★ Unique | Show optimal path vs actual path with sarcastic commentary. Calculates mathematically perfect strategy and compares. Shareable. See §6.8 |
| 3.11 | 👻 **Ghost Mode** | ★ Unique | Race your own past best performance. Ghost's guesses appear as translucent overlay in real-time. Stores replay data per difficulty. See §6.8 |
| 3.12 | 🃏 **Bluff Round (B&C only)** | ★ Unique | Once per match, send one fake bulls/cows result. Opponent sees "one of your clues may be fake" warning. See §6.8 |

---

### Phase 4 — Social & Profiles
**Goal**: User accounts, profiles, social features.

| # | Feature Area | BRD Refs | Details |
|---|-------------|----------|---------|
| 4.1 | Auth: email + password | FR-029 | Registration, login, bcrypt hashing, email verification, JWT (access + refresh), "Remember Me", account lockout |
| 4.2 | Auth: Google OAuth | FR-029 | OAuth 2.0 flow, guest-to-account upgrade |
| 4.3 | Player profile | FR-023 | Stats dashboard, badge collection, match history (last 50), public profile URL, visibility toggle |
| 4.4 | Friends system | FR-030 | Friend requests, online status, game invites, block user, **report user** |
| 4.5 | Account management | FR-029 | Change display name (**validated**: profanity filter, no impersonation of "Admin"/"Numbskull", 2–20 chars, no special unicode spam), avatar upload (Cloudinary), change password, delete account (30-day soft delete), data export (GDPR). See §6.10 |
| 4.6 | Settings (registered) | FR-033 | Server-persisted settings, notification preferences per category (each toggle individually) |
| 4.7 | 📢 **Guest → Registered conversion nudges** | ★ Veteran | Contextual prompts: after 3 games (*"Your stats aren't being saved!"*), after badge earned (*"Register to keep it forever"*), after leaderboard placement (*"Claim your rank!"*). Non-intrusive bottom sheet, dismissible. See §6.10 |
| 4.8 | 🏟️ **Replay Theater** | ★ Unique | "Top Games Today" feed: algorithmically selected highlights (closest finishes, comebacks, speed records). Watchable replays. See §6.8 |

---

### Phase 5 — PWA & Analytics
**Goal**: Installable app, push notifications, usage tracking.

| # | Feature Area | BRD Refs | Details |
|---|-------------|----------|---------|
| 5.1 | PWA manifest & service worker | FR-031 | `manifest.json`, Workbox service worker, offline splash, cached leaderboard/stats, install prompt after 2nd session, **PWA install prompt banner on home screen** |
| 5.2 | Push notifications | FR-027, FR-031 | Web Push API, opt-in flow, daily challenge reminder (9 AM local), friend challenge notifications, weekly leaderboard rank change |
| 5.3 | Analytics integration | FR-032 | Plausible event tracking, all 11 tracked events, **GDPR/CCPA consent banner**, no PII in events |
| 5.4 | Share tracking | FR-018 | UTM-tagged links, share event logging |
| 5.5 | **Data privacy & retention** | NFR | 90-day guest data purge (localStorage + server fingerprints), GDPR data export on request, CCPA compliance, cookie consent flow |

---

### Phase 6 — Polish & Launch Readiness
**Goal**: Accessibility, cross-browser, performance, security hardening.

| # | Feature Area | BRD Refs | Details |
|---|-------------|----------|---------|
| 6.1 | Accessibility | FR-028 | High-contrast theme, keyboard navigation, ARIA labels, font size options (S/M/L), reduced motion, **colour-blind mode** (Deuteranopia/Protanopia), focus indicators |
| 6.2 | Error & empty states | FR-034 | All 7 scenario-specific error/empty states with illustrations and CTAs |
| 6.3 | **Loading skeletons** | ★ Veteran | Shimmer skeleton placeholders for every data-dependent screen: leaderboard, profile stats, match history, daily challenge, friends list, Replay Theater, Browse Rooms. Shown on every load, not just errors |
| 6.4 | Edge case handling | §10 | All 15 edge cases (invalid room, expired room, duplicate guess, host leave, simultaneous disconnect, etc.) |
| 6.5 | i18n architecture | NFR §6 | i18n resource files, English strings extracted, locale-aware date/time |
| 6.6 | Security hardening | NFR §6 | Rate limiting on all endpoints, CSRF protection, input sanitization, OWASP Top 10 review, dependency scanning |
| 6.7 | **Zero-downtime migration** | ★ Veteran | Prisma migrate with expand/contract pattern: add new columns → deploy code that reads both → backfill → drop old columns. Never break running servers during schema changes |
| 6.8 | Performance optimization | NFR §6 | LCP < 2s, TTI < 3s, code splitting, lazy loading, Redis caching for leaderboards |
| 6.9 | Cross-browser testing | NFR §6 | Chrome, Firefox, Safari, Edge, iOS Safari, Android Chrome |
| 6.10 | **Keyboard shortcuts** | — | Enter to submit guess, Escape to clear input, Tab between digit fields (B&C), documented in rules modal |
| 6.11 | **Graceful degradation** | NFR §6 | If Socket server is down: maintenance screen with estimated recovery. If API is down: cached data from service worker. 99.9% uptime SLA target |
| 6.12 | **Admin panel** | BRD §4 | Admin dashboard: system stats, reported users management, daily challenge seed config, feature flags, broadcast system announcements. Admin API routes (see §8). Role: `is_admin` flag on User model |

---

### Phase 7 — Post-Launch Enhancements
**Goal**: New game modes, seasonal content, experimental modes, community engagement.

| # | Feature Area | BRD Refs | Details |
|---|-------------|----------|---------|
| 7.1 | 🔢 **Countdown (Target Number)** ★★ | Specialist | `CountdownEngine` + expression parser + 3 difficulty tiers + simultaneous play mode. See §6.13.1 |
| 7.2 | 🧮 **Number Chain (Strategic Duel)** ★★ | Specialist | `NumberChainEngine` + minimax AI + operation restriction rules + adversarial turn system. See §6.13.2 |
| 7.3 | 🏗️ **Number Towers (Risk/Reward)** ★★ | Specialist | `NumberTowersEngine` + probability-based AI + simultaneous reveal + scoring system. See §6.13.3 |
| 7.4 | 🎃 **Seasonal Events & Mutators** | ★ Unique | Time-limited game modes: **Reverse Numbskull** (inverted feedback), **Fog of War** (history disappears after 3 turns), **Speed Demon Week** (10s turns only). Themed UI + special badges. See §6.8 |
| 7.5 | 🤯 **"Are You Smarter Than Numbskull?"** | ★ Unique | Reversed mode: player sets the secret, AI guesses. Player gives feedback. Goal: make the AI take more guesses than optimal. Educational + fun. See §6.8 |
| 7.6 | Tournament mode | BRD §12 | Bracket-based tournament system (future enhancement from BRD) |
| 7.7 | Team play (2v2) | BRD §12 | Cooperative mode (future enhancement from BRD) |

---

## 6. Detailed Design Decisions

### 6.1 Game Engine (Server-Side) — Strategy Pattern

The game engine uses a **strategy pattern** so both game modes share a common interface but have independent evaluation logic.

```
IGameEngine (shared interface)
├── createGame(config)              → initializes game state
├── validateSecret(secret)          → mode-specific validation
├── submitSecret(playerId, secret)  → stores secret server-side
├── validateGuess(guess, state)     → mode-specific validation
├── submitGuess(playerId, guess)    → validates turn, evaluates, returns result
├── evaluateGuess(guess, secret)    → mode-specific evaluation (see below)
├── checkRoundWinner()              → determines round outcome
├── checkMatchWinner()              → determines match outcome
├── handleTimeout(playerId)         → auto-forfeit / random guess
├── getHint(playerId)               → mode-specific hint
└── getStateForPlayer(playerId)     → sanitized state (hides opponent's secret)
```

#### 🎯 GuessTheNumberEngine

```
evaluateGuess(guess, secret, range)
├── returns: { result: 'too_low'|'too_high'|'correct', proximity, newRange }
└── proximity: 'burning_hot'|'very_warm'|'getting_warm'|'cold'

validateSecret(number)  → must be integer within configured range
validateGuess(number)   → must be integer within current narrowed range
getHint()               → binary search midpoint suggestion
```

#### 🐂 BullsCowsEngine

```
evaluateGuess(guess, secret)
├── returns: { bulls: Number, cows: Number, isCorrect: Boolean }
├── bull = digit exists AND is in the correct position
└── cow  = digit exists BUT is in a wrong position

validateSecret(code)    → must be 4 digits, all unique (0-9)
validateGuess(code)     → must be 4 digits, all unique, not a duplicate guess
getHint()               → reveal one bull position (with +1 attempt penalty)
```

**Example B&C evaluation:**
```
Secret:  1234
Guess:   1325
→ Bulls: 1 (digit '1' at position 0)
→ Cows:  2 (digits '3' and '2' exist but wrong position)
→ Result: "1🐂 2🐄"
```

#### engineFactory.js (5 Game Modes)

```javascript
function createEngine(gameMode, config) {
  switch (gameMode) {
    case 'guess_the_number': return new GuessTheNumberEngine(config);
    case 'bulls_and_cows':   return new BullsCowsEngine(config);
    case 'countdown':        return new CountdownEngine(config);       // Phase 7
    case 'number_chain':     return new NumberChainEngine(config);     // Phase 7
    case 'number_towers':    return new NumberTowersEngine(config);    // Phase 7
    default: throw new Error(`Unknown game mode: ${gameMode}`);
  }
}
```

**Key rule**: The client never receives the opponent's secret. `getStateForPlayer()` filters all sensitive data before sending via Socket.io.

### 6.2 Room Manager (In-Memory + Redis) — Enhanced ★

Active rooms are held in memory for performance, with Redis as the **write-through backing store** to prevent data loss on server restart/deployment.

> [!CAUTION]
> Without write-through persistence, every Railway deployment (or crash) kills ALL active games. Players mid-game lose everything.

**Write-through persistence strategy:**

| Operation | Memory | Redis | Notes |
|-----------|--------|-------|-------|
| Room created | `rooms.set(roomId, state)` | `HSET room:{roomId} state JSON` + `EXPIRE room:{roomId} 600` | Both written atomically |
| Room state mutated | Direct object mutation | `HSET room:{roomId} state JSON` after every mutation | Every `submitGuess`, `submitSecret`, `readyUp`, etc. triggers a Redis write |
| Room expired (TTL) | `rooms.delete(roomId)` | Auto-expires via `EXPIRE` | Redis TTL = source of truth |
| Room explicitly closed | `rooms.delete(roomId)` | `DEL room:{roomId}` | On match end, host leave, etc. |

**Hydrate on startup:**
```javascript
// server/src/game/roomManager.js — runs on process start
async function hydrateRooms(redisClient) {
  const roomKeys = await redisClient.keys('room:*');
  for (const key of roomKeys) {
    const stateJson = await redisClient.hGet(key, 'state');
    if (stateJson) {
      const state = JSON.parse(stateJson);
      // Only hydrate rooms in PLAYING or LOBBY state (not expired/finished)
      if (['LOBBY', 'PLAYING', 'INTERMISSION', 'TIEBREAKER'].includes(state.gameState)) {
        rooms.set(state.roomId, state);
        // Resume any active timers
        if (state.activeTimer) timerManager.resume(state.roomId, state.activeTimer);
      }
    }
  }
  console.log(`Hydrated ${rooms.size} active rooms from Redis`);
}
```

**Graceful shutdown:**
```javascript
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — flushing rooms to Redis...');
  for (const [roomId, state] of rooms) {
    await redisClient.hSet(`room:${roomId}`, 'state', JSON.stringify(state));
  }
  // Notify connected players
  io.emit('server_restarting', { message: 'Server is updating. You will be reconnected shortly.' });
  server.close(() => process.exit(0));
});
```

**Redis serialization format:**
```
Key:   room:{roomId}
Type:  Hash
Fields:
  state     → JSON string of full room state (~2KB per room)
  createdAt → ISO timestamp
  hostId    → UUID
TTL:  600 seconds (10 min), refreshed on every activity
```

**Performance budget:** Max 5,000 rooms × ~2KB = ~10MB in memory. Redis write per mutation ≈ 0.5ms latency (acceptable for turn-based game — not a continuous physics sim).

### 6.3 AI Opponent Strategies

#### 🎯 Guess The Number AI (`gtnAI.js`)

| Level | Algorithm |
|-------|-----------|
| Easy | `Math.random()` within full remaining range |
| Medium | Random within narrowed valid range (uses feedback) |
| Hard | Binary search (optimal midpoint) |
| Adaptive | Starts at Easy, escalates to Medium/Hard based on player's win rate in session |

#### 🐂 Bulls & Cows AI (`bullsCowsAI.js`)

| Level | Algorithm |
|-------|-----------|
| Easy | Random 4-digit code from remaining valid permutations |
| Medium | Eliminates impossible codes based on feedback, picks randomly from remaining |
| Hard | **Knuth's minimax algorithm** — maintains a candidate set S, picks the guess that minimizes the worst-case remaining candidates. Achieves ≤5 guesses consistently |
| Adaptive | Starts at Easy, escalates based on player performance |

**Knuth's Algorithm (Hard B&C AI):**
1. Start with all 5040 permutations of 4-digit unique codes
2. Initial guess: `1234` (optimal first guess)
3. After each feedback (X bulls, Y cows), eliminate all candidates inconsistent with that feedback
4. Pick next guess that minimizes the maximum remaining candidate set size (minimax)
5. Repeat until 4 bulls (correct)

AI introduces simulated "thinking" delay: Easy = 1.5–2s, Medium = 1–1.5s, Hard = 0.5–1s.

### 6.4 Authentication Flow — Enhanced ★

#### 6.4.1 REST Authentication

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as PostgreSQL
    participant RD as Redis

    C->>S: POST /api/auth/register {email, password, displayName}
    S->>S: Validate input (Zod)
    S->>S: Hash password (bcrypt, 12 rounds)
    S->>DB: Insert user (is_verified=false)
    S->>S: Generate refreshToken (UUID v4)
    S->>RD: SET refresh:{hash(token)} userId EX 2592000
    S->>C: 201 {userId, accessToken, refreshToken}
    S-->>C: Send verification email

    Note over C,S: Login flow
    C->>S: POST /api/auth/login {email, password}
    S->>DB: Find user by email
    S->>S: Compare password hash
    S->>S: Generate new refreshToken
    S->>RD: SET refresh:{hash(token)} userId EX 2592000
    S->>C: 200 {accessToken (15min), refreshToken (30d)}

    Note over C,S: Token refresh (with rotation)
    C->>S: POST /api/auth/refresh {refreshToken}
    S->>RD: GET refresh:{hash(oldToken)} → userId
    S->>RD: DEL refresh:{hash(oldToken)}
    S->>S: Generate NEW refreshToken (rotation)
    S->>RD: SET refresh:{hash(newToken)} userId EX 2592000
    S->>C: 200 {newAccessToken, newRefreshToken}

    Note over C,S: Logout (revoke token)
    C->>S: POST /api/auth/logout {refreshToken}
    S->>RD: DEL refresh:{hash(token)}
    S->>C: 200 OK
```

#### 6.4.2 JWT Refresh Token Revocation ★

> [!CAUTION]
> Without server-side revocation, a stolen refresh token gives 30-day access that cannot be revoked. This is a critical security hole.

**Strategy: Server-side token hash in Redis**

| Operation | Redis Command | Effect |
|-----------|--------------|--------|
| **Login** | `SET refresh:{sha256(token)} {userId} EX 2592000` | Token registered as valid |
| **Refresh** | `DEL old → SET new` (atomic) | Old token dies, new token issued (**rotation**) |
| **Logout** | `DEL refresh:{sha256(token)}` | Token immediately invalid |
| **Password change** | `DEL refresh:{userId}:*` (scan + delete) | ALL sessions for user killed |
| **Account ban** | `DEL refresh:{userId}:*` | ALL sessions killed |

**Token storage on client:**
- **Access token:** In-memory only (`AuthContext` state). Never in `localStorage` (XSS risk).
- **Refresh token:** `httpOnly`, `Secure`, `SameSite=Strict` cookie. Never accessible to JS.

**Token rotation rule:** Every refresh request issues a NEW refresh token and invalidates the old one. If an old refresh token is reused (replay attack), invalidate ALL tokens for that user (possible token theft).

---

#### 6.4.3 Socket.io Authentication Middleware ★

> [!CAUTION]
> Without socket authentication, anyone can connect a raw WebSocket and impersonate any player. This is the #1 security hole in multiplayer games.

**Registered user flow:**
```javascript
// server/src/socket/handler.js
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token; // JWT access token
  const guestId = socket.handshake.auth.guestId; // UUID for guests
  
  if (token) {
    // Registered user
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      socket.isGuest = false;
      socket.displayName = payload.displayName;
      return next();
    } catch (err) {
      return next(new Error('INVALID_TOKEN'));
    }
  }
  
  if (guestId && isValidUUID(guestId)) {
    // Guest user
    socket.userId = `guest_${guestId}`;
    socket.isGuest = true;
    socket.displayName = `Numbskull_${guestId.slice(0, 4)}`;
    return next();
  }
  
  return next(new Error('AUTH_REQUIRED'));
});
```

**Guest identity:**
- On first visit: client generates `guestId = crypto.randomUUID()`, stores in `localStorage`
- Passed in every `socket.handshake.auth.guestId`
- Server prefixes with `guest_` to distinguish from registered UUIDs
- Guest display name: `Numbskull_XXXX` (first 4 chars of UUID)

**Token expiry mid-game:**
- If access token expires during an active game, socket stays connected (connection was already authenticated)
- Client silently refreshes the access token via HTTP and sends `socket.emit('update_token', newToken)`
- If refresh fails (token revoked), disconnect socket after current turn completes

**Multi-tab prevention (server-side):**
```javascript
io.use((socket, next) => {
  const existingSocket = connectedUsers.get(socket.userId);
  if (existingSocket) {
    existingSocket.emit('duplicate_session', { message: 'Connected from another tab.' });
    existingSocket.disconnect(true);
  }
  connectedUsers.set(socket.userId, socket);
  next();
});
```

---

### 6.5 Socket Event Flow (Multiplayer Game)

```mermaid
sequenceDiagram
    participant P1 as Player 1 (Host)
    participant S as Server
    participant P2 as Player 2

    P1->>S: create_room {config}
    S->>P1: room_created {roomCode}

    P2->>S: join_room {roomCode}
    S->>P1: player_joined {player2}
    S->>P2: player_joined {roomState}

    P1->>S: ready_up
    P2->>S: ready_up
    P1->>S: start_game

    S->>P1: game_started {config}
    S->>P2: game_started {config}

    loop Each Round
        P1->>S: submit_secret {number}
        S->>P1: secret_submission_confirmed
        P2->>S: submit_secret {number}
        S->>P2: secret_submission_confirmed

        loop Turns
            S->>P1: turn_changed {activePlayer: P1}
            P1->>S: submit_guess {guess}
            S->>P1: guess_result {result, proximity, newRange}
            S->>P2: guess_result {opponentGuessed, result}

            S->>P2: turn_changed {activePlayer: P2}
            P2->>S: submit_guess {guess}
            S->>P2: guess_result {result, proximity, newRange}
            S->>P1: guess_result {opponentGuessed, result}
        end

        S->>P1: round_winner {winner, stats}
        S->>P2: round_winner {winner, stats}
        S->>P1: round_intermission {scores, nextRound}
        S->>P2: round_intermission {scores, nextRound}
    end

    S->>P1: match_winner {winner, matchStats, badges}
    S->>P2: match_winner {winner, matchStats, badges}
```

### 6.6 Numbskull Design System

All visual and interaction design follows the [Numbskull Design Brief](file:///C:/Users/Deepak.Hegde/Downloads/numbskull_design_brief.html), **enhanced** by the veteran UI/logo designer review.

> [!WARNING]
> The original design brief provides a solid foundation but is prototype-tier visually. The following enhancements elevate it to production-quality gaming UI.

---

#### 6.6.1 Color Palette (Enhanced)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-deep` | `#1C1842` | Page background (loading, home, all screens) |
| `--color-bg-primary` | `#26215C` | Card backgrounds, icon bg, tertiary buttons |
| `--color-bg-secondary` | `#3C3489` | Skull ring, progress bar track, input backgrounds |
| `--color-accent-primary` | `#534AB7` | Primary CTA fill, skull body, accent elements |
| `--color-accent-glow` | `#7F77DD` | Stroke rings, tertiary text, secondary icons, progress fill |
| `--color-text-primary` | `#EEEDFE` | Headings, wordmark, button labels, key UI text |
| `--color-text-secondary` | `#AFA9EC` | Tagline, secondary button text, labels, hints |
| `--color-success` | `#4ADE80` | Correct guess feedback |
| `--color-error` | `#F87171` | Wrong guess feedback, errors |
| `--color-warning` | `#FBBF24` | Timer warning state |
| **`--color-juice`** ★ | **`#00F5FF`** | **"Juice" accent — win moments, skull glow during roasts, streak highlights, badge earned flash, "?" glyph glow, active player indicator. Used ≤5% of screen for maximum visual pop.** |
| **`--color-juice-pink`** ★ | **`#FF3E8A`** | **Secondary juice — error emphasis, urgent moments, last-attempt drama, loss particles, rage-quit detection warnings** |

> [!IMPORTANT]
> **The "juice" colors are the difference between "meditation app" and "competitive game."** Every successful game has a hot accent: Wordle has green tiles, Among Us has red emergencies, Valorant has red accents. Numbskull's juice is **electric cyan** (`#00F5FF`) — it's the color of **victory, excitement, and impact**. Use it sparingly but consistently at peak emotional moments.

**Juice color usage rules:**
- Default UI: **never** use juice colors (everything stays in the purple palette)
- Correct guess: feedback text flashes cyan for 500ms, then settles to green
- Win screen: confetti particles alternate cyan + purple
- Badge earned: hexagonal badge border pulses cyan for 2s
- Skull's "?" glyph: subtle cyan glow when delivering a roast (CSS `text-shadow`)
- Active player indicator (multiplayer): cyan glow halo
- Win streak counter: cyan number glow
- Last attempt drama: hot pink (`#FF3E8A`) vignette border

---

#### 6.6.2 Typography (Enhanced)

| Role | Font Stack | Weight | Notes |
|------|-----------|--------|-------|
| **Wordmark / Display** ★ | **`'Outfit', system-ui, sans-serif`** | Bold (700) / ExtraBold (800) | **Google Font — loaded for wordmark, headings, and game over text only.** Modern, rounded, distinctive. Loaded via `font-display: swap`, ~15KB. Used on: "Numbskull" title, "YOU WIN/LOSE", result screen headers, badge names |
| **"?" Glyph** | `Georgia, 'Times New Roman', serif` | Bold (700) | Serif "?" on skull — distinct from body text, gives intellectual personality |
| **UI body text** | `system-ui, -apple-system, sans-serif` | Regular (400) / Medium (500) | All labels, buttons, paragraphs, roast messages |
| **In-game numbers** | `'SF Mono', 'Cascadia Code', 'Consolas', monospace` | Regular (400) | Guess display, range, timer — **tabular figures** (`font-variant-numeric: tabular-nums`) — numbers don't jump when changing |
| **Tagline** | system sans-serif | Regular (400) | 13–14px, color `#AFA9EC` — *"The number game that roasts you."* |
| **Roast messages** | system sans-serif | Medium (500) / *Italic* | Roast copy displayed in italic to distinguish from UI text — *"Fine. You got lucky."* |

**Font loading strategy:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&display=swap" rel="stylesheet">
```
Single font family, 2 weights = ~15KB. Only used for display text (≤10 elements per screen).

---

#### 6.6.3 Motion Tokens (Expanded — 14 animations)

**Original 7:**

| Animation | Spec | Usage |
|-----------|------|-------|
| **Logo entrance** | Scale 0.8→1, opacity 0→1, 400ms ease-out | Loading screen, home screen |
| **Button tap** | Scale to 0.96, 80ms | All interactive buttons |
| **Wrong guess shake** | Horizontal ±6px, 300ms | Incorrect guess feedback |
| **Correct guess pulse** | Scale 1→1.12→1, 250ms | Correct guess feedback |
| **Screen transitions** | Slide-up 20px + fade, 220ms | Page navigation |
| **Progress bar fill** | Left-to-right, linear | Loading bar, timer bar |
| **Room counter pulse** | Scale pulse every 10s | Live room count badge |

**New 7 (added by veteran review):**

| Animation | Spec | Usage |
|-----------|------|-------|
| **Number roll** ★ | Digits scroll vertically like slot machine, 400ms | Score counters, timer, attempt count, leaderboard positions |
| **Card flip** ★ | 3D Y-axis rotate 0→180°, 350ms | B&C result reveal, badge unlock |
| **Slide-in from right** ★ | TranslateX(100%)→0, 250ms ease-out | Guess history entry appearing |
| **Bounce land** ★ | TranslateY(-20px)→0 with overshoot, 400ms cubic-bezier(0.34, 1.56, 0.64, 1) | Badge unlock, achievement pop, first-win celebration |
| **Glow pulse** ★ | Box-shadow `--color-juice` opacity 0→0.6→0, 1.5s infinite | Active player indicator, "your turn" border, skull roast glow |
| **Backdrop blur** ★ | Backdrop-filter blur 0→8px, 200ms | Modal/overlay backgrounds |
| **Stagger reveal** ★ | Each child delays 50ms × index, slide-up + fade | Leaderboard rows, guess history on load, badge collection |

**Reduced motion support:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
Also respects the in-game "Animations: Full/Reduced/Off" setting.

**Easing Curve Vocabulary (CSS custom properties):** ★

| CSS Variable | Value | Usage |
|-------------|-------|-------|
| `--ease-standard` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | On-screen position changes, general transitions |
| `--ease-enter` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Elements entering screen (decelerate) |
| `--ease-exit` | `cubic-bezier(0.4, 0.0, 1, 1)` | Elements leaving screen (accelerate) |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy entrances (badge earn, first-win) |
| `--ease-elastic` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Extra springy (badge earn, number reveal) |
| `--ease-sharp` | `cubic-bezier(0.4, 0.0, 0.6, 1)` | Quick state changes (button tap, toggle) |

**Rule:** Never use bare `ease` or `ease-in-out` — always use the named variables for consistency across the entire app.

---

#### 6.6.4 App Icon / Logo (Redesigned ★)

> [!CAUTION]
> The original design brief skull (circle + "?" + two rectangles) fails the "squint test" — at 32px it's an unreadable purple blob. The following redesign gives it **character, recognition, and personality**.

**Redesigned Numbskull Skull:**

```
Original (4 shapes):          Redesigned (expressive):
    ┌─────────┐                   ┌─────────┐
    │    O    │  plain circle     │  ◉   ◉  │  dark eye sockets
    │    ?    │                   │    ▽    │  nose cavity
    │         │                   │    ?    │  "?" floating in mouth area
    │   ▬▬   │  floating jaw     │  ┌┬┬┬┐  │  integrated teeth row
    └─────────┘                   │  └┴┴┴┘  │  connected jawline
                                  └─────────┘
```

**Redesigned icon spec:**

| Element | Spec |
|---------|------|
| **Background** | `#26215C` (unchanged) |
| **Skull body** | `#534AB7` rounded-rect with slight top bulge (cranium wider than jaw) — NOT a perfect circle |
| **Eye sockets** | Two `#1C1842` (deep bg color) ellipses — gives instant "skull" recognition even at 16px |
| **Left eyebrow** | Subtle raised arch on one side (asymmetric) — gives personality, looks "judging you" |
| **Nose** | Small inverted triangle `#3C3489`, centered between eyes and mouth |
| **"?" glyph** | Serif bold "?" in `#EEEDFE`, positioned in mouth/chin area. At 1024px: subtle `#00F5FF` (cyan) text-shadow glow |
| **Teeth** | 3–4 small white `#EEEDFE` rectangles in a connected row, anchored to jaw. NOT floating |
| **Jaw** | Connected to skull body (same `#534AB7`), narrower than cranium, rounded bottom |
| **Ring** | 1.5px `#7F77DD` stroke at 1024px/512px. Dropped at smaller sizes |
| **Corner radius** | 22% (iOS standard) |
| **Safe zone** | 10% inset on all sides |
| **Export sizes** | 1024px, 512px, 180px, 120px, 76px, 64px, 32px, 16px (favicon) |

**Personality states** (used as inline emoji throughout the UI):

| State | Expression | Used When |
|-------|-----------|-----------|
| 💀 **Default** | Neutral smirk, one eyebrow raised | Home screen, loading |
| 😏 **Judging** | Both eyebrows raised, slight grin | After wrong guess, during roast |
| 😤 **Annoyed** | Furrowed brow, gritted teeth | When player uses hint |
| 🤝 **Grudging respect** | Slight nod, softer eyes | When player wins |
| 😈 **Evil glee** | Wide grin, narrow eyes | When player is losing badly |
| 💀✨ **Impressed** | Eyes widen, cyan glow pulse | First-guess win, perfect efficiency |

> [!NOTE]
> These expression variants are SVG variations of the same base skull, not separate images. The differences are: eyebrow angle (CSS transform on a path), mouth shape (path d-attribute swap), and glow presence (CSS filter). Total ~5 SVGs, each ~1KB.

**Expression transition animation:** ★ (added by animation engineer review)
- **Method:** Cross-fade — two SVGs stacked (position: absolute), outgoing fades to `opacity: 0`, incoming fades to `opacity: 1`
- **Duration:** 250ms, `var(--ease-standard)`
- **Implementation:**
```css
.skull-expression {
  position: absolute;
  inset: 0;
  transition: opacity 250ms var(--ease-standard);
}
.skull-expression[data-active="false"] { opacity: 0; pointer-events: none; }
.skull-expression[data-active="true"]  { opacity: 1; }
```
- **"?" glyph:** Stays persistent across all expressions (separate layer, never fades)
- **Cyan glow:** Only on `Impressed` state — animated via `text-shadow: 0 0 12px var(--color-juice)` with 1.5s pulse

---

#### 6.6.5 Home Screen (Enhanced with Visual Storytelling ★)

**Before (design brief):** Stack of rectangles — functional but lifeless.
**After:** The skull commands the screen. The environment feels alive.

**Enhanced home screen layout:**

```
┌──────────────────────────────┐
│  9:41                  100%  │  ← status bar
│                              │
│     ╭───────────────╮        │
│     │    ◉     ◉    │        │  ← LARGE skull (120px)
│     │      ▽        │        │     eye sockets glow subtly
│     │      ?        │        │     "?" pulses with --color-juice
│     │   ┌┬┬┬┬┐      │        │
│     ╰───┴┴┴┴┴───────╯        │
│                              │
│        Numbskull             │  ← Outfit ExtraBold, 28px
│  The number game that        │  ← 13px, #AFA9EC
│       roasts you.            │
│                              │
│  ┌─ 🎯 Guess The Number ──┐ │  ← Game mode selector tabs
│  └─ 🐂 Bulls & Cows 🔒 ──┘ │     B&C locked if not unlocked
│                              │
│  ┌──────────────────────────┐│
│  │   ▶  Create Room         ││  ← Primary CTA, solid purple
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │   ⊞  Join Room           ││  ← Secondary, outlined
│  └──────────────────────────┘│
│  ┌─────────┐ ┌──────────────┐│
│  │  vs AI  │ │Daily Challnge││  ← Tertiary pair, ghost
│  └─────────┘ └──────────────┘│
│                              │
│  🔴 12 games live     [Watch]│  ← Ambient live count (not a card)
│                              │
│ ┌──Weekly Quests────────────┐│
│ │ 🎯 Win 5 games  ████░░ 3/5│  ← Quest progress (if logged in)
│ └───────────────────────────┘│
│                              │
│  ⌂      ☰      ★      ◎    │  ← Bottom nav
└──────────────────────────────┘
```

**Ambient atmosphere (CSS-only, no canvas):**
- **Floating particles**: 15–20 small `?` symbols and digits (`0-9`) in `#3C3489` (20% opacity), drifting upward at varied speeds via CSS `@keyframes float`. Creates a "numbers are alive" feel.
- **Skull eye glow**: The two eye sockets have a subtle cyan (`#00F5FF`, 10% opacity) inner glow that pulses every 5 seconds.
- **"?" glyph animation**: The serif "?" in the skull slowly cycles through a subtle glow: no glow → cyan glow → no glow (3s cycle, CSS `text-shadow` animation).
- **Live room counter**: Displayed as ambient text (not a card), pulses every 10s with a number-roll animation.

---

#### 6.6.6 Game Board Wireframes ★

##### 🎯 GTN Game Board (Mobile Portrait)

```
┌──────────────────────────────┐
│  ⏸  Player1 vs Player2  🟢  │  ← Header: pause, names, connection dot
│  Round 2/3 | Attempt 4/10    │
│──────────────────────────────│
│                              │
│        ┌──────────┐          │
│        │  ⏱ 0:42  │          │  ← Circular timer ring (top, always visible)
│        └──────────┘          │
│                              │
│  ┌──────────────────────────┐│
│  │  💀 "Too bold. Aim lower."││  ← Skull feedback area (center, LARGEST)
│  │     ▼ TOO HIGH ▼         ││     Skull emoji + roast text + direction
│  │  ████████████░░░░░  warm  ││     Proximity warmth bar
│  └──────────────────────────┘│
│                              │
│  Range: [23 ─────────── 67]  │  ← Dynamic range bar (compact)
│                              │
│  ┌─ Guess History ──────────┐│
│  │  #4  56  ▼ Too High 🔴   ││  ← Most recent = highlighted
│  │  #3  34  ▲ Too Low  🔵   ││     Slide-in animation
│  │  #2  72  ▼ Too High 🔴   ││     Scrollable if many
│  │  #1  50  ▲ Too Low  🔵   ││
│  └──────────────────────────┘│
│                              │
│  ┌──────────────────────────┐│
│  │  Enter guess: [____]  ▶  ││  ← Input + submit (bottom, near thumb)
│  │  💡 Hint (1/2)            ││     Hint button below input
│  └──────────────────────────┘│
└──────────────────────────────┘
```

**Visual hierarchy:** Timer (small, top) → Skull feedback (large, center, bold) → Input (bottom, accessible) → History (scrollable, between)

##### 🐂 B&C Game Board (Mobile Portrait)

```
┌──────────────────────────────┐
│  ⏸  Player1 vs Player2  🟢  │  ← Header
│  Round 1/3 | Guess 3/10     │
│──────────────────────────────│
│                              │
│        ┌──────────┐          │
│        │  ⏱ 0:38  │          │  ← Timer ring
│        └──────────┘          │
│                              │
│  ┌──────────────────────────┐│
│  │  💀 "Right digits,       ││  ← Skull feedback (center)
│  │      wrong address."     ││
│  │     🐂×1  🐄×2           ││     Bulls green, cows yellow
│  └──────────────────────────┘│
│                              │
│  ┌─ Digit Tracker ──────────┐│
│  │ 0✅ 1❓ 2❓ 3❓ 4❌       ││  ← 10-digit elimination grid
│  │ 5❓ 6❓ 7❓ 8❌ 9❓       ││     Auto-updates from history
│  └──────────────────────────┘│
│                              │
│  ┌─ Guess History ──────────┐│
│  │  #3  1325  🐂1 🐄2  ●●○ ││  ← Color-coded feedback
│  │  #2  5678  🐂0 🐄1  ○○○ ││     Most recent highlighted
│  │  #1  1234  🐂1 🐄1  ●○○ ││
│  └──────────────────────────┘│
│                              │
│  ┌──────────────────────────┐│
│  │  [_] [_] [_] [_]     ▶  ││  ← 4 individual digit inputs
│  │  💡 Hint (0/1)    🃏Bluff ││     Auto-advance between fields
│  └──────────────────────────┘│
└──────────────────────────────┘
```

**Information density control (when mobile keyboard visible):**
1. Guess history collapses to last 2 entries only (expandable chevron)
2. Digit tracker becomes single-line inline: `✅0 ❌48 ❓1235679`
3. Timer shrinks to inline text in header
4. Skull feedback area shrinks to single line

---

#### 6.6.7 Badge Visual Design System ★

**Badge shape:** Hexagonal (gaming standard — Xbox achievements, Duolingo).

**Badge states:**

| State | Visual Treatment |
|-------|-----------------|
| **Locked** | Greyscale hexagon, 40% opacity, 🔒 padlock overlay, condition text below |
| **Earned** | Full color hexagon, `--color-accent-primary` border, badge emoji centered, name below |
| **Newly earned** | Full color + `--color-juice` (#00F5FF) pulsing border glow for 5 seconds, bounce-land animation |
| **Rare badge** | Gold `#FFD700` border instead of purple (for badges held by <5% of players) |

**Badge earn animation sequence (1.5s total):**
1. Badge hexagon flies in from top of screen (300ms, ease-out)
2. Lands in center with bounce overshoot (400ms, cubic-bezier)
3. Radial glow burst from center (200ms, cyan + purple)
4. Badge emoji scales 0→1.2→1 (300ms)
5. Name text fades in below (300ms)
6. Skull says congratulatory roast (text fades in)

**Badge shelf layout (profile page):**
```
┌──────────────────────────────┐
│  🏆 Badges (7/17)           │
│                              │
│   ⬡ First    ⬡ Speed    ⬡   │  ← 3-column hex grid
│     Blood      Demon    ?   │     with stagger reveal
│                              │
│    ⬡ Code    ⬡ Streak   ⬡   │
│     Breaker    Master   ?   │     Locked = grey + padlock
│                              │
│   ⬡ Ghost   ⬡           ⬡   │
│     Buster   (locked)   ?   │
└──────────────────────────────┘
```

---

#### 6.6.8 Share Card Design ★

The share card is the game's **marketing material** — it's what non-players see on social media.

**Design spec:**

```
┌──────────────────────────────────┐
│                                  │  1200×630 (link preview)
│   💀  NUMBSKULL                  │  or 1080×1920 (story)
│                                  │
│   ┌──────────────────────────┐   │
│   │  🎯 Guess The Number     │   │  ← Game mode badge
│   │                          │   │
│   │  Player cracked it in    │   │
│   │     ██  3  ██            │   │  ← Large number, Outfit font
│   │      guesses             │   │
│   │                          │   │
│   │  ⏱ 42 seconds            │   │
│   │  📊 Efficiency: 100%     │   │
│   │                          │   │
│   │  ┌────────────────────┐  │   │
│   │  │ 🧠 PERFECT         │  │   │  ← Performance stamp (rotated -5°)
│   │  └────────────────────┘  │   │     Cyan border, semi-transparent
│   └──────────────────────────┘   │
│                                  │
│   💀 "Mathematically perfect.    │  ← Skull roast quote
│       I hate you."              │
│                                  │
│   ▶ Can you beat this?          │  ← CTA text
│   numbskull.gg/play/SEED123     │  ← Play link
│                                  │
│   [QR CODE]                      │  ← QR code to play link
└──────────────────────────────────┘
```

**Background:** Gradient `#1C1842` → `#26215C` (diagonal, not flat — looks better on social feeds)

**Performance stamps (each has distinct color):**

| Stamp | Color | Trigger |
|-------|-------|---------|
| 🧠 PERFECT | Cyan `#00F5FF` | 100% efficiency |
| 🎯 FIRST GUESS | Gold `#FFD700` | Won on first guess |
| 📈 COMEBACK | Purple `#7F77DD` | Lost round 1, won match |
| 🔥 ON FIRE | Orange `#FF6B35` | Win streak ≥5 |
| 🤖 AI CRUSHER | Red `#F87171` | Beat Hard AI in ≤5 |

**Two sizes generated:**
- **1200×630px** — Open Graph / link preview (Twitter, Discord, Slack)
- **1080×1920px** — Instagram/TikTok Story format

**Implementation:** Generated client-side using HTML Canvas → `.toDataURL('image/png')`. No server required.

---

#### 6.6.9 Responsive Desktop Layout ★

Mobile mockups ≠ desktop reality. A 210px-wide layout stretched to 1440px looks absurd.

**Desktop layout (≥1024px):**

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ╭ floating ?s ╮    ┌──────────────┐   ╭ floating  ╮│
│   │  and digits  │    │              │   │ particles ││
│   │  drifting    │    │   GAME       │   │ ambient   ││
│   │  upward      │    │   PANEL      │   │ numbers   ││
│   │  (atmosphere)│    │  max-480px   │   │           ││
│   │              │    │              │   │           ││
│   │  skull eye   │    │  (identical  │   │  skull    ││
│   │  glow left   │    │   to mobile  │   │  eye     ││
│   │              │    │   layout)    │   │  glow    ││
│   │              │    │              │   │  right   ││
│   ╰──────────────╯    └──────────────┘   ╰──────────╯│
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Rules:**
- Game panel: `max-width: 480px`, centered, with `#26215C` card background and subtle border
- Side atmosphere: floating particles (CSS `@keyframes float`), semi-transparent numbers/question marks drifting upward
- Desktop nav: horizontal top bar instead of bottom bar
- Background: `#1C1842` extends to full width — game feels like a "card table" in a dark room
- No horizontal stretching of game components — everything stays at mobile proportions inside the centered panel

**Tablet (768–1023px):**
- Same centered panel but max-width: 420px
- Bottom nav retained
- No side atmosphere (not enough space)

---

#### 6.6.10 Tone of Voice (Sarcastic Roast Copy)

The game's personality is **snarky, deadpan, and mildly insulting** — the "roast" is the hook. This is the brand's #1 differentiator (scored 9/10 in design review).

| Game Event | Display Message |
|-----------|----------------|
| Wrong guess (generic) | *"Nope. Try harder."* |
| Too high | *"Too bold. Aim lower."* |
| Too low | *"Not even close. Higher."* |
| Correct guess | *"Fine. You got lucky."* |
| Win screen | *"Winner. Don't get used to it."* |
| Loss screen | *"Classic Numbskull move."* |

> [!IMPORTANT]
> These copy strings must be stored in a centralized `constants/copy.js` file (i18n-ready) so they can be extended with variant messages per event (e.g., multiple "too high" lines chosen at random for freshness). Roast messages are displayed in **italic** (medium weight) to visually distinguish from UI text.

---

#### 6.6.11 General Design Principles

- **Dark-first**: No light theme in v1 — deep purple space aesthetic throughout
- **No glassmorphism**: Clean solid cards with subtle borders, not blur effects
- **Mobile-first**: All mockups are mobile-portrait; desktop gets centered panel + atmosphere
- **Responsive**: CSS Grid for game layout, flexbox for components, mobile-first breakpoints (0–767 / 768–1023 / 1024+)
- **Juice sparingly**: `--color-juice` (#00F5FF) used ONLY at peak emotional moments — never in default UI
- **Personality through the skull**: The skull's expression changes contextually — it's the mascot, not a static logo
- **Ambient life**: Floating particles, pulsing glows, and number-roll animations make every screen feel alive

---

### 6.7 🐂 Bulls & Cows — Mode-Specific Design

#### B&C Tone of Voice (Sarcastic Roast Copy)

| Game Event | Display Message |
|-----------|----------------|
| 0 Bulls, 0 Cows | *"Swing and a miss. Completely."* |
| 0 Bulls, some Cows | *"Right digits, wrong address."* |
| Some Bulls, 0 Cows | *"Broken clock territory."* |
| Close (3 Bulls) | *"So close it hurts. Well, hurts you."* |
| Correct (4 Bulls) | *"Fine. You cracked it. Barely."* |
| Loss screen | *"Codebreaker? More like code fumbler."* |

#### B&C-Specific Badges

| Badge | Condition |
|-------|-----------|
| 🐂 Code Breaker | Crack a B&C code in ≤ 5 guesses |
| 🧠 Mind Reader | Crack a B&C code on the first guess |

These are added to the existing 11 badges from the BRD, bringing the total to **13 badges**.

#### B&C Difficulty Presets

| Preset | Code Length | Allow Repeats | Timer | Hints |
|--------|-----------|---------------|-------|-------|
| Easy | 3 digits | No | 90s | 2 |
| Medium | 4 digits | No | 60s | 1 |
| Hard | 4 digits | Yes (repeats allowed) | 30s | 0 |
| Custom | 3–6 digits | Configurable | 15–300s | 0–3 |

> [!NOTE]
> When "Allow Repeats" is enabled on Hard difficulty, the candidate set grows from 5,040 to 10,000 — significantly harder. The AI adjusts its algorithm accordingly.

#### B&C-Specific UI Components

| Component | Description |
|-----------|------------|
| `DigitInput` | 4 individual digit input fields (0–9) with auto-advance to next field on input. Monospace tabular figures, large font. |
| `BullsCowsFeedback` | Row showing 🐂×N 🐄×M with color coding (green = bulls, yellow = cows). Shake animation on 0B 0C. |
| `DigitTracker` | 10-digit grid (0–9) showing status: ✅ confirmed in code, ❌ eliminated, ❓ unknown. Auto-updates based on guess history. |
| `B&C GuessHistory` | Table: Guess | Bulls | Cows, with color-coded cells. Most recent guess at top. |

#### B&C Share Format

```
🐂 Numbskull — Bulls & Cows
🐂🐂🐄 → 🐂🐂🐂🐄 → 🐂🐂🐂🐂
Cracked in 5 guesses | 42s
```

---

### 6.8 ★ Unique Differentiating Features — Detailed Design

These 9 features are Numbskull exclusives — not found in the BRD or any competitor.

---

#### 6.8.1 🧠 Numbskull Personality Evolution (Phase 1)

The game's sarcastic AI evolves its relationship with the player based on total games played.

**Personality Tiers:**

| Tier | Games Played | Tone | Example Message (correct guess) |
|------|-------------|------|------|
| **Hostile** | 1–10 | Pure contempt | *"Fine. You got lucky."* |
| **Grudging** | 11–50 | Reluctant acknowledgment | *"Okay, that wasn't completely terrible."* |
| **Backhanded** | 51–100 | Sarcastic respect | *"Look at you, almost competent. I'm concerned."* |
| **Rivalry** | 100+ | Competitive equal | *"Alright. I'll admit it. That was annoyingly good."* |

**Implementation:**
- `constants/personality.js`: Object mapping `{ tier → { event → [message_variants] } }`
- Each event (too_high, too_low, correct, win, loss) has 5–8 message variants per tier
- Message selected randomly from the tier's variants for freshness
- Player's tier determined by `gamesPlayed` count (localStorage for guests, DB for registered)
- Tier badge displayed next to game feedback: 💀 (Hostile), 😒 (Grudging), 🤨 (Backhanded), 🤝 (Rivalry)

**Data storage:**
- Guest: `localStorage.getItem('numbskull_games_played')`
- Registered: `users.total_games_played` column

---

#### 6.8.2 📊 Post-Game Roast Report (Phase 3)

After every game, display the **mathematically optimal strategy** compared to the player's actual performance.

**GTN Optimal Path Calculator:**
```
function calculateOptimalPath(min, max, secret):
  guesses = []
  while min <= max:
    mid = Math.floor((min + max) / 2)
    guesses.push(mid)
    if mid === secret: break
    if mid < secret: min = mid + 1
    else: max = mid - 1
  return guesses  // binary search path
```

**B&C Optimal Path:**
- Run Knuth's algorithm against the same secret → returns the optimal guess sequence
- Pre-computed during game (server already has the engine)

**UI Layout:**
```
┌──────────────────────────────────────┐
│         📊 ROAST REPORT              │
├──────────────────────────────────────┤
│  Your guesses:   42 → 78 → 56 → 63 ✓│
│  Optimal path:   50 → 75 → 63 ✓     │
│                                      │
│  You: 4 guesses  |  Optimal: 3       │
│  Efficiency: 75%                     │
│                                      │
│  💀 "One extra guess. One. You were  │
│  THIS close to not embarrassing      │
│  yourself."                          │
│                                      │
│  [Share Roast Report]  [Play Again]  │
└──────────────────────────────────────┘
```

**Roast Report Copy (by gap):**

| Gap (actual - optimal) | Message |
|------------------------|---------|
| 0 (perfect) | *"Mathematically perfect. I hate you."* |
| 1 | *"One extra guess. One. So close to not embarrassing yourself."* |
| 2–3 | *"A robot would've done this faster. Just saying."* |
| 4–5 | *"Were you guessing or just mashing buttons?"* |
| 6+ | *"I've seen better strategy from a coin flip."* |

**Data:** Stored as part of game result JSON. Share button generates a PNG card.

---

#### 6.8.3 👻 Ghost Mode (Phase 3)

Race a replay of your own best game. The ghost's guesses appear in real-time as a translucent overlay.

**How it works:**
1. After each completed game, store the guess sequence + timestamps: `[{guess, timestamp_ms}, ...]`
2. When player starts Ghost Mode, load their best game (fewest guesses) for that difficulty
3. During play, ghost's guesses appear on a parallel timeline at the same relative timestamps
4. Ghost panel is semi-transparent (opacity: 0.4) with a 👻 label

**Data storage:**
- `GameReplay` model: `{ replay_id, user_id, game_mode, difficulty, guesses: JSONB, duration_ms }`
- Guest: top 3 replays stored in localStorage
- Registered: top 10 replays stored server-side

**UI:** Split-screen or overlay showing:
- Left: Your current game (full opacity)
- Right/overlay: Ghost's game (40% opacity, slightly smaller)
- Header: "Can you beat yourself? Ghost's best: 4 guesses in 32s"

**Badge:** 🏆 *Self-Improvement* — beat your own ghost 10 times

---

#### 6.8.4 😤 Pressure Meter (Phase 1 single-player, Phase 2 multiplayer)

Shows real-time thinking time with sarcastic commentary.

**Single-player version:**
- Tracks seconds since last guess
- At 10s: displays thinking timer
- At 20s: *"Still thinking? The AI solved this in 1.2 seconds."*
- At 30s: *"Even the Easy AI is embarrassed for you."*
- At 45s: *"At this point, just use the hint."*

**Multiplayer version:**
- After opponent submits a guess, show their response time
- *"Your opponent guessed in 2.3 seconds."*
- If your time exceeds 3× opponent's time: *"Your opponent guessed in 2.3s. You've been staring for 47s. No pressure."*
- Visible to both players (creates psychological pressure)

**Implementation:**
- Client-side timer (no server overhead)
- `thinkingTime` state tracked per turn in `GameContext`
- Socket event `guess_result` includes `responseTime` field (server calculates per guess)

---

#### 6.8.5 🎵 Musical Guess Feedback — Corrected ★ (Phase 1)

Each guess plays a musical note based on proximity to the answer. Uses **logarithmic pitch mapping** (human pitch perception is logarithmic, not linear) and **snaps to real musical notes** (never microtonal).

**GTN Pitch Mapping (logarithmic + note-snapped):**
```javascript
// Chromatic scale from A3 to A5 (15 notes)
const NOTES = [220, 247, 262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784, 880];
//             A3   B3   C4   D4   E4   F4   G4   A4   B4   C5   D5   E5   F5   G5   A5

function getNote(guess, secret, min, max) {
  const distance = Math.abs(guess - secret) / (max - min); // 0 = correct, 1 = max distance
  const proximity = 1 - distance;
  
  // Logarithmic mapping: each step closer feels equally significant
  // NOT linear (220 + proximity * 660) — that sounds wrong to human ears
  const index = Math.round(proximity * (NOTES.length - 1));
  return NOTES[index]; // Always a real musical note — never microtonal
}

// Correct guess: play C major chord (C4-E4-G4 simultaneously) — see §6.14.4 for ADSR
```

**B&C Pitch Mapping (musical intervals, not Hz offsets) ★:**

> [!WARNING]
> Original spec used `+200Hz per bull / +100Hz per cow`. This creates microtonal dissonance (220Hz + 200Hz = 420Hz — NOT a musical note). Fixed to use proper musical intervals.

| Result | Notes Played | Musical Interval | Emotional Feel |
|--------|-------------|-----------------|----------------|
| 0B 0C | A3 (220Hz) alone | Unison | Empty, lonely |
| 0B 1C | A3 + C4 (262Hz) | Minor 3rd | "Something, but wrong" |
| 0B 2C | A3 + C4 + D4 (294Hz) | Minor cluster | Building, uncertain |
| 1B 0C | A3 + E4 (330Hz) | Perfect 5th | Strength, progress |
| 1B 1C | A3 + C4 + E4 | Minor triad | Mixed — some right, some close |
| 2B 0C | A3 + E4 + A4 (440Hz) | Power chord (5th + octave) | Getting somewhere |
| 2B 1C | A3 + C#4 + E4 | Major triad (partial) | Warmer, hopeful |
| 2B 2C | A3 + C#4 + E4 + G#4 | Major 7th | Almost there — tension |
| 3B 0C | A4 + C#5 + E5 | Full major triad (higher register) | SO close — bright |
| 3B 1C | A4 + C#5 + E5 + G5 | Major triad + 7th | One away — rich tension |
| 4B 0C ✅ | A4 + C#5 + E5 + A5 | Major chord + octave | **Resolution. Satisfaction.** |

**Implementation:** Hybrid approach — see §6.14 for full AudioManager spec.
- Procedural synthesis (OscillatorNode + ADSR) for proximity pitch — 0 file overhead
- Pre-recorded samples for celebration chords and fanfares — better quality
- All sounds go through AudioManager channels — never raw `oscillator.connect(destination)`
- Toggleable in Settings → "Musical Feedback: On/Off"
- Respects "Sound Effects Off" and "Reduced Motion" settings

---

#### 6.8.6 🏟️ Replay Theater (Phase 4)

A "Top Games Today" feed on the home screen showcasing the most interesting games.

**Selection Algorithm:**
Games are scored and the top 10 per day are featured:

| Signal | Score Weight |
|--------|------------|
| Margin of victory = 1 guess | +50 |
| Comeback win (lost round 1, won match) | +40 |
| Speed record (fastest game today) | +30 |
| First-guess win | +100 |
| Game went to tiebreaker | +35 |
| High spectator count | +20 |

**Data:** `FeaturedGame` model: `{ date, game_id, score, highlights: JSONB }`

**Replay Playback:**
- Stored guess sequences replayed step-by-step with 1.5s intervals
- Players shown as "Player A" / "Player B" (anonymized unless public profile)
- Viewer can speed up (1×, 2×, 4×) or skip to next guess
- No live data — replays are pre-computed snapshots

**UI:** Horizontal card carousel on home screen: "🏟️ Today's Best Games"

---

#### 6.8.7 🃏 Bluff Round — B&C Only (Phase 3)

Once per match, a player can activate **Bluff** to send one fake bulls/cows result.

**Rules:**
- Each player gets **1 Bluff per match** (shown as a "🃏 Bluff" button, lights up when available)
- When activated on a guess, the player **manually enters fake B&C feedback** instead of the server sending real feedback
- The opponent sees the guess result normally but also sees a banner: *"⚠️ One of your opponent's clues may be fake."*
- The bluff indicator appears after the first bluff is used (not before — no premature suspicion)
- The bluffing player's own guess history shows the real result (only opponent sees fake)

**Server enforcement:**
- Server tracks `bluffUsed: boolean` per player per match
- Bluff feedback is stored separately; real feedback is used for server-side game logic
- At game end, "Bluff Reveal" screen shows which clue was fake

**Badge:** 🃏 *Poker Face* — win a game where your bluff wasn't detected (opponent guessed wrong based on fake clue)

---

#### 6.8.8 🎃 Seasonal Events & Mutators (Phase 7)

Time-limited game modes with special rules and themed UI.

**Mutators:**

| Mutator | Rule Change | Duration |
|---------|------------|----------|
| **Reverse Numbskull** | Feedback is inverted: "Too High" actually means too low and vice versa | 1 week |
| **Fog of War** | Guess history disappears after 3 turns — rely on memory | 1 week |
| **Speed Demon** | 10-second turn timer only. No hints. | Weekend event |
| **Double Bluff** (B&C) | Each player gets 2 bluffs instead of 1 | 1 week |
| **Narrowing Range** (GTN) | Range shrinks by 5 from both ends each turn even on wrong guesses | 1 week |

**Implementation:**
- `GameMutator` config flag on room/game: `mutators: ['reverse_feedback', 'fog_of_war']`
- Server-side mutator middleware wraps the engine's `evaluateGuess` output
- Active mutators shown on home screen with countdown timer
- Special themed badges: 🎃 *Night Owl Halloween*, ❄️ *Frostbite December*, etc.

**Admin panel:** Daily challenge admin can configure active mutators and their date range.

---

#### 6.8.9 🤯 "Are You Smarter Than Numbskull?" — Reverse Challenge (Phase 7)

The player sets the secret and watches the AI try to guess it. The player provides feedback.

**Flow:**
1. Player picks a secret number (GTN) or 4-digit code (B&C)
2. AI makes guesses; player taps "Higher" / "Lower" (GTN) or enters bulls/cows (B&C)
3. Server validates player's feedback is consistent (no cheating / contradictory feedback)
4. If AI solves it in ≤ optimal moves → *"See? That's how it's done."*
5. If player gives inconsistent feedback (caught lying) → *"Nice try. I caught you cheating. Classic Numbskull."*
6. If AI takes more than optimal → *"Okay, you actually stumped me. Don't get cocky."*

**Badge:** 🤯 *AI Whisperer* — make the AI take 3+ extra guesses beyond optimal without cheating

**Educational value:** Players learn optimal strategy by watching the AI play, then try to replicate it.

---

#### Unique Feature Badges Summary

| Badge | Feature | Condition |
|-------|---------|-----------|
| 🏆 Self-Improvement | Ghost Mode | Beat your own ghost 10 times |
| 🃏 Poker Face | Bluff Round | Win where opponent guessed wrong based on your bluff |
| 🤯 AI Whisperer | Reverse Challenge | Make AI take 3+ extra guesses without cheating |
| 👻 Ghost Buster | Ghost Mode | Beat your ghost on first attempt |

These join the 11 BRD badges + 2 B&C badges = **17 total badges**.

---

### 6.9 Real-Time Multiplayer UX Design

Detailed design for all multiplayer UX features added from the gameplay audit.

---

#### 6.9.1 ⚡ Quick Match (Phase 2)

Instant matchmaking for players who don't want to browse or create rooms.

**Flow:**
1. Player taps "Quick Match" on home screen → selects game mode (GTN/B&C) and difficulty
2. Client sends `POST /api/matchmaking/queue` → server adds player to matchmaking queue
3. Server pairs two players with similar MMR (±200 points) or, if none available after 10s, expands range
4. Server auto-creates a room with default config → emits `room_created` to both players → both join lobby
5. If no match found after 15s: *"No opponents found. Create a room instead?"* with [Create Room] / [Keep Waiting] options
6. Player can cancel queue with `DELETE /api/matchmaking/queue`

**Data:** `MatchmakingQueue` (in-memory + Redis): `{ user_id, game_mode, difficulty, mmr, queued_at }`

**UI:** Pulsing "Searching for opponent..." animation with elapsed timer and [Cancel] button.

---

#### 6.9.2 3-2-1 Game Start Countdown (Phase 2) — Full Choreography ★

**Trigger:** Host clicks "Start Game" and both players are ready.

**Server flow:**
1. Server emits `game_countdown` event with `{ countdown: 3 }`
2. Client shows full-screen overlay with backdrop blur (`var(--ease-enter)`, 200ms)

**Per-number beat choreography (700ms each):**

| Phase | Time | Animation | Easing |
|-------|------|-----------|--------|
| **Entrance** | 0–200ms | Scale 0.5→1.1 (overshoot) + opacity 0→1 | `var(--ease-bounce)` |
| **Settle** | 200–350ms | Scale 1.1→1.0 | `var(--ease-standard)` |
| **Hold** | 350–500ms | Number visible at scale 1.0 (read time) | — |
| **Exit** | 500–700ms | Opacity 1→0 + scale 1.0→0.8 | `var(--ease-exit)` |

**Background ripple:** On each beat, a circular ripple expands outward from center (scale 0→3, opacity 0.3→0) in `--color-accent-glow` at 20% opacity. Creates a rhythmic pulse effect.

**"GO!" beat (400ms):**

| Phase | Time | Animation | Easing |
|-------|------|-----------|--------|
| **Entrance** | 0–150ms | Scale 0→1.3 (bigger overshoot than numbers) | `var(--ease-elastic)` |
| **Settle** | 150–250ms | Scale 1.3→1.0 | `var(--ease-standard)` |
| **Flash** | 250–400ms | `--color-juice` text glow flash (text-shadow 0→12px→0) | `var(--ease-sharp)` |

**Post-"GO!" (300ms):** Entire overlay fades out with `var(--ease-exit)`. Game board slides up underneath with `var(--ease-enter)`.

**Audio sync:** Each number beat triggers a rising pitch: "3" = C4, "2" = E4, "1" = G4, "GO!" = C5 chord. Each tone lasts exactly 700ms (matches visual beat).

**Total duration:** 3 × 700ms + 400ms + 300ms = **2.8 seconds**

**Interruption rule:** If opponent disconnects during countdown, all animations cancel immediately (`.getAnimations().forEach(a => a.cancel())`), overlay fades out, and disconnection message appears.

---

#### 6.9.3 Waiting States (Phase 2)

Critical "in-between" UI states that prevent confusion:

| Moment | What Player Sees |
|--------|-----------------|
| Submitted secret, waiting for opponent | *"Secret locked in ✓. Waiting for opponent..."* + pulsing dots animation |
| Opponent's turn | *"Opponent is thinking..."* + subtle brain emoji animation |
| Opponent submitted guess, before result | *"Opponent guessed!"* flash (300ms) before result card slides in |
| Between rounds (intermission) | Score cards + countdown bar (10s) + reaction buttons active |
| Waiting for rematch response | *"Rematch request sent. Waiting..."* + 15s countdown |

Each state has its own visual treatment to prevent "is the game frozen?" confusion.

---

#### 6.9.4 Rematch Flow (Phase 2)

**After match ends:**
1. Result screen shows [Rematch] [Play Again] [Share] [Home]
2. Player A taps **Rematch** → client emits `request_rematch`
3. Server emits `rematch_requested` to Player B
4. Player B sees modal: *"Player A wants a rematch! [Accept] [Decline]"*
5. **Accept**: Server resets room state, starts new match → both get `game_countdown`
6. **Decline**: Player A sees *"Opponent declined. No hard feelings. (Well, some feelings.)"*
7. **Timeout (15s)**: auto-decline → *"Opponent left you hanging. Classic."*

**Edge cases:**
- If Player B navigates to home before seeing prompt → auto-decline
- Room stays alive for 30s after match for rematch window, then expires

---

#### 6.9.5 Connection Quality Indicator (Phase 2)

**Implementation:**
- Client sends periodic `ping` (every 5s) → server responds with `pong`
- Client calculates round-trip latency
- UI: Small dot in game header next to player name

| Latency | Dot Color | Label |
|---------|-----------|-------|
| < 100ms | 🟢 Green | (none) |
| 100–300ms | 🟡 Yellow | *"Slow connection"* tooltip |
| > 300ms | 🔴 Red | *"Your connection is unstable"* banner (dismissable) |
| No response (3 pings) | ⚫ Grey | *"Connection lost — reconnecting..."* |

**Server-side:** If client's latency > 500ms for 3 consecutive pings, server emits `connection_quality: 'poor'` to opponent so they know to expect delays.

---

#### 6.9.6 Anti-Stalling / AFK Detection (Phase 2)

Prevents griefing by players who intentionally stall.

**Rules:**
- Track consecutive turns where player uses >80% of timer without submitting
- **2 consecutive stalls**: Server emits `afk_warning` → client shows: *"Are you still there? Submit a guess or you'll forfeit."*
- **3 consecutive stalls**: Auto-forfeit round with max-attempts penalty. Personality says: *"They fell asleep. Or ragequit. Same thing."*
- Warning resets if player submits a guess normally

**Voluntary abandon (tab close):**
- Different from disconnect — no reconnection attempt
- Treated as immediate disconnect → 30s reconnection window → auto-forfeit if no return
- Opponent sees: *"Your opponent may have left. Waiting 30 seconds..."*

---

#### 6.9.7 Game Pause — Mutual Consent (Phase 2)

**Flow:**
1. Player taps ⏸ pause icon → client emits `request_pause`
2. Opponent sees: *"Player A requests a pause. [Accept] [Decline]"*
3. **Accept**: Both timers freeze, game board greys out slightly, "PAUSED" overlay, 60s countdown begins
4. Either player can tap ▶ Resume to unpause → both must confirm to resume
5. **Decline**: *"Request denied."* — game continues
6. **Auto-resume**: After 60s pause expires → game resumes automatically

**Limits:**
- Max 2 pauses per match per player
- Pause button disabled when limit reached
- Pause count shown: "⏸ 1/2 remaining"

**Not available in:**
- Daily challenge (timed, competitive)
- Ranked/Quick Match (to prevent abuse)

---

#### 6.9.8 Guess Confirmation in Multiplayer (Phase 2)

Prevents costly mis-types that are unrecoverable in multiplayer.

**GTN mode:**
```
┌────────────────────────────┐
│  Submit guess: 73?         │
│  [Confirm ✓]    [Cancel ✗] │
└────────────────────────────┘
```

**B&C mode:**
```
┌────────────────────────────┐
│  Submit code: 1 3 2 5?     │
│  [Confirm ✓]    [Cancel ✗] │
└────────────────────────────┘
```

- Confirmation modal appears for 2 seconds, then auto-submits (to not slow down fast players)
- Can be disabled in settings: "Confirm guesses: On/Off" (default: On in multiplayer, Off in single-player)
- Keyboard shortcut: Enter to confirm, Escape to cancel

---

#### 6.9.9 Mobile Keyboard UX (Phase 1)

Critical for mobile gameplay where virtual keyboard covers the screen.

**Layout adjustments when keyboard is visible:**
1. Game board scrolls up so the input field is **just above the keyboard**
2. Guess history collapses to show only last 2 entries (expandable)
3. Range bar/digit tracker moves to a compact inline display
4. Timer remains visible at top (never obscured)
5. Submit button positioned at right edge of input row (not below keyboard)

**Implementation:**
- Detect keyboard via `visualViewport.resize` event (more reliable than `focus` event)
- Apply `.keyboard-visible` CSS class to game container → triggers compact layout
- `inputmode="numeric"` on number inputs → shows numeric keyboard on mobile
- B&C: individual `<input maxlength="1" inputmode="numeric">` per digit field

**Orientation:**
- Lock to portrait via `screen.orientation.lock('portrait')` where supported
- Landscape fallback: game board adapts with side-by-side layout (history left, input right)

---

#### 6.9.10 Background Tab Handling (Phase 1)

Ensures players don't miss their turn when the app isn't in focus.

**`visibilitychange` event handling:**
```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isMyTurn) {
    // 1. Flash document title
    titleFlashInterval = setInterval(() => {
      document.title = document.title === originalTitle
        ? '(!) Your Turn — Numbskull'
        : originalTitle;
    }, 1000);

    // 2. Browser notification (if permitted)
    new Notification('Numbskull', {
      body: "It's your turn! Don't keep them waiting.",
      icon: '/icons/skull-64.png'
    });
  }
});
```

**Notification permission:** Requested once on first multiplayer game. Not on first visit.

**Timer behavior:** Timer continues server-side regardless of tab visibility — no pausing for background tabs.

---

#### 6.9.11 Turn Audio & Visual Cues (Phase 2)

**Audio cues (distinct sounds for each event):**

| Event | Sound | Duration |
|-------|-------|----------|
| Your turn starts | Rising chime (C→E→G arpeggio) | 400ms |
| Opponent guessed | Short "ding" | 150ms |
| Your guess result: correct | Triumphant chord (C major) | 500ms |
| Your guess result: wrong | Low thud | 200ms |
| Timer warning (5s left) | Tick-tock rhythm | Repeating |
| Round won | Victory fanfare | 800ms |
| Match won | Extended celebration | 1500ms |

**Visual cues:**
- Turn transition: game board border pulses with `--color-accent-glow` for 500ms
- Active player panel: subtle glow halo
- Most recent guess in history: highlighted with accent background + fade-in animation

All sounds respect the Sound Effects toggle in settings.

---

### 6.10 Game Design Psychology & Veteran Additions

Detailed design for items identified by the veteran game dev squad review.

---

#### 6.10.1 🎓 Interactive Tutorial / FTUE (Phase 1)

**First-Time User Experience** — the most critical 60 seconds for retention.

**Trigger:** Detects `localStorage.getItem('numbskull_tutorial_complete')` is null.

**Flow:**
1. Home screen loads → auto-overlay: *"First time? Let me show you how this works."* [Let's Go] [Skip]
2. Auto-starts GTN game vs Easy AI with range 1–20 (simple, fast)
3. **Step-by-step tooltips** (positioned next to the relevant UI element):

| Step | Tooltip | What Player Does |
|------|---------|-----------------|
| 1 | *"Enter a number between 1 and 20."* → highlights input | Types a number |
| 2 | *"Too high! The skull just roasted you. Try lower."* → highlights feedback | Sees roast message |
| 3 | *"See this bar? It shows your remaining range."* → highlights range bar | Views narrowing range |
| 4 | *"Need help? Tap the hint button. But it'll cost you."* → highlights hint | Optional: uses hint |
| 5 | *"Got it! That's how you play."* (on correct guess) → highlights result | Wins the game |

4. After tutorial game: *"Not bad for a beginner. Now try the real thing."* → redirects to home screen
5. Sets `localStorage.numbskull_tutorial_complete = true`

**Rules:**
- Unskippable on very first visit (Skip button hidden for first 5 seconds, then appears)
- Skippable on subsequent visits via "Reset Tutorial" in settings
- Tutorial uses a special AI that always picks a low number (ensures fast win, max 4-5 guesses)
- B&C gets its own mini-tutorial that triggers on first B&C game launch

---

#### 6.10.2 🔄 Formal Game State Machine (Phase 1)

Every game follows a **strict finite state machine**. No action can be processed unless the game is in the correct state.

```
           ┌──────────────────────────────────────────┐
           ▼                                          │
         IDLE                                   REMATCH_PENDING
           │                                          ▲
           ▼                                          │
         LOBBY ──────────────────────────────────► RESULT
           │                                          ▲
           ▼                                          │
       CONFIGURING                               TIEBREAKER
           │                                          ▲
           ▼                                          │
       COUNTDOWN (3-2-1)                         INTERMISSION
           │                                          ▲
           ▼                                          │
    SECRET_SUBMISSION ──────────────────────────► PLAYING
```

**State Definitions:**

| State | Valid Actions | Timeout | UI |
|-------|-------------|---------|-----|
| `IDLE` | Navigate to create/join/quick-match | — | Home screen |
| `LOBBY` | ready_up, send_chat, leave, kick (host), change_config (host) | 10min → room expires | Lobby screen |
| `CONFIGURING` | update_config (host only) | — | Config modal (overlay on lobby) |
| `COUNTDOWN` | (none — all input blocked) | 2.5s → auto-transition | 3-2-1 overlay |
| `SECRET_SUBMISSION` | submit_secret | Config timer → auto-assign | Secret input screen |
| `PLAYING` | submit_guess, request_hint, send_reaction, request_pause | Turn timer → forfeit | Game board |
| `INTERMISSION` | send_reaction | 10s → next round | Score summary |
| `TIEBREAKER` | (same as PLAYING) | Turn timer | Game board (special styling) |
| `RESULT` | request_rematch, share, leave | 30s → room expires | Result screen |
| `REMATCH_PENDING` | respond_rematch | 15s → auto-decline | Rematch prompt |

**Server enforcement:** Every socket event handler checks `room.state` before processing. Invalid actions return `{ error: 'INVALID_STATE', currentState, validActions }`.

---

#### 6.10.3 🎭 Dramatic Moments (Phase 1)

**First-Ever Win Celebration:**
- Triggers once per player lifetime (tracked via `localStorage.numbskull_first_win`)
- Special full-screen overlay: skull animation changes expression (angry → surprised → grudging respect)
- Particle explosion: gold + purple confetti burst (2× normal amount)
- Unique message: *"Beginner's luck. Don't get comfortable."*
- Sound: unique triumphant fanfare (different from normal win sound)
- Duration: 3 seconds before result screen appears
- Badge earned: "First Blood" with special golden border

**Last-Attempt Drama:**
- Triggers when player is on their final guess before max attempts
- Visual: screen edges darken with vignette effect (CSS box-shadow inset)
- Timer turns red and pulses faster
- Skull message before guess: *"Last chance, Numbskull. Make it count."*
- If correct: *"You absolute madman. Under pressure too."* (extra-special correct animation)
- If wrong: *"And that's what defeat tastes like."*
- Sound: heartbeat-like low-frequency pulse during the final turn

**Win vs Loss Asymmetry:**

| Element | Win | Loss |
|---------|-----|------|
| Particles | Gold/purple confetti, rising | Grey/blue rain particles, falling |
| Background | Subtle radial glow (purple) | Slight desaturation + vignette |
| Sound | Major chord + fanfare | Minor chord + descending tone |
| Skull expression | Grudging nod emoji 🤝 | Disappointed skull emoji 💀 |
| Message tone | Backhanded compliment | Pure roast |
| Duration | 2.5s celebration | 1.5s (shorter — don't dwell on loss) |

---

#### 6.10.4 🔓 Difficulty Unlock Progression (Phase 1)

Prevents new players from being overwhelmed by options.

**Unlock Tree:**

```
GTN Easy ──── (always unlocked)
    │
    ▼ (Beat Easy AI once)
GTN Medium ──── unlocked
    │
    ▼ (Beat Medium AI once)
GTN Hard ──── unlocked
    │
    ▼ (Win 3 GTN games on any difficulty)
🐂 Bulls & Cows ──── unlocked (with mini-tutorial)
    │
    ▼ (Beat B&C Medium AI once)
B&C Hard ──── unlocked
    │
    ▼ (Win 5 games total on Hard)
Custom Mode ──── unlocked
```

**Data storage:**
- Guest: `localStorage.numbskull_unlocks` = `{ gtn_medium: true, gtn_hard: false, ... }`
- Registered: `FeatureUnlock` model (see §7)

**UI for locked items:**
- 🔒 padlock icon over the button
- Greyed out with 60% opacity
- On tap: bottom sheet shows unlock condition: *"Beat Medium AI to unlock Hard mode"*
- On unlock: burst animation + skull says *"Fine, you've earned it. Don't embarrass yourself."*

**Multiplayer exception:** In multiplayer rooms, ALL modes are available regardless of unlock status (so friends can invite you to any mode).

---

#### 6.10.5 📣 Viral Loop Optimization (Phase 3)

**Prompted Share Triggers (not just a button — an interrupting prompt):**

| Trigger | Message | Share Card Extra |
|---------|---------|-----------------|
| First-guess win | *"You guessed it in ONE try! That's top 0.1% of all players."* | "🎯 First Guess Win" badge on card |
| Comeback win (lost round 1, won match) | *"Comeback king! Down 0-1 and clawed it back."* | "📈 Comeback" stamp |
| Perfect efficiency (100%) | *"Mathematically perfect. Share this flex."* | "🧠 Perfect" stamp |
| Beat Hard AI in ≤ 5 guesses | *"The Hard AI didn't stand a chance."* | "🤖 AI Crusher" stamp |
| Win streak ≥ 5 | *"5 wins in a row! Who's stopping you?"* | "🔥 On Fire" stamp |

**One-Tap Play Link:**
- Share card includes URL: `numbskull.gg/play/SEED123`
- Recipient opens link → auto-starts single-player game with **same secret number/code**
- After playing, sees comparison: *"You: 6 guesses | [Friend]: 3 guesses"*
- Creates competitive viral loop: "Can you beat my score?"

**Prompt UX:** Appears as a bottom sheet overlay (not a modal that blocks). Dismissible with swipe or "Not now". Rate-limited: max 1 share prompt per session.

---

#### 6.10.6 🔄 Weekly Quest System (Phase 3)

**3 rotating quests per week**, reset Monday 00:00 UTC.

**Quest Pool (server picks 3 randomly each week):**

| Quest | Goal | Reward |
|-------|------|--------|
| Sharpshooter | Win 5 games with efficiency ≥ 80% | 2× leaderboard points for 1 day |
| Social Butterfly | Play 3 multiplayer games | Exclusive weekly badge |
| Code Cracker | Complete 3 B&C games | Bonus streak day (doesn't break streak on miss) |
| Speedster | Win 3 games with >50% time remaining | Profile border glow for 1 week |
| Brain Trainer | Use 0 hints across 5 games | "No Hints" badge |
| Daily Devotee | Complete daily challenge 5 of 7 days | 2× daily challenge score |

**Data:** `WeeklyQuest` model: `{ week_start, quest_id, user_id, progress, completed }`

**UI:** Quest card on home screen showing 3 quests + progress bars + countdown to reset.

---

#### 6.10.7 📢 Guest → Registered Conversion Nudges (Phase 4)

Non-intrusive prompts at high-value moments when guests have something to lose.

| Trigger | When | Nudge Message |
|---------|------|--------------|
| After 3 games played | Post-game result screen | *"Your stats aren't being saved! Register to track your wins."* |
| After earning first badge | Badge unlock toast | *"You earned 'First Blood'! Register to keep it forever."* |
| After leaderboard placement | Leaderboard screen | *"You ranked #47 today! Register to claim your spot."* |
| After win streak ≥ 3 | Post-game result screen | *"3 wins in a row! Register before your streak disappears."* |
| After daily challenge | Challenge result | *"Nice run! Register to track your streak."* |

**UX:** Compact bottom sheet with [Register] [Maybe Later]. "Maybe Later" dismisses for 3 games. Never shown after 5 dismissals (don't annoy loyal guests).

---

#### 6.10.8 🔒 Race Condition Handling (Phase 2)

Server-side concurrency control to prevent data corruption.

**Implementation:**
```javascript
// Per-room async mutex using 'async-mutex' package
const roomLocks = new Map(); // roomId → Mutex

async function withRoomLock(roomId, fn) {
  if (!roomLocks.has(roomId)) roomLocks.set(roomId, new Mutex());
  const release = await roomLocks.get(roomId).acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

// Usage in every socket handler:
socket.on('submit_guess', async (data) => {
  await withRoomLock(data.roomId, async () => {
    // Safely read + modify room state
    // No other event can interleave
  });
});
```

**Critical race conditions handled:**
1. **Guess + timer expiry**: If both arrive within same tick → guess wins (player made it in time)
2. **Dual secret submission**: Both processed sequentially — no double-trigger of game start
3. **Quick Match pairing**: Redis SETNX for atomic slot claiming — only one player per slot
4. **Rematch + Leave**: If rematch and leave arrive simultaneously → leave wins (room closes)

---

#### 6.10.9 👁️ Watch Live — Spectator Discovery (Phase 2)

**Home screen component:** "🔴 Live Now" horizontal scrollable card list.

**Data:** Server maintains `activePublicGames` list (games in `PLAYING` state with `visibility: 'public'`):
```
{ roomCode, gameMode, player1Name, player2Name, spectatorCount, roundNumber, startedAt }
```

**Card UI:**
```
┌─────────────────────────┐
│ 🔴 LIVE                 │
│ 🎯 GTN | Round 2/3      │
│ Player1 vs Player2      │
│ 👁 12 watching          │
│         [Watch]         │
└─────────────────────────┘
```

**Refresh:** Auto-updates every 10 seconds via socket event (not polling).

**Sort:** By spectator count (most-watched first), then by start time (newest first).

---

#### 6.10.10 🔤 Display Name Validation (Phase 4)

**Validation rules (applied on registration + name change):**

| Rule | Enforcement |
|------|-------------|
| Length: 2–20 characters | Client + server |
| Allowed characters: `a-zA-Z0-9_-. ` and common Unicode letters | Server regex |
| No consecutive special chars (`__`, `..`, `--`) | Server regex |
| Profanity filter | Server-side word list check (bad-words npm package) |
| Reserved names blocked | `admin`, `numbskull`, `moderator`, `system`, `official`, `support` → rejected |
| Uniqueness (case-insensitive) | DB unique index on `lower(display_name)` |
| No invisible/zero-width characters | Strip `\u200B`, `\u200C`, `\u200D`, `\uFEFF` before validation |

**UX:** Real-time validation feedback as user types. Green checkmark on valid, red × with reason on invalid.

---

### 6.11 Animation Engineering ★★ (Veteran Animation Engineer Review)

Detailed technical specs for animation performance, synchronization, and robustness. All items from the 20-year animation engineering review.

> [!WARNING]
> Without these specs, animations will cause frame drops on mobile, glitch during state transitions, and desync audio from visuals. These are not "nice-to-haves" — they are the difference between "polished game" and "janky prototype."

---

#### 6.11.1 🖥️ GPU Compositing Rules (Phase 1)

**Only 4 CSS properties are GPU-compositable** (animated without triggering layout/paint):
- ✅ `transform` (translateX/Y/Z, scale, rotate)
- ✅ `opacity`
- ✅ `filter` (blur, brightness — use sparingly)
- ✅ `clip-path`

**NEVER animate these during gameplay** (triggers layout recalculation → frame drops):
- ❌ `width`, `height`, `top`, `left`, `right`, `bottom`
- ❌ `margin`, `padding`, `border-width`
- ❌ `font-size`, `line-height`
- ❌ `box-shadow` (paint-only — use pseudo-element with opacity instead)

**`will-change` Strategy:**

| Element | `will-change` | When Applied | When Removed |
|---------|-------------|-------------|-------------|
| `.particle` | `transform, opacity` | On creation | On animation end + DOM removal |
| `.game-board` | `transform` | During shake animation only | 300ms after shake ends |
| `.guess-history-entry` | `transform, opacity` | During slide-in | 250ms after slide completes |
| `.countdown-number` | `transform, opacity` | During countdown | After countdown ends |
| `.skull-expression` | `opacity` | Always (only 2 elements) | Never (acceptable — only 2 layers) |
| `.badge-hex` | `transform, opacity` | During earn animation | 2s after animation |
| `.modal-backdrop` | `backdrop-filter` | During open/close | When fully open (static) |

**Dynamic application:**
```javascript
// Add will-change BEFORE animation starts (1 frame lead time)
element.style.willChange = 'transform, opacity';
requestAnimationFrame(() => {
  element.classList.add('animate-shake');
});

// Remove will-change AFTER animation ends (free GPU memory)
element.addEventListener('animationend', () => {
  element.style.willChange = 'auto';
}, { once: true });
```

**Hard rule:** Maximum **5 elements** with `will-change` simultaneously. Each promoted layer consumes GPU VRAM (~element-width × height × 4 bytes).

---

#### 6.11.2 🎯 Animation Priority System & Interruption Handling (Phase 1)

**Priority tiers (highest wins):**

| Priority | Category | Examples |
|----------|---------|---------|
| **P0 — Critical** | Game state changes | Disconnect overlay, error modal, timer expiry |
| **P1 — Gameplay** | Core feedback | Correct/wrong guess, round end, match end |
| **P2 — Dramatic** | Emotional moments | First-win celebration, last-attempt drama, badge earn |
| **P3 — Ambient** | Background polish | Skull eye glow, floating particles, room counter pulse |
| **P4 — Decorative** | Pure polish | Stagger reveals, number rolls, entrance animations |

**Interruption rules:**

| Scenario | Behavior |
|----------|----------|
| P1 arrives during P2 | P2 fast-forwards to end state (no cancel, just skip to final frame), P1 plays |
| P0 arrives during anything | ALL animations cancel immediately via `element.getAnimations().forEach(a => a.cancel())` |
| Same-priority conflict | Newer animation wins, older animation skips to end state |
| P3/P4 during P1/P2 | P3/P4 paused (not cancelled), resumes after P1/P2 finishes |

**Animation Controller implementation:**
```javascript
class AnimationController {
  // Animation slots prevent conflicts on same element
  #slots = new Map(); // slotId → { animation, priority, element }
  
  play(slotId, element, keyframes, options, priority = 4) {
    const existing = this.#slots.get(slotId);
    
    if (existing) {
      if (existing.priority < priority) return; // Higher priority running
      // Skip existing to end state (don't cancel abruptly)
      existing.animation.finish(); 
    }
    
    element.style.willChange = options.willChange || 'transform, opacity';
    const anim = element.animate(keyframes, options);
    this.#slots.set(slotId, { animation: anim, priority, element });
    
    anim.finished.then(() => {
      this.#slots.delete(slotId);
      element.style.willChange = 'auto';
    });
    
    return anim;
  }
  
  cancelAll() {
    for (const [, { animation, element }] of this.#slots) {
      animation.cancel();
      element.style.willChange = 'auto';
    }
    this.#slots.clear();
  }
}
```

**Animation slots** (one active animation per slot):

| Slot ID | What Plays Here |
|---------|----------------|
| `feedback` | Correct pulse, wrong shake, B&C result |
| `skull` | Expression change, roast glow |
| `overlay` | Countdown, modal, first-win celebration |
| `badge` | Badge earn animation |
| `board` | Board entrance, exit, shake |
| `ambient-*` | Floating particles (each gets own slot, up to 20) |

---

#### 6.11.3 🎵 Audio-Visual Sync Map (Phase 1)

Every visual + audio pair must have **matched or intentionally offset durations**.

| Event | Visual Animation | Visual Duration | Audio | Audio Duration | Sync Strategy |
|-------|-----------------|----------------|-------|---------------|---------------|
| **Correct guess** | Scale pulse 1→1.12→1 | 250ms | Major chord (C-E-G) | 500ms | Visual completes first → audio sustains 250ms as "echo". Intentional: feels "resonant" |
| **Wrong guess** | Horizontal shake ±6px | 300ms | Low thud | 300ms | **Exact match.** Both start and end together |
| **Too high/low** | Directional arrow animation | 200ms | Rising/falling pitch | 200ms | **Exact match** |
| **Your turn starts** | Board border cyan glow pulse | 500ms | Rising chime C→E→G | 400ms | Visual starts 100ms before audio (visual "leads" the sound — feels responsive) |
| **Timer warning (5s)** | Timer ring turns red + faster pulse | 5000ms (continuous) | Tick-tock rhythm | 1 tick per second | Tick sound syncs to visual pulse beat via `setInterval(1000)` |
| **Round won** | Confetti burst + skull expression change | 2500ms | Victory fanfare | 800ms | Audio fires at t=0, visual plays full duration. Short sound + long visual = "big moment" |
| **Match won** | Full celebration (confetti + glow + badge) | 3000ms | Extended celebration | 1500ms | Audio fires at t=0, visual continues after audio. Audio "punctuates", visual "lingers" |
| **Badge earned** | Hex flies in + bounce + glow burst | 1500ms | Achievement chime | 400ms | Audio fires at bounce moment (t=700ms), not at start. Sound rewards the "landing" |
| **Countdown beat** | Number entrance → hold → exit | 700ms | Musical note (C/E/G) | 700ms | **Exact match per beat** |
| **Last attempt** | Vignette + red pulse | Continuous until guess | Heartbeat pulse (60 BPM) | 1000ms loop | Visual pulse syncs to heartbeat audio (both on same 1000ms loop) |

**Audio trigger implementation:**
```javascript
// Audio fires at specific animation timeline points, not independently
animation.addEventListener('finish', () => audioController.play('correct-chord'));
// Or for mid-animation triggers:
animation.currentTime; // Check in rAF loop for badge "landing" sound
```

> [!CAUTION]
> **Browser Autoplay Policy:** `AudioContext` starts in `suspended` state on ALL modern browsers. No sound will play until user interaction. See §6.14.1 for the mandatory resume strategy. Without this, countdown beats, timer ticks, and all musical feedback are silent on first load.

**Audio trigger implementation (via AudioManager — see §6.14):**
```javascript
// Audio fires at specific animation timeline points through AudioManager
animation.addEventListener('finish', () => audioManager.play('correct-chord', { priority: 1 }));
// For mid-animation triggers:
animation.currentTime; // Check in rAF loop for badge "landing" sound at t=700ms
// All sounds go through AudioManager.play() — NEVER raw oscillator.connect(destination)
```

**Rule:** Audio `context.currentTime` is the sync master. Visual animations follow audio clock, not the other way around. AudioManager is the single entry point for all audio playback (see §6.14.2).

---

#### 6.11.4 🎊 Particle System Technical Spec (Phase 1)

**Implementation: CSS-only** (no Canvas, no WebGL — keeps bundle small and GPU-efficient for ≤50 particles).

**Win confetti spec:**

| Property | Value |
|----------|-------|
| **Count** | 30 particles (mobile), 50 particles (desktop) |
| **Spawn area** | Full viewport width, y = -10% (above screen) |
| **Shapes** | Mix of `rect` (4×8px), `circle` (6px), `diamond` (rotated square 5px) |
| **Colors** | Alternating: `--color-juice` (cyan), `--color-accent-primary` (purple), `#FFD700` (gold) |
| **Physics** | Each particle: random X drift (±30px sinusoidal), gravity fall (translateY 0→120vh), random rotation (0→720°) |
| **Lifetime** | 2500ms per particle, staggered spawn (each delays random 0–500ms) |
| **Easing** | Y: `var(--ease-standard)` (accelerating fall), X: `linear` (smooth drift), rotation: `linear` |
| **Cleanup** | Particles removed from DOM on `animationend` event |

**CSS implementation pattern:**
```css
.particle {
  position: fixed;
  will-change: transform, opacity;
  pointer-events: none;
  z-index: 9999;
}

@keyframes confetti-fall {
  0%   { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateY(120vh) translateX(var(--drift)) rotate(var(--spin)); opacity: 0; }
}
```

**Each particle gets unique CSS variables** (set inline via JS on creation):
```javascript
particle.style.setProperty('--drift', `${randomBetween(-30, 30)}px`);
particle.style.setProperty('--spin', `${randomBetween(360, 1080)}deg`);
particle.style.setProperty('--delay', `${randomBetween(0, 500)}ms`);
```

**Loss rain particles spec:**

| Property | Value |
|----------|-------|
| **Count** | 20 particles |
| **Shapes** | Thin vertical lines (1×10px) |
| **Colors** | `#6B7280` (grey), `#3B82F6` (blue) at 40% opacity |
| **Physics** | Straight fall (no X drift), faster than confetti (1500ms lifetime) |
| **Cleanup** | Same DOM removal strategy |

**Performance cap:** If `navigator.hardwareConcurrency <= 2` (low-end device), halve particle count. If `prefers-reduced-motion`, skip particles entirely.

---

#### 6.11.5 📺 Loading Screen Choreography (Phase 1)

Full timeline for the 2-3 second loading sequence:

| Time | Element | Animation | Easing |
|------|---------|-----------|--------|
| **0ms** | Background | Instant `#1C1842` fill | — |
| **0–400ms** | Skull logo | Scale 0.8→1, opacity 0→1 | `var(--ease-enter)` |
| **200–450ms** | Skull eye sockets | Opacity 0→1 (appear after skull body) | `var(--ease-standard)` |
| **400–600ms** | Wordmark "Numbskull" | Opacity 0→1 + translateY(10px→0) | `var(--ease-enter)` |
| **600–900ms** | Tagline | Opacity 0→1, 13px `#AFA9EC` | `var(--ease-enter)` |
| **500ms–end** | Progress bar track | Opacity 0→1 (appears while tagline fades in) | `var(--ease-standard)` |
| **700ms–end** | Progress bar fill | Width 0%→100% (based on actual load progress, or fake 3s) | `linear` |
| **800ms** | "?" glyph | Subtle cyan glow starts pulsing (3s cycle) | `var(--ease-standard)` |
| **load complete** | "Loading..." text | Changes to "Ready!" + 200ms color change to `--color-juice` | `var(--ease-sharp)` |
| **+200ms** | Entire screen | Opacity 1→0 + scale 1→1.05 (slight zoom out) | `var(--ease-exit)` |
| **+350ms** | Home screen | Slides up underneath | `var(--ease-enter)` |

**Stagger principle:** Each element waits for the previous to be ~60% complete before starting. Never two elements appearing simultaneously.

**Progress bar behavior:**
- If real loading takes <1.5s: fake progress bar pauses at 80% for 500ms, then completes (prevents "flash of loading")
- If real loading takes >3s: progress bar reaches 100% at actual completion
- Minimum display time: **1.5 seconds** (even if everything loads instantly — the animation IS the brand impression)

---

#### 6.11.6 ⏱️ Timer Ring Animation Spec (Phase 1)

**Implementation: SVG `<circle>` with `stroke-dashoffset`.**

```html
<svg class="timer-ring" viewBox="0 0 100 100">
  <circle class="timer-track" cx="50" cy="50" r="45" 
          fill="none" stroke="var(--color-bg-secondary)" stroke-width="4" />
  <circle class="timer-fill" cx="50" cy="50" r="45"
          fill="none" stroke="var(--timer-color)" stroke-width="4"
          stroke-dasharray="283" stroke-dashoffset="0"
          stroke-linecap="round" transform="rotate(-90 50 50)" />
</svg>
```

**Animation behavior:**

| Remaining Time | `--timer-color` | Transition | Pulse |
|---------------|----------------|-----------|-------|
| >10 seconds | `--color-accent-glow` (purple) | — | None |
| 5–10 seconds | `--color-warning` (amber) | Color blends over 300ms | None |
| ≤5 seconds | `--color-error` (red) | Color blends over 300ms | Scale 1→1.05→1, 500ms loop |
| 0 seconds | `--color-error` | Flash 3 times (opacity 1→0.3→1, 200ms each) | Stop |

**Update frequency:**
- `stroke-dashoffset` updated via CSS `transition: stroke-dashoffset 100ms linear` (smooth visual)
- JS updates the value every 100ms via `requestAnimationFrame` (not `setInterval` — more accurate)
- Digital timer text updated every 1s (whole seconds only — avoids distracting flickering)

**GPU note:** SVG `stroke-dashoffset` is paint-only (not composite), so the timer ring should NOT have `will-change`. The pulse (scale transform) at ≤5s should use a separate wrapper element with `will-change: transform`.

---

#### 6.11.7 🔀 Screen Transition Choreography (Phase 1)

**Shared-axis transition** — outgoing and incoming screens overlap briefly.

| Phase | Duration | Outgoing Screen | Incoming Screen |
|-------|---------|----------------|----------------|
| **1. Exit** | 0–150ms | Opacity 1→0 + scale 1→0.97 | Not yet visible |
| **2. Overlap** | 100–200ms | Fading out (opacity 0.3→0) | Sliding up (translateY 20px→10px), opacity 0→0.5 |
| **3. Enter** | 150–350ms | Gone (display: none) | TranslateY 10px→0 + opacity 0.5→1 |

**Total perceived duration:** ~300ms (feels snappy, not sluggish).

**Easing:** Exit uses `var(--ease-exit)`, enter uses `var(--ease-enter)`.

**Content vs container:** The **page container** animates (opacity + transform), not individual content elements within it. Content uses stagger-reveal after the container lands.

**Exception — modal transitions:** Modals use vertical scale (scaleY 0.95→1) + opacity instead of translateY. Faster: 200ms total.

**View Transition API** (progressive enhancement):
```javascript
if (document.startViewTransition) {
  document.startViewTransition(() => updateDOM());
} else {
  // Fallback: manual CSS class toggle
  updateDOM();
}
```

---

#### 6.11.8 👻 Ghost Mode Overlay Animation (Phase 3)

**Ghost replay pacing:**
- Ghost replays at **real-time speed** (not sped up) — synced to actual millisecond timestamps from `GameReplay.guesses[].timestamp_ms`
- Ghost's guess appears at the exact same elapsed time as the original game

**Ghost guess appearance:**
- Ghost digit/number types in with **typewriter effect** (each digit appears 80ms apart, opacity 0→0.6)
- After typing complete: slide-in from left (200ms, `var(--ease-enter)`)
- Ghost feedback (too high/low or bulls/cows) appears 300ms after guess (mimics "server processing" delay)

**Visual separation:**
- Ghost elements at **40% opacity** (never interfere with real game)
- Ghost has `--color-accent-glow` (#7F77DD) tinted border (distinct from player's `--color-accent-primary`)
- If ghost and player are on same guess number: ghost panel shifts 4px left with subtle separator line

**Interruption:** If player finishes the game before ghost, ghost animation freezes at current state (doesn't keep playing).

---

#### 6.11.9 📊 Animation Performance Budget (Phase 1)

Hard limits enforced in code review:

| Metric | Budget | Enforcement |
|--------|--------|------------|
| **Simultaneous `will-change` elements** | ≤5 | Lint rule / AnimationController cap |
| **Total CSS `@keyframes` declarations** | ≤25 | Stylesheet audit |
| **Max particles on screen** | 50 (desktop) / 30 (mobile) | ParticleManager cap |
| **Target FPS during peak animation** | 60fps on iPhone 12+ / Pixel 6+ | Chrome DevTools Performance audit |
| **Minimum FPS on low-end** | 30fps on any device with `hardwareConcurrency >= 2` | Performance testing |
| **Animation JS execution per frame** | ≤2ms in rAF callback | `performance.now()` guards |
| **Total animation CSS size** | ≤8KB (gzipped) | Build-time check |
| **Backdrop-filter usage** | ≤2 simultaneous | AnimationController slot limit |

**Low-end device detection:**
```javascript
const isLowEnd = navigator.hardwareConcurrency <= 2 
  || navigator.deviceMemory <= 2  // Chrome-only API
  || /Android [4-6]/.test(navigator.userAgent);

if (isLowEnd) {
  // Halve particle counts
  // Disable backdrop-filter (use solid bg with opacity instead)
  // Reduce glow-pulse to static glow (no animation)
  // Skip stagger-reveal (show all at once)
}
```

**Monitoring (dev only):**
```javascript
// FPS counter during development
let frames = 0, lastTime = performance.now();
function countFPS() {
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.warn(`FPS: ${frames}`);
    if (frames < 30) console.error('⚠️ Below 30fps!');
    frames = 0; lastTime = now;
  }
  requestAnimationFrame(countFPS);
}
```

---

### 6.12 Production Engineering ★★ (Veteran Full-Stack Developer Review)

Detailed specs for infrastructure, security, scaling, and DevOps. All items from the 20-year full-stack gaming developer review.

> [!WARNING]
> Without these specs, the app will have: security vulnerabilities (player impersonation), data loss on deployment, mobile performance jank, and inconsistent error handling. These are the items that separate a game project from a production service.

---

#### 6.12.1 🧠 React State Management — Split Contexts (Phase 1)

> [!IMPORTANT]
> A single `GameContext` with `useReducer` will cause **re-render storms** during gameplay. Every socket event updates context → every component re-renders → mobile jank after 5+ guesses.

**Split into 5 focused contexts:**

| Context | What It Holds | Update Frequency | Consumers |
|---------|-------------|-----------------|-----------|
| `GameStateContext` | Board state, scores, round, attempts, history (read-only) | Per guess (~every 3–5s) | GameBoard, GuessHistory, ScoreDisplay |
| `GameActionsContext` | `submitGuess()`, `requestHint()`, `readyUp()` (write-only, stable refs) | Never (functions are stable) | NumberInput, HintButton, ReadyToggle |
| `TimerContext` | Current time remaining, timer state | Every 100ms (high frequency) | TimerRing, TimerText |
| `SocketContext` | Socket instance, connection status, ping | On connect/disconnect | ConnectionIndicator, all emitters |
| `AuthContext` | User, tokens, isGuest, login/logout methods | On auth events | Header, Profile, ProtectedRoutes |

**Why this prevents jank:**
- `TimerContext` updates 10× per second but only `TimerRing` and `TimerText` re-render (2 components, not 10+)
- `GameActionsContext` holds function refs that **never change** — consuming components never re-render from it
- `GameStateContext` updates only on actual game events, not timer ticks

**Implementation pattern:**
```jsx
// Wrap game page with multiple providers
<SocketProvider>
  <AuthProvider>
    <GameStateProvider>
      <GameActionsProvider>
        <TimerProvider>
          <GameBoard />
        </TimerProvider>
      </GameActionsProvider>
    </GameStateProvider>
  </AuthProvider>
</SocketProvider>
```

**Performance rule:** Use `React.memo()` on all game board components. Use `useCallback()` on all action functions passed as props.

---

#### 6.12.2 🚦 Socket Event Rate Limiting (Phase 2)

| Event | Rate Limit | Penalty |
|-------|-----------|---------|
| `submit_guess` | 1 per 500ms | Ignore excess, log warning |
| `submit_secret` | 1 per 5s | Ignore excess |
| `send_reaction` | 1 per 5s | Ignore excess |
| `send_chat` | 2 per second | 10s auto-mute |
| `create_room` | 3 per minute | 60s cooldown, emit `rate_limited` event |
| `join_room` | 5 per minute | 30s cooldown |
| `request_hint` | 1 per 10s | Ignore excess |
| `request_rematch` | 1 per 10s | Ignore excess |
| **ANY event (global)** | **100 per minute** | **Socket disconnect + 60s ban** |

**Implementation:**
```javascript
// Per-socket rate limiter using sliding window
const rateLimits = {
  submit_guess: { window: 500, max: 1 },
  send_chat: { window: 1000, max: 2 },
  _global: { window: 60000, max: 100 },
};

function checkRate(socket, event) {
  const key = `rate:${socket.userId}:${event}`;
  const now = Date.now();
  const limit = rateLimits[event] || rateLimits._global;
  // Sliding window check...
  if (exceeded) {
    socket.emit('rate_limited', { event, retryAfter: limit.window });
    return false;
  }
  return true;
}
```

---

#### 6.12.3 📋 Standardized Error Response Format (Phase 1)

**Every REST endpoint and socket error uses this format:**

```typescript
// Success response
{
  "success": true,
  "data": { ... }
}

// Error response
{
  "success": false,
  "error": {
    "code": "ROOM_FULL",          // Machine-readable error code (SCREAMING_SNAKE)
    "message": "This room is already full (2/2 players).",  // Human-readable
    "status": 409,                 // HTTP status code
    "details": {                   // Optional context
      "roomCode": "ABC123",
      "maxPlayers": 2
    }
  }
}
```

**Error code catalog:**

| Code | Status | When |
|------|--------|------|
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `AUTH_REQUIRED` | 401 | Missing or invalid token |
| `TOKEN_EXPIRED` | 401 | JWT expired, needs refresh |
| `FORBIDDEN` | 403 | Not authorized for this action |
| `ROOM_NOT_FOUND` | 404 | Room code doesn't exist |
| `USER_NOT_FOUND` | 404 | User ID doesn't exist |
| `ROOM_FULL` | 409 | Room already has 2 players |
| `GAME_IN_PROGRESS` | 409 | Can't join — game already started |
| `DUPLICATE_GUESS` | 409 | Already guessed this value (B&C) |
| `INVALID_STATE` | 409 | Action not valid in current game state |
| `RATE_LIMITED` | 429 | Too many requests |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts |
| `SERVER_ERROR` | 500 | Unexpected server error (logged, not exposed) |

**Socket errors:** Same format, emitted via `socket.emit('error', { code, message })`.

---

#### 6.12.4 ❤️ Health Check & Readiness Endpoints (Phase 1)

```javascript
// Liveness — is the process running?
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Readiness — is it connected to PG + Redis and ready to serve?
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;          // PG alive
    await redisClient.ping();                    // Redis alive
    res.status(200).json({
      status: 'ready',
      activeRooms: rooms.size,
      connectedSockets: io.engine.clientsCount,
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', error: err.message });
  }
});
```

**Railway configuration:** Set `RAILWAY_HEALTHCHECK_PATH=/health` and `RAILWAY_HEALTHCHECK_TIMEOUT_SEC=5`.

---

#### 6.12.5 🌐 CORS Configuration (Phase 1)

```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Production: 'https://numbskull.gg'
  credentials: true,      // Allow cookies (refresh token)
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,          // Preflight cache: 24 hours
};

app.use(cors(corsOptions));

// Socket.io CORS (separate config)
const io = new Server(server, {
  cors: corsOptions,
});
```

---

#### 6.12.6 🔧 Environment Variables Spec (Phase 1)

**`.env.example`:**
```env
# Server
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL=postgresql://numbskull:password@localhost:5432/numbskull

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-256-bit-secret-here
JWT_REFRESH_SECRET=your-separate-256-bit-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# External Services (deferred to later phases)
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
RESEND_API_KEY=re_xxxxxxxxxxxx
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx

# Analytics
PLAUSIBLE_DOMAIN=numbskull.gg

# Feature Flags
ENABLE_GOOGLE_AUTH=false
ENABLE_PUSH_NOTIFICATIONS=false
ENABLE_ANALYTICS=false
```

**Validation on startup (Zod):**
```javascript
// server/src/config/env.js
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url(),
});
const env = envSchema.parse(process.env);
// Crash immediately on missing env vars — don't silently fail
```

---

#### 6.12.7 📌 API Versioning (Phase 2)

**Strategy:** URL-based versioning for REST, payload-based for Socket.

**REST:**
```
/api/v1/auth/register
/api/v1/rooms
/api/v1/leaderboard
```

All existing endpoints prefixed with `/v1/`. When breaking changes are needed, add `/v2/` and support both for ≥1 week.

**Socket:**
```javascript
// Client sends version in handshake
const socket = io(SERVER_URL, {
  auth: { token, guestId, clientVersion: '1.0.0' },
});

// Server checks version
io.use((socket, next) => {
  const version = socket.handshake.auth.clientVersion;
  if (!version || semver.lt(version, MIN_SUPPORTED_VERSION)) {
    return next(new Error('CLIENT_OUTDATED'));
    // Client shows: "Please refresh the page to get the latest version."
  }
  next();
});
```

---

#### 6.12.8 🏆 Redis Leaderboard (Sorted Sets) (Phase 3)

> [!IMPORTANT]
> SQL `COUNT(*) WHERE score > myScore` is a full table scan on 100K+ users. Redis sorted sets give O(log N) rank lookup.

**Data structure:**
```
ZADD lb:alltime      <score> <userId>
ZADD lb:weekly:{weekNum} <score> <userId>    // Auto-expire after 7 days
ZADD lb:daily:{date}     <score> <userId>    // Auto-expire after 24h
```

**Queries:**
```
ZREVRANGE lb:alltime 0 99 WITHSCORES    → Top 100 (O(log N + 100))
ZREVRANK lb:alltime <userId>             → Own rank (O(log N))
ZSCORE lb:alltime <userId>               → Own score (O(1))
```

**Sync strategy:**
- On game completion → `ZINCRBY lb:alltime <points> <userId>` (atomic increment)
- Weekly board: created fresh on Monday 00:00 UTC, expires Sunday 23:59 UTC
- Daily board: created on daily challenge generation, expires 24h later
- Friends leaderboard: `ZRANGEBYSCORE` filtered by friend list (computed at query time, not pre-stored)

---

#### 6.12.9 📝 Structured Logging Strategy (Phase 1)

**Format:** JSON structured logging (for Railway log ingestion).

**Library:** `pino` (fastest Node.js JSON logger, ~30ns per log).

```javascript
import pino from 'pino';
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['password', 'token', 'refreshToken', 'email'], // PII protection
});
```

**What gets logged:**

| Level | What | Example |
|-------|------|---------|
| `error` | Unhandled exceptions, DB connection failures | `{ err, stack, context }` |
| `warn` | Rate limit hits, invalid input, failed auth | `{ userId, event, reason }` |
| `info` | Game start, game end, room created, user registered | `{ roomId, gameMode, players }` |
| `debug` | Every socket event, every guess, timer ticks | `{ socketId, event, data }` (dev only) |

**PII rules:**
- ❌ Never log: passwords, tokens, email addresses, IP addresses
- ✅ Always log: userId, roomId, gameMode, event name, timestamp
- Redact middleware strips sensitive fields before logging

**Request ID tracking:**
```javascript
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
// Every log line includes requestId for tracing
```

---

#### 6.12.10 🛠️ DevOps & Development Setup (Phase 1)

**npm Workspaces (monorepo root):**
```json
// package.json (root)
{
  "name": "numbskull",
  "private": true,
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w client && npm run build -w server",
    "test": "npm run test -w server",
    "lint": "npm run lint -w client && npm run lint -w server"
  }
}
```

**Docker Compose (with persistent volumes):**
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: numbskull
      POSTGRES_USER: numbskull
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data    # ← Persists across restarts
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redisdata:/data

volumes:
  pgdata:          # Named volume — data survives docker-compose down
  redisdata:
```

**Git branching strategy:**
```
main         → deployed to production (Vercel + Railway)
develop      → integration branch, always deployable
feature/*    → per-phase or per-feature branches
hotfix/*     → emergency production fixes
```

| Phase | Branch | Merge To |
|-------|--------|----------|
| Phase 1 | `feature/phase-1-core-mvp` | `develop` → `main` |
| Phase 2 | `feature/phase-2-multiplayer` | `develop` → `main` |
| ... | ... | ... |

**Deployment flow:**
1. Feature branch → PR to `develop` (code review)
2. `develop` auto-deploys to **staging** (Railway preview environment)
3. Manual promote `develop` → `main` (production deploy)
4. Railway: auto-deploy on `main` push (backend)
5. Vercel: auto-deploy on `main` push (frontend)

---

### 6.13 New Game Modes — Detailed Design ★★ (Number Game Specialist Review)

Three new game modes designed by a 20-year number game specialist. All implement the existing `IGameEngine` interface and reuse the room/socket/UI infrastructure.

> [!NOTE]
> These 3 modes are **Phase 7 (post-launch)**. The architecture is designed now so the codebase is ready when we build them. No Phase 1–6 code needs to change — just add new engine files + game board components.

---

#### 6.13.1 🔢 Countdown (Target Number) — Full Design

**Concept:** Both players receive the same 6 numbers and a target. Race to build a mathematical expression that equals (or gets closest to) the target in 60 seconds.

**CountdownEngine interface:**
```
CountdownEngine implements IGameEngine
├── createGame(config)              → generates 6 numbers + target from seed
├── validateExpression(expr)        → checks: valid operators, each number used ≤ once, no division by zero
├── evaluateExpression(expr)        → safe AST evaluation (NOT eval()), returns numeric result
├── submitSolution(playerId, expr)  → validates + evaluates + stores
├── calculateScore(result, target)  → proximity scoring
├── checkMatchWinner()              → closest to target wins
└── getStateForPlayer(playerId)     → current numbers, target, time remaining, opponent status (submitted/not)
```

**Number generation (seeded):**
```javascript
function generateCountdownPuzzle(seed, difficulty) {
  const rng = seedrandom(seed); // Deterministic — same seed = same puzzle
  
  const pools = {
    easy:   { small: [1,2,3,4,5,6,7,8,9,10], large: [10,15,20,25], target: [10, 100] },
    medium: { small: [1,2,3,4,5,6,7,8,9,10], large: [25,50,75,100], target: [100, 500] },
    hard:   { small: [1,2,3,4,5,6,7,8,9,10], large: [25,50,75,100], target: [500, 999] },
  };
  
  const pool = pools[difficulty];
  // Pick 4 small + 2 large (classic Countdown distribution)
  const numbers = [
    ...pickRandom(pool.small, 4, rng),
    ...pickRandom(pool.large, 2, rng),
  ];
  const target = randomInt(pool.target[0], pool.target[1], rng);
  
  // VERIFY solvability: brute-force check that an exact solution exists
  const hasSolution = bruteForceCheck(numbers, target);
  // If no exact solution: accept (closest-wins is valid), but prefer solvable puzzles
  
  return { numbers, target, hasSolution };
}
```

**Expression parser (NO `eval()`):**
```javascript
// Safe AST-based expression evaluator
// Input: "( 25 × 7 ) + ( 50 ÷ 2 ) + 4" 
// → Tokenize → Parse to AST → Evaluate
// Allowed operators: +, −, ×, ÷
// Allowed operands: only the 6 given numbers (each used at most once)
// Validation: no negative intermediates, no fractional intermediates, no division by zero
```

**Scoring:**

| Result | Points |
|--------|--------|
| Exact match | 10 points |
| Within 1–5 | 7 points |
| Within 6–10 | 5 points |
| Within 11–25 | 3 points |
| Within 26–50 | 1 point |
| >50 away or no submission | 0 points |

**Match format:** Best of 3 puzzles (different seeds). Total points determine winner.

**Multiplayer flow:**
1. Both players join room → host starts game
2. Server generates puzzle seed → sends same 6 numbers + target to both
3. 60-second simultaneous solve timer starts
4. Player builds expression → taps "Submit" (can submit multiple times — best kept)
5. Timer ends → server compares solutions → closest wins the round
6. If tie (same distance): faster submission time wins

**AI strategies:**

| Level | Algorithm | Typical Performance |
|-------|-----------|-------------------|
| Easy | Random valid 2-operator expression | Gets within 20–50 of target |
| Medium | Brute-force 3-operator expressions | Gets within 5–15 |
| Hard | Full brute-force all permutations (4–5 operators) | Finds exact solution if one exists |
| Adaptive | Starts Easy, escalates based on player score | Matches player skill |

**AI thinking delay:** Easy = 15–25s, Medium = 8–15s, Hard = 3–8s (feels natural).

**Mobile UI wireframe:**
```
┌──────────────────────────┐
│    TARGET: 437           │  ← Large, centered, --color-juice glow
│                          │
│  ┌───┬───┬───┬───┬───┬───┐
│  │ 2 │ 4 │ 7 │10 │25 │50 │  ← Available numbers (tap to use)
│  └───┴───┴───┴───┴───┴───┘
│                          │
│  Expression:             │
│  ┌──────────────────────┐│
│  │ 25 × 7 + ...         ││  ← Built expression (editable)
│  └──────────────────────┘│
│  = 175                   │  ← Live result preview
│                          │
│  ┌──┬──┬──┬──┬───┬─────┐│
│  │ +│ −│ ×│ ÷│ ( )│CLEAR││  ← Operator buttons
│  └──┴──┴──┴──┴───┴─────┘│
│                          │
│  ⏱️ 0:42 remaining      │
│  [Submit Solution]       │
└──────────────────────────┘
```

**Roast copy:**

| Situation | Skull Message |
|-----------|-------------|
| No submission | *"60 seconds. Six numbers. And you just... sat there."* |
| Off by 1 | *"Off by ONE. I'd say 'close' but that would be a compliment."* |
| Off by 100+ | *"The target was 437. You made 12. That's not even trying."* |
| Exact match | *"Fine. You can do arithmetic. Want a medal?"* |
| Faster than opponent | *"22 seconds. Your opponent took 58. Embarrassing for them."* |
| Used only 2 numbers | *"You had 6 numbers. You used 2. Efficiency or laziness?"* |

**Badges:**
- 🧮 *"Human Calculator"* — Get exact match 10 times
- ⚡ *"Speed Demon"* — Exact match in under 15 seconds
- 🎯 *"Countdown Master"* — Win 5 Countdown matches in a row

---

#### 6.13.2 🧮 Number Chain (Strategic Duel) — Full Design

**Concept:** The only **directly adversarial** game on the platform. Each move changes the shared number, and your move constrains your opponent's options.

**NumberChainEngine interface:**
```
NumberChainEngine implements IGameEngine
├── createGame(config)              → generates seed number + target
├── validateMove(move, state)       → checks: valid operator, valid operand (1–9), no same-op twice in a row, no negatives/fractions
├── applyMove(playerId, move)       → updates current number, records history
├── checkWin(currentNumber, target) → exact match = win
├── checkDeadEnd(state)             → no valid moves available = current player loses
├── getHint(playerId)               → suggests best move (with penalty)
├── checkMatchWinner()              → who reached target (or forced opponent into dead end)
└── getStateForPlayer(playerId)     → current number, target, history, available operations, whose turn
```

**Game rules (detailed):**

| Rule | Spec |
|------|------|
| **Start number** | Random, 10–30 (Easy), 5–50 (Medium), 1–100 (Hard) |
| **Target number** | Random, 80–120 (Easy), 50–200 (Medium), 50–500 (Hard) |
| **Operand range** | 1–9 (always) |
| **Available operations** | +, −, ×, ÷ |
| **No repeat rule** | Cannot use the same operator as the previous turn (your OR opponent's) |
| **No negatives** | Result must be ≥ 1 at all times |
| **No fractions** | Division must result in a whole number (otherwise invalid move) |
| **Overshoot rule** | Going past the target by >50% = auto-loss (*"You flew past the target like it wasn't there."*) |
| **Dead end** | If no valid moves exist for current player, they lose |
| **Max turns** | 20 turns total → closest to target wins (prevents infinite games) |
| **Turn timer** | 30 seconds per turn |

**Example game (annotated):**
```
Start: 15, Target: 100
Turn 1 (P1): 15 × 6 = 90   [used ×]  — aggressive, gets close fast
Turn 2 (P2): 90 + 8 = 98   [used +]  — can't use ×, uses +
Turn 3 (P1): 98 ... can't use +   
              98 × 1 = 98   [waste]   — × by 1 is legal but useless
              98 ÷ ... 98÷2=49 [too far]
              98 - ... loses ground
              P1 plays: 98 + 2 = 100 ✅  — WAIT, can't use + (P2 just used +)!
              P1 plays: 98 × 1 = 98   — stalls
Turn 4 (P2): 98 + 2 = 100 ✅  P2 WINS!
```

This shows the **strategic depth**: P1 got close too fast with ×, leaving P2 in a better position to finish.

**AI strategies:**

| Level | Algorithm | Depth |
|-------|-----------|-------|
| Easy | Random valid move | No lookahead |
| Medium | Greedy (pick move that gets closest to target) | 1-turn lookahead |
| Hard | **Minimax with alpha-beta pruning** | 4-turn lookahead — evaluates whether getting close helps or harms |
| Adaptive | Starts Easy, escalates | Based on player win rate |

**Hard AI evaluation function:**
```javascript
function evaluate(state) {
  const distance = Math.abs(state.currentNumber - state.target);
  const isMyTurn = state.activePlayer === 'ai';
  
  // If I'm close AND it's my turn → good (I can finish)
  // If I'm close AND it's opponent's turn → bad (they can finish)
  return isMyTurn ? -distance : distance;
}
```

**Mobile UI wireframe:**
```
┌──────────────────────────┐
│  TARGET: 100             │
│                          │
│  Current: 90             │  ← Large, central number
│                          │
│  History:                │
│  15 ×6→ 90               │  ← Chain visualization
│                          │
│  ❌ Last used: ×          │  ← Can't reuse
│                          │
│  Pick operator:          │
│  ┌───┬───┬───┬───┐      │
│  │ + │ − │ ×̶ │ ÷ │      │  ← × is struck through (disabled)
│  └───┴───┴───┴───┘      │
│  Pick number (1-9):      │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┐   │
│  │1│2│3│4│5│6│7│8│9│   │  ← Number buttons
│  └─┴─┴─┴─┴─┴─┴─┴─┴─┘   │
│  Preview: 90 + 8 = 98   │  ← Live preview before confirm
│  [Confirm Move]          │
└──────────────────────────┘
```

**Roast copy:**

| Situation | Skull Message |
|-----------|-------------|
| Opponent wins on your setup | *"You literally handed them the win. Beautiful self-sabotage."* |
| Player multiplies by 1 | *"Multiplying by 1. Bold strategy. Truly innovative."* |
| Dead end loss | *"No valid moves. You played yourself. Literally."* |
| Overshoot | *"Target was 100. You made 347. Geography isn't your strong suit either, is it?"* |
| Win in 3 turns | *"Three turns. Efficient. I'll give you that one."* |
| 20-turn draw | *"20 turns and neither of you could reach the target. Impressive incompetence."* |

**Badges:**
- 🪤 *"Trap Master"* — Force opponent into a dead end 5 times
- ⚡ *"Chain Lightning"* — Win in 3 turns or fewer
- 🧠 *"Chain Strategist"* — Beat Hard AI 3 times

---

#### 6.13.3 🏗️ Number Towers (Risk/Reward Placement) — Full Design

**Concept:** Random numbers are revealed one at a time. Place each into your tower. Goal: ascending order from bottom to top. Every placement is a probability gamble.

**NumberTowersEngine interface:**
```
NumberTowersEngine implements IGameEngine
├── createGame(config)              → generates sequence of random numbers from seed
├── revealNext(roundIndex)          → reveals next number to both players simultaneously
├── validatePlacement(playerId, slot) → checks: slot is empty
├── placeNumber(playerId, slot, number) → stores placement
├── calculateScore(tower)           → scores ascending runs
├── checkRoundWinner()              → compares tower scores after all 5 placed
├── checkMatchWinner()              → best of 3 rounds
└── getStateForPlayer(playerId)     → own tower, current number, slots remaining, opponent progress (slots filled, NOT values)
```

**Game rules:**

| Rule | Spec |
|------|------|
| **Tower size** | 5 slots (bottom = slot 1, top = slot 5) |
| **Number range** | 1–99 (Easy), 1–999 (Medium), 1–9999 (Hard) |
| **Numbers per round** | Exactly 5 (one per slot) |
| **Reveal** | One at a time, simultaneous to both players |
| **Placement** | Must place the current number before the next is revealed |
| **Placement timer** | 10 seconds per number |
| **Scoring** | See formula below |
| **Match format** | Best of 3 rounds |
| **Information** | You can see HOW MANY slots opponent has filled, but NOT where or what values |

**Scoring formula:**
```javascript
function scoreTower(tower) {
  // tower = [slot1, slot2, slot3, slot4, slot5] (bottom to top)
  let score = 0;
  let longestRun = 0;
  let currentRun = 1;
  
  for (let i = 0; i < tower.length; i++) {
    // Each number in correct ascending position = 1 point
    if (i === 0 || tower[i] > tower[i - 1]) {
      score += 1;
      currentRun++;
    } else {
      currentRun = 1; // Break in ascending order
    }
    longestRun = Math.max(longestRun, currentRun);
  }
  
  // Bonus for perfect ascending order
  if (longestRun === 5) score += 5;  // PERFECT — 10 total
  // Bonus for longest run
  else if (longestRun >= 3) score += longestRun - 2; // Run of 3 = +1, run of 4 = +2
  
  return score; // Max possible: 10 (5 ascending + 5 perfect bonus)
}
```

**Score examples:**
```
[15, 34, 51, 72, 88] → 5 ascending + 5 bonus = 10 (PERFECT)
[15, 34, 88, 72, 51] → 3 ascending (15<34<88) + 1 run bonus = 4
[88, 72, 51, 34, 15] → 1 (only slot 1 trivially "ascending") = 1
[50, 50, 50, 50, 50] → impossible (all numbers unique from range)
```

**AI strategies:**

| Level | Algorithm | How It Decides |
|-------|-----------|---------------|
| Easy | Random empty slot | No strategy |
| Medium | **Bucket strategy** — divides range into 5 equal buckets, places number in matching bucket's slot | e.g., number 37 in range 1–99 → bucket 2 → slot 2 |
| Hard | **Expected value calculation** — for each empty slot, calculates probability that future numbers will fit above/below | Considers remaining numbers, empty slots, and distribution |
| Adaptive | Starts Easy, escalates | Based on player's tower scores |

**Hard AI expected value:**
```javascript
function bestSlot(number, tower, range) {
  // For each empty slot, calculate:
  // P(all future numbers can fill remaining slots in ascending order)
  // Place in slot that maximizes expected total score
  // Uses combinatorial probability over remaining range
  
  const emptySlots = tower.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
  let bestScore = -1, bestSlotIdx = 0;
  
  for (const slot of emptySlots) {
    const simTower = [...tower];
    simTower[slot] = number;
    const expectedScore = monteCarlo(simTower, range, 1000); // 1000 simulations
    if (expectedScore > bestScore) {
      bestScore = expectedScore;
      bestSlotIdx = slot;
    }
  }
  return bestSlotIdx;
}
```

**Multiplayer flow:**
1. Both players see the same number (from seeded sequence)
2. Both have 10 seconds to place it (simultaneous, no information leak)
3. Server collects both placements, then reveals next number
4. After all 5 placed: both towers revealed, scores compared
5. Best of 3 rounds

**Mobile UI wireframe:**
```
┌──────────────────────────┐
│  PLACE THIS NUMBER:      │
│       ┌─────┐            │
│       │ 72  │            │  ← Current number (large, animated entrance)
│       └─────┘            │
│                          │
│  YOUR TOWER:             │  OPPONENT:
│  ┌─────────┐             │  ┌─────────┐
│  │ 5: ___  │ ← tap       │  │ ■■■■■■■ │  ← filled (hidden value)
│  │ 4: ___  │ ← tap       │  │ ▪▪▪▪▪▪▪ │  ← empty
│  │ 3:  51  │ ✓            │  │ ■■■■■■■ │  ← filled
│  │ 2:  34  │ ✓            │  │ ▪▪▪▪▪▪▪ │  ← empty
│  │ 1:  15  │ ✓            │  │ ■■■■■■■ │  ← filled
│  └─────────┘             │  └─────────┘
│                          │
│  ⏱️ 0:07 remaining      │
│  Round 1 of 3            │
└──────────────────────────┘
```

**Roast copy:**

| Situation | Skull Message |
|-----------|-------------|
| Put 92 in slot 2 | *"You put 92 in slot 2. With 3 slots above it. I'm speechless. Almost."* |
| Perfect tower | *"Perfect ascending order. Statistically improbable. I'm suspicious."* |
| All 5 wrong | *"Every single placement was wrong. That takes a special kind of talent."* |
| Put lowest number on top | *"15 on top. That's... that's not how towers work. Or numbers. Or anything."* |
| Opponent got perfect, player didn't | *"Your opponent got a perfect tower. You got... whatever that is."* |
| Timer ran out | *"10 seconds. To tap ONE slot. I'll just let that sink in."* |

**Badges:**
- 🏗️ *"Master Builder"* — Get 3 perfect towers in a row
- 🎲 *"Lucky Streak"* — Win 5 Number Towers matches
- 🧱 *"Tower of Babel"* — Score 0 points in a tower (all wrong — harder than it sounds)

---

#### 6.13.4 Cross-Mode Architecture Notes

**All 3 new modes reuse existing infrastructure:**

| Infrastructure | Reused From | Notes |
|---------------|-------------|-------|
| `IGameEngine` interface | §6.1 | Each mode implements the same interface |
| `engineFactory.js` | §6.1 | 3 new `case` entries (already added) |
| `roomManager.js` | §6.2 | Same room lifecycle — no changes needed |
| Socket events | §6.5 | `submit_guess` → `submit_solution` / `submit_move` / `submit_placement` (new event names, same handler pattern) |
| AI framework | §6.3 | New AI files in `server/src/game/ai/` — same delay simulation |
| Timer system | Phase 1 | Same `timerManager.js` — different durations per mode |
| Roast personality | §6.8 | New roast copy in `constants/copy.js` per mode |
| Badge system | Phase 3 | New badge definitions in seed data |
| Daily challenge | Phase 3 | Modes rotate: Mon=GTN, Tue=B&C, Wed=Countdown, Thu=Chain, Fri=Towers, Sat/Sun=random |
| Leaderboard | §6.12.8 | Separate sorted sets per mode: `lb:alltime:countdown`, etc. |

**New files per game mode (3 files each):**
```
server/src/game/CountdownEngine.js         ← Game logic
server/src/game/ai/countdownAI.js          ← AI strategies
client/src/components/countdown/           ← UI components
  ├── CountdownBoard.jsx
  ├── ExpressionBuilder.jsx
  └── NumberPicker.jsx

server/src/game/NumberChainEngine.js
server/src/game/ai/numberChainAI.js
client/src/components/number-chain/
  ├── ChainBoard.jsx
  ├── OperatorPicker.jsx
  └── ChainHistory.jsx

server/src/game/NumberTowersEngine.js
server/src/game/ai/numberTowersAI.js
client/src/components/number-towers/
  ├── TowerBoard.jsx
  ├── SlotPicker.jsx
  └── TowerComparison.jsx
```

**Estimated effort per mode:**
| Mode | Engine + AI | UI | Integration | Total |
|------|-----------|-----|------------|-------|
| Countdown | 2 days | 1.5 days | 0.5 day | **4 days** |
| Number Chain | 1.5 days | 1 day | 0.5 day | **3 days** |
| Number Towers | 1 day | 1 day | 0.5 day | **2.5 days** |
| **Total** | | | | **9.5 days** |

---

### 6.14 Audio Engineering 🎵🎵 (Veteran Sound Engineer Review)

Complete audio architecture for Numbskull. Covers: browser autoplay policy, central AudioManager, ADSR synthesis, hybrid sample+synthesis strategy, sound asset inventory, priority/ducking, stereo positioning, background music, and haptic sync.

> [!WARNING]
> Without this section, the game will have: silent audio on first load (autoplay policy), clicking artifacts (no ADSR), cacophonous sound stacking (no ducking), and microtonal noise (wrong pitch math). These are the items that separate a game demo from a polished audio experience.

---

#### 6.14.1 🔇 Browser Autoplay Policy — Mandatory Fix (Phase 1)

> [!CAUTION]
> Every modern browser (Chrome, Firefox, Safari, Edge) blocks `AudioContext` until user interaction. Without handling this, **100% of users hear zero audio on first page load**.

**Strategy: Resume on first meaningful interaction**

```javascript
// client/src/services/audioManager.js
class AudioManager {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.isResumed = false;
    this._setupAutoResume();
  }

  _setupAutoResume() {
    const resume = async () => {
      if (this.context.state === 'suspended') {
        await this.context.resume();
        this.isResumed = true;
        console.log('AudioContext resumed on user interaction');
      }
      // Remove listeners after first resume
      ['click', 'touchstart', 'keydown'].forEach(event => {
        document.removeEventListener(event, resume);
      });
    };

    ['click', 'touchstart', 'keydown'].forEach(event => {
      document.addEventListener(event, resume, { once: false, passive: true });
    });
  }
}
```

**UI indicator:**
- If audio is suspended after 3 seconds on home screen: show 🔇 icon in header
- Tapping the icon (or any button) resumes the context
- After resume: icon changes to 🔊 with a brief fade animation
- First audio after resume: play a subtle "audio ready" confirmation sound (50ms chime)

**Key rule:** NEVER call `audioContext.resume()` without a user gesture. Browsers will reject it and log a warning.

---

#### 6.14.2 🎛️ AudioManager Singleton Architecture (Phase 1)

Central audio controller. **ALL audio playback goes through this class.** No component should ever create its own `OscillatorNode` or `AudioBufferSourceNode` directly.

```javascript
// client/src/services/audioManager.js
class AudioManager {
  constructor() {
    this.context = new AudioContext();

    // Channel routing (gain nodes)
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    this.channels = {
      sfx:    this._createChannel(0.7),  // Sound effects (gameplay)
      music:  this._createChannel(0.4),  // Background music (default lower)
      ui:     this._createChannel(0.5),  // UI sounds (clicks, navigation)
      voice:  this._createChannel(0.8),  // Chimes, fanfares, celebrations
    };

    // Sound buffer cache (preloaded)
    this.buffers = new Map();          // soundId → AudioBuffer
    this.activeSources = new Set();    // Track playing sources for cleanup
    this.currentPriority = 4;          // Lowest priority by default

    // Settings integration
    this.sfxEnabled = true;
    this.musicEnabled = false;         // Default off per settings spec
    this.musicalFeedbackEnabled = true;
  }

  _createChannel(defaultVolume) {
    const gain = this.context.createGain();
    gain.gain.value = defaultVolume;
    gain.connect(this.masterGain);
    return gain;
  }

  // Preload a sound file into buffer cache
  async preload(soundId, url) {
    if (this.buffers.has(soundId)) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.buffers.set(soundId, audioBuffer);
  }

  // Play a preloaded sample
  play(soundId, options = {}) {
    if (!this.sfxEnabled && options.channel !== 'music') return;
    if (this.context.state === 'suspended') return; // Not resumed yet

    const {
      channel = 'sfx',
      priority = 3,
      pan = 0,           // -1 (left) to 1 (right)
      volume = 1,
      loop = false,
    } = options;

    // Priority ducking
    if (priority < this.currentPriority) {
      this._duckOtherChannels(priority);
    }

    const buffer = this.buffers.get(soundId);
    if (!buffer) { console.warn(`Sound not loaded: ${soundId}`); return; }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    // Volume
    const gainNode = this.context.createGain();
    gainNode.gain.value = volume;

    // Stereo pan
    const panner = this.context.createStereoPanner();
    panner.pan.value = pan;

    // Connect: source → gain → panner → channel → master
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.channels[channel]);

    source.start();
    this.activeSources.add(source);
    source.onended = () => this.activeSources.delete(source);

    return source; // Return for stop/cancel control
  }

  // Play a synthesized tone (for musical feedback)
  playTone(frequency, duration, options = {}) {
    if (!this.musicalFeedbackEnabled) return;
    if (this.context.state === 'suspended') return;
    // See §6.14.4 for ADSR implementation
    return this._synthTone(frequency, duration, options);
  }

  // Stop all audio (screen transitions)
  stopAll() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch (e) { /* already stopped */ }
    });
    this.activeSources.clear();
  }

  // Cleanup on component unmount
  dispose() {
    this.stopAll();
    this.context.close();
  }
}

// Singleton export
export const audioManager = new AudioManager();
```

**React hook wrapper:**
```javascript
// client/src/hooks/useSound.js
export function useSound() {
  return useMemo(() => ({
    play: (id, opts) => audioManager.play(id, opts),
    playTone: (freq, dur, opts) => audioManager.playTone(freq, dur, opts),
    stopAll: () => audioManager.stopAll(),
  }), []);
}
```

---

#### 6.14.3 🔊 Audio Priority & Ducking System (Phase 1)

Prevents cacophony when multiple sounds fire simultaneously (e.g., correct guess chord + round win fanfare + badge chime within 500ms).

| Priority | Category | Sounds | Ducking Behavior |
|----------|----------|--------|-----------------|
| **P0** (Critical) | Celebrations | Victory fanfare, first-win celebration, match won | Ducks ALL other audio to 15% for 1500ms |
| **P1** (Gameplay) | Core feedback | Correct/wrong guess, major chord, proximity pitch | Ducks UI + music to 40% for 500ms |
| **P2** (Notification) | Events | Turn chime, badge earned, timer tick, opponent guessed | Ducks music to 50%, plays alongside P1 |
| **P3** (UI) | Interface | Button click, navigation tap, toggle switch | Never ducks anything. Can be ducked. |
| **P4** (Ambient) | Background | Background music loop | Always ducked when P0–P2 plays |

**Ducking implementation:**
```javascript
_duckOtherChannels(activePriority) {
  const duckLevels = { 0: 0.15, 1: 0.40, 2: 0.50 };
  const duckAmount = duckLevels[activePriority] || 1;
  const now = this.context.currentTime;

  // Duck lower-priority channels
  Object.values(this.channels).forEach(channel => {
    channel.gain.linearRampToValueAtTime(
      channel.gain.value * duckAmount, now + 0.05 // 50ms fade
    );
  });

  // Restore after sound finishes
  setTimeout(() => {
    Object.entries(this.channels).forEach(([name, channel]) => {
      const defaultVol = { sfx: 0.7, music: 0.4, ui: 0.5, voice: 0.8 }[name];
      channel.gain.linearRampToValueAtTime(defaultVol, this.context.currentTime + 0.1);
    });
  }, activePriority === 0 ? 1500 : 500);
}
```

**Polyphony limit:** Maximum **4 simultaneous sources** across all channels. If a 5th fires, the oldest P3/P4 source is stopped to make room. P0/P1 sources are never killed.

---

#### 6.14.4 🎹 ADSR Envelope — Mandatory for All Synthesis (Phase 1)

> [!CAUTION]
> Raw `OscillatorNode.start()/stop()` produces audible click/pop artifacts because the waveform is cut abruptly. EVERY synthesized tone MUST use an ADSR envelope.

**ADSR (Attack-Decay-Sustain-Release):**

```javascript
_synthTone(frequency, duration, options = {}) {
  const {
    type = 'sine',      // 'sine' | 'triangle' | 'square' | 'sawtooth'
    channel = 'sfx',
    pan = 0,
    volume = 0.3,       // Synth tones should be quieter than samples
  } = options;

  const osc = this.context.createOscillator();
  const env = this.context.createGain();
  const panner = this.context.createStereoPanner();

  osc.type = type;
  osc.frequency.value = frequency;
  panner.pan.value = pan;

  // ADSR envelope — eliminates click/pop artifacts
  const now = this.context.currentTime;
  const attack  = 0.015;   // 15ms — fast but smooth
  const decay   = 0.030;   // 30ms
  const sustain = volume * 0.7; // 70% of peak during sustain
  const release = 0.050;   // 50ms — smooth fade out

  env.gain.setValueAtTime(0, now);                              // Start silent
  env.gain.linearRampToValueAtTime(volume, now + attack);       // Attack → peak
  env.gain.linearRampToValueAtTime(sustain, now + attack + decay); // Decay → sustain level
  env.gain.setValueAtTime(sustain, now + duration - release);   // Hold sustain
  env.gain.linearRampToValueAtTime(0, now + duration);          // Release → silence

  // Connect: osc → envelope → panner → channel
  osc.connect(env);
  env.connect(panner);
  panner.connect(this.channels[channel]);

  osc.start(now);
  osc.stop(now + duration + 0.01); // Tiny buffer after release

  this.activeSources.add(osc);
  osc.onended = () => this.activeSources.delete(osc);

  return osc;
}

// Play a chord (multiple simultaneous tones)
playChord(frequencies, duration, options = {}) {
  return frequencies.map(freq => this._synthTone(freq, duration, {
    ...options,
    volume: (options.volume || 0.3) / frequencies.length, // Divide volume to prevent clipping
  }));
}
```

**Wave type selection per sound category:**

| Sound | Wave Type | Why |
|-------|----------|-----|
| Proximity pitch (GTN) | `sine` | Pure, clean, non-fatiguing for repeated use |
| B&C interval feedback | `triangle` | Slightly richer than sine, still clean |
| Timer tick | `square` (low volume) | Sharp, clock-like character |
| Heartbeat (last attempt) | `sine` (low frequency, 60Hz) | Feels physical, sub-bass |
| Countdown beats (3-2-1) | `triangle` | Musical, warm |

---

#### 6.14.5 🎵 Hybrid Sound Strategy — Samples + Synthesis (Phase 1)

> [!IMPORTANT]
> Pure oscillator tones sound like a hearing test. Pre-recorded samples sound professional but cost bandwidth. The **hybrid approach** uses each where it's strongest.

| Sound Category | Approach | Why |
|---------------|----------|-----|
| **Proximity pitch** (GTN) | Synthesis (OscillatorNode + ADSR) | Procedural — different frequency every time. Samples would need 15+ files |
| **B&C interval feedback** | Synthesis (chord of oscillators) | Procedural — 11 different combinations |
| **Timer tick** | Synthesis (square wave, 10ms) | Trivial to synthesize. 1 KB sample unnecessary |
| **Heartbeat** | Synthesis (low sine, 60Hz) | Sub-bass needs no sample quality |
| **Correct guess chord** | **Sample** (MP3, 8 KB) | Pre-recorded chord sounds MUCH richer than 3 oscillators |
| **Wrong guess thud** | **Sample** (MP3, 4 KB) | Samples have natural reverb/texture |
| **Victory fanfare** | **Sample** (MP3, 15 KB) | Multi-layered fanfare impossible with oscillators |
| **First-win mega fanfare** | **Sample** (MP3, 20 KB) | Unique, emotional, must sound special |
| **Turn chime (arpeggio)** | **Sample** (MP3, 6 KB) | C→E→G arpeggio with natural decay |
| **Badge earned chime** | **Sample** (MP3, 5 KB) | Rewarding achievement sound |
| **Round won** | **Sample** (MP3, 10 KB) | Shorter victory sting |
| **Loss tone** | **Sample** (MP3, 6 KB) | Minor chord + descending |
| **Opponent guessed ding** | **Sample** (MP3, 2 KB) | Short notification |
| **UI button click** | **Sample** (MP3, 1 KB) | Subtle, tactile |
| **UI navigation** | **Sample** (MP3, 2 KB) | Soft whoosh |
| **Countdown beats (C/E/G/C5)** | **Sample** (MP3, 3 KB × 4 = 12 KB) | Musical notes need warmth |
| **Background music loop** | **Sample** (MP3, 80 KB) | Lo-fi hip-hop loop — impossible to synthesize |

---

#### 6.14.6 📦 Sound Asset Inventory & Loading Strategy (Phase 1)

**Complete asset list:**

| # | File | Purpose | Format | Size | Phase Load |
|---|------|---------|--------|------|-----------|
| 1 | `correct-chord.mp3` | Correct guess | MP3 | 8 KB | A |
| 2 | `wrong-thud.mp3` | Wrong guess | MP3 | 4 KB | A |
| 3 | `turn-chime.mp3` | Your turn starts | MP3 | 6 KB | A |
| 4 | `opponent-ding.mp3` | Opponent guessed | MP3 | 2 KB | A |
| 5 | `victory-fanfare.mp3` | Round won | MP3 | 10 KB | B |
| 6 | `match-victory.mp3` | Match won | MP3 | 15 KB | B |
| 7 | `first-win-mega.mp3` | First-ever win | MP3 | 20 KB | B |
| 8 | `loss-tone.mp3` | Loss screen | MP3 | 6 KB | B |
| 9 | `badge-chime.mp3` | Badge earned | MP3 | 5 KB | B |
| 10 | `countdown-c4.mp3` | "3" beat | MP3 | 3 KB | A |
| 11 | `countdown-e4.mp3` | "2" beat | MP3 | 3 KB | A |
| 12 | `countdown-g4.mp3` | "1" beat | MP3 | 3 KB | A |
| 13 | `countdown-c5.mp3` | "GO!" beat | MP3 | 3 KB | A |
| 14 | `ui-click.mp3` | Button press | MP3 | 1 KB | A |
| 15 | `ui-navigate.mp3` | Page transition | MP3 | 2 KB | A |
| 16 | `reaction-pop.mp3` | Emoji reaction | MP3 | 2 KB | B |
| 17 | `bgm-loop.mp3` | Background music | MP3 | 80 KB | C |
| — | *Proximity pitch* | GTN musical feedback | Synth | 0 KB | — |
| — | *B&C intervals* | B&C musical feedback | Synth | 0 KB | — |
| — | *Timer tick* | Last 5s tick | Synth | 0 KB | — |
| — | *Heartbeat* | Last attempt pulse | Synth | 0 KB | — |
| | **TOTAL** | **17 files + 4 synth** | | **~173 KB** | |

**Loading phases:**

| Phase | When | What | Size | Strategy |
|-------|------|------|------|----------|
| **A** (Immediate) | On `AudioContext.resume()` (first user interaction) | UI + core gameplay sounds (#1–4, #10–15) | **35 KB** | `Promise.all(preload(...))` — blocks nothing, loads in background |
| **B** (On game start) | When player enters lobby or starts single-player game | Celebrations + multiplayer sounds (#5–9, #16) | **58 KB** | Lazy preload during lobby wait time |
| **C** (On demand) | When user enables "Background Music" in settings | Music loop (#17) | **80 KB** | Load + play on toggle |

**Fallback:** If a sample fails to load (network error), fall back to synthesized equivalent (quality degrades gracefully, never silent).

---

#### 6.14.7 🎧 Stereo Positioning (Phase 2)

Subtle stereo panning adds subconscious spatial information in multiplayer:

| Sound | Pan Value | Spatial Meaning |
|-------|----------|----------------|
| Your guess result | `0.0` (center) | YOUR action, centered on you |
| Opponent guessed ding | `+0.20` (slight right) | "Other side" subconscious cue |
| Your turn chime | `-0.15` (slight left) | Draws attention to your panel |
| Reactions from opponent | `+0.30` (right) | Clearly "from them" |
| Timer tick | `0.0` (center) | Shared urgency |
| Victory fanfare | `0.0` (center, **wide stereo** in sample itself) | Celebration fills the space |
| Countdown beats | `0.0` (center) | Shared anticipation |
| Badge earned | `-0.10` (slight left) | Reward directed at you |

**Single-player:** All panning is `0.0` (center) — no spatial separation needed.

---

#### 6.14.8 🎶 Background Music System (Phase 1 architecture, Phase 5 content)

**Genre:** Lo-fi hip-hop / chillhop — matches the sarcastic-but-chill vibe of Numbskull. Think "lo-fi beats to roast numbers to."

**Dynamic intensity system (layered stems):**

| Game State | Music Layer | Tempo | Volume | Transition |
|-----------|-------------|-------|--------|-----------|
| **Home / Menu** | Base beat + soft keys | 85 BPM | 40% | — |
| **Lobby** | Same as home, brighter hi-hat | 85 BPM | 35% | Crossfade 500ms |
| **Gameplay (early)** | Minimal ambient — bass + soft pad | 90 BPM | 25% | Crossfade 1s |
| **Gameplay (< 5 guesses left)** | Add tension layer (faster hi-hat) | 100 BPM | 30% | Layer fades in over 2s |
| **Timer < 10s** | Add urgency layer (synth pulse) | 110 BPM | 35% | Layer fades in over 1s |
| **Win screen** | Victory sting → relaxed resolution | — | 50% | Hard cut to sting |
| **Loss screen** | Minor key fade-out | — | 30% | 2s fadeout |

**Implementation:** Single audio file with tempo markers. Stems are separate `AudioBufferSourceNode` instances that can be added/removed for dynamic layering. All stems are the same BPM and synced to the same `context.currentTime` clock.

**Default state:** Music OFF (per settings spec). Enabled via Settings → "Background Music: On/Off". Volume slider: 0–100%.

**Auto-duck rule:** When any P0/P1 sound plays, music channel ducks to 15% for the sound's duration, then fades back over 200ms.

---

#### 6.14.9 📳 Haptic-Audio Sync Table (Phase 1)

Every haptic event syncs precisely with its audio counterpart:

| Event | Vibration Pattern (ms) | Audio Pair | Sync Rule |
|-------|----------------------|-----------|-----------|
| Correct guess | `[50]` | Major chord (500ms) | Haptic fires at chord onset (t=0) |
| Wrong guess | `[30, 20, 30]` (buzz-pause-buzz) | Low thud (300ms) | Haptic starts with thud onset |
| Too high / Too low | `[20]` | Directional pitch (200ms) | Haptic at pitch onset |
| Timer tick (last 5s) | `[15]` per tick | Tick-tock (synth) | Haptic on each tick beat |
| Heartbeat (last attempt) | `[80, 200, 80, 600]` loop | 60 BPM sine pulse | Haptic matches lub-dub rhythm |
| Your turn starts | `[30, 30, 50]` (short arpeggio) | Turn chime (400ms) | Haptic taps follow C→E→G rhythm |
| Round won | `[50, 50, 50, 100]` | Victory fanfare (800ms) | Haptic pattern during first 350ms |
| Match won | `[50, 50, 50, 50, 100, 200, 100]` | Extended celebration (1500ms) | Building pattern — climax at t=500ms |
| Badge earned | `[30, 50, 100]` | Achievement chime (400ms) | Haptic fires at bounce moment (t=700ms) — same as audio |
| First-ever win | `[50, 50, 50, 100, 100, 200, 200, 100]` | Mega fanfare (2000ms) | Extended celebration haptic pattern |

**Implementation:**
```javascript
function hapticPlay(pattern) {
  if (!navigator.vibrate) return; // Feature detection
  if (!settingsStore.hapticsEnabled) return; // User preference
  navigator.vibrate(pattern);
}

// Sync with audio: call hapticPlay at same moment as audioManager.play()
function onCorrectGuess() {
  audioManager.play('correct-chord', { priority: 1 });
  hapticPlay([50]);
}
```

**Settings:** "Haptic Feedback: On/Off" toggle. Default ON for mobile, hidden on desktop (no vibration API).

---

### 6.15 Accessibility Engineering ♿♿ (Veteran Accessibility Specialist Review)

Complete WCAG 2.1 AA compliance spec. Covers: ARIA live regions, focus management, color-blind mode, contrast ratios, keyboard navigation, skip links, and timer accessibility.

> [!CAUTION]
> Without this section, screen reader users experience ZERO game feedback (no ARIA live regions), keyboard users get stranded on every navigation, and color-blind users can't distinguish Too High from Too Low. These are legal requirements under ADA/EAA, not optional polish.

---

#### 6.15.1 📢 ARIA Live Regions for Real-Time Events (Phase 1)

Screen readers have NO WAY to announce dynamic game changes without ARIA live regions.

**Hidden announcer element (always in DOM):**
```html
<div id="game-announcer" aria-live="assertive" aria-atomic="true" class="sr-only"></div>
<div id="game-log" aria-live="polite" aria-atomic="true" class="sr-only"></div>
```

**Screen-reader-only CSS:**
```css
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
```

**Event → Announcement mapping:**

| Game Event | ARIA Region | Priority | Announcement Text |
|-----------|------------|----------|-------------------|
| Turn change | `assertive` | Immediate | "Your turn. Enter your guess." |
| Guess result (GTN) | `assertive` | Immediate | "42 is too high. Range is now 1 to 41." |
| Guess result (B&C) | `assertive` | Immediate | "1 bull, 2 cows. 7 guesses remaining." |
| Opponent guessed | `polite` | Queue | "Opponent submitted guess 3." |
| Timer warning (10s) | `assertive` | Immediate | "10 seconds remaining." |
| Timer warning (5s) | `assertive` | Immediate | "5 seconds! Hurry!" |
| Round result | `assertive` | Immediate | "You won round 1! Score: 1-0." |
| Match result | `assertive` | Immediate | "Match over. You won 2-1! Well played." |
| Skull roast | `polite` | Queue | Reads the roast text verbatim |
| Error | `role="alert"` | Immediate | "Room not found. Check the code." |
| Badge earned | `polite` | Queue | "Badge earned: First Blood." |
| Chat/reaction | `polite` | Queue | "Player 2 sent fire emoji." |
| Connection lost | `assertive` | Immediate | "Connection lost. Reconnecting in 15 seconds." |

**Implementation:**
```javascript
// client/src/services/announcer.js
export function announce(message, priority = 'polite') {
  const el = document.getElementById(priority === 'assertive' ? 'game-announcer' : 'game-log');
  el.textContent = ''; // Clear first (forces re-announcement)
  requestAnimationFrame(() => { el.textContent = message; });
}
```

---

#### 6.15.2 🎯 Focus Management Strategy (Phase 1)

| Transition | Focus Target | Method |
|-----------|-------------|--------|
| Home → Lobby | Ready button | `useEffect(() => readyBtnRef.current?.focus(), [])` |
| Lobby → Game board | Number input field | Auto-focus on mount |
| Modal opens | First focusable element inside | Focus trap (see below) |
| Modal closes | Element that triggered modal | Store `document.activeElement` before open |
| Guess submitted | Input field (cleared) | `inputRef.current?.focus()` |
| Turn change (your turn) | Input field | Auto-focus |
| Turn change (opponent's turn) | "Waiting" status text | `tabindex="-1"` + `.focus()` |
| Game → Result screen | "Play Again" button | Auto-focus |
| Error toast | Toast element (briefly) | `role="alert"` auto-announces |

**Focus trap for modals:**
```javascript
function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0], last = focusable[focusable.length - 1];
  modalEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  first?.focus();
}
```

**Rule:** `tabindex="0"` for naturally focusable. `tabindex="-1"` for programmatic focus only. **NEVER** `tabindex > 0`.

---

#### 6.15.3 🎨 Color-Blind Mode Implementation (Phase 6)

> [!WARNING]
> NEVER use color alone to convey information. Always pair with **icon + text + pattern**.

**Settings → "Color-Blind Mode: Off / Deuteranopia / Protanopia"**

| Element | Default | Color-Blind Mode | Additional Cue |
|---------|---------|-----------------|----------------|
| Too High | Red `#FF6B6B` | Blue `#6B9FFF` | ▲ arrow icon always shown |
| Too Low | Blue `#6BC5FF` | Orange `#FFB86B` | ▼ arrow icon always shown |
| Correct | Green `#6BFF8A` | White `#FFFFFF` | ✓ checkmark icon |
| Bulls 🐂 | Green indicator | Blue indicator | "B" text label alongside |
| Cows 🐄 | Yellow indicator | Orange indicator | "C" text label alongside |
| Timer safe | Green ring | Blue ring | — |
| Timer warning | Yellow ring | Light blue ring | — |
| Timer danger | Red ring | Orange ring + pulse | Pulse animation differentiates |

**Implementation:** CSS class on `<body>`:
```css
body.cb-deuteranopia { --color-high: #6B9FFF; --color-low: #FFB86B; --color-correct: #FFFFFF; }
body.cb-protanopia { --color-high: #6B9FFF; --color-low: #FFB86B; --color-correct: #FFFFFF; }
```

---

#### 6.15.4 🔲 Contrast Ratio Fixes (Phase 1)

| Pair | Foreground | Background | Current Ratio | Fix |
|------|-----------|-----------|---------------|-----|
| Disabled text | `#6B6880` | `#1C1842` | 2.8:1 ❌ | Bump to `#8A87A0` (4.6:1) ✅ |
| Accent on dark | `#9D5CFF` | `#1C1842` | 3.4:1 ⚠️ | Use for large text only, or lighten to `#B07FFF` (4.5:1) |
| Button text on purple | `#FFFFFF` | `#9D5CFF` | 3.9:1 ⚠️ | Lighten button to `#A87FFF` or use `#1C1842` dark text |

**Rule:** Run every color pair through WCAG contrast checker during design system implementation. Target ≥4.5:1 for all text.

---

#### 6.15.5 ⌨️ Keyboard Navigation Tab Order (Phase 1)

**Home Screen:** Skip link → Game Mode selector → Create Room → Join Room → Quick Match → vs AI → Daily Challenge → Login → Settings

**Game Board (GTN):** Skip link → Input field (auto-focused) → Submit → Hint → History table (arrow-key navigable) → Leave Game

**Game Board (B&C):** Skip link → Digit 1 → Digit 2 → Digit 3 → Digit 4 → Submit → Hint → Digit Tracker → History → Leave

**Skip navigation link:**
```html
<body>
  <a href="#main-content" class="sr-only focus-visible:not-sr-only">Skip to game content</a>
  <header>...</header>
  <main id="main-content" tabindex="-1">...</main>
</body>
```

**`:focus-visible` styling (keyboard only, not mouse):**
```css
:focus-visible { outline: 3px solid var(--color-juice); outline-offset: 2px; border-radius: 4px; }
:focus:not(:focus-visible) { outline: none; } /* No outline on mouse click */
```

---

#### 6.15.6 ⏱️ Timer Accessibility (Phase 1)

```html
<div role="timer" aria-label="Time remaining: 23 seconds" aria-live="off">
  <!-- Visual timer ring -->
</div>
```

- `aria-label` updated every **5 seconds** (not every second — too noisy for screen readers)
- At 10s: switch `aria-live` to `"assertive"`, announce "10 seconds remaining"
- At 5s: announce "5 seconds! Hurry!"
- Timer tick sound (§6.14) serves as audio cue for sighted users with screen readers off

---

### 6.16 Security Hardening 🔐🔐 (Veteran Pen-Testing Specialist Review)

Threat model and attack mitigation for all user-facing attack surfaces.

> [!CAUTION]
> User-generated content (display names, chat) + real-time WebSocket connections = significant attack surface. Without XSS sanitization and CSP headers, a single malicious display name can steal every opponent's session.

---

#### 6.16.1 🛡️ XSS Prevention — Input Sanitization (Phase 1)

| Input | Sanitization | Where |
|-------|-------------|-------|
| Display name | Strip ALL HTML. Allow only `[a-zA-Z0-9_\-. ]` + common Unicode letters | Server: registration + name change |
| Chat message | HTML entity encode (`<` → `&lt;`). Never render raw HTML | Server: before Socket broadcast |
| Room names | Same as display name | Server: on creation |
| Emoji reactions | Whitelist only: `👍😮🔥😂🤔` + "GG" — reject all others | Server: on receive |

```javascript
import DOMPurify from 'isomorphic-dompurify';
function sanitizeInput(input, type) {
  const stripped = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  if (type === 'displayName') return stripped.replace(/[^a-zA-Z0-9_\-. \p{L}]/gu, '').trim().substring(0, 20);
  if (type === 'chat') return stripped.substring(0, 200);
  return stripped;
}
```

**React rule:** NEVER use `dangerouslySetInnerHTML` for any user-generated content.

---

#### 6.16.2 🔒 Content Security Policy Headers (Phase 1)

```javascript
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "wss://*.numbskull.gg", "https://*.numbskull.gg"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

#### 6.16.3 🚪 Room Code Brute-Force Protection (Phase 2)

| Protection | Spec |
|-----------|------|
| Code length | **6 characters** minimum (28⁶ = ~481M possible codes) |
| Alphabet | `[A-Z2-9]` excluding O, 0, I, l = 28 chars |
| Rate limit `join_room` | 5 per minute (already specced) |
| Failed join tracking | 10 failed joins in 5 min → 15-min ban from joining any room |
| Code expiry | Codes expire 10 min after room closes |

---

#### 6.16.4 🔌 Socket Event Validation Middleware (Phase 2)

Every socket event passes through a validation chain before reaching game logic:

```javascript
function validateSocketEvent(socket, event, data, callback) {
  // 1. User in room? (for game events)
  // 2. Their turn? (for submit_guess)
  // 3. Game in valid state? (PLAYING, not FINISHED)
  // 4. Data valid? (Zod schema per event)
  // 5. Rate limit check
  // → If any fail: callback({ error: 'CODE' })
}
```

**State validation matrix:**

| Event | Required State | Required Role |
|-------|---------------|--------------|
| `submit_guess` | `PLAYING` + player's turn | Player in room |
| `submit_secret` | `SETUP` | Player in room |
| `ready_up` | `WAITING` | Player in room |
| `start_game` | `READY` | Host only |
| `request_hint` | `PLAYING` + player's turn | Player in room |
| `send_reaction` | `PLAYING` or `FINISHED` | Player or spectator |
| `request_rematch` | `FINISHED` | Player in room |

---

#### 6.16.5 📦 Dependency Vulnerability Scanning (Phase 1)

```json
{ "scripts": { "audit": "npm audit --audit-level=high", "audit:fix": "npm audit fix" } }
```

- GitHub Dependabot enabled on repository
- CI pipeline: `npm audit` → block deploy if HIGH/CRITICAL vulnerabilities
- Monthly manual review of dependency tree

---

### 6.17 Mobile UX Engineering 📱📱 (Veteran Mobile UX Specialist Review)

Mobile-specific UX specs that prevent rage-quits, broken layouts, and poor touch experiences.

---

#### 6.17.1 👆 Touch Target Minimums (Phase 1)

> [!IMPORTANT]
> Apple HIG: 44×44pt minimum. Material Design: 48×48dp minimum. Numbskull uses **48×48px** with **8px minimum spacing**.

| Element | Minimum Size | Spacing |
|---------|-------------|---------|
| Submit button | 48×48px | — |
| Digit inputs (B&C) | 48×48px | 8px between fields |
| Operator buttons (Countdown) | 48×48px | 8px spacing |
| Number pad (Number Chain) | 44×44px | 4px spacing |
| Tower slots (Number Towers) | 56×56px (large targets for speed) | 8px spacing |
| History rows | 44px height minimum | — |
| Modal close/X button | 44×44px | — |
| Emoji reaction buttons | 40×40px | 4px spacing |
| Settings toggle switches | 48×28px (standard iOS size) | — |
| Navigation icons | 44×44px | — |

---

#### 6.17.2 📐 Safe Area / Notch Handling (Phase 1)

```css
:root {
  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
  --safe-left: env(safe-area-inset-left);
  --safe-right: env(safe-area-inset-right);
}
body {
  padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
}
/* Bottom action buttons must clear the home indicator */
.bottom-action-bar { padding-bottom: calc(16px + var(--safe-bottom)); }
```

**Viewport meta tag:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

---

#### 6.17.3 🔄 Swipe Gesture Conflict Prevention (Phase 1)

```css
.game-container {
  touch-action: pan-y;          /* Allow vertical scroll only — prevent browser back on swipe-left */
  overscroll-behavior: contain; /* Prevent pull-to-refresh during gameplay */
  -webkit-overflow-scrolling: touch;
}
```

**Disable iOS rubber-band bounce during gameplay:**
```css
.game-active { overflow: hidden; position: fixed; width: 100%; }
```

---

#### 6.17.4 📲 PWA Install Flow UX (Phase 5)

| Step | Trigger | UX |
|------|---------|-----|
| 1 | Capture `beforeinstallprompt` event on first visit | Store deferred prompt |
| 2 | 2nd session: show bottom sheet | Skull icon + *"Install Numbskull. No app store. Just tap. — 💀"* |
| 3 | User dismisses | Show again after 3 more sessions |
| 4 | Max 3 total prompts | After 3 dismissals: never show again |
| 5 | User taps "Install" | Call `deferredPrompt.prompt()` |
| 6 | Track outcome | `plausible('pwa_installed', { props: { prompt_number } })` |

---

#### 6.17.5 📴 Offline Experience UX (Phase 5)

| Feature | Offline Behavior |
|---------|-----------------|
| Home screen | Show cached version with "Offline" badge in header |
| Leaderboard | Show last cached data with "Last updated: X ago" |
| Profile/badges | Show cached data |
| vs AI (Easy) | **Playable** — game engine logic is client-bundled for AI mode |
| Multiplayer | Show "No connection" with auto-retry indicator |
| Daily challenge | Show "Come back online to play today's challenge" |

---

#### 6.17.6 📏 iOS Viewport Jump Fix (Phase 1)

```css
html { height: -webkit-fill-available; }
body { min-height: -webkit-fill-available; min-height: 100dvh; /* Dynamic viewport height */ }
```

Use `100dvh` (dynamic viewport height) instead of `100vh` — accounts for iOS Safari address bar.

---

### 6.18 Analytics & Event Tracking 📊📊 (Veteran Data Specialist Review)

Event taxonomy, funnel definitions, and A/B testing framework.

---

#### 6.18.1 📋 Event Taxonomy (Phase 5)

| # | Event Name | Properties | Funnel Stage |
|---|-----------|-----------|-------------|
| 1 | `page_view` | `path`, `referrer`, `utm_*` | Acquisition |
| 2 | `session_started` | `returning_user`, `days_since_last` | Retention |
| 3 | `tutorial_step` | `step_index`, `skipped` | Onboarding |
| 4 | `game_started` | `mode`, `difficulty`, `is_ai`, `is_multiplayer` | Activation |
| 5 | `guess_submitted` | `mode`, `guess_number`, `is_correct` | Engagement |
| 6 | `game_completed` | `mode`, `result`, `attempts`, `duration_sec`, `efficiency_score` | Activation |
| 7 | `room_created` | `mode`, `visibility` | Social |
| 8 | `room_joined` | `method` (code/quick_match/invite) | Social |
| 9 | `share_triggered` | `mode`, `platform`, `share_type` | Viral |
| 10 | `badge_earned` | `badge_id`, `games_played` | Retention |
| 11 | `daily_challenge_played` | `mode`, `result`, `attempts` | Retention |
| 12 | `account_registered` | `method`, `games_before_reg` | Conversion |
| 13 | `pwa_installed` | `prompt_number` | Conversion |
| 14 | `feature_unlocked` | `feature_key` | Progression |
| 15 | `setting_changed` | `setting_key`, `new_value` | Preferences |

**Naming convention:** `snake_case`, verb_noun pattern. No PII in any property.

---

#### 6.18.2 📈 Funnel Definitions (Phase 5)

| Funnel | Steps | Target |
|--------|-------|--------|
| **Onboarding** | Visit → Tutorial complete → First game complete | ≥60% |
| **Registration** | Guest game #3 → See nudge → Register | ≥15% |
| **Retention D1** | Play today → Play tomorrow | ≥30% |
| **Retention D7** | Play today → Play within 7 days | ≥50% |
| **Viral** | Win game → Tap share → Recipient visits | ≥5% |
| **PWA** | Visit #2 → See prompt → Install | ≥10% |
| **Multiplayer** | Play AI → Create room → Complete MP game | ≥20% |

---

#### 6.18.3 🧪 A/B Testing Framework (Phase 5)

Simple client-side split using deterministic hashing:
```javascript
function getVariant(userId, experimentId) {
  const hash = hashCode(`${userId}-${experimentId}`);
  return hash % 2 === 0 ? 'A' : 'B';
}
// Track: plausible('game_completed', { props: { ab_variant: variant } })
```

No external A/B framework needed. Plausible custom properties enable variant comparison.

---

### 6.19 Performance & Core Web Vitals ⚡⚡ (Veteran Performance Specialist Review)

Bundle budget, code splitting, font loading, image optimization, caching, and Core Web Vitals targets.

---

#### 6.19.1 📦 Bundle Size Budget (Phase 1)

| Route | Max JS (gzipped) | Includes |
|-------|-----------------|----------|
| `/` (Home) | **≤50 KB** | React core + home screen + design system |
| `/game` (Playing) | **≤80 KB** | + game board + socket.io-client |
| `/leaderboard` | **≤30 KB** | + leaderboard component (lazy) |
| `/profile` | **≤40 KB** | + profile components (lazy) |
| **Total** | **≤200 KB** | All routes combined |
| `react + react-dom` | ~42 KB | Fixed cost |
| `socket.io-client` | ~25 KB | Fixed cost |

**Monitoring:** `npx vite-bundle-visualizer` after every feature merge. Alert if any route exceeds budget.

---

#### 6.19.2 ✂️ Code Splitting Strategy (Phase 1)

```javascript
// Lazy load non-critical routes (React.lazy + Suspense)
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
// Game boards — load on game start only
const GTNBoard = lazy(() => import('./components/game/GTNBoard'));
const BullsCowsBoard = lazy(() => import('./components/game/BullsCowsBoard'));
```

**Socket.io:** Don't import on home page. Dynamic import when entering lobby:
```javascript
async function connectSocket() {
  const { io } = await import('socket.io-client');
  return io(SOCKET_URL, { auth: { token } });
}
```

---

#### 6.19.3 🎯 Core Web Vitals Targets (Phase 6)

| Metric | Target | Strategy |
|--------|--------|----------|
| **LCP** | < 1.5s | Preload fonts, inline critical CSS, defer non-critical JS, Vercel edge cache |
| **INP** | < 100ms | No heavy computation on main thread. `requestIdleCallback` for analytics |
| **CLS** | < 0.05 | Explicit `width`/`height` on images. No layout-shifting skeletons. Font `display: swap` |
| **TTFB** | < 200ms | Vercel edge caching, Railway auto-scaling |
| **TTI** | < 2.5s | Defer socket connection. Lazy load non-critical routes |

---

#### 6.19.4 🔤 Font Loading Strategy (Phase 1)

**Self-host fonts** (no Google Fonts CDN — eliminates extra DNS lookup + privacy concern):

```html
<link rel="preload" href="/fonts/outfit-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-400.woff2" as="font" type="font/woff2" crossorigin>
```
```css
@font-face {
  font-family: 'Outfit'; font-display: swap;
  src: url('/fonts/outfit-700.woff2') format('woff2');
  font-weight: 700;
}
@font-face {
  font-family: 'Inter'; font-display: swap;
  src: url('/fonts/inter-400.woff2') format('woff2');
  font-weight: 400;
}
```

**Font subset:** Latin characters only (~20KB per font instead of ~80KB).

---

#### 6.19.5 🖼️ Image Optimization (Phase 1)

- **SVG** for skull logo, badge icons, UI icons (scalable, tiny, no optimization needed)
- **WebP** with PNG fallback for share cards, avatars
- Lazy loading for below-fold: `loading="lazy"`
- `<picture>` with srcset for 1x/2x/3x density where needed

---

#### 6.19.6 💾 Service Worker Caching Strategy (Phase 5)

| Resource | Strategy | TTL |
|----------|----------|-----|
| HTML shell | Network-first, cache fallback | — |
| CSS/JS bundles | Cache-first (hashed filenames) | 1 year |
| Fonts | Cache-first | 1 year |
| Sound assets (Phase A) | Cache-first | 1 year |
| API responses (general) | Network-first | — |
| Leaderboard API | Stale-while-revalidate | 5 min |
| User profile/stats API | Stale-while-revalidate | 1 min |

**Workbox config:**
```javascript
// vite-plugin-pwa or workbox-webpack-plugin
workbox.routing.registerRoute(
  /\/api\/leaderboard/, new workbox.strategies.StaleWhileRevalidate({ cacheName: 'leaderboard', plugins: [new workbox.expiration.ExpirationPlugin({ maxAgeSeconds: 300 })] })
);
```

---

### 6.20 Database & Data Modeling 🗄️🗄️ (Veteran Database Specialist Review)

Index strategy, N+1 prevention, connection pooling, data retention, backup, and schema fixes.

---

#### 6.20.1 📇 Index Strategy (Phase 1)

> [!IMPORTANT]
> Without indexes, match history and leaderboard queries do full table scans. At 100K games = seconds per query.

| Table | Index | Query Pattern | Type |
|-------|-------|-------------|------|
| `User` | `(email)` UNIQUE | Login lookup | B-tree |
| `User` | `(lower(display_name))` UNIQUE | Name uniqueness | Expression |
| `User` | `(mmr_rating)` | Matchmaking range | B-tree |
| `Room` | `(room_code)` UNIQUE | Room join | B-tree |
| `Room` | `(status, visibility)` | Public room listing | Composite |
| `Room` | `(expires_at)` WHERE status='waiting' | Expired cleanup | Partial |
| `Game` | `(player1_id)`, `(player2_id)` | Match history | B-tree |
| `Game` | `(game_mode, created_at DESC)` | Mode leaderboard | Composite |
| `Guess` | `(round_id, created_at)` | History in order | Composite |
| `Badge` | `(user_id, badge_id)` UNIQUE | No duplicates | Composite unique |
| `DailyChallengeEntry` | `(challenge_date, user_id)` UNIQUE | One per day | Composite unique |
| `Friendship` | `(requester_id, addressee_id)` UNIQUE | No duplicates | Composite unique |
| `WeeklyQuest` | `(user_id, week_start)` | Weekly lookup | Composite |
| `FeatureUnlock` | `(user_id, feature_key)` UNIQUE | Feature check | Composite unique |

**Prisma syntax:**
```prisma
model Badge {
  @@unique([userId, badgeId])
  @@index([userId])
}
model Game {
  @@index([player1Id])
  @@index([player2Id])
  @@index([gameMode, createdAt(sort: Desc)])
}
```

---

#### 6.20.2 🔗 N+1 Query Prevention Rules (Phase 1)

```javascript
// ❌ N+1 — 1 query + N user lookups
const games = await prisma.game.findMany();
for (const g of games) g.player1 = await prisma.user.findUnique({ where: { id: g.player1Id } });

// ✅ Eager load
const games = await prisma.game.findMany({
  include: { player1: { select: { id: true, displayName: true, avatarUrl: true } },
             player2: { select: { id: true, displayName: true, avatarUrl: true } } },
  orderBy: { createdAt: 'desc' }, take: 50,
});
```

**Rule:** Every Prisma query returning data for the UI MUST use `include` or `select`. Code review checklist item.

---

#### 6.20.3 🔌 Connection Pool Configuration (Phase 1)

```env
# Railway free tier: max 20 connections
DATABASE_URL="postgresql://user:pass@host:5432/numbskull?connection_limit=15&pool_timeout=10"
```

- `connection_limit=15` — leave 5 connections for migrations/admin
- `pool_timeout=10` — fail fast if pool exhausted (10s)
- Monitor: log warning if pool utilization > 80%

---

#### 6.20.4 🗑️ Data Retention & Cleanup Cron Jobs (Phase 5)

| Data | Retention | Cleanup Method | Schedule |
|------|----------|---------------|----------|
| Guest server fingerprints | 90 days | `DELETE FROM daily_challenge_entries WHERE device_fingerprint IS NOT NULL AND created_at < NOW() - INTERVAL '90 days'` | Weekly cron |
| Expired rooms | 24h after expiry | `DELETE FROM rooms WHERE expires_at < NOW() - INTERVAL '24 hours'` | Hourly cron |
| Soft-deleted users | 30 days | Hard delete user + CASCADE all related rows | Daily cron |
| Redis weekly leaderboards | Auto-expire (7d TTL) | Redis handles | Automatic |
| Redis daily leaderboards | Auto-expire (24h TTL) | Redis handles | Automatic |
| Redis sessions | 30-day TTL | Redis handles | Automatic |
| Old game data | Keep forever | — (needed for replays, leaderboards) | — |

---

#### 6.20.5 💾 Backup Strategy (Phase 1)

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| PostgreSQL | Railway automatic snapshots | Daily | 7 days |
| Redis | RDB snapshots (Railway) | Every 6h | 3 days |
| User uploads | Cloudinary managed | — | Permanent |

**Disaster recovery:** Railway supports point-in-time restore. Document the restore procedure in ops runbook.

---

#### 6.20.6 🎮 GameMode Enum Expansion (Phase 1 schema, Phase 7 values)

```prisma
enum GameMode {
  guess_the_number
  bulls_and_cows
  countdown        // Phase 7
  number_chain     // Phase 7
  number_towers    // Phase 7
}
```

Define all 5 values in schema from Phase 1. Engine factory only enables launched modes — extra enum values don't break anything.

---

### 6.21 Legal & Compliance ⚖️⚖️ (Veteran Legal/Compliance Specialist Review)

Cookie consent, privacy policy, terms of service, GDPR data export, account deletion, and age verification.

> [!WARNING]
> Operating without a Privacy Policy + cookie consent is illegal in the EU (GDPR), UK (UK GDPR), California (CCPA), and many other jurisdictions. These are not optional features — they're legal requirements.

---

#### 6.21.1 🍪 Cookie Consent Implementation (Phase 5)

| Cookie/Storage | Essential? | Consent Required? |
|---------------|-----------|-------------------|
| JWT refresh token (httpOnly cookie) | ✅ Yes | ❌ No |
| Guest UUID (localStorage) | ✅ Yes | ❌ No |
| User settings (localStorage) | ✅ Yes | ❌ No |
| Cookie consent preference | ✅ Yes | ❌ No |
| Plausible analytics | ❌ No | ✅ **Yes** |
| A/B test variant | ❌ No | ✅ **Yes** |

**Banner UX:**
```
┌──────────────────────────────────────────────────┐
│ 🍪 We use cookies for anonymous analytics.       │
│ No personal data. No tracking across sites.      │
│                                                  │
│ [Accept All]  [Reject Analytics]  [Cookie Policy]│
└──────────────────────────────────────────────────┘
```

- Bottom of screen, non-blocking (game fully playable without accepting)
- "Reject Analytics" = Plausible script never loaded. Zero tracking
- Consent stored: `localStorage.cookie_consent = { analytics: true/false, timestamp: ISO }`
- Re-prompt: never (unless user clears storage). "Manage cookies" link in footer/settings

---

#### 6.21.2 📜 Privacy Policy Outline (Phase 4)

**Route:** `/privacy` — static page, no auth required.

| Section | Content Summary |
|---------|----------------|
| **What we collect** | Registered: email, display name, avatar, game stats. Guests: game stats only (no PII) |
| **How we use it** | Game functionality, leaderboards, friend features |
| **Analytics** | Plausible (privacy-first, no PII, no cookies by default, EU-hosted) |
| **Third parties** | Plausible (analytics), Cloudinary (avatars), Google (OAuth), Resend (email) |
| **Data storage** | PostgreSQL on Railway. Specify region (EU or US) |
| **Retention** | Account: until deletion. Guest: 90 days. Deleted accounts: 30-day grace → permanent |
| **Your rights (GDPR)** | Access, rectification, erasure, portability, objection (Arts. 15–21) |
| **Data export** | Settings → "Export My Data" → JSON download |
| **Account deletion** | Settings → "Delete Account" → 30-day soft delete → permanent |
| **Children** | Not directed at under-13. No COPPA data collection |
| **Contact** | Email for privacy requests |
| **Updates** | "Last updated" date. Users notified of material changes |

---

#### 6.21.3 📋 Terms of Service Outline (Phase 4)

**Route:** `/terms` — static page.

| Section | Content Summary |
|---------|----------------|
| **Acceptable use** | No cheating, no harassment, no bots, no automated scraping |
| **Account responsibility** | User responsible for account security |
| **Termination** | We may ban for ToS violations. Users can delete anytime |
| **Content** | User-generated (display names) — no IP claims. We may remove offensive content |
| **Liability** | Game "as-is". No uptime guarantee. No liability for data loss |
| **Age requirement** | Must be 13+ (or parental consent) |
| **Modifications** | We may update ToS. Continued use = acceptance |
| **Governing law** | Specify jurisdiction |

---

#### 6.21.4 📤 GDPR Data Export Implementation (Phase 4)

**Endpoint:** `GET /api/users/me/export` (auth required)

```javascript
async function exportUserData(userId) {
  const data = {
    profile: await prisma.user.findUnique({ where: { id: userId },
      select: { displayName: true, email: true, createdAt: true, totalGamesPlayed: true } }),
    games: await prisma.game.findMany({ where: { OR: [{ player1Id: userId }, { player2Id: userId }] },
      select: { gameMode: true, createdAt: true, roundsPlayed: true } }),
    badges: await prisma.badge.findMany({ where: { userId }, select: { badgeId: true, earnedAt: true } }),
    settings: await prisma.userSettings.findUnique({ where: { userId } }),
    friends: await prisma.friendship.findMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { status: true, createdAt: true } }),
    dailyChallenges: await prisma.dailyChallengeEntry.findMany({ where: { userId } }),
    quests: await prisma.weeklyQuest.findMany({ where: { userId } }),
  };
  return { filename: `numbskull-export-${Date.now()}.json`, data };
}
```

**Rate limit:** 1 export per 24 hours per user. Response time: immediate (automated).

---

#### 6.21.5 🗑️ Account Deletion Flow — 12-Step Spec (Phase 4)

| Step | Action | Timing |
|------|--------|--------|
| 1 | User taps "Delete Account" in Settings | Immediate |
| 2 | Confirmation modal: *"This cannot be undone after 30 days."* | Immediate |
| 3 | Re-authentication required (password or OAuth) | Immediate |
| 4 | Soft-delete: `deleted_at = NOW()`, `is_active = false` | Immediate |
| 5 | JWT refresh token revoked (Redis) | Immediate |
| 6 | User logged out, redirected to home | Immediate |
| 7 | Display name anonymized to "Deleted User" in public views | Immediate |
| 8 | Leaderboard entries removed (Redis `ZREM`) | Immediate |
| 9 | Email: *"Your account will be permanently deleted on {date}"* | Immediate |
| 10 | 30-day grace period (user can contact support to restore) | 30 days |
| 11 | Hard delete: CASCADE delete all User-related rows | Day 30 cron |
| 12 | Cloudinary avatar deleted via API. Redis cache purged | Day 30 cron |

---

#### 6.21.6 🔞 Age Verification (Phase 4)

Registration form includes: **"☐ I confirm I am 13 years of age or older"** checkbox.

- Required to complete registration (server validates `ageConfirmed: true`)
- Not stored as a data field — just a consent gate
- If targeting under-13 in the future: full COPPA compliance required (parental consent mechanism)

---

## 7. Data Model (Prisma Schema Summary)

Based on BRD §7, the following models will be implemented:

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **User** | user_id (UUID), display_name, email, password_hash, auth_provider, avatar_url, is_verified, is_banned, **is_admin** (Boolean), profile_visibility, **total_games_played** (Integer), **mmr_rating** (Integer, default 1000) | → Games, Badges, Friends, DailyChallengeEntries, GameReplays, Reports |
| **Room** | room_id (UUID), room_code (unique), host_id, status, visibility, **game_mode** (enum: `guess_the_number` \| `bulls_and_cows`), config (JSONB), expires_at | → Host (User), Game |
| **Game** | game_id (UUID), room_id, **game_mode** (enum), player1_id, player2_id, winner_id, rounds_played, config_snapshot (JSONB), **optimal_path** (JSONB), **highlight_score** (Integer) | → Room, Rounds, Players (User) |
| **Round** | round_id (UUID), game_id, round_number, winner_id, p1/p2_attempts, p1/p2_secret (**String**), duration_sec, **p1/p2_forfeited** (Boolean) | → Game, Guesses |
| **Guess** | guess_id (UUID), round_id, player_id, guess_value (**String**), result (**JSONB**), **response_time_ms** (Integer), **is_bluff** (Boolean), created_at | → Round, Player (User) |
| **Badge** | badge_id (string), user_id, earned_at | → User |
| **DailyChallenge** | challenge_date (PK), **game_mode** (enum), seed, config (JSONB) | → Entries |
| **DailyChallengeEntry** | entry_id (UUID), challenge_date, user_id, attempts, duration_sec, **device_fingerprint** (String, for guest enforcement) | → Challenge, User |
| **Friendship** | id, requester_id, addressee_id, status (pending/accepted/blocked) | → Users |
| **UserSettings** | user_id (PK), settings (JSONB) | → User |
| **GameReplay** ★ | replay_id (UUID), user_id, game_mode, difficulty, guesses (JSONB: `[{guess, timestamp_ms}]`), duration_ms, is_best (Boolean) | → User |
| **FeaturedGame** ★ | id (UUID), date (Date), game_id, highlight_score (Integer), highlights (JSONB), created_at | → Game |
| **Report** ★★ | report_id (UUID), reporter_id, reported_id, reason (enum: `cheating` \| `stalling` \| `harassment` \| `other`), description (String), status (enum: `pending` \| `reviewed` \| `actioned` \| `dismissed`), created_at | → Reporter (User), Reported (User) |
| **SystemAnnouncement** ★★ | id (UUID), message (String), is_active (Boolean), created_by (admin user_id), starts_at, expires_at | → Creator (User) |
| **FeatureUnlock** ★★★ | id (UUID), user_id, feature_key (String: `gtn_medium`, `gtn_hard`, `bulls_cows`, `bc_hard`, `custom`), unlocked_at | → User |
| **WeeklyQuest** ★★★ | id (UUID), week_start (Date), quest_id (String), user_id, progress (Integer), target (Integer), completed (Boolean), completed_at | → User |

> [!NOTE]
> `p1/p2_secret` and `guess_value` are stored as **String** to accommodate both single numbers (GTN: `"42"`) and 4-digit codes (B&C: `"1234"`). The `result` field uses **JSONB** to hold mode-specific feedback structures. Models marked ★ are for unique features (Ghost Mode, Replay Theater). Models marked ★★ are for admin panel (Phase 6). Models marked ★★★ are for veteran squad additions (tutorial, progression, quests).

---

## 8. API & Socket Contracts

### REST Endpoints (from BRD §8)

All 17 REST endpoints from the BRD + **6 admin endpoints** + **2 matchmaking endpoints**:

| Method | Endpoint | Auth | Phase |
|--------|----------|------|-------|
| POST | `/api/auth/register` | No | 4 |
| POST | `/api/auth/login` | No | 4 |
| POST | `/api/auth/logout` | Yes | 4 |
| GET | `/api/auth/me` | Yes | 4 |
| POST | `/api/rooms` | No | 2 |
| GET | `/api/rooms/public` | No | 2 |
| GET | `/api/rooms/:code` | No | 2 |
| GET | `/api/leaderboard` | No | 3 |
| GET | `/api/leaderboard/friends` | Yes | 3 |
| GET | `/api/users/:id/profile` | No | 4 |
| GET | `/api/users/me/stats` | Yes | 4 |
| GET | `/api/users/me/history` | Yes | 4 |
| POST | `/api/friends/request` | Yes | 4 |
| PATCH | `/api/friends/:id/accept` | Yes | 4 |
| DELETE | `/api/friends/:id` | Yes | 4 |
| POST | `/api/friends/:id/report` | Yes | 4 |
| GET | `/api/daily-challenge/today` | No | 3 |
| POST | `/api/daily-challenge/submit` | No | 3 |
| GET / PATCH | `/api/users/me/settings` | Yes | 4 |
| DELETE | `/api/users/me` | Yes | 4 |
| POST | `/api/matchmaking/queue` | No | 2 |
| DELETE | `/api/matchmaking/queue` | No | 2 |
| GET | `/api/admin/dashboard` | Admin | 6 |
| GET | `/api/admin/reports` | Admin | 6 |
| PATCH | `/api/admin/reports/:id` | Admin | 6 |
| POST | `/api/admin/daily-challenge/seed` | Admin | 6 |
| POST | `/api/admin/announcements` | Admin | 6 |
| GET / PATCH | `/api/admin/feature-flags` | Admin | 6 |

### Socket Events (from BRD §9 + multiplayer UX additions)

**Client → Server** (14 events): `create_room`, `join_room`, `spectate_room`, `ready_up`, `submit_secret`, `submit_guess`, `request_hint`, `send_reaction`, `leave_room`, `reconnect_session`, `request_rematch`, `respond_rematch`, `request_pause`, `respond_pause`

**Server → Client** (22 events): `room_created`, `player_joined`, `player_left`, `game_started`, `game_countdown` (3-2-1), `secret_submission_confirmed`, `waiting_for_opponent`, `turn_changed`, `opponent_guessed`, `guess_result`, `hint_provided`, `round_winner`, `round_intermission`, `match_winner`, `player_disconnected`, `reconnect_countdown`, `player_reconnected`, `reaction_received`, `spectator_count_updated`, `game_config_updated`, `system_announcement`, `rematch_requested`, `rematch_response`, `pause_requested`, `pause_response`, `connection_quality`, `afk_warning`

---

## 9. Security Implementation (Enhanced ★)

| Requirement | Implementation | Detailed Spec |
|-------------|---------------|--------------|
| Server-authoritative logic | All game evaluation in engine; client only renders | §6.1 |
| Secret number protection | Stored server-side; `getStateForPlayer()` filters before broadcast | §6.1 |
| **Socket.io authentication** ★ | JWT middleware on connection + guest UUID validation | §6.4.3 |
| **JWT refresh token revocation** ★ | Server-side hash in Redis, token rotation, logout invalidation | §6.4.2 |
| **Token storage** ★ | Access token: in-memory only. Refresh token: `httpOnly` `SameSite=Strict` cookie | §6.4.2 |
| WSS | Socket.io over HTTPS in production | — |
| **REST rate limiting** | `express-rate-limit`: 100 req/15min (auth), 200 req/15min (general) | — |
| **Socket rate limiting** ★ | Per-event throttle table (9 events + global 100/min cap) | §6.12.2 |
| JWT auth | Access token (15 min) + refresh token (30 days), httpOnly cookies | §6.4.1 |
| Password security | bcrypt (12 rounds), min 8 chars, 1 uppercase + 1 number | — |
| Input validation | Zod schemas on all API endpoints AND socket events | — |
| **CORS** ★ | Explicit origin whitelist, credentials: true, 24h preflight cache | §6.12.5 |
| CSRF | SameSite cookies + CSRF token on state-mutating endpoints | — |
| Account lockout | 10 failed attempts → 15-minute lockout | — |
| Anti-cheat (leaderboard) | Min 10 games to appear; flagged accounts hidden | — |
| Multi-tab prevention | Server disconnects older socket on duplicate session | §6.4.3 |
| Admin routes | `is_admin` flag checked via middleware; separate route group | — |
| **Standardized errors** ★ | Every error uses `{ success, error: { code, message, status } }` format | §6.12.3 |
| **Structured logging** ★ | `pino` JSON logger with PII redaction (`password`, `token`, `email`) | §6.12.9 |
| **Env validation** ★ | Zod schema validates all env vars on startup — crash on missing | §6.12.6 |

---

## 10. Verification Plan

### Automated Tests

#### Unit Tests (Vitest) — Target: ≥ 80% coverage
```bash
cd server && npx vitest run --coverage
```
- **GTN engine**: guess evaluation, range tracking, proximity feedback, efficiency score
- **B&C engine**: bulls/cows calculation, duplicate guess detection, win detection
- Room code generator: uniqueness, no ambiguous chars
- AI strategies: GTN (binary search, random, adaptive) + B&C (Knuth's minimax, random, elimination)
- Scoring: efficiency calculation, winner determination
- Timer: countdown, forfeit
- Personality Evolution: roast tier selection based on play count
- Optimal path calculator: binary search path (GTN), Knuth-optimal path (B&C)
- Musical feedback: pitch mapping function

#### Integration Tests (Vitest + Supertest)
```bash
cd server && npx vitest run tests/integration
```
- Socket event flows: create → join → start → guess → result → winner
- REST API: auth flows, CRUD operations, input validation
- Reconnection: disconnect → reconnect → state sync

#### E2E Tests (Playwright)
```bash
npx playwright test
```
- Full multiplayer game — **GTN mode** (two browser sessions)
- Full multiplayer game — **B&C mode** (two browser sessions)
- Single player vs AI (both modes)
- Daily challenge flow (both modes)
- Auth flow (register → login → profile)
- Reconnect scenario (network throttle)
- Ghost Mode replay accuracy
- Bluff Round detection
- Roast Report optimal path display

### Performance Testing
- Lighthouse audit: Performance ≥ 85, Accessibility ≥ 90
- Load test: 500 concurrent rooms simulation

### Manual Verification
- Cross-browser testing on Chrome, Firefox, Safari, Edge
- Mobile testing on iOS Safari + Android Chrome
- PWA install verification on both platforms
- Screen reader testing (VoiceOver / NVDA)

---

## 11. Estimated Effort

| Phase | Description | Est. Effort |
|-------|-------------|-------------|
| Phase 1 | Core MVP + FTUE + FSM + Difficulty + Dramatic Moments + Personality + Musical (ADSR/hybrid) + Pressure + Haptic + **AudioManager** + **a11y foundations** (ARIA, focus, skip link) + **touch targets** + **safe areas** + **DB indexes** + **font self-hosting** + **CSP headers** | 8–10 days |
| Phase 2 | Multiplayer + Quick Match + Watch Live + Race Conditions + Memory + Chat Moderation + Countdown + Rematch + Anti-Stalling + Connection + Pause + **Socket validation middleware** + **room code hardening** + **stereo audio** | 7–8 days |
| Phase 3 | Engagement + Viral Optimization + Weekly Quests + Roast Report + Ghost Mode + Bluff Round | 4–5 days |
| Phase 4 | Social & Profiles + Conversion Nudges + Name Validation + Replay Theater + Report User + **Privacy Policy page** + **Terms of Service page** + **GDPR data export** + **Account deletion flow** + **Age verification** | 4–5 days |
| Phase 5 | PWA + **Analytics event taxonomy** (15 events) + **Cookie consent** + **Funnel tracking** + Data Privacy/GDPR + **Offline UX** + **PWA install flow** + **Data retention crons** + **Service worker caching** | 3–4 days |
| Phase 6 | Polish + Loading Skeletons + Zero-Downtime Migration + Admin Panel + Keyboard Shortcuts + Graceful Degradation + **Color-blind mode** + **Contrast fixes** + **Core Web Vitals audit** + **Bundle size verification** + **Full a11y audit** | 4–5 days |
| Phase 7 | **3 New Game Modes** (Countdown 4d + Number Chain 3d + Number Towers 2.5d) + Seasonal Events + Reverse Challenge | 12–14 days |
| **Total** | | **42–51 days** |

> [!NOTE]
> Phases 1–6 are delivered sequentially (30–37 days). Phase 7 is post-launch (12–14 days). Specialist review items (§6.15–§6.21) are embedded into the phases where they're implemented — no separate "review phase" needed.

---

## 12. Dependencies & Prerequisites

Before starting implementation:

1. **Node.js 22+** and **npm** installed
2. **Docker Desktop** (for local PostgreSQL + Redis via docker-compose)
3. **Vercel account** (frontend deployment — free tier)
4. **Railway account** (backend + DB deployment — free tier)
5. **Cloudinary account** (avatar storage — free tier: 25K transforms/month)
6. **Resend account** (email — free tier: 3K emails/month, can be deferred to Phase 4)
7. **Plausible account** (analytics — can be deferred to Phase 5)
8. **Google Cloud OAuth credentials** (Phase 4, stubbed until then)

---

*Awaiting your review and approval before proceeding with any code changes.*
