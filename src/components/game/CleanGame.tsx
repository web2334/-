"use client";
// Мини-игра «Почисти мебель». Пятна нарисованы в CanvasTexture поверх поверхностей с
// userData.stain. У слоя пятен свой UV-атлас (3×2 ячейки по направлению нормали), поэтому
// каждая точка поверхности имеет уникальное место в маске. Стираем по UV из raycast.
// Слой пятен — дочерний меш с той же геометрией: вращается вместе с предметом и
// закрывается его геометрией через обычный depth test.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CategoryId, ModelId } from "@/lib/catalog";
import type { PublicSettings } from "@/lib/settings-schema";
import { rub } from "@/lib/pricing";
import { humanDate } from "@/lib/format";
import { useReducedMotion } from "../Stage";
import { IconRotate, IconSparkle } from "../Icons";

const TEX = 512;
const MODEL_BY_CATEGORY: Record<CategoryId, ModelId> = {
  sofa: "sofa3",
  armchair: "armchair",
  mattress: "mattressDouble",
  chair: "chair",
  other: "pouf",
};

type Bonus = { code: string; amount: number; minOrder: number; expiresAt: string };

// --- UV-атлас для слоя пятен -------------------------------------------------------
function atlasGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  g.deleteAttribute("uv");
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), cb = new THREE.Vector3();
  const pad = 0.04;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = cb.subVectors(c, b).cross(ab.subVectors(a, b));
    // нормаль в «мировых» пропорциях (учёт масштаба квантизации не нужен — он равномерный по граням)
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let cell: number;
    if (ax >= ay && ax >= az) cell = n.x > 0 ? 0 : 1;
    else if (ay >= az) cell = n.y > 0 ? 2 : 3;
    else cell = n.z > 0 ? 4 : 5;
    const col = cell % 3, row = Math.floor(cell / 3);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k];
      const nx = (p.x - bb.min.x) / (size.x || 1);
      const ny = (p.y - bb.min.y) / (size.y || 1);
      const nz = (p.z - bb.min.z) / (size.z || 1);
      const [s, t] = cell < 2 ? [nz, ny] : cell < 4 ? [nx, nz] : [nx, ny];
      uv[(i + k) * 2] = (col + pad + s * (1 - 2 * pad)) / 3;
      uv[(i + k) * 2 + 1] = (row + pad + t * (1 - 2 * pad)) / 2;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Пятна рисуем в ячейках «верх» (+Y) и «перед» (+Z) — то, что видно и до чего удобно дотянуться. */
