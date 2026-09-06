"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Native top layer escapes transformed parents and every app stacking context. */
export function ModalLayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={ref} className="app-modal-layer" onCancel={event => event.preventDefault()}>{children}</dialog>;
}
