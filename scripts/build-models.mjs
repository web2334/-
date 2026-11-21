// Генератор собственных 3D-моделей «Ворс» (three.js → GLB).
// Модели целиком созданы этим скриптом: права принадлежат владельцу исходников,
// сторонних ассетов нет. Запуск: npm run models (затем оптимизация в optimize-models.mjs).
//
// Структура каждой модели:
//   Root
//   └─ Body              — корпус (для анимации Hop)
//      ├─ меши мебели    — userData.stain = true у поверхностей для мини-игры
//      ├─ Face           — лицо (можно скрыть настройкой)
//      │   ├─ Eye_L / Eye_R (анимация Blink — масштаб по Y)
//      │   └─ щёки, рот
//      ├─ Arm_L / Arm_R  — руки, точка вращения в плече (анимация Wave)
//      ├─ SpeechAnchor   — точка привязки реплики
//      └─ EyeAnchor      — центр глаз (реплика не должна их закрывать)
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdirSync, writeFileSync } from "node:fs";

// --- Полифилл FileReader для GLTFExporter в Node ---------------------------------
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
};

const OUT = fileURLToPath(new URL("../models-src/", import.meta.url));
mkdirSync(OUT, { recursive: true });

// --- Палитра ---------------------------------------------------------------------
const P = {
  walnut: "#6B4A32",
  oak: "#B48A5E",
  ink: "#26221F",
  white: "#FFFFFF",
  cheek: "#EE9C8E",
  glove: "#F4ECDF",
  metal: "#3A3A3C",
};

