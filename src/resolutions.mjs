/**
 * Output size matrix for AC-8.1.
 * 16:9 HD/UHD sizes follow common broadcast raster sizes; 4K uses 3840x2160
 * (ITU-R BT.2020 / UHDTV). Portrait swaps axes. Square uses the short edge.
 * Sources: https://www.itu.int/rec/R-REC-BT.2020/
 */
export const RESOLUTION_MATRIX = Object.freeze([
  Object.freeze({ aspect: "16:9", resolution_label: "720p", width: 1280, height: 720 }),
  Object.freeze({ aspect: "16:9", resolution_label: "1080p", width: 1920, height: 1080 }),
  Object.freeze({ aspect: "16:9", resolution_label: "4K", width: 3840, height: 2160 }),
  Object.freeze({ aspect: "9:16", resolution_label: "720p", width: 720, height: 1280 }),
  Object.freeze({ aspect: "9:16", resolution_label: "1080p", width: 1080, height: 1920 }),
  Object.freeze({ aspect: "9:16", resolution_label: "4K", width: 2160, height: 3840 }),
  Object.freeze({ aspect: "1:1", resolution_label: "720p", width: 720, height: 720 }),
  Object.freeze({ aspect: "1:1", resolution_label: "1080p", width: 1080, height: 1080 }),
  Object.freeze({ aspect: "1:1", resolution_label: "4K", width: 2160, height: 2160 }),
])

export const goldenName = (templateKind, aspect, resolutionLabel) => {
  const aspectKey = aspect.replace(":", "x")
  return `${templateKind}__${aspectKey}__${resolutionLabel}.svg`
}
