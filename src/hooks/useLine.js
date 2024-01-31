import * as d3 from "d3";
import {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  Vector3,
} from "three";
import { initCoord } from "@/utils/utils";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";

export class Line {
  constructor(opt = {}) {
    this.config = Object.assign(
      {
        visibleProvince: "",
        center: [0, 0],
        data: "",
        material: new LineBasicMaterial({ color: 16777215 }),
        type: "LineLoop",
        renderOrder: 1,
      },
      opt
    );
    let jsonData = initCoord(this.config.data);

    this.lineGroup = this.create(jsonData);
  }
  geoProjection(e) {
    return d3
      .geoMercator()
      .center(this.config.center)
      .scale(120)
      .translate([0, 0])(e);
  }
  create(jsonData) {
    const { type, visibleProvince } = this.config;
    let features = jsonData.features;
    let group = new Group();
    for (let i = 0; i < features.length; i++) {
      const d = features[i];
      d.properties.name !== visibleProvince &&
        d.geometry.coordinates.forEach((h) => {
          const u = [];
          let province;
          if (type === "Line2") {
            h[0].forEach((m) => {
              const [c, o] = this.geoProjection(m);
              if (!isNaN(c) && !isNaN(o)) u.push(c, -o, 0);
            });
            province = this.createLine2(u);
          } else {
            h[0].forEach((m) => {
              const [c, o] = this.geoProjection(m);
              if (!isNaN(c) || !isNaN(o)) u.push(new Vector3(c, -o, 0));
            });
            province = this.createLine(u);
          }
          group.add(province);
        });
    }
    return group;
  }
  createLine2(e) {
    const { material, renderOrder } = this.config;
    const lineGeo = new LineGeometry();
    lineGeo.setPositions(e);
    let line = new Line2(renderOrder, material);
    line.name = "mapLine2";
    line.renderOrder = renderOrder;
    line.computeLineDistances();
    return line;
  }
  createLine(e) {
    const { material, renderOrder } = this.config;
    const geo = new BufferGeometry();
    geo.setFromPoints(e);
    let line = new LineLoop(geo, material);
    line.renderOrder = renderOrder;
    line.name = "mapLine";
    return line;
  }
  setParent(node) {
    node.add(this.lineGroup);
  }
}
