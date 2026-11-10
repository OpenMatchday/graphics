import { escapeXml, formatNumber } from "./escape.mjs"

const DEFAULT_TOKENS = Object.freeze({
  "color.panel": "#1A1A1A",
  "color.accent": "#C4C4C4",
  "color.text": "#F5F5F5",
  "color.field": "#1E3A2F",
  "color.marking": "#E8E8E8",
  "color.fallback": "#4A4A4A",
  "color.bench": "#242424",
  "color.marker": "#F0C040",
  "font.family": "sans-serif",
})

const resolveToken = (tokens, tokenRef, fallback) => {
  if (!tokenRef) {
    return fallback
  }
  return tokens[tokenRef] ?? DEFAULT_TOKENS[tokenRef] ?? fallback
}

/** Map sports package field meters into a pixel viewport. Length -> x, width -> y. */
export const fieldViewport = (field, box) => {
  const length = field.length
  const width = field.width
  if (!(length > 0) || !(width > 0)) {
    throw new Error("field length/width must be positive")
  }
  const scale = Math.min(box.w / length, box.h / width)
  const drawnW = length * scale
  const drawnH = width * scale
  const ox = box.x + (box.w - drawnW) / 2
  const oy = box.y + (box.h - drawnH) / 2
  return {
    ox,
    oy,
    scale,
    length,
    width,
    toPx: (metersX, metersY) => ({
      x: ox + metersX * scale,
      y: oy + metersY * scale,
    }),
  }
}

/** Formation x/y are normalized over field length/width (sports formations schema). */
export const formationPointToPx = (viewport, slotX, slotY) =>
  viewport.toPx(slotX * viewport.length, slotY * viewport.width)

export const resolveLineupMotion = (animations, phase, reducedMotion) => {
  const clips = animations?.clips ?? []
  const kind = phase === "exit" ? "exit" : phase === "entry" ? "entry" : null
  if (!kind) {
    return { phase: "static", duration_ms: 0, mode: "none", reduced: !!reducedMotion }
  }
  const clip = clips.find((c) => c.kind === kind) ?? null
  if (!clip) {
    return {
      phase: kind,
      duration_ms: reducedMotion ? 0 : 400,
      mode: reducedMotion ? "cut" : "slide",
      reduced: !!reducedMotion,
    }
  }
  if (reducedMotion) {
    return {
      phase: kind,
      duration_ms: clip.reduced_motion.duration_ms,
      mode: clip.reduced_motion.mode,
      reduced: true,
      clip_id: clip.id,
    }
  }
  return {
    phase: kind,
    duration_ms: clip.duration_ms,
    mode: "slide",
    reduced: false,
    clip_id: clip.id,
  }
}

/**
 * Focal-point cover crop into a square avatar (AC-7.2).
 * Photo unit square; focal_x/focal_y in [0,1] pin the kept point to avatar center.
 * SVG 2 image + clipPath (https://www.w3.org/TR/SVG2/).
 */
export const focalCropPlacement = ({ focalX = 0.5, focalY = 0.5, cx, cy, size }) => {
  const fx = Math.min(1, Math.max(0, Number(focalX)))
  const fy = Math.min(1, Math.max(0, Number(focalY)))
  const d = size
  return {
    x: cx - fx * d,
    y: cy - fy * d,
    width: d,
    height: d,
    clipCx: cx,
    clipCy: cy,
    clipR: d / 2,
    focal_x: fx,
    focal_y: fy,
  }
}

const renderMarking = (marking, viewport, stroke) => {
  const g = marking.geometry
  if (g.type === "polyline" || g.type === "polygon") {
    const pts = g.points
      .map(([mx, my]) => {
        const p = viewport.toPx(mx, my)
        return `${formatNumber(p.x)},${formatNumber(p.y)}`
      })
      .join(" ")
    const close = g.type === "polygon" ? " Z" : ""
    return `<path data-marking="${escapeXml(marking.id)}" data-kind="${escapeXml(marking.kind)}" d="M ${pts}${close}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="2"/>`
  }
  if (g.type === "circle") {
    const [mx, my] = g.points[0]
    const c = viewport.toPx(mx, my)
    const r = (g.radius ?? 0) * viewport.scale
    return `<circle data-marking="${escapeXml(marking.id)}" data-kind="${escapeXml(marking.kind)}" cx="${formatNumber(c.x)}" cy="${formatNumber(c.y)}" r="${formatNumber(r)}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="2"/>`
  }
  return ""
}

