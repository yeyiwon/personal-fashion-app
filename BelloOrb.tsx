import { useEffect, useRef } from 'react';
import type { SignalState } from './BelloSignal';

// BELLO's body: a liquid lens whose lobes, tension and light follow the real
// assistant state. One fragment shader, no texture, ~3 kB.
// [lobes, reach, spin, tension, light, cool]
const poses: Record<SignalState, number[]> = {
  waiting: [2, 0.1, 0.25, 0.3, 0.55, 0.35],
  greeting: [3, 0.2, 0.6, 0.42, 0.85, 0.5],
  thinking: [4, 0.3, 2.3, 0.52, 0.75, 0.85],
  proposed: [3, 0.24, 0.5, 0.3, 1, 0.3],
  acting: [5, 0.27, 1.5, 0.44, 0.95, 0.65],
  complete: [1, 0.02, 0.2, 0.2, 1, 0.2],
  error: [2, 0.05, 0.1, 0.12, 0.3, 0],
  limited: [1, 0.03, 0.1, 0.16, 0.4, 0.1],
};
const vertex = `attribute vec2 p; varying vec2 v; void main(){ v = p; gl_Position = vec4(p, 0., 1.); }`;
const fragment = `
precision highp float;
varying vec2 v; uniform float uT; uniform float uPose[6]; uniform vec3 uA; uniform vec3 uB; uniform vec3 uInk; uniform vec3 uWhite; uniform float uPx;
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float field(vec2 p){
  float core = 0.47 - uPose[1] * 0.42;
  float d = length(p) - core * (1.0 + 0.035 * sin(uT * 1.7));
  for (int i = 0; i < 5; i++) {
    float w = clamp(uPose[0] - float(i), 0.0, 1.0);
    if (w <= 0.0) continue;
    float a = uT * uPose[2] + float(i) * 6.2832 / max(uPose[0], 1.0) + sin(uT * 0.6 + float(i)) * 0.4;
    float reach = uPose[1] * (1.0 + 0.3 * sin(uT * 2.1 + float(i) * 1.7));
    vec2 c = vec2(cos(a), sin(a)) * reach;
    d = smin(d, length(p - c) - (0.3 - uPose[1] * 0.2) * w, uPose[3] * 0.5 + 0.02);
  }
  return d;
}
void main(){
  vec2 p = v * 0.98;
  float d = field(p);
  float e = 0.012;
  vec2 g = vec2(field(p + vec2(e, 0.0)) - d, field(p + vec2(0.0, e)) - d) / e;
  float depth = clamp(-d / 0.34, 0.0, 1.0);
  float z = sqrt(1.0 - pow(1.0 - depth, 2.0));
  vec3 n = normalize(vec3(g * (1.0 - z) * 1.6, z + 0.12));
  float fres = pow(1.0 - n.z, 2.2);
  float swirl = 0.5 + 0.5 * sin(p.x * 3.2 - p.y * 2.3 + uT * (0.5 + uPose[2] * 0.5));
  vec3 body = mix(uA, uB, clamp(mix(swirl, uPose[5], 0.5), 0.0, 1.0));
  // Refracted interior: darker toward the far wall, lit from the upper left.
  vec3 c = mix(uInk, body, 0.4 + 0.6 * depth * uPose[4]);
  c = mix(c, body, smoothstep(0.2, 0.95, dot(n, normalize(vec3(-0.5, 0.6, 0.62)))) * 0.75);
  c = mix(c, uWhite, fres * 0.85);
  float spec = pow(max(dot(n, normalize(vec3(-0.42, 0.55, 0.72))), 0.0), 26.0);
  c += uWhite * spec * (0.55 + uPose[4] * 0.4);
  float caustic = smoothstep(0.75, 1.0, depth) * (0.5 + 0.5 * sin(uT * 1.3 + p.x * 9.0)) * 0.16 * uPose[4];
  c += uWhite * caustic;
  float a = smoothstep(uPx, -uPx, d);
  gl_FragColor = vec4(c * a, a);
}`;

function colour(name: string, fallback: [number, number, number]) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function BelloOrb({
  state,
  onUnsupported,
}: {
  state: SignalState;
  onUnsupported: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    goal = useRef(poses[state]),
    wake = useRef<() => void>(() => {});
  goal.current = poses[state];
  useEffect(() => wake.current(), [state]);
  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext('webgl', { premultipliedAlpha: true, antialias: false });
    if (!gl) return onUnsupported();
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.bindAttribLocation(program, 0, 'p');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return onUnsupported();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const u = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform3fv(u('uA'), colour('--bello-lavender', [0.75, 0.71, 0.89]));
    gl.uniform3fv(u('uB'), colour('--bello-hologram', [0.57, 0.84, 0.87]));
    gl.uniform3fv(u('uInk'), colour('--bello-slate', [0.16, 0.2, 0.27]));
    gl.uniform3fv(u('uWhite'), colour('--bello-optical', [0.96, 0.97, 0.99]));
    const time = u('uT'),
      poseAt = u('uPose'),
      px = u('uPx');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const pose = [...goal.current];
    let frame = 0,
      last = performance.now(),
      t = 0;
    function draw(now: number) {
      frame = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const size = Math.round(el.clientWidth * Math.min(devicePixelRatio || 1, 3)) || 62;
      if (el.width !== size) el.width = el.height = size;
      gl!.viewport(0, 0, size, size);
      const blend = reduced.matches ? 1 : 1 - Math.exp(-dt * 7);
      let moving = false;
      for (let i = 0; i < 6; i++) {
        const diff = goal.current[i] - pose[i];
        if (Math.abs(diff) > 0.003) moving = true;
        pose[i] += diff * blend;
      }
      if (!reduced.matches) t += dt;
      gl!.uniform1f(time, t);
      gl!.uniform1fv(poseAt, pose);
      gl!.uniform1f(px, 2.4 / size);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      // The resting lens only breathes; it does not need every frame.
      if (document.hidden || (reduced.matches && !moving)) return;
      frame = requestAnimationFrame(draw);
    }
    const start = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    wake.current = start;
    start();
    document.addEventListener('visibilitychange', start);
    reduced.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(frame);
      wake.current = () => {};
      document.removeEventListener('visibilitychange', start);
      reduced.removeEventListener('change', start);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [onUnsupported]);
  return <canvas ref={canvas} className="bello-signal bello-orb" aria-hidden="true" data-state={state} />;
}
