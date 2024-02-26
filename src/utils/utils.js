import * as d3 from "d3";
import {
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Shape,
  ShapeGeometry,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { mergeBufferGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";

export const initCoord = (n) => {
  let res = typeof n === "string" ? JSON.parse(n) : n;
  let o = res.features;
  for (let e = 0; e < o.length; e++) {
    const t = o[e];
    ["Polygon"].includes(t.geometry.type) &&
      (t.geometry.coordinates = [t.geometry.coordinates]);
  }
  return res;
};

export class ProvinceSide {
  constructor(time, r = {}) {
    this.mapGroup = new Group();
    this.time = time;
    this.coordinates = [];
    this.config = Object.assign(
      {
        position: new Vector3(0, 0, 0),
        center: new Vector2(0, 0),
        data: "",
        renderOrder: 1,
        topFaceMaterial: new MeshBasicMaterial({
          color: "rgb(92,187,246)",
          transparent: true,
          opacity: 0.5,
        }),
        sideMaterial: new MeshBasicMaterial({
          color: "rgba(38,83,134,0.6)",
          transparent: true,
          opacity: 0.5,
        }),
        depth: 0.1,
      },
      r
    );

    this.mapGroup.position.copy(this.config.position);
    let res = initCoord(this.config.data);
    this.create(res);
  }
  create(geoJson) {
    geoJson.features.forEach((item) => {
      const objects = new Object3D();
      let { name, center = [], centroid = [] } = item.properties;
      this.coordinates.push({ name, center, centroid });
      const settings = {
        depth: this.config.depth,
        bevelEnabled: true,
        bevelSegments: 1,
        bevelThickness: 0.1,
      };

      let extrudeMat = this.createMaterial();

      item.geometry.coordinates.forEach((u) => {
        u.forEach((s, m) => {
          const shapes = new Shape();
          for (let l = 0; l < s.length; l++) {
            if (!s[l][0] || !s[l][1]) return false;
            const [b, C] = geoProjection(s[l]);
            l === 0 && shapes.moveTo(b, -C);
            shapes.lineTo(b, -C);
          }
          const extrude = new ExtrudeGeometry(shapes, settings);
          const mesh = new Mesh(extrude, extrudeMat);
          objects.add(mesh);
        });
      });
      this.mapGroup.add(objects);
    });
  }
  createMaterial() {
    let topMat = new MeshLambertMaterial({
      color: "#fff",
      transparent: true,
      opacity: 1,
      fog: false,
      side: 2,
    });
    topMat.onBeforeCompile = (t) => {
      t.uniforms = {
        ...t.uniforms,
        uColor1: { value: new Color("#2a6f72") },
        uColor2: { value: new Color("#1c4f64") },
      };
      t.vertexShader = t.vertexShader.replace(
        "void main() {",
        `
        attribute float alpha;
        varying vec3 vPosition;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vPosition = position;
      `
      );
      t.fragmentShader = t.fragmentShader.replace(
        "void main() {",
        `
        varying vec3 vPosition;
        varying float vAlpha;
        uniform vec3 uColor1;
        uniform vec3 uColor2;

        void main() {
      `
      );
      t.fragmentShader = t.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
      #ifdef OPAQUE
      diffuseColor.a = 1.0;
      #endif

      // https://github.com/mrdoob/three.js/pull/22425
      #ifdef USE_TRANSMISSION
      diffuseColor.a *= transmissionAlpha + 0.1;
      #endif
      vec3 gradient = mix(uColor1, uColor2, vPosition.x/15.78); // 15.78

      outgoingLight = outgoingLight*gradient;
      float topAlpha = 0.5;
      if(vPosition.z>0.3){
        diffuseColor.a *= topAlpha;
      }

      gl_FragColor = vec4( outgoingLight, diffuseColor.a  );
      `
      );
    };
    const textureLoader = new TextureLoader();
    let texture = textureLoader.load("data/map/side.png");
    texture.wrapS = 1000;
    texture.wrapT = 1000;
    texture.repeat.set(1, 1.5);
    texture.offset.y += 0.065;
    let sideMat = new MeshBasicMaterial({
      color: "#1b3e80",
      map: texture,
      fog: false,
      opacity: 1,
      side: 2,
    });
    this.time.on("tick", () => {
      texture.offset.y += 0.01;
    });
    sideMat.onBeforeCompile = (t) => {
      t.uniforms = {
        ...t.uniforms,
        uColor1: { value: new Color("#2a6f72") },
        uColor2: { value: new Color("#2a6f72") },
      };
      t.vertexShader = t.vertexShader.replace(
        "void main() {",
        `
        attribute float alpha;
        varying vec3 vPosition;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vPosition = position;
      `
      );
      t.fragmentShader = t.fragmentShader.replace(
        "void main() {",
        `
        varying vec3 vPosition;
        varying float vAlpha;
        uniform vec3 uColor1;
        uniform vec3 uColor2;

        void main() {
      `
      );
      t.fragmentShader = t.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
      #ifdef OPAQUE
      diffuseColor.a = 1.0;
      #endif

      // https://github.com/mrdoob/three.js/pull/22425
      #ifdef USE_TRANSMISSION
      diffuseColor.a *= transmissionAlpha + 0.1;
      #endif
      vec3 gradient = mix(uColor1, uColor2, vPosition.z/1.2);

      outgoingLight = outgoingLight*gradient;


      gl_FragColor = vec4( outgoingLight, diffuseColor.a  );
      `
      );
    };
    return [topMat, sideMat];
  }
  getCoordinates() {
    return this.coordinates;
  }
  setParent(e) {
    e.add(this.mapGroup);
  }
}

export class Country {
  constructor(opt = {}) {
    this.mapGroup = new Group();
    this.coordinates = [];
    this.config = Object.assign(
      {
        position: new Vector3(0, 0, 0),
        center: new Vector2(0, 0),
        data: "",
        renderOrder: 1,
        merge: false,
        material: new MeshBasicMaterial({
          color: "#18263b",
          transparent: true,
          opacity: 1,
        }),
      },
      opt
    );
    this.mapGroup.position.copy(this.config.position);
    let coord = initCoord(this.config.data);
    this.create(coord);
  }
  create(jsonData) {
    let { merge } = this.config;
    let geometryCollection = [];
    jsonData.features.forEach((item) => {
      const obj = new Object3D();
      let { name, center, centroid } = item.properties;
      this.coordinates.push({ name, center, centroid });
      obj.userData.name = name;
      item.geometry.coordinates.forEach((u) => {
        u.forEach((s) => {
          const m = new Shape();
          for (let o = 0; o < s.length; o++) {
            if (!s[o][0] || !s[o][1]) return !1;
            const [p, l] = geoProjection(s[o]);
            if (!isNaN(p) && !isNaN(l)) {
              o === 0 && m.moveTo(p, -l);
              m.lineTo(p, -l);
            }
          }
          const shape = new ShapeGeometry(m);
          if (merge) geometryCollection.push(shape);
          else {
            const shapeMesh = new Mesh(shape, this.config.material);
            shapeMesh.renderOrder = this.config.renderOrder;
            shapeMesh.userData.name = name;
            obj.add(shapeMesh);
          }
        });
      });
      merge || this.mapGroup.add(obj);
    });
    if (merge) {
      let geo = mergeBufferGeometries(geometryCollection);
      const mesh = new Mesh(geo, this.config.material);
      mesh.renderOrder = this.config.renderOrder;
      this.mapGroup.add(mesh);
    }
  }
  getCoordinates() {
    return this.coordinates;
  }
  setParent(e) {
    e.add(this.mapGroup);
  }
}

export function geoProjection(e) {
  return d3.geoMercator().center([0, 0]).scale(120).translate([0, 0])(e);
}

export class Diffuse {
  constructor({
    pointMaterial,
    time,
    gridSize,
    diffuseColor,
    diffuseSpeed,
    diffuseWidth,
    diffuseDir,
  }) {
    this.time = time;

    this.options = Object.assign(
      {},
      {
        pointMaterial,
        gridSize,
        diffuseColor,
        diffuseSpeed,
        diffuseWidth,
        diffuseDir,
      }
    );
    this.init();
  }
  init() {
    let material = null;
    const {
      pointMaterial,
      diffuseColor,
      diffuseSpeed,
      diffuseWidth,
      gridSize,
    } = this.options;
    let limit = gridSize / diffuseSpeed;
    pointMaterial.onBeforeCompile = (mat) => {
      material = mat;

      mat.uniforms = {
        ...mat.uniforms,
        uTime: { value: 0 },
        uSpeed: { value: diffuseSpeed },
        uWidth: { value: diffuseWidth },
        uColor: { value: new Color(diffuseColor) },
        uDir: { value: 10 },
      };
      mat.vertexShader = mat.vertexShader.replace(
        "void main() {",
        `
            varying vec3 vPosition;
            void main(){
              vPosition = position;
          `
      );
      mat.fragmentShader = mat.fragmentShader.replace(
        "void main() {",
        `
          uniform float uTime;
          uniform float uSpeed;
          uniform float uWidth;
          uniform vec3 uColor;
          uniform float uDir;
          varying vec3 vPosition;

          void main(){
        `
      );
      mat.fragmentShader = mat.fragmentShader.replace(
        "#include <output_fragment>",
        `
          #ifdef OPAQUE
          diffuseColor.a = 1.0;
          #endif

          #ifdef USE_TRANSMISSION
          diffuseColor.a *= material.transmissionAlpha;
          #endif

          float r = uTime * uSpeed;
          //光环宽度
          float w = 0.0;
          if(w>uWidth){
            w = uWidth;
          }else{
            w = uTime * 5.0;
          }
          //几何中心点
          vec2 center = vec2(0.0, 0.0);
          // 距离圆心的距离

          float rDistance = distance(vPosition.xz, center);
          if(uDir==2.0){
            rDistance = distance(vPosition.xy, center);
          }
          if(rDistance > r && rDistance < r + 2.0 * w) {
            float per = 0.0;
            if(rDistance < r + w) {
              per = (rDistance - r) / w;
              outgoingLight = mix(outgoingLight, uColor, per);
            } else {
              per = (rDistance - r - w) / w;
              outgoingLight = mix(uColor, outgoingLight, per);
            }
            gl_FragColor = vec4(outgoingLight, diffuseColor.a);
          } else {
            gl_FragColor = vec4(outgoingLight, 0.0);
          }
        `
      );
    };
    this.time.on("tick", (val) => {
      if (!material) return;
      material.uniforms.uTime.value += val;
      material.uniforms.uTime.value > limit &&
        (material.uniforms.uTime.value = 0);
    });
  }
}
export class Emitter {
  constructor() {
    this.events = new Map();
  }
  on(e, t) {
    let s = this.events.get(e);
    s || ((s = new Set()), this.events.set(e, s)), s.add(t);
  }
  off(e, t) {
    const s = this.events.get(e);
    s && (t ? s.delete(t) : this.events.delete(e));
  }
  emit(e, ...t) {
    const s = this.events.get(e);
    s &&
      s.forEach((n) => {
        n(...t);
      });
  }
  once(e, t) {
    const s = (...n) => {
      t(...n);
      this.off(e, s);
    };
    this.on(e, s);
  }
}
export class Timer extends Emitter {
  constructor() {
    super();
    this.start = Date.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 16;
    this.clock = new Clock();
    this.timer = window.requestAnimationFrame(() => {
      this.tick();
    });
  }
  tick() {
    const e = Date.now();
    this.delta = e - this.current;
    this.current = e;
    this.elapsed = this.current - this.start;
    const t = this.clock.getDelta(),
      s = this.clock.getElapsedTime();
    if (this.emit("tick", t, s) && this.stop)
      return window.cancelAnimationFrame(this.timer);
    this.timer = window.requestAnimationFrame(() => {
      this.tick();
    });
  }
  destroy() {
    this.stop = true;
    this.off("tick");
  }
}

export class InitShader {
  constructor(material, opt) {
    this.shader = null;
    this.config = Object.assign(
      { uColor1: 2780818, uColor2: 860197, size: 15, dir: "x" },
      opt
    );
    this.init(material);
  }
  init(material) {
    let { uColor1, uColor2, dir, size } = this.config,
      h = { x: 1, y: 2, z: 3 };
    material.onBeforeCompile = (r) => {
      this.shader = r;
      r.uniforms = {
        ...r.uniforms,
        uColor1: { value: new Color(uColor1) },
        uColor2: { value: new Color(uColor2) },
        uDir: { value: h[dir] },
        uSize: { value: size },
      };
      r.vertexShader = r.vertexShader.replace(
        "void main() {",
        `
                attribute float alpha;
                varying vec3 vPosition;
                varying float vAlpha;
                void main() {
                  vAlpha = alpha;
                  vPosition = position;
              `
      );
      r.fragmentShader = r.fragmentShader.replace(
        "void main() {",
        `
          varying vec3 vPosition;
          varying float vAlpha;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform float uDir;
          uniform float uSize;

          void main() {
        `
      );
      r.fragmentShader = r.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
            #ifdef OPAQUE
            diffuseColor.a = 1.0;
            #endif

              // https://github.com/mrdoob/three.js/pull/22425
              #ifdef USE_TRANSMISSION
              diffuseColor.a *= transmissionAlpha + 0.1;
              #endif
              // vec3 gradient = mix(uColor1, uColor2, vPosition.x / 15.0);
              vec3 gradient = vec3(0.0,0.0,0.0);
              if(uDir==1.0){
                gradient = mix(uColor1, uColor2, vPosition.x/ uSize);
              }else if(uDir==2.0){
                gradient = mix(uColor1, uColor2, vPosition.z/ uSize);
              }else if(uDir==3.0){
                gradient = mix(uColor1, uColor2, vPosition.y/ uSize);
              }
              outgoingLight = outgoingLight*gradient;


              gl_FragColor = vec4( outgoingLight, diffuseColor.a  );
              `
      );
    };
  }
}

export class CustomPlan {
  constructor({ time: i }, opt) {
    this.time = i;
    this.options = Object.assign(
      {},
      {
        width: 10,
        scale: 1,
        position: new Vector3(0, 0, 0),
        needRotate: false,
        rotateSpeed: 0.001,
        material: new MeshBasicMaterial({
          transparent: true,
          opacity: 1,
          depthTest: true,
        }),
      },
      opt
    );
    const planGeo = new PlaneGeometry(this.options.width, this.options.width);
    const plan = new Mesh(planGeo, this.options.material);
    plan.position.copy(this.options.position);
    plan.scale.set(this.options.scale, this.options.scale, this.options.scale);
    this.instance = plan;
  }
  setParent(i) {
    i.add(this.instance);
    this.time.on("tick", () => {
      this.update();
    });
  }
  update() {
    this.options.needRotate &&
      (this.instance.rotation.z += this.options.rotateSpeed);
  }
}

class CustomTexture extends Texture {
  constructor(
    image,
    mapping,
    wrapS,
    wrapT,
    magFilter,
    minFilter,
    format,
    type,
    anisotropy
  ) {
    super(
      image,
      mapping,
      wrapS,
      wrapT,
      magFilter,
      minFilter,
      format,
      type,
      anisotropy
    );
    this.isCanvasTexture = true;
    this.needsUpdate = true;
  }
}
export class Particle {
  constructor({ time }, config = {}) {
    this.instance = null;
    this.time = time;
    this.enable = true;
    this.config = Object.assign(
      {
        num: 100,
        range: 500,
        speed: 0.01,
        renderOrder: 99,
        dir: "up",
        material: new PointsMaterial({
          map: Particle.createTexture(),
          size: 20,
          color: 16777215,
          transparent: true,
          opacity: 1,
          depthTest: false,
          vertexColors: true,
          blending: 2,
          sizeAttenuation: true,
        }),
      },
      config
    );
    this.create();
  }
  create() {
    const { range, dir, material, num, renderOrder } = this.config;
    const position = [];
    const colors = [];
    const velocities = [];
    for (let d = 0; d < num; d++) {
      position.push(
        Math.random() * range - range / 2,
        Math.random() * range - range / 2,
        Math.random() * range - range / 2
      );
      let direction = dir === "up" ? 1 : -1;
      velocities.push(
        Math.random() * direction,
        (0.1 + Math.random()) * direction,
        0.1 + Math.random() * direction
      );
      const color = material.color.clone();
      let hsl = {};
      color.getHSL(hsl);
      color.setHSL(hsl.h, hsl.s, hsl.l * Math.random());
      colors.push(color.r, color.g, color.b);
    }
    const geo = new BufferGeometry();
    geo.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(position), 3)
    );
    geo.setAttribute(
      "velocities",
      new BufferAttribute(new Float32Array(velocities), 3)
    );
    geo.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    this.instance = new Points(geo, material);
    this.instance.renderOrder = renderOrder;
  }
  static createTexture() {
    let ele = document.createElement("canvas");
    ele.width = 1024;
    ele.height = 1024;
    let canvas = ele.getContext("2d");
    let gradientColor = canvas.createRadialGradient(512, 512, 0, 512, 512, 512);
    gradientColor.addColorStop(0, "rgba(255,255,255,1)");
    gradientColor.addColorStop(1, "rgba(255,255,255,0)");
    canvas.fillStyle = gradientColor;
    canvas.fillRect(0, 0, 1024, 1024);
    return new CustomTexture(ele);
  }
  update(e, s) {
    if (!this.instance) return false;
    const { range, speed, dir } = this.config;
    const direction = dir === "up" ? 1 : -1;
    const positions = this.instance.geometry.getAttribute("position");
    const velocities = this.instance.geometry.getAttribute("velocities");
    const count = positions.count;
    for (let t = 0; t < count; t++) {
      let px = positions.getX(t);
      positions.getY(t);
      let pz = positions.getZ(t),
        vx = velocities.getX(t),
        vy = velocities.getY(t);
      velocities.getZ(t);
      px += Math.sin(vx * s) * e;
      pz += speed * direction;
      pz > range / 2 && direction === 1 && (pz = -range / 2);
      pz < -range / 2 && direction === -1 && (pz = range / 2);
      positions.setX(t, px);
      positions.setZ(t, pz);
      velocities.setX(t, vx);
      velocities.setY(t, vy);
    }
    positions.needsUpdate = true;
    velocities.needsUpdate = true;
  }
  setParent(ele) {
    ele.add(this.instance);
    this.time.on("tick", (s, n) => {
      this.enable && this.update(s, n);
    });
  }
}
