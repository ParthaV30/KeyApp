import { router, type Href } from 'expo-router';

/** Back navigation remains usable when a screen is opened from a deep link. */
export function safeBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
