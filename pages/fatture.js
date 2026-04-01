import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  supplier_id: '',
  invoice_number: '',
  invoice_date: '',
  amount: '',
  point_of_sale_id: '',
  category_id: '',
  is_general: false,
}

export default function Fatture() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [categories, setCategories] = useState([])
  const [mappings, setMappings] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')

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
  }, [user, selectedMonth])

  const mappingsBySupplier = useMemo(() => {
    const map = new Map()
    for (const row of mappings) {
      if (row.supplier_id) map.set(row.supplier_id, row)
    }
    return map
  }, [mappings])

  async function loadData() {
    setMessage('')

    let invoicesQuery = supabase
      .from('invoices')
      .select('*')
      .order('invoice_date', { ascending: false })

    if (selectedMonth) {
      const startDate = `${selectedMonth}-01`
      const endDate = `${getNextMonth(selectedMonth)}-01`

      invoicesQuery = invoicesQuery
        .gte('invoice_date', startDate)
        .lt('invoice_date', endDate)
    }

    const [
      { data: invoicesData, error: invoicesError },
      { data: suppliersData, error: suppliersError },
      { data: pvData, error: pvError },
      { data: categoriesData, error: categoriesError },
      { data: mappingsData, error: mappingsError },
    ] = await Promise.all([
      invoicesQuery,
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('points_of_sale').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('supplier_mappings').select('*'),
    ])

    if (invoicesError || suppliersError || pvError || categoriesError || mappingsError) {
      setMessage(
        invoicesError?.message ||
          suppliersError?.message ||
          pvError?.message ||
          categoriesError?.message ||
          mappingsError?.message ||
          'Errore caricamento dati'
      )
      return
    }

    setRows(invoicesData || [])
    setSuppliers(suppliersData || [])
    setPointsOfSale(pvData || [])
    setCategories(categoriesData || [])
    setMappings(mappingsData || [])
  }

  function applySupplierMapping(supplierId, currentForm = form) {
    const mapping = mappingsBySupplier.get(supplierId)

    if (!mapping) {
      return {
        ...currentForm,
        supplier_id: supplierId,
      }
    }

    return {
      ...currentForm,
      supplier_id: supplierId,
      point_of_sale_id: mapping.is_general ? '' : mapping.point_of_sale_id || '',
      category_id: mapping.category_id || '',
      is_general: !!mapping.is_general,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      supplier_id: form.supplier_id || null,
      invoice_number: form.invoice_number || null,
      invoice_date: form.invoice_date || null,
      amount: form.amount ? Number(form.amount) : null, // imponibile
      point_of_sale_id: form.is_general ? null : form.point_of_sale_id || null,
      category_id: form.category_id || null,
      is_general: !!form.is_general,
    }

    if (editingId) {
      const { error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Fattura aggiornata.')
    } else {
      const { error } = await supabase
        .from('invoices')
        .insert(payload)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Fattura inserita.')
    }

    resetForm()
    loadData()
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      supplier_id: row.supplier_id || '',
      invoice_number: row.invoice_number || '',
      invoice_date: row.invoice_date || '',
      amount: row.amount ?? '',
      point_of_sale_id: row.point_of_sale_id || '',
      category_id: row.category_id || '',
      is_general: !!row.is_general,
    })
    setMessage('')
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questa fattura?')
    if (!conferma) return

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    if (editingId === id) resetForm()

    setMessage('Fattura cancellata.')
    loadData()
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function getSupplierName(id) {
    return suppliers.find((s) => s.id === id)?.name || ''
  }

  function getPvName(id) {
    return pointsOfSale.find((p) => p.id === id)?.name || ''
  }

  function getCategoryName(id) {
    return categories.find((c) => c.id === id)?.name || ''
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

      <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <label>Mese:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
        <button type="button" onClick={() => setSelectedMonth('')}>
          Tutti
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 24, display: 'grid', gap: 12, maxWidth: 560 }}
      >
        <select
          value={form.supplier_id}
          onChange={(e) => setForm(applySupplierMapping(e.target.value))}
        >
          <option value="">Seleziona fornitore</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Numero fattura"
          value={form.invoice_number}
          onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
        />

        <input
          type="date"
          value={form.invoice_date}
          onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Imponibile"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />

        <label>
          <input
            type="checkbox"
            checked={form.is_general}
            onChange={(e) =>
              setForm({
                ...form,
                is_general: e.target.checked,
                point_of_sale_id: e.target.checked ? '' : form.point_of_sale_id,
              })
            }
          />
          {' '}Costo generale
        </label>

        {!form.is_general && (
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
        )}

        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">Seleziona categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit">{editingId ? 'Aggiorna' : 'Salva fattura'}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}

      <h2 style={{ marginTop: 32 }}>Elenco fatture</h2>

      {rows.length === 0 ? (
        <p>Nessuna fattura presente.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={th}>Data</th>
              <th style={th}>Numero</th>
              <th style={th}>Imponibile</th>
              <th style={th}>Fornitore</th>
              <th style={th}>PV</th>
              <th style={th}>Categoria</th>
              <th style={th}>Generale</th>
              <th style={th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.invoice_date || ''}</td>
                <td style={td}>{row.invoice_number || ''}</td>
                <td style={td}>{row.amount || ''}</td>
                <td style={td}>{getSupplierName(row.supplier_id)}</td>
                <td style={td}>{row.is_general ? '' : getPvName(row.point_of_sale_id)}</td>
                <td style={td}>{getCategoryName(row.category_id)}</td>
                <td style={td}>{row.is_general ? 'Sì' : 'No'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleEdit(row)}>
                      Modifica
                    </button>
                    <button type="button" onClick={() => handleDelete(row.id)}>
                      Cancella
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function getNextMonth(month) {
  const [year, mon] = month.split('-').map(Number)

  let nextYear = year
  let nextMonth = mon + 1

  if (nextMonth === 13) {
    nextMonth = 1
    nextYear = year + 1
  }

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
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
