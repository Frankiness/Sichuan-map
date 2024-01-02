import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import useCoord from '@/hooks/useCoord.js';
import maxBy from '@/utils/lodash/maxBy.js';
import minBy from '@/utils/lodash/minBy.js';
import pointInPolygon from 'point-in-polygon';
import delaunator from 'delaunator';
/**
 * 生成国家网格Mesh
 * @returns
 */
export default function useCountryMesh() {
  const { geoSphereCoord } = useCoord();
  /**
   * 生成地图的网格
   * @param {*} worldData
   */
  const generateMap = (worldData) => {
    // 生成国家网格
    let features = worldData.features;
    let meshArr = [];
    for (let i = 0; i < features.length; i++) {
      // 坐标
      let coordinates = features[i].geometry.coordinates;
      // 国家名称
      let name = features[i].properties.name;
      let currentGeometry = [];
      coordinates.forEach((item) => {
        // 获取集合体的索引和坐标
        let { index, coords } = generateMapCoordAndIndex(item[0]);
        // 设置几何体的索引及位置属性就可以创建网格模型
        let geometry = new THREE.BufferGeometry();
        // 设置几何体的索引：索引为三角剖分获取的索引
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(index), 1));
        // 设置几何体的位置属性。==================位置数组是内部+边线所有点坐标
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(coords), 3)
        );
        currentGeometry.push(geometry);
      });

      let newGeometry = null;
      if (currentGeometry.length > 1) {
        // 一个国家多个几合体，需要合并
        newGeometry = mergeBufferGeometries(currentGeometry);
      } else if (currentGeometry.length === 1) {
        newGeometry = currentGeometry[0];
      }
      // 如果使用受光照影响材质，需要计算生成法线
      newGeometry.computeVertexNormals();

      // 设置材质 MeshLambertMaterial
      let material = new THREE.MeshLambertMaterial({
        color: 0x00ffff,

        side: THREE.DoubleSide,
      });
      let mesh = new THREE.Mesh(newGeometry, material);
      mesh.name = name;
      meshArr.push(mesh);
    }
    return meshArr;
  };
  /**
   * 生成地图上所有国家的坐标和索引
   * @param {*} coordinates 坐标
   * @returns
   */
  const generateMapCoordAndIndex = (coordinates) => {
    let countryCoords = [];
    for (let i = 0; i < coordinates.length; i++) {
      countryCoords.push(
        new THREE.Vector3(coordinates[i][0], coordinates[i][1], 0)
      );
    }
    // 生成内部的网格点
    let { scopeInsidePoint: countryInsideGridCoords } =
      generateGrid(countryCoords);
    // 将边框上的点和内部的点合并
    countryInsideGridCoords = countryCoords.concat(countryInsideGridCoords);
    // 将所有内部的点进行三角剖分，生成网格的坐标，索引
    return delaunatorCoordIndex(countryCoords, countryInsideGridCoords);
  };

  /**
   * 生成网格点
   * @param {*} coordinates 坐标 [Vector3(x, y, 0),Vector3(x, y, 0)]
   * @param {*} gap 网格点间距，越小越平滑，消耗的性格越大
   * @returns 返回内容点，和所有点
   */
  const generateGrid = (coordinates, gap = 3) => {
    // coords整个多边形的坐标点。x,y
    let coords = coordinates.map((item) => {
      return [item.x, item.y];
    });
    // 计算最大最小经纬度
    // lon lat 经纬度的最大最小值
    // 通过Math.floor、Math.ceil向两侧取整，把经纬度的方位稍微扩大
    let minLon = Math.floor(
      minBy(coordinates, function (o) {
        return o.x;
      }).x
    );
    let maxLon = Math.ceil(
      maxBy(coordinates, function (o) {
        return o.x;
      }).x
    );
    let minLat = Math.floor(
      minBy(coordinates, function (o) {
        return o.y;
      }).y
    );
    let maxLat = Math.ceil(
      maxBy(coordinates, function (o) {
        return o.y;
      }).y
    );

    // 计算经纬度的范围
    let lonScope = Math.ceil((maxLon - minLon) / gap);
    let latScope = Math.ceil((maxLat - minLat) / gap);
    let scopePoint = [];
    // 循环生成点矩阵坐标
    for (let i = 0; i < lonScope + 1; i++) {
      let x = minLon + i * gap;
      for (let j = 0; j < latScope + 1; j++) {
        let y = minLat + j * gap;
        scopePoint.push([x, y]);
      }
    }
    // 返回在多边形中的点
    let scopeInsidePoint = scopePoint
      .filter((item) => {
        return pointInPolygon(item, coords);
      })
      .map((item) => {
        return new THREE.Vector3(item[0], item[1], 0);
      });
    return { scopeInsidePoint, scopePoint };
  };

  /**
   * 三角剖分,获取集合体的坐标和索引
   * @param {*} countryCoords 国家的经纬度坐标
   * @param {*} countryInsideGridCoords 国家内部+边线所有点坐标
   * @returns
   */
  const delaunatorCoordIndex = (countryCoords, countryInsideGridCoords) => {
    //转换如下格式的坐标： [[X,Y],[X,Y],[X,Y]]
    let coords = countryCoords.map((item) => {
      return [item.x, item.y];
    });
    // 内部+边线所有点坐标,转换如下格式的坐标:[x,y,0,x,y,0]
    let coordsZ = [];
    countryInsideGridCoords.forEach((item) => {
      let { x, y, z } = geoSphereCoord(100, item.x, item.y);
      coordsZ.push(x, y, z);
    });
    //
    let countryInsideGridCoordsArr = countryInsideGridCoords.map((item) => {
      return [item.x, item.y];
    });
    // 三角剖分  获取三角的索引值
    let trianglesIndex = delaunator.from(countryInsideGridCoordsArr).triangles;
    // 三角抛分获得的索引,需要改变法线方向
    let transformTrianglesIndex = [];

    // 删除多边形外面的三角形，需要判断外部三角形的重心，如果重心不在内部，就删除，反过来及在内部就添加。
    // 重心的计算：[(x1+x2+x3) / 3,(y1+y2+y3) / 3]
    // console.log(coords)
    for (let i = 0; i < trianglesIndex.length; i += 3) {
      let p1 = countryInsideGridCoords[trianglesIndex[i]];
      let p2 = countryInsideGridCoords[trianglesIndex[i + 1]];
      let p3 = countryInsideGridCoords[trianglesIndex[i + 2]];
      // 重心计算
      let center = [(p1.x + p2.x + p3.x) / 3, (p1.y + p2.y + p3.y) / 3];
      // 如果重心在多边形内部,保留内部的索引，重心点与国家边线坐标进行比对
      if (pointInPolygon(center, coords)) {
        // console.log(center)
        // 按这种顺序，需要材质设置背面可见（THREE.BackSide）,才能看到国家mesh，所以我们可以改变法线方向
        // transformTrianglesIndex.push(trianglesIndex[i], trianglesIndex[i + 1], trianglesIndex[i + 2])
        //有一点需要注意，一个三角形索引逆时针和顺时针顺序对应three.js三角形法线方向相反，或者说Mesh正面、背面方向不同
        transformTrianglesIndex.push(
          trianglesIndex[i + 2],
          trianglesIndex[i + 1],
          trianglesIndex[i]
        );
      }
    }

    return { index: transformTrianglesIndex, coords: coordsZ };
  };

  return { generateMap, generateGrid };
}
