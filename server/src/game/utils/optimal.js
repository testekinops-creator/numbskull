export function computeOptimalMoves(range) {
  return Math.ceil(Math.log2(range + 1))
}
