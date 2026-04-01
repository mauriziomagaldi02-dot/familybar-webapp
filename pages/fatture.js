import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Fatture() {
  const [user, setUser] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [form, setForm] = useState({
    supplier_id: '',
    invoice_date: '',
    amount: '',
    point_of_sale_id: '',
  })
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
    if (user) {
      loadData()
    }
  }, [user])

  async function loadData() {
    setMessage('')

    const [{ data: invoicesData, error: invoicesError }, { data: suppliersData }, { data: pvData }] =
      await Promise.all([
        supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('points_of_sale').select('*').order('name'),
      ])

    if (invoicesError) {
      setMessage(invoicesError.message)
      return
    }

    setInvoices(invoicesData || [])
    setSuppliers(suppliersData || [])
    setPointsOfSale(pvData || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      supplier_id: form.supplier_id || null,
      invoice_date: form.invoice_date || null,
      amount: form.amount ? Number(form.amount) : null,
      point_of_sale_id: form.point_of_sale_id || null,
    }

    const { error } = await supabase.from('invoices').insert(payload)

    if (error) {
      setMessage(error.message)
      return
    }

    setForm({
      supplier_id: '',
      invoice_date: '',
      amount: '',
      point_of_sale_id: '',
    })

    setMessage('Fattura inserita.')
    loadData()
  }

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
        <h1>Fatture</h1>
        <p>Devi prima accedere.</p>
        <Link href="/">Torna al login</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Fatture</h1>
        <Link href="/">Home</Link>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'grid', gap: 12, maxWidth: 500 }}>
        <select
          value={form.supplier_id}
          onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
        >
          <option value="">Seleziona fornitore</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={form.invoice_date}
          onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Importo"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />

        <select
          value={form.point_of_sale_id}
          onChange={(e) => setForm({ ...form, point_of_sale_id: e.target.value })}
        >
          <option value="">Seleziona punto vendita</option>
          {pointsOfSale.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>

        <button type="submit">Salva fattura</button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}

      <h2 style={{ marginTop: 32 }}>Elenco fatture</h2>

      {invoices.length === 0 ? (
        <p>Nessuna fattura presente.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={th}>Data</th>
              <th style={th}>Importo</th>
              <th style={th}>Fornitore</th>
              <th style={th}>PV</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const supplier = suppliers.find((s) => s.id === inv.supplier_id)
              const pv = pointsOfSale.find((p) => p.id === inv.point_of_sale_id)

              return (
                <tr key={inv.id}>
                  <td style={td}>{inv.invoice_date || ''}</td>
                  <td style={td}>{inv.amount ?? ''}</td>
                  <td style={td}>{supplier?.name || ''}</td>
                  <td style={td}>{pv?.name || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const th = {
  border: '1px solid #ccc',
  padding: 8,
  textAlign: 'left',
  background: '#f5f5f5',
}

const td = {
  border: '1px solid #ccc',
  padding: 8,
}
