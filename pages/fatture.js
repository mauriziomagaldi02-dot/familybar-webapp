import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

const initialForm = {
  supplier_id: '',
  invoice_number: '',
  invoice_date: '',
  amount: '',
  point_of_sale_id: '',
  category_id: '',
  is_general: false,
}

const NO_PV_FILTER_VALUE = '__NO_PV__'
const NO_CATEGORY_FILTER_VALUE = '__NO_CATEGORY__'

export default function Fatture() {
  const [user, setUser] = useState(null)
  const [allRows, setAllRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [categories, setCategories] = useState([])
  const [mappings, setMappings] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedPvFilter, setSelectedPvFilter] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [updatingCellId, setUpdatingCellId] = useState(null)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

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

    const [
      { data: invoicesData, error: invoicesError },
      { data: suppliersData, error: suppliersError },
      { data: pvData, error: pvError },
      { data: categoriesData, error: categoriesError },
      { data: mappingsData, error: mappingsError },
    ] = await Promise.all([
      supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name', { ascending: true }),
      supabase.from('points_of_sale').select('*').order('name', { ascending: true }),
      supabase.from('categories').select('*').order('name', { ascending: true }),
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
      setLoading(false)
      return
    }

    setAllRows(invoicesData || [])
    setSuppliers(suppliersData || [])
    setPointsOfSale(pvData || [])
    setCategories(categoriesData || [])
    setMappings(mappingsData || [])
    setLoading(false)
  }

  const mappingsBySupplier = useMemo(() => {
    const map = new Map()
    for (const row of mappings) {
      if (row.supplier_id) {
        map.set(String(row.supplier_id), row)
      }
    }
    return map
  }, [mappings])

  const suppliersMap = useMemo(() => {
    const map = {}
    for (const row of suppliers) {
      map[String(row.id)] = row.name
    }
    return map
  }, [suppliers])

  const pvMap = useMemo(() => {
    const map = {}
    for (const row of pointsOfSale) {
      map[String(row.id)] = row.name
    }
    return map
  }, [pointsOfSale])

  const categoriesMap = useMemo(() => {
    const map = {}
    for (const row of categories) {
      map[String(row.id)] = row.name
    }
    return map
  }, [categories])

  const filteredRows = useMemo(() => {
    let result = [...allRows]

    if (selectedMonth) {
      const startDate = `${selectedMonth}-01`
      const endDate = `${getNextMonth(selectedMonth)}-01`

      result = result.filter((row) => {
        const date = String(row.invoice_date || '')
        return date >= startDate && date < endDate
      })
    }

    if (selectedPvFilter) {
      if (selectedPvFilter === NO_PV_FILTER_VALUE) {
        result = result.filter((row) => !row.point_of_sale_id)
      } else {
        result = result.filter(
          (row) => String(row.point_of_sale_id || '') === String(selectedPvFilter)
        )
      }
    }

    if (selectedCategoryFilter) {
      if (selectedCategoryFilter === NO_CATEGORY_FILTER_VALUE) {
        result = result.filter((row) => !row.category_id)
      } else {
        result = result.filter(
          (row) => String(row.category_id || '') === String(selectedCategoryFilter)
        )
      }
    }

    result.sort((a, b) => {
      const dateCompare = String(b.invoice_date || '').localeCompare(String(a.invoice_date || ''))
      if (dateCompare !== 0) return dateCompare
      return Number(b.id || 0) - Number(a.id || 0)
    })

    return result
  }, [allRows, selectedMonth, selectedPvFilter, selectedCategoryFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, selectedPvFilter, selectedCategoryFilter, pageSize, filteredRows.length])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredRows.slice(startIndex, startIndex + pageSize)
  }, [filteredRows, currentPage, pageSize])

  function applySupplierMapping(supplierId, currentForm = form) {
    const mapping = mappingsBySupplier.get(String(supplierId))

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

  async function handleCreateCategory() {
    const cleanedName = newCategoryName.trim()

    if (!cleanedName) {
      setMessage('Inserisci il nome della nuova categoria')
      return
    }

    const alreadyExists = categories.find(
      (cat) => String(cat.name || '').trim().toLowerCase() === cleanedName.toLowerCase()
    )

    if (alreadyExists) {
      setForm((prev) => ({ ...prev, category_id: alreadyExists.id }))
      setNewCategoryName('')
      setMessage('Categoria già esistente. Selezionata automaticamente.')
      return
    }

    setCreatingCategory(true)
    setMessage('')

    const { data, error } = await supabase
      .from('categories')
      .insert({ name: cleanedName })
      .select()
      .single()

    if (error) {
      setMessage(`Errore creazione categoria: ${error.message}`)
      setCreatingCategory(false)
      return
    }

    setCategories((prev) =>
      [...prev, data].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    )
    setForm((prev) => ({ ...prev, category_id: data.id }))
    setNewCategoryName('')
    setMessage('Categoria creata.')
    setCreatingCategory(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      supplier_id: form.supplier_id || null,
      invoice_number: form.invoice_number.trim() || null,
      invoice_date: form.invoice_date || null,
      amount: form.amount !== '' ? Number(form.amount) : null,
      point_of_sale_id: form.is_general ? null : form.point_of_sale_id || null,
      category_id: form.category_id || null,
      is_general: !!form.is_general,
    }

    if (!payload.supplier_id) {
      setMessage('Seleziona il fornitore')
      return
    }

    if (!payload.invoice_date) {
      setMessage('Inserisci la data fattura')
      return
    }

    if (payload.amount === null) {
      setMessage('Inserisci l’imponibile')
      return
    }

    if (!payload.is_general && !payload.point_of_sale_id) {
      setMessage('Seleziona il punto vendita oppure marca la fattura come costo generale')
      return
    }

    const duplicate = allRows.find((row) => {
      if (editingId && row.id === editingId) return false

      return (
        String(row.supplier_id || '') === String(payload.supplier_id || '') &&
        String(row.invoice_number || '').trim().toLowerCase() === String(payload.invoice_number || '').trim().toLowerCase() &&
        String(row.invoice_date || '') === String(payload.invoice_date || '')
      )
    })

    if (duplicate) {
      setMessage('Esiste già una fattura con stesso fornitore, numero e data')
      return
    }

    setSaving(true)

    if (editingId) {
      const { data, error } = await supabase
        .from('invoices')
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
      setMessage('Fattura aggiornata.')
    } else {
      const { data, error } = await supabase
        .from('invoices')
        .insert(payload)
        .select()
        .single()

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }

      setAllRows((prev) => [data, ...prev])
      setMessage('Fattura inserita.')
    }

    resetForm()
    setSaving(false)
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questa fattura?')
    if (!conferma) return

    setDeletingId(id)
    setMessage('')

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      setDeletingId(null)
      return
    }

    setAllRows((prev) => prev.filter((row) => row.id !== id))

    if (editingId === id) {
      resetForm()
    }

    setMessage('Fattura cancellata.')
    setDeletingId(null)
  }

  async function updateInvoiceInline(invoiceId, updates, successMessage = 'Fattura aggiornata.') {
    setUpdatingCellId(invoiceId)
    setMessage('')

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoiceId)
      .select()
      .single()

    if (error) {
      setMessage(error.message)
      setUpdatingCellId(null)
      return
    }

    setAllRows((prev) => prev.map((row) => (row.id === invoiceId ? data : row)))
    setMessage(successMessage)
    setUpdatingCellId(null)
  }

  async function handleInlinePvChange(invoiceId, pointOfSaleId, row) {
    if (row.is_general) {
      setMessage('Togli prima il flag "Generale" per assegnare un punto vendita.')
      return
    }

    const value = pointOfSaleId || null

    await updateInvoiceInline(
      invoiceId,
      { point_of_sale_id: value },
      'Punto vendita aggiornato.'
    )
  }

  async function handleInlineCategoryChange(invoiceId, categoryId) {
    const value = categoryId || null

    await updateInvoiceInline(
      invoiceId,
      { category_id: value },
      'Categoria aggiornata.'
    )
  }

  async function handleInlineGeneralChange(invoiceId, checked) {
    if (checked) {
      await updateInvoiceInline(
        invoiceId,
        {
          is_general: true,
          point_of_sale_id: null,
        },
        'Fattura impostata come costo generale.'
      )
      return
    }

    await updateInvoiceInline(
      invoiceId,
      {
        is_general: false,
      },
      'Flag costo generale rimosso.'
    )
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
    setNewCategoryName('')
  }

  function getSupplierName(id) {
    return suppliersMap[String(id)] || ''
  }

  function getPvName(id) {
    return pvMap[String(id)] || ''
  }

  function getCategoryName(id) {
    return categoriesMap[String(id)] || ''
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
        <h1>Fatture</h1>
        <p>Devi prima accedere.</p>
        <Link href="/">Torna al login</Link>
      </div>
    )
  }

  return (
    <Layout onLogout={handleLogout} compactMenu>
      <div style={pageHeaderStyle}>
        <h1 style={pageTitleStyle}>Fatture</h1>
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

        <label style={filterLabelStyle}>PV</label>
        <select
          value={selectedPvFilter}
          onChange={(e) => setSelectedPvFilter(e.target.value)}
          style={filterInputStyle}
        >
          <option value="">Tutti i PV</option>
          <option value={NO_PV_FILTER_VALUE}>Senza PV</option>
          {pointsOfSale.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>

        <label style={filterLabelStyle}>Categoria</label>
        <select
          value={selectedCategoryFilter}
          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
          style={filterInputStyle}
        >
          <option value="">Tutte le categorie</option>
          <option value={NO_CATEGORY_FILTER_VALUE}>Senza categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

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
        <select
          value={form.supplier_id}
          onChange={(e) => setForm(applySupplierMapping(e.target.value))}
          style={fieldStyle}
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
          style={fieldStyle}
        />

        <input
          type="date"
          value={form.invoice_date}
          onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
          style={fieldStyle}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Imponibile"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          style={fieldStyle}
        />

        <label style={checkboxLabelStyle}>
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
            style={fieldStyle}
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
          style={fieldStyle}
        >
          <option value="">Seleziona categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <div style={newCategoryWrapStyle}>
          <input
            type="text"
            placeholder="Nuova categoria"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            style={fieldStyle}
          />
          <button
            type="button"
            onClick={handleCreateCategory}
            style={creatingCategory ? disabledPrimaryButtonStyle : primaryButtonStyle}
            disabled={creatingCategory}
          >
            {creatingCategory ? 'Creazione...' : 'Crea categoria'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={saving ? disabledPrimaryButtonStyle : primaryButtonStyle}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Salva fattura'}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {message && <p style={messageStyle}>{message}</p>}

      <h2 style={sectionTitleStyle}>Elenco fatture</h2>

      {loading ? (
        <p style={messageStyle}>Caricamento...</p>
      ) : filteredRows.length === 0 ? (
        <p>Nessuna fattura presente.</p>
      ) : (
        <>
          <div style={paginationInfoStyle}>
            <span>
              Totale fatture: <strong>{filteredRows.length}</strong>
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
                {paginatedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={td}>{row.invoice_date || ''}</td>
                    <td style={td}>{row.invoice_number || ''}</td>
                    <td style={td}>{formatEuro(row.amount)}</td>
                    <td style={td}>{getSupplierName(row.supplier_id)}</td>

                    <td style={td}>
                      {row.is_general ? (
                        <span style={inlineMutedTextStyle}>Generale</span>
                      ) : (
                        <select
                          value={row.point_of_sale_id || ''}
                          onChange={(e) => handleInlinePvChange(row.id, e.target.value, row)}
                          style={inlineSelectStyle}
                          disabled={updatingCellId === row.id}
                        >
                          <option value="">Seleziona PV</option>
                          {pointsOfSale.map((pv) => (
                            <option key={pv.id} value={pv.id}>
                              {pv.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td style={td}>
                      <select
                        value={row.category_id || ''}
                        onChange={(e) => handleInlineCategoryChange(row.id, e.target.value)}
                        style={inlineSelectStyle}
                        disabled={updatingCellId === row.id}
                      >
                        <option value="">Seleziona categoria</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={td}>
                      <label style={inlineCheckboxLabelStyle}>
                        <input
                          type="checkbox"
                          checked={!!row.is_general}
                          onChange={(e) => handleInlineGeneralChange(row.id, e.target.checked)}
                          disabled={updatingCellId === row.id}
                        />
                        {' '}Sì
                      </label>
                    </td>

                    <td style={td}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          style={smallButtonStyle}
                          disabled={deletingId === row.id || updatingCellId === row.id}
                        >
                          Modifica
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          style={deletingId === row.id ? disabledDangerButtonStyle : smallDangerButtonStyle}
                          disabled={deletingId === row.id || updatingCellId === row.id}
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
  marginTop: 24,
  display: 'grid',
  gap: 12,
  maxWidth: 560,
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

const checkboxLabelStyle = {
  fontSize: 14,
  color: '#111827',
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
  marginTop: 16,
  color: '#111827',
}

const sectionTitleStyle = {
  marginTop: 32,
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
  marginTop: 12,
}

const table = {
  borderCollapse: 'collapse',
  width: '100%',
  minWidth: 980,
}

const th = {
  borderBottom: '1px solid #e5e7eb',
  padding: 10,
  textAlign: 'left',
  background: '#f9fafb',
  color: '#111827',
  fontSize: 14,
  whiteSpace: 'nowrap',
}

const td = {
  borderBottom: '1px solid #f1f5f9',
  padding: 10,
  fontSize: 14,
  color: '#111827',
}

const inlineSelectStyle = {
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: '#fff',
  fontSize: 13,
  minWidth: 150,
}

const inlineCheckboxLabelStyle = {
  fontSize: 13,
  color: '#111827',
  whiteSpace: 'nowrap',
}

const inlineMutedTextStyle = {
  fontSize: 13,
  color: '#6b7280',
}

const newCategoryWrapStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 10,
  alignItems: 'center',
}