const matCache = new Map();
function mat(name, color, { rough = 0.85, metal = 0, fabric = false } = {}) {
  const key = `${name}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ name, color: new THREE.Color(color), roughness: rough, metalness: metal });
  m.userData = { fabric };
  matCache.set(key, m);
  return m;
}

// --- Геометрия -------------------------------------------------------------------
/** UV в метрах по доминирующей оси нормали — для плитки ткани одного масштаба на всех гранях. */
function worldBoxUV(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k];
      let u, v;
      if (ax >= ay && ax >= az) { u = p.z; v = p.y; }
      else if (ay >= az) { u = p.x; v = p.z; }
      else { u = p.x; v = p.y; }
      // UV в диапазоне [0,1] (метры + 2) / 4 — так их можно квантизовать; плотность ткани задаёт
      // KHR_texture_transform в optimize-models.mjs
      uv[(i + k) * 2] = (u + 2) / 4;
      uv[(i + k) * 2 + 1] = (v + 2) / 4;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return mergeVertices(g, 1e-5);
}

/** Мягкая подушка: скруглённый бокс с выпуклым верхом. */
function cushion(w, h, d, r, bulge = 0.25) {
  const g = new RoundedBoxGeometry(w, h, d, 5, Math.min(r, h / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i), z = pos.getZ(i) / (d / 2);
    const f = Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z);
    if (y > 0) pos.setY(i, y + f * h * bulge * (y / (h / 2)));
    else pos.setY(i, y + f * h * bulge * 0.25 * (y / (h / 2)));
  }
  g.computeVertexNormals();
  return g;
}

/** Подушка, выпуклая вперёд (+Z) — для спинок. */
function backCushion(w, h, d, r, bulge = 0.3) {
  const g = new RoundedBoxGeometry(w, h, d, 5, Math.min(r, h / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2), z = pos.getZ(i);
    const f = Math.max(0, 1 - x * x) * Math.max(0, 1 - y * y);
    if (z > 0) pos.setZ(i, z + f * d * bulge * (z / (d / 2)));
  }
  g.computeVertexNormals();
  return g;
}

function rbox(w, h, d, r) {
  return new RoundedBoxGeometry(w, h, d, 4, Math.min(r, h / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001));
}

function add(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], name, extra = {}) {
  const g = material.userData.fabric ? worldBoxUV(geo) : geo;
  const m = new THREE.Mesh(g, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (name) m.name = name;
  Object.assign(m.userData, extra);
  parent.add(m);
  return m;
}

function taperedLeg(parent, material, x, z, h, rTop = 0.026, rBot = 0.018, y0 = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 16);
  add(parent, g, material, [x, y0 + h / 2, z]);
}

// --- Лицо ------------------------------------------------------------------------
/**
 * Лицо на поверхности. center — точка на поверхности, tilt — наклон назад (рад).
 * curveR — радиус цилиндрической поверхности (пуф), черты повторяют изгиб.
 */
function buildFace(body, { center, tilt = 0, eyeR = 0.06, spacing = 0.24, curveR = 0 }) {
  const face = new THREE.Group();
  face.name = "Face";
  face.position.set(...center);
  face.rotation.x = -tilt;
  body.add(face);

  const ink = mat("Face_Ink", P.ink, { rough: 0.35 });
  const white = mat("Face_Highlight", P.white, { rough: 0.2 });
  const cheekM = mat("Face_Cheek", P.cheek, { rough: 0.9 });

  const place = (obj, x, y, lift) => {
    if (curveR > 0) {
      const phi = x / curveR;
      obj.position.set(Math.sin(phi) * (curveR + lift) , y, Math.cos(phi) * (curveR + lift) - curveR);
      obj.rotation.y = phi;
    } else obj.position.set(x, y, lift);
  };

  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.name = side < 0 ? "Eye_L" : "Eye_R";
    place(eye, (side * spacing) / 2, 0, eyeR * 0.12);
    face.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 24, 16), ink);
    ball.scale.set(0.92, 1.12, 0.42);
    eye.add(ball);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.28, 12, 8), white);
    hl.position.set(eyeR * 0.3, eyeR * 0.38, eyeR * 0.36);
    hl.scale.set(1, 1, 0.5);
    eye.add(hl);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.12, 8, 6), white);
    hl2.position.set(-eyeR * 0.22, -eyeR * 0.3, eyeR * 0.38);
    hl2.scale.set(1, 1, 0.5);
    eye.add(hl2);

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.55, 16, 10), cheekM);
    cheek.scale.set(1.25, 0.8, 0.22);
    place(cheek, side * (spacing / 2 + eyeR * 0.75), -eyeR * 1.35, eyeR * 0.04);
    cheek.name = side < 0 ? "Cheek_L" : "Cheek_R";
    face.add(cheek);
  }

  const arc = Math.PI * 0.62;
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(eyeR * 0.62, eyeR * 0.12, 8, 24, arc), ink);
  mouth.rotation.z = -Math.PI / 2 - arc / 2;
  const mouthWrap = new THREE.Group();
  mouthWrap.name = "Mouth";
  place(mouthWrap, 0, -eyeR * 0.95, eyeR * 0.08);
  mouthWrap.add(mouth);
  face.add(mouthWrap);

  // Якоря для реплики: центр глаз и точка над лицом
  const eyeAnchor = new THREE.Object3D();
  eyeAnchor.name = "EyeAnchor";
  face.add(eyeAnchor);
  return face;
}

// --- Руки ------------------------------------------------------------------------
/**
 * Рука: плечевой шарик на боковой поверхности, «рукав»-капсула и варежка с большим пальцем.
 * Точка вращения — в плече. restAngle — угол отведения наружу от вертикали.
 */
function buildArm(body, side, { shoulder, length = 0.3, r = 0.034, handR = 0.058, restAngle = 0.35, color }) {
  const sleeve = mat(`Arm_${color}`, color, { rough: 0.85, fabric: false });
  const glove = mat("Glove", P.glove, { rough: 0.8 });
  const arm = new THREE.Group();
  arm.name = side < 0 ? "Arm_L" : "Arm_R";
  arm.position.set(...shoulder);
  arm.rotation.z = side * restAngle;
  body.add(arm);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 16, 12), sleeve);
  arm.add(ball);
  const cap = new THREE.Mesh(new THREE.CapsuleGeometry(r, length, 6, 14), sleeve);
  cap.position.y = -length / 2;
  arm.add(cap);
  const hand = new THREE.Group();
  hand.position.y = -length - handR * 0.55;
  arm.add(hand);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(handR, 20, 14), glove);
  palm.scale.set(0.95, 1.08, 0.78);
  hand.add(palm);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(handR * 0.32, handR * 0.45, 4, 10), glove);
  thumb.position.set(-side * handR * 0.78, handR * 0.15, handR * 0.25);
  thumb.rotation.z = side * 0.9;
  hand.add(thumb);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.38, 8, 18), glove);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -length + r * 0.1;
  arm.add(cuff);

  arm.userData = { length, r, handR, side };
  return arm;
}

// --- Анимации --------------------------------------------------------------------
function q(axis, angle) {
  return new THREE.Quaternion().setFromAxisAngle(axis, angle).toArray();
}
const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

function clips(restR, restL, bodyY = 0) {
  const blink = new THREE.AnimationClip("Blink", 0.24, [
    new THREE.VectorKeyframeTrack("Eye_L.scale", [0, 0.08, 0.14, 0.24], [1, 1, 1, 1, 0.08, 1, 1, 0.08, 1, 1, 1, 1]),
    new THREE.VectorKeyframeTrack("Eye_R.scale", [0, 0.08, 0.14, 0.24], [1, 1, 1, 1, 0.08, 1, 1, 0.08, 1, 1, 1, 1]),
  ]);
  // Взмах правой рукой: поднять наружу, три покачивания, опустить.
  const up = 2.35;
  const wt = [0, 0.35, 0.6, 0.85, 1.1, 1.35, 1.75];
  const wa = [restR, up, up - 0.35, up + 0.15, up - 0.35, up, restR];
  const wave = new THREE.AnimationClip("Wave", 1.75, [
    new THREE.QuaternionKeyframeTrack("Arm_R.quaternion", wt, wa.flatMap((a) => q(Z, a))),
  ]);
  // Радостный подскок с лёгким покачиванием.
  const ht = [0, 0.15, 0.32, 0.48, 0.7];
  const hop = new THREE.AnimationClip("Hop", 0.7, [
    new THREE.VectorKeyframeTrack("Body.position", ht, [0, bodyY, 0, 0, bodyY + 0.05, 0, 0, bodyY + 0.09, 0, 0, bodyY + 0.02, 0, 0, bodyY, 0]),
    new THREE.QuaternionKeyframeTrack("Body.quaternion", ht, [0, 0.05, -0.05, 0.03, 0].flatMap((a) => q(Z, a))),
    new THREE.QuaternionKeyframeTrack("Arm_L.quaternion", ht, [restL, restL - 0.5, restL - 0.7, restL - 0.3, restL].flatMap((a) => q(Z, a))),
    new THREE.QuaternionKeyframeTrack("Arm_R.quaternion", ht, [restR, restR + 0.5, restR + 0.7, restR + 0.3, restR].flatMap((a) => q(Z, a))),
  ]);
  return [blink, wave, hop];
}

// --- Проверка: руки не заходят в корпус --------------------------------------------
function checkArms(name, root, arms, waveUp = 2.35) {
  root.updateMatrixWorld(true);
  const bodyBoxes = [];
  root.traverse((o) => {
    if (o.isMesh && o.userData.part === "body") {
      o.geometry.computeBoundingBox();
      bodyBoxes.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).expandByScalar(-0.004));
    }
  });
  const problems = [];
  for (const arm of arms) {
    const { length, r, handR, side } = arm.userData;
    const rest = arm.rotation.z;
    const angles = [rest, side > 0 ? waveUp - 0.35 : rest, side > 0 ? waveUp + 0.15 : rest, side * (Math.abs(rest) + 0.7)];
    for (const a of angles) {
      arm.rotation.z = a;
      arm.updateMatrixWorld(true);
      // точки вдоль руки, начиная за плечевым шариком
      for (let t = r * 1.6; t <= length + handR * 1.5; t += 0.01) {
        const p = new THREE.Vector3(0, -t, 0).applyMatrix4(arm.matrixWorld);
        const rad = t > length ? handR * 0.9 : r;
        const sphere = new THREE.Sphere(p, rad);
        for (const b of bodyBoxes) if (b.intersectsSphere(sphere)) problems.push(`${arm.name} @${a.toFixed(2)} t=${t.toFixed(2)}`);
        if (p.y - rad < -0.001) problems.push(`${arm.name} под полом @${a.toFixed(2)}`);
      }
    }
    arm.rotation.z = rest;
  }
  root.updateMatrixWorld(true);
  const uniq = [...new Set(problems)];
  console.log(uniq.length ? `  ⚠ ${name}: пересечения ${uniq.slice(0, 6).join("; ")}` : `  ✓ ${name}: руки не пересекают корпус`);
  return uniq.length === 0;
}

function markBody(group) {
  group.traverse((o) => {
    if (o.isMesh && !o.userData.part) o.userData.part = "body";
  });
}

// --- Мебель ----------------------------------------------------------------------
function sofaLike({ seats, seatW, depth = 0.92, color, backTilt = 0.12, armW = 0.2, recliner = false, chaise = false }) {
  const root = new THREE.Group();
  root.name = "Root";
  const body = new THREE.Group();
  body.name = "Body";
  root.add(body);
  const fabric = mat(`Fabric_${color}`, color, { rough: 0.92, fabric: true });
  const fabricDark = mat(`FabricDark_${color}`, new THREE.Color(color).multiplyScalar(0.86).getStyle(), { rough: 0.95, fabric: true });
  const wood = mat("Wood_Walnut", P.walnut, { rough: 0.55 });

  const legH = 0.12;
  const innerW = seats * seatW;
  const W = innerW + armW * 2;
  const D = depth;
  const baseY = legH;
  const seatTop = 0.44;

  const furniture = new THREE.Group();
  furniture.name = "Furniture";
  body.add(furniture);

  // Основание и спинка
  add(furniture, rbox(W - 0.02, 0.2, D - 0.02, 0.04), fabricDark, [0, baseY + 0.1, 0]);
  add(furniture, rbox(W - 0.02, 0.56, 0.2, 0.06), fabric, [0, baseY + 0.28 + 0.1, -D / 2 + 0.1]);
  // Подлокотники
  const armH = recliner ? 0.56 : 0.5;
  for (const s of [-1, 1]) {
    if (chaise && s > 0) continue;
    add(furniture, rbox(armW, armH, D, 0.08), fabric, [s * (W / 2 - armW / 2), baseY + armH / 2, 0]);
  }
  // Сиденья
  const seatD = D - 0.28;
  for (let i = 0; i < seats; i++) {
    const x = -innerW / 2 + seatW * (i + 0.5);
    add(furniture, cushion(seatW - 0.02, 0.15, seatD, 0.06, 0.22), fabric, [x, seatTop - 0.075 + 0.02, D / 2 - seatD / 2 - 0.01], [0, 0, 0], `Seat_${i}`, { stain: true });
  }
  // Подушка спинки — одна длинная (на ней лицо)
  const backH = recliner ? 0.48 : 0.42;
  const backY = seatTop + 0.02 + backH / 2;
  const backZ = -D / 2 + 0.2 + 0.09;
  add(furniture, backCushion(innerW - 0.03, backH, 0.17, 0.08, 0.35), fabric, [0, backY, backZ], [-backTilt, 0, 0], "BackCushion", { stain: true });

  // Ножки
  const inset = 0.07;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) taperedLeg(furniture, wood, sx * (W / 2 - inset), sz * (D / 2 - inset), legH);

  let extraRightX = W / 2;
  if (chaise) {
    // Оттоманка справа: длинное сиденье, выдвинутое вперёд, и свой подлокотник
    const cw = seatW + 0.02;
    const cd = 1.5;
    const cx = W / 2 - armW + cw / 2 - 0.01 + armW;
    const cz = -D / 2 + cd / 2;
    add(furniture, rbox(cw, 0.2, cd - 0.02, 0.04), fabricDark, [cx, baseY + 0.1, cz]);
    add(furniture, cushion(cw - 0.03, 0.15, cd - 0.3, 0.06, 0.2), fabric, [cx, seatTop - 0.055, cz + 0.13], [0, 0, 0], "Seat_chaise", { stain: true });
    add(furniture, rbox(cw, 0.56, 0.2, 0.06), fabric, [cx, baseY + 0.38, -D / 2 + 0.1]);
    add(furniture, backCushion(cw - 0.04, backH, 0.17, 0.08, 0.35), fabric, [cx, backY, backZ], [-backTilt, 0, 0], "BackCushion_chaise", { stain: true });
    add(furniture, rbox(armW, armH, cd, 0.08), fabric, [cx + cw / 2 + armW / 2, baseY + armH / 2, cz]);
    for (const sz of [-1, 1]) taperedLeg(furniture, wood, cx + cw / 2 + armW - inset, cz + sz * (cd / 2 - inset), legH);
    taperedLeg(furniture, wood, cx - cw / 2 + inset, cz + cd / 2 - inset, legH);
    extraRightX = cx + cw / 2 + armW;
  }

  if (recliner) {
    // Выдвинутая подножка на механизме
    const metal = mat("Metal_Dark", P.metal, { rough: 0.4, metal: 0.6 });
    add(furniture, cushion(innerW - 0.04, 0.13, 0.4, 0.05, 0.15), fabric, [0, 0.3, D / 2 + 0.26], [0.12, 0, 0], "Footrest", { stain: true });
    for (const s of [-1, 1]) add(furniture, new THREE.BoxGeometry(0.025, 0.025, 0.36), metal, [s * (innerW / 2 - 0.12), 0.22, D / 2 + 0.08], [0.45, 0, 0]);
  }

  markBody(furniture);

  // Лицо на спинке
  const tiltVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), -backTilt);
  const faceCenter = new THREE.Vector3(0, backY + 0.02, backZ + 0.085 + 0.17 * 0.35 * 0.9);
  const eyeR = Math.min(0.068, 0.03 + seatW * 0.06);
  buildFace(body, { center: faceCenter.toArray(), tilt: backTilt, eyeR, spacing: eyeR * 4.2 });
  void tiltVec;

  // Руки по внешним сторонам подлокотников
  const armColor = new THREE.Color(color).multiplyScalar(0.92).getStyle();
  const shoulderY = baseY + armH * 0.62;
  const leftX = -W / 2 - 0.042;
  const rightX = extraRightX + 0.042;
  const arms = [
    buildArm(body, -1, { shoulder: [leftX, shoulderY, D / 2 - 0.17], color: armColor, length: 0.26 }),
    buildArm(body, 1, { shoulder: [rightX, shoulderY, chaise ? -D / 2 + 1.5 - 0.17 : D / 2 - 0.17], color: armColor, length: 0.26 }),
  ];

  addAnchors(body, faceCenter, eyeR);
  return { root, arms };
}

function addAnchors(body, faceCenter, eyeR) {
  const sa = new THREE.Object3D();
  sa.name = "SpeechAnchor";
  sa.position.set(faceCenter.x, faceCenter.y + eyeR * 4.2, faceCenter.z);
  body.add(sa);
}

function mattress({ width, depth = 2.0, height = 0.24 }) {
  // Длинная сторона по X — к зрителю обращён длинный бок
  const L = depth;
  const Wd = width;
  const H = height;
  const root = new THREE.Group();
  root.name = "Root";
  const body = new THREE.Group();
  body.name = "Body";
  root.add(body);
  const top = mat("Fabric_MattressTop", "#F1EBE0", { rough: 0.95, fabric: true });
  const band = mat("Fabric_MattressBand", "#C7D3DA", { rough: 0.9, fabric: true });
  const piping = mat("Piping", "#5B7486", { rough: 0.7 });
  const quilt = mat("Quilt_Thread", "#D9D0C1", { rough: 1 });
  const grom = mat("Metal_Grommet", "#9AA4AA", { rough: 0.35, metal: 0.7 });

  const f = new THREE.Group();
  f.name = "Furniture";
  body.add(f);

  const bandH = H - 0.06;
  add(f, rbox(L, bandH, Wd, 0.03), band, [0, bandH / 2 + 0.005, 0]);
  // Пухлый верх (pillow-top)
  add(f, cushion(L - 0.02, 0.07, Wd - 0.02, 0.035, 0.35), top, [0, bandH + 0.03, 0], [0, 0, 0], "MattressTop", { stain: true });

  // Кант по периметру сверху и снизу
  const pipe = (y, inset) => {
    const hw = L / 2 - inset, hd = Wd / 2 - inset, rr = 0.035;
    const pts = [];
    const corners = [[hw - rr, hd - rr, 0], [-(hw - rr), hd - rr, Math.PI / 2], [-(hw - rr), -(hd - rr), Math.PI], [hw - rr, -(hd - rr), Math.PI * 1.5]];
    for (const [cx, cz, a0] of corners) for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    const m = add(f, new THREE.TubeGeometry(curve, 160, 0.011, 8, true), piping);
    m.userData.part = "trim";
  };
  pipe(bandH + 0.003, 0.004);
  pipe(0.012, 0.004);

  // Стёжка: сетка швов и пуговицы на верхе
  const nx = Math.round(L / 0.25), nz = Math.max(2, Math.round(Wd / 0.25));
  const topY = bandH + 0.03 + 0.035 + 0.07 * 0.35 * 0.85;
  for (let i = 1; i < nx; i++) {
    const x = -L / 2 + (i * L) / nx;
    const m = add(f, new THREE.BoxGeometry(0.006, 0.006, Wd - 0.12), quilt, [x, topY - 0.012, 0]);
    m.userData.part = "trim";
  }
  for (let j = 1; j < nz; j++) {
    const z = -Wd / 2 + (j * Wd) / nz;
    const m = add(f, new THREE.BoxGeometry(L - 0.12, 0.006, 0.006), quilt, [0, topY - 0.012, z]);
    m.userData.part = "trim";
  }
  const btnG = new THREE.SphereGeometry(0.014, 10, 8);
  for (let i = 1; i < nx; i++)
    for (let j = 1; j < nz; j++) {
      const m = add(f, btnG, quilt, [-L / 2 + (i * L) / nx, topY - 0.008, -Wd / 2 + (j * Wd) / nz]);
      m.scale.set(1, 0.45, 1);
      m.userData.part = "trim";
    }

  // Вентиляционные люверсы и ручки-петли на боку
  const gG = new THREE.TorusGeometry(0.014, 0.004, 6, 16);
  for (const x of [-L * 0.36, L * 0.36]) for (const s of [-1, 1]) {
    const m = add(f, gG, grom, [x, bandH * 0.55, s * (Wd / 2 + 0.001)], [0, s > 0 ? 0 : Math.PI, 0]);
    m.userData.part = "trim";
  }
  const strap = mat("Strap", "#8DA0AC", { rough: 0.9 });
  for (const x of [-L * 0.22, L * 0.22]) {
    const h = add(f, new THREE.TorusGeometry(0.05, 0.009, 8, 20, Math.PI), strap, [x, bandH * 0.32, Wd / 2 + 0.006], [0, 0, Math.PI]);
    h.scale.set(1, 0.5, 1);
    h.userData.part = "trim";
  }
  markBody(f);

  const eyeR = 0.034;
  const faceCenter = new THREE.Vector3(0, bandH * 0.6, Wd / 2 + 0.002);
  buildFace(body, { center: faceCenter.toArray(), eyeR, spacing: eyeR * 4.6 });
  const arms = [
    buildArm(body, -1, { shoulder: [-L / 2 - 0.036, bandH * 0.62, Wd / 2 - 0.12], color: "#AEBDC6", length: 0.16, r: 0.03, handR: 0.05, restAngle: 1.3 }),
    buildArm(body, 1, { shoulder: [L / 2 + 0.036, bandH * 0.62, Wd / 2 - 0.12], color: "#AEBDC6", length: 0.16, r: 0.03, handR: 0.05, restAngle: 1.3 }),
  ];
  addAnchors(body, new THREE.Vector3(0, topY, Wd / 2 - 0.1), eyeR);
  return { root, arms };
}

function chair() {
  const root = new THREE.Group();
  root.name = "Root";
  const body = new THREE.Group();
  body.name = "Body";
  root.add(body);
  const fabric = mat("Fabric_Oat", "#D9CCB4", { rough: 0.92, fabric: true });
  const wood = mat("Wood_Oak", P.oak, { rough: 0.5 });
  const f = new THREE.Group();
  f.name = "Furniture";
  body.add(f);
  const S = 0.46, seatY = 0.45;
  // ножки
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) taperedLeg(f, wood, sx * (S / 2 - 0.035), sz * (S / 2 - 0.035), seatY - 0.03, 0.02, 0.014);
  // царга
  add(f, rbox(S, 0.05, S, 0.012), wood, [0, seatY - 0.045, 0]);
  add(f, cushion(S - 0.01, 0.07, S - 0.01, 0.03, 0.3), fabric, [0, seatY + 0.01, 0.005], [0, 0, 0], "Seat", { stain: true });
  // задние стойки, продолжающие ножки
  const postH = 0.46;
  for (const sx of [-1, 1]) {
    add(f, new THREE.CylinderGeometry(0.016, 0.019, postH, 14), wood, [sx * (S / 2 - 0.035), seatY + postH / 2 - 0.02, -S / 2 + 0.035], [-0.1, 0, 0]);
  }
  const backTilt = 0.1;
  const backY = seatY + 0.28;
  const backZ = -S / 2 + 0.02;
  add(f, backCushion(S - 0.08, 0.27, 0.05, 0.022, 0.4), fabric, [0, backY, backZ], [-backTilt, 0, 0], "Back", { stain: true });
  add(f, rbox(S - 0.02, 0.035, 0.035, 0.012), wood, [0, backY + 0.165, backZ - 0.03], [-backTilt, 0, 0]);
  markBody(f);

  const eyeR = 0.026;
  const faceCenter = new THREE.Vector3(0, backY + 0.01, backZ + 0.025 + 0.05 * 0.4 * 0.8);
  buildFace(body, { center: faceCenter.toArray(), tilt: backTilt, eyeR, spacing: eyeR * 4.2 });
  const arms = [
    buildArm(body, -1, { shoulder: [-S / 2 - 0.035, backY - 0.03, backZ + 0.03], color: "#C9BB9F", length: 0.15, r: 0.022, handR: 0.04, restAngle: 0.4 }),
    buildArm(body, 1, { shoulder: [S / 2 + 0.035, backY - 0.03, backZ + 0.03], color: "#C9BB9F", length: 0.15, r: 0.022, handR: 0.04, restAngle: 0.4 }),
  ];
  addAnchors(body, faceCenter, eyeR);
  return { root, arms };
}

function pouf() {
  const root = new THREE.Group();
  root.name = "Root";
  const body = new THREE.Group();
  body.name = "Body";
  root.add(body);
  const fabric = mat("Fabric_Moss", "#7E9466", { rough: 0.93, fabric: true });
  const wood = mat("Wood_Walnut", P.walnut, { rough: 0.55 });
  const btn = mat("Button_Moss", "#5F7350", { rough: 0.7 });
  const f = new THREE.Group();
  f.name = "Furniture";
  body.add(f);
  const R = 0.36, H = 0.36, y0 = 0.06;
  // Профиль вращения со скруглёнными краями и лёгкой «пухлостью» боков
  const pts = [];
  const rr = 0.07;
  pts.push(new THREE.Vector2(0.0001, 0));
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(R - rr + Math.cos(a) * rr, rr + Math.sin(a) * rr)); }
  for (let i = 1; i < 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(R + Math.sin(t * Math.PI) * 0.012, rr + t * (H - 2 * rr))); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(R - rr + Math.cos(a) * rr, H - rr + Math.sin(a) * rr)); }
  pts.push(new THREE.Vector2(0.0001, H + 0.02));
  const lathe = new THREE.LatheGeometry(pts, 64);
  add(f, lathe, fabric, [0, y0, 0], [0, 0, 0], "PoufBody", { stain: true });
  // Пуговицы утяжки на крышке
  const bg = new THREE.SphereGeometry(0.016, 10, 8);
  const topY = y0 + H + 0.012;
  const centerBtn = add(f, bg, btn, [0, topY + 0.008, 0]);
  centerBtn.scale.set(1, 0.5, 1);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const m = add(f, bg, btn, [Math.cos(a) * 0.17, topY - 0.002, Math.sin(a) * 0.17]);
    m.scale.set(1, 0.5, 1);
  }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
    taperedLeg(f, wood, Math.cos(a) * (R - 0.09), Math.sin(a) * (R - 0.09), y0 + 0.01, 0.022, 0.016);
  }
  markBody(f);
  const eyeR = 0.034;
  const faceY = y0 + H * 0.56;
  const sideR = R + 0.01;
  // Лицо на боковой поверхности: группа стоит на оси, черты огибают цилиндр
  buildFace(body, { center: [0, faceY, sideR], eyeR, spacing: eyeR * 4.3, curveR: sideR });
  const arms = [
    buildArm(body, -1, { shoulder: [-R - 0.05, y0 + H * 0.55, 0.04], color: "#73885C", length: 0.13, r: 0.026, handR: 0.045, restAngle: 0.55 }),
    buildArm(body, 1, { shoulder: [R + 0.05, y0 + H * 0.55, 0.04], color: "#73885C", length: 0.13, r: 0.026, handR: 0.045, restAngle: 0.55 }),
  ];
  addAnchors(body, new THREE.Vector3(0, faceY + 0.02, sideR), eyeR);
  return { root, arms };
}

// --- Сборка и экспорт ------------------------------------------------------------
const MODELS = {
  sofa2: () => sofaLike({ seats: 2, seatW: 0.64, color: "#6F8899" }),
  sofa3: () => sofaLike({ seats: 3, seatW: 0.62, color: "#6F8899" }),
  sofaCorner: () => sofaLike({ seats: 2, seatW: 0.62, color: "#6F8899", chaise: true }),
  armchair: () => sofaLike({ seats: 1, seatW: 0.56, depth: 0.86, color: "#C9A048", armW: 0.19 }),
  recliner: () => sofaLike({ seats: 1, seatW: 0.58, depth: 0.9, color: "#B7684B", armW: 0.22, recliner: true, backTilt: 0.26 }),
  mattressSingle: () => mattress({ width: 0.9 }),
  mattressDouble: () => mattress({ width: 1.6, height: 0.26 }),
  chair: () => chair(),
  pouf: () => pouf(),
};

const exporter = new GLTFExporter();
let allOk = true;
for (const [name, build] of Object.entries(MODELS)) {
  matCache.clear();
  const { root, arms } = build();
  // Центруем по X/Z, ставим на пол (y = 0)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => { if (o.isMesh && o.userData.part) box.expandByObject(o); });
  const center = box.getCenter(new THREE.Vector3());
  const furniture = root.getObjectByName("Body");
  furniture.children.forEach((c) => { c.position.x -= center.x; c.position.z -= center.z; });
  root.updateMatrixWorld(true);

  allOk = checkArms(name, root, arms) && allOk;
  const restR = arms.find((a) => a.userData.side > 0).rotation.z;
  const restL = arms.find((a) => a.userData.side < 0).rotation.z;
  const animations = clips(restR, restL, 0);

  const eyes = root.getObjectByName("Face");
  void eyes;
  const glb = await exporter.parseAsync(root, { binary: true, animations, onlyVisible: true });
  writeFileSync(`${OUT}${name}.glb`, Buffer.from(glb));
  console.log(`  → ${name}.glb ${(glb.byteLength / 1024).toFixed(0)} КБ`);
}
if (!allOk) {
  console.error("Есть пересечения рук с корпусом — поправьте параметры.");
  process.exitCode = 1;
}
