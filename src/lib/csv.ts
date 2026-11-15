// CSV na tama ang ñ sa Excel (may BOM) at hindi nasisira kapag may comma o quote.

const escapeCell = (value: unknown) => {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsvRow = (cells: unknown[]) => cells.map(escapeCell).join(',')

export function downloadCsv(fileName: string, rows: unknown[][]) {
  const content = '﻿' + rows.map(toCsvRow).join('\r\n') + '\r\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
