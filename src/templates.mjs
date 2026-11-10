import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "templates")

export const loadShippedTemplates = () => {
  const names = readdirSync(templatesDir)
    .filter((n) => n.endsWith(".json"))
    .sort()
  return names.map((name) =>
    JSON.parse(readFileSync(join(templatesDir, name), "utf8"))
  )
}

export const loadTemplateByKind = (kind) => {
  const all = loadShippedTemplates()
  const found = all.find((t) => t.kind === kind)
  if (!found) {
    throw new Error(`no shipped template for kind ${kind}`)
  }
  return found
}

export const TEMPLATE_KINDS = Object.freeze([
  "scorebug",
  "clocks",
  "lineups",
  "lower_thirds",
  "substitutions",
  "summaries",
  "sponsor_panels",
  "social_cards",
])
