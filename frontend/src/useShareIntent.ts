// Safe wrapper around expo-share-intent that gracefully no-ops in Expo Go
// (where the native module isn't loaded).
import { useEffect } from "react";
import { useRouter } from "expo-router";

export function useShareIntentListener() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    (async () => {
      try {
        // Dynamic require so Expo Go doesn't try to resolve native module at startup
        const mod = await import("expo-share-intent");
        if (!mod?.addStateListener) return;

        unsubscribe = mod.addStateListener(async (state: any) => {
          if (!mounted) return;
          if (state?.value === "userIsInterracting" || state?.value === "pending") {
            try {
              const intent = await mod.getShareIntent?.();
              const url: string | undefined = intent?.webUrl || intent?.text;
              if (url && /^https?:\/\//.test(url)) {
                router.push({ pathname: "/share", params: { url } });
                mod.clearShareIntent?.();
              }
            } catch {}
          }
        });

        // Initial check (if app was opened via share)
        const initial = await mod.getShareIntent?.();
        const initUrl: string | undefined = initial?.webUrl || initial?.text;
        if (initUrl && /^https?:\/\//.test(initUrl)) {
          router.push({ pathname: "/share", params: { url: initUrl } });
          mod.clearShareIntent?.();
        }
      } catch {
        // Expo Go — native module not available; silently no-op
      }
    })();

    return () => {
      mounted = false;
      if (unsubscribe) try { unsubscribe(); } catch {}
    };
  }, [router]);
}
