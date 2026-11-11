import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { TEMPLATE_KINDS } from "../src/templates.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const contract = JSON.parse(
  readFileSync(join(root, "contracts", "social-export.v0.json"), "utf8")
)

describe("social export contract", () => {
  it("pins social_cards graphics kind already shipped", () => {
    assert.equal(contract.graphics_kind, "social_cards")
    assert.ok(TEMPLATE_KINDS.includes("social_cards"))
  })

  it("lists AC-11.3 social template kinds and bans engagement fields", () => {
    assert.deepEqual(contract.social_template_kinds.sort(), [
      "announcement",
      "clip",
      "lineup",
      "result",
      "score",
    ])
    assert.ok(contract.banned_fields.includes("likes"))
    assert.ok(contract.banned_fields.includes("engagement_rate"))
    assert.deepEqual(new Set(contract.supported_aspects), new Set(["16:9", "9:16", "1:1"]))
  })
})
