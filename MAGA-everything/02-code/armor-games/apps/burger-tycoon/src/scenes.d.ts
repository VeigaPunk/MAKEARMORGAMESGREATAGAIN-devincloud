import type { SimState } from './sim';
export function createScene(ctx: CanvasRenderingContext2D): (state: SimState, pane: number, width: number, height: number) => void;
