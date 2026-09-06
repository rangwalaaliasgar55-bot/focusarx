import { useMediaQuery } from "./useMediaQuery";

/** True when the OS asks for reduced motion. Correct on the very first render. */
export function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
