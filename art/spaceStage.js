// BELLO 나의 공간 — real-time stage.
// A sculptural mannequin stands in an optical studio; real garment photos are
// laid out on an inclined styling slab and manipulated directly.
// Garment photos are drawn unlit and untone-mapped so their colours stay exact.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const SLAB = { width: 1.5, length: 1.62, tilt: (29 * Math.PI) / 180 };
const CENTRE = new T.Vector3(0, 0.403, 0.44);
const BRAND = {
  optical: new T.Color('#F4F7FC'),
  silver: new T.Color('#C6D2E4'),
  lavender: new T.Color('#BEB6E4'),
  hologram: new T.Color('#91D5DD'),
  slate: new T.Color('#293244'),
};
// Laid-out width (or height, when negative) in metres per category.
const SIZE = {
  상의: 0.5,
  아우터: 0.56,
  하의: -0.78,
  원피스: -0.92,
  신발: 0.28,
  가방: 0.28,
  기타: 0.16,
};
// Flat-lay home position per category: x across, u along the slab, r turn.
const HOME = {
  아우터: [-0.37, 0.39, 0.07],
  상의: [0.25, 0.41, -0.03],
  원피스: [0.2, 0.12, 0.02],
  하의: [0.2, -0.27, 0.04],
  가방: [-0.45, -0.13, 0.14],
  신발: [-0.4, -0.56, -0.2],
  기타: [0.54, -0.6, 0.1],
};

class Spring {
  constructor(value, stiffness = 210, damping = 24) {
    this.v = value;
    this.t = value;
    this.s = 0;
    this.k = stiffness;
    this.c = damping;
  }
  step(dt) {
    this.s += (-this.k * (this.v - this.t) - this.c * this.s) * dt;
    this.v += this.s * dt;
    return Math.abs(this.v - this.t) > 4e-4 || Math.abs(this.s) > 4e-3;
  }
  snap(value = this.t) {
    this.v = this.t = value;
    this.s = 0;
  }
}

const backdrop = {
  vertex: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragment: `
    varying vec3 vDir; uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uTint; uniform float uGlow;
    void main(){
      vec3 d = normalize(vDir);
      float h = smoothstep(-0.12, 0.72, d.y);
      vec3 c = mix(uLow, uHigh, h);
      // Light pooling behind the aperture, slightly off axis.
      float pool = exp(-pow(length(vec2(d.x - 0.07, (d.y - 0.16) * 0.55)) * 3.1, 2.0));
      c = mix(c, mix(vec3(1.0), uTint, 0.22), pool * (0.5 + uGlow * 0.25));
      gl_FragColor = vec4(c, 1.0);
    }`,
};
const floor = {
  vertex: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragment: `
    varying vec3 vWorld; uniform vec3 uNear; uniform vec3 uFar; uniform vec3 uTint; uniform float uGlow;
    void main(){
      float dist = length(vWorld.xz - vec2(0.0, 1.0));
      vec3 c = mix(uNear, uFar, smoothstep(2.0, 11.0, dist));
      // Reflection of the aperture: a long soft streak running toward the viewer.
      float streak = exp(-pow((vWorld.x - 0.42) * 1.25, 2.0)) * smoothstep(3.4, -4.6, vWorld.z) * smoothstep(-5.4, -4.0, vWorld.z);
      c += mix(vec3(1.0), uTint, 0.5) * streak * (0.10 + uGlow * 0.06);
      // Contact occlusion where the slab meets the floor.
      float seat = smoothstep(0.9, 0.0, abs(vWorld.z - 1.24)) * smoothstep(0.9, 0.54, abs(vWorld.x));
      c *= 1.0 - seat * 0.07;
      gl_FragColor = vec4(c, 1.0);
    }`,
};
// Top face of the slab: thin optical edge, state scan, selection pool.
const sheet = {
  vertex: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragment: `
    varying vec2 vP; uniform vec2 uHalf; uniform float uRadius; uniform vec3 uTint; uniform float uScan; uniform float uGlow; uniform vec3 uPool;
    float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      float d = box(vP, uHalf, uRadius);
      if (d > 0.0) discard;
      float edge = smoothstep(0.02, 0.0, -d);
      float inner = smoothstep(0.09, 0.0, -d) * 0.35;
      float along = vP.y / uHalf.y;
      float band = exp(-pow((along - uScan) * 5.5, 2.0)) * step(-1.2, uScan) * step(uScan, 1.2);
      float pool = exp(-dot(vP - uPool.xy, vP - uPool.xy) * 9.0) * uPool.z;
      vec3 c = mix(vec3(1.0), uTint, 0.55);
      float a = edge * (0.55 + uGlow * 0.35) + inner * (0.18 + uGlow * 0.3) + band * 0.42 + pool * 0.3;
      gl_FragColor = vec4(c, a * 0.9);
    }`,
};
const shade = {
  vertex: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragment: `
    varying vec2 vUv; uniform sampler2D map; uniform float uBlur; uniform float uAlpha; uniform vec3 uColor;
    void main(){
      vec2 uv = (vUv - 0.5) * 1.18 + 0.5;
      float r = 0.012 + uBlur * 0.03; float a = 0.0;
      for (int i = 0; i < 8; i++) {
        float t = float(i) * 0.7854;
        vec2 o = vec2(cos(t), sin(t)) * r;
        vec2 p = uv + o;
        float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
        a += texture2D(map, p, 2.5 + uBlur * 2.0).a * inside;
      }
      a = a / 8.0;
      gl_FragColor = vec4(uColor, a * uAlpha);
    }`,
};

