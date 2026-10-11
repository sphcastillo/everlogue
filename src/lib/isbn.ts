/** Canonical ISBN identity. ISBN-10 and its 978 equivalent identify one edition. */
export function normalizeIsbn(value: string): string | undefined {
  const isbn = value.replace(/[\s-]/g, '').toUpperCase()
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, index) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0)
    if (sum % 11) return undefined
    const body = `978${isbn.slice(0, 9)}`
    const checksum = [...body].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0)
    return `${body}${(10 - checksum % 10) % 10}`
  }
  if (!/^97[89]\d{10}$/.test(isbn)) return undefined
  const sum = [...isbn].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0)
  return sum % 10 === 0 ? isbn : undefined
}

export function isbn10For(value: string): string | undefined {
  const isbn = normalizeIsbn(value)
  if (!isbn?.startsWith('978')) return undefined
  const body = isbn.slice(3, 12)
  const sum = [...body].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0)
  const check = (11 - sum % 11) % 11
  return `${body}${check === 10 ? 'X' : check}`
}
