import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function useAuthUser() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUser(data.user || null)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user || null)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    await supabase.auth.signOut()
  }

  return { user, authLoading, logout }
}
