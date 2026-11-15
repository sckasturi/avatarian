/**
 * The colour-theme toggle: auto / light / dark, remembered per browser.
 *
 * One copy for every page (it used to be pasted into five). The choice is
 * kept in localStorage, and every read and write of it is guarded: with
 * site data blocked or in some private windows the accessor throws, and an
 * unguarded throw here used to take the rest of the page's script with it.
 * Without storage the toggle still works — it just isn't remembered.
 *
 * A page that needs to react to a change (the translator re-inks its
 * export) defines `onThemeChange`; it is called after each click.
 */
(function () {
  const KEY = "avatarian-theme";
  const LABELS = { auto: "◐ Theme: auto", light: "☀ Theme: light", dark: "☾ Theme: dark" };
  const ORDER = ["auto", "light", "dark"];
  const btn = document.getElementById("themeToggle");

  function apply(mode) {
    if (mode === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    if (!btn) return;
    btn.textContent = LABELS[mode];
    btn.setAttribute("aria-label", "Colour theme: " + mode + ". Click to change.");
  }

  let mode = "auto";
  try { mode = localStorage.getItem(KEY) || "auto"; } catch (e) { /* storage off */ }
  if (!ORDER.includes(mode)) mode = "auto";
  apply(mode);

  if (!btn) return;
  btn.addEventListener("click", () => {
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    try {
      if (mode === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch (e) { /* storage off */ }
    apply(mode);
    if (typeof onThemeChange === "function") onThemeChange(mode);
  });
})();
