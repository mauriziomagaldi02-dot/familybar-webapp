import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedPv, setSelectedPv] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null))
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user, selectedMonth, selectedPv])

  async function loadData() {
    const [
      { data: pvData },
      { data: revenues },
      { data: invoices },
      { data: staff },
      { data: manualCosts },
    ] = await Promise.all([
      supabase.from('points_of_sale').select('*'),
      supabase.from('revenues').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('staff_costs').select('*'),
      supabase.from('manual_costs').select('*'),
    ])

    setPointsOfSale(pvData || [])

    const filteredPv = (pvData || []).filter(p =>
      selectedPv ? p.id === selectedPv : true
    )

    const result = filteredPv.map(pv => {
      const ricavi = sum(
        revenues.filter(r =>
          r.point_of_sale_id === pv.id &&
          isSameMonth(r.date, selectedMonth)
        )
      )

      const costi = sum(
        invoices.filter(i =>
          i.point_of_sale_id === pv.id &&
          isSameMonth(i.invoice_date, selectedMonth)
        )
      )

      const personale = sum(
        staff.filter(s =>
          s.point_of_sale_id === pv.id &&
          s.period_month === selectedMonth
        )
      )

      const ore = staff
        .filter(s =>
          s.point_of_sale_id === pv.id &&
          s.period_month === selectedMonth
        )
        .reduce((a, b) => a + Number(b.worked_hours || 0), 0)

      const margine = ricavi - costi - personale
      const produttivita = ore > 0 ? ricavi / ore : 0

      return {
        nome: pv.name,
        ricavi,
        costi,
        personale,
        margine,
        produttivita,
      }
    })

    setRows(result)
  }

  if (!user) return <p>Login richiesto</p>

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>

      <Link href="/">Home</Link>

      <div style={{ marginTop: 20 }}>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />

        <select
          value={selectedPv}
          onChange={(e) => setSelectedPv(e.target.value)}
        >
          <option value="">Tutti i PV</option>
          {pointsOfSale.map(pv => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>
      </div>

      <table style={{ marginTop: 20, width: '100%' }}>
        <thead>
          <tr>
            <th>PV</th>
            <th>Ricavi</th>
            <th>Costi</th>
            <th>Margine</th>
            <th>€/h</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.nome}</td>
              <td>{euro(r.ricavi)}</td>
              <td>{euro(r.costi)}</td>
              <td style={colorMargine(r.margine)}>
                {euro(r.margine)}
              </td>
              <td style={colorProd(r.produttivita)}>
                {euro(r.produttivita)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function sum(arr) {
  return arr.reduce((a, b) => a + Number(b.amount || 0), 0)
}

function isSameMonth(date, month) {
  return String(date || '').slice(0, 7) === month
}

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function euro(v) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(v || 0)
}

function colorMargine(v) {
  return v >= 0 ? { background: '#dff0d8' } : { background: '#f2dede' }
}

function colorProd(v) {
  if (v >= 40) return { background: '#dff0d8' }
  if (v >= 35) return { background: '#fcf8e3' }
  return { background: '#f2dede' }
}
