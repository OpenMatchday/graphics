import { escapeXml, formatNumber } from "./escape.mjs"

const DEFAULT_TOKENS = Object.freeze({
  "color.panel": "#1A1A1A",
  "color.accent": "#C4C4C4",
  "color.text": "#F5F5F5",
  "font.family": "sans-serif",
})

const resolveToken = (tokens, tokenRef, fallback) => {
  if (!tokenRef) {
    return fallback
  }
  return tokens[tokenRef] ?? DEFAULT_TOKENS[tokenRef] ?? fallback
}

const sortByZThenId = (instances) =>
  [...instances].sort((a, b) => {
    if (a.z !== b.z) {
      return a.z - b.z
    }
    return a.instance_id.localeCompare(b.instance_id)
  })

const boxForInstance = (instance, width, height) => {
  const x = instance.x * width
  const y = instance.y * height
  const w = instance.w * width
  const h = instance.h * height
  return { x, y, w, h }
}

const renderRegion = ({ region, box, bindings, tokens }) => {
  const rx = box.x + region.x * box.w
  const ry = box.y + region.y * box.h
  const rw = region.w * box.w
  const rh = region.h * box.h
  const parts = []

  if (region.role === "panel" || region.role === "accent") {
    const fill = resolveToken(
      tokens,
      region.fill_token,
      region.role === "accent" ? DEFAULT_TOKENS["color.accent"] : DEFAULT_TOKENS["color.panel"]
    )
    parts.push(
      `<rect data-region="${escapeXml(region.region_id)}" x="${formatNumber(rx)}" y="${formatNumber(ry)}" width="${formatNumber(rw)}" height="${formatNumber(rh)}" fill="${escapeXml(fill)}"/>`
    )
  }

  if (region.role === "text" && region.slot_id) {
    const text = bindings[region.slot_id] ?? ""
    const fill = resolveToken(tokens, region.text_token, DEFAULT_TOKENS["color.text"])
    const fontFamily = resolveToken(tokens, "font.family", DEFAULT_TOKENS["font.family"])
    const ratio = region.font_size_ratio ?? 0.55
    const fontSize = rh * ratio
    const tx = rx + rw * 0.04
    const ty = ry + rh * 0.72
    parts.push(
      `<text data-region="${escapeXml(region.region_id)}" data-slot="${escapeXml(region.slot_id)}" x="${formatNumber(tx)}" y="${formatNumber(ty)}" fill="${escapeXml(fill)}" font-family="${escapeXml(fontFamily)}" font-size="${formatNumber(fontSize)}">${escapeXml(text)}</text>`
    )
  }

  return parts.join("")
}

const renderInstance = ({ instance, template, tokens, width, height, reducedMotion }) => {
  const box = boxForInstance(instance, width, height)
  const bindings = instance.bindings ?? {}
  const regions = [...template.layout.regions].sort((a, b) =>
    a.region_id.localeCompare(b.region_id)
  )
  const body = regions
    .map((region) => renderRegion({ region, box, bindings, tokens }))
    .join("")
  const motion =
    !reducedMotion && template.supports_motion
      ? `<g data-motion="allowed">`
      : `<g data-motion="reduced">`
  return `${motion}<g data-instance="${escapeXml(instance.instance_id)}" data-template="${escapeXml(template.template_id)}" data-kind="${escapeXml(template.kind)}">${body}</g></g>`
}

/**
 * Deterministic SVG renderer. Same input always yields the same SVG string.
 * No wall-clock, random, or locale-dependent formatting.
 */
export const renderSceneSvg = (input) => {
  const {
    width,
    height,
    aspect,
    resolution_label: resolutionLabel,
    scene,
    templates,
    tokens = {},
    reduced_motion: reducedMotion = true,
  } = input

  if (scene.aspect !== aspect) {
    throw new Error(`scene aspect ${scene.aspect} != render aspect ${aspect}`)
  }

  const byId = new Map(templates.map((t) => [t.template_id, t]))
  const mergedTokens = { ...DEFAULT_TOKENS, ...tokens }
  const layers = sortByZThenId(scene.instances).map((instance) => {
    const template = byId.get(instance.template_id)
    if (!template) {
      throw new Error(`missing template ${instance.template_id}`)
    }
    if (template.kind !== instance.template_kind) {
      throw new Error(
        `template kind mismatch for ${instance.template_id}: ${template.kind} vs ${instance.template_kind}`
      )
    }
    return renderInstance({
      instance,
      template,
      tokens: mergedTokens,
      width,
      height,
      reducedMotion,
    })
  })

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-aspect="${escapeXml(aspect)}" data-resolution="${escapeXml(resolutionLabel)}" data-scene="${escapeXml(scene.scene_id)}" data-graphics-version="${escapeXml(input.graphics_version)}">`,
    `<rect data-role="canvas" x="0" y="0" width="${width}" height="${height}" fill="#00000000"/>`,
    ...layers,
    `</svg>`,
    ``,
  ].join("\n")
}

export { DEFAULT_TOKENS }
