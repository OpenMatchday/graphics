import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
  GRAPHICS_VERSION,
  PROTOCOL_VERSION_PIN,
  createAjv,
  loadSchemaFiles,
  loadCatalog,
  rootDir,
  SCHEMA_ORDER,
} from "./lib/load-ajv.mjs"
import { loadShippedTemplates, TEMPLATE_KINDS } from "../src/templates.mjs"

const versionFile = readFileSync(join(rootDir, "VERSION"), "utf8").trim()
if (versionFile !== GRAPHICS_VERSION) {
  throw new Error(`VERSION ${versionFile} != graphics const ${GRAPHICS_VERSION}`)
}

const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"))
if (pkg.version !== GRAPHICS_VERSION) {
  throw new Error(`package.json version ${pkg.version} != ${GRAPHICS_VERSION}`)
}

const files = loadSchemaFiles()
for (const { name, schema } of files) {
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error(`${name}: expected draft/2020-12 $schema`)
  }
  if (schema.$id !== name) {
    throw new Error(`${name}: $id must equal filename`)
  }
}

const ajv = createAjv()
for (const name of SCHEMA_ORDER) {
  if (name === "common.json") {
    continue
  }
  if (!ajv.getSchema(name)) {
    throw new Error(`failed to compile ${name}`)
  }
}

const catalog = loadCatalog()
if (catalog.graphics_version !== GRAPHICS_VERSION) {
  throw new Error("catalog graphics_version mismatch")
}
if (catalog.protocol_version_pin !== PROTOCOL_VERSION_PIN) {
  throw new Error("catalog protocol_version_pin mismatch")
}
if (JSON.stringify(catalog.schemas) !== JSON.stringify(SCHEMA_ORDER)) {
  throw new Error("catalog schemas list mismatch")
}

const validateTemplate = ajv.getSchema("template.json")
const templates = loadShippedTemplates()
if (templates.length !== TEMPLATE_KINDS.length) {
  throw new Error(
    `expected ${TEMPLATE_KINDS.length} shipped templates, got ${templates.length}`
  )
}
const kinds = new Set()
for (const template of templates) {
  if (!validateTemplate(template)) {
    throw new Error(
      `template ${template.template_id}: ${ajv.errorsText(validateTemplate.errors)}`
    )
  }
  if (kinds.has(template.kind)) {
    throw new Error(`duplicate template kind ${template.kind}`)
  }
  kinds.add(template.kind)
}
for (const kind of TEMPLATE_KINDS) {
  if (!kinds.has(kind)) {
    throw new Error(`missing shipped template kind ${kind}`)
  }
}

const validateScene = ajv.getSchema("scene.json")
for (const bucket of ["valid", "invalid"]) {
  const dir = join(rootDir, "fixtures", bucket, "scene")
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(join(dir, name), "utf8"))
    const ok = validateScene(data)
    if (bucket === "valid" && !ok) {
      throw new Error(
        `expected valid scene ${name}: ${ajv.errorsText(validateScene.errors)}`
      )
    }
    if (bucket === "invalid" && ok) {
      throw new Error(`expected invalid scene ${name}`)
    }
  }
}

console.log(
  `SCHEMA_CHECK_OK graphics_version=${GRAPHICS_VERSION} protocol_pin=${PROTOCOL_VERSION_PIN} templates=${templates.length}`
)
