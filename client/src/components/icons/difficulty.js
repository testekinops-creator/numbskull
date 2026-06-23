import { SproutIcon, FlameIcon, SkullIcon } from './Icons.jsx'

// One difficulty visual language across every picker (solo pages + AI DifficultyPicker):
// easy = sprout (green), medium = flame (amber), hard = skull (pink).
export const DIFFICULTY = {
  easy:   { Icon: SproutIcon, color: '#00E676' },
  medium: { Icon: FlameIcon,  color: '#FFD740' },
  hard:   { Icon: SkullIcon,  color: '#FF3E8A' },
}
