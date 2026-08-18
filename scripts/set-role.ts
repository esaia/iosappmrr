import './load-env'
import { eq, sql } from 'drizzle-orm'
import { db } from '../src/db'
import { adminActions, profiles } from '../src/db/schema'

/**
 * Grants or removes the admin role from the command line.
 *
 * The first admin has to be made this way — the admin screens are the only
 * place a role can be changed, and reaching them requires already being an
 * admin. After that this is the escape hatch for the two cases the UI refuses:
 * changing your own role, and demoting the last admin.
 *
 *   npm run role -- esaia admin
 *   npm run role -- someone founder
 *
 * Takes a handle, not an email: `profiles` mirrors `auth.users` but does not
 * copy the address, and the handle is what the site shows everywhere.
 */
async function main() {
  const [handleArg, roleArg] = process.argv.slice(2)

  if (!handleArg || (roleArg !== 'admin' && roleArg !== 'founder')) {
    console.error('\nUsage: npm run role -- <handle> <admin|founder>\n')
    const all = await db
      .select({ handle: profiles.handle, role: profiles.role })
      .from(profiles)
      .orderBy(profiles.handle)
    if (all.length) {
      console.error('Known handles:')
      for (const p of all) console.error(`  ${p.handle.padEnd(24)} ${p.role}`)
      console.error()
    }
    process.exit(1)
  }

  const handle = handleArg.replace(/^@/, '').toLowerCase()

  const [target] = await db
    .select({ id: profiles.id, handle: profiles.handle, role: profiles.role })
    .from(profiles)
    .where(eq(sql`lower(${profiles.handle})`, handle))
    .limit(1)

  if (!target) {
    console.error(`\nNo profile with the handle "${handle}".\n`)
    process.exit(1)
  }

  if (target.role === roleArg) {
    console.log(`\n@${target.handle} is already ${roleArg}. Nothing to do.\n`)
    return
  }

  await db
    .update(profiles)
    .set({ role: roleArg, updatedAt: new Date() })
    .where(eq(profiles.id, target.id))

  /*
   * Logged in the same table the admin screens write to. A role granted from a
   * shell is exactly the kind of change the log exists for — without this entry
   * the first admin would appear from nowhere.
   */
  await db.insert(adminActions).values({
    actorId: null,
    actorHandle: 'cli',
    action: 'set_role',
    summary: `Made @${target.handle} ${roleArg === 'admin' ? 'an admin' : 'a founder'} from the CLI`,
    targetType: 'profile',
    targetId: target.id,
    detail: { from: target.role, to: roleArg, via: 'scripts/set-role.ts' },
  })

  console.log(`\n@${target.handle}: ${target.role} → ${roleArg}\n`)
  if (roleArg === 'admin') console.log('Sign out and back in, then open /admin.\n')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
