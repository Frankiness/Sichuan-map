<template>
  <div id="app-32-map" class="is-full"></div>
</template>

<script>
import BaseEarth from "@/utils/Earth.js";
import TWEEN from "@tweenjs/tween.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { onBeforeUnmount, onMounted } from "vue";
import useFileLoader from "@/hooks/useFileLoader.js";
import useConversionStandardData from "@/hooks/useConversionStandardData.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import { regionData } from "@/utils/data";
import gsap from "gsap";
import { CustomLine } from "@/hooks/useLine";
import {
  Country,
  CustomPlan,
  Diffuse,
  geoProjection,
  InitShader,
  Particle,
  ProvinceSide,
  Timer,
} from "@/utils/utils";
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
  LineBasicMaterial,
  Vector3,
  QuadraticBezierCurve3,
  TubeGeometry,
  Points,
  BufferGeometry,
  PointsMaterial,
  BufferAttribute,
  Vector2,
  Shape,
  Group,
  MeshStandardMaterial,
  ShapeBufferGeometry,
  BoxGeometry,
  CustomBlending,
  GridHelper,
  MathUtils,
  PerspectiveCamera,
  sRGBEncoding,
} from "three";
import { InteractionManager } from "@/utils/interactionManager";
import useCSS2DRender from "@/hooks/useCSS2DRender";
import useCSS3DRender from "@/hooks/useCSS3DRender";

const isDebug = false;
const timeline = gsap.timeline();
timeline.addLabel("focusMap", 2);
timeline.addLabel("focusMapOpacity", 2.5);

const centerLatAndLon = [120.109913, 29.181466]; //中心点经纬度
const flyLineCenter = [119.476498, 29.898918]; // 飞线中心经纬度
const [centerX, centerY] = geoProjection(centerLatAndLon); //经纬度转换为笛卡尔坐标

