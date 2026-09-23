/**
 * Fixed-stage scaling with letterboxing — the originals ran at fixed
 * resolutions and we scale the same way the Flash letterbox did:
 * integer factors ≥1x; a *uniform* fractional downscale below 1x when the
 * viewport is smaller than the stage (never crop, never non-uniform stretch).
 */

export interface Viewport { width: number; height: number }

/** largest integer factor that fits the viewport; sub-1x viewports get a
 *  uniform fractional downscale so the stage never crops (D-04: a 640px
 *  stage on a 390px portrait phone must shrink, not clip controls). */
export function fitIntegerScale(stageW: number, stageH: number, vp: Viewport, maxFactor = 4): number {
  const fit = Math.min(vp.width / stageW, vp.height / stageH);
  if (fit < 1) return fit;
  return Math.min(Math.floor(fit), maxFactor);
}

/** centered letterbox offsets for the scaled stage */
export function letterboxOffset(stageW: number, stageH: number, scale: number, vp: Viewport): { x: number; y: number } {
  return {
    x: Math.floor((vp.width - stageW * scale) / 2),
    y: Math.floor((vp.height - stageH * scale) / 2),
  };
}

export function viewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}
