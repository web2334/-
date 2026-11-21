"use client";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ALL_MODELS, type ModelId } from "@/lib/catalog";

export const modelUrl = (id: ModelId) => `/models/${id}.glb`;
let failOnce = false;

export interface Pulse {
  kind: "Hop" | "Wave";
  id: number;
}

export interface Stage3DProps {
  model: ModelId;
  faces: boolean;
  pulse: Pulse | null;
  reducedMotion: boolean;
  dark: boolean;
  bubbleRef: RefObject<HTMLDivElement | null>;
  bubbleVisible: boolean;
  resetSignal: number;
  active: boolean;
  onReady: () => void;
  onInteract: () => void;
  debugFail?: boolean;
}

export interface Fit {
  w: number;
  h: number;
  d: number;
}

interface Anchors {
  speech: THREE.Object3D | null;
  eye: THREE.Object3D | null;
  face: THREE.Object3D | null;
}


// ---------------------------------------------------------------------------------
function FurnitureModel({
  id,
  faces,
  pulse,
  greet,
  reducedMotion,
  anchors,
  onReady,
}: {
  id: ModelId;
  faces: boolean;
  pulse: Pulse | null;
  greet: boolean;
  reducedMotion: boolean;
  anchors: RefObject<Anchors>;
  onReady: (id: ModelId, fit: Fit) => void;
}) {
  const gltf = useGLTF(failOnce ? `/models/__missing__.glb` : modelUrl(id), false, true);
  const root = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);

  const { scene, fit } = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    // Нормализуем масштаб: самая длинная сторона ≈ 2 единицы, предмет стоит на полу.
    const furn = s.getObjectByName("Furniture") ?? s;
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(furn);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 2.05 / Math.max(size.x, size.z * 0.95, size.y * 1.85);
    s.scale.setScalar(k);
    s.position.set(-center.x * k, -box.min.y * k, -center.z * k);
    const fit: Fit = { w: size.x * k, h: size.y * k, d: size.z * k };
    return { scene: s, fit };
  }, [gltf.scene]);

  const { actions, mixer } = useAnimations(gltf.animations, root);

  // Лица и руки можно отключить в настройках персонажей.
  useEffect(() => {
    for (const n of ["Face", "Arm_L", "Arm_R"]) {
      const o = scene.getObjectByName(n);
      if (o) o.visible = faces;
    }
    invalidate();
  }, [faces, scene, invalidate]);

  useLayoutEffect(() => {
    anchors.current = {
      speech: scene.getObjectByName("SpeechAnchor") ?? null,
      eye: scene.getObjectByName("EyeAnchor") ?? null,
      face: scene.getObjectByName("Face") ?? null,
    };
    onReady(id, fit);
  }, [scene, fit, id, anchors, onReady]);

  const play = useCallback(
    (name: string) => {
      const a = actions[name];
      if (!a) return;
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = false;
      a.play();
      invalidate();
    },
    [actions, invalidate],
  );

  // Приветственный взмах при появлении
  useEffect(() => {
    if (!greet || reducedMotion || !faces) return;
    const t = setTimeout(() => play("Wave"), 380);
    return () => clearTimeout(t);
  }, [greet, reducedMotion, faces, play]);

  // Подскок / взмах по сигналу родителя (добавили в заявку)
  const lastPulse = useRef<number>(pulse?.id ?? 0);
  useEffect(() => {
    if (!pulse || pulse.id === lastPulse.current) return;
    lastPulse.current = pulse.id;
    if (reducedMotion) return;
    if (pulse.kind === "Wave" && !faces) return;
    play(pulse.kind);
  }, [pulse, reducedMotion, faces, play]);

  // Редкое моргание: раз в 3,5–8 с, только когда вкладка видима
  useEffect(() => {
    if (!faces || reducedMotion) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(
        () => {
          if (document.visibilityState === "visible") play("Blink");
          loop();
        },
        3500 + Math.random() * 4500,
      );
    };
    loop();
    return () => clearTimeout(t);
  }, [faces, reducedMotion, play]);

  // При frameloop="demand" рисуем кадры только пока идёт анимация.
  useFrame(() => {
    if (mixer && Object.values(actions).some((a) => a?.isRunning())) invalidate();
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  );
}

