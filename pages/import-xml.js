import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function ImportXml() {
  const [user, setUser] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [mappings, setMappings] = useState([])
  const [message, setMessage] = useState('')
  const [previewRows, setPreviewRows] = useState([])
  const [isImporting, setIsImporting] = useState(false)

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
      if (m.supplier_id) map.set(m.supplier_id, m)
    }
    return map
  }, [mappings])

  async function loadReferenceData() {
    setMessage('')

    const [
      { data: suppliersData, error: suppliersError },
      { data: mappingsData, error: mappingsError },
    ] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('supplier_mappings').select('*'),
    ])

    if (suppliersError || mappingsError) {
      setMessage(
        suppliersError?.message ||
          mappingsError?.message ||
          'Errore caricamento dati di riferimento'
      )
      return
    }

    setSuppliers(suppliersData || [])
    setMappings(mappingsData || [])
  }

  async function handleFilesChange(e) {
    const selectedFiles = Array.from(e.target.files || [])
    setMessage('')

    if (selectedFiles.length === 0) {
      setPreviewRows([])
      return
    }

    const parsedRows = []

    for (const file of selectedFiles) {
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
          ? mappingsBySupplierId.get(matchedSupplier.id)
          : null

        parsedRows.push({
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
            ? normalizedVat && matchedSupplier.vat_number && normalizeVatOrTaxCode(matchedSupplier.vat_number) === normalizedVat
              ? 'P.IVA'
              : normalizedTaxCode && matchedSupplier.tax_code && normalizeVatOrTaxCode(matchedSupplier.tax_code) === normalizedTaxCode
              ? 'Codice fiscale'
              : 'Nome'
            : '',
        })
      } catch (error) {
        parsedRows.push({
          source_filename: file.name,
          error: error.message || 'Errore parsing XML',
        })
      }
    }

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
      let duplicates = 0
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
        if (m.supplier_id) localMappingsMap.set(m.supplier_id, m)
      }

      for (const row of previewRows) {
        if (row.error) {
          skipped += 1
          continue
        }

        let supplier = null

        if (row.supplier_id) {
          supplier =
            suppliers.find((s) => s.id === row.supplier_id) ||
            localSuppliersByVat.get(row.normalized_vat_number) ||
            localSuppliersByTaxCode.get(row.normalized_tax_code) ||
            localSuppliersByName.get(row.normalized_supplier_name) ||
            null
        } else {
          supplier =
            localSuppliersByVat.get(row.normalized_vat_number) ||
            localSuppliersByTaxCode.get(row.normalized_tax_code) ||
            localSuppliersByName.get(row.normalized_supplier_name) ||
            null
        }

        if (!supplier) {
          const payloadSupplier = {
            name: row.supplier_name || null,
            normalized_name: row.normalized_supplier_name || null,
            vat_number: row.vat_number || null,
            tax_code: row.tax_code || null,
          }

          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert(payloadSupplier)
            .select()
            .single()

          if (supplierError) {
            if (supplierError.code === '23505') {
              supplier =
                localSuppliersByVat.get(row.normalized_vat_number) ||
                localSuppliersByTaxCode.get(row.normalized_tax_code) ||
                localSuppliersByName.get(row.normalized_supplier_name) ||
                null

              if (!supplier) {
                if (row.normalized_vat_number) {
                  const { data } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('vat_number', row.vat_number || '')
                    .maybeSingle()
                  if (data) supplier = data
                }

                if (!supplier && row.normalized_tax_code) {
                  const { data } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('tax_code', row.tax_code || '')
                    .maybeSingle()
                  if (data) supplier = data
                }

                if (!supplier && row.normalized_supplier_name) {
                  const { data } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('normalized_name', row.normalized_supplier_name)
                    .maybeSingle()
                  if (data) supplier = data
                }
              }

              if (!supplier) {
                skipped += 1
                continue
              }
            } else {
              skipped += 1
              continue
            }
          } else {
            supplier = newSupplier
            createdSuppliers += 1
          }

          if (supplier) {
            const normName = supplier.normalized_name || normalizeSupplierName(supplier.name)
            const normVat = normalizeVatOrTaxCode(supplier.vat_number)
            const normTax = normalizeVatOrTaxCode(supplier.tax_code)

            if (normName) localSuppliersByName.set(normName, supplier)
            if (normVat) localSuppliersByVat.set(normVat, supplier)
            if (normTax) localSuppliersByTaxCode.set(normTax, supplier)
          }
        }

        if (!supplier?.id) {
          skipped += 1
          continue
        }

        const { data: existingInvoice, error: existingInvoiceError } = await supabase
          .from('invoices')
          .select('id')
          .eq('supplier_id', supplier.id)
          .eq('invoice_number', row.invoice_number || null)
          .eq('invoice_date', row.invoice_date || null)
          .maybeSingle()

        if (existingInvoiceError) {
          skipped += 1
          continue
        }

        if (existingInvoice) {
          duplicates += 1
          continue
        }

        const mapping = localMappingsMap.get(supplier.id) || null

        const payloadInvoice = {
          supplier_id: supplier.id,
          supplier_name: row.supplier_name || null,
          invoice_date: row.invoice_date || null,
          invoice_number: row.invoice_number || null,
          amount: row.amount ? Number(row.amount) : null, // imponibile
          point_of_sale_id: mapping?.is_general ? null : mapping?.point_of_sale_id || null,
          category_id: mapping?.category_id || null,
          is_general: !!mapping?.is_general,
          source_filename: row.source_filename || null,
        }

        const { error } = await supabase.from('invoices').insert(payloadInvoice)

        if (error) {
          if (error.code === '23505') {
            duplicates += 1
          } else {
            skipped += 1
          }
          continue
        }

        inserted += 1
      }

      setMessage(
        `Import completato. Inserite: ${inserted}. Nuovi fornitori creati: ${createdSuppliers}. Duplicati saltati: ${duplicates}. Saltate: ${skipped}.`
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
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Import XML Fatture</h1>
        <Link href="/">Home</Link>
      </div>

      <div style={{ marginTop: 24, display: 'grid', gap: 12, maxWidth: 700 }}>
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          onChange={handleFilesChange}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || previewRows.length === 0}
          >
            {isImporting ? 'Importazione in corso...' : 'Importa fatture'}
          </button>
        </div>
      </div>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}

      <h2 style={{ marginTop: 32 }}>Anteprima import</h2>

      {previewRows.length === 0 ? (
        <p>Nessun file caricato.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
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
              <tr key={idx}>
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
      )}
    </div>
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
