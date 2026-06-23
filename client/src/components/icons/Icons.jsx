// Lightweight inline-SVG icon set (Feather-style, MIT-derived paths). Stroke
// uses currentColor so callers control color via CSS. No dependency.

function svgProps(size = 22, extra = {}) {
  return {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false', ...extra,
  }
}

export function PhoneIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export function PhoneOffIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  )
}

export function MicIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export function MicOffIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export function SpeakerIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

export function SpeakerOffIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

export function UserPlusIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}

export function UserCheckIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  )
}

export function ClockIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function HomeIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9.5" />
    </svg>
  )
}

export function MenuIcon({ size, ...p }) {
  return (
    <svg {...svgProps(size, p)}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

/* ── UI-chrome glyphs (replace decorative emojis; stroke = currentColor) ───── */

export function BoltIcon({ size, ...p }) {  // ⚡ quick / multiplayer
  return (<svg {...svgProps(size, { fill: 'currentColor', stroke: 'none', ...p })}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></svg>)
}

export function BotIcon({ size, ...p }) {  // 🤖 vs AI
  return (
    <svg {...svgProps(size, p)}>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <line x1="12" y1="4" x2="12" y2="8" /><circle cx="12" cy="3.2" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1.3" fill="currentColor" stroke="none" />
      <line x1="1.5" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22.5" y2="12" />
    </svg>
  )
}

export function KeyIcon({ size, ...p }) {  // 🔑 join room
  return (<svg {...svgProps(size, p)}><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3 21 2m-4 4 3 3m-6 0 3 3" /></svg>)
}

export function EyeIcon({ size, ...p }) {  // 👁 watch live
  return (<svg {...svgProps(size, p)}><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>)
}

export function MonitorIcon({ size, ...p }) {  // 📺 watch / spectate
  return (<svg {...svgProps(size, p)}><rect x="2.5" y="4" width="19" height="13" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>)
}

export function SkullIcon({ size, ...p }) {  // 💀 account / numbskull
  return (
    <svg {...svgProps(size, p)}>
      <path d="M12 2.5c-4.4 0-7.5 3-7.5 7 0 2.5 1.2 4.3 3 5.3V18a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 16.5 18v-3.2c1.8-1 3-2.8 3-5.3 0-4-3.1-7-7.5-7z" />
      <circle cx="9" cy="11" r="1.6" fill="currentColor" stroke="none" /><circle cx="15" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <line x1="10" y1="19.5" x2="10" y2="17.5" /><line x1="14" y1="19.5" x2="14" y2="17.5" />
    </svg>
  )
}

export function CoinIcon({ size, ...p }) {  // 🪙 coins
  return (<svg {...svgProps(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.2 9.2h4a1.8 1.8 0 0 1 0 3.6h-2.4a1.8 1.8 0 0 0 0 3.6h4" transform="scale(0.86) translate(2 1.6)" /></svg>)
}

export function TrophyIcon({ size, ...p }) {  // 🏆 leaderboard / win
  return (
    <svg {...svgProps(size, p)}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
      <line x1="12" y1="14" x2="12" y2="18" /><path d="M8.5 21h7M9.5 21l.7-3h3.6l.7 3" />
    </svg>
  )
}

export function MedalIcon({ size, ...p }) {  // 🥇 rank / placement
  return (<svg {...svgProps(size, p)}><circle cx="12" cy="14.5" r="6" /><path d="M8.5 9 5.5 3M15.5 9l3-6" /><circle cx="12" cy="14.5" r="2.3" fill="currentColor" stroke="none" /></svg>)
}

export function ChatIcon({ size, ...p }) {  // 💬 chat
  return (<svg {...svgProps(size, p)}><path d="M21 11.5a8.5 8 0 0 1-12 7.3L3 20.5l1.7-5.4A8 8 0 1 1 21 11.5z" /></svg>)
}

export function BulbIcon({ size, ...p }) {  // 💡 hint
  return (<svg {...svgProps(size, p)}><path d="M9 18h6M10 21h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" /></svg>)
}

export function ExitIcon({ size, ...p }) {  // 🚪 leave
  return (<svg {...svgProps(size, p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>)
}

export function FlameIcon({ size, ...p }) {  // 🔥 streak
  return (<svg {...svgProps(size, { fill: 'currentColor', stroke: 'none', ...p })}><path d="M12.5 2c.5 3 4.5 4.8 4.5 9.5a5 5 0 0 1-10 0c0-2.2 1-3.4 1.8-4.3.2 1.2.9 1.9 1.8 2.1C11 8 10 5 12.5 2z" /></svg>)
}

export function ShieldIcon({ size, ...p }) {  // 🛡 freeze / protect
  return (<svg {...svgProps(size, p)}><path d="M12 2.6 19 5v5.6c0 4.4-2.9 7.6-7 9-4.1-1.4-7-4.6-7-9V5z" /><path d="M9 12l2 2 4-4.5" /></svg>)
}

export function StarIcon({ size, ...p }) {  // ⭐ star / featured
  return (<svg {...svgProps(size, { fill: 'currentColor', stroke: 'none', ...p })}><path d="M12 2.6l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.6 6.09 20.76l1.13-6.57L2.45 9.54l6.6-.96z" /></svg>)
}

export function RefreshIcon({ size, ...p }) {  // 🔄 rematch / play again
  return (<svg {...svgProps(size, p)}><polyline points="21 4 21 9 16 9" /><polyline points="3 20 3 15 8 15" /><path d="M19.5 9A8 8 0 0 0 5.6 6.6L3 9m18 6-2.6 2.4A8 8 0 0 1 4.5 15" /></svg>)
}

export function AlertIcon({ size, ...p }) {  // ⚠ warning
  return (<svg {...svgProps(size, p)}><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13.5" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></svg>)
}

export function CloseIcon({ size, ...p }) {  // ❌ / ✕ close
  return (<svg {...svgProps(size, p)}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>)
}

export function CheckIcon({ size, ...p }) {  // ✅ done
  return (<svg {...svgProps(size, p)}><polyline points="4 12.5 9.5 18 20 6" /></svg>)
}

export function SparkleIcon({ size, ...p }) {  // ✨ / 🎉 celebrate
  return (<svg {...svgProps(size, { fill: 'currentColor', stroke: 'none', ...p })}><path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z" /><path d="M19 3l.7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7z" /></svg>)
}

export function LockIcon({ size, ...p }) {  // 🔒 locked
  return (<svg {...svgProps(size, p)}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>)
}

export function UserIcon({ size, ...p }) {  // 👤 profile
  return (<svg {...svgProps(size, p)}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" /></svg>)
}

export function UsersIcon({ size, ...p }) {  // 👥 friends / players
  return (<svg {...svgProps(size, p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.4 3-6 6.5-6s6.5 2.6 6.5 6" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 20c0-2.6-1-4.8-2.7-6" /></svg>)
}

export function GamepadIcon({ size, ...p }) {  // 🎮 play / games
  return (<svg {...svgProps(size, p)}><path d="M7 7h10a5 5 0 0 1 5 5l-.6 4.3A2.6 2.6 0 0 1 17 18l-1.6-2.2H8.6L7 18a2.6 2.6 0 0 1-4.4-1.7L2 12a5 5 0 0 1 5-5z" /><line x1="7" y1="11" x2="7" y2="13" /><line x1="6" y1="12" x2="8" y2="12" /><circle cx="16" cy="11" r="0.8" fill="currentColor" /><circle cx="18" cy="13" r="0.8" fill="currentColor" /></svg>)
}

export function SwordsIcon({ size, ...p }) {  // ⚔ vs / battle
  return (<svg {...svgProps(size, p)}><path d="M14.5 4H20v5.5L9 20.5 4 15.5 14.5 4z" /><path d="M4 4h5.5l4 4M14 15l1.5 1.5M16 20l4-4-1.5-1.5" /></svg>)
}

export function BellIcon({ size, ...p }) {  // 🔔 notifications
  return (<svg {...svgProps(size, p)}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></svg>)
}

export function ChartIcon({ size, ...p }) {  // 📊 stats
  return (<svg {...svgProps(size, p)}><line x1="3" y1="21" x2="21" y2="21" /><rect x="5" y="11" width="3.5" height="7" /><rect x="10.25" y="6" width="3.5" height="12" /><rect x="15.5" y="14" width="3.5" height="4" /></svg>)
}

export function TargetIcon({ size, ...p }) {  // 🎯 goal
  return (<svg {...svgProps(size, p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>)
}

export function PlusIcon({ size, ...p }) {  // ➕ add / create
  return (<svg {...svgProps(size, p)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>)
}

export function HandshakeIcon({ size, ...p }) {  // 🤝 draw / tie
  return (<svg {...svgProps(size, p)}><path d="M2 12l4-4 4 1 2.5-1.5L15 8m7 4-4-4-3 1" /><path d="M6 8l-4 4 3 3 2-1 2 2 2-1 2 2 4-4" /></svg>)
}

export function GiftIcon({ size, ...p }) {  // 🎁 reward
  return (<svg {...svgProps(size, p)}><rect x="3.5" y="9" width="17" height="11" rx="1.5" /><line x1="12" y1="9" x2="12" y2="20" /><path d="M3.5 13h17M12 9c-1.5-4-6-3.5-6-1 0 1.5 3 1 6 1zm0 0c1.5-4 6-3.5 6-1 0 1.5-3 1-6 1z" /></svg>)
}

export function GemIcon({ size, ...p }) {  // 💎 points / worth
  return (<svg {...svgProps(size, p)}><path d="M6 3h12l3 5-9 13L3 8z" /><path d="M3 8h18M9 3 7 8l5 13M15 3l2 5-5 13" /></svg>)
}

export function SproutIcon({ size, ...p }) {  // 🌱 easy
  return (<svg {...svgProps(size, p)}><path d="M12 21v-8" /><path d="M12 14c0-3-2.4-5-5.5-5C6.5 12 8.9 14 12 14z" /><path d="M12 12c0-3 2.4-5 5.5-5C17.5 10 15.1 12 12 12z" /></svg>)
}

export function HeartIcon({ size, filled = true, ...p }) {  // ❤️/🤍 lives
  return (<svg {...svgProps(size, { fill: filled ? 'currentColor' : 'none', ...p })}><path d="M12 20.5 4.3 13a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2A4.6 4.6 0 0 1 19.7 13z" /></svg>)
}

export function InfinityIcon({ size, ...p }) {  // ♾️ endless
  return (<svg {...svgProps(size, p)}><path d="M7 8a4 4 0 1 0 0 8c2.4 0 3.6-2 5-4s2.6-4 5-4a4 4 0 1 1 0 8c-2.4 0-3.6-2-5-4S9.4 8 7 8z" /></svg>)
}

export function FilmIcon({ size, ...p }) {  // 🎬 replay theater
  return (<svg {...svgProps(size, p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 14h4M17 9h4M17 14h4" /></svg>)
}

export function ShareIcon({ size, ...p }) {  // 📤 share
  return (<svg {...svgProps(size, p)}><path d="M12 15V3m0 0L8 7m4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>)
}

export function ToolIcon({ size, ...p }) {  // 🔧 maintenance
  return (<svg {...svgProps(size, p)}><path d="M14.5 4.5a4 4 0 0 0-5 5l-6 6 2.5 2.5 6-6a4 4 0 0 0 5-5l-2.6 2.6-2-.5-.5-2z" /></svg>)
}

export function MailIcon({ size, ...p }) {  // ✉️ contact
  return (<svg {...svgProps(size, p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5 12 13l8.5-6.5" /></svg>)
}

export function InfoIcon({ size, ...p }) {  // ℹ️ about
  return (<svg {...svgProps(size, p)}><circle cx="12" cy="12" r="9.5" /><line x1="12" y1="11" x2="12" y2="16.5" /><circle cx="12" cy="7.5" r="0.7" fill="currentColor" /></svg>)
}

export function AccessibilityIcon({ size, ...p }) {  // ♿ accessibility
  return (<svg {...svgProps(size, p)}><circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" /><path d="M5 8h14M12 7v6M8.5 21l3.5-8 3.5 8" /></svg>)
}

export function BagIcon({ size, ...p }) {  // 🛍️ shop
  return (<svg {...svgProps(size, p)}><path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>)
}

export function DotIcon({ size = 10, color = 'currentColor', ...p }) {  // 🟢/🔴 status dot
  return (<svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" focusable="false" {...p}><circle cx="5" cy="5" r="5" fill={color} /></svg>)
}

export function FlagIcon({ size, ...p }) {  // 🏳 give up / forfeit
  return (<svg {...svgProps(size, p)}><line x1="5" y1="22" x2="5" y2="3" /><path d="M5 3.5h11l-2 4 2 4H5z" /></svg>)
}

export function CopyIcon({ size, ...p }) {  // ⎘ copy code
  return (<svg {...svgProps(size, p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>)
}

export function CrownIcon({ size, ...p }) {  // 👑 host
  return (<svg {...svgProps(size, p)}><path d="M3 7l4 4 5-7 5 7 4-4-1.5 12h-15z" /><line x1="4.5" y1="20" x2="19.5" y2="20" /></svg>)
}

export function EditIcon({ size, ...p }) {  // ✏️ draw / edit
  return (<svg {...svgProps(size, p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>)
}

export function WifiOffIcon({ size, ...p }) {  // 📡 offline / reconnecting
  return (<svg {...svgProps(size, p)}><line x1="2" y1="2" x2="22" y2="22" /><path d="M5 12.5a10 10 0 0 1 4-2.4M2 8.8A16 16 0 0 1 7 6M22 8.8a16 16 0 0 0-7.5-2.7M19 12.5a10 10 0 0 0-2.5-1.7" /><path d="M8.5 16a5 5 0 0 1 5.3-.8" /><circle cx="12" cy="19.5" r="0.7" fill="currentColor" /></svg>)
}
