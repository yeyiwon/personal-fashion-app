export type OpticalState = {
  focus?: number;
  turn?: number;
  signal?: number;
  tint?: number;
};
export type OpticalMode = 'mirror' | 'rail' | 'atlas' | 'garment';
export type OpticalHandle = { set(state: OpticalState): void; dispose(): void };
export function mountOptics(
  canvas: HTMLCanvasElement,
  mode: OpticalMode,
  state: OpticalState,
  ready: (value: boolean) => void,
): Promise<OpticalHandle | null>;