function paintStains(ctx: CanvasRenderingContext2D, rnd: () => number, count: number) {
  ctx.clearRect(0, 0, TEX, TEX);
  const cells = [2, 4];
  const colors = ["rgba(120,82,48,0.78)", "rgba(92,70,52,0.72)", "rgba(140,110,60,0.7)", "rgba(80,90,70,0.6)"];
  for (let i = 0; i < count; i++) {
    const cell = cells[i % cells.length];
    const col = cell % 3, row = Math.floor(cell / 3);
    const s = 0.2 + rnd() * 0.6;
    const t = 0.25 + rnd() * 0.5;
    const cx = ((col + s) / 3) * TEX;
    const cy = (1 - (row + t) / 2) * TEX; // flipY
    const r = 12 + rnd() * 16;
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      ctx.ellipse(cx + (rnd() - 0.5) * r * 1.4, cy + (rnd() - 0.5) * r, r * (0.45 + rnd() * 0.5), r * (0.35 + rnd() * 0.45), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function countAlpha(ctx: CanvasRenderingContext2D): number {
  const d = ctx.getImageData(0, 0, TEX, TEX).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++;
  return n;
}

interface Layer {
  overlay: THREE.Mesh;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  initial: number;
}

function GameModel({
  model,
  mode,
  onProgress,
  celebrate,
  reduced,
}: {
  model: ModelId;
  mode: "clean" | "rotate";
  onProgress: (p: number) => void;
  celebrate: number;
  reduced: boolean;
}) {
  const gltf = useGLTF(`/models/${model}.glb`, false, true);
  const root = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  const painting = useRef(false);
  const lastCount = useRef(0);

  const { scene, layers, fit } = useMemo(() => {
    const s = gltf.scene.clone(true);
    const layers: Layer[] = [];
    const rnd = seeded(model.length * 977 + 13);
    const stainMeshes: THREE.Mesh[] = [];
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        if (m.userData.stain) stainMeshes.push(m);
      }
    });
    for (const m of stainMeshes) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = TEX;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      paintStains(ctx, rnd, stainMeshes.length > 3 ? 3 : 5);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const overlay = new THREE.Mesh(atlasGeometry(m.geometry), mat);
      overlay.name = `${m.name}_stains`;
      overlay.userData.isStain = true;
      overlay.renderOrder = 2;
      m.add(overlay);
      m.userData.overlay = overlay;
      layers.push({ overlay, ctx, tex, initial: countAlpha(ctx) });
    }
    const furn = s.getObjectByName("Furniture") ?? s;
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(furn);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 2.05 / Math.max(size.x, size.z * 0.95, size.y * 1.85);
    s.scale.setScalar(k);
    s.position.set(-center.x * k, -box.min.y * k, -center.z * k);
    return { scene: s, layers, fit: { h: size.y * k, r: 0.5 * Math.hypot(size.x * k, size.y * k + 0.3, size.z * k) } };
  }, [gltf.scene, model]);

  const { actions } = useAnimations(gltf.animations, root);
  useEffect(() => {
    if (!celebrate || reduced) return;
    const a = actions.Hop;
    if (a) {
      a.reset().setLoop(THREE.LoopOnce, 1).play();
      const t0 = performance.now();
      const tick = () => {
        invalidate();
        if (performance.now() - t0 < 900) requestAnimationFrame(tick);
      };
      tick();
    }
  }, [celebrate, actions, reduced, invalidate]);

  // Камера под габариты
  const { camera } = useThree();
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const dist = fit.r / Math.sin(THREE.MathUtils.degToRad(persp.fov / 2) * Math.min(1, persp.aspect)) * 0.84;
    camera.position.set(0.3, 0.55, 1).normalize().multiplyScalar(dist).add(new THREE.Vector3(0, fit.h * 0.45, 0));
    camera.lookAt(0, fit.h * 0.45, 0);
    invalidate();
  }, [fit, camera, invalidate]);

  useEffect(() => () => layers.forEach((l) => { l.tex.dispose(); (l.overlay.material as THREE.Material).dispose(); l.overlay.geometry.dispose(); }), [layers]);

  const measure = useCallback(() => {
    const total = layers.reduce((s, l) => s + l.initial, 0) || 1;
    const left = layers.reduce((s, l) => s + countAlpha(l.ctx), 0);
    onProgress(Math.min(1, 1 - left / total));
  }, [layers, onProgress]);

  const ray = useMemo(() => new THREE.Raycaster(), []);
  const scrub = (e: ThreeEvent<PointerEvent>) => {
    // первая настоящая поверхность под пальцем (слои пятен совпадают с ней)
    const hit = e.intersections.find((i) => (i.object as THREE.Mesh).isMesh && i.object.visible);
    if (!hit) return;
    const obj = hit.object as THREE.Mesh;
    const overlay = (obj.userData.isStain ? obj : obj.userData.overlay) as THREE.Mesh | undefined;
    if (!overlay) return;
    ray.set(e.ray.origin, e.ray.direction);
    const h = ray.intersectObject(overlay, false)[0];
    if (!h?.uv) return;
    const layer = layers.find((l) => l.overlay === overlay);
    if (!layer) return;
    const x = h.uv.x * TEX;
    const y = (1 - h.uv.y) * TEX;
    const ctx = layer.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const grd = ctx.createRadialGradient(x, y, 0, x, y, 26);
    grd.addColorStop(0, "rgba(0,0,0,1)");
    grd.addColorStop(0.6, "rgba(0,0,0,0.9)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    layer.tex.needsUpdate = true;
    invalidate();
    const now = performance.now();
    if (now - lastCount.current > 250) {
      lastCount.current = now;
      measure();
    }
  };

  useEffect(() => {
    const up = () => {
      if (painting.current) measure();
      painting.current = false;
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [measure]);

  return (
    <group
      ref={root}
      onPointerDown={(e) => {
        if (mode !== "clean") return;
        e.stopPropagation();
        painting.current = true;
        scrub(e);
      }}
      onPointerMove={(e) => {
        if (mode === "clean" && painting.current) scrub(e);
      }}
    >
      <primitive object={scene} />
    </group>
  );
}

function CanvasTouch({ mode }: { mode: "clean" | "rotate" }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.style.touchAction = mode === "clean" ? "none" : "pan-y";
    gl.domElement.style.cursor = mode === "clean" ? "crosshair" : "grab";
  }, [mode, gl]);
  return null;
}

