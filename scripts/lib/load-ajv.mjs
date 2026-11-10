import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const schemasDir = join(root, "schemas", "v0")
export const GRAPHICS_VERSION = "0.1.0"
export const PROTOCOL_VERSION_PIN = "0.1.0"

export const SCHEMA_ORDER = [
  "common.json",
  "template.json",
  "scene.json",
  "render-input.json",
]

export const loadSchemaFiles = () => {
  const files = readdirSync(schemasDir).filter((name) => name.endsWith(".json"))
  const missing = SCHEMA_ORDER.filter((name) => !files.includes(name))
  if (missing.length > 0) {
    throw new Error(`missing schema files: ${missing.join(", ")}`)
  }
  const extra = files.filter((name) => !SCHEMA_ORDER.includes(name))
  if (extra.length > 0) {
    throw new Error(`unexpected schema files: ${extra.join(", ")}`)
  }
  return SCHEMA_ORDER.map((name) => ({
    name,
    schema: JSON.parse(readFileSync(join(schemasDir, name), "utf8")),
  }))
}

export const createAjv = () => {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
    validateSchema: true,
  })
  addFormats(ajv)
  for (const { schema } of loadSchemaFiles()) {
    ajv.addSchema(schema)
  }
  return ajv
}

export const rootDir = root

export const loadCatalog = () =>
  JSON.parse(readFileSync(join(root, "schemas", "catalog.json"), "utf8"))
