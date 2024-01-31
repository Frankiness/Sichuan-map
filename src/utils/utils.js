import * as THREE from "three";
import * as d3 from "d3";
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
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
    this.mapGroup = new THREE.Group();
    this.time = time;
    this.coordinates = [];
    this.config = Object.assign(
      {
        position: new THREE.Vector3(0, 0, 0),
        center: new THREE.Vector2(0, 0),
        data: "",
        renderOrder: 1,
        topFaceMaterial: new THREE.MeshBasicMaterial({
          color: "rgb(92,187,246)",
          transparent: true,
          opacity: 1,
        }),
        sideMaterial: new THREE.MeshBasicMaterial({
          color: 464171,
          transparent: true,
          opacity: 1,
        }),
        depth: 0.1,
      },
      r
    );

    this.mapGroup.position.copy(this.config.position);
    let res = initCoord(this.config.data);
    this.create(res);
  }
  geoProjection(e) {
    return d3
      .geoMercator()
      .center(this.config.center)
      .scale(120)
      .translate([0, 0])(e);
  }
  create(geoJson) {
    geoJson.features.forEach((item) => {
      const objects = new THREE.Object3D();
      let { name, center = [], centroid = [] } = item.properties;
      this.coordinates.push({ name, center, centroid });
      const settings = {
        depth: this.config.depth,
        bevelEnabled: true,
        bevelSegments: 1,
        bevelThickness: 0.1,
      };
      // let extrudeMat = [this.config.topFaceMaterial, this.config.sideMaterial];
      let extrudeMat = this.createMaterial();
      item.geometry.coordinates.forEach((u) => {
        u.forEach((s, m) => {
          const shapes = new THREE.Shape();
          for (let l = 0; l < s.length; l++) {
            if (!s[l][0] || !s[l][1]) return !1;
            const [b, C] = this.geoProjection(s[l]);
            l === 0 && shapes.moveTo(b, -C);
            shapes.lineTo(b, -C);
          }
          const extrude = new THREE.ExtrudeGeometry(shapes, settings);
          const mesh = new THREE.Mesh(extrude, extrudeMat);
          objects.add(mesh);
        });
      });
      this.mapGroup.add(objects);
    });
  }
  createMaterial() {
    let topMat = new MeshLambertMaterial({
      color: 16777215,
      transparent: true,
      opacity: 1,
      fog: false,
      side: 2,
    });
    topMat.onBeforeCompile = (t) => {
      t.uniforms = {
        ...t.uniforms,
        uColor1: { value: new Color(2781042) },
        uColor2: { value: new Color(860197) },
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
    const textureLoader = new THREE.TextureLoader();
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
        uColor1: { value: new Color(2781042) },
        uColor2: { value: new Color(2781042) },
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
  constructor({}, opt = {}) {
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
          color: 1582651,
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
  geoProjection(e) {
    return d3
      .geoMercator()
      .center(this.config.center)
      .scale(120)
      .translate([0, 0])(e);
  }
  create(jsonData) {
    let { merge } = this.config,
      r = [];
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
            const [p, l] = this.geoProjection(s[o]);
            if (!isNaN(p) && !isNaN(l)) {
              o === 0 && m.moveTo(p, -l);
              m.lineTo(p, -l);
            }
          }
          const shape = new ShapeGeometry(m);
          if (merge) r.push(shape);
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
      let geo = mergeBufferGeometries(r);
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
