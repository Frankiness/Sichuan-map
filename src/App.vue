<template>
  <div id="app-32-map" class="is-full"></div>
</template>

<script>
import BaseEarth from "@/utils/Earth.js";
import TWEEN from "@tweenjs/tween.js";
import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { onBeforeUnmount, onMounted } from "vue";
import { random } from "@/utils";
import useFileLoader from "@/hooks/useFileLoader.js";
import useCoord from "@/hooks/useCoord.js";
import useConversionStandardData from "@/hooks/useConversionStandardData.js";
import useMapMarkedLightPillar from "@/hooks/map/useMapMarkedLightPillar";
import useSequenceFrameAnimate from "@/hooks/useSequenceFrameAnimate";
import useCSS2DRender from "@/hooks/useCSS2DRender";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import { regionData } from "@/utils/data";
import FlyLine from "@/hooks/useFlyLine";
import { Country, ProvinceSide } from "@/utils/utils";
import { Line } from "@/hooks/useLine";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  Fog,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  PointLightHelper,
  TextureLoader,
  MeshLambertMaterial,
  LineBasicMaterial
} from "three";

let centerXY = [120.109913, 29.181466];
let flyLineCenter = [119.476498, 29.898918];

let position = new THREE.Vector3(0, 0, 0),
  gridSize = 100,
  gridDivision = 20,
  gridColor = 2635578,
  shapeSize = 1,
  shapeColor = 0x3464a2,
  pointSize = 0.15,
  pointColor = "rgba(20,39,54,0.78)",
  pointLayout = { row: 200, col: 200 },
  pointBlending = THREE.CustomBlending,
  diffuse = false,
  diffuseSpeed = 15,
  diffuseColor = 0x3464a2,
  diffuseWidth = 10;