const playerMarkers = (player) => {
  const set = new Set(player.markers ?? [])
  if (player.is_captain) {
    set.add("captain")
  }
  set.delete("none")
  return [...set].sort()
}

const renderPlayerNode = ({ player, cx, cy, avatarSize, tokens, role }) => {
  const text = resolveToken(tokens, "color.text", DEFAULT_TOKENS["color.text"])
  const fallback = resolveToken(tokens, "color.fallback", DEFAULT_TOKENS["color.fallback"])
  const markerColor = resolveToken(tokens, "color.marker", DEFAULT_TOKENS["color.marker"])
  const fontFamily = resolveToken(tokens, "font.family", DEFAULT_TOKENS["font.family"])
  const clipId = `clip-${String(player.player_id).replace(/[^a-zA-Z0-9_-]/g, "_")}`
  const parts = []
  const markers = playerMarkers(player)

  parts.push(
    `<g data-player="${escapeXml(player.player_id)}" data-role="${escapeXml(role)}" data-number="${escapeXml(String(player.number ?? ""))}" data-position="${escapeXml(player.position_id ?? "")}">`
  )

  if (player.photo?.href) {
    const place = focalCropPlacement({
      focalX: player.photo.focal_x ?? 0.5,
      focalY: player.photo.focal_y ?? 0.5,
      cx,
      cy,
      size: avatarSize,
    })
    parts.push(`<clipPath id="${clipId}"><circle cx="${formatNumber(place.clipCx)}" cy="${formatNumber(place.clipCy)}" r="${formatNumber(place.clipR)}"/></clipPath>`)
    parts.push(
      `<image data-photo="true" data-focal-x="${formatNumber(place.focal_x)}" data-focal-y="${formatNumber(place.focal_y)}" href="${escapeXml(player.photo.href)}" x="${formatNumber(place.x)}" y="${formatNumber(place.y)}" width="${formatNumber(place.width)}" height="${formatNumber(place.height)}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
    )
  } else {
    parts.push(
      `<circle data-photo-fallback="true" cx="${formatNumber(cx)}" cy="${formatNumber(cy)}" r="${formatNumber(avatarSize / 2)}" fill="${escapeXml(fallback)}"/>`
    )
    const label = String(player.number ?? "?")
    parts.push(
      `<text data-fallback-label="true" x="${formatNumber(cx)}" y="${formatNumber(cy + avatarSize * 0.12)}" text-anchor="middle" fill="${escapeXml(text)}" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(avatarSize * 0.4)}">${escapeXml(label)}</text>`
    )
  }

  const nameY = cy + avatarSize * 0.72
  parts.push(
    `<text data-name="true" x="${formatNumber(cx)}" y="${formatNumber(nameY)}" text-anchor="middle" fill="${escapeXml(text)}" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(avatarSize * 0.28)}">${escapeXml(player.name ?? "")}</text>`
  )
  if (player.position_label) {
    parts.push(
      `<text data-position-label="true" x="${formatNumber(cx)}" y="${formatNumber(nameY + avatarSize * 0.28)}" text-anchor="middle" fill="${escapeXml(text)}" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(avatarSize * 0.22)}">${escapeXml(player.position_label)}</text>`
    )
  }

  if (markers.includes("captain")) {
    parts.push(
      `<circle data-marker="captain" cx="${formatNumber(cx + avatarSize * 0.38)}" cy="${formatNumber(cy - avatarSize * 0.38)}" r="${formatNumber(avatarSize * 0.14)}" fill="${escapeXml(markerColor)}"/>`
    )
    parts.push(
      `<text data-marker-label="captain" x="${formatNumber(cx + avatarSize * 0.38)}" y="${formatNumber(cy - avatarSize * 0.32)}" text-anchor="middle" fill="#1A1A1A" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(avatarSize * 0.18)}">C</text>`
    )
  }
  if (markers.includes("goalkeeper")) {
    parts.push(
      `<rect data-marker="goalkeeper" x="${formatNumber(cx - avatarSize * 0.55)}" y="${formatNumber(cy - avatarSize * 0.55)}" width="${formatNumber(avatarSize * 0.28)}" height="${formatNumber(avatarSize * 0.18)}" fill="${escapeXml(markerColor)}"/>`
    )
    parts.push(
      `<text data-marker-label="goalkeeper" x="${formatNumber(cx - avatarSize * 0.41)}" y="${formatNumber(cy - avatarSize * 0.41)}" text-anchor="middle" fill="#1A1A1A" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(avatarSize * 0.14)}">GK</text>`
    )
  }

  parts.push(`</g>`)
  return parts.join("")
}

