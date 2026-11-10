export const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")

export const formatNumber = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    throw new Error(`non-finite number: ${value}`)
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, "")
}
