export const mockScenarios = [
  'main',
  'empty-channel',
  'no-channels',
  'thread-open',
  'file-upload',
  'permission-denied',
  'reconnecting',
  'create-channel',
  'admin'
] as const

export type MockScenario = (typeof mockScenarios)[number]

export const isMockScenario = (value: unknown): value is MockScenario => {
  return typeof value === 'string' && (mockScenarios as readonly string[]).includes(value)
}
