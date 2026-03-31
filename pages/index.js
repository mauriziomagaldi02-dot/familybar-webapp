import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function getServerSideProps() {
  const { data: points_of_sale, error } = await supabase
    .from('points_of_sale')
    .select('*')
    .order('name')

  return {
    props: {
      points_of_sale: points_of_sale || [],
      error: error ? error.message : null
    }
  }
}

export default function Home({ points_of_sale, error }) {
  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <h1>Web App Familybar</h1>
      <p>Prima connessione al database riuscita.</p>

      {error && (
        <div style={{ color: 'red', marginTop: 20 }}>
          Errore database: {error}
        </div>
      )}

      <h2 style={{ marginTop: 30 }}>Punti vendita</h2>

      {points_of_sale.length === 0 ? (
        <p>Nessun punto vendita presente.</p>
      ) : (
        <ul>
          {points_of_sale.map((pv) => (
            <li key={pv.id}>{pv.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
