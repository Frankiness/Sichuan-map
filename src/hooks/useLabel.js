import { provinceData, provinceIcon } from "@/utils/data";
import { Vector3 } from "three";
import { geoProjection } from "@/utils/utils";

const customLabel = (data, label3d, labelGroup) => {
  let label = label3d.create(
    "",
    `china-label ${data.blur ? " blur" : ""}`,
    false
  );
  const [g, m] = geoProjection(data.center);
  label.init(
    `<div class="other-label"><img class="label-icon" src="${provinceIcon}">${data.name}</div>`,
    new Vector3(g, -m, 0.4)
  );
  label3d.setLabelStyle(label, 0.02, "x");
  label.setParent(labelGroup);
  return label;
};

function l(data, label3d, labelGroup) {
  let label = label3d.create("", "guangdong-label", false);
  const [g, m] = geoProjection(data.center);
  label.init(
    `<div class="other-label"><span>${data.name}</span><span>${data.enName}</span></div>`,
    new Vector3(g, -m, 0.4)
  );
  label3d.setLabelStyle(label, 0.02, "x");
  label.setParent(labelGroup);
  return label;
}
function customIcon(data, label3d, labelGroup) {
  let label = label3d.create(
    "",
    `decoration-label  ${data.reflect ? " reflect" : ""}`,
    false
  );
  const [g, m] = geoProjection(data.center);
  label.init(
    `<div class="other-label"><img class="label-icon" style="width:${data.width};height:${data.height}" src="${data.icon}">`,
    new Vector3(g, -m, 0.4)
  );
  label3d.setLabelStyle(label, 0.02, "x");
  label.setParent(labelGroup);
  return label;
}

export const userLabel = () => {
  const createLabel = (_this) => {
    let labelGroup = _this.labelGroup;
    let label3d = _this.label3d;
    let arr = [];
    provinceData.map((item) => {
      if (item.hide === true) return false;
      let label = customLabel(item, label3d, labelGroup);
      arr.push(label);
    });
    let text = l(
      {
        name: "浙江省",
        enName: "ZHEJIANG PROVINCE",
        center: [120.109913, 26.881466],
      },
      label3d,
      labelGroup
    );
    let icon1 = customIcon(
      {
        icon: provinceIcon,
        center: [125.109913, 26.881466],
        width: "40px",
        height: "40px",
        reflect: true,
      },
      label3d,
      labelGroup
    );
    let icon2 = customIcon(
      {
        icon: provinceIcon,
        center: [116.109913, 26.881466],
        width: "20px",
        height: "20px",
        reflect: false,
      },
      label3d,
      labelGroup
    );
    arr.push(text, icon1, icon2);
    _this.scene.add(...arr)
    _this.otherLabel = arr;
  };
  return { createLabel };
};