const centerXYZ = [centerX, -centerY, 0],
  gridSize = 100,
  gridDivision = 20,
  shapeSize = 1,
  shapeColor = 0x3464a2,
  pointSize = 0.15,
  pointColor = "rgb(0,0,0)",
  pointLayout = { row: 200, col: 200 },
  pointBlending = CustomBlending,
  diffuseSpeed = 15,
  diffuseColor = 0x3464a2,
  diffuseWidth = 10;

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
    const { initCSS2DRender, create2DTag } = useCSS2DRender();
    const { initCSS3DRender } = useCSS3DRender();

    // 创建标签
    const initLabel = (properties) => {
      if (!properties.centroid && !properties.center) {
        return false;
      }
      // 设置标签的显示内容和位置
      const label = create2DTag("标签", "map-32-label");
      // label.rotateY(-Math.PI);
      let labelCenter = geoProjection(properties.centroid);

      label.show(
        properties.name,
        new Vector3(labelCenter[0], -labelCenter[1], 1.5)
      );
      return label;
    };

    const textureLoader = new TextureLoader();

    const bottomZ = -0.2;

    onMounted(async () => {
      const gui = new GUI();
      // GeoJson数据
      let provinceData = transfromGeoJSON(
        await requestData("./data/map/浙江省.json")
      );

      class CurrentEarth extends BaseEarth {
        constructor(props) {
          super(props);
          this.time = new Timer();
          this.clicked = false;
          this.eventElement = [];
          this.defaultMaterial = null;
          this.defaultLightMaterial = null;

          // 交互对象
          this.interactionManager = new InteractionManager(
            this.renderer,
            this.camera,
            this.renderer.domElement
          );
        }
        createGridHelper() {
          let gridSize = 50,
            gridDivision = 20,
            gridColor = 1788784;
          const helper = new GridHelper(gridSize, gridDivision, gridColor);
          helper.material = new MeshBasicMaterial({
            color: "#3464a2",
            opacity: 0.5,
            transparent: true,
          });

          helper.rotateX(MathUtils.degToRad(90));
          helper.position.set(centerXYZ[0], centerXYZ[1], bottomZ - 0.04);
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
          const geo = new BufferGeometry();
          geo.setAttribute("position", new BufferAttribute(positions, 3));
          let sprite = new PointsMaterial({
            size: pointSize,
            sizeAttenuation: true,
            color: pointColor,
            blending: pointBlending,
          });
          const points = new Points(geo, sprite);
          points.rotateX(MathUtils.degToRad(90));
          points.position.set(centerX, -centerY, bottomZ - 0.04);
          this.diffuseShader(sprite);
          this.addObject(points);
        }
        createLabel(properties, height) {
          this.css2dRender = initCSS2DRender(this.options, this.container);
          this.css3dRender = initCSS3DRender(this.options, this.container);
          const label = initLabel(properties);
          this.addObject(label);
          label.userData.height = height;
          return label;
        }
        createPlus(count = 50) {
          let e = count / 6 / 3,
            t = count / 3,
            vertices = [
              new Vector2(-t, -e),
              new Vector2(-e, -e),
              new Vector2(-e, -t),
              new Vector2(e, -t),
              new Vector2(e, -t),
              new Vector2(e, -e),
              new Vector2(t, -e),
              new Vector2(t, e),
              new Vector2(e, e),
              new Vector2(e, t),
              new Vector2(-e, t),
              new Vector2(-e, e),
              new Vector2(-t, e),
            ];
          let shape = new Shape(vertices);
          return new ShapeBufferGeometry(shape, 24);
        }
        createShapes() {
          let s = gridSize / gridDivision,
            l = gridSize / 2,
            mat = new MeshBasicMaterial({ color: shapeColor, side: 2 }),
            arr = [];
          for (let size = 0; size < gridDivision + 1; size++)
            for (let h = 0; h < gridDivision + 1; h++) {
              let plusGeometry = this.createPlus(shapeSize);
              plusGeometry.translate(-l + size * s, -l + h * s, 0);
              arr.push(plusGeometry);
            }
          let geometry = BufferGeometryUtils.mergeBufferGeometries(arr);
          let mesh = new Mesh(geometry, mat);
          mesh.renderOrder = -1;
          mesh.rotateZ(-Math.PI / 2);
          mesh.position.set(centerXYZ[0], centerXYZ[1], bottomZ - 0.04);
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
          let chinaLineGeo = new PlaneGeometry(147, 147);
          const line = textureLoader.load("/data/map/chinaBlurLine.png");
          line.colorSpace = "srgb";
          line.wrapS = 1000;
          line.wrapT = 1000;
          line.generateMipmaps = false;
          line.minFilter = 1003;
          line.repeat.set(1, 1);
          let chinaLineMat = new MeshBasicMaterial({
            color: 0x3464a2,
            alphaMap: line,
            transparent: true,
            opacity: 0.7,
          });
          const chinaLineMesh = new Mesh(chinaLineGeo, chinaLineMat);
          const [x, y, z] = centerXYZ;
          chinaLineMesh.position.set(x - 33.1, y + 5, z - 0.8);
          this.addObject(chinaLineMesh);
        }
        createFlyLine() {
          this.flyLineGroup = new Group();
          this.flyLineGroup.visible = true;
          this.addObject(this.flyLineGroup);
          const flyLineTexture = textureLoader.load("/data/map/flyLine.png");
          flyLineTexture.colorSpace = "srgb";
          flyLineTexture.wrapS = 1000;
          flyLineTexture.wrapT = 1000;
          flyLineTexture.repeat.set(1, 15);

          const radius = 0.1;
          const tubularSegments = 32;
          const radialSegments = 8;
          const closed = false;

          let [pos1, pos2] = geoProjection(flyLineCenter);
          let p1 = new Vector3(pos1, -pos2, 0);
          const tubeMat = new MeshBasicMaterial({
            map: flyLineTexture,
            alphaMap: flyLineTexture,
            color: 2781042,
            transparent: true,
            fog: false,
            opacity: 1,
            depthTest: false,
            blending: 2,
          });

          this.time.on("tick", () => {
            flyLineTexture.offset.x -= 0.006;
          });
          regionData
            .filter((p, idx) => idx < 7)
            .map((p) => {
              if (p?.centroid) {
                const [x, y] = geoProjection(p.centroid);
                const p3 = new Vector3(x, -y, 0);
                const p2 = new Vector3();

                p2.addVectors(p1, p3).multiplyScalar(0.5);
                p2.setZ(3);
                const curve = new QuadraticBezierCurve3(p1, p2, p3);
                const tubeGeo = new TubeGeometry(
                  curve,
                  tubularSegments,
                  radius,
                  radialSegments,
                  closed
                );
                const tube = new Mesh(tubeGeo, tubeMat);
                tube.position.set(0, 0.94, 0.8);
                tube.renderOrder = 21;
                this.flyLineGroup.add(tube);
              }
            });
        }
        createParticles() {
          this.particles = new Particle(this, {
            num: 15,
            range: 30,
            dir: "up",
            speed: 0.05,
            material: new PointsMaterial({
              map: Particle.createTexture(),
              size: 1,
              color: "#eee",
              transparent: true,
              opacity: 1,
              depthTest: false,
              depthWrite: false,
              vertexColors: true,
              blending: 2,
              sizeAttenuation: true,
            }),
          });
          this.particles.instance.position.set(centerX, -centerY, 0);
          this.particles.setParent(this.scene);
          this.particles.enable = true;
          this.particles.instance.visible = true;
        }
        async createProvince() {
          let [lambertMat, sideMat] = this.createProvinceMaterial();
          this.focusMapTopMaterial = lambertMat;
          this.focusMapSideMaterial = sideMat;

          let zhejiang = new ProvinceSide(this.time, {
            center: centerLatAndLon,
            position: new Vector3(0, 0, 0.11),
            data: provinceData,
            depth: 0.5,
            topFaceMaterial: lambertMat,
            sideMaterial: sideMat,
            renderOrder: 9,
          });
          const defaultMaterial = new MeshStandardMaterial({
            color: "#234b7e",
            transparent: true,
            opacity: 0.5,
          });
          new InitShader(defaultMaterial, {
            uColor1: "#2a6e92",
            uColor2: "#102736",
          });

          this.defaultMaterial = defaultMaterial;
          this.defaultLightMaterial = this.defaultMaterial.clone();
          this.defaultLightMaterial.emissive.setHex(725293);
          this.defaultLightMaterial.emissiveIntensity = 3.5;

          let zhejiangTop = new Country({
            center: centerLatAndLon,
            position: new Vector3(0, 0, 0.72),
            data: provinceData,
            material: defaultMaterial,
            renderOrder: 2,
          });
          // 省份交互集合
          zhejiangTop.mapGroup.children.forEach((item) => {
            item.children.forEach((node) => {
              node.type === "Mesh" && this.eventElement.push(node);
            });
          });

          this.zhejiangLineMaterial = new LineBasicMaterial({
            color: "#fff",
            opacity: 0,
            transparent: true,
            fog: false,
          });
          let zhejiangLine = new CustomLine({
            center: centerLatAndLon,
            data: provinceData,
            material: this.zhejiangLineMaterial,
            renderOrder: 3,
          });
          zhejiangLine.lineGroup.position.z += 0.73;
          return { zhejiang, zhejiangTop, zhejiangLine };
        }
        createProvinceMaterial() {
          let lambertMat = new MeshLambertMaterial({
            color: "#fff",
            transparent: true,
            opacity: 0,
            fog: false,
            side: 2,
          });
          lambertMat.onBeforeCompile = (e) => {
            e.uniforms = {
              ...e.uniforms,
              uColor1: { value: new Color("#2a6e92") },
              uColor2: { value: new Color("#102736") },
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
          let sideTex = textureLoader.load("data/map/side.png");
          sideTex.wrapS = 1000;
          sideTex.wrapT = 1000;
          sideTex.repeat.set(1, 1.5);
          sideTex.offset.y += 0.065;
          let sideMat = new MeshStandardMaterial({
            color: "#fff",
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
              uColor1: { value: new Color("#2a6e92") },
              uColor2: { value: new Color("#3793c4") },
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
          let china = new Country({
            data: chinaJson,
            center: centerLatAndLon,
            merge: false,
            material: new MeshLambertMaterial({
              color: "rgb(46,66,103)",
              transparent: true,
              opacity: 1,
            }),
            renderOrder: 2,
          });
          let chinaTopLine = new CustomLine({
            center: centerXYZ,
            visibleProvince: "广东省",
            data: chinaJson,
            material: new LineBasicMaterial({ color: "#3f5d75" }),
            renderOrder: 3,
          });
          chinaTopLine.lineGroup.position.z += 0.01;
          let chinaBottomLine = new CustomLine({
            center: centerXYZ,
            data: chinaJson,
            material: new LineBasicMaterial({
              color: "#3f82cd",
              transparent: true,
              opacity: 0.4,
            }),
            renderOrder: 3,
          });
          chinaBottomLine.lineGroup.position.z -= 0.59;
          return { china, chinaTopLine, chinaBottomLine };
        }
        async createModel() {
          let modelGroup = new Group();
          // 创建省份
          this.focusMapGroup = new Group();
          let { zhejiang, zhejiangTop, zhejiangLine } =
            await this.createProvince();

          let { china, chinaTopLine } = await this.createChina();

          china.setParent(modelGroup);
          zhejiang.setParent(this.focusMapGroup);
          zhejiangTop.setParent(this.focusMapGroup);
          chinaTopLine.setParent(this.focusMapGroup);
          zhejiangLine.setParent(this.focusMapGroup);

          this.focusMapGroup.position.set(0, 0, -0.01);
          this.focusMapGroup.scale.set(1, 1, 0);
          modelGroup.add(this.focusMapGroup);
          modelGroup.position.set(0, 0, 0.2);
          this.scene.add(modelGroup);
        }
        createEvent() {
          let arr = [];
          const setDefaultMat = (model) => {
            model.traverse((i) => {
              i.isMesh && (i.material = this.defaultMaterial);
            });
          };
          const setLightMat = (model) => {
            model.traverse((i) => {
              i.isMesh && (i.material = this.defaultLightMaterial);
            });
          };
          this.eventElement.forEach((item) => {
            this.interactionManager.add(item);
            item.addEventListener("mousedown", (i) => {
              if (this.clicked) return false;
              this.clicked = true;
              // console.log(i.target.userData.name);
            });
            item.addEventListener("mouseup", (i) => {
              this.clicked = false;
            });
            item.addEventListener("mouseover", (i) => {
              arr.includes(i.target.parent) || arr.push(i.target.parent);
              document.body.style.cursor = "pointer";
              setLightMat(i.target.parent);
            });
            item.addEventListener("mouseout", (i) => {
              arr = arr.filter(
                (r) => r.userData.name !== i.target.parent.userData.name
              );
              setDefaultMat(i.target.parent);
              document.body.style.cursor = "default";
            });
          });
        }
        createRotateBorder() {
          let t = 12;
          const rotatingApertureTexture = textureLoader.load(
            "/data/map/rotation-border-1.png"
          );
          const rotatingPointTexture = textureLoader.load(
            "/data/map/rotation-border-2.png"
          );
          const circle1 = new CustomPlan(this, {
            width: t * 1.178,
            needRotate: true,
            rotateSpeed: 0.001,
            material: new MeshBasicMaterial({
              map: rotatingApertureTexture,
              color: "#48afff",
              transparent: true,
              opacity: 0.2,
              side: 2,
              depthWrite: false,
              blending: 2,
            }),
            position: new Vector3(centerXYZ[0], centerXYZ[1], 0.3),
          });
          circle1.instance.renderOrder = 6;
          circle1.instance.scale.set(0, 0, 0);
          circle1.setParent(this.scene);

          let circle2 = new CustomPlan(this, {
            width: t * 1.116,
            needRotate: true,
            rotateSpeed: -0.004,
            material: new MeshBasicMaterial({
              map: rotatingPointTexture,
              color: "#48afff",
              transparent: true,
              opacity: 0.4,
              side: 2,
              depthWrite: false,
              blending: 2,
            }),
            position: new Vector3(centerXYZ[0], centerXYZ[1], 0.3),
          });
          circle2.instance.renderOrder = 6;
          circle2.instance.scale.set(0, 0, 0);
          circle2.setParent(this.scene);

          this.rotateBorder1 = circle1.instance;
          this.rotateBorder2 = circle2.instance;
        }
        // 过渡效果
        createTransition() {
          // 相机
          timeline.add(
            gsap.to(this.camera.position, {
              duration: 2,
              x: 251.99527442696413,
              y: 44.49939782165896,
              z: 17.588187982450716,
              ease: "circ.out",
            })
          );

          // 模型
          timeline.add(
            gsap.to(this.focusMapGroup.position, {
              duration: 1,
              x: 0,
              y: 0,
              z: 0,
            }),
            "focusMap"
          );
          timeline.add(
            gsap.to(this.focusMapGroup.scale, {
              duration: 1,
              x: 1,
              y: 1,
              z: 1,
              ease: "circ.out",
            }),
            "focusMap"
          );

          timeline.add(
            gsap.to(this.focusMapTopMaterial, {
              duration: 1,
              opacity: 1,
              ease: "circ.out",
            }),
            "focusMapOpacity"
          );
          timeline.add(
            gsap.to(this.focusMapSideMaterial, {
              duration: 1,
              opacity: 1,
              ease: "circ.out",
              onComplete: () => {
                this.focusMapSideMaterial.transparent = false;
              },
            }),
            "focusMapOpacity"
          );

          timeline.add(
            gsap.to(this.zhejiangLineMaterial, {
              duration: 0.5,
              delay: 0.3,
              opacity: 1,
            }),
            "focusMapOpacity"
          );

          // 旋转圈
          timeline.add(
            gsap.to(this.rotateBorder1.scale, {
              delay: 0.3,
              duration: 1,
              x: 1,
              y: 1,
              z: 1,
              ease: "circ.out",
            }),
            "focusMapOpacity"
          );
          timeline.add(
            gsap.to(this.rotateBorder2.scale, {
              duration: 1,
              delay: 0.5,
              x: 1,
              y: 1,
              z: 1,
              ease: "circ.out",
            }),
            "focusMapOpacity"
          );

          //  光柱
          this.allBar.forEach((e, i) => {
            timeline.add(
              gsap.to(e.scale, {
                duration: 1,
                delay: 0.1 * i,
                x: 1,
                y: 1,
                z: 1,
                ease: "circ.out",
              }),
              "bar"
            );
          });
          this.allBarMaterial.forEach((e, i) => {
            timeline.add(
              gsap.to(e, {
                duration: 1,
                delay: 0.1 * i,
                opacity: 1,
                ease: "circ.out",
              }),
              "bar"
            );
          });
          //  城市光圈
          this.allGuangquan.forEach((e, i) => {
            timeline.add(
              gsap.to(e.children[0].scale, {
                duration: 1,
                delay: 0.1 * i,
                x: 1,
                y: 1,
                z: 1,
                ease: "circ.out",
              }),
              "bar"
            );
            timeline.add(
              gsap.to(e.children[1].scale, {
                duration: 1,
                delay: 0.1 * i,
                x: 1,
                y: 1,
                z: 1,
                ease: "circ.out",
              }),
              "bar"
            );
          });

          // 标签
          this.allProvinceLabel.forEach((i, idx) => {
            timeline.add(
              gsap.to(i.element, {
                delay: 0.2 * idx,
                duration: 1,
                opacity: 1,
                ease: "circ.out",
              }),
              "bar"
            );

            timeline.add(
              gsap.to(i.position, {
                duration: 1.7,
                delay: 0.1 * idx,
                z: i.userData.height,
                ease: "circ.out",
              }),
              "bar"
            );
          });
        }
        createBar() {
          let cityData = regionData
            .sort((a, b) => b.value - a.value)
            .filter((o, l) => l < 7);
          let barGroup = new Group();
          let width = 0.7;
          let i = 4 * width;
          let r = cityData[0].value;
          this.allBar = [];
          this.allBarMaterial = [];
          this.allGuangquan = [];
          this.allProvinceLabel = [];

          cityData.map((item, idx) => {
            let size = i * (item.value / r);
            let mat = new MeshBasicMaterial({
              color: "#077de0",
              transparent: true,
              opacity: 0,
              depthTest: false,
              fog: false,
            });
            new InitShader(mat, {
              uColor1: idx > 3 ? "#fbdf88" : "#50bbfe",
              uColor2: idx > 3 ? "#fffef4" : "#77fbf5",
              size,
              dir: "y",
            });
            const boxGeo = new BoxGeometry(0.1 * width, 0.1 * width, size);
            boxGeo.translate(0, 0, size / 2);
            const box = new Mesh(boxGeo, mat);
            box.renderOrder = 5;
            let [g, m] = geoProjection(item.centroid);
            box.position.set(g, -m, 0.95);
            box.scale.set(1, 1, 0);

            // 创建标签
            let label = this.createLabel(item, size + 1.2);
            this.allProvinceLabel.push(label);

            let planArr = this.createHUIGUANG(
              size,
              idx > 3 ? "#fffef4" : "#77fbf5"
            );
            let quanGroup = this.createCityCircle(new Vector3(g, -m, 0.95));
            this.allGuangquan.push(quanGroup);

            box.add(...planArr);
            barGroup.add(box);

            this.allBar.push(box);
            this.allBarMaterial.push(mat);

            this.addObject(barGroup);
          });
        }
        createCityCircle(position) {
          const circleTex1 = textureLoader.load("/data/map/guangquan-1.png");
          const circleTex2 = textureLoader.load("/data/map/guangquan-2.png");

          let planGeo = new PlaneGeometry(0.5, 0.5);
          let material1 = new MeshBasicMaterial({
            color: "#50bbfe",
            map: circleTex1,
            alphaMap: circleTex1,
            opacity: 1,
            transparent: true,
            depthTest: false,
            fog: false,
            blending: 2,
          });
          let material2 = new MeshBasicMaterial({
            color: "#50bbfe",
            map: circleTex2,
            alphaMap: circleTex2,
            opacity: 1,
            transparent: true,
            depthTest: false,
            fog: false,
            blending: 2,
          });
          const circle1 = new Mesh(planGeo, material1);
          const circle2 = new Mesh(planGeo, material2);

          circle1.renderOrder = 6;
          circle2.renderOrder = 6;

          circle1.position.copy(position);
          circle2.position.copy(position);
          circle2.position.y -= 0.001;
          circle1.scale.set(0, 0, 0);
          circle2.scale.set(0, 0, 0);
          this.quanGroup = new Group();
          this.quanGroup.add(circle1, circle2);
          this.scene.add(this.quanGroup);
          this.time.on("tick", () => {
            circle1.rotation.z += 0.05;
          });
          return this.quanGroup;
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
          if (isDebug) {
            const helper = new PointLightHelper(pointLight, 1);
            this.scene.add(helper);

            const point = gui.addFolder("Point" + Math.random());
            point.addColor(opt, "color");
            point.add(opt, "intensity", 1, 100, 1);
            point.add(opt, "distance", 100, 2000, 10);
            point.add(opt, "x", -30, 300, 1);
            point.add(opt, "y", -30, 300, 1);
            point.add(opt, "z", -30, 300, 1);
            point.onChange(({ object: i }) => {
              pointLight.color = new Color(i.color);
              pointLight.distance = i.distance;
              pointLight.intensity = i.intensity;
              pointLight.position.set(i.x, i.y, i.z);
              helper.update();
            });
          }
        }
        createDirectionalLight(opt) {
          let directLight = new DirectionalLight(opt.color, opt.intensity);
          directLight.position.set(opt.x, opt.y, opt.z);
          directLight.castShadow = true;
          directLight.shadow.radius = 20;
          directLight.shadow.mapSize.width = 1024;
          directLight.shadow.mapSize.height = 1024;

          if (isDebug) {
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

          return directLight;
        }
        initEnvironment() {
          let config = { color: "#021031", intensity: 1 };
          let ambLight = new AmbientLight(config.color, config.intensity);
          this.scene.add(ambLight);

          if (isDebug) {
            const environment = gui.addFolder("Environment");
            environment.add(ambLight, "intensity", 1, 10, 1);
            environment.addColor(config, "color");
            environment.onChange(({ object }) => {
              ambLight.color = new Color(object.color);
            });

            this.directionalLight = this.createDirectionalLight({
              color: "#fff",
              intensity: 5,
              x: 160,
              y: 76,
              z: -8,
            });
          }

          this.createPointLight({
            color: "#021031",
            intensity: 5,
            distance: 1e4,
            x: centerXYZ[0],
            y: centerXYZ[1],
            z: 5,
          });
          this.createPointLight({
            color: "#021031",
            intensity: 5,
            distance: 1e4,
            x: 235,
            y: centerXYZ[1],
            z: 5,
          });

          this.scene.fog = new Fog("#12374f", 1, 50);
          this.scene.background = new Color("#102736");
        }
        createFloor() {
          let plan = new PlaneGeometry(100, 100);
          const texture = textureLoader.load("/data/map/ocean-blue-bg.png");
          texture.colorSpace = "srgb";
          texture.wrapS = 1000;
          texture.wrapT = 1000;
          texture.repeat.set(1, 1);
          let mat = new MeshBasicMaterial({ map: texture, opacity: 1 });
          let ocean = new Mesh(plan, mat);
          ocean.position.set(centerXYZ[0], centerXYZ[1] - 1, 0);
          this.scene.add(ocean);
        }
        createHUIGUANG(width, color) {
          let planGeo = new PlaneGeometry(0.35, width);
          planGeo.translate(0, width / 2, 0);
          const huiguangTex = textureLoader.load("/data/map/huiguang.png");
          huiguangTex.colorSpace = "srgb";
          huiguangTex.wrapS = 1000;
          huiguangTex.wrapT = 1000;
          let huiguangMat = new MeshBasicMaterial({
            color: color,
            map: huiguangTex,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            side: 2,
            blending: 2,
          });
          const plan = new Mesh(planGeo, huiguangMat);
          plan.renderOrder = 10;
          plan.rotateX(Math.PI / 2);
          let plan1 = plan.clone();
          let plan2 = plan.clone();
          plan1.rotateY((Math.PI / 180) * 60);
          plan2.rotateY((Math.PI / 180) * 120);
          return [plan, plan1, plan2];
        }
        initCamera() {
          let { width, height } = this.options;
          let rate = width / height;
          // 设置45°的透视相机,更符合人眼观察
          this.camera = new PerspectiveCamera(45, rate, 0.01, 900000);
          this.camera.up.set(0, 0, 1);
          //相机在Three.js坐标系中的位置
          this.camera.position.set(
            241.53542738450767,
            2.277611988653902,
            27.32813029879468
          );
          this.camera.lookAt(251.55761353607278, 63.945247844891995, 50);
        }

        initControls() {
          super.initControls();
          this.controls.target = new Vector3(...centerXYZ);
        }

        initRenderer() {
          super.initRenderer();
          this.renderer.outputEncoding = sRGBEncoding;
          this.renderer.shadowMap.enabled = false;
        }
        loop() {
          this.stats.update();
          this.animationStop = window.requestAnimationFrame(() => {
            this.loop();
          });
          // 这里是你自己业务上需要的code
          this.renderer.render(this.scene, this.camera);
          this.render3d.render(this.scene, this.camera);
          // 控制相机旋转缩放的更新
          if (this.options.controls.visibel && this.controls) {
            // this.controls.target.set(...centerLatAndLon, 0)
            this.controls.update();
          }
          // 渲染标签
          if (this.css2dRender) {
            this.css2dRender.render(this.scene, this.camera);
          }
          if (this.css3dRender) {
            this.css3dRender.render(this.scene, this.camera);
          }

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
        axesVisible: true,
        controls: {
          enableDamping: true, // 阻尼
          maxPolarAngle: (Math.PI / 2) * 0.98,
        },
      });

      baseEarth.run();
      baseEarth.initEnvironment();
      baseEarth.createChinaBlurLine();
      baseEarth.createGridHelper();
      baseEarth.createRotateBorder();
      baseEarth.createPoint();
      baseEarth.createPlus();
      baseEarth.createShapes();
      baseEarth.createModel();
      baseEarth.createEvent();
      baseEarth.createFlyLine();
      baseEarth.createParticles();
      baseEarth.createBar();
      baseEarth.createTransition();

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
  font-size: 14px;
  font-weight: bold;
  color: #fff;
  padding: 5px 8px;
  background-color: rgba(38, 37, 37, 0.45);
  border-radius: 5px;
}
</style>
