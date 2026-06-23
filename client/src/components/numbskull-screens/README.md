# Numbskull — Feature Screens (React)

Drop-in React components for the 6 review-feature screens, in the Numbskull house style.
Self-contained inline styles + one small CSS file of keyframes. No design-token dependency.

## Install
Copy the whole `numbskull-screens/` folder into `client/src/components/`.

Files:
- `Skull.jsx` — the mascot (`expression`, `size`, `glow`)
- `GameIcon.jsx` — premium per-game icon (`icon`, `size`, `accent`) — 22 marks incl. all 12 games
- `NumbskullScreens.jsx` — the 6 screens
- `numbskull.css` — keyframes (imported automatically)
- `index.js` — barrel re-exports

Fonts (Outfit + Chakra Petch) are already loaded by your `index.html`, so nothing to add.

## Use
```jsx
import {
  MatchHistoryScreen, LevelUpScreen, StreakScreen,
  SkullCustomizerScreen, DifficultyScreen, MultiplayerTutorialScreen,
} from '../components/numbskull-screens'

// e.g. as routes
<Route path="/history"    element={<MatchHistoryScreen onBack={() => navigate(-1)} />} />
<Route path="/levelup"    element={<LevelUpScreen level={12} rank="Cipher" xp={320} xpMax={500} onPrimary={...} />} />
<Route path="/streak"     element={<StreakScreen streak={14} onPrimary={...} />} />
<Route path="/skull"      element={<SkullCustomizerScreen onBack={...} onPrimary={...} />} />
<Route path="/difficulty" element={<DifficultyScreen game="Guess The Number" onSelect={mode => ...} />} />
```

## Wiring the game icons into your existing HomeListPage
```jsx
import GameIcon from '../components/numbskull-screens/GameIcon.jsx'

const ICON_KEY = {
  GTN:'gtn', BC:'bc', XOX:'xox', MATH:'math', SUDOKU:'sudoku', QUEENS:'queens',
  TANGO:'tango', ZIP:'zip', PINPOINT:'pinpoint', CROSSCLIMB:'crossclimb',
  SPIN:'spin', SOS:'sos', RMCS:'queens', RUMMY:'chip',
}

// replace:  <span className={styles.gameIcon}>{g.icon}</span>
// with:     <span className={styles.gameIcon}><GameIcon icon={ICON_KEY[g.mode]} size={44} /></span>
```

## Props summary
| Screen | Props |
|---|---|
| MatchHistoryScreen | `onBack`, `roastsVisible=true`, `games=[…]` |
| LevelUpScreen | `level`, `rank`, `xp`, `xpMax`, `onPrimary` |
| StreakScreen | `onBack`, `streak`, `roastsVisible=true`, `onPrimary` |
| SkullCustomizerScreen | `onBack`, `onPrimary` |
| DifficultyScreen | `onBack`, `game`, `onSelect(name)`, `onPrimary` |
| MultiplayerTutorialScreen | `step`, `total`, `onSkip`, `onNext` |

All data is sensible defaults — pass real data in to make them live.
