import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  fieldViewport,
  focalCropPlacement,
  formationPointToPx,
  renderLineupSvg,
  resolveLineupMotion,
} from "../src/lineup.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const workspace = join(here, "..", "..")
const basketballField = JSON.parse(
  readFileSync(join(workspace, "sports", "packages", "basketball", "field.json"), "utf8")
)
const basketballFormations = JSON.parse(
  readFileSync(join(workspace, "sports", "packages", "basketball", "formations.json"), "utf8")
)
const basketballAnimations = JSON.parse(
  readFileSync(join(workspace, "sports", "packages", "basketball", "animations.json"), "utf8")
)
const futsalField = JSON.parse(
  readFileSync(join(workspace, "sports", "packages", "futsal", "field.json"), "utf8")
)
const futsalFormations = JSON.parse(
  readFileSync(join(workspace, "sports", "packages", "futsal", "formations.json"), "utf8")
)
const futsalRoster = JSON.parse(
  readFileSync(join(workspace, "sports", "packages", "futsal", "roster.json"), "utf8")
)

const basketballFormation = basketballFormations.formations.find((f) => f.id === "starting_five")
const futsalFormation = futsalFormations.formations.find((f) => f.id === "standard_4_1")

describe("lineup geometry AC-7.1", () => {
  it("maps formation slots onto FIBA court meters", () => {
    assert.equal(basketballField.length, 28)
    assert.equal(basketballField.width, 15)
    assert.equal(basketballField.surface, "court")
    const vp = fieldViewport(basketballField, { x: 0, y: 0, w: 280, h: 150 })
    const pt = formationPointToPx(vp, 0.5, 0.5)
    assert.equal(pt.x, 140)
    assert.equal(pt.y, 75)
  })

  it("renders basketball lineup on court markings", () => {
    const svg = renderLineupSvg({
      width: 1280,
      height: 720,
      field: basketballField,
      formation: basketballFormation,
      team_name: "North Harbor Foxes",
      starters: basketballFormation.slots.map((slot, i) => ({
        player_id: `p${i}`,
        name: `Player ${i}`,
        number: i + 1,
        position_id: slot.position_id,
        position_label: slot.position_id,
        is_captain: i === 0,
      })),
      substitutes: [
        { player_id: "bench1", name: "Bench One", number: 10, position_id: "point_guard" },
      ],
      animations: basketballAnimations,
      reduced_motion: true,
      motion_phase: "entry",
    })
    assert.match(svg, /data-surface="court"/)
    assert.match(svg, /data-marking="boundary"/)
    assert.match(svg, /data-role="starter"/)
    assert.match(svg, /data-role="substitute"/)
    assert.match(svg, /data-marker="captain"/)
    assert.equal(svg, renderLineupSvg({
      width: 1280,
      height: 720,
      field: basketballField,
      formation: basketballFormation,
      team_name: "North Harbor Foxes",
      starters: basketballFormation.slots.map((slot, i) => ({
        player_id: `p${i}`,
        name: `Player ${i}`,
        number: i + 1,
        position_id: slot.position_id,
        position_label: slot.position_id,
        is_captain: i === 0,
      })),
      substitutes: [
        { player_id: "bench1", name: "Bench One", number: 10, position_id: "point_guard" },
      ],
      animations: basketballAnimations,
      reduced_motion: true,
      motion_phase: "entry",
    }))
  })

  it("renders futsal lineup on pitch with goalkeeper marker", () => {
    assert.equal(futsalField.surface, "pitch")
    const gk = futsalRoster.positions.find((p) => p.id === "goalkeeper")
    assert.ok(gk.markers.includes("goalkeeper"))
    const svg = renderLineupSvg({
      width: 1280,
      height: 720,
      field: futsalField,
      formation: futsalFormation,
      team_name: "Cedar Ridge Owls",
      starters: futsalFormation.slots.map((slot, i) => ({
        player_id: `f${i}`,
        name: `Futsal ${i}`,
        number: i + 1,
        position_id: slot.position_id,
        markers: slot.position_id === "goalkeeper" ? ["goalkeeper"] : [],
      })),
      substitutes: [],
      reduced_motion: true,
    })
    assert.match(svg, /data-surface="pitch"/)
    assert.match(svg, /data-marker="goalkeeper"/)
  })
})

