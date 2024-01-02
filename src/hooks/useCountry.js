import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { deepMerge } from '@/utils';
const useCountryLine = () => {
  /**
   * 创建国家平面边线
   * @param {*} data 数据
   * @param {*} materialOptions 材质参数
   * @returns
   */
  const createCountryFlatLine = (
    data,
    materialOptions = {},
    lineType = 'LineLoop'
  ) => {
    let materialOpt = {
      color: 0x00ffff,
    };
    materialOpt = deepMerge(materialOpt, materialOptions);
    let material = new THREE.LineBasicMaterial(materialOpt);
    if (lineType === 'Line2') {
      material = new LineMaterial(materialOpt);
    }
    let features = data.features;
    let lineGroup = new THREE.Group();
    for (let i = 0; i < features.length; i++) {
      const element = features[i];
      element.geometry.coordinates.forEach((coords, idx) => {
        // 每一块的点数据
        const points = [];
        if (lineType === 'Line2') {
          coords[0].forEach((item) => {
            points.push(item[0], item[1], 0);
          });

          // 根据每一块的点数据创建线条
          let line = createLine(points, material, lineType);

          // 将线条插入到组中
          // if (i === 0 && idx === 0) {
          // }
          lineGroup.add(line);
        } else {
          coords[0].forEach((item) => {
            points.push(new THREE.Vector3(item[0], item[1], 0));
          });
          // 根据每一块的点数据创建线条
          let line = createLine(points, material, lineType);
          // 将线条插入到组中
          lineGroup.add(line);
        }
      });
    }
    // 返回所有线条
    return lineGroup;
  };
  /**
   * 根据点数据创建闭合的线条
   * @param {*} points 点数据
   * @param {*} material 材质
   * @param {*} lineType 生成的线条类型 Line 线 | LineLoop 环线 | LineSegments 线段 | Line2
   * @returns
   */
  const createLine = (points, material, lineType = 'LineLoop') => {
    let line = null;
    if (lineType === 'Line2') {
      const geometry = new LineGeometry();
      geometry.setPositions(points);
      line = new Line2(geometry, material);
      line.name = 'countryLine2';
      line.computeLineDistances();
      // console.log(line, geometry, material)
    } else {
      const geometry = new THREE.BufferGeometry();
      geometry.setFromPoints(points);
      line = new THREE[lineType](geometry, material);
      line.name = 'countryLine';
    }
    return line;
  };
  return {
    createCountryFlatLine,
  };
};
export default useCountryLine;
