import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setMessage('')

    const [
      { data: pvData, error: pvError },
      { data: revenuesData, error: revError },
      { data: invoicesData, error: invError },
      { data: staffData, error: staffError },
    ] = await Promise.all([
      supabase.from('points_of_sale').select('*').order('name'),
      supabase.from('revenues').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('staff_costs').select('*'),
    ])

    const err =
      pvError?.message ||
      revError?.message ||
      invError?.message ||
      staffError?.message

    if (err) {
      setMessage(err)
      return
    }

    const result = (pvData || []).map((pv) => {
      const ricavi = (revenuesData || [])
        .filter((r) => r.point_of_sale_id === pv.id)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)

      const costiFatture = (invoicesData || [])
        .filter((i) => i.point_of_sale_id === pv.id)
        .reduce((sum, i) => sum + Number(i.amount || 0), 0)

      const costoPersonale = (staffData || [])
        .filter((s) => s.point_of_sale_id === pv.id)
        .reduce((sum, s) => sum + Number(s.amount || 0), 0)

      const ore = (staffData || [])
        .filter((s) => s.point_of_sale_id === pv.id)
        .reduce((sum, s) => sum + Number(s.worked_hours || 0), 0)

      const margine = ricavi - costiFatture - costoPersonale
      const produttivitaOraria = ore > 0 ? ricavi / ore : 0
      const costoPersonalePerc = ricavi > 0 ? (costoPersonale / ricavi) * 100 : 0

      return {
        id: pv.id,
        nome: pv.name,
        ricavi,
        costiFatture,
        costoPersonale,
        margine,
        ore,
        produttivitaOraria,
        costoPersonalePerc,
      }
    })

    setRows(result)
  }

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
        <p>Devi accedere</p>
        <Link href="/">Torna alla home</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <Link href="/">Home</Link>
      </div>

      {message && <p style={{ color: 'red', marginTop: 16 }}>{message}</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 24 }}>
        <thead>
          <tr>
            <th style={th}>PV</th>
            <th style={th}>Ricavi</th>
            <th style={th}>Costi fatture</th>
            <th style={th}>Costo personale</th>
            <th style={th}>Margine €</th>
            <th style={th}>Ore</th>
            <th style={th}>Produttività €/h</th>
            <th style={th}>Costo pers. % ricavi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.nome}</td>
              <td style={td}>{formatEuro(row.ricavi)}</td>
              <td style={td}>{formatEuro(row.costiFatture)}</td>
              <td style={td}>{formatEuro(row.costoPersonale)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{formatEuro(row.margine)}</td>
              <td style={td}>{formatNumber(row.ore)}</td>
              <td style={td}>{formatEuro(row.produttivitaOraria)}</td>
              <td style={td}>{formatPercent(row.costoPersonalePerc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatEuro(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0))
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2)
}

const th = {
  border: '1px solid #ccc',
  padding: 8,
  textAlign: 'left',
  background: '#f5f5f5',
  fontSize: 14,
}

const td = {
  border: '1px solid #ccc',
  padding: 8,
  fontSize: 14,
}
