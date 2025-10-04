"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function ChartLightbox(props: Props) {
  const { open, onClose, title, subtitle, children } = props;
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingRef = useRef<{ dragging: boolean; startX: number; startY: number; startOffsetX: number; startOffsetY: number }>({ dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.min(2, Math.max(1, s + delta)));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current.dragging) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    setOffset({ x: draggingRef.current.startOffsetX + dx, y: draggingRef.current.startOffsetY + dy });
  };
  const onMouseUp = (e: React.MouseEvent) => {
    // If pointer moved significantly, treat as drag end only; do not toggle zoom
    const dx = Math.abs(e.clientX - draggingRef.current.startX);
    const dy = Math.abs(e.clientY - draggingRef.current.startY);
    const moved = dx > 1 || dy > 1;
    draggingRef.current.dragging = false;
    if (!moved) {
      // Click without drag ends here: toggle zoom
      onToggleZoom(e);
    }
  };

  const onToggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((s) => (s > 1 ? 1 : 2));
  };

  const onReset = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const content = useMemo(() => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[1000] clb-portal">
        <style>{`@media print {
  /* Hide everything except the lightbox portal */
  body > :not(.clb-portal) { display: none !important; }
  .clb-backdrop { display: none !important; }
  .clb-controls { display: none !important; }
  .clb-root { position: static !important; inset: auto !important; height: auto !important; display: block !important; }
  html, body { margin: 0 !important; padding: 0 !important; }
  /* Force stable print dimensions so ResponsiveContainer has explicit height */
  .print-container { width: 100% !important; height: auto !important; }
  .print-inner { width: 7.5in !important; height: 5in !important; }
}`}</style>
        <div className="absolute inset-0 bg-black/80 clb-backdrop" onClick={onClose} />
        <div className="absolute inset-0 flex flex-col clb-root">
          <div className="flex items-center justify-end gap-2 p-3 clb-controls">
            <button type="button" onClick={() => window.print()} className="rounded-md bg-white text-black px-3 py-1.5 text-sm hover:bg-black/10">
              Print
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md bg-white text-black px-3 py-1.5 text-sm hover:bg-black/10">
              ✕
            </button>
          </div>
          <div className="px-4 pb-4 text-center select-none" onDoubleClick={onReset}>
            {title && <div className="text-white text-base font-medium mb-1">{title}</div>}
            {subtitle && <div className="text-white/80 text-sm mb-3">{subtitle}</div>}
            <div
              role="presentation"
              className="relative mx-auto overflow-hidden rounded-lg bg-white/5 print-container"
              style={{ width: "92vw", height: "82vh", cursor: draggingRef.current.dragging ? "grabbing" : "grab" }}
              onWheel={onWheel}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              // Click handled via onMouseUp to disambiguate drag vs click
            >
              <div
                className="absolute left-1/2 top-1/2 will-change-transform"
                style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`, transformOrigin: "center center" }}
              >
                <div className="w-[92vw] h-[82vh] print-inner">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [open, onClose, title, subtitle, children, scale, offset]);

  if (!mounted) return null;
  return createPortal(content, document.body);
}


