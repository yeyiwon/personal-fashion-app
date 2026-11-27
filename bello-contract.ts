/** Public contract for the existing studio and the Claude spatial client. Additive fields keep older clients usable. */
export type BelloTool='outfit'|'swap'|'lock'|'closet'|'palette'|'fitting'|'shopping'|'save'|'none';
export type BelloGarment={id:string;name:string;category:string;color:string;material?:string;purchased?:string;affinity?:number;silhouette?:string;length?:string};
export interface BelloRequest{
  request:string; requestId?:string;engine:'local'|'cloud';consent?:boolean;garments:BelloGarment[];
  worn:string[];locked:string[];time?:string;schedule?:string;weather?:string;preferences?:string;recent?:string;previous?:string;
}
export interface BelloAdvice{
  version:1;requestId:string;state:'proposed';source:'Apple Intelligence'|'OpenAI';tool:BelloTool;ids:string[];message:string;
  ui:{component:'outfit-preview'|'wardrobe-picker'|'color-palette'|'fitting-review'|'shopping-compare'|'save-outfit'|'message';garmentIds:string[];requiresConfirmation:boolean};
}
export type BelloFailureCode='INVALID_REQUEST'|'AUTH_REQUIRED'|'MODEL_UNAVAILABLE'|'BUDGET_EXHAUSTED'|'PROVIDER_ERROR'|'CATALOGUE_MISMATCH'|'DUPLICATE_REQUEST'|'BUDGET_UNAVAILABLE';
export interface BelloFailure{version:1;requestId:string;state:'failed';code:BelloFailureCode;error:string;retryable:boolean}

