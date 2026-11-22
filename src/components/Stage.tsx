"use client";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useGLTF } from "@react-three/drei";
import type { CategoryId, ModelId } from "@/lib/catalog";
import { CategoryIcon, IconReset, IconRotate, IconRefresh } from "./Icons";
import type { Pulse } from "./three/Stage3D";

const Stage3D = dynamic(() => import("./three/Stage3D"), { ssr: false, loading: () => null });

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

export function useDarkTheme(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const calc = () => {
      const t = document.documentElement.dataset.theme;
      setDark(t ? t === "dark" : m.matches);
    };
    calc();
    m.addEventListener("change", calc);
    const obs = new MutationObserver(calc);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      m.removeEventListener("change", calc);
      obs.disconnect();
    };
  }, []);
  return dark;
}

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Статичный постер, если WebGL недоступен: заказ при этом полностью работает. */
export function Poster({ category, note }: { category: CategoryId; note: string }) {
  return (
    <div className="stage-overlay">
      <div className="stack" style={{ alignItems: "center", ["--gap" as string]: "14px" }}>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 36,
            display: "grid",
            placeItems: "center",
            background: "var(--accent-soft)",
            color: "var(--accent-text)",
          }}
        >
          <CategoryIcon id={category} size={76} />
        </div>
        <p className="muted small" style={{ maxWidth: 280 }}>
          {note}
        </p>
      </div>
    </div>
  );
}

export interface StageProps {
  category: CategoryId;
  model: ModelId;
  labels: string[];
  faces: boolean;
  line: { text: string; id: number } | null;
  pulse: Pulse | null;
}

export function Stage({ category, model, labels, faces, line, pulse }: StageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [support, setSupport] = useState<"unknown" | "yes" | "no">("unknown");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [resetSignal, setReset] = useState(0);
  const [active, setActive] = useState(true);
  const [interacted, setInteracted] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const dark = useDarkTheme();

  // ?3d=off — показать постер (как без WebGL), ?3d=fail — сымитировать ошибку загрузки модели.
  const [debugFail, setDebugFail] = useState(false);
  useEffect(() => {
    const flag = new URLSearchParams(location.search).get("3d");
    setDebugFail(flag === "fail");
    setSupport(flag === "off" ? "no" : hasWebGL() ? "yes" : "no");
  }, []);

  // Не рендерим 3D, пока сцена вне экрана
  useEffect(() => {
    const el = wrap.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Реплика показывается на ~4 секунды
  useEffect(() => {
    if (!line || !loaded) return;
    setBubbleText(line.text);
    const t = setTimeout(() => setBubbleText(null), Math.max(3200, line.text.length * 70));
    return () => clearTimeout(t);
  }, [line, loaded]);

  // Скрываем пузырь сразу (при frameloop="demand" кадр может не перерисоваться)
  useEffect(() => {
    if (!bubbleText && bubble.current) bubble.current.style.opacity = "0";
  }, [bubbleText]);

  const onReady = useCallback(() => setLoaded(true), []);
  const onInteract = useCallback(() => setInteracted(true), []);
  const retry = () => {
    useGLTF.clear(`/models/${model}.glb`);
    setFailed(false);
    setLoaded(false);
    setAttempt((a) => a + 1);
  };

  return (
    <div className="stage" ref={wrap} data-talking={!!bubbleText && faces}>
      {support === "yes" && !failed && (
        <Boundary key={attempt} onError={() => setFailed(true)}>
          <Stage3D
            model={model}
            debugFail={debugFail && attempt === 0}
            faces={faces}
            pulse={pulse}
            reducedMotion={reduced}
            dark={dark}
            bubbleRef={bubble}
            bubbleVisible={!!bubbleText && faces}
            resetSignal={resetSignal}
            active={active}
            onReady={onReady}
            onInteract={onInteract}
          />
        </Boundary>
      )}

      {support === "no" && <Poster category={category} note="3D недоступно в этом браузере — выбор и заявка работают как обычно." />}

      {failed && (
        <div className="stage-overlay">
          <div className="stack" style={{ alignItems: "center" }}>
            <CategoryIcon id={category} size={64} className="faint" />
            <p className="small muted">Не удалось загрузить 3D-модель. Заказ можно оформить и без неё.</p>
            <button className="btn btn-outline btn-sm" onClick={retry}>
              <IconRefresh size={18} /> Повторить
            </button>
          </div>
        </div>
      )}

      {support === "yes" && !failed && !loaded && (
        <div className="stage-overlay" aria-live="polite">
          <div className="stack" style={{ alignItems: "center" }}>
            <div className="spinner" />
            <p className="small muted">Готовим мебель…</p>
          </div>
        </div>
      )}

      {labels.length > 0 && (
        <div className="stage-label">
          {labels.map((l) => (
            <span key={l} className="badge glass">
              {l}
            </span>
          ))}
        </div>
      )}

      <div ref={bubble} className="bubble" style={{ opacity: 0 }} aria-hidden={!bubbleText}>
        {bubbleText}
      </div>
      {bubbleText && (
        <span className="sr-only" role="status">
          {bubbleText}
        </span>
      )}

      {support === "yes" && loaded && !failed && (
        <>
          {!interacted && (
            <div className="stage-hint">
              <IconRotate size={18} /> Поверните пальцем или мышью
            </div>
          )}
          <div className="stage-tools">
            <button className="btn btn-sm icon-btn glass" onClick={() => setReset((n) => n + 1)} aria-label="Вернуть исходный ракурс" title="Сбросить ракурс">
              <IconReset size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
