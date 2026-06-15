import { useEffect, useRef, useState } from "react";

export default function CursorEffect() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailsRef = useRef<HTMLDivElement[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const posRef = useRef({ x: -100, y: -100 });
  const ringPosRef = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (isTouchDevice) return;

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 6}px, ${e.clientY - 6}px)`;
      }
    };

    const animate = () => {
      const lerpFactor = 0.12;
      ringPosRef.current.x += (posRef.current.x - ringPosRef.current.x) * lerpFactor;
      ringPosRef.current.y += (posRef.current.y - ringPosRef.current.y) * lerpFactor;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringPosRef.current.x - 20}px, ${ringPosRef.current.y - 20}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest("a, button, input, textarea, select, [data-cursor-hover]");
      setIsHovering(!!isInteractive);
    };

    const onMouseDown = () => setIsClicking(true);
    const onMouseUp = () => setIsClicking(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onMouseOver, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] will-change-transform"
        style={{ transition: "opacity 0.2s" }}
      >
        <div
          className="transition-all duration-150"
          style={{
            width: isClicking ? 8 : 12,
            height: isClicking ? 8 : 12,
            borderRadius: "50%",
            background: isHovering
              ? "radial-gradient(circle, #e879f9, #7c3aed)"
              : "radial-gradient(circle, #a78bfa, #7c3aed)",
            boxShadow: isHovering
              ? "0 0 16px 6px rgba(232,121,249,0.6), 0 0 32px 12px rgba(124,58,237,0.3)"
              : "0 0 10px 4px rgba(167,139,250,0.5)",
            transform: isClicking ? "scale(0.7)" : "scale(1)",
          }}
        />
      </div>
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-[9998] will-change-transform"
      >
        <div
          className="transition-all duration-300"
          style={{
            width: isHovering ? 52 : 40,
            height: isHovering ? 52 : 40,
            borderRadius: "50%",
            border: isHovering
              ? "1.5px solid rgba(232,121,249,0.7)"
              : "1.5px solid rgba(167,139,250,0.4)",
            boxShadow: isHovering
              ? "0 0 20px 4px rgba(232,121,249,0.2), inset 0 0 20px 4px rgba(232,121,249,0.05)"
              : "0 0 12px 2px rgba(124,58,237,0.15)",
            transform: isHovering ? "scale(1.1)" : "scale(1)",
          }}
        />
      </div>
    </>
  );
}