function rounded(width, height, radius) {
  const x = -width / 2,
    y = -height / 2,
    s = new T.Shape();
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

// Map a garment colour into the brand family: warm → lavender, cool → hologram.
export function moodTint(colours) {
  if (!colours.length) return BRAND.silver.clone();
  let warm = 0,
    weight = 0;
  const c = new T.Color(),
    hsl = { h: 0, s: 0, l: 0 };
  for (const hex of colours) {
    try {
      c.set(hex);
    } catch {
      continue;
    }
    c.getHSL(hsl);
    const w = hsl.s * (1 - Math.abs(hsl.l - 0.5));
    warm += Math.cos((hsl.h - 0.04) * Math.PI * 2) * w;
    weight += w;
  }
  if (weight < 0.08) return BRAND.silver.clone();
  const t = T.MathUtils.clamp(warm / weight, -1, 1);
  const out = BRAND.silver.clone();
  return out.lerp(t > 0 ? BRAND.lavender : BRAND.hologram, Math.min(1, Math.abs(t) * 1.4));
}

export class SpaceStage {
  constructor(canvas, events = {}) {
    this.canvas = canvas;
    this.events = events;
    this.still = matchMedia('(prefers-reduced-motion: reduce)');
    const renderer = (this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    }));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = (this.scene = new T.Scene());
    this.camera = new T.PerspectiveCamera(58, 1, 0.1, 80);
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.tint = BRAND.silver.clone();
    this.tintGoal = this.tint.clone();
    this.glow = new Spring(0, 60, 14);
    this.scan = { active: false, t: -1.4 };

    // Space: seamless cyclorama, floor, light aperture, one counter-weight fin.
    this.sky = new T.Mesh(
      new T.SphereGeometry(40, 32, 16),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: {
          uLow: { value: BRAND.optical.clone() },
          uHigh: { value: BRAND.silver.clone().lerp(BRAND.optical, 0.25) },
          uTint: { value: this.tint },
          uGlow: { value: 0 },
        },
        vertexShader: backdrop.vertex,
        fragmentShader: backdrop.fragment,
      }),
    );
    scene.add(this.sky);
    this.floor = new T.Mesh(
      new T.PlaneGeometry(60, 60).rotateX(-Math.PI / 2),
      new T.ShaderMaterial({
        uniforms: {
          uNear: { value: new T.Color('#EEF2F9') },
          uFar: { value: BRAND.optical.clone() },
          uTint: { value: this.tint },
          uGlow: { value: 0 },
        },
        vertexShader: floor.vertex,
        fragmentShader: floor.fragment,
      }),
    );
    scene.add(this.floor);
    const ground = new T.Mesh(
      new T.PlaneGeometry(9, 9).rotateX(-Math.PI / 2),
      new T.ShadowMaterial({ color: BRAND.slate, opacity: 0.2 }),
    );
    ground.position.y = 0.002;
    ground.receiveShadow = true;
    scene.add(ground);

    const aperture = new T.Mesh(
      new T.ShapeGeometry(rounded(0.92, 3.5, 0.46), 24),
      new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    );
    aperture.position.set(0.42, 1.75, -5.4);
    scene.add(aperture);
    scene.add(new T.HemisphereLight('#ffffff', '#c6d2e4', 0.75));
    const key = new T.DirectionalLight('#ffffff', 1.9);
    key.position.set(1.3, 5.2, 0.6);
    key.target.position.set(0, 0.8, -2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.2, bottom: -0.6, near: 0.5, far: 12 });
    key.shadow.radius = 7;
    key.shadow.bias = -0.0004;
    scene.add(key, key.target);
    this.rim = new T.DirectionalLight('#ffffff', 1.5);
    this.rim.position.set(0.9, 2.4, -6.5);
    this.rim.target.position.set(0, 1.1, -2.2);
    scene.add(this.rim, this.rim.target);

    // Styling slab: a real object with thickness, plus an optical top sheet.
    this.slab = new T.Group();
    this.slab.position.copy(CENTRE);
    this.slab.rotation.x = SLAB.tilt - Math.PI / 2;
    scene.add(this.slab);
    const body = new T.Mesh(
      new T.ExtrudeGeometry(rounded(SLAB.width, SLAB.length, 0.11), {
        depth: 0.05,
        bevelEnabled: true,
        bevelSize: 0.012,
        bevelThickness: 0.012,
        bevelSegments: 4,
        curveSegments: 20,
      }),
      new T.MeshPhysicalMaterial({
        color: '#ffffff',
        emissive: '#F4F7FC',
        emissiveIntensity: 0.46,
        roughness: 0.36,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        reflectivity: 0.5,
        envMapIntensity: 0.6,
      }),
    );
    body.position.z = -0.064;
    this.slab.add(body);
    this.sheet = new T.Mesh(
      new T.PlaneGeometry(SLAB.width + 0.04, SLAB.length + 0.04),
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uHalf: { value: new T.Vector2(SLAB.width / 2, SLAB.length / 2) },
          uRadius: { value: 0.11 },
          uTint: { value: this.tint },
          uScan: { value: -1.4 },
          uGlow: { value: 0 },
          uPool: { value: new T.Vector3(0, 0, 0) },
        },
        vertexShader: sheet.vertex,
        fragmentShader: sheet.fragment,
      }),
    );
    this.sheet.position.z = 0.0006;
    this.sheet.renderOrder = 1;
    this.slab.add(this.sheet);
    this.pool = new Spring(0, 90, 16);

    // Views.
    this.view = 'table';
    this.cam = {
      x: new Spring(0, 60, 17),
      y: new Spring(2.3, 60, 17),
      z: new Spring(3.42, 60, 17),
      tx: new Spring(0, 60, 17),
      ty: new Spring(0.435, 60, 17),
      tz: new Spring(0, 60, 17),
      fov: new Spring(58, 60, 17),
    };
    this.turn = new Spring(0, 40, 9);
    // The slab lowers into the floor when the view turns to the model.
    this.sink = new Spring(0, 70, 17);
    this.figure = new T.Group();
    this.figure.position.set(0, 0, -2.2);
    scene.add(this.figure);
    this.loadFigure();

    this.items = new Map();
    this.order = [];
    this.textures = new Map();
    this.selected = null;
    this.pointers = new Map();
    this.drag = null;
    this.ray = new T.Raycaster();
    this.last = 0;
    this.frame = 0;
    this.gone = false;

    this.tick = this.tick.bind(this);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.bind();
    this.resize();
    this.kick();
  }

  loadFigure() {
    new GLTFLoader().load(
      '/media/bello/mannequin.glb',
      (gltf) => {
        if (this.gone) return;
        const root = gltf.scene;
        const skin = new T.MeshPhysicalMaterial({
          color: '#E3E8F1',
          roughness: 0.44,
          clearcoat: 0.3,
          clearcoatRoughness: 0.55,
          sheen: 0.5,
          sheenRoughness: 0.5,
          sheenColor: BRAND.lavender.clone().lerp(BRAND.optical, 0.4),
          envMapIntensity: 0.9,
        });
        root.traverse((o) => {
          if (o.isMesh) {
            o.material = skin;
            o.castShadow = true;
            o.frustumCulled = false;
            this.figureMesh = o;
            o.morphTargetInfluences?.fill(0);
          }
        });
        this.figure.add(root);
        root.updateMatrixWorld(true);
        // Rest the arms: the source mesh is modelled in an open A-pose.
        const lower = (name, angle) => {
          const bone = root.getObjectByName(name);
          if (!bone) return;
          const parent = new T.Quaternion();
          bone.parent.getWorldQuaternion(parent);
          const world = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), angle);
          bone.quaternion.premultiply(parent.clone().invert().multiply(world).multiply(parent));
        };
        lower('upperarm_l', -0.5);
        lower('upperarm_r', 0.5);
        lower('lowerarm_l', -0.08);
        lower('lowerarm_r', 0.08);
        this.events.onFigure?.(true);
        this.kick();
      },
      undefined,
      () => this.events.onFigure?.(false),
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────
  texture(id, url) {
    let entry = this.textures.get(id);
    if (entry && entry.url === url) return entry;
    entry = { url, tex: null, aspect: 1, alpha: null, waiting: [] };
    this.textures.set(id, entry);
    new T.TextureLoader().load(url, (tex) => {
      if (this.gone) return tex.dispose();
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      entry.tex = tex;
      entry.aspect = tex.image.width / tex.image.height;
      try {
        const size = 56,
          c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(tex.image, 0, 0, size, size);
        entry.alpha = g.getImageData(0, 0, size, size).data;
      } catch {
        entry.alpha = null;
      }
      entry.waiting.splice(0).forEach((fn) => fn());
      this.kick();
    });
    return entry;
  }

  home(category, index) {
    const [x, u, r] = HOME[category] ?? HOME.기타;
    return { x: x + index * 0.15, u: u - index * 0.1, r: r + index * 0.06, s: 1 };
  }

  /** Reconcile placed garments. origin: client point new garments fly from. */
  sync(list, origin = {}) {
    const next = new Set(list.map((g) => g.id));
    for (const [id, item] of this.items)
      if (!next.has(id) && !item.leaving) this.leave(item);
    const seen = {};
    list.forEach((g, order) => {
      const n = (seen[g.category] = (seen[g.category] ?? -1) + 1);
      const place = g.place ?? this.home(g.category, n);
      let item = this.items.get(g.id);
      if (item?.leaving) {
        this.dispose(item);
        item = null;
      }
      if (!item) item = this.enter(g, place, origin[g.id] ?? origin['*']);
      item.order = order;
      item.locked = !!g.locked;
      if (this.drag?.item !== item) {
        item.x.t = place.x;
        item.u.t = place.u;
        item.r.t = place.r;
        item.s.t = place.s;
      }
    });
    this.order = list.map((g) => g.id);
    if (this.selected && !next.has(this.selected)) this.select(null);
    this.kick();
  }

  enter(g, place, from) {
    const entry = this.texture(g.id, g.url);
    const size = SIZE[g.category] ?? SIZE.기타;
    const group = new T.Group();
    const mat = new T.MeshBasicMaterial({
      transparent: true,
      toneMapped: false,
      depthWrite: false,
      opacity: 0,
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          map: { value: null },
          uBlur: { value: 0 },
          uAlpha: { value: 0 },
          uColor: { value: BRAND.slate.clone().lerp(new T.Color('#101520'), 0.4) },
        },
        vertexShader: shade.vertex,
        fragmentShader: shade.fragment,
      }),
    );
    mesh.userData.id = g.id;
    group.visible = shadow.visible = false;
    this.slab.add(shadow, group);
    group.add(mesh);
    const item = {
      id: g.id,
      category: g.category,
      entry,
      group,
      mesh,
      shadow,
      size,
      w: 0.3,
      h: 0.3,
      x: new Spring(place.x),
      u: new Spring(place.u),
      z: new Spring(0.02, 260, 22),
      r: new Spring(place.r, 150, 18),
      s: new Spring(place.s, 240, 21),
      o: new Spring(0, 120, 22),
      order: 0,
      leaving: false,
    };
    const start = from && this.local(from.x, from.y, 1.5);
    if (start && !this.still.matches) {
      item.x.v = start.x;
      item.u.v = start.y;
      item.z.v = Math.max(0.1, start.z);
      item.s.v = place.s * 0.42;
      item.r.v = place.r - 0.35;
    } else if (!this.still.matches) {
      item.z.v = 0.16;
      item.s.v = place.s * 0.86;
    } else item.o.snap(1);
    item.o.t = 1;
    const ready = () => {
      group.visible = shadow.visible = true;
      mat.map = entry.tex;
      mat.needsUpdate = true;
      shadow.material.uniforms.map.value = entry.tex;
      if (size > 0) {
        item.w = size;
        item.h = size / entry.aspect;
      } else {
        item.h = -size;
        item.w = -size * entry.aspect;
      }
    };
    entry.tex ? ready() : entry.waiting.push(ready);
    this.items.set(g.id, item);
    return item;
  }

  leave(item) {
    item.leaving = true;
    if (this.still.matches) return this.dispose(item);
    item.o.t = 0;
    item.s.t = item.s.v * 0.5;
    item.u.t = -SLAB.length / 2 - 0.5;
    item.z.t = 0.3;
  }

  dispose(item) {
    this.slab.remove(item.group, item.shadow);
    item.mesh.geometry.dispose();
    item.mesh.material.dispose();
    item.shadow.geometry.dispose();
    item.shadow.material.dispose();
    if (this.items.get(item.id) === item) this.items.delete(item.id);
  }

  select(id, silent) {
    if (this.selected === id) return;
    this.selected = id;
    if (!silent) this.events.onSelect?.(id);
    this.kick();
  }

  setView(view) {
    this.view = view;
    this.frameView();
    this.kick();
  }

  frameView() {
    const aspect = this.camera.aspect || 0.46;
    const c = this.cam;
    if (this.view === 'model') {
      c.x.t = 0;
      c.y.t = 1.16;
      c.z.t = 1.7;
      c.tx.t = 0;
      c.ty.t = 0.9;
      c.tz.t = -2.2;
      c.fov.t = aspect < 0.8 ? 33 : 26;
    } else {
      c.x.t = 0;
      c.y.t = 2.3;
      c.z.t = 3.42;
      c.tx.t = 0;
      // Solve pitch and field of view so the mannequin's head clears the
      // assistant (140px) and the slab's near edge meets the deck (200px).
      const height = this.canvas.clientHeight || 844,
        top = 140 / height,
        bottom = 1 - 200 / height,
        rad = Math.PI / 180;
      let pitch = 28.6,
        half = Math.tan(32 * rad),
        miss = Infinity;
      for (let p = 16; p <= 42; p += 0.25) {
        const t = Math.tan((p - 6.2) * rad) / (2 * (0.5 - top));
        const at = 0.5 + Math.tan((45.4 - p) * rad) / (2 * t);
        if (Math.abs(at - bottom) < miss) {
          miss = Math.abs(at - bottom);
          pitch = p;
          half = t;
        }
      }
      half = Math.max(half, 0.255 / aspect);
      c.ty.t = c.y.t - Math.tan(pitch * rad) * c.z.t;
      c.tz.t = 0;
      c.fov.t = T.MathUtils.clamp((2 * Math.atan(half)) / rad, 40, 78);
    }
    if (this.still.matches || !this.framed) {
      Object.values(c).forEach((s) => s.snap());
      this.framed = true;
    }
  }

  setMood(colours, signal) {
    this.tintGoal = moodTint(colours);
    this.glow.t = signal === 'acting' || signal === 'proposed' ? 1 : signal === 'thinking' ? 0.6 : 0;
    const scanning = signal === 'thinking' || signal === 'acting';
    if (scanning && !this.scan.active) this.scan.t = -1.2;
    this.scan.active = scanning && !this.still.matches;
    this.kick();
  }

  setMorphs(values) {
    const mesh = this.figureMesh;
    if (!mesh?.morphTargetDictionary) return;
    for (const [name, value] of Object.entries(values)) {
      const i = mesh.morphTargetDictionary[name];
      if (i !== undefined) mesh.morphTargetInfluences[i] = value;
    }
    this.kick();
  }

  // ── Geometry helpers ───────────────────────────────────────────────────
  pointer(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return new T.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  }
  /** Client point → slab-local coordinates; at `distance` along the ray, or on the slab plane. */
  local(x, y, distance) {
    this.ray.setFromCamera(this.pointer(x, y), this.camera);
    const { origin, direction } = this.ray.ray;
    if (distance) return this.slab.worldToLocal(origin.clone().addScaledVector(direction, distance));
    const o = this.slab.worldToLocal(origin.clone());
    const d = this.slab.worldToLocal(origin.clone().add(direction)).sub(o);
    if (Math.abs(d.z) < 1e-5) return null;
    const t = -o.z / d.z;
    return t > 0 ? o.addScaledVector(d, t) : null;
  }
  hit(x, y) {
    const p = this.local(x, y);
    if (!p) return null;
    for (let i = this.order.length - 1; i >= 0; i--) {
      const item = this.items.get(this.order[i]);
      if (!item || item.leaving) continue;
      const dx = p.x - item.x.v,
        dy = p.y - item.u.v,
        c = Math.cos(-item.r.v),
        s = Math.sin(-item.r.v);
      const lx = (dx * c - dy * s) / (item.w * item.s.v) + 0.5,
        ly = (dx * s + dy * c) / (item.h * item.s.v) + 0.5;
      if (lx < 0 || lx > 1 || ly < 0 || ly > 1) continue;
      const a = item.entry.alpha;
      if (a) {
        const px = Math.min(55, Math.floor(lx * 56)),
          py = Math.min(55, Math.floor((1 - ly) * 56));
        if (a[(py * 56 + px) * 4 + 3] < 24) continue;
      }
      return { item, point: p };
    }
    return null;
  }
  anchor(item) {
    const top = new T.Vector3(item.x.v, item.u.v + (item.h * item.s.v) / 2, item.z.v);
    const world = this.slab.localToWorld(top).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((world.x + 1) / 2) * rect.width, y: ((1 - world.y) / 2) * rect.height };
  }

  // ── Input ──────────────────────────────────────────────────────────────
  bind() {
    const c = this.canvas;
    this.handlers = {
      pointerdown: (e) => this.down(e),
      pointermove: (e) => this.move(e),
      pointerup: (e) => this.up(e),
      pointercancel: (e) => this.up(e),
      wheel: (e) => this.wheel(e),
    };
    for (const [name, fn] of Object.entries(this.handlers))
      c.addEventListener(name, fn, { passive: name !== 'wheel' });
    c.style.touchAction = 'none';
  }
  down(e) {
    if (e.button > 0) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.drag?.item) {
      const [a, b] = [...this.pointers.values()];
      this.drag.pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        a: Math.atan2(a.y - b.y, a.x - b.x),
        s: this.drag.item.s.t,
        r: this.drag.item.r.t,
      };
      return;
    }
    if (this.pointers.size > 1) return;
    const found = this.view === 'table' ? this.hit(e.clientX, e.clientY) : null;
    if (found) {
      const { item, point } = found;
      this.drag = {
        item,
        id: e.pointerId,
        ox: point.x - item.x.v,
        ou: point.y - item.u.v,
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
      };
      this.select(item.id);
      // Bring to the top of the stack.
      this.order = [...this.order.filter((id) => id !== item.id), item.id];
      this.order.forEach((id, n) => {
        const it = this.items.get(id);
        if (it) it.order = n;
      });
    } else {
      this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, turn: this.turn.t, moved: false };
    }
    this.kick();
  }
  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const d = this.drag;
    if (!d) return;
    if (d.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y),
        angle = Math.atan2(a.y - b.y, a.x - b.x);
      d.item.s.t = T.MathUtils.clamp((d.pinch.s * dist) / d.pinch.d, 0.5, 1.9);
      d.item.r.t = d.pinch.r - (angle - d.pinch.a);
      d.moved = true;
      return this.kick();
    }
    if (e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.moved = true;
    if (d.item) {
      if (d.item.locked) return;
      const point = this.local(e.clientX, e.clientY);
      if (!point) return;
      d.item.x.t = T.MathUtils.clamp(point.x - d.ox, -SLAB.width / 2 + 0.06, SLAB.width / 2 - 0.06);
      d.item.u.t = T.MathUtils.clamp(point.y - d.ou, -SLAB.length / 2 - 0.3, SLAB.length / 2 - 0.06);
      d.away = d.item.u.t < -SLAB.length / 2 - 0.12;
    } else if (this.view === 'model') {
      this.turn.t = d.turn + (e.clientX - d.sx) * 0.011;
    }
    this.kick();
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.pinch && this.pointers.size < 2) {
      d.pinch = null;
      if (this.pointers.size) return;
    }
    if (e.pointerId !== d.id && this.pointers.size) return;
    this.drag = null;
    if (d.item) {
      if (d.away && !d.item.locked) this.events.onRemove?.(d.item.id);
      else {
        d.item.u.t = Math.max(d.item.u.t, -SLAB.length / 2 + 0.06);
        if (d.moved) this.commit();
      }
    } else if (!d.moved && this.view === 'table') this.select(null);
    this.kick();
  }
  wheel(e) {
    const found = this.view === 'table' && this.hit(e.clientX, e.clientY);
    if (!found || found.item.locked) return;
    e.preventDefault();
    const item = found.item;
    if (e.shiftKey) item.r.t += (e.deltaY || e.deltaX) * 0.0022;
    else item.s.t = T.MathUtils.clamp(item.s.t * Math.exp(-e.deltaY * 0.0016), 0.5, 1.9);
    this.select(item.id);
    clearTimeout(this.wheelDone);
    this.wheelDone = setTimeout(() => this.commit(), 220);
    this.kick();
  }
  /** Adjust the selected garment from DOM controls (keyboard-accessible path). */
  nudge(change) {
    const item = this.items.get(this.selected);
    if (!item || item.locked) return;
    if (change.s) item.s.t = T.MathUtils.clamp(item.s.t * change.s, 0.5, 1.9);
    if (change.r) item.r.t += change.r;
    if (change.x) item.x.t = T.MathUtils.clamp(item.x.t + change.x, -SLAB.width / 2 + 0.06, SLAB.width / 2 - 0.06);
    if (change.u) item.u.t = T.MathUtils.clamp(item.u.t + change.u, -SLAB.length / 2 + 0.06, SLAB.length / 2 - 0.06);
    this.commit();
    this.kick();
  }
  commit() {
    const layout = {};
    for (const id of this.order) {
      const item = this.items.get(id);
      if (item && !item.leaving)
        layout[id] = {
          x: +item.x.t.toFixed(3),
          u: +item.u.t.toFixed(3),
          r: +item.r.t.toFixed(3),
          s: +item.s.t.toFixed(3),
        };
    }
    this.events.onLayout?.(layout, [...this.order]);
  }

  // ── Loop ───────────────────────────────────────────────────────────────
  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    const budget = 2.6e6;
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(budget / (w * h)));
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frameView();
    this.kick();
  }
  kick() {
    if (this.frame || this.gone) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }
  tick(now) {
    this.frame = 0;
    if (this.gone) return;
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let busy = false;
    const still = this.still.matches;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    const run = (spring) => {
      if (still) {
        spring.snap();
        return false;
      }
      let moving = false;
      for (let i = 0; i < steps; i++) moving = spring.step(h);
      return moving;
    };
    for (const spring of Object.values(this.cam)) busy = run(spring) || busy;
    busy = run(this.turn) || busy;
    busy = run(this.glow) || busy;
    this.sink.t = this.view === 'model' ? 1 : 0;
    busy = run(this.sink) || busy;
    this.slab.position.y = CENTRE.y - Math.max(0, this.sink.v) * 1.25;
    this.slab.visible = this.sink.v < 0.985;
    this.camera.position.set(this.cam.x.v, this.cam.y.v, this.cam.z.v);
    this.camera.fov = this.cam.fov.v;
    this.camera.lookAt(this.cam.tx.v, this.cam.ty.v, this.cam.tz.v);
    this.camera.updateProjectionMatrix();
    this.figure.rotation.y = this.turn.v;

    if (!this.tint.equals(this.tintGoal)) {
      this.tint.lerp(this.tintGoal, still ? 1 : 1 - Math.exp(-dt * 3));
      const diff = Math.abs(this.tint.r - this.tintGoal.r) + Math.abs(this.tint.g - this.tintGoal.g) + Math.abs(this.tint.b - this.tintGoal.b);
      if (diff < 0.004) this.tint.copy(this.tintGoal);
      else busy = true;
    }
    this.rim.color.copy(this.tint).lerp(BRAND.optical, 0.35);
    for (const m of [this.sky.material, this.floor.material, this.sheet.material]) m.uniforms.uGlow.value = this.glow.v;
    if (this.scan.active) {
      this.scan.t += dt * 0.95;
      if (this.scan.t > 1.3) this.scan.t = -1.3;
      busy = true;
    } else if (this.scan.t > -1.35) {
      this.scan.t += dt * 1.6;
      if (this.scan.t < 1.35) busy = true;
      else this.scan.t = -1.4;
    }
    this.sheet.material.uniforms.uScan.value = this.scan.t;

    const chosen = this.items.get(this.selected);
    this.pool.t = chosen && !chosen.leaving ? 1 : 0;
    busy = run(this.pool) || busy;
    if (chosen) this.sheet.material.uniforms.uPool.value.set(chosen.x.v, chosen.u.v, this.pool.v);
    else this.sheet.material.uniforms.uPool.value.z = this.pool.v;

    for (const item of [...this.items.values()]) {
      const held = this.drag?.item === item && this.drag.moved;
      if (!item.leaving) item.z.t = held ? 0.1 : item.id === this.selected ? 0.03 : 0.006;
      let moving = false;
      for (const key of ['x', 'u', 'z', 'r', 's', 'o']) moving = run(item[key]) || moving;
      busy = moving || busy;
      if (item.leaving && item.o.v < 0.03) {
        this.dispose(item);
        continue;
      }
      const lift = Math.max(0, item.z.v);
      const tilt = held && !still ? T.MathUtils.clamp(item.x.s * 0.06, -0.14, 0.14) : 0;
      item.group.position.set(item.x.v, item.u.v, lift + item.order * 0.0016);
      item.group.rotation.set(0, tilt, item.r.v);
      item.group.scale.set(item.w * item.s.v, item.h * item.s.v, 1);
      item.mesh.material.opacity = T.MathUtils.clamp(item.o.v, 0, 1);
      item.mesh.renderOrder = 10 + item.order * 2 + (held ? 400 : 0);
      item.shadow.renderOrder = item.mesh.renderOrder - 1;
      item.shadow.position.set(item.x.v + 0.012 + lift * 0.42, item.u.v - 0.014 - lift * 0.5, 0.0012 + item.order * 0.0016);
      item.shadow.rotation.z = item.r.v;
      item.shadow.scale.set(item.w * item.s.v * 1.18, item.h * item.s.v * 1.18, 1);
      item.shadow.material.uniforms.uBlur.value = Math.min(1, lift * 9);
      item.shadow.material.uniforms.uAlpha.value = item.o.v * (0.34 - Math.min(0.16, lift * 1.6));
    }

    this.renderer.render(this.scene, this.camera);
    if (chosen && !chosen.leaving && !this.drag?.moved && this.view === 'table') this.events.onAnchor?.(this.anchor(chosen), chosen.id);
    else this.events.onAnchor?.(null, null);
    if (busy || this.drag) this.frame = requestAnimationFrame(this.tick);
  }

  destroy() {
    this.gone = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.wheelDone);
    this.observer.disconnect();
    for (const [name, fn] of Object.entries(this.handlers)) this.canvas.removeEventListener(name, fn);
    for (const item of [...this.items.values()]) this.dispose(item);
    for (const entry of this.textures.values()) entry.tex?.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
