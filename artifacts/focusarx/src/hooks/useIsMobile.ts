import { useMediaQuery } from "./useMediaQuery";


export function useIsMobile(breakpoint = 768) {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}

export function useIsTouchDevice() {
  return useMediaQuery("(hover: none) and (pointer: coarse)");
}
