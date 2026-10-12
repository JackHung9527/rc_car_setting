/*
 * 數值的圖形化外掛：滑桿、刻度條、小圖示、曲線圖。掛在 app.js 的 RC_PLUGINS 掛點上，要在 app.js 之前載入。
 *
 * 資料檔有下列屬性才會出現，沒有的產品畫面不變：
 *   欄位 min／max／step（type 為 num）       一行高的滑桿，金色記號是原廠值的位置
 *   欄位 scale: [由小到大的選項]             刻度條（有大小順序、多到只能用下拉選單的檔位）
 *   欄位 glyphs: { 選項: [圖示名稱, 說明] }  目前選項的小圖示與一句說明，圖示名稱見下方 ICONS
 *   群組 charts: [{ name, after, uses: [欄位 id], build: function (values) }]   曲線圖
 *        骨架有 pin 掛點（api.pin）時釘在編輯頁上方：同一張卡片有多張圖就用 name 當分頁，
 *        改到 uses 裡的欄位會自動切到那張圖；沒有 pin 掛點時畫在 after 那個欄位下方。
 *        骨架有 card 掛點時，總覽頁的卡片上放第一張圖的縮圖。
 *   產品 locks: [{ when: { id, is }, items: [欄位 id], text }]   條件成立時在這些欄位標示 text
 *
 * build(values) 回傳圖表規格；資料不足時回傳 { title, empty: "說明文字" }：
 *   { title,
 *     x: { label, max, ticks: [...], fmt: function (刻度值) },   // 兩軸都從 0 開始，fmt 可省略
 *     y: { label, max, ticks: [...] },
 *     lines: [{ kind, points: [[x, y], ...], area: true, label }],
 *            // kind：main 主線、alt 第二條線、ref 參考線（虛線）、guess 說明書沒寫清楚的示意線（虛線）
 *            // 有 label 的線達兩條以上時才畫圖例
 *     dots:  [{ x, y, kind }],
 *     marks: [{ x, label }],                                     // 直線記號，文字寫在繪圖區上方
 *     note }
 * 曲線圖畫不出來的圖（例如外形尺寸圖）可以回傳 { title, svg: 自己畫好的 SVG 節點, note }，照樣放進同一組分頁；
 * 這種圖沒有卡片縮圖。SVG 要有 class="vz-svg"，viewBox 用寬 328、高 150 左右（釘在上方時高度上限 148px，
 * 照這個比例字才不會被縮小），形狀可以用 css/visual.css 最後一段的 class。
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  // 44×44 的圖示：有 class="s" 的是線條，其餘是實心
  var ARROW_UP = '<path d="M22 4l6 8h-4v6h-4v-6h-4z"/>';
  var ARROW_DOWN = '<path d="M22 42l6-8h-4v-6h-4v6h-4z"/>';
  var BRAKE_BAR = '<rect x="11" y="21" width="22" height="4" rx="2"/>';
  var ROTATE = '<path class="s" d="M22 9a13 13 0 1 1-13 13"/><path d="M9 13.5l-5.5 9h11z"/>';
  var ICONS = {
    "run-fb": ARROW_UP + BRAKE_BAR,                 // 前進、煞車
    "run-frb": ARROW_UP + BRAKE_BAR + ARROW_DOWN,   // 前進、煞車、倒車
    "run-fr": ARROW_UP + ARROW_DOWN,                // 前進、倒車
    cw: ROTATE,
    ccw: '<g transform="translate(44 0) scale(-1 1)">' + ROTATE + "</g>"
  };

  /* ---------- 小工具 ---------- */

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    (kids || []).forEach(function (kid) { if (kid) node.appendChild(kid); });
    return node;
  }

  function s(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function label(x, y, str, anchor) {
    var t = s("text", { x: x, y: y, "text-anchor": anchor || "start", class: "vz-text" });
    t.textContent = str;
    return t;
  }

  function decimals(step) { return (String(step).split(".")[1] || "").length; }

  function factoryOf(p, it, api) {
    var v = p.factoryOf ? p.factoryOf(it, api.values()) : it.factory;
    return v == null ? "" : String(v);
  }

  // 每個圖形元件都一樣：先畫一次，之後任何欄位改變再重畫
  function live(api, update) {
    update();
    api.onChange(update);
  }

  /* ---------- 滑桿（有範圍的數值欄位） ---------- */

  function slider(p, it, api) {
    var step = it.step || 1, dec = decimals(step), span = it.max - it.min;
    var unit = it.unit ? (it.unit === "°" || it.unit === "%" ? it.unit : " " + it.unit) : "";

    function write() { api.set(it.id, String(parseFloat(parseFloat(range.value).toFixed(dec)))); }
    var range = el("input", {
      type: "range", class: "vz-range", min: it.min, max: it.max, step: step,
      "aria-label": it.name + "（滑桿）",
      oninput: write,
      // 還沒有值時把手停在最左邊，直接點把手不會有 input 事件
      onclick: function () { if (isNaN(parseFloat(api.values()[it.id]))) write(); }
    });
    var tick = el("span", { class: "vz-tick", title: "原廠值" });
    var box = el("div", { class: "vz-slider" }, [
      el("span", { class: "vz-end", text: it.min + unit }),
      el("div", { class: "vz-track" }, [tick, range]),
      el("span", { class: "vz-end", text: it.max + unit })
    ]);
    var warn = el("p", { class: "vz-warn", text: "超出說明書範圍（" + it.min + " ~ " + it.max + unit + "）" });

    live(api, function () {
      var n = parseFloat(api.values()[it.id]), f = parseFloat(factoryOf(p, it, api));
      var has = !isNaN(n), shown = has ? Math.max(it.min, Math.min(it.max, n)) : it.min;
      box.classList.toggle("is-unset", !has);
      warn.hidden = !has || (n >= it.min && n <= it.max);
      range.value = shown;
      range.style.setProperty("--p", (shown - it.min) / span);
      tick.hidden = isNaN(f) || f < it.min || f > it.max;
      tick.style.setProperty("--p", (f - it.min) / span);
    });
    return [box, warn];
  }

  /* ---------- 刻度條（有大小順序的選項） ---------- */

  function scaleBar(p, it, api) {
    var cells = it.scale.map(function () { return el("span", { class: "vz-cell" }); });
    var box = el("div", { class: "vz-scale", "aria-hidden": "true" }, [
      el("span", { class: "vz-end", text: it.scale[0] }),
      el("div", { class: "vz-cells" }, cells),
      el("span", { class: "vz-end", text: it.scale[it.scale.length - 1] })
    ]);
    live(api, function () {
      var at = it.scale.indexOf(api.values()[it.id]);
      var fac = it.scale.indexOf(factoryOf(p, it, api));
      cells.forEach(function (cell, i) {
        cell.classList.toggle("is-on", i <= at);
        cell.classList.toggle("is-factory", i === fac);
      });
    });
    return box;
  }

  /* ---------- 小圖示（目前選項代表什麼） ---------- */

  function glyph(it, api) {
    var box = el("div", { class: "vz-glyph" });
    live(api, function () {
      var g = it.glyphs[api.values()[it.id]];
      box.hidden = !g;
      box.textContent = "";
      if (!g) return;
      box.insertAdjacentHTML("afterbegin", '<svg viewBox="0 0 44 44" aria-hidden="true">' + ICONS[g[0]] + "</svg>");
      box.appendChild(el("span", { text: g[1] }));
    });
    return box;
  }

  /* ---------- 不可調整的提示 ---------- */

  function lockNote(p, it, api) {
    var mine = (p.locks || []).filter(function (lock) { return lock.items.indexOf(it.id) >= 0; });
    if (!mine.length) return null;
    var note = el("p", { class: "vz-lock" });
    live(api, function () {
      var vals = api.values();
      var active = mine.filter(function (lock) { return vals[lock.when.id] === lock.when.is; });
      note.textContent = active.map(function (lock) { return lock.text; }).join("；");
      note.hidden = !active.length;
    });
    return note;
  }

  /* ---------- 曲線圖 ---------- */

  // mini：卡片上的縮圖，只留線條，不畫刻度與文字
  function chartSvg(spec, mini) {
    var W = mini ? 160 : 328, H = mini ? 56 : 188;
    var L = mini ? 2 : 34, R = mini ? 2 : 14, T = mini ? 4 : 34, B = mini ? 3 : 34;
    var pw = W - L - R, ph = H - T - B;
    function sx(x) { return L + Math.min(x, spec.x.max) / spec.x.max * pw; }
    function sy(y) { return T + ph - Math.min(y, spec.y.max) / spec.y.max * ph; }
    function path(points) {
      return points.map(function (pt) { return sx(pt[0]).toFixed(1) + "," + sy(pt[1]).toFixed(1); }).join(" ");
    }
    var svg = s("svg", mini
      ? { viewBox: "0 0 " + W + " " + H, class: "vz-svg", "aria-hidden": "true" }
      : { viewBox: "0 0 " + W + " " + H, class: "vz-svg", role: "img", "aria-label": spec.title });

    if (mini) {
      svg.appendChild(s("line", { x1: L, y1: sy(0), x2: W - R, y2: sy(0), class: "vz-axis" }));
    } else {
      spec.y.ticks.forEach(function (t) {
        svg.appendChild(s("line", { x1: L, y1: sy(t), x2: W - R, y2: sy(t), class: t ? "vz-grid" : "vz-axis" }));
        svg.appendChild(label(L - 6, sy(t) + 3.5, String(t), "end"));
      });
      spec.x.ticks.forEach(function (t) {
        svg.appendChild(label(sx(t), H - B + 14, spec.x.fmt ? spec.x.fmt(t) : String(t), "middle"));
      });
      svg.appendChild(label(0, 10, spec.y.label));
      svg.appendChild(label(W - R, H - 4, spec.x.label, "end"));

      var marks = (spec.marks || []).slice().sort(function (a, b) { return a.x - b.x; });
      marks.forEach(function (mk, i) {
        var x = sx(mk.x), next = marks[i + 1];
        // 文字寫在繪圖區上方、線的右邊；右邊緊鄰下一條線或圖的邊緣時改放左邊
        var left = (next && sx(next.x) - x < 36) || x > W - R - 30;
        svg.appendChild(s("line", { x1: x, y1: T - 6, x2: x, y2: T + ph, class: "vz-mark" }));
        svg.appendChild(label(x + (left ? -4 : 4), T - 8, mk.label, left ? "end" : "start"));
      });
    }
    spec.lines.forEach(function (ln) {
      if (!ln.area) return;
      var first = ln.points[0], last = ln.points[ln.points.length - 1];
      svg.appendChild(s("polygon", { class: "vz-area", points: path(ln.points.concat([[last[0], 0], [first[0], 0]])) }));
    });
    spec.lines.forEach(function (ln) {
      svg.appendChild(s("polyline", { class: "vz-line vz-" + ln.kind, points: path(ln.points) }));
    });
    (spec.dots || []).forEach(function (d) {
      svg.appendChild(s("circle", { cx: sx(d.x), cy: sy(d.y), r: mini ? 3 : 4.5, class: "vz-dot vz-" + d.kind }));
    });
    return svg;
  }

  function fill(fig, spec) {
    fig.textContent = "";
    fig.appendChild(el("figcaption", { text: spec.title }));
    if (spec.empty) {
      fig.appendChild(el("p", { class: "vz-note", text: spec.empty }));
      return;
    }
    if (spec.svg) {
      fig.appendChild(spec.svg);
      if (spec.note) fig.appendChild(el("p", { class: "vz-note", text: spec.note }));
      return;
    }
    fig.appendChild(chartSvg(spec));
    var named = spec.lines.filter(function (ln) { return ln.label; });
    if (named.length > 1) {
      fig.appendChild(el("ul", { class: "vz-legend" }, named.map(function (ln) {
        return el("li", {}, [el("i", { class: "vz-key vz-" + ln.kind }), el("span", { text: ln.label })]);
      })));
    }
    if (spec.note) fig.appendChild(el("p", { class: "vz-note", text: spec.note }));
  }

  // groupIds 可能沒有：卡片可以只列欄位（items）而不列群組，那種卡片沒有曲線圖
  function chartsOf(p, groupIds) {
    var found = [];
    p.groups.forEach(function (grp) {
      if ((groupIds || []).indexOf(grp.id) >= 0) found = found.concat(grp.charts || []);
    });
    return found;
  }

  // 畫在欄位下方的圖（骨架沒有 pin 掛點時用）
  function inlineCharts(p, it, api) {
    var all = chartsOf(p, p.groups.map(function (grp) { return grp.id; }));
    return all.filter(function (c) { return c.after === it.id; }).map(function (c) {
      var fig = el("figure", { class: "vz-chart" });
      live(api, function () { fill(fig, c.build(api.values())); });
      return fig;
    });
  }

  // 釘在編輯頁上方的圖：多張圖用分頁切換，改到哪張圖用的欄位就切到那張
  function pinnedCharts(p, card, api) {
    var list = chartsOf(p, card.groups);
    if (!list.length) return null;
    var at = 0;
    var fig = el("figure", { class: "vz-chart" });
    var tabs = list.length < 2 ? null : el("div", { class: "pin-tabs" }, list.map(function (c, i) {
      return el("button", { type: "button", class: "pin-tab", text: c.name, onclick: function () { at = i; draw(); } });
    }));
    function inputs() {
      var vals = api.values();
      return list.map(function (c) { return c.uses.map(function (id) { return vals[id]; }).join("\n"); });
    }
    function draw() {
      fill(fig, list[at].build(api.values()));
      if (tabs) Array.prototype.forEach.call(tabs.children, function (b, i) { b.classList.toggle("is-on", i === at); });
    }
    var seen = inputs();
    draw();
    api.onChange(function () {
      var now = inputs();
      if (now[at] === seen[at]) {
        for (var i = 0; i < list.length; i++) if (now[i] !== seen[i]) { at = i; break; }
      }
      seen = now;
      draw();
    });
    return el("div", { class: "vz-pin" }, [fig, tabs]);
  }

  /* ---------- 掛點 ---------- */

  (window.RC_PLUGINS = window.RC_PLUGINS || []).push({
    item: function (p, it, api) {
      var parts = []
        .concat(it.type === "num" && it.min != null && it.max != null ? slider(p, it, api) : [])
        .concat(it.scale ? [scaleBar(p, it, api)] : [])
        .concat(it.glyphs ? [glyph(it, api)] : [])
        .concat([lockNote(p, it, api)])
        .concat(api.pin ? [] : inlineCharts(p, it, api))
        .filter(function (node) { return node; });
      return parts.length ? el("div", { class: "vz" }, parts) : null;
    },
    pin: pinnedCharts,
    card: function (p, card, api) {
      var first = chartsOf(p, card.groups)[0];
      var spec = first && first.build(api.values());
      return spec && !spec.empty && !spec.svg ? el("span", { class: "vz-thumb" }, [chartSvg(spec, true)]) : null;
    }
  });
})();
