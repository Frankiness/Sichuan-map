import * as THREE from "three";
import TWEEN from "@tweenjs/tween.js";

/**
 * 创建飞线
 */
export default class FlyLine {
  scene;
  data;
  cycle;
  ThreeGroup;

  constructor(scene, data, options) {
    this.scene = scene;
    this.data = data;
    this.ThreeGroup = new THREE.Group();
    this.cycle = options?.cycle || 2000;
    this.scene.add(this._draw());
    this._animate();
  }

  _animate() {
    TWEEN.update();
    requestAnimationFrame(() => {
      this._animate();
    });
  }

  _draw() {
    this.data.map((data) => {
      const startPoint = data.begin; // 起始点
      const endPoint = data.end; // 终点
      const curveH = data.height; // 飞线最大高
      const offset = data.offset; // 偏移

      // 设置纹理
      const textloader = new THREE.TextureLoader();
      const texture = textloader.load("data/map/flyLine.png"); //
      texture.repeat.set(1, 18);
      texture.colorSpace = "srgb";
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      const radius = 0.03;
      const tubularSegments = 32;
      const radialSegments = 8;
      const closed = false;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        alphaMap: texture,
        color: 2781042,
        transparent: true,
        fog: false,
        opacity: 1,
        depthTest: false,
        blending: 2,
      });

      let vector = new THREE.Vector3(startPoint[0], startPoint[1], offset);
      const vec1 = new THREE.Vector3(endPoint[0], endPoint[1], offset);
      const vec2 = new THREE.Vector3();
      vec2.addVectors(vector, vec1).multiplyScalar(0.5);
      vec2.setZ(curveH);
      const quadra = new THREE.QuadraticBezierCurve3(vector, vec2, vec1);
      const tube = new THREE.TubeGeometry(
        quadra,
        tubularSegments,
        radius,
        radialSegments,
        closed
      );

      this.ThreeGroup.add(new THREE.Mesh(tube, material));

      let tween = new TWEEN.Tween({ x: 0 })
        .to({ x: 100 }, this.cycle)
        .onUpdate(() => {
          texture.offset.x -= 0.0005;
        })
        .repeat(Infinity);
      tween.start();
    });

    return this.ThreeGroup;
  }

  _remove() {
    this.scene.remove(this.ThreeGroup);
    this.ThreeGroup.children.map((l) => {
      l.geometry.dispose();
      l.material.dispose();
    });
  }
}
