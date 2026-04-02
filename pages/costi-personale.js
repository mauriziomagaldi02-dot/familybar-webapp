import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

const initialForm = {
  period_month: '',
  amount: '',
  worked_hours: '',
  point_of_sale_id: '',
}

export default function CostiPersonale() {
  const [user, setUser] = useState(null)
  const [allRows, setAllRows] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

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

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [{ data, error }, { data: pvData, error: pvError }] = await Promise.all([
      supabase
        .from('staff_costs')
        .select('*')
        .order('period_month', { ascending: false }),
      supabase.from('points_of_sale').select('*').order('name', { ascending: true }),
    ])

    if (error || pvError) {
      setMessage(error?.message || pvError?.message || 'Errore caricamento dati')
      setLoading(false)
      return
    }

    setAllRows(data || [])
    setPointsOfSale(pvData || [])
    setLoading(false)
  }

  const pvMap = useMemo(() => {
    const map = {}
    for (const pv of pointsOfSale) {
      map[String(pv.id)] = pv.name
    }
    return map
  }, [pointsOfSale])

  const filteredRows = useMemo(() => {
    let result = [...allRows]

    if (selectedMonth) {
      result = result.filter((row) => String(row.period_month) === String(selectedMonth))
    }

    result.sort((a, b) => {
      const monthCompare = String(b.period_month || '').localeCompare(String(a.period_month || ''))
      if (monthCompare !== 0) return monthCompare
      return Number(b.id || 0) - Number(a.id || 0)
    })

    return result
  }, [allRows, selectedMonth])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, pageSize, filteredRows.length])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredRows.slice(startIndex, startIndex + pageSize)
  }, [filteredRows, currentPage, pageSize])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      period_month: form.period_month || null,
      amount: form.amount !== '' ? Number(form.amount) : null,
      worked_hours: form.worked_hours !== '' ? Number(form.worked_hours) : null,
      point_of_sale_id: form.point_of_sale_id || null,
    }

    if (!payload.period_month) {
      setMessage('Seleziona il mese')
      return
    }

    if (!payload.point_of_sale_id) {
      setMessage('Seleziona il punto vendita')
      return
    }

    setSaving(true)

    if (editingId) {
      const { data, error } = await supabase
        .from('staff_costs')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }

      setAllRows((prev) => prev.map((row) => (row.id === editingId ? data : row)))
      setMessage('Costo personale aggiornato.')
    } else {
      const { data, error } = await supabase
        .from('staff_costs')
        .insert(payload)
        .select()
        .single()

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }

      setAllRows((prev) => [data, ...prev])
      setMessage('Costo personale inserito.')
    }

    resetForm()
    setSaving(false)
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      period_month: row.period_month || '',
      amount: row.amount ?? '',
      worked_hours: row.worked_hours ?? '',
      point_of_sale_id: row.point_of_sale_id || '',
    })
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questo costo del personale?')
    if (!conferma) return

    setDeletingId(id)
    setMessage('')

    const { error } = await supabase.from('staff_costs').delete().eq('id', id)

    if (error) {
      setMessage(error.message)
      setDeletingId(null)
      return
    }

    setAllRows((prev) => prev.filter((row) => row.id !== id))

    if (editingId === id) {
      resetForm()
    }

    setMessage('Costo personale cancellato.')
    setDeletingId(null)
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function getPvName(id) {
    return pvMap[String(id)] || ''
  }

  function goToPrevPage() {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  function goToNextPage() {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
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
    <Layout onLogout={handleLogout} compactMenu>
      <div style={pageHeaderStyle}>
        <h1 style={pageTitleStyle}>Costi personale</h1>
      </div>

      <div style={filtersWrapStyle}>
        <label style={filterLabelStyle}>Mese</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={filterInputStyle}
        />

        <button type="button" onClick={() => setSelectedMonth('')} style={secondaryButtonStyle}>
          Tutti
        </button>

        <label style={filterLabelStyle}>Mostra</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={filterInputStyle}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <form onSubmit={handleSubmit} style={formWrapStyle}>
        <input
          type="month"
          value={form.period_month}
          onChange={(e) => setForm({ ...form, period_month: e.target.value })}
          style={fieldStyle}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Costo €"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          style={fieldStyle}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Ore lavorate"
          value={form.worked_hours}
          onChange={(e) => setForm({ ...form, worked_hours: e.target.value })}
          style={fieldStyle}
        />

        <select
          value={form.point_of_sale_id}
          onChange={(e) => setForm({ ...form, point_of_sale_id: e.target.value })}
          style={fieldStyle}
        >
          <option value="">Seleziona PV</option>
          {pointsOfSale.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={saving ? disabledPrimaryButtonStyle : primaryButtonStyle}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Salva'}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {message && <p style={messageStyle}>{message}</p>}

      <h2 style={sectionTitleStyle}>Elenco</h2>

      {loading ? (
        <p style={messageStyle}>Caricamento...</p>
      ) : filteredRows.length === 0 ? (
        <p>Nessun costo del personale presente.</p>
      ) : (
        <>
          <div style={paginationInfoStyle}>
            <span>
              Totale righe: <strong>{filteredRows.length}</strong>
            </span>
            <span>
              Pagina <strong>{currentPage}</strong> di <strong>{totalPages}</strong>
            </span>
          </div>

          <div style={tableWrapStyle}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Mese</th>
                  <th style={th}>Costo</th>
                  <th style={th}>Ore</th>
                  <th style={th}>PV</th>
                  <th style={th}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={td}>{row.period_month || ''}</td>
                    <td style={td}>{formatEuro(row.amount)}</td>
                    <td style={td}>{formatNumber(row.worked_hours)}</td>
                    <td style={td}>{getPvName(row.point_of_sale_id)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          style={smallButtonStyle}
                          disabled={deletingId === row.id}
                        >
                          Modifica
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          style={deletingId === row.id ? disabledDangerButtonStyle : smallDangerButtonStyle}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? 'Cancellazione...' : 'Cancella'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={paginationWrapStyle}>
            <button
              type="button"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              style={currentPage === 1 ? disabledButtonStyle : secondaryButtonStyle}
            >
              ← Precedente
            </button>

            <button
              type="button"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              style={currentPage === totalPages ? disabledButtonStyle : secondaryButtonStyle}
            >
              Successiva →
            </button>
          </div>
        </>
      )}
    </Layout>
  )
}

function formatEuro(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0))
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2)
}

