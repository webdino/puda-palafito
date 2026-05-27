import debounce from "debounce";
import { delay } from "./delay";

/**
 * Timeout (ms)
 *
 * Google's study shows bounce rate hits 90% at 5s load time
 * https://think.storage.googleapis.com/docs/mobile-page-speed-new-industry-benchmarks.pdf
 */
export const defaultTimeout = 5000;

/**
 * Invokes a callback when the page is considered "visited" / ページが「訪問された」と見なされたタイミングでコールバックを呼びます
 *
 * It is triggered by either of the following:
 * - When the `load` event fires, or after a certain timeout (whichever comes first)
 * - When the URL changes and a certain timeout elapses (only if both conditions are met)
 */
export async function registerOnPageVisit(callback: () => Promise<void>, timeout = defaultTimeout) {
  await Promise.race([
    delay(timeout),
    new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve(), { once: true });
    }),
  ]);

  const onchange = debounce(callback, timeout);
  onchange.trigger();

  let url = location.href;
  setInterval(() => {
    if (location.href !== url) {
      url = location.href;
      onchange();
    }
  }, 100);
}