export default function CleanGame({
  token,
  category,
  game,
  existingBonus,
  onBonus,
}: {
  token: string;
  category: CategoryId;
  game: PublicSettings["game"];
  existingBonus: Bonus | null;
  onBonus: (b: Bonus) => void;
}) {
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<"clean" | "rotate">("clean");
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [claim, setClaim] = useState<{ state: "idle" | "loading" | "error"; error?: string }>({ state: "idle" });
  const [bonus, setBonus] = useState<Bonus | null>(existingBonus);
  const [glOk, setGlOk] = useState(true);
  const reduced = useReducedMotion();
  const model = MODEL_BY_CATEGORY[category];

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setGlOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setGlOk(false);
    }
  }, []);

  const claimBonus = useCallback(async () => {
    setClaim({ state: "loading" });
    try {
      const r = await fetch(`/api/orders/${token}/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: 1 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Не удалось получить код");
      setBonus(data);
      onBonus(data);
      setClaim({ state: "idle" });
    } catch (e) {
      setClaim({ state: "error", error: (e as Error).message || "Нет связи" });
    }
  }, [token, onBonus]);

  const onProgress = useCallback(
    (p: number) => {
      setProgress(p);
      if (p >= 0.9 && !done) {
        setDone(true);
        setCelebrate(Date.now());
        if (game.mode === "bonus" && !bonus) void claimBonus();
      }
    },
    [done, game.mode, bonus, claimBonus],
  );

  if (!glOk) return null;

  return (
    <section className="card card-pad stack" aria-labelledby="game-title" style={{ ["--gap" as string]: "14px" }}>
      <div className="row" style={{ ["--gap" as string]: "10px" }}>
        <span className="line-ico">
          <IconSparkle size={24} />
        </span>
        <div className="grow">
          <h2 id="game-title" style={{ fontSize: 20 }}>
            Пока ждёте звонка — почистите сами
          </h2>
          <p className="small muted">
            {game.mode === "bonus"
              ? `Сотрите пятна и получите бонус ${rub(game.bonusAmount)} на следующий заказ от ${rub(game.bonusMinOrder)}.`
              : "Короткая игра для настроения — без скидок."}
          </p>
        </div>
      </div>

      {!started ? (
        <button className="btn btn-outline" onClick={() => setStarted(true)}>
          Играть
        </button>
      ) : (
        <>
          <div className="segment" role="radiogroup" aria-label="Режим">
            <button role="radio" aria-checked={mode === "clean"} onClick={() => setMode("clean")}>
              <IconSparkle size={18} /> Чистить
            </button>
            <button role="radio" aria-checked={mode === "rotate"} onClick={() => setMode("rotate")}>
              <IconRotate size={18} /> Вращать
            </button>
          </div>
          <div className="stage" style={{ aspectRatio: "1 / 0.85" }}>
            <Canvas
              shadows
              dpr={[1, 1.75]}
              frameloop="demand"
              camera={{ fov: 32, position: [1, 1.5, 4] }}
              gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
            >
              <hemisphereLight args={["#fff8ee", "#d4c9b8", 1.1]} />
              <directionalLight position={[2.5, 5, 3]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
              <mesh rotation-x={-Math.PI / 2} receiveShadow>
                <circleGeometry args={[4, 40]} />
                <shadowMaterial transparent opacity={0.18} />
              </mesh>
              <Suspense fallback={null}>
                <GameModel model={model} mode={mode} onProgress={onProgress} celebrate={celebrate} reduced={reduced} />
              </Suspense>
              <OrbitControls makeDefault enablePan={false} enableZoom={false} enableRotate={mode === "rotate"} enableDamping minPolarAngle={0.2 * Math.PI} maxPolarAngle={0.47 * Math.PI} />
              <CanvasTouch mode={mode} />
            </Canvas>
            <div className="stage-hint">{mode === "clean" ? "Водите пальцем по пятнам" : "Поверните, чтобы найти пятна"}</div>
          </div>
          <div className="stack" style={{ ["--gap" as string]: "6px" }}>
            <div className="row between small">
              <span className="muted">Чистота</span>
              <strong className="num">{Math.round(progress * 100)}%</strong>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: "var(--accent)", transition: "width .25s" }} />
            </div>
          </div>
          {done && (
            <div className="notice notice-ok" role="status">
              {game.mode !== "bonus" ? (
                "Сияет! Спасибо, что помогли. Настоящую чистку оставьте нам."
              ) : bonus ? (
                <span>
                  Бонус-код: <strong style={{ letterSpacing: "0.04em" }}>{bonus.code}</strong> — {rub(bonus.amount)} на следующий заказ от {rub(bonus.minOrder)}, до {humanDate(bonus.expiresAt)}.
                  Назовите код мастеру при следующей заявке: бонус применяется вручную после проверки. На текущий заказ не действует.
                </span>
              ) : claim.state === "loading" ? (
                "Получаем код…"
              ) : claim.state === "error" ? (
                <span>
                  {claim.error}.{" "}
                  <button className="btn btn-sm btn-outline" onClick={claimBonus}>
                    Повторить
                  </button>
                </span>
              ) : null}
            </div>
          )}
        </>
      )}
      {!started && bonus && game.mode === "bonus" && (
        <p className="small muted">
          Ваш код уже получен: <strong>{bonus.code}</strong> (один код на заявку).
        </p>
      )}
    </section>
  );
}