const pageHeaderStyle = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  marginBottom: 20,
}

const pageTitleStyle = {
  margin: 0,
  color: '#111827',
  fontSize: 28,
}

const filtersWrapStyle = {
  marginTop: 20,
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 12,
}

const filterLabelStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: '#374151',
}

const filterInputStyle = {
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontSize: 14,
  background: '#fff',
}

const formWrapStyle = {
  marginTop: 20,
  display: 'grid',
  gap: 10,
  maxWidth: 420,
  padding: 20,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
}

const fieldStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
}

const primaryButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: 10,
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}

const disabledPrimaryButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: 10,
  background: '#9ca3af',
  color: '#fff',
  cursor: 'not-allowed',
  fontSize: 14,
  fontWeight: 600,
}

const secondaryButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}

const disabledButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#f3f4f6',
  color: '#9ca3af',
  cursor: 'not-allowed',
  fontSize: 14,
}

const smallButtonStyle = {
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
}

const smallDangerButtonStyle = {
  padding: '8px 10px',
  border: '1px solid #ef4444',
  borderRadius: 8,
  background: '#fff',
  color: '#b91c1c',
  cursor: 'pointer',
  fontSize: 13,
}

const disabledDangerButtonStyle = {
  padding: '8px 10px',
  border: '1px solid #fca5a5',
  borderRadius: 8,
  background: '#fef2f2',
  color: '#fca5a5',
  cursor: 'not-allowed',
  fontSize: 13,
}

const messageStyle = {
  marginTop: 12,
  color: '#111827',
}

const sectionTitleStyle = {
  marginTop: 30,
  color: '#111827',
}

const paginationInfoStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 12,
  marginBottom: 12,
  fontSize: 14,
  color: '#374151',
}

const paginationWrapStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 16,
}

const tableWrapStyle = {
  width: '100%',
  overflowX: 'auto',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  marginTop: 10,
}

const table = {
  borderCollapse: 'collapse',
  width: '100%',
  minWidth: 700,
}

const th = {
  borderBottom: '1px solid #e5e7eb',
  padding: 10,
  textAlign: 'left',
  background: '#f9fafb',
  color: '#111827',
  fontSize: 14,
}

const td = {
  borderBottom: '1px solid #f1f5f9',
  padding: 10,
  fontSize: 14,
  color: '#111827',
}
