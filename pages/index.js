import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Home() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Web App Familybar</h1>
      <p>Se vedi questa pagina, sei online.</p>
    </div>
  )
}
