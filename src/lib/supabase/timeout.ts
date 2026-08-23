/**
 * Every Supabase call from the server goes through this.
 *
 * Supabase Auth can stop responding while the database stays perfectly healthy
 * — the two are separate services. Without a bound, one hung auth request holds
 * a render open until the platform kills it, so a header that wants to know who
 * is reading takes the whole page down with it. Failing fast turns that outage
 * into a signed-out header instead of a timeout.
 */
export const SUPABASE_TIMEOUT_MS = 3000

export const timeoutFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS) })
