/**
 * A one-time notice: the null used to be typed `0`, and is now `-`, since
 * `0` became the zero numeral. Shown once per browser, on whichever page
 * with a sounds box someone opens first, then never again.
 *
 * If storage is unavailable (a private window, blocked site data) the
 * notice is skipped rather than shown on every visit — it is a courtesy,
 * not something anyone needs in order to use the page.
 */
(function () {
  const KEY = "avatarian-notice-null-dash";
  try {
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, "1");
  } catch (e) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .av-notice { max-width: min(26rem, calc(100vw - 32px)); padding: 20px 22px;
      border: 1px solid var(--line); border-radius: 12px; background: var(--card);
      color: var(--ink); box-shadow: 0 10px 40px rgba(0,0,0,0.25); }
    .av-notice::backdrop { background: rgba(0,0,0,0.4); }
    .av-notice h2 { margin: 0 0 8px; font-size: 1.15rem; }
    .av-notice p { margin: 0 0 10px; line-height: 1.5; }
    .av-notice code { background: var(--code-bg); padding: 1px 6px; border-radius: 4px; }
    .av-notice button { margin-top: 4px; padding: 6px 16px; border-radius: 8px;
      border: 1px solid var(--accent); background: var(--accent); color: var(--card);
      font: inherit; cursor: pointer; }`;
  document.head.appendChild(style);

  const dlg = document.createElement("dialog");
  dlg.className = "av-notice";
  dlg.setAttribute("aria-labelledby", "avNoticeTitle");
  dlg.innerHTML =
    '<h2 id="avNoticeTitle">Nulls are now typed <code>-</code></h2>' +
    '<p>The null that fills an empty slot used to be typed <code>0</code>. ' +
    'It is now <code>-</code>, so <em>Avatar</em> is <code>a v uh - t ah r -</code>.</p>' +
    '<p><code>0</code> is now the numeral zero. Older links you saved still ' +
    'open the way they were written.</p>' +
    '<form method="dialog"><button type="submit" autofocus>Got it</button></form>';
  document.body.appendChild(dlg);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  if (typeof dlg.showModal === "function") dlg.showModal();
})();