// ---------------------------------------------------------------------------------
/** Мягкая смена предметов: старый уменьшается, новый «выпрыгивает». Быстрые переключения сходятся к последнему. */
function Switcher(
  props: Omit<Stage3DProps, "bubbleRef" | "bubbleVisible" | "resetSignal" | "active" | "onInteract" | "dark"> & {
    anchors: RefObject<Anchors>;
    onFit: (f: Fit) => void;
  },
) {
  const { model, reducedMotion, onReady } = props;
  const group = useRef<THREE.Group>(null);
  const [shown, setShown] = useState<ModelId>(model);
  const [readyId, setReadyId] = useState<ModelId | null>(null);
  const firstRef = useRef(true);
  const target = useRef(model);
  const phase = useRef<"out" | "wait" | "in" | "idle">("wait");
  const t = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    target.current = model;
    if (model === shown) {
      if (phase.current === "out") phase.current = "in";
    } else if (reducedMotion) {
      setShown(model);
      phase.current = "wait";
    } else {
      phase.current = "out";
    }
    invalidate();
  }, [model, shown, reducedMotion, invalidate]);

  const { onFit } = props;
  const handleReady = useCallback(
    (id: ModelId, fit: Fit) => {
      setReadyId(id);
      onFit(fit);
      if (phase.current === "wait") {
        phase.current = reducedMotion ? "idle" : "in";
        if (reducedMotion) t.current = 1;
      }
      if (firstRef.current) {
        firstRef.current = false;
        onReady();
      }
      invalidate();
    },
    [onReady, onFit, reducedMotion, invalidate],
  );

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(dt, 1 / 30);
    if (phase.current === "out") {
      t.current = Math.max(0, t.current - d * 6);
      if (t.current === 0) {
        phase.current = "wait";
        if (target.current !== shown) setShown(target.current);
        else phase.current = "in";
      }
      invalidate();
    } else if (phase.current === "in") {
      t.current = Math.min(1, t.current + d * 3.2);
      if (t.current === 1) phase.current = "idle";
      invalidate();
    }
    const x = t.current;
    // easeOutBack при появлении, плавное сжатие при уходе
    const c1 = 1.5;
    const s = phase.current === "out" ? x * x : 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    const sc = Math.max(0.0001, reducedMotion ? 1 : s);
    g.scale.setScalar(sc);
    g.rotation.y = reducedMotion ? 0 : (1 - x) * 0.6;
    g.visible = readyId === shown;
  });

  return (
    <group ref={group} scale={0.0001}>
      <Suspense fallback={null}>
        <FurnitureModel
          key={shown}
          id={shown}
          faces={props.faces}
          pulse={props.pulse}
          greet
          reducedMotion={reducedMotion}
          anchors={props.anchors}
          onReady={handleReady}
        />
      </Suspense>
    </group>
  );
}

// ---------------------------------------------------------------------------------
/** Реплика привязана к проекции точки над лицом; не закрывает глаза и элементы управления. */
function BubbleTracker({ anchors, bubbleRef, visible }: { anchors: RefObject<Anchors>; bubbleRef: RefObject<HTMLDivElement | null>; visible: boolean }) {
  const { camera, size, invalidate } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Vector3(), []);
  const n = useMemo(() => new THREE.Vector3(), []);
  const last = useRef("");

  useEffect(() => {
    if (visible) invalidate();
  }, [visible, invalidate]);

  useFrame(() => {
    const el = bubbleRef.current;
    const a = anchors.current;
    if (!el || !a?.speech || !a.eye) return;
    if (!visible) {
      el.style.opacity = "0";
      return;
    }
    const W = size.width;
    const H = size.height;
    a.speech.getWorldPosition(v);
    a.eye.getWorldPosition(e);
    // лицо смотрит на камеру?
    a.face?.getWorldDirection(n);
    const toCam = camera.position.clone().sub(e).normalize();
    const facing = a.face ? n.dot(toCam) : 1;
    v.project(camera);
    const sx = ((v.x + 1) / 2) * W;
    const sy = ((1 - v.y) / 2) * H;
    e.project(camera);
    const ex = ((e.x + 1) / 2) * W;
    const ey = ((1 - e.y) / 2) * H;

    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    const margin = 10;
    // Метки предмета на время реплики скрываются (см. .stage[data-talking]), поэтому верх свободен.
    const labelRight = 0;
    const labelBottom = margin;
    const bottomReserved = 66; // кнопка сброса и подсказка снизу
    const eyeClear = Math.max(20, H * 0.065);
    const topLimit = (x: number) => (x < labelRight ? labelBottom : margin);

    let x = Math.min(Math.max(sx - bw / 2, margin), W - bw - margin);
    let y = Math.min(sy, ey - eyeClear) - bh - 10;
    let below = false;
    if (y < topLimit(x)) {
      // Пробуем сдвинуть вправо от метки
      const xr = Math.max(x, labelRight);
      if (xr + bw <= W - margin && y >= margin) x = xr;
      else {
        // Сбоку от лица на уровне глаз — со стороны, где больше места
        const right = ex < W / 2;
        const side = right ? ex + eyeClear * 2.6 : ex - eyeClear * 2.6 - bw;
        if (side >= margin && side + bw <= W - margin) {
          x = side;
          y = Math.max(topLimit(side), ey - bh - eyeClear * 0.4);
        } else {
          // Крайний случай: прижимаем к верху, но не ниже линии глаз
          y = Math.max(margin, Math.min(topLimit(x), ey - eyeClear - bh));
          if (y + bh > ey - eyeClear * 0.5) {
            y = ey + eyeClear * 1.6;
            below = true;
          }
        }
      }
    }
    y = Math.min(y, H - bottomReserved - bh);
    const tail = Math.min(Math.max(sx - x, 18), bw - 18);
    const opacity = facing > 0.2 ? "1" : "0";
    const key = `${x | 0},${y | 0},${tail | 0},${opacity},${below}`;
    if (key === last.current) return;
    last.current = key;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.setProperty("--tail-x", `${tail}px`);
    el.dataset.below = String(below);
    el.style.opacity = opacity;
  });
  return null;
}

