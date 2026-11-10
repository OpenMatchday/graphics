import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  ACTION_SAFE_INSET,
  DEFAULT_ASPECT_LOCK,
  LayoutHistory,
  TITLE_SAFE_INSET,
  applyLayout,
  applyPreset,
  createItem,
  createLayoutDocument,
  createOutputBinding,
  explicitCopyFromScene,
  linkSharedScene,
  moveItem,
  nudgeItem,
  resizeItem,
  safeAreaGuides,
  savePreset,
  setAnchor,
  setAspectLock,
  setScoreboardSource,
  setZOrder,
  snapItem,
} from "../src/layout-editor.mjs"
import {
  layoutToScene,
  renderLayoutPreview,
} from "../src/layout-compose.mjs"

const sampleLayout = () =>
  createLayoutDocument({
    layout_id: "layout-main",
    output_id: "out-16x9",
    aspect: "16:9",
    state: "draft",
    items: [
      createItem({
        item_id: "item-scoreboard",
        kind: "scoreboard",
        x: 0.02,
        y: 0.02,
        w: 0.28,
        h: 0.12,
        z: 10,
      }),
    ],
  })

describe("layout editor model AC-3.2–3.10", () => {
  it("gives each output its own layout and supports shared scene link", () => {
    const a = createOutputBinding({
      output_id: "out-a",
      aspect: "16:9",
      layout_id: "layout-a",
      scene_id: "scene-shared",
    })
    const b = createOutputBinding({
      output_id: "out-b",
      aspect: "9:16",
      layout_id: "layout-b",
    })
    assert.equal(a.draft.output_id, "out-a")
    assert.equal(b.draft.output_id, "out-b")
    assert.notEqual(a.draft.layout_id, b.draft.layout_id)
    assert.equal(a.draft.scene_id, "scene-shared")
    assert.equal(b.draft.scene_id, undefined)
  })

  it("requires explicit copy to fork a linked scene (never silent)", () => {
    const linked = linkSharedScene(sampleLayout(), "scene-shared")
    assert.equal(linked.scene_id, "scene-shared")
    const independent = explicitCopyFromScene(linked, linked.items, {
      new_layout_id: "layout-fork",
    })
    assert.equal(independent.scene_id, undefined)
    assert.equal(independent.layout_id, "layout-fork")
    assert.equal(independent.state, "draft")
    assert.notEqual(independent.items[0].item_id, linked.items[0].item_id)
  })

  it("moves scoreboard freely inside the frame", () => {
    const moved = moveItem(sampleLayout(), "item-scoreboard", {
      x: 0.4,
      y: 0.5,
    })
    assert.equal(moved.items[0].x, 0.4)
    assert.equal(moved.items[0].y, 0.5)
    const clamped = moveItem(sampleLayout(), "item-scoreboard", {
      x: 0.95,
      y: 0.95,
    })
    assert.ok(clamped.items[0].x + clamped.items[0].w <= 1.0001)
    assert.ok(clamped.items[0].y + clamped.items[0].h <= 1.0001)
  })

  it("resizes with aspect lock default and numeric unlock path", () => {
    const layout = sampleLayout()
    assert.equal(layout.items[0].aspect_lock, DEFAULT_ASPECT_LOCK)
    const locked = resizeItem(
      layout,
      "item-scoreboard",
      { w: 0.4 },
      { snap: false }
    )
    const ratio = layout.items[0].h / layout.items[0].w
    const expectedH = Math.round(locked.items[0].w * ratio * 10000) / 10000
    assert.equal(locked.items[0].h, expectedH)

    const unlocked = setAspectLock(layout, "item-scoreboard", false)
    const free = resizeItem(
      unlocked,
      "item-scoreboard",
      { w: 0.4, h: 0.2 },
      { snap: false }
    )
    assert.equal(free.items[0].w, 0.4)
    assert.equal(free.items[0].h, 0.2)
    assert.equal(free.items[0].aspect_lock, false)
  })

  it("supports anchor, z-order, snap, and SMPTE safe-area guides", () => {
    let layout = setAnchor(sampleLayout(), "item-scoreboard", "bottom_right")
    layout = setZOrder(layout, "item-scoreboard", 42)
    layout = moveItem(
      layout,
      "item-scoreboard",
      { x: 0.1234, y: 0.5678 },
      { snap: false }
    )
    layout = snapItem(layout, "item-scoreboard")
    assert.equal(layout.items[0].anchor, "bottom_right")
    assert.equal(layout.items[0].z, 42)
    assert.equal(layout.items[0].x, 0.12)
    assert.equal(layout.items[0].y, 0.57)

    const guides = safeAreaGuides()
    assert.equal(guides.action.inset, ACTION_SAFE_INSET)
    assert.equal(guides.title.inset, TITLE_SAFE_INSET)
    assert.match(guides.action.standard, /ST 2046-1/)
  })

  it("nudges with undo/redo history", () => {
    const history = new LayoutHistory(sampleLayout())
    history.commit(
      nudgeItem(history.current, "item-scoreboard", { dx: 1, dy: 0 })
    )
    const afterNudge = history.current.items[0].x
    assert.ok(afterNudge > 0.02)
    history.undo()
    assert.equal(history.current.items[0].x, 0.02)
    history.redo()
    assert.equal(history.current.items[0].x, afterNudge)
  })

  it("saves and applies presets per aspect only", () => {
    const layout = sampleLayout()
    const moved = moveItem(layout, "item-scoreboard", { x: 0.1, y: 0.1 })
    const preset = savePreset(moved, "top-bug")
    assert.equal(preset.preset_name, "top-bug")
    assert.equal(preset.aspect, "16:9")

    const other = createLayoutDocument({
      layout_id: "layout-portrait",
      output_id: "out-9x16",
      aspect: "9:16",
      items: [createItem({ item_id: "p1" })],
    })
    assert.throws(() => applyPreset(other, preset), /aspect/)

    const restored = applyPreset(layout, preset)
    assert.equal(restored.state, "draft")
    assert.equal(restored.items[0].x, 0.1)
    assert.equal(restored.preset_name, "top-bug")
  })

  it("keeps drafts off air until apply", () => {
    const draft = sampleLayout()
    assert.equal(draft.state, "draft")
    const applied = applyLayout(draft)
    assert.equal(applied.state, "applied")
    assert.equal(draft.state, "draft")
  })

  it("sets scoreboard source graphic or live_crop", () => {
    const graphic = setScoreboardSource(
      sampleLayout(),
      "item-scoreboard",
      "graphic"
    )
    assert.equal(graphic.items[0].scoreboard_source.mode, "graphic")

    const crop = setScoreboardSource(
      sampleLayout(),
      "item-scoreboard",
      "live_crop",
      "region-board-1"
    )
    assert.equal(crop.items[0].scoreboard_source.mode, "live_crop")
    assert.equal(crop.items[0].scoreboard_source.crop_region_id, "region-board-1")

    assert.throws(
      () =>
        setScoreboardSource(sampleLayout(), "item-scoreboard", "live_crop"),
      /crop_region_id/
    )
  })

  it("renders deterministic exact-output preview SVG", () => {
    const layout = sampleLayout()
    const scene = layoutToScene(layout)
    assert.equal(scene.aspect, "16:9")
    assert.equal(scene.instances.length, 1)
    assert.equal(scene.instances[0].template_kind, "scorebug")

    const a = renderLayoutPreview(layout, { resolution_label: "720p" })
    const b = renderLayoutPreview(layout, { resolution_label: "720p" })
    assert.equal(a, b)
    assert.match(a, /data-layout-state="draft"/)
    assert.match(a, /data-guide="action-safe"/)
    assert.match(a, /data-guide="title-safe"/)
    assert.match(a, /width="1280"/)
  })
})
