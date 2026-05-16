import { useEffect, useRef } from "react";

export function useBackButtonClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedByPopState = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    closedByPopState.current = false;
    window.history.pushState({ backClose: true }, "");

    const handlePop = () => {
      closedByPopState.current = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      if (!closedByPopState.current && window.history.state?.backClose) {
        window.history.back();
      }
    };
  }, [isOpen]);
}
