'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Viewer = { handle: string; role: string }

/**
 * Who is reading, asked from the browser rather than the server.
 *
 * Reading the session on the server made every public page render per request,
 * so every visit and every crawler ran a function. Asked here, the pages stay
 * static and cached, and only the header's corner and the longer chart ranges
 * wait the moment it takes to answer.
 *
 * `undefined` while it is being asked, `null` when nobody is signed in.
 */
export function useViewer(): Viewer | null | undefined {
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()
    let live = true

    const read = async (userId: string | undefined) => {
      if (!userId) {
        if (live) setViewer(null)
        return
      }
      const { data } = await supabase.from('profiles').select('handle, role').eq('id', userId).maybeSingle()
      if (live) setViewer(data ? { handle: data.handle, role: data.role } : null)
    }

    void supabase.auth.getSession().then(({ data }) => read(data.session?.user.id))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void read(session?.user.id)
    })

    return () => {
      live = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return viewer
}