const motionWrapper = (motion, body) => {
  const attrs = [
    `data-motion="${motion.reduced ? "reduced" : "allowed"}"`,
    `data-motion-phase="${escapeXml(motion.phase)}"`,
    `data-motion-mode="${escapeXml(motion.mode)}"`,
    `data-motion-duration-ms="${motion.duration_ms}"`,
  ]
  if (motion.clip_id) {
    attrs.push(`data-motion-clip="${escapeXml(motion.clip_id)}"`)
  }
  if (motion.reduced || motion.phase === "static" || motion.duration_ms === 0 || motion.mode === "cut") {
    return `<g ${attrs.join(" ")}>${body}</g>`
  }
  if (motion.mode === "fade") {
    const sec = motion.duration_ms / 1000
    return `<g ${attrs.join(" ")} opacity="0"><animate attributeName="opacity" from="0" to="1" dur="${formatNumber(sec)}s" fill="freeze"/>${body}</g>`
  }
  // slide entry/exit: vertical nudge (non-reduced only)
  const sec = motion.duration_ms / 1000
  const from = motion.phase === "exit" ? "0 0" : "0 24"
  const to = motion.phase === "exit" ? "0 -24" : "0 0"
  return `<g ${attrs.join(" ")} transform="translate(${from})"><animateTransform attributeName="transform" type="translate" from="${from}" to="${to}" dur="${formatNumber(sec)}s" fill="freeze"/>${body}</g>`
}

/**
 * Deterministic lineup graphic on real court/pitch geometry (AC-7.1–7.5).
 */
