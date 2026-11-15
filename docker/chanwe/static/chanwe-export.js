/*
 * Wiki export (2026-11-15): adds CHANWE's exports to Outline's menus. On a page, «PDF (memo CHANWE)» next to Outline's
 * own «Markdown» and «HTML» items (submenu «Exportar»); on a collection, «Markdown (un archivo)» and «PDF (memo CHANWE)» after
 * «Exportar…». Each item only navigates to /chanwe/export/…, which Caddy sends to Publish's renderer
 * (chanwe-publish/render): it reads the Wiki with the reader's own session, so nobody gets more than they can open.
 * If Outline's menus change and the anchor isn't found, nothing is added. No Outline licence check is touched.
 */
(function () {
  "use strict";

  var URL_ID = "([A-Za-z0-9]{10})";
  var DOCUMENT = new RegExp("^/doc/(?:[^/]*-)?" + URL_ID + "(?:/|$)");
  var COLLECTION = new RegExp("^/collection/(?:[^/]*-)?" + URL_ID + "(?:/|$)");
  var EXPORT_LABEL = /^(Exportar|Export)…$/;
  var MARK = "data-chanwe-export";

  /** The page or collection a Wiki path shows, or null. */
  function routeTarget(pathname) {
    var doc = DOCUMENT.exec(pathname);
    if (doc) return { kind: "document", id: doc[1] };
    var collection = COLLECTION.exec(pathname);
    if (collection) return { kind: "collection", id: collection[1] };
    return null;
  }

  function exportItems(target) {
    var base = "/chanwe/export/" + target.kind + "/" + target.id;
    if (target.kind === "document") return [{ label: "PDF (memo CHANWE)", href: base + ".pdf" }];
    return [
      { label: "Markdown (un archivo)", href: base + ".md" },
      { label: "PDF (memo CHANWE)", href: base + ".pdf" },
    ];
  }

  /** Index of the menu item to add after, from the items' texts; -1 when this menu isn't the one. */
  function findAnchor(texts, target) {
    if (target.kind === "document") {
      var markdown = texts.indexOf("Markdown");
      var html = texts.indexOf("HTML");
      return markdown === -1 || html === -1 ? -1 : Math.max(markdown, html);
    }
    for (var i = 0; i < texts.length; i++) if (EXPORT_LABEL.test(texts[i])) return i;
    return -1;
  }

  /** Outline 1.12 item: MenuLabel <div> (+ icon, + MenuShortcut <span> with a hint such as ".md"). */
  function labelElement(item) {
    for (var c = item.firstElementChild; c; c = c.nextElementSibling) {
      if (c.tagName === "DIV" && c.textContent.trim()) return c;
    }
    return null;
  }

  function shortcutElement(item) {
    for (var c = item.lastElementChild; c; c = c.previousElementSibling) {
      if (c.tagName === "SPAN") return c;
    }
    return null;
  }

  function itemLabel(item) {
    var label = labelElement(item);
    return (label ? label.textContent : item.textContent.replace(/\.[A-Za-z0-9]{1,10}$/, "")).trim();
  }

  /** The button that opened this menu, following submenus up (Radix: aria-labelledby → trigger). */
  function rootTrigger(menu, doc) {
    for (var hops = 0; menu && hops < 6; hops++) {
      var trigger = doc.getElementById(menu.getAttribute("aria-labelledby") || "");
      if (!trigger) return null;
      var parent = trigger.closest('[role="menu"]');
      if (!parent) return trigger;
      menu = parent;
    }
    return null;
  }

  /** Copies Outline's item (so it looks the same) with our label, our file hint and our link. */
  function makeItem(anchor, item, win) {
    var node = anchor.cloneNode(true);
    node.setAttribute(MARK, "");
    node.removeAttribute("id");
    node.removeAttribute("data-highlighted");
    var label = labelElement(node);
    if (label) label.textContent = item.label;
    else node.textContent = item.label;
    var hint = shortcutElement(node);
    if (hint) hint.textContent = item.href.slice(item.href.lastIndexOf("."));
    node.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      win.location.assign(item.href);
      win.document.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    return node;
  }

  function decorate(win) {
    var target = routeTarget(win.location.pathname);
    if (!target) return;
    var doc = win.document;
    var menus = doc.querySelectorAll('[role="menu"]');
    for (var m = 0; m < menus.length; m++) {
      var menu = menus[m];
      if (menu.querySelector("[" + MARK + "]")) continue;
      // Only the page's or collection's own menu: one opened from the sidebar may belong to another item.
      var trigger = rootTrigger(menu, doc);
      if (!trigger || trigger.closest("#sidebar")) continue;
      var items = menu.querySelectorAll('[role="menuitem"]');
      var texts = [];
      for (var i = 0; i < items.length; i++) texts.push(itemLabel(items[i]));
      var at = findAnchor(texts, target);
      if (at === -1) continue;
      var anchor = items[at];
      var after = anchor;
      var list = exportItems(target);
      for (var k = 0; k < list.length; k++) {
        var node = makeItem(anchor, list[k], win);
        after.parentNode.insertBefore(node, after.nextSibling);
        after = node;
      }
    }
  }

  function start(win) {
    var observer = new win.MutationObserver(function () {
      decorate(win);
    });
    observer.observe(win.document.body, { childList: true, subtree: true });
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { routeTarget: routeTarget, exportItems: exportItems, findAnchor: findAnchor, decorate: decorate, start: start };
  } else if (document.body) {
    start(window);
  } else {
    document.addEventListener("DOMContentLoaded", function () { start(window); });
  }
})();