describe("photos and fallbacks AC-7.2", () => {
  it("applies focal-point crop attributes", () => {
    const place = focalCropPlacement({
      focalX: 0.2,
      focalY: 0.8,
      cx: 100,
      cy: 100,
      size: 40,
    })
    assert.equal(place.x, 100 - 0.2 * 40)
    assert.equal(place.y, 100 - 0.8 * 40)
    const svg = renderLineupSvg({
      width: 640,
      height: 360,
      field: basketballField,
      formation: basketballFormation,
      team_name: "Foxes",
      starters: [
        {
          player_id: "alex",
          name: "Alex Rivera",
          number: 7,
          position_id: "point_guard",
          photo: {
            href: "photos/alex_rivera.png",
            focal_x: 0.2,
            focal_y: 0.8,
          },
        },
        ...basketballFormation.slots.slice(1).map((slot, i) => ({
          player_id: `p${i + 1}`,
          name: `P${i + 1}`,
          number: i + 2,
          position_id: slot.position_id,
        })),
      ],
      substitutes: [],
      reduced_motion: true,
      motion_phase: "static",
    })
    assert.match(svg, /data-photo="true"/)
    assert.match(svg, /data-focal-x="0\.2"/)
    assert.match(svg, /data-focal-y="0\.8"/)
    assert.match(svg, /data-photo-fallback="true"/)
  })
})

describe("starters vs substitutes AC-7.4", () => {
  it("marks roles distinctly", () => {
    const svg = renderLineupSvg({
      width: 640,
      height: 360,
      field: basketballField,
      formation: basketballFormation,
      team_name: "Foxes",
      starters: basketballFormation.slots.map((slot, i) => ({
        player_id: `s${i}`,
        name: `S${i}`,
        number: i + 1,
        position_id: slot.position_id,
      })),
      substitutes: [
        { player_id: "sub_a", name: "Sub A", number: 20, position_id: "center" },
      ],
      reduced_motion: true,
      motion_phase: "static",
    })
    assert.match(svg, /data-role="starter"/)
    assert.match(svg, /data-role="substitute"/)
    assert.match(svg, /data-role="bench"/)
  })
})

describe("reduced motion AC-7.5", () => {
  it("uses sports package reduced_motion cut for entry", () => {
    const motion = resolveLineupMotion(basketballAnimations, "entry", true)
    assert.equal(motion.reduced, true)
    assert.equal(motion.mode, "cut")
    assert.equal(motion.duration_ms, 0)
    const svg = renderLineupSvg({
      width: 640,
      height: 360,
      field: basketballField,
      formation: basketballFormation,
      team_name: "Foxes",
      starters: basketballFormation.slots.map((slot, i) => ({
        player_id: `s${i}`,
        name: `S${i}`,
        number: i + 1,
        position_id: slot.position_id,
      })),
      substitutes: [],
      animations: basketballAnimations,
      reduced_motion: true,
      motion_phase: "entry",
    })
    assert.match(svg, /data-motion="reduced"/)
    assert.match(svg, /data-motion-mode="cut"/)
    assert.doesNotMatch(svg, /<animateTransform/)
  })

  it("emits slide motion when reduced_motion is false", () => {
    const svg = renderLineupSvg({
      width: 640,
      height: 360,
      field: basketballField,
      formation: basketballFormation,
      team_name: "Foxes",
      starters: basketballFormation.slots.map((slot, i) => ({
        player_id: `s${i}`,
        name: `S${i}`,
        number: i + 1,
        position_id: slot.position_id,
      })),
      substitutes: [],
      animations: basketballAnimations,
      reduced_motion: false,
      motion_phase: "entry",
    })
    assert.match(svg, /data-motion="allowed"/)
    assert.match(svg, /<animateTransform/)
  })
})