export const renderLineupSvg = (input) => {
  const {
    width,
    height,
    field,
    formation,
    team_name: teamName,
    starters = [],
    substitutes = [],
    tokens = {},
    reduced_motion: reducedMotion = true,
    animations = { clips: [] },
    motion_phase: motionPhase = "entry",
    graphics_version: graphicsVersion = "0.1.0",
  } = input

  if (!field || !formation) {
    throw new Error("field and formation are required")
  }

  const merged = { ...DEFAULT_TOKENS, ...tokens }
  const panel = resolveToken(merged, "color.panel", DEFAULT_TOKENS["color.panel"])
  const accent = resolveToken(merged, "color.accent", DEFAULT_TOKENS["color.accent"])
  const text = resolveToken(merged, "color.text", DEFAULT_TOKENS["color.text"])
  const fieldFill = resolveToken(merged, "color.field", DEFAULT_TOKENS["color.field"])
  const marking = resolveToken(merged, "color.marking", DEFAULT_TOKENS["color.marking"])
  const benchFill = resolveToken(merged, "color.bench", DEFAULT_TOKENS["color.bench"])
  const fontFamily = resolveToken(merged, "font.family", DEFAULT_TOKENS["font.family"])

  const titleBox = { x: width * 0.04, y: height * 0.03, w: width * 0.92, h: height * 0.08 }
  const fieldBox = { x: width * 0.04, y: height * 0.12, w: width * 0.92, h: height * 0.58 }
  const benchBox = { x: width * 0.04, y: height * 0.74, w: width * 0.92, h: height * 0.22 }
  const viewport = fieldViewport(field, fieldBox)
  const slotByPosition = new Map(formation.slots.map((s) => [s.position_id, s]))
  const avatarSize = Math.min(fieldBox.w, fieldBox.h) * 0.11
  const benchAvatar = Math.min(benchBox.h * 0.45, benchBox.w / Math.max(substitutes.length, 1) * 0.5)

  const fieldParts = []
  fieldParts.push(
    `<rect data-role="field-surface" data-surface="${escapeXml(field.surface)}" x="${formatNumber(viewport.ox)}" y="${formatNumber(viewport.oy)}" width="${formatNumber(viewport.length * viewport.scale)}" height="${formatNumber(viewport.width * viewport.scale)}" fill="${escapeXml(fieldFill)}"/>`
  )
  for (const m of [...field.markings].sort((a, b) => a.id.localeCompare(b.id))) {
    fieldParts.push(renderMarking(m, viewport, marking))
  }

  const starterParts = []
  for (const player of [...starters].sort((a, b) =>
    String(a.player_id).localeCompare(String(b.player_id))
  )) {
    const slot = slotByPosition.get(player.position_id)
    if (!slot) {
      throw new Error(`starter ${player.player_id} missing formation slot for ${player.position_id}`)
    }
    const pt = formationPointToPx(viewport, slot.x, slot.y)
    starterParts.push(
      renderPlayerNode({
        player,
        cx: pt.x,
        cy: pt.y,
        avatarSize,
        tokens: merged,
        role: "starter",
      })
    )
  }

  const benchParts = []
  benchParts.push(
    `<rect data-role="bench" x="${formatNumber(benchBox.x)}" y="${formatNumber(benchBox.y)}" width="${formatNumber(benchBox.w)}" height="${formatNumber(benchBox.h)}" fill="${escapeXml(benchFill)}"/>`
  )
  benchParts.push(
    `<text data-role="bench-label" x="${formatNumber(benchBox.x + benchBox.w * 0.02)}" y="${formatNumber(benchBox.y + benchBox.h * 0.22)}" fill="${escapeXml(text)}" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(benchBox.h * 0.18)}">Substitutes</text>`
  )
  const sortedSubs = [...substitutes].sort((a, b) =>
    String(a.player_id).localeCompare(String(b.player_id))
  )
  sortedSubs.forEach((player, index) => {
    const gap = benchBox.w / (sortedSubs.length + 1)
    const cx = benchBox.x + gap * (index + 1)
    const cy = benchBox.y + benchBox.h * 0.58
    benchParts.push(
      renderPlayerNode({
        player,
        cx,
        cy,
        avatarSize: benchAvatar,
        tokens: merged,
        role: "substitute",
      })
    )
  })

  const motion = resolveLineupMotion(animations, motionPhase, reducedMotion)
  const body = [
    `<rect data-role="panel" x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(panel)}"/>`,
    `<rect data-role="accent" x="0" y="0" width="${formatNumber(width * 0.02)}" height="${height}" fill="${escapeXml(accent)}"/>`,
    `<text data-role="team-name" x="${formatNumber(titleBox.x)}" y="${formatNumber(titleBox.y + titleBox.h * 0.7)}" fill="${escapeXml(text)}" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(titleBox.h * 0.7)}">${escapeXml(teamName ?? "")}</text>`,
    `<g data-role="field-geometry">${fieldParts.join("")}${starterParts.join("")}</g>`,
    `<g data-role="substitutes">${benchParts.join("")}</g>`,
  ].join("")

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-kind="lineups" data-graphics-version="${escapeXml(graphicsVersion)}" data-formation="${escapeXml(formation.id)}" data-field-surface="${escapeXml(field.surface)}">`,
    motionWrapper(motion, body),
    `</svg>`,
    ``,
  ].join("\n")
}

export { DEFAULT_TOKENS as LINEUP_DEFAULT_TOKENS }
