import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { rootDir } from "../scripts/lib/load-ajv.mjs"
import { loadShippedTemplates } from "../src/templates.mjs"

describe("theme token contract", () => {
  it("ships theme-tokens.v0 contract", () => {
    const contract = JSON.parse(
      readFileSync(join(rootDir, "contracts", "theme-tokens.v0.json"), "utf8")
    )
    assert.equal(contract.contract_version, "0.1.0")
    assert.equal(contract.graphics_version, "0.1.0")
  })

  it("templates only reference contract token keys", () => {
    const contract = JSON.parse(
      readFileSync(join(rootDir, "contracts", "theme-tokens.v0.json"), "utf8")
    )
    const allowed = new Set(contract.required_tokens.map((t) => t.key))
    for (const template of loadShippedTemplates()) {
      for (const region of template.layout.regions) {
        if (region.fill_token) {
          assert.ok(
            allowed.has(region.fill_token),
            `${template.kind} fill_token ${region.fill_token}`
          )
        }
        if (region.text_token) {
          assert.ok(
            allowed.has(region.text_token),
            `${template.kind} text_token ${region.text_token}`
          )
        }
      }
    }
  })
})
