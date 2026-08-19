/**
 * Tiny screen router: exactly one .screen section is visible at a time.
 */

/**
 * @returns {{show: (screenId: string) => void}}
 */
export function createScreenManager() {
  const screens = Array.from(document.querySelectorAll(".screen"));

  function show(screenId) {
    for (const screen of screens) {
      screen.classList.toggle("visible", screen.id === screenId);
    }
  }

  return { show };
}
