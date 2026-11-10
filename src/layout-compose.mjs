/**
 * Compose a protocol layout document into a graphics scene for exact-output
 * preview (AC-3.3). Maps layout item kinds to AC-8.1 template kinds.
 */

import { escapeXml } from "./escape.mjs"
import { loadTemplateByKind } from "./templates.mjs"
import { RESOLUTION_MATRIX } from "./resolutions.mjs"
import { renderSceneSvg } from "./render.mjs"
import { ACTION_SAFE_INSET, TITLE_SAFE_INSET } from "./layout-editor.mjs"

export const LAYOUT_KIND_TO_TEMPLATE = Object.freeze({
  scoreboard: "scorebug",
  clock: "clocks",
  lineup: "lineups",
  lower_third: "lower_thirds",
  substitution: "substitutions",
  summary: "summaries",
  sponsor: "sponsor_panels",
  social_card: "social_cards",
})

const defaultBindings = (templateKind) => {
  switch (templateKind) {
    case "scorebug":
      return {
        home_name: "Home",
        away_name: "Away",
        home_score: "0",
        away_score: "0",
      }
    case "clocks":
      return { game_clock: "00:00", period: "1" }
    case "lineups":
      return { team_name: "Team", lineup_text: "Starters" }
    case "lower_thirds":
      return { primary: "Player", secondary: "Team" }
    case "substitutions":
      return { player_out: "Out", player_in: "In" }
    case "summaries":
      return { headline: "Summary", body: "Final" }
    case "sponsor_panels":
      return { sponsor_name: "Sponsor", tagline: "Partner" }
    case "social_cards":
      return { title: "Social", subtitle: "Draft" }
    default:
      return {}
  }
}

export const layoutItemToInstance = (item) => {
  if (item.kind === "safe_area_guide" || item.kind === "custom") {
    return null
  }
  const templateKind = LAYOUT_KIND_TO_TEMPLATE[item.kind]
  if (!templateKind) {
    return null
  }
  const template = loadTemplateByKind(templateKind)
  return {
    instance_id: item.item_id,
    template_id: item.template_id ?? template.template_id,
    template_kind: templateKind,
    anchor: item.anchor,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    z: item.z,
    bindings: defaultBindings(templateKind),
  }
}

export const layoutToScene = (layout, { scene_id, name } = {}) => {
  const instances = layout.items
    .map((item) => layoutItemToInstance(item))
    .filter(Boolean)
  return {
    scene_id: scene_id ?? layout.scene_id ?? `preview-${layout.layout_id}`,
    name: name ?? `Output preview ${layout.aspect}`,
    aspect: layout.aspect,
    instances,
  }
}

export const safeAreaOverlaySvg = (width, height) => {
  const action = ACTION_SAFE_INSET
  const title = TITLE_SAFE_INSET
  const ax = action * width
  const ay = action * height
  const aw = (1 - action * 2) * width
  const ah = (1 - action * 2) * height
  const tx = title * width
  const ty = title * height
  const tw = (1 - title * 2) * width
  const th = (1 - title * 2) * height
  return [
    `<rect data-guide="action-safe" x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#66AA88" stroke-width="2" stroke-dasharray="8 6"/>`,
    `<rect data-guide="title-safe" x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none" stroke="#AACCEE" stroke-width="2" stroke-dasharray="4 4"/>`,
  ].join("")
}

/**
 * Render exact-output preview SVG for a draft or applied layout (AC-3.3).
 * Includes optional SMPTE ST 2046-1 safe-area guides.
 */
export const renderLayoutPreview = (
  layout,
  {
    resolution_label = "720p",
    tokens = {},
    show_safe_areas = true,
    bindings_by_item = {},
  } = {}
) => {
  const cell = RESOLUTION_MATRIX.find(
    (row) => row.aspect === layout.aspect && row.resolution_label === resolution_label
  )
  if (!cell) {
    throw new Error(
      `no resolution cell for aspect=${layout.aspect} label=${resolution_label}`
    )
  }

  const scene = layoutToScene(layout)
  for (const instance of scene.instances) {
    const override = bindings_by_item[instance.instance_id]
    if (override) {
      instance.bindings = { ...instance.bindings, ...override }
    }
  }

  const templates = {}
  for (const instance of scene.instances) {
    if (!templates[instance.template_id]) {
      templates[instance.template_id] = loadTemplateByKind(instance.template_kind)
    }
  }

  let svg = renderSceneSvg({
    graphics_version: "0.1.0",
    width: cell.width,
    height: cell.height,
    aspect: layout.aspect,
    resolution_label: cell.resolution_label,
    reduced_motion: true,
    scene,
    templates: Object.values(templates),
    tokens,
  })

  if (show_safe_areas) {
    const overlay = safeAreaOverlaySvg(cell.width, cell.height)
    svg = svg.replace("</svg>", `${overlay}</svg>`)
  }

  // Mark draft vs applied for operator preview clarity (still exact geometry).
  svg = svg.replace(
    "<svg ",
    `<svg data-layout-id="${escapeXml(layout.layout_id)}" data-layout-state="${escapeXml(layout.state)}" `
  )
  return svg
}
