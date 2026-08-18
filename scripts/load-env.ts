import { config } from 'dotenv'

/**
 * Loads the same environment the app sees, as a side effect of being imported.
 *
 * It has to be its own module: `import` declarations are evaluated before any
 * statement in the importing file, so calling `config()` inline runs *after*
 * modules like `src/db` have already read `process.env` and thrown. Importing
 * this first gives those modules a populated environment.
 *
 * `dotenv/config` alone is not enough either — it reads `.env`, while Next and
 * the README use `.env.local`.
 */
config({ path: '.env' })
config({ path: '.env.local', override: true })
