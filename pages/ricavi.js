import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

const initialForm = {
  date: '',
  amount: '',
  point_of_sale_id: '',
}

export default function Ricavi() {
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
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null))

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

    const [{ data: rev, error: revError }, { data: pv, error: pvError }] =
      await Promise.all([
        supabase.from('revenues').select('*').order('date', { ascending: false }),
        supabase.from('points_of_sale').select('*').order('name', { ascending: true }),
      ])

    if (revError || pvError) {
      setMessage(revError?.message || pvError?.message || 'Errore caricamento dati')
      setLoading(false)
      return
    }

    setAllRows(rev || [])
    setPointsOfSale(pv || [])
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
      const startDate = `${selectedMonth}-01`
      const endDate = `${getNextMonth(selectedMonth)}-01`

      result = result.filter((row) => {
        const date = String(row.date || '')
        return date >= startDate && date < endDate
      })
    }

    result.sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
      if (dateCompare !== 0) return dateCompare
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
      date: form.date || null,
      amount: form.amount !== '' ? Number(form.amount) : null,
      point_of_sale_id: form.point_of_sale_id || null,
    }

    if (!payload.date) {
      setMessage('Inserisci la data')
      return
    }

    if (payload.amount === null || Number.isNaN(payload.amount)) {
      setMessage('Inserisci l’importo')
      return
    }

    if (!payload.point_of_sale_id) {
      setMessage('Seleziona il punto vendita')
      return
    }

    const duplicate = allRows.find((row) => {
      if (editingId && row.id === editingId) return false

      return (
        String(row.date || '') === String(payload.date || '') &&
        String(row.point_of_sale_id || '') === String(payload.point_of_sale_id || '')
      )
    })

    if (duplicate) {
      setMessage('Esiste già un ricavo per questo PV in questa data')
      return
    }

    setSaving(true)

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('revenues')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()

        if (error) {
          setMessage(error.message)
          return
        }

        setAllRows((prev) => prev.map((row) => (row.id === editingId ? data : row)))
        setMessage('Ricavo aggiornato.')
      } else {
        const { data, error } = await supabase
          .from('revenues')
          .insert(payload)
          .select()
          .single()

        if (error) {
          setMessage(error.message)
          return
        }

        setAllRows((prev) => [data, ...prev])
        setMessage('Ricavo inserito.')
      }

      resetForm()
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      date: row.date || '',
      amount: row.amount ?? '',
      point_of_sale_id: row.point_of_sale_id || '',
    })
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questo ricavo?')
    if (!conferma) return

    setDeletingId(id)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('revenues')
        .delete()
        .eq('id', id)
        .select('id')

      if (error) {
        setMessage(error.message)
        return
      }

      if (!data || data.length === 0) {
        setMessage('Il ricavo non è stato cancellato dal database. Controlla le policy Supabase.')
        return
      }

      if (editingId === id) resetForm()

      await loadData()
      setMessage('Ricavo cancellato.')
    } finally {
      setDeletingId(null)
    }
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
        <h1 style={pageTitleStyle}>Ricavi</h1>
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
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          style={fieldStyle}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Importo"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
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

      <h2 style={sectionTitleStyle}>Elenco ricavi</h2>

      {loading ? (
        <p style={messageStyle}>Caricamento...</p>
      ) : filteredRows.length === 0 ? (
        <p>Nessun ricavo presente.</p>
      ) : (
        <>
          <div style={paginationInfoStyle}>
            <span>
              Totale ricavi: <strong>{filteredRows.length}</strong>
            </span>
            <span>
              Pagina <strong>{currentPage}</strong> di <strong>{totalPages}</strong>
            </span>
          </div>

          <div style={tableWrapStyle}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Data</th>
                  <th style={th}>Importo</th>
                  <th style={th}>PV</th>
                  <th style={th}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={td}>{row.date || ''}</td>
                    <td style={td}>{formatEuro(row.amount)}</td>
                    <td style={td}>{getPvName(row.point_of_sale_id)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          style={smallButtonStyle}
                          disabled={deletingId === row.id || saving}
                        >
                          Modifica
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          style={deletingId === row.id ? disabledDangerButtonStyle : smallDangerButtonStyle}
                          disabled={deletingId === row.id || saving}
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

function formatEuro(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0))
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
  maxWidth: 400,
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
  marginTop: 0,
  borderCollapse: 'collapse',
  width: '100%',
  minWidth: 680,
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
