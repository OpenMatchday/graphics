import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { rootDir } from "../scripts/lib/load-ajv.mjs"
import { RESOLUTION_MATRIX, goldenName } from "../src/resolutions.mjs"
import { renderSceneSvg, DEFAULT_TOKENS } from "../src/render.mjs"
import { loadTemplateByKind, TEMPLATE_KINDS } from "../src/templates.mjs"

const bindings = JSON.parse(
  readFileSync(join(rootDir, "fixtures", "bindings", "sample.json"), "utf8")
)
const goldensDir = join(rootDir, "goldens")

describe("golden harness AC-8.1 matrix", () => {
  it("covers 8 kinds x 3 labels x 3 aspects", () => {
    assert.equal(TEMPLATE_KINDS.length, 8)
    assert.equal(RESOLUTION_MATRIX.length, 9)
  })

  for (const kind of TEMPLATE_KINDS) {
    for (const cell of RESOLUTION_MATRIX) {
      const name = goldenName(kind, cell.aspect, cell.resolution_label)
      it(`matches golden ${name}`, () => {
        const template = loadTemplateByKind(kind)
        const scene = {
          scene_id: `scene-${kind}`,
          name: `${kind}-golden`,
          aspect: cell.aspect,
          instances: [
            {
              instance_id: "inst-1",
              template_id: template.template_id,
              template_kind: kind,
              anchor: "top_left",
              x: 0.05,
              y: 0.05,
              w: 0.9,
              h: 0.25,
              z: 1,
              bindings: bindings[kind],
            },
          ],
        }
        const actual = renderSceneSvg({
          graphics_version: "0.1.0",
          width: cell.width,
          height: cell.height,
          aspect: cell.aspect,
          resolution_label: cell.resolution_label,
          reduced_motion: true,
          scene,
          templates: [template],
          tokens: { ...DEFAULT_TOKENS },
        })
        const path = join(goldensDir, name)
        assert.equal(existsSync(path), true, `missing golden ${name}; run npm run goldens:update`)
        const expected = readFileSync(path, "utf8")
        assert.equal(actual, expected)
        assert.match(actual, new RegExp(`width="${cell.width}"`))
        assert.match(actual, new RegExp(`height="${cell.height}"`))
      })
    }
  }
})
