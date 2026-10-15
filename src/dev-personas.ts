import type { DevPersona } from './modules/operator-auth/dev/index.mjs'

// Local dev personas: real operators at <as>@dev.localhost, created only by
// local dev sign-in and suspended in exports. Only src/server.dev.ts uses them.
export function devPersonas(): DevPersona[] {
 return [
  { as: 'reviewer', role: 'member', displayName: 'Riley Reviewer' },
  { as: 'preparer', role: 'member', displayName: 'Pat Preparer' },
 ]
}
