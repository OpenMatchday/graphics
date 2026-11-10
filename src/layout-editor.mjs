/**
 * Layout editor model (AC-3.2–3.10). Pure functions; no theme values.
 *
 * Safe-area insets follow SMPTE ST 2046-1:2009 for fixed-pixel displays:
 * action safe 93% (inset 0.035), title/graphics safe 90% (inset 0.05).
 * DOI: https://doi.org/10.5594/SMPTE.ST2046-1.2009
 */

export const SNAP_STEP = 0.01
export const NUDGE_FINE = 0.0025
export const NUDGE_COARSE = 0.01
export const ACTION_SAFE_INSET = 0.035
export const TITLE_SAFE_INSET = 0.05
export const DEFAULT_ASPECT_LOCK = true

export const ANCHORS = Object.freeze([
  "top_left",
  "top_center",
  "top_right",
  "center_left",
  "center",
  "center_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
])

export const ASPECTS = Object.freeze(["16:9", "9:16", "1:1"])

const clamp01 = (n) => Math.min(1, Math.max(0, n))

const round4 = (n) => Math.round(n * 10000) / 10000

const clone = (value) => structuredClone(value)

const snapValue = (n, enabled) => {
  if (!enabled) {
    return round4(n)
  }
  return round4(Math.round(n / SNAP_STEP) * SNAP_STEP)
}

export const createItem = ({
  item_id,
  kind = "scoreboard",
  anchor = "top_left",
  x = 0.02,
  y = 0.02,
  w = 0.28,
  h = 0.12,
  z = 1,
  aspect_lock = DEFAULT_ASPECT_LOCK,
  scoreboard_source,
  template_id,
} = {}) => {
  const item = {
    item_id,
    kind,
    anchor,
    x: clamp01(x),
    y: clamp01(y),
    w: clamp01(w),
    h: clamp01(h),
    z: Math.max(0, Math.trunc(z)),
    aspect_lock: Boolean(aspect_lock),
  }
  if (template_id) {
    item.template_id = template_id
  }
  if (kind === "scoreboard") {
    item.scoreboard_source = scoreboard_source ?? { mode: "graphic" }
  }
  return item
}

export const createLayoutDocument = ({
  layout_id,
  output_id,
  aspect,
  state = "draft",
  items = [],
  preset_name,
  scene_id,
} = {}) => {
  if (!ASPECTS.includes(aspect)) {
    throw new Error(`unsupported aspect ${aspect}`)
  }
  if (state !== "draft" && state !== "applied") {
    throw new Error(`invalid layout state ${state}`)
  }
  const doc = {
    layout_id,
    aspect,
    state,
    items: items.map((item) => clone(item)),
  }
  if (output_id) {
    doc.output_id = output_id
  }
  if (preset_name) {
    doc.preset_name = preset_name
  }
  if (scene_id) {
    doc.scene_id = scene_id
  }
  return doc
}

/** AC-3.2: each output owns a layout; optional shared scene link. */
export const createOutputBinding = ({
  output_id,
  aspect,
  layout_id,
  scene_id,
  items,
} = {}) => {
  const draft = createLayoutDocument({
    layout_id,
    output_id,
    aspect,
    state: "draft",
    items:
      items ??
      [
        createItem({
          item_id: `${layout_id}-scoreboard`,
          kind: "scoreboard",
        }),
      ],
    scene_id,
  })
  return {
    output_id,
    aspect,
    draft,
    applied: null,
  }
}

/**
 * AC-3.2: independent edit requires explicit copy (clears scene_id).
 * Never silently forks a linked scene.
 */
export const explicitCopyFromScene = (layout, sceneItems, { new_layout_id } = {}) => {
  if (!layout.scene_id) {
    throw new Error("layout is not linked to a shared scene")
  }
  const copied = createLayoutDocument({
    layout_id: new_layout_id ?? `${layout.layout_id}-copy`,
    output_id: layout.output_id,
    aspect: layout.aspect,
    state: "draft",
    items: (sceneItems ?? layout.items).map((item, index) =>
      createItem({
        ...item,
        item_id: `${new_layout_id ?? layout.layout_id}-item-${index + 1}`,
      })
    ),
  })
  return copied
}

export const linkSharedScene = (layout, scene_id) => {
  const next = clone(layout)
  next.scene_id = scene_id
  next.state = "draft"
  return next
}

export const findItem = (layout, itemId) =>
  layout.items.find((item) => item.item_id === itemId)

const replaceItem = (layout, itemId, updater) => {
  const next = clone(layout)
  next.state = "draft"
  const index = next.items.findIndex((item) => item.item_id === itemId)
  if (index < 0) {
    throw new Error(`item not found: ${itemId}`)
  }
  next.items[index] = updater(next.items[index])
  return next
}

/** AC-3.4: free drag within the output frame (normalized). */
export const moveItem = (layout, itemId, { x, y }, { snap = true } = {}) => {
  return replaceItem(layout, itemId, (item) => {
    const next = clone(item)
    next.x = clamp01(snapValue(x, snap))
    next.y = clamp01(snapValue(y, snap))
    const maxX = 1 - next.w
    const maxY = 1 - next.h
    next.x = clamp01(Math.min(next.x, maxX))
    next.y = clamp01(Math.min(next.y, maxY))
    return next
  })
}

/**
 * AC-3.5: resize via handles or numeric fields.
 * Aspect lock is on by default; unlock must be explicit.
 */
