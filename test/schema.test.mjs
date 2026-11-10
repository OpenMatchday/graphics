import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  GRAPHICS_VERSION,
  createAjv,
  rootDir,
  SCHEMA_ORDER,
} from "../scripts/lib/load-ajv.mjs"
import { loadShippedTemplates, TEMPLATE_KINDS } from "../src/templates.mjs"

describe("graphics schemas v0", () => {
  it("pins graphics version 0.1.0", () => {
    assert.equal(GRAPHICS_VERSION, "0.1.0")
    assert.equal(readFileSync(join(rootDir, "VERSION"), "utf8").trim(), "0.1.0")
  })

  it("compiles every schema", () => {
    const ajv = createAjv()
    for (const id of SCHEMA_ORDER) {
      if (id === "common.json") {
        continue
      }
      assert.ok(ajv.getSchema(id), id)
    }
  })

  it("validates all shipped AC-8.1 templates", () => {
    const ajv = createAjv()
    const validate = ajv.getSchema("template.json")
    const templates = loadShippedTemplates()
    assert.equal(templates.length, TEMPLATE_KINDS.length)
    for (const template of templates) {
      assert.equal(
        validate(template),
        true,
        `${template.kind}: ${ajv.errorsText(validate.errors)}`
      )
    }
  })

  it("rejects invalid scene fixture", () => {
    const ajv = createAjv()
    const validate = ajv.getSchema("scene.json")
    const bad = JSON.parse(
      readFileSync(
        join(rootDir, "fixtures", "invalid", "scene", "bad-aspect.json"),
        "utf8"
      )
    )
    assert.equal(validate(bad), false)
  })
})
