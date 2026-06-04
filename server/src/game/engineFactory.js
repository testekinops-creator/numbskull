import { GuessTheNumberEngine }  from './engines/GuessTheNumberEngine.js'
import { BullsCowsEngine }        from './engines/BullsCowsEngine.js'
import { CountdownEngine }        from './engines/CountdownEngine.js'
import { NumberChainEngine }      from './engines/NumberChainEngine.js'
import { NumberTowersEngine }     from './engines/NumberTowersEngine.js'
import { ReverseChallenge }       from './engines/ReverseChallenge.js'
import { TicTacToeEngine }        from './engines/TicTacToeEngine.js'
import { MathBattleEngine }       from './engines/MathBattleEngine.js'

export const VALID_MODES = ['GTN', 'BC', 'COUNTDOWN', 'NUMBER_CHAIN', 'NUMBER_TOWERS', 'REVERSE', 'XOX', 'MATH']

export function engineFactory(mode, options = {}) {
  switch (mode) {
    case 'GTN':           return new GuessTheNumberEngine(options)
    case 'BC':            return new BullsCowsEngine(options)
    case 'COUNTDOWN':     return new CountdownEngine(options)
    case 'NUMBER_CHAIN':  return new NumberChainEngine(options)
    case 'NUMBER_TOWERS': return new NumberTowersEngine(options)
    case 'REVERSE':       return new ReverseChallenge(options)
    case 'XOX':           return new TicTacToeEngine(options)
    case 'MATH':          return new MathBattleEngine(options)
    default:              throw new Error(`Unknown game mode: ${mode}`)
  }
}
