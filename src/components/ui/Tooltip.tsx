"use client";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";

export function Tooltip({ children, content, align = "center" }: {
  children: React.ReactNode;
  content: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const W = 236;
    let x = r.left + r.width / 2 - W / 2;
    if (align === "right") x = r.right - W;
    if (align === "left")  x = r.left;
    x = Math.max(8, Math.min(x, window.innerWidth - W - 8));
    setPos({ x, y: r.top });
  }

  function hide() { setPos(null); }

  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={hide}
        className="underline decoration-dotted decoration-1 cursor-default underline-offset-2"
        style={{ textDecorationColor: "var(--text-muted)" }}>
        {children}
      </span>
      {pos && typeof document !== "undefined" && createPortal(
        <div className="pointer-events-none rounded-2xl shadow-2xl"
          style={{
            position: "fixed", left: pos.x, top: pos.y,
            transform: "translateY(calc(-100% - 10px))",
            width: 236, zIndex: 9999,
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          }}>
          {content}
          <div style={{
            position: "absolute", top: "100%", marginTop: -1,
            ...(align === "right" ? { right: 16 } : align === "left" ? { left: 16 } : { left: "50%", transform: "translateX(-50%)" }),
            width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid var(--border)",
          }} />
          <div style={{
            position: "absolute", top: "100%", marginTop: 0,
            ...(align === "right" ? { right: 17 } : align === "left" ? { left: 17 } : { left: "50%", transform: "translateX(-50%)" }),
            width: 0, height: 0,
            borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
            borderTop: "5px solid var(--bg-secondary)",
          }} />
        </div>,
        document.body,
      )}
    </>
  );
}

export function TRow({ label, value, color, muted }: {
  label: string;
  value: string;
  color?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px]" style={{ color: muted ? "var(--text-muted)" : "var(--text-secondary)" }}>{label}</span>
      <span className="text-[10px] font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{value}</span>
    </div>
  );
}

export function TDivider() {
  return <div className="my-1.5" style={{ borderTop: "1px solid var(--border)" }} />;
}
