import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

export default function ImportXml() {
  const [user, setUser] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [mappings, setMappings] = useState([])
  const [message, setMessage] = useState('')
  const [previewRows, setPreviewRows] = useState([])
  const [isImporting, setIsImporting] = useState(false)
  const [isLoadingRefs, setIsLoadingRefs] = useState(true)

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
    if (user) loadReferenceData()
  }, [user])

  const suppliersByNormalizedName = useMemo(() => {
    const map = new Map()
    for (const s of suppliers) {
      const key = s.normalized_name || normalizeSupplierName(s.name)
      if (key) map.set(key, s)
    }
    return map
  }, [suppliers])

  const suppliersByVat = useMemo(() => {
    const map = new Map()
    for (const s of suppliers) {
      const key = normalizeVatOrTaxCode(s.vat_number)
      if (key) map.set(key, s)
    }
    return map
  }, [suppliers])

  const suppliersByTaxCode = useMemo(() => {
    const map = new Map()
    for (const s of suppliers) {
      const key = normalizeVatOrTaxCode(s.tax_code)
      if (key) map.set(key, s)
    }
    return map
  }, [suppliers])

  const mappingsBySupplierId = useMemo(() => {
    const map = new Map()
    for (const m of mappings) {
      if (m.supplier_id) map.set(String(m.supplier_id), m)
    }
    return map
  }, [mappings])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function loadReferenceData() {
    setIsLoadingRefs(true)
    setMessage('')

    const [
      { data: suppliersData, error: suppliersError },
      { data: mappingsData, error: mappingsError },
    ] = await Promise.all([
      supabase.from('suppliers').select('*').order('name', { ascending: true }),
      supabase.from('supplier_mappings').select('*'),
    ])

    if (suppliersError || mappingsError) {
      setMessage(
        suppliersError?.message ||
          mappingsError?.message ||
          'Errore caricamento dati di riferimento'
      )
      setIsLoadingRefs(false)
      return
    }

    setSuppliers(suppliersData || [])
    setMappings(mappingsData || [])
    setIsLoadingRefs(false)
  }

  async function handleFilesChange(e) {
    const selectedFiles = Array.from(e.target.files || [])
    setMessage('')

    if (selectedFiles.length === 0) {
      setPreviewRows([])
      return
    }

    const parsedRows = await Promise.all(
      selectedFiles.map(async (file) => {
        try {
          const text = await file.text()
          const parsed = parseFatturaXml(text, file.name)

          const normalizedSupplierName = normalizeSupplierName(parsed.supplier_name)
          const normalizedVat = normalizeVatOrTaxCode(parsed.vat_number)
          const normalizedTaxCode = normalizeVatOrTaxCode(parsed.tax_code)

          let matchedSupplier = null

          if (normalizedVat && suppliersByVat.has(normalizedVat)) {
            matchedSupplier = suppliersByVat.get(normalizedVat)
          } else if (normalizedTaxCode && suppliersByTaxCode.has(normalizedTaxCode)) {
            matchedSupplier = suppliersByTaxCode.get(normalizedTaxCode)
          } else if (normalizedSupplierName && suppliersByNormalizedName.has(normalizedSupplierName)) {
            matchedSupplier = suppliersByNormalizedName.get(normalizedSupplierName)
          }

          const mapping = matchedSupplier
            ? mappingsBySupplierId.get(String(matchedSupplier.id))
            : null

          return {
            ...parsed,
            normalized_supplier_name: normalizedSupplierName,
            normalized_vat_number: normalizedVat,
            normalized_tax_code: normalizedTaxCode,
            supplier_id: matchedSupplier?.id || null,
            matched_supplier_name: matchedSupplier?.name || '',
            point_of_sale_id: mapping?.is_general ? null : mapping?.point_of_sale_id || null,
            category_id: mapping?.category_id || null,
            is_general: !!mapping?.is_general,
            will_create_supplier: !matchedSupplier,
            match_type: matchedSupplier
              ? normalizedVat &&
                matchedSupplier.vat_number &&
                normalizeVatOrTaxCode(matchedSupplier.vat_number) === normalizedVat
                ? 'P.IVA'
                : normalizedTaxCode &&
                    matchedSupplier.tax_code &&
                    normalizeVatOrTaxCode(matchedSupplier.tax_code) === normalizedTaxCode
                  ? 'Codice fiscale'
                  : 'Nome'
              : '',
          }
        } catch (error) {
          return {
            source_filename: file.name,
            error: error.message || 'Errore parsing XML',
          }
        }
      })
    )

    setPreviewRows(parsedRows)
  }

  async function handleImport() {
    if (previewRows.length === 0) {
      setMessage('Nessun file da importare.')
      return
    }

    setIsImporting(true)
    setMessage('')

    try {
      let inserted = 0
      let createdSuppliers = 0
      let skipped = 0

      const localSuppliersByName = new Map()
      const localSuppliersByVat = new Map()
      const localSuppliersByTaxCode = new Map()

      for (const s of suppliers) {
        const normName = s.normalized_name || normalizeSupplierName(s.name)
        const normVat = normalizeVatOrTaxCode(s.vat_number)
        const normTax = normalizeVatOrTaxCode(s.tax_code)

        if (normName) localSuppliersByName.set(normName, s)
        if (normVat) localSuppliersByVat.set(normVat, s)
        if (normTax) localSuppliersByTaxCode.set(normTax, s)
      }

      const localMappingsMap = new Map()
      for (const m of mappings) {
        if (m.supplier_id) localMappingsMap.set(String(m.supplier_id), m)
      }

      const validRows = previewRows.filter((row) => !row.error)

      const supplierCreateCandidatesMap = new Map()

      for (const row of validRows) {
        const existingSupplier =
          (row.normalized_vat_number && localSuppliersByVat.get(row.normalized_vat_number)) ||
          (row.normalized_tax_code && localSuppliersByTaxCode.get(row.normalized_tax_code)) ||
          (row.normalized_supplier_name && localSuppliersByName.get(row.normalized_supplier_name)) ||
          null

        if (!existingSupplier) {
          const supplierKey = buildSupplierKey(row)

          if (!supplierCreateCandidatesMap.has(supplierKey)) {
            supplierCreateCandidatesMap.set(supplierKey, {
              name: row.supplier_name || null,
              normalized_name: row.normalized_supplier_name || null,
              vat_number: row.vat_number || null,
              tax_code: row.tax_code || null,
            })
          }
        }
      }

      const suppliersToCreate = Array.from(supplierCreateCandidatesMap.values())

      if (suppliersToCreate.length > 0) {
        const { data: insertedSuppliers, error: insertSuppliersError } = await supabase
          .from('suppliers')
          .insert(suppliersToCreate)
          .select()

        if (insertSuppliersError && insertSuppliersError.code !== '23505') {
          throw new Error(insertSuppliersError.message || 'Errore creazione fornitori')
        }

        if (insertedSuppliers?.length) {
          createdSuppliers += insertedSuppliers.length

          for (const supplier of insertedSuppliers) {
            const normName = supplier.normalized_name || normalizeSupplierName(supplier.name)
            const normVat = normalizeVatOrTaxCode(supplier.vat_number)
            const normTax = normalizeVatOrTaxCode(supplier.tax_code)

            if (normName) localSuppliersByName.set(normName, supplier)
            if (normVat) localSuppliersByVat.set(normVat, supplier)
            if (normTax) localSuppliersByTaxCode.set(normTax, supplier)
          }
        }

        const needRefreshSuppliers =
          !insertedSuppliers?.length || insertSuppliersError?.code === '23505'

        if (needRefreshSuppliers) {
          const { data: refreshedSuppliers, error: refreshError } = await supabase
            .from('suppliers')
            .select('*')

          if (refreshError) {
            throw new Error(refreshError.message || 'Errore aggiornamento fornitori')
          }

          for (const supplier of refreshedSuppliers || []) {
            const normName = supplier.normalized_name || normalizeSupplierName(supplier.name)
            const normVat = normalizeVatOrTaxCode(supplier.vat_number)
            const normTax = normalizeVatOrTaxCode(supplier.tax_code)

            if (normName) localSuppliersByName.set(normName, supplier)
            if (normVat) localSuppliersByVat.set(normVat, supplier)
            if (normTax) localSuppliersByTaxCode.set(normTax, supplier)
          }
        }
      }

      const invoicesToInsert = []

      for (const row of validRows) {
        const supplier =
          (row.normalized_vat_number && localSuppliersByVat.get(row.normalized_vat_number)) ||
          (row.normalized_tax_code && localSuppliersByTaxCode.get(row.normalized_tax_code)) ||
          (row.normalized_supplier_name && localSuppliersByName.get(row.normalized_supplier_name)) ||
          null

        if (!supplier?.id) {
          skipped += 1
          continue
        }

        const mapping = localMappingsMap.get(String(supplier.id)) || null

        invoicesToInsert.push({
          supplier_id: supplier.id,
          supplier_name: row.supplier_name || null,
          invoice_date: row.invoice_date || null,
          invoice_number: row.invoice_number || null,
          amount: row.amount ? Number(row.amount) : null,
          point_of_sale_id: mapping?.is_general ? null : mapping?.point_of_sale_id || null,
          category_id: mapping?.category_id || null,
          is_general: !!mapping?.is_general,
          source_filename: row.source_filename || null,
        })
      }

      if (invoicesToInsert.length > 0) {
        const { data: insertedInvoices, error: insertInvoicesError } = await supabase
          .from('invoices')
          .insert(invoicesToInsert)
          .select('id')

        if (insertInvoicesError) {
          throw new Error(insertInvoicesError.message || 'Errore inserimento fatture')
        }

        inserted += insertedInvoices?.length || invoicesToInsert.length
      }

      const totalRowsWithError = previewRows.filter((row) => row.error).length
      skipped += totalRowsWithError

      setMessage(
        `Import completato. Inserite: ${inserted}. Nuovi fornitori creati: ${createdSuppliers}. Saltate: ${skipped}.`
      )

      setPreviewRows([])
      await loadReferenceData()
    } catch (error) {
      setMessage(error.message || 'Errore durante importazione')
    } finally {
      setIsImporting(false)
    }
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
        <h1 style={pageTitleStyle}>Import XML Fatture</h1>
      </div>

      <div style={uploadWrapStyle}>
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          onChange={handleFilesChange}
          style={fieldStyle}
          disabled={isImporting || isLoadingRefs}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || isLoadingRefs || previewRows.length === 0}
            style={
              isImporting || isLoadingRefs || previewRows.length === 0
                ? disabledButtonStyle
                : primaryButtonStyle
            }
          >
            {isImporting ? 'Importazione in corso...' : 'Importa fatture'}
          </button>
        </div>
      </div>

      {message && <p style={messageStyle}>{message}</p>}

      <h2 style={sectionTitleStyle}>Anteprima import</h2>

      {previewRows.length === 0 ? (
        <p>Nessun file caricato.</p>
      ) : (
        <div style={tableWrapStyle}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>File</th>
                <th style={th}>Fornitore XML</th>
                <th style={th}>P.IVA</th>
                <th style={th}>CF</th>
                <th style={th}>Fornitore trovato</th>
                <th style={th}>Match</th>
                <th style={th}>Numero</th>
                <th style={th}>Data</th>
                <th style={th}>Imponibile</th>
                <th style={th}>Esito</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={`${row.source_filename || 'row'}-${idx}`}>
                  <td style={td}>{row.source_filename || ''}</td>
                  <td style={td}>{row.supplier_name || ''}</td>
                  <td style={td}>{row.vat_number || ''}</td>
                  <td style={td}>{row.tax_code || ''}</td>
                  <td style={td}>{row.matched_supplier_name || ''}</td>
                  <td style={td}>{row.match_type || ''}</td>
                  <td style={td}>{row.invoice_number || ''}</td>
                  <td style={td}>{row.invoice_date || ''}</td>
                  <td style={td}>{row.amount || ''}</td>
                  <td style={td}>
                    {row.error
                      ? `Errore: ${row.error}`
                      : row.supplier_id
                        ? 'Pronto'
                        : row.will_create_supplier
                          ? 'Nuovo fornitore: verrà creato'
                          : 'Pronto'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}

function parseFatturaXml(xmlText, filename) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')

  const parseError = xml.querySelector('parsererror')
  if (parseError) {
    throw new Error('XML non valido')
  }

  const supplierName =
    getNodeText(xml, 'CedentePrestatore Denominazione') ||
    joinParts(
      getNodeText(xml, 'CedentePrestatore Nome'),
      getNodeText(xml, 'CedentePrestatore Cognome')
    )

  const vatCountry = getNodeText(xml, 'CedentePrestatore IdFiscaleIVA IdPaese')
  const vatCode = getNodeText(xml, 'CedentePrestatore IdFiscaleIVA IdCodice')
  const taxCode = getNodeText(xml, 'CedentePrestatore CodiceFiscale')

  const invoiceNumber = getNodeText(xml, 'DatiGeneraliDocumento Numero')
  const invoiceDate = getNodeText(xml, 'DatiGeneraliDocumento Data')

  let amount = getNodeText(xml, 'DatiGeneraliDocumento ImportoTotaleDocumento')

  if (!amount) {
    const imponibili = getAllNodeTexts(xml, 'DatiRiepilogo ImponibileImporto')
      .map((v) => Number(sanitizeNumber(v)))
      .filter((v) => !Number.isNaN(v))

    if (imponibili.length > 0) {
      amount = String(imponibili.reduce((sum, v) => sum + v, 0))
    }
  }

  if (!supplierName) {
    throw new Error('Fornitore non trovato nel file XML')
  }

  const fullVatNumber =
    vatCode ? `${(vatCountry || '').trim()}${String(vatCode).trim()}` : ''

  return {
    source_filename: filename,
    supplier_name: supplierName,
    vat_number: fullVatNumber,
    tax_code: (taxCode || '').trim(),
    invoice_number: invoiceNumber || '',
    invoice_date: invoiceDate || '',
    amount: sanitizeNumber(amount || ''),
  }
}

function getNodeText(xml, path) {
  const parts = path.split(' ')
  let nodes = [xml.documentElement]

  for (const part of parts) {
    const nextNodes = []
    for (const node of nodes) {
      const found = Array.from(node.getElementsByTagName('*')).filter(
        (el) => stripPrefix(el.tagName) === part
      )
      for (const item of found) nextNodes.push(item)
    }
    if (nextNodes.length === 0) return ''
    nodes = nextNodes
  }

  return nodes[0]?.textContent?.trim() || ''
}

function getAllNodeTexts(xml, path) {
  const parts = path.split(' ')
  let nodes = [xml.documentElement]

  for (const part of parts) {
    const nextNodes = []
    for (const node of nodes) {
      const found = Array.from(node.getElementsByTagName('*')).filter(
        (el) => stripPrefix(el.tagName) === part
      )
      for (const item of found) nextNodes.push(item)
    }
    if (nextNodes.length === 0) return []
    nodes = nextNodes
  }

  return nodes.map((n) => n.textContent?.trim() || '').filter(Boolean)
}

function stripPrefix(tagName) {
  return String(tagName).split(':').pop()
}

function normalizeSupplierName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim()
}

function normalizeVatOrTaxCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim()
}

function sanitizeNumber(value) {
  return String(value || '').replace(',', '.').trim()
}

function joinParts(...parts) {
  return parts.filter(Boolean).join(' ').trim()
}

function buildSupplierKey(row) {
  return [
    row.normalized_vat_number || '',
    row.normalized_tax_code || '',
    row.normalized_supplier_name || '',
  ].join('|')
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

const uploadWrapStyle = {
  marginTop: 24,
  display: 'grid',
  gap: 12,
  maxWidth: 700,
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

const disabledButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#f3f4f6',
  color: '#9ca3af',
  cursor: 'not-allowed',
  fontSize: 14,
}

const messageStyle = {
  marginTop: 16,
  color: '#111827',
}

const sectionTitleStyle = {
  marginTop: 32,
  color: '#111827',
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
  minWidth: 1200,
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
