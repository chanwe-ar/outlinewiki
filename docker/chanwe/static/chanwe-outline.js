/*
 * CHANWE additions to Outline's UI, loaded deferred from index.html
 * (docker/brand-outline.cjs puts it there):
 *
 * - "Volver a CHANWE Espacios" as the first row of the sidebar navigation,
 *   above Inicio. Its link carries data-cw-veil-icon, so app-veil.js plays
 *   the hand-off to Espacios on click.
 * - Lifts the app veil (loaded with data-wait) once Outline has rendered
 *   something a person can use, rather than on window load, which fires
 *   while Outline is still fetching the session.
 *
 * Outline is a React app; the row is a plain DOM node React does not know
 * about, put back by a MutationObserver whenever React re-renders the sidebar.
 */
(function () {
  "use strict";

  var ESPACIOS_URL = "https://espacios.chanwe.ar/";
  var LABEL = "Volver a CHANWE Espacios";
  var base = (document.currentScript && document.currentScript.src) || "";
  var asset = function (name) { return new URL(name, base || location.href).href; };
  // brand/app-icons/svg/espacios-glyph.svg, in the text colour.
  var GLYPH =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">' +
    '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke-width="1.6"/>' +
    '<rect x="7" y="7" width="4.4" height="4.4" rx="1.2" fill="currentColor" stroke="none"/>' +
    '<rect x="13.35" y="7.6" width="3.3" height="3.3" rx="0.9" stroke-width="1.2"/>' +
    '<rect x="7.6" y="13.35" width="3.3" height="3.3" rx="0.9" stroke-width="1.2"/>' +
    '<rect x="13.35" y="13.35" width="3.3" height="3.3" rx="0.9" stroke-width="1.2"/></svg>';

  function buildLink() {
    var link = document.createElement("a");
    link.className = "cw-espacios";
    link.href = ESPACIOS_URL;
    link.title = LABEL;
    link.setAttribute("aria-label", LABEL);
    link.setAttribute("data-cw-veil-icon", asset("espacios.svg"));
    link.setAttribute("data-cw-veil-label", "Espacios");
    link.innerHTML =
      '<span class="cw-espacios__glyph">' + GLYPH + "</span>" +
      '<span class="cw-espacios__wordmark" aria-hidden="true"></span>' +
      '<span class="cw-espacios__label" aria-hidden="true">Espacios</span>';
    return link;
  }

  // Match Outline's own sidebar rows: a row that is not the current page
  // shows the resting colour, size and padding of the active theme.
  function matchRow(link, reference) {
    var style = getComputedStyle(reference);
    link.style.color = style.color;
    link.style.fontSize = style.fontSize;
    link.style.fontWeight = style.fontWeight;
    link.style.paddingTop = style.paddingTop;
    link.style.paddingBottom = style.paddingBottom;
    link.style.paddingInlineStart = "12px";
    link.style.paddingInlineEnd = style.paddingInlineEnd;
    link.style.borderRadius = style.borderRadius;
  }

  // Reading computed styles forces a style recalculation, so the row is only
  // re-matched when it is (re)inserted or the theme may have changed, never on
  // the stream of mutations typing in the editor produces.
  var restyle = true;

  // Outline marks no theme in the page; the shell styles need to know whether
  // it is light (rail and white bar) or dark. Read from the body's background.
  function markTheme() {
    var match = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    if (!match) return;
    var light = (+match[0] * 299 + +match[1] * 587 + +match[2] * 114) / 1000 > 128;
    document.documentElement.setAttribute("data-cw-theme", light ? "light" : "dark");
  }

  function placeEspacios() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    var home = sidebar.querySelector('a[href="/home"]');
    if (!home || !home.parentNode) return;
    var link = sidebar.querySelector(".cw-espacios");
    if (!link) {
      link = buildLink();
      restyle = true;
    }
    if (link.nextSibling !== home) home.parentNode.insertBefore(link, home);
    if (!restyle) return;
    restyle = false;
    markTheme();
    var search = sidebar.querySelector('a[href="/search"]');
    var reference = [search, home].filter(function (element) {
      return element && element.getAttribute("aria-current") !== "page";
    })[0];
    if (reference) matchRow(link, reference);
  }

  // The workspace button at the top of the rail shows the CHANWE wordmark
  // instead of the team's icon and name (CSS draws it); its menu stays.
  function markTeam() {
    var sidebar = document.getElementById("sidebar");
    var team = sidebar && sidebar.querySelector('button[role="button"]');
    if (!team || team.classList.contains("cw-team")) return;
    team.classList.add("cw-team");
    team.setAttribute("aria-label", "CHANWE");
  }

  // The veil waits for a usable screen: the sidebar, or any control (login,
  // error and share pages have no sidebar).
  var veilDone = false;
  function liftVeil() {
    if (veilDone || !window.cwVeil) return;
    var root = document.getElementById("root");
    if (root && root.querySelector("#sidebar, button, a[href], input")) {
      veilDone = true;
      window.cwVeil.done();
    }
  }

  var scheduled = false;
  function update() {
    scheduled = false;
    placeEspacios();
    markTeam();
    liftVeil();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  // The theme can change without a DOM mutation the observer would see.
  if (window.matchMedia) {
    var scheme = window.matchMedia("(prefers-color-scheme: dark)");
    if (scheme.addEventListener) scheme.addEventListener("change", function () { restyle = true; schedule(); });
  }
  // Outline's own theme switch is a click in a menu.
  document.addEventListener("click", function () { setTimeout(function () { restyle = true; schedule(); }, 0); }, true);
  schedule();
})();
