/** Normalizes an offset-aware instant without discarding sub-millisecond digits. */
export function instantParts(value: string): { seconds: number; fraction: string } {
  const fraction = /\.(\d+)/.exec(value)?.[1].replace(/0+$/, '') ?? ''
  return { seconds: Math.floor(Date.parse(value) / 1000), fraction }
}
export function instantKey(value: string): string {
  const instant = instantParts(value)
  return `${instant.seconds}:${instant.fraction}`
}
export function compareInstants(left: string, right: string): number {
  const a = instantParts(left), b = instantParts(right)
  if (a.seconds !== b.seconds) return a.seconds - b.seconds
  const width = Math.max(a.fraction.length, b.fraction.length)
  const first = a.fraction.padEnd(width, '0'), second = b.fraction.padEnd(width, '0')
  return first === second ? 0 : first < second ? -1 : 1
}
