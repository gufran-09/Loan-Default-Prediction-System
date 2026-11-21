/**
 * CSV Generation & Institutional Export Utilities
 * Provides sanitized, RFC 4180-compliant CSV generation and browser download helpers.
 */

function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '""'
  }
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

export function generateCsvContent(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  return [headerLine, ...rowLines].join('\r\n')
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportDataToCsv(filename: string, items: Record<string, any>[]): void {
  if (!items || items.length === 0) return
  const headers = Object.keys(items[0])
  const rows = items.map((item) => headers.map((key) => item[key]))
  const csv = generateCsvContent(headers, rows)
  downloadCsvFile(filename, csv)
}

export function parseCsvText(csvText: string): Record<string, any>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length < 2) return []

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const rawHeaders = parseLine(lines[0])
  const cleanHeaders = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim())

  const items: Record<string, any>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (values.length === 0) continue
    const obj: Record<string, any> = {}
    cleanHeaders.forEach((h, idx) => {
      let val: any = values[idx] ?? ''
      val = val.replace(/^["']|["']$/g, '').trim()
      if (val === 'true') val = true
      else if (val === 'false') val = false
      else if (val !== '' && !isNaN(Number(val))) val = Number(val)
      obj[h] = val
    })
    items.push(obj)
  }
  return items
}

export function getSampleBatchCsv(): string {
  const headers = [
    'fullName',
    'loanAmount',
    'monthlyIncome',
    'creditScore',
    'tenureMonths',
    'employmentStatus',
    'loanType',
    'maritalStatus',
    'collateralType',
    'collateralValue',
    'existingCreditCardDebt',
    'delinquencyCount12m',
    'creditUtilization',
    'numInquiries6m',
    'priorDefaults',
    'education',
    'numCreditLines',
    'interestRate',
    'hasMortgage',
    'hasDependents',
    'hasCosigner',
  ]

  const rows = [
    [
      'Eleanor Vance',
      45000,
      8200,
      740,
      36,
      'Full-time',
      'Debt Consolidation',
      'married',
      'real_estate',
      60000,
      1200,
      0,
      22,
      0,
      0,
      "Bachelor's",
      5,
      7.5,
      true,
      true,
      false,
    ],
    [
      'Marcus Aurelius King',
      18000,
      4100,
      610,
      24,
      'Self-Employed',
      'Small Business',
      'single',
      'vehicle',
      12000,
      4800,
      1,
      68,
      3,
      0,
      'High School',
      3,
      14.2,
      false,
      false,
      true,
    ],
    [
      'Sophia Chen',
      75000,
      14500,
      790,
      48,
      'Full-time',
      'Home Improvement',
      'married',
      'securities',
      90000,
      500,
      0,
      12,
      0,
      0,
      "Master's",
      8,
      6.2,
      true,
      true,
      false,
    ],
    [
      'Devon Miller',
      12000,
      2800,
      540,
      18,
      'Part-time',
      'Personal',
      'single',
      'none',
      0,
      6200,
      2,
      88,
      5,
      1,
      'High School',
      2,
      21.5,
      false,
      false,
      false,
    ],
  ]

  return generateCsvContent(headers, rows)
}
