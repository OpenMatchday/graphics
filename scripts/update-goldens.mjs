import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { rootDir } from "./lib/load-ajv.mjs"
import { RESOLUTION_MATRIX, goldenName } from "../src/resolutions.mjs"
import { renderSceneSvg, DEFAULT_TOKENS } from "../src/render.mjs"
import { loadTemplateByKind, TEMPLATE_KINDS } from "../src/templates.mjs"

const bindings = JSON.parse(
  readFileSync(join(rootDir, "fixtures", "bindings", "sample.json"), "utf8")
)
const outDir = join(rootDir, "goldens")
mkdirSync(outDir, { recursive: true })

let count = 0
for (const kind of TEMPLATE_KINDS) {
  const template = loadTemplateByKind(kind)
  for (const cell of RESOLUTION_MATRIX) {
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
    const svg = renderSceneSvg({
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
    const name = goldenName(kind, cell.aspect, cell.resolution_label)
    writeFileSync(join(outDir, name), svg, "utf8")
    count += 1
  }
}

console.log(`GOLDENS_UPDATED count=${count} dir=${outDir}`)
