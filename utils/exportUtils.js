export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export function exportRowsToCsv({ filename, columns, rows }) {
  const header = columns.map((col) => escapeCsv(col.label)).join(';')
  const body = rows
    .map((row) =>
      columns.map((col) => escapeCsv(col.value(row))).join(';')
    )
    .join('\n')

  const csv = '\uFEFF' + header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function exportRowsToExcel({ filename, sheetName = 'Dati', columns, rows, title = '' }) {
  const tableHeader = columns
    .map((col) => `<th>${escapeHtml(col.label)}</th>`)
    .join('')

  const tableBody = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => `<td>${escapeHtml(String(col.value(row) ?? ''))}</td>`)
          .join('')}</tr>`
    )
    .join('')

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          h1 { font-size: 18px; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
        <table>
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </body>
    </html>
  `

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function printHtmlReport({ title, subtitle = '', sections = [] }) {
  const win = window.open('', '_blank', 'width=1200,height=900')
  if (!win) return

  const content = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          .subtitle { margin-bottom: 24px; color: #6b7280; font-size: 13px; }
          h2 { margin-top: 28px; margin-bottom: 12px; font-size: 18px; }
          table { border-collapse: collapse; width: 100%; margin-top: 8px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f3f4f6; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .kpi-card { border: 1px solid #d1d5db; border-radius: 12px; padding: 12px; }
          .kpi-title { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
          .kpi-value { font-size: 18px; font-weight: 700; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
        ${sections.join('')}
      </body>
    </html>
  `

  win.document.open()
  win.document.write(content)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
  }, 400)
}

export function buildHtmlTable({ columns, rows }) {
  const head = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => `<td>${escapeHtml(String(col.value(row) ?? ''))}</td>`)
          .join('')}</tr>`
    )
    .join('')

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function escapeCsv(value) {
  const str = String(value ?? '')
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