export const resizeItem = (
  layout,
  itemId,
  { w, h },
  { snap = true, respectAspectLock = true } = {}
) => {
  return replaceItem(layout, itemId, (item) => {
    const next = clone(item)
    let nextW = w ?? next.w
    let nextH = h ?? next.h
    if (respectAspectLock && next.aspect_lock && next.w > 0) {
      const ratio = next.h / next.w
      if (w != null && h == null) {
        nextW = w
        nextH = w * ratio
      } else if (h != null && w == null) {
        nextH = h
        nextW = h / ratio
      } else if (w != null && h != null) {
        nextW = w
        nextH = w * ratio
      }
    }
    next.w = clamp01(snapValue(nextW, snap))
    next.h = clamp01(snapValue(nextH, snap))
    if (next.x + next.w > 1) {
      next.x = clamp01(1 - next.w)
    }
    if (next.y + next.h > 1) {
      next.y = clamp01(1 - next.h)
    }
    return next
  })
}

export const setAspectLock = (layout, itemId, locked) =>
  replaceItem(layout, itemId, (item) => {
    const next = clone(item)
    next.aspect_lock = Boolean(locked)
    return next
  })

export const setAnchor = (layout, itemId, anchor) => {
  if (!ANCHORS.includes(anchor)) {
    throw new Error(`invalid anchor ${anchor}`)
  }
  return replaceItem(layout, itemId, (item) => {
    const next = clone(item)
    next.anchor = anchor
    return next
  })
}

export const setZOrder = (layout, itemId, z) =>
  replaceItem(layout, itemId, (item) => {
    const next = clone(item)
    next.z = Math.max(0, Math.trunc(z))
    return next
  })

/** AC-3.6: snap selected edges to SNAP_STEP grid. */
export const snapItem = (layout, itemId) =>
  replaceItem(layout, itemId, (item) => {
    const next = clone(item)
    next.x = clamp01(snapValue(next.x, true))
    next.y = clamp01(snapValue(next.y, true))
    next.w = clamp01(snapValue(next.w, true))
    next.h = clamp01(snapValue(next.h, true))
    return next
  })

export const safeAreaGuides = () =>
  Object.freeze({
    action: Object.freeze({
      inset: ACTION_SAFE_INSET,
      size: 1 - ACTION_SAFE_INSET * 2,
      standard: "SMPTE ST 2046-1:2009 action safe 93%",
    }),
    title: Object.freeze({
      inset: TITLE_SAFE_INSET,
      size: 1 - TITLE_SAFE_INSET * 2,
      standard: "SMPTE ST 2046-1:2009 title/graphics safe 90%",
    }),
  })

/** AC-3.7: keyboard nudge by fine or coarse step. */
export const nudgeItem = (
  layout,
  itemId,
  { dx = 0, dy = 0, coarse = false } = {}
) => {
  const step = coarse ? NUDGE_COARSE : NUDGE_FINE
  const item = findItem(layout, itemId)
  if (!item) {
    throw new Error(`item not found: ${itemId}`)
  }
  return moveItem(
    layout,
    itemId,
    { x: item.x + dx * step, y: item.y + dy * step },
    { snap: false }
  )
}

/** AC-3.9: draft never reaches air until apply. */
export const applyLayout = (draft) => {
  if (draft.state !== "draft") {
    throw new Error("only draft layouts can be applied")
  }
  const applied = clone(draft)
  applied.state = "applied"
  return applied
}

export const discardDraftTowardApplied = (applied) => {
  if (!applied || applied.state !== "applied") {
    throw new Error("no applied layout to restore")
  }
  const draft = clone(applied)
  draft.state = "draft"
  return draft
}

/** AC-3.8: presets are per output aspect. */
export const savePreset = (layout, name) => {
  if (!name || typeof name !== "string") {
    throw new Error("preset name required")
  }
  const preset = clone(layout)
  preset.state = "draft"
  preset.preset_name = name
  delete preset.scene_id
  return preset
}

export const applyPreset = (current, preset) => {
  if (preset.aspect !== current.aspect) {
    throw new Error(
      `preset aspect ${preset.aspect} does not match output aspect ${current.aspect}`
    )
  }
  return createLayoutDocument({
    layout_id: current.layout_id,
    output_id: current.output_id,
    aspect: current.aspect,
    state: "draft",
    items: preset.items.map((item) => clone(item)),
    preset_name: preset.preset_name,
  })
}

/** AC-3.10: scoreboard source is graphic or live_crop. */
export const setScoreboardSource = (layout, itemId, mode, crop_region_id) => {
  if (mode !== "graphic" && mode !== "live_crop") {
    throw new Error(`invalid scoreboard source mode ${mode}`)
  }
  return replaceItem(layout, itemId, (item) => {
    if (item.kind !== "scoreboard") {
      throw new Error("scoreboard_source only applies to scoreboard items")
    }
    const next = clone(item)
    next.scoreboard_source = { mode }
    if (mode === "live_crop") {
      if (!crop_region_id) {
        throw new Error("live_crop requires crop_region_id")
      }
      next.scoreboard_source.crop_region_id = crop_region_id
    }
    return next
  })
}

export class LayoutHistory {
  constructor(initial) {
    this._undo = []
    this._redo = []
    this.current = clone(initial)
  }

  commit(next) {
    this._undo.push(clone(this.current))
    this.current = clone(next)
    this._redo = []
    return this.current
  }

  undo() {
    if (this._undo.length === 0) {
      return this.current
    }
    this._redo.push(clone(this.current))
    this.current = this._undo.pop()
    return this.current
  }

  redo() {
    if (this._redo.length === 0) {
      return this.current
    }
    this._undo.push(clone(this.current))
    this.current = this._redo.pop()
    return this.current
  }

  get canUndo() {
    return this._undo.length > 0
  }

  get canRedo() {
    return this._redo.length > 0
  }
}
