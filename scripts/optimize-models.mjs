// Оптимизация GLB: дедупликация, сварка вершин, квантизация, сжатие meshopt
// и общая нормал-карта плетения ткани (PNG 128×128). Анимации и extras сохраняются.
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRTextureTransform } from "@gltf-transform/extensions";
import { dedup, prune, weld, quantize, meshopt, resample } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { readdirSync, statSync, mkdirSync } from "node:fs";

const SRC = fileURLToPath(new URL("../models-src/", import.meta.url));
const OUT = fileURLToPath(new URL("../public/models/", import.meta.url));
mkdirSync(OUT, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

// Нормал-карта полотняного переплетения, бесшовная
async function weaveNormal(size = 128) {
  const h = new Float32Array(size * size);
  const threads = 8;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * threads, v = (y / size) * threads;
      const cu = Math.floor(u), cv = Math.floor(v);
      const fu = u - cu, fv = v - cv;
      const over = (cu + cv) % 2 === 0;
      const warp = Math.sin(fu * Math.PI) * (over ? 1 : 0.55);
      const weft = Math.sin(fv * Math.PI) * (over ? 0.55 : 1);
      const fuzz = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      h[y * size + x] = Math.max(warp, weft) + (fuzz - Math.floor(fuzz)) * 0.015;
    }
  const px = Buffer.alloc(size * size * 3);
  const s = 1.6;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const d = h[((y - 1 + size) % size) * size + x], u = h[((y + 1) % size) * size + x];
      let nx = (l - r) * s, ny = (d - u) * s, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 3;
      px[i] = Math.round((nx * 0.5 + 0.5) * 255);
      px[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      px[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  return sharp(px, { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
}

const normalPng = await weaveNormal();
let total = 0;
for (const f of readdirSync(SRC).filter((n) => n.endsWith(".glb"))) {
  const doc = await io.read(SRC + f);
  const root = doc.getRoot();

  // ткань → нормал-карта (одна текстура на файл)
  const tex = doc.createTexture("FabricWeave").setImage(normalPng).setMimeType("image/png");
  for (const m of root.listMaterials()) {
    if (m.getName().startsWith("Fabric")) {
      m.setNormalTexture(tex);
      m.getNormalTextureInfo().setWrapS(10497).setWrapT(10497);
      m.setNormalScale(0.55);
      // UV = (метры + 2) / 4, значит масштаб 96 при 8 нитях в тайле даёт плотное плетение
      const tt = doc.createExtension(KHRTextureTransform).createTransform().setScale([96, 96]);
      m.getNormalTextureInfo().setExtension("KHR_texture_transform", tt);
    }
  }

  await doc.transform(
    dedup(),
    weld(),
    resample(),
    prune({ keepExtras: true, keepLeaves: true }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  void EXTMeshoptCompression;
  await io.write(OUT + f, doc);
  const kb = statSync(OUT + f).size / 1024;
  total += kb;
  console.log(`  ${f}: ${kb.toFixed(0)} КБ`);
}
console.log(`Итого: ${total.toFixed(0)} КБ`);