// ---------------------------------------------------------------------------------
function Rig({ resetSignal, onInteract, fit, reducedMotion }: { resetSignal: number; onInteract: () => void; fit: Fit | null; reducedMotion: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, gl, invalidate } = useThree();
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number } | null>(null);
  const first = useRef(true);

  // Камера подстраивается под габариты модели и пропорции сцены: предмет целиком в кадре,
  // над ним остаётся место для реплики.
  useEffect(() => {
    const f = fit ?? { w: 2, h: 1, d: 1 };
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const target = new THREE.Vector3(0, f.h * 0.5 + 0.08, 0);
    const radius = 0.5 * Math.hypot(f.w, f.h + 0.35, f.d);
    const vHalf = THREE.MathUtils.degToRad(persp.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 0.98;
    const dir = new THREE.Vector3(0.28, 0.4, 1).normalize();
    const pos = target.clone().addScaledVector(dir, dist);
    const c = controls.current;
    if (c) {
      c.minDistance = dist * 0.72;
      c.maxDistance = dist * 1.4;
    }
    if (first.current || reducedMotion || !c) {
      first.current = false;
      camera.position.copy(pos);
      c?.target.copy(target);
      c?.update();
      c?.saveState();
    } else {
      anim.current = { from: camera.position.clone(), to: pos, tFrom: c.target.clone(), tTo: target, t: 0 };
    }
    invalidate();
  }, [fit, size.width, size.height, camera, invalidate, reducedMotion]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt * 2.6);
    const e = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.from, a.to, e);
    c.target.lerpVectors(a.tFrom, a.tTo, e);
    c.update();
    if (a.t >= 1) {
      anim.current = null;
      c.saveState();
    }
    invalidate();
  });

  useEffect(() => {
    if (!resetSignal) return;
    anim.current = null;
    controls.current?.reset();
    invalidate();
  }, [resetSignal, invalidate]);

  // Разрешаем вертикальную прокрутку страницы пальцем поверх сцены.
  useEffect(() => {
    gl.domElement.style.touchAction = "pan-y";
  }, [gl]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.8}
      zoomSpeed={0.6}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.47}
      onStart={() => {
        anim.current = null;
        onInteract();
      }}
    />
  );
}

function Lights({ dark }: { dark: boolean }) {
  return (
    <>
      <hemisphereLight args={["#fff8ee", dark ? "#3a3a36" : "#d9cfbf", dark ? 0.75 : 0.9]} />
      <directionalLight
        position={[2.6, 5.2, 3.2]}
        intensity={dark ? 1.9 : 2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
      />
      <directionalLight position={[-3, 2.5, -2]} intensity={0.45} color="#dfe8ff" />
      {/* Пол: только тень, сцена остаётся прозрачной поверх фона карточки */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, 0]}>
        <circleGeometry args={[4, 48]} />
        <shadowMaterial transparent opacity={dark ? 0.42 : 0.17} />
      </mesh>
      {/* Окружение из локальных источников света — без загрузки HDR из сети */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[6, 3, 1]} color="#fff6ea" />
        <Lightformer form="rect" intensity={1.2} position={[-4, 1.5, 1]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} color="#e7efff" />
        <Lightformer form="rect" intensity={0.9} position={[4, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} color="#ffe9d6" />
      </Environment>
    </>
  );
}

/** Фоновая подгрузка остальных моделей после появления первой. */
function Preloader({ start }: { start: boolean }) {
  useEffect(() => {
    if (!start) return;
    const run = () => ALL_MODELS.forEach((m) => useGLTF.preload(modelUrl(m), false, true));
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 800);
  }, [start]);
  return null;
}

export default function Stage3D(props: Stage3DProps) {
  failOnce = !!props.debugFail;
  const anchors = useRef<Anchors>({ speech: null, eye: null, face: null });
  const [ready, setReady] = useState(false);
  const [fit, setFit] = useState<Fit | null>(null);
  const { onReady } = props;
  const handleReady = useCallback(() => {
    setReady(true);
    onReady();
  }, [onReady]);

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      frameloop={props.active ? "demand" : "never"}
      camera={{ fov: 30, near: 0.1, far: 50, position: [1.6, 2, 4.2] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping }}
      aria-label="3D-модель мебели. Перетащите, чтобы повернуть."
      role="img"
    >
      <Lights dark={props.dark} />
      <Switcher
        model={props.model}
        faces={props.faces}
        pulse={props.pulse}
        reducedMotion={props.reducedMotion}
        onReady={handleReady}
        onFit={setFit}
        anchors={anchors}
      />
      <BubbleTracker anchors={anchors} bubbleRef={props.bubbleRef} visible={props.bubbleVisible && ready} />
      <Rig resetSignal={props.resetSignal} onInteract={props.onInteract} fit={fit} reducedMotion={props.reducedMotion} />
      <Preloader start={ready} />
    </Canvas>
  );
}
