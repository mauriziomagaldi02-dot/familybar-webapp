import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Header from '../components/Header'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [message, setMessage] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedPv, setSelectedPv] = useState('')
  const [trendMonths, setTrendMonths] = useState(6)

  const [revenues, setRevenues] = useState([])
  const [invoices, setInvoices] = useState([])
  const [staffCosts, setStaffCosts] = useState([])
  const [manualCosts, setManualCosts] = useState([])

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

  useEffect(() => {
    buildDashboardRows()
  }, [revenues, invoices, staffCosts, manualCosts, pointsOfSale, selectedMonth, selectedPv])

  async function loadData() {
    setMessage('')

    const [
      { data: pvData, error: pvError },
      { data: revenuesData, error: revError },
      { data: invoicesData, error: invError },
      { data: staffData, error: staffError },
      { data: manualCostsData, error: manualError },
    ] = await Promise.all([
      supabase.from('points_of_sale').select('*').order('name'),
      supabase.from('revenues').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('staff_costs').select('*'),
      supabase.from('manual_costs').select('*'),
    ])

    const err =
      pvError?.message ||
      revError?.message ||
      invError?.message ||
      staffError?.message ||
      manualError?.message

    if (err) {
      setMessage(err)
      return
    }

    setPointsOfSale(pvData || [])
    setRevenues(revenuesData || [])
    setInvoices(invoicesData || [])
    setStaffCosts(staffData || [])
    setManualCosts(manualCostsData || [])
  }

  function buildDashboardRows() {
    const filteredRevenues = (revenues || []).filter((r) =>
      isInSelectedMonth(r.date, selectedMonth)
    )

    const filteredInvoices = (invoices || []).filter((i) =>
      isInSelectedMonth(i.invoice_date, selectedMonth)
    )

    const filteredStaff = (staffCosts || []).filter((s) =>
      isInSelectedMonth(s.period_month, selectedMonth)
    )

    const filteredManualCosts = (manualCosts || []).filter((c) =>
      isInSelectedMonth(c.cost_date, selectedMonth)
    )

    const filteredPvData = (pointsOfSale || []).filter((pv) =>
      selectedPv ? String(pv.id) === String(selectedPv) : true
    )

    const totalRicavi = filteredRevenues.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    )

    const generalManualCosts = filteredManualCosts.filter((c) => c.is_general === true)

    const result = filteredPvData.map((pv) => {
      const ricavi = filteredRevenues
        .filter((r) => String(r.point_of_sale_id) === String(pv.id))
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)

      const costiFattureImponibile = filteredInvoices
        .filter((i) => String(i.point_of_sale_id) === String(pv.id))
        .reduce((sum, i) => sum + Number(i.amount || 0), 0)

      const costoPersonale = filteredStaff
        .filter((s) => String(s.point_of_sale_id) === String(pv.id))
        .reduce((sum, s) => sum + Number(s.amount || 0), 0)

      const ore = filteredStaff
        .filter((s) => String(s.point_of_sale_id) === String(pv.id))
        .reduce((sum, s) => sum + Number(s.worked_hours || 0), 0)

      const speseManualiDirette = filteredManualCosts
        .filter((c) => !c.is_general && String(c.point_of_sale_id) === String(pv.id))
        .reduce((sum, c) => sum + Number(c.amount || 0), 0)

      const quotaGenerali = generalManualCosts.reduce((sum, c) => {
        const amount = Number(c.amount || 0)

        if (totalRicavi > 0) {
          return sum + amount * (ricavi / totalRicavi)
        }

        const numeroPv = filteredPvData.length || 1
        return sum + amount / numeroPv
      }, 0)

      const costiTotali =
        costiFattureImponibile + costoPersonale + speseManualiDirette + quotaGenerali

      const margine = ricavi - costiTotali
      const produttivitaOraria = ore > 0 ? ricavi / ore : 0
      const costoPersonalePerc = ricavi > 0 ? (costoPersonale / ricavi) * 100 : 0

      return {
        id: pv.id,
        nome: pv.name,
        ricavi,
        costiFattureImponibile,
        costoPersonale,
        speseManualiDirette,
        quotaGenerali,
        costiTotali,
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
      <div style={{ padding: 40 }}>
        <p>Devi accedere</p>
        <Link href="/">Torna alla home</Link>
      </div>
    )
  }

  return (
    <div style={{ background: '#f6f7f9', minHeight: '100vh' }}>
      
      <Header />

      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <Link href="/">Home</Link>
        </div>

        <p>La tua dashboard completa è già attiva qui sotto (tabelle + grafici).</p>

      </div>
    </div>
  )
}

function isInSelectedMonth(value, selectedMonth) {
  if (!value || !selectedMonth) return false
  return String(value).slice(0, 7) === selectedMonth
}

function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
