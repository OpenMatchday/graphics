import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { renderSceneSvg, DEFAULT_TOKENS } from "../src/render.mjs"
import { loadTemplateByKind } from "../src/templates.mjs"

const baseInput = () => {
  const template = loadTemplateByKind("scorebug")
  return {
    graphics_version: "0.1.0",
    width: 1280,
    height: 720,
    aspect: "16:9",
    resolution_label: "720p",
    reduced_motion: true,
    scene: {
      scene_id: "scene-a",
      name: "a",
      aspect: "16:9",
      instances: [
        {
          instance_id: "inst-1",
          template_id: template.template_id,
          template_kind: "scorebug",
          anchor: "top_left",
          x: 0.05,
          y: 0.05,
          w: 0.4,
          h: 0.12,
          z: 2,
          bindings: {
            home_name: "Home",
            away_name: "Away",
            home_score: "1",
            away_score: "0",
          },
        },
        {
          instance_id: "inst-0",
          template_id: template.template_id,
          template_kind: "scorebug",
          anchor: "top_left",
          x: 0.05,
          y: 0.2,
          w: 0.4,
          h: 0.12,
          z: 1,
          bindings: {
            home_name: "A",
            away_name: "B",
            home_score: "0",
            away_score: "0",
          },
        },
      ],
    },
    templates: [template],
    tokens: { ...DEFAULT_TOKENS },
  }
}

describe("deterministic renderer", () => {
  it("is byte-stable for identical input", () => {
    const a = renderSceneSvg(baseInput())
    const b = renderSceneSvg(baseInput())
    assert.equal(a, b)
  })

  it("orders instances by z then instance_id", () => {
    const svg = renderSceneSvg(baseInput())
    const first = svg.indexOf('data-instance="inst-0"')
    const second = svg.indexOf('data-instance="inst-1"')
    assert.ok(first > 0 && second > first)
  })

  it("escapes XML in bindings", () => {
    const input = baseInput()
    input.scene.instances = [input.scene.instances[0]]
    input.scene.instances[0].bindings.home_name = `A&B<"'>`
    const svg = renderSceneSvg(input)
    assert.match(svg, /A&amp;B&lt;&quot;&apos;&gt;/)
  })

  it("marks reduced motion by default", () => {
    const svg = renderSceneSvg(baseInput())
    assert.match(svg, /data-motion="reduced"/)
  })
})
