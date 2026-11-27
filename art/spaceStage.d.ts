export interface StagePlace {
  x: number;
  u: number;
  r: number;
  s: number;
}
export interface StageGarment {
  id: string;
  url: string;
  category: string;
  locked?: boolean;
  place?: StagePlace;
}
export interface StageEvents {
  onSelect?: (id: string | null) => void;
  onLayout?: (layout: Record<string, StagePlace>, order: string[]) => void;
  onRemove?: (id: string) => void;
  onAnchor?: (point: { x: number; y: number } | null, id: string | null) => void;
  onFigure?: (ready: boolean) => void;
}
export const SLAB: { width: number; length: number; tilt: number };
export class SpaceStage {
  constructor(canvas: HTMLCanvasElement, events?: StageEvents);
  sync(
    list: StageGarment[],
    origin?: Record<string, { x: number; y: number }>,
  ): void;
  select(id: string | null, silent?: boolean): void;
  setView(view: 'table' | 'model'): void;
  setMood(colours: string[], signal: string): void;
  setMorphs(values: Record<string, number>): void;
  nudge(change: { s?: number; r?: number; x?: number; u?: number }): void;
  destroy(): void;
}
