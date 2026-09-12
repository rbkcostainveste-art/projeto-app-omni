"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Desktop keeps its full layout. Mobile reveals one topic on demand.
export function PresentationMobileSection({ name, description, sectionId, number, children }: {
  name: string; description: string; sectionId: string; number: string; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    function reveal(hash: string) {
      let id: string;
      try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
      if (!id) return;
      const target = document.getElementById(id);
      if (!target || !contentRef.current?.contains(target)) return;
      setExpanded(true);
      frame = requestAnimationFrame(() => {
        if (window.matchMedia("(max-width: 700px)").matches) target.scrollIntoView({ block: "start" });
      });
    }
    function revealAnchor() { reveal(window.location.hash); }
    function followAnchor(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (anchor) reveal(anchor.getAttribute("href") ?? "");
    }
    frame = requestAnimationFrame(revealAnchor);
    window.addEventListener("hashchange", revealAnchor);
    document.addEventListener("click", followAnchor);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", revealAnchor); document.removeEventListener("click", followAnchor); };
  }, []);
  return <div className={expanded ? "presentation-mobile-section is-expanded" : "presentation-mobile-section"}>
    <button type="button" className="presentation-mobile-summary" aria-expanded={expanded} aria-controls={sectionId + "-content"} onClick={() => setExpanded(value => !value)}>
      <span className="presentation-mobile-number">{number}</span><span><strong>{name}</strong><small>{description}</small></span><ChevronDown size={20} aria-hidden="true"/>
    </button>
    <div ref={contentRef} id={sectionId + "-content"} className="presentation-mobile-content">{children}</div>
  </div>;
}
