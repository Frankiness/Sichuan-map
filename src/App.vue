<template>
  <div id="app-32-map" class="is-full"></div>
</template>

<script>
import BaseEarth from '@/utils/Earth.js';
import TWEEN from '@tweenjs/tween.js';
import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { onBeforeUnmount, onMounted } from 'vue';
import { random } from '@/utils';
import useFileLoader from '@/hooks/useFileLoader.js';
import useCountry from '@/hooks/useCountry.js';
import useCoord from '@/hooks/useCoord.js';
import useConversionStandardData from '@/hooks/useConversionStandardData.js';
import useMapMarkedLightPillar from '@/hooks/map/useMapMarkedLightPillar';
import useSequenceFrameAnimate from '@/hooks/useSequenceFrameAnimate';
import useCSS2DRender from '@/hooks/useCSS2DRender';

let centerXY = [106.59893798828125, 26.918846130371094];

export default {
  name: '3dMap30',
  setup() {
    let baseEarth = null;

    // 重置
    const resize = () => {
      baseEarth.resize();
    };

    const { requestData } = useFileLoader();
    const { transfromGeoJSON } = useConversionStandardData();
    const { getBoundingBox } = useCoord();
    const { createCountryFlatLine } = useCountry();
    const { initCSS2DRender, create2DTag } = useCSS2DRender();
    const { createLightPillar } = useMapMarkedLightPillar({
      scaleFactor: 1.2,
    });
    // 序列帧
    const { createSequenceFrame } = useSequenceFrameAnimate();

    const texture = new THREE.TextureLoader();
    const textureMap = texture.load('/data/map/gz-map.jpg');
    const texturefxMap = texture.load('/data/map/gz-map-fx.jpg');
    const rotatingApertureTexture = texture.load(
      '/data/map/rotatingAperture.png'
    );
    const rotatingPointTexture = texture.load('/data/map/rotating-point2.png');
    const circlePoint = texture.load('/data/map/circle-point.png');
    const sceneBg = texture.load('/data/map/scene-bg2.png');
    textureMap.wrapS = texturefxMap.wrapS = THREE.RepeatWrapping;
    textureMap.wrapT = texturefxMap.wrapT = THREE.RepeatWrapping;
    textureMap.flipY = texturefxMap.flipY = false;
    textureMap.rotation = texturefxMap.rotation = THREE.MathUtils.degToRad(45);
    const scale = 0.128;
    textureMap.repeat.set(scale, scale);
    texturefxMap.repeat.set(scale, scale);
    const topFaceMaterial = new THREE.MeshPhongMaterial({
      // map: textureMap,
      color: '#51a5d9',
      combine: THREE.MultiplyOperation,
      transparent: true,
      opacity: 1,
    });
    const sideMaterial = new THREE.MeshLambertMaterial({
      color: '#51a5d9',
      transparent: true,
      opacity: 0.9,
    });
    const bottomZ = -0.2;
    // 初始化gui
    const initGui = () => {
      const gui = new GUI();
      const guiParams = {
        topColor: '#b4eeea',
        sideColor: '#123024',
        scale: 0.1,
      };
      gui.addColor(guiParams, 'topColor').onChange((val) => {
        topFaceMaterial.color = new THREE.Color(val);
      });
      gui.addColor(guiParams, 'sideColor').onChange((val) => {
        sideMaterial.color = new THREE.Color(val);
      });
      gui.add(guiParams, 'scale', 0, 1).onChange((val) => {
        textureMap.repeat.set(val, val);
        texturefxMap.repeat.set(val, val);
      });
    };
    // 初始化旋转光圈
    const initRotatingAperture = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width, width);
      let material = new THREE.MeshBasicMaterial({
        map: rotatingApertureTexture,
        transparent: true,
        opacity: 1,
        depthTest: true,
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
        map: rotatingPointTexture,
        transparent: true,
        opacity: 1,
        depthTest: true,
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
        // color: 0x061920,
        color: 0xffffff,
        map: sceneBg,
        transparent: true,
        opacity: 1,
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
          image: './data/map/上升粒子1.png',
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
    // 创建顶部底部边线
    const initBorderLine = (data, mapGroup) => {
      let lineTop = createCountryFlatLine(
        data,
        {
          color: 0xffffff,
          linewidth: 0.0015,
          transparent: true,
          depthTest: false,
        },
        'Line2'
      );
      lineTop.position.z += 0.305;
      let lineBottom = createCountryFlatLine(
        data,
        {
          color: 0x61fbfd,
          linewidth: 0.002,
          // transparent: true,
          depthTest: false,
        },
        'Line2'
      );
      lineBottom.position.z -= 0.1905;
      //  添加边线
      mapGroup.add(lineTop);
      mapGroup.add(lineBottom);
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
      var label = create2DTag('标签', 'map-32-label');
      scene.add(label);
      let labelCenter = properties.center; //centroid || properties.center
      label.show(properties.name, new THREE.Vector3(...labelCenter, 0.31));
    };
    onMounted(async () => {
      // 四川数据
      let provinceData = await requestData('./data/map/四川省.json');
      provinceData = transfromGeoJSON(provinceData);

      class CurrentEarth extends BaseEarth {
        constructor(props) {
          super(props);
        }
        initCamera() {
          let { width, height } = this.options;
          let rate = width / height;
          // 设置45°的透视相机,更符合人眼观察
          this.camera = new THREE.PerspectiveCamera(45, rate, 0.001, 90000000);
          this.camera.up.set(0, 0, 1);
          // 贵州
          // this.camera.position.set(105.96420078859111, 20.405756412693812, 5.27483892390678) //相机在Three.js坐标系中的位置
          // 四川
          this.camera.position.set(
            102.97777217804006,
            17.660260562607277,
            8.029548316292933
          ); //相机在Three.js坐标系中的位置
          this.camera.lookAt(...centerXY, 0);
        }
        initModel() {
          try {
            // 创建组
            this.mapGroup = new THREE.Group();
            // 标签 初始化
            this.css2dRender = initCSS2DRender(this.options, this.container);

            provinceData.features.forEach((elem, index) => {
              // 定一个省份对象
              const province = new THREE.Object3D();
              // 坐标
              const coordinates = elem.geometry.coordinates;
              // city 属性
              const properties = elem.properties;

              // 循环坐标
              coordinates.forEach((multiPolygon) => {
                multiPolygon.forEach((polygon) => {
                  const shape = new THREE.Shape();
                  // 绘制shape
                  for (let i = 0; i < polygon.length; i++) {
                    let [x, y] = polygon[i];
                    if (i === 0) {
                      shape.moveTo(x, y);
                    }
                    shape.lineTo(x, y);
                  }
                  // 拉伸设置
                  const extrudeSettings = {
                    depth: 0.2,
                    bevelEnabled: true,
                    bevelSegments: 1,
                    bevelThickness: 0.1,
                  };
                  const geometry = new THREE.ExtrudeGeometry(
                    shape,
                    extrudeSettings
                  );
                  const mesh = new THREE.Mesh(geometry, [
                    topFaceMaterial,
                    sideMaterial,
                  ]);
                  province.add(mesh);
                });
              });
              this.mapGroup.add(province);
              // 创建标点和标签
              initLightPoint(properties, this.mapGroup);
              initLabel(properties, this.scene);
            });
            // 创建上下边框
            initBorderLine(provinceData, this.mapGroup);

            let earthGroupBound = getBoundingBox(this.mapGroup);
            centerXY = [earthGroupBound.center.x, earthGroupBound.center.y];
            let { size } = earthGroupBound;
            let width = size.x < size.y ? size.y + 1 : size.x + 1;
            // 添加背景，修饰元素
            this.rotatingApertureMesh = initRotatingAperture(this.scene, width);
            this.rotatingPointMesh = initRotatingPoint(this.scene, width - 2);
            initCirclePoint(this.scene, width);
            initSceneBg(this.scene, width);

            // 将组添加到场景中
            this.scene.add(this.mapGroup);
            this.particleArr = initParticle(this.scene, earthGroupBound);
            initGui();
          } catch (error) {
            console.log(error);
          }
        }
        getDataRenderMap() {}

        destroy() {}
        initControls() {
          super.initControls();
          this.controls.target = new THREE.Vector3(...centerXY, 0);
        }
        initLight() {
          //   平行光1
          let directionalLight1 = new THREE.DirectionalLight(0x7af4ff, 1);
          directionalLight1.position.set(...centerXY, 30);
          //   平行光2
          let directionalLight2 = new THREE.DirectionalLight(0x7af4ff, 1);
          directionalLight2.position.set(...centerXY, 30);
          // 环境光
          let ambientLight = new THREE.AmbientLight(0x7af4ff, 1);
          // 将光源添加到场景中
          this.addObject(directionalLight1);
          this.addObject(directionalLight2);
          this.addObject(ambientLight);
        }
        initRenderer() {
          super.initRenderer();
          // this.renderer.outputEncoding = THREE.sRGBEncoding
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
            this.rotatingApertureMesh.rotation.z += 0.0005;
          }
          if (this.rotatingPointMesh) {
            this.rotatingPointMesh.rotation.z -= 0.0005;
          }
          // 渲染标签
          if (this.css2dRender) {
            this.css2dRender.render(this.scene, this.camera);
          }
          // 粒子上升
          if (this.particleArr.length) {
            for (let i = 0; i < this.particleArr.length; i++) {
              this.particleArr[i].updateSequenceFrame();
              this.particleArr[i].position.z += 0.01;
              if (this.particleArr[i].position.z >= 6) {
                this.particleArr[i].position.z = -6;
              }
            }
          }
          TWEEN.update();
          // console.log(this.camera.position)
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
        container: '#app-32-map',
        axesVisibel: true,
        controls: {
          enableDamping: true, // 阻尼
          maxPolarAngle: (Math.PI / 2) * 0.98,
        },
      });
      baseEarth.run();
      window.addEventListener('resize', resize);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('resize', resize);
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
