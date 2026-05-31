import { useAuth, getToken } from "@/lib/auth";

/** Break Free streak/mood APIs require auth — wait for guest bootstrap or login. */
export function useBreakFreeAuthReady() {
  const { status } = useAuth();
  const hasToken = Boolean(getToken());
  const ready = status === "authenticated" && hasToken;
  const loading =
    status === "loading" || (status === "unauthenticated" && !hasToken);

  return { ready, loading, status };
}