class Diffuse {
  constructor({
    pointMaterial,
    time,
    size,
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
        size,
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
    const { pointMaterial, diffuseColor, diffuseSpeed, diffuseWidth } =
      this.options;
    let limit = gridSize / diffuseSpeed;
    pointMaterial.onBeforeCompile = (mat) => {
      material = mat;

      mat.uniforms = {
        ...mat.uniforms,
        uTime: { value: 0 },
        uSpeed: { value: diffuseSpeed },
        uWidth: { value: diffuseWidth },
        uColor: { value: new THREE.Color(diffuseColor) },
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
class emitter {
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
class Timer extends emitter {
  constructor() {
    super();
    this.start = Date.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 16;
    this.clock = new THREE.Clock();
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

class initShader {
  constructor(i, n) {
    this.shader = null;
    this.config = Object.assign(
      { uColor1: 2781042, uColor2: 860197, size: 15, dir: "x" },
      n
    );
    this.init(i);
  }
  init(i) {
    let { uColor1, uColor2, dir, size } = this.config,
      h = { x: 1, y: 2, z: 3 };
    i.onBeforeCompile = (r) => {
      this.shader = r;
      r.uniforms = {
        ...r.uniforms,
        uColor1: { value: new THREE.Color(uColor1) },
        uColor2: { value: new THREE.Color(uColor2) },
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

export default {
  name: "3dMap30",
  setup() {
    let baseEarth = null;

    // 重置
    const resize = () => {
      baseEarth.resize();
    };

    const { requestData } = useFileLoader();
    const { transfromGeoJSON } = useConversionStandardData();
    const { getBoundingBox } = useCoord();
    // const { createCountryFlatLine } = useCountry();
    const { initCSS2DRender, create2DTag } = useCSS2DRender();
    const { createLightPillar } = useMapMarkedLightPillar({
      scaleFactor: 1.2,
    });
    // 序列帧
    const { createSequenceFrame } = useSequenceFrameAnimate();

    const texture = new THREE.TextureLoader();
    // const textureMap = texture.load("/data/map/gz-map.jpg");
    // const texturefxMap = texture.load("/data/map/gz-map-fx.jpg");
    const rotatingApertureTexture = texture.load(
      "/data/map/rotation-border-1.png"
    );
    const rotatingPointTexture = texture.load(
      "/data/map/rotation-border-2.png"
    );
    const circlePoint = texture.load("/data/map/circle-point.png");
    // const sceneBg = texture.load("/data/map/ocean-blue-bg.png");
    //
    // sceneBg.colorSpace = "srgb";
    // sceneBg.wrapS = 1000;
    // sceneBg.wrapT = 1000;
    // sceneBg.repeat.set(1, 1);

    // 地形纹理
    // textureMap.wrapS = texturefxMap.wrapS = THREE.RepeatWrapping;
    // textureMap.wrapT = texturefxMap.wrapT = THREE.RepeatWrapping;
    // textureMap.flipY = texturefxMap.flipY = false;
    // textureMap.rotation = texturefxMap.rotation = THREE.MathUtils.degToRad(45);
    // const scale = 0.128;
    // textureMap.repeat.set(scale, scale);
    // texturefxMap.repeat.set(scale, scale);
    // const topFaceMaterial = new THREE.MeshPhongMaterial({
    //   // map: textureMap,
    //   color: 0x3464a2,
    //   combine: THREE.MultiplyOperation,
    //   transparent: true,
    //   opacity: 0.7,
    // });
    // const sideMaterial = new THREE.MeshLambertMaterial({
    //   color: 0x3464a2,
    //   transparent: true,
    //   opacity: 0.7,
    // });
    const bottomZ = -0.2;
    // 初始化gui
    const initGui = () => {
      const gui = new GUI();
      const guiParams = {
        topColor: "#b4eeea",
        sideColor: "#123024",
        scale: 0.1,
      };
      gui.addColor(guiParams, "topColor").onChange((val) => {
        topFaceMaterial.color = new THREE.Color(val);
      });
      gui.addColor(guiParams, "sideColor").onChange((val) => {
        sideMaterial.color = new THREE.Color(val);
      });
      gui.add(guiParams, "scale", 0, 1).onChange((val) => {
        textureMap.repeat.set(val, val);
        texturefxMap.repeat.set(val, val);
      });
    };
    // 初始化旋转光圈
    const initRotatingAperture = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width, width);
      let material = new THREE.MeshBasicMaterial({
        color: 4763647,
        map: rotatingApertureTexture,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        depthTest: true,
        blending: 2,
      });
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, 0);
      mesh.scale.set(1.1, 1.1, 1.1);
      scene.add(mesh);
      return mesh;
    };
    // 初始化旋转点
    const initRotatingPoint = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width, width);
      let material = new THREE.MeshBasicMaterial({
        color: 4763647,
        map: rotatingPointTexture,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        depthTest: true,
        blending: 2,
      });
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, bottomZ - 0.02);
      mesh.scale.set(1.1, 1.1, 1.1);
      scene.add(mesh);
      return mesh;
    };
    // 初始化背景
    const initSceneBg = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width * 4, width * 4);
      let material = new THREE.MeshPhongMaterial({
        color: 0x061920,
        map: sceneBg,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
      });

      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, bottomZ - 0.2);
      scene.add(mesh);
    };
    // 初始化原点
    const initCirclePoint = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width, width);
      let material = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        map: circlePoint,
        transparent: true,
        opacity: 1,
        // depthTest: false,
      });
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, bottomZ - 0.1);
      // let mesh2 = mesh.clone()
      // mesh2.position.set(...centerXY, bottomZ - 0.001)
      scene.add(mesh);
    };
    // 初始化粒子
    const initParticle = (scene, bound) => {
      // 获取中心点和中间地图大小
      let { center, size } = bound;
      // 构建范围，中间地图的2倍
      let minX = center.x - size.x;
      let maxX = center.x + size.x;
      let minY = center.y - size.y;
      let maxY = center.y + size.y;
      let minZ = -6;
      let maxZ = 6;

      let particleArr = [];
      for (let i = 0; i < 16; i++) {
        const particle = createSequenceFrame({
          image: "./data/map/上升粒子1.png",
          width: 180,
          height: 189,
          frame: 9,
          column: 9,
          row: 1,
          speed: 0.5,
        });
        let particleScale = random(5, 10) / 1000;
        particle.scale.set(particleScale, particleScale, particleScale);
        particle.rotation.x = Math.PI / 2;
        let x = random(minX, maxX);
        let y = random(minY, maxY);
        let z = random(minZ, maxZ);
        particle.position.set(x, y, z);
        particleArr.push(particle);
      }
      scene.add(...particleArr);
      return particleArr;
    };

    // 创建光柱
    const initLightPoint = (properties, mapGroup) => {
      if (!properties.centroid && !properties.center) {
        return false;
      }
      // 创建光柱
      let heightScaleFactor = 0.4 + random(1, 5) / 5;
      let lightCenter = properties.centroid || properties.center;
      let light = createLightPillar(...lightCenter, heightScaleFactor);
      light.position.z = 0.31;
      mapGroup.add(light);
    };
    // 创建标签
    const initLabel = (properties, scene) => {
      if (!properties.centroid && !properties.center) {
        return false;
      }
      // 设置标签的显示内容和位置
      const label = create2DTag("标签", "map-32-label");
      scene.add(label);
      let labelCenter = properties.center; //centroid || properties.center
      label.show(properties.name, new THREE.Vector3(...labelCenter, 0.31));
    };
    onMounted(async () => {
      const gui = new GUI();
      // 四川数据
      let provinceData = await requestData("./data/map/浙江省.json");
      provinceData = transfromGeoJSON(provinceData);

      class CurrentEarth extends BaseEarth {
        constructor(props) {
          super(props);
          this.time = new Timer();
        }
        createGridHelper() {
          let gridSize = 50,
            gridDivision = 20,
            gridColor = 1788784;
          const helper = new THREE.GridHelper(
            gridSize,
            gridDivision,
            gridColor
          );
          helper.material = new THREE.MeshBasicMaterial({
            color: "#3464a2",
            opacity: 0.5,
            transparent: true,
          });

          helper.rotateX(THREE.MathUtils.degToRad(90));
          helper.position.set(0, 0, bottomZ - 0.04);
          this.addObject(helper);
        }
        createPoint() {
          const row = pointLayout.row;
          const col = pointLayout.col;
          const positions = new Float32Array(row * col * 3);
          for (let d = 0; d < row; d++)
            for (let c = 0; c < col; c++) {
              let S = 0,
                v = (c / (col - 1)) * gridSize - gridSize / 2,
                m = (d * col + c) * 3;
              positions[m] = (d / (row - 1)) * gridSize - gridSize / 2;
              positions[m + 1] = S;
              positions[m + 2] = v;
            }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          let sprite = new THREE.PointsMaterial({
            size: pointSize,
            sizeAttenuation: true,
            color: pointColor,
            blending: pointBlending,
          });
          const points = new THREE.Points(geo, sprite);
          points.rotateX(THREE.MathUtils.degToRad(90));
          points.position.set(0, 0, bottomZ - 0.04);
          this.addObject(points);
          this.diffuseShader(sprite);
        }
        createPlus(count = 50) {
          let e = count / 6 / 3,
            t = count / 3,
            vertices = [
              new THREE.Vector2(-t, -e),
              new THREE.Vector2(-e, -e),
              new THREE.Vector2(-e, -t),
              new THREE.Vector2(e, -t),
              new THREE.Vector2(e, -t),
              new THREE.Vector2(e, -e),
              new THREE.Vector2(t, -e),
              new THREE.Vector2(t, e),
              new THREE.Vector2(e, e),
              new THREE.Vector2(e, t),
              new THREE.Vector2(-e, t),
              new THREE.Vector2(-e, e),
              new THREE.Vector2(-t, e),
            ];
          let shape = new THREE.Shape(vertices);
          return new THREE.ShapeBufferGeometry(shape, 24);
        }
        createShapes() {
          let s = gridSize / gridDivision,
            l = gridSize / 2,
            mat = new THREE.MeshBasicMaterial({ color: shapeColor, side: 2 }),
            arr = [];
          for (let size = 0; size < gridDivision + 1; size++)
            for (let h = 0; h < gridDivision + 1; h++) {
              let plusGeometry = this.createPlus(shapeSize);
              plusGeometry.translate(-l + size * s, -l + h * s, 0);
              arr.push(plusGeometry);
            }
          let geometry = BufferGeometryUtils.mergeBufferGeometries(arr);
          let mesh = new THREE.Mesh(geometry, mat);
          mesh.renderOrder = -1;
          mesh.rotateZ(-Math.PI / 2);
          mesh.position.set(0, 0, bottomZ - 0.04);
          this.addObject(mesh);
        }
        diffuseShader(material) {
          new Diffuse({
            pointMaterial: material,
            time: this.time,
            gridSize,
            diffuseColor,
            diffuseSpeed,
            diffuseWidth,
          });
        }
        createChinaBlurLine() {
          let chinaLineGeo = new THREE.PlaneGeometry(147, 147);
          const line = texture.load("/data/map/chinaBlurLine.png");
          line.colorSpace = "srgb";
          line.wrapS = 1000;
          line.wrapT = 1000;
          line.generateMipmaps = false;
          line.minFilter = 1003;
          line.repeat.set(1, 1);
          let chinaLineMat = new THREE.MeshBasicMaterial({
            color: 0x3464a2,
            alphaMap: line,
            transparent: true,
            opacity: 0.7,
          });
          const chinaLineMesh = new THREE.Mesh(chinaLineGeo, chinaLineMat);
          chinaLineMesh.position.set(-33.2, 4, -2);
          this.addObject(chinaLineMesh);
        }
        createFlyLine() {
          let arr = [];
          regionData
            .filter((size, n) => n < 7)
            .forEach((item) => {
              arr.push({
                begin: flyLineCenter,
                end: item?.centroid || item.center,
                offset: 0.2,
                height: 5,
              });
            });
          new FlyLine(baseEarth.scene, arr);
        }
        async createProvince() {
          let provinceData = await requestData("data/map/浙江省.json");
          provinceData = transfromGeoJSON(provinceData);
          let [lambertMat, sideMat] = this.createProvinceMaterial();

          let zhejiang = new ProvinceSide(this.time, {
            center: centerXY,
            position: new THREE.Vector3(0, 0, 0.11),
            data: provinceData,
            depth: 0.5,
            topFaceMaterial: lambertMat,
            sideMaterial: sideMat,
            renderOrder: 9,
          });
          let defaultMaterial = new THREE.MeshStandardMaterial({
            color: 16777215,
            transparent: true,
            opacity: 0.5,
          });
          new initShader(defaultMaterial, {
            uColor1: 2780818,
            uColor2: 1058614,
          });
          this.defaultMaterial = defaultMaterial;
          // this.defaultLightMaterial = this.defaultMaterial.clone();
          // this.defaultLightMaterial.emissive.setHex(725293);
          // this.defaultLightMaterial.emissiveIntensity = 3.5;

          let zhejiangTop = new Country(this, {
            center: centerXY,
            position: new THREE.Vector3(0, 0, 0.72),
            data: provinceData,
            material: defaultMaterial,
            renderOrder: 2,
          });
          this.zhejiangLineMaterial = new THREE.LineBasicMaterial({
            color: 16777215,
            opacity: 0,
            transparent: true,
            fog: false,
          });
          let zhejiangLine = new Line({
            center: centerXY,
            data: provinceData,
            material: this.zhejiangLineMaterial,
            renderOrder: 3,
          });
          zhejiangLine.lineGroup.position.z += 0.73;
          return { zhejiang, zhejiangTop, zhejiangLine };
        }
        createProvinceMaterial() {
          let lambertMat = new MeshLambertMaterial({
            color: 16777215,
            transparent: true,
            opacity: 0,
            fog: false,
            side: 2,
          });
          lambertMat.onBeforeCompile = (e) => {
            e.uniforms = {
              ...e.uniforms,
              uColor1: { value: new THREE.Color(2780818) },
              uColor2: { value: new THREE.Color(1058614) },
            };
            e.vertexShader = e.vertexShader.replace(
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
            e.fragmentShader = e.fragmentShader.replace(
              "void main() {",
              `
              varying vec3 vPosition;
              varying float vAlpha;
              uniform vec3 uColor1;
              uniform vec3 uColor2;

              void main() {
            `
            );
            e.fragmentShader = e.fragmentShader.replace(
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
          let sideTex = texture.load("data/map/side.png");
          sideTex.wrapS = 1000;
          sideTex.wrapT = 1000;
          sideTex.repeat.set(1, 1.5);
          sideTex.offset.y += 0.065;
          let sideMat = new THREE.MeshStandardMaterial({
            color: 16777215,
            map: sideTex,
            fog: false,
            opacity: 0,
            side: 2,
          });
          this.time.on("tick", () => {
            sideTex.offset.y += 0.005;
          });
          sideMat.onBeforeCompile = (e) => {
            e.uniforms = {
              ...e.uniforms,
              uColor1: { value: new THREE.Color(2780818) },
              uColor2: { value: new THREE.Color(2780818) },
            };
            e.vertexShader = e.vertexShader.replace(
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
            e.fragmentShader = e.fragmentShader.replace(
              "void main() {",
              `
                  varying vec3 vPosition;
                  varying float vAlpha;
                  uniform vec3 uColor1;
                  uniform vec3 uColor2;

                  void main() {
                `
            );
            e.fragmentShader = e.fragmentShader.replace(
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
          return [lambertMat, sideMat];
        }
        async createChina() {
          let jsonData = await requestData("./data/map/中华人民共和国.json");
          let chinaJson = transfromGeoJSON(jsonData);
          let china = new Country(this, {
            data: chinaJson,
            center: centerXY,
            merge: false,
            material: new MeshLambertMaterial({
              color: "rgb(46,66,103)",
              transparent: true,
              opacity: 1,
            }),
            renderOrder: 2,
          });
          let chinaTopLine = new Line({
            center: centerXY,
            visibleProvince: "广东省",
            data: chinaJson,
            material: new LineBasicMaterial({ color: '#3f5d75' }),
            renderOrder: 3,
          });
          chinaTopLine.lineGroup.position.z += 0.2;
          let chinaBottomLine = new Line({
            center: centerXY,
            data: chinaJson,
            material: new LineBasicMaterial({
              color: 4162253,
              transparent: true,
              opacity: 0.4,
            }),
            renderOrder: 3,
          });
          chinaBottomLine.lineGroup.position.z -= 0.59;
          return { china, chinaTopLine, chinaBottomLine };
        }
        async createModel() {
          let modelGroup = new THREE.Group();
          // 创建省份
          this.focusMapGroup = new THREE.Group();
          let { zhejiang, zhejiangTop, zhejiangLine } =
            await this.createProvince();

          let { china, chinaTopLine } = await this.createChina();

          china.setParent(modelGroup);
          zhejiang.setParent(modelGroup);
          zhejiangTop.setParent(modelGroup);
          chinaTopLine.setParent(modelGroup);
          zhejiangLine.setParent(modelGroup);

          this.focusMapGroup.position.set(0, 0, -0.01);
          this.focusMapGroup.scale.set(1, 1, 0);
          modelGroup.add(this.focusMapGroup);
          modelGroup.position.set(0, 0, 0.2);
          this.scene.add(modelGroup);
        }
        createPointLight(opt) {
          const pointLight = new PointLight(
            opt.color,
            opt.intensity,
            opt.distance,
            1
          );
          pointLight.position.set(opt.x, opt.y, opt.z);
          this.scene.add(pointLight);
          const helper = new PointLightHelper(pointLight, 1);
          this.scene.add(helper);

          const point = gui.addFolder("Point" + Math.random());
          point.addColor(opt, "color");
          point.add(opt, "intensity", 1, 100, 1);
          point.add(opt, "distance", 100, 2000, 10);
          point.add(opt, "x", -30, 30, 1);
          point.add(opt, "y", -30, 30, 1);
          point.add(opt, "z", -30, 30, 1);
          point.onChange(({ object: i }) => {
            pointLight.color = new THREE.Color(i.color);
            pointLight.distance = i.distance;
            pointLight.intensity = i.intensity;
            pointLight.position.set(i.x, i.y, i.z);
            helper.update();
          });
        }
        createDirectionalLight(opt) {
          let directLight = new DirectionalLight(opt.color, opt.intensity);
          directLight.position.set(opt.x, opt.y, opt.z);
          directLight.castShadow = true;
          directLight.shadow.radius = 20;
          directLight.shadow.mapSize.width = 1024;
          directLight.shadow.mapSize.height = 1024;
          const helper = new DirectionalLightHelper(directLight, 10);
          this.scene.add(directLight, helper);

          const light = gui.addFolder("directLight");
          light.add(directLight.position, "x", -30, 100, 1);
          light.add(directLight.position, "y", -30, 100, 1);
          light.add(directLight.position, "z", -30, 100, 1);
          light.add(directLight, "intensity", 1, 100, 1);
          light.onChange(() => {
            helper.update();
          });
        }
        initEnvironment() {
          let ambLight = new AmbientLight("#021031", 1);
          this.scene.add(ambLight);

          const environment = gui.addFolder("Environment");
          environment.add(ambLight, "intensity", 1, 10, 1);

          this.createDirectionalLight({
            color: 16777215,
            intensity: 5,
            x: -30,
            y: 6,
            z: -8,
          });

          this.createPointLight({
            color: "#021031",
            intensity: 5,
            distance: 1e4,
            x: -9,
            y: 3,
            z: -3,
          });
          this.createPointLight({
            color: "#021031",
            intensity: 5,
            distance: 1e4,
            x: 0,
            y: 2,
            z: 5,
          });

          // this.scene.fog = new Fog(1058614, 1, 50);
          this.scene.background = new Color(1058614);
        }
        createFloor() {
          let plan = new PlaneGeometry(20, 20);
          const texture = new TextureLoader().load(
            "/data/map/ocean-blue-bg.png"
          );
          texture.colorSpace = "srgb";
          texture.wrapS = 1000;
          texture.wrapT = 1000;
          texture.repeat.set(1, 1);
          let mat = new MeshBasicMaterial({ map: texture, opacity: 1 });
          let ocean = new Mesh(plan, mat);
          // ocean.rotateX(-Math.PI / 2);
          ocean.position.set(0, -0.7, 0);
          this.scene.add(ocean);
        }
        createHUIGUANG(width, color) {
          let planGeo = new THREE.PlaneGeometry(0.35, width);
          planGeo.translate(0, width / 2, 0);
          const huiguangTex = texture.load("/data/map/huiguang.png");
          huiguangTex.colorSpace = "srgb";
          huiguangTex.wrapS = 1000;
          huiguangTex.wrapT = 1000;
          let huiguangMat = new THREE.MeshBasicMaterial({
            color: color,
            map: huiguangTex,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            side: 2,
            blending: 2,
          });
          const plan = new THREE.Mesh(planGeo, huiguangMat);
          plan.renderOrder = 10;
          plan.rotateX(Math.PI / 2);
          let plan1 = plan.clone();
          let plan2 = plan.clone();
          this.addObject([plan, plan1, plan2]);
        }
        initCamera() {
          let { width, height } = this.options;
          let rate = width / height;
          // 设置45°的透视相机,更符合人眼观察
          this.camera = new THREE.PerspectiveCamera(45, rate, 0.001, 9000000);
          this.camera.up.set(0, 0, 1);
          // 贵州
          // this.camera.position.set(105.96420078859111, 20.405756412693812, 5.27483892390678) //相机在Three.js坐标系中的位置
          // 四川
          this.camera.position.set(
            -82.990152163077308,
            -43.767695123014105,
            39.28228164159694
          ); //相机在Three.js坐标系中的位置
          this.camera.lookAt(0, 0, 0);
        }
        async initModel() {
          try {
            // 创建组
            this.mapGroup = new THREE.Group();
            // 标签 初始化
            this.css2dRender = initCSS2DRender(this.options, this.container);

            provinceData.features.forEach((elem, index) => {
              // city 属性
              const properties = elem.properties;

              // 创建标点和标签
              initLightPoint(properties, this.mapGroup);
              // initLabel(properties, this.scene);
            });
            // 创建上下边框
            // initBorderLine(provinceData, this.mapGroup);

            let earthGroupBound = getBoundingBox(this.mapGroup);
            centerXY = [earthGroupBound.center.x, earthGroupBound.center.y];
            let { size } = earthGroupBound;
            let width = size.x < size.y ? size.y + 1 : size.x + 1;
            // 添加背景，修饰元素
            this.rotatingApertureMesh = initRotatingAperture(this.scene, width);
            this.rotatingPointMesh = initRotatingPoint(this.scene, width - 2);
            initCirclePoint(this.scene, width);
            // initSceneBg(this.scene, width);

            // 将组添加到场景中
            this.scene.add(this.mapGroup);
            this.particleArr = initParticle(this.scene, earthGroupBound);
            // initGui();
          } catch (error) {
            console.log(error);
          }
        }

        destroy() {}
        initControls() {
          super.initControls();
          this.controls.target = new THREE.Vector3(0, 0, 0);
        }
        // initLight() {
        //   //   平行光1
        //   let directionalLight1 = new THREE.DirectionalLight(0x7af4ff, 1);
        //   directionalLight1.position.set(...centerXY, 30);
        //   //   平行光2
        //   let directionalLight2 = new THREE.DirectionalLight(0x7af4ff, 1);
        //   directionalLight2.position.set(...centerXY, 30);
        //   // 环境光
        //   let ambientLight = new THREE.AmbientLight(0x7af4ff, 1);
        //   // 将光源添加到场景中
        //   this.addObject(directionalLight1);
        //   this.addObject(directionalLight2);
        //   this.addObject(ambientLight);
        // }
        initRenderer() {
          super.initRenderer();
          this.renderer.outputEncoding = THREE.sRGBEncoding;
          // this.renderer.setClearColor(pointColor, 1.0);
          console.log(this.renderer);
          this.renderer.shadowMap.enabled = false;
        }
        loop() {
          this.animationStop = window.requestAnimationFrame(() => {
            this.loop();
          });
          // 这里是你自己业务上需要的code
          this.renderer.render(this.scene, this.camera);
          // 控制相机旋转缩放的更新
          if (this.options.controls.visibel && this.controls) {
            // this.controls.target.set(...centerXY, 0)
            this.controls.update();
          }
          // 统计更新
          if (this.options.statsVisibel) this.stats.update();
          if (this.rotatingApertureMesh) {
            this.rotatingApertureMesh.rotation.z += 0.001;
          }
          if (this.rotatingPointMesh) {
            this.rotatingPointMesh.rotation.z -= 0.005;
          }
          // 渲染标签
          if (this.css2dRender) {
            this.css2dRender.render(this.scene, this.camera);
          }
          // 粒子上升
          // if (this.particleArr.length) {
          //   for (let i = 0; i < this.particleArr.length; i++) {
          //     this.particleArr[i].updateSequenceFrame();
          //     this.particleArr[i].position.z += 0.01;
          //     if (this.particleArr[i].position.z >= 6) {
          //       this.particleArr[i].position.z = -6;
          //     }
          //   }
          // }
          TWEEN.update();
        }
        resize() {
          super.resize();
          // 这里是你自己业务上需要的code
          this.renderer.render(this.scene, this.camera);
          this.renderer.setPixelRatio(window.devicePixelRatio);

          if (this.css2dRender) {
            this.css2dRender.setSize(this.options.width, this.options.height);
          }
        }
      }
      baseEarth = new CurrentEarth({
        container: "#app-32-map",
        axesVisibel: true,
        controls: {
          enableDamping: true, // 阻尼
          maxPolarAngle: (Math.PI / 2) * 0.98,
        },
      });

      baseEarth.run();
      baseEarth.createGridHelper();
      baseEarth.createPoint();
      baseEarth.createPlus();
      baseEarth.createShapes();
      baseEarth.createChinaBlurLine();
      baseEarth.createFlyLine();
      baseEarth.createModel();
      baseEarth.initEnvironment();
      // baseEarth.createFloor();
      // baseEarth.createHUIGUANG(10, 16776948);

      window.addEventListener("resize", resize);
    });
    onBeforeUnmount(() => {
      window.removeEventListener("resize", resize);
    });
  },
};
</script>
<style>
html,
body,
#app,
.is-full {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.map-32-label {
  font-size: 10px;
  color: #fff;
}
</style>
