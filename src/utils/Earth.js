import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import TWEEN from "@tweenjs/tween.js";
import { deepMerge, isType } from "@/utils";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer";
import { AxesHelper, PerspectiveCamera, Scene, WebGLRenderer } from "three";

export default class Earth3d {
  constructor(options = {}) {
    let defaultOptions = {
      isFull: true,
      container: null,
      width: window.innerWidth,
      height: window.innerHeight,
      bgColor: 0x000000,
      materialColor: 0xff0000,
      controls: {
        visibel: true, // 是否开启
        enableDamping: true, // 阻尼
        autoRotate: false, // 自动旋转
        maxPolarAngle: Math.PI, // 相机垂直旋转角度的上限
      },
      statsVisibel: true,
      axesVisibel: true,
      axesHelperSize: 250, // 左边尺寸
    };
    this.options = deepMerge(defaultOptions, options);
    this.container = document.querySelector(this.options.container);
    this.options.width = this.container.offsetWidth;
    this.options.height = this.container.offsetHeight;
    this.scene = new Scene(); // 场景
    this.camera = null; // 相机
    this.renderer = null; // 渲染器
    this.mesh = null; // 网格
    this.animationStop = null; // 用于停止动画
    this.controls = null; // 轨道控制器
    this.stats = null; // 统计

    this.init();
  }
  init() {
    this.initStats();
    this.initCamera();
    this.initRenderer();
    this.initAxes();
    this.initControls();
    let gl = this.renderer.domElement.getContext("webgl");
    gl && gl.getExtension("WEBGL_lose_context").loseContext();
  }

  /**
   * 运行
   */
  run() {
    this.loop();
  }
  // 循环
  loop() {
    this.animationStop = window.requestAnimationFrame(() => {
      this.loop();
    });
    // 这里是你自己业务上需要的code
    this.renderer.render(this.scene, this.camera);
    // 控制相机旋转缩放的更新
    if (this.options.controls.visibel) this.controls.update();
    // 统计更新
    if (this.options.statsVisibel) this.stats.update();

    TWEEN.update();
  }
  initCamera() {
    let { width, height } = this.options;
    let rate = width / height;
    // 设置45°的透视相机,更符合人眼观察
    this.camera = new PerspectiveCamera(45, rate, 0.1, 1500);
    this.camera.position.set(270.27, 173.24, 257.54);

    this.camera.lookAt(0, 0, 0);
  }
  /**
   * 初始化渲染器
   */
  initRenderer() {
    let { width, height, bgColor } = this.options;
    let renderer = new WebGLRenderer({
      antialias: true, // 锯齿
    });
    // 设置canvas的分辨率
    renderer.setPixelRatio(window.devicePixelRatio);
    // 设置canvas 的尺寸大小
    renderer.setSize(width, height);
    // 设置背景色
    renderer.setClearColor(bgColor, 1);
    // 插入到dom中
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.render3d = new CSS3DRenderer();
    this.render3d.setSize(width, height);
  }

  initStats() {
    if (!this.options.statsVisibel) return false;
    this.stats = new Stats();
    this.container.appendChild(this.stats.dom);
  }
  initControls() {
    try {
      let {
        controls: { enableDamping, autoRotate, visibel, maxPolarAngle },
      } = this.options;
      if (!visibel) return false;
      // 轨道控制器，使相机围绕目标进行轨道运动（旋转|缩放|平移）
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.maxPolarAngle = maxPolarAngle;
      this.controls.autoRotate = autoRotate;
      this.controls.enableDamping = enableDamping;
    } catch (error) {
      console.log(error);
    }
  }
  initAxes() {
    if (!this.options.axesVisibel) return false;
    const axes = new AxesHelper(this.options.axesHelperSize);
    this.addObject(axes);
  }

  // 清空dom
  empty(elem) {
    while (elem && elem.lastChild) elem.removeChild(elem.lastChild);
  }
  /**
   * 添加对象到场景
   * @param {*} object  {} []
   */
  addObject(object) {
    if (isType("Array", object)) {
      this.scene.add(...object);
    } else {
      this.scene.add(object);
    }
  }
  /**
   * 移除对象
   * @param {*} object {} []
   */
  removeObject(object) {
    if (isType("Array", object)) {
      object.map((item) => {
        item.geometry.dispose();
      });
      this.scene.remove(...object);
    } else {
      object.geometry.dispose();
      this.scene.remove(object);
    }
  }
  /**
   * 重置
   */
  resize() {
    // 重新设置宽高

    this.options.width = this.container.innerWidth || window.innerWidth;
    this.options.height = this.container.innerHeight || window.innerHeight;

    this.renderer.setSize(this.options.width, this.options.height);
    // 重新设置相机的位置
    let rate = this.options.width / this.options.height;

    // 必須設置相機的比例，重置的時候才不会变形
    this.camera.aspect = rate;

    // 渲染器执行render方法的时候会读取相机对象的投影矩阵属性projectionMatrix
    // 但是不会每渲染一帧，就通过相机的属性计算投影矩阵(节约计算资源)
    // 如果相机的一些属性发生了变化，需要执行updateProjectionMatrix ()方法更新相机的投影矩阵
    this.camera.updateProjectionMatrix();
  }
}
