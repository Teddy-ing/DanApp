"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: (forPrint: boolean) => React.ReactNode;
};

export default function ChartLightbox(props: Props) {
  const { open, onClose, title, subtitle, children } = props;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef<{ dragging: boolean; startX: number; startY: number; startOffsetX: number; startOffsetY: number }>({ dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });
  const frameRef = useRef<HTMLDivElement | null>(null);

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

  // No JS print toggling; rely on CSS @media print so container keeps explicit size

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.min(2, Math.max(1, s + delta)));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
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
    const dx = Math.abs(e.clientX - draggingRef.current.startX);
    const dy = Math.abs(e.clientY - draggingRef.current.startY);
    const moved = dx > 6 || dy > 6;
    draggingRef.current.dragging = false;
    setIsDragging(false);
    if (!moved && e.button === 0) {
      onToggleZoom(e);
    }
  };

  const onToggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((s) => (s > 1 ? 1 : 2));
  };

  if (typeof document === "undefined") return null;
  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[1000] clb-portal">
      <style>{`@media print {
  /* Hide everything except the lightbox portal */
  body > :not(.clb-portal) { display: none !important; }
  .clb-backdrop, .clb-controls { display: none !important; }
  html, body { margin: 0 !important; padding: 0 !important; }
  @page { margin: 0.5in; }
  /* Force explicit size so ResponsiveContainer has height */
  .print-container { width: 7.5in !important; height: 9.5in !important; margin: 0 auto !important; }
  .print-inner { width: 100% !important; height: 100% !important; }
  .print-transform { transform: none !important; }
  .print-abs { position: static !important; left: auto !important; top: auto !important; }
}`}</style>
      <div className="absolute inset-0 bg-black/80 clb-backdrop" onClick={onClose} />
      <div className="absolute inset-0 flex flex-col clb-root" onClick={(e) => { if (frameRef.current && !frameRef.current.contains(e.target as Node)) onClose(); }}>
        <div className="flex items-center justify-end gap-2 p-3 clb-controls" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => window.print()} className="rounded-md bg-white text-black px-3 py-1.5 text-sm hover:bg-black/10">
            Print
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md bg-white text-black px-3 py-1.5 text-sm hover:bg-black/10">
            ✕
          </button>
        </div>
        <div className="px-4 pb-4 text-center select-none">
          {title && <div className="text-white text-base font-medium mb-1">{title}</div>}
          {subtitle && <div className="text-white/80 text-sm mb-3">{subtitle}</div>}
          <div
            role="presentation"
            className="relative mx-auto overflow-hidden rounded-lg bg-white/5 print-container"
            style={{ width: "92vw", height: "82vh", cursor: isDragging ? "grabbing" : "grab" }}
            ref={frameRef}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            // Click handled via onMouseUp to disambiguate drag vs click
          >
            <div
              className="absolute left-1/2 top-1/2 will-change-transform print-abs print-transform"
              style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`, transformOrigin: "center center" }}
            >
              <div className="w-[92vw] h-[82vh] print-inner">
                {children(false)}
              </div>
            </div>
          </div>
          {/* Print-only static container with explicit page-fitting size */}
          <div className="print-only" style={{ display: 'none' }}>
            <div style={{ width: '100%', height: '9in', margin: '0 auto' }}>
              <div style={{ width: '100%', height: '100%' }}>
                {children(true)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}


