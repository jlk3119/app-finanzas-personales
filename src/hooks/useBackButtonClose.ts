import { useEffect, useRef } from "react";

// Pila de modales/hojas abiertos que usan este hook. Permite que solo el modal
// superior (el último abierto) responda al botón atrás, en vez de cerrarse todos
// en cascada cuando hay modales anidados (p. ej. el formulario de edición dentro
// de la hoja de Categorías).
const stack: symbol[] = [];

// Cuando un modal anidado se cierra programáticamente (p. ej. al Guardar), su cleanup
// hace history.back() para limpiar la entrada que empujó. Ese back() dispara un popstate
// que los listeners de modales externos capturarían. Esta bandera lo marca como
// programático para que esos listeners lo ignoren en vez de cerrarse.
let suppressPopClose = false;

export function useBackButtonClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  // eslint-disable-next-line react-hooks/refs
  onCloseRef.current = onClose;
  const closedByPopState = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const id = Symbol();
    stack.push(id);
    closedByPopState.current = false;
    window.history.pushState({ backClose: true }, "");

    const handlePop = () => {
      // Ignorar el popstate del back() programático de un modal anidado.
      if (suppressPopClose) return;
      // Solo el modal superior responde al botón atrás; los de abajo se quedan abiertos.
      if (stack[stack.length - 1] !== id) return;
      closedByPopState.current = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePop);

    return () => {
      window.removeEventListener("popstate", handlePop);
      const idx = stack.indexOf(id);
      if (idx !== -1) stack.splice(idx, 1);
      if (!closedByPopState.current && window.history.state?.backClose) {
        suppressPopClose = true;
        // Limpiar la bandera tras consumir el popstate de este back() programático.
        const clear = () => {
          suppressPopClose = false;
          window.removeEventListener("popstate", clear);
        };
        window.addEventListener("popstate", clear);
        window.history.back();
      }
    };
  }, [isOpen]);
}
