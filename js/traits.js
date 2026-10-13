/*
 * 車輛特性：總覽頁下方的一份總覽，把「目前的設定」換成「車子會怎樣」，全部直接寫出來。
 * 掛在 app.js 的 RC_PLUGINS 掛點（overview）上，要在 app.js 之前載入。產品有 p.traits 才會出現。
 *
 * 做法：p.traits.rules 的每條規則看一個或幾個欄位，判斷現在是哪一種情況（和原廠比變大還是變小、
 * 選了哪個選項），再列出那種情況下的敘述。敘述有三個來源，畫面上都標出來：
 *   說明書     產品資料檔的 effect 裡 m() 的那幾筆
 *   一般原則   產品資料檔的 effect 裡 g() 的那幾筆
 *   XRAY       data/theory-xray.js（設定理論頁的資料）裡對應的調整方向。index.html 沒載入它時就只列前兩種
 * 這裡不自己寫特性的敘述，只負責挑出適用的那幾句。
 *
 * 畫面（使用者 2026-10-13 的指示）：一條規則一段，全部攤開，不用點就看得到；不要再依入彎、加油門
 * 這類大項目分成一格一格去點（第一版那樣做，使用者看了說「不要這樣分類，把整體的特性全部寫出來，我只是要總覽」）。
 *
 * 規則的格式：
 *   { id, name,            省略時用 items 第一個欄位的 id 與名稱
 *     items: [欄位 id],     這條規則看哪些欄位：顯示它們的數值變化，點標題開第一個欄位所在的卡片
 *     pick: function (v, f, q)   回傳目前是 cases 裡的哪一種，都不是就回傳 null。
 *                                v 是生效值、f 是原廠值（{ 欄位 id: 字串 }），q 是 { now, fac }：p.derive 算出來的參數
 *     show: function (v, f, q)   顯示在標題上的數值（省略時列出 items 裡和原廠不同的欄位）
 *     cases: { 名稱: {
 *       say      這種情況的說法（例如「Toe-out 加大」），可以是 function (v, f, q)
 *       fx       [[欄位 id, effect 的條件文字 w], ...]，可以是 function (v, f, q)
 *       theory   "理論項目 id/調整方向 id"：列出原書在那個方向的敘述，並計入上方的方向圖
 *       see      "理論項目 id"：只放連結，不列敘述（方向無法判斷時用）
 *       maybe    格式同 fx：說明書沒寫方向，兩種可能都列出來給使用者對照；不計入方向圖
 *       note     這個網頁補的說明（不是說明書也不是原書的內容）
 *     } } }
 *
 * 方向圖（METERS）只統計原書敘述的 tags，一句算一格。
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var THEORY_PAGE = "theory.html";
  var MAX_CELLS = 8;   // 方向圖一邊最多畫幾格

  // 方向圖：原書敘述的 tags 一句算一格。group 是小標題
  var METERS = [
    { id: "in", name: "入彎", group: "steer", phase: 0 },
    { id: "mid", name: "彎中", group: "steer", phase: 1 },
    { id: "out", name: "出彎", group: "steer", phase: 2 },
    { id: "all", name: "不分段", group: "steer" },
    { id: "fg", name: "前輪抓地", group: "other" },
    { id: "rg", name: "後輪抓地", group: "other" },
    { id: "g", name: "整體抓地", group: "other" },
    { id: "resp", name: "轉向反應", group: "other" },
    { id: "stab", name: "穩定性", group: "other" },
    { id: "brk", name: "煞車穩定", group: "other" },
    { id: "roll", name: "車體滾動", group: "other" }
  ];
  var METER_GROUPS = {
    steer: "轉向：減少是往推頭，增加是往甩尾",
    other: "抓地、反應與車身"
  };
  // 敘述旁邊的小標籤
  var SIGN_NAMES = {
    "in": "入彎轉向", mid: "彎中轉向", out: "出彎轉向", all: "轉向", fg: "前輪抓地", rg: "後輪抓地", g: "抓地",
    resp: "反應", stab: "穩定", brk: "煞車穩定", roll: "滾動"
  };

  var FOOT = "點項目名稱可以直接去調那一項，右邊的「理論」會開設定理論頁對應的項目。每一句都是「只改那一項」時的方向，幾項一起改會互相影響，實際感受還要看場地、輪胎與陀螺儀。" +
    "標「說明書」的是 MST 說明書的原文，「一般原則」是後驅甩尾車通用的調校原則；" +
    "標「XRAY」的是《XRAY 中文設定書》的原文，那本書談的是四驅房車的抓地跑法，甩尾車不一定完全相同。";

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

  function s(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function resolve(x, args) { return typeof x === "function" ? x.apply(null, args) : x; }

  // 「+4.0」和從試算表存回來的「4」視為相同
  function same(a, b) {
    a = String(a).trim();
    b = String(b).trim();
    if (a === b) return true;
    var num = /^[+-]?\d+(\.\d+)?$/;
    return num.test(a) && num.test(b) && parseFloat(a) === parseFloat(b);
  }

  /* ---------- 設定理論頁的資料 ---------- */

  function theoryOption(ref) {
    var T = window.RC_THEORY;
    if (!T || !ref) return null;
    var at = ref.split("/");
    var topic = T.topics.filter(function (tp) { return tp.id === at[0]; })[0];
    if (!topic) return null;
    var option = null;
    (topic.sets || []).forEach(function (set) {
      set.options.forEach(function (op) { if (op.id === at[1]) option = op; });
    });
    return { topic: topic, option: option, href: THEORY_PAGE + "#/" + topic.id + (option ? "/" + option.id : "") };
  }

  /* ---------- 判斷 ---------- */

  // tags 裡有方向的那幾個：[{ id: 方向圖的 id, up: true 是增加 }]
  function signsOf(tags) {
    var out = [];
    tags.forEach(function (tag) {
      var m = /^([a-z]+)([+-])$/.exec(tag);
      if (m && SIGN_NAMES[m[1]]) out.push({ id: m[1], up: m[2] === "+" });
    });
    return out;
  }

  // fmt(it, value)：把值寫成給人看的樣子；沒給就直接用存檔值
  function evaluate(p, eff, fac, fmt) {
    var index = {}, cardOf = {};
    p.groups.forEach(function (grp) {
      grp.items.forEach(function (it) { index[it.id] = { it: it, group: grp.id }; });
    });
    (p.cards || []).forEach(function (card) {
      Object.keys(index).forEach(function (id) {
        var hit = (card.groups || []).indexOf(index[id].group) >= 0 || (card.items || []).indexOf(id) >= 0;
        if (hit && !cardOf[id]) cardOf[id] = card.id;
      });
    });
    function show(it, v) { return fmt ? fmt(it, v) : v; }
    function touched(id) {
      var at = index[id];
      if (!at || at.it.calc) return null;
      var now = eff[id] == null ? "" : eff[id], base = fac[id] == null ? "" : fac[id];
      if (base !== "") return same(now, base) ? null : { name: at.it.name, from: show(at.it, base), to: show(at.it, now) };
      return now === "" ? null : { name: at.it.name, from: "", to: show(at.it, now) };   // 沒有原廠值、自己填的
    }
    // 產品資料檔的 effect：ref 是 [欄位 id, 條件文字]
    function effectOf(ref, problems) {
      var at = index[ref[0]];
      var hit = at && (at.it.effect || []).filter(function (fx) { return fx.w === ref[1]; })[0];
      if (!hit) { problems.push("找不到 effect：" + ref.join(" / ")); return null; }
      return { src: hit.manual ? "m" : "g", when: hit.w, text: hit.t, tags: [], signs: [] };
    }

    var q = p.derive ? { now: p.derive(eff), fac: p.derive(fac) } : { now: {}, fac: {} };
    var args = [eff, fac, q];
    var findings = [], covered = {}, problems = [];

    (p.traits && p.traits.rules || []).forEach(function (rule) {
      var key = rule.pick(eff, fac, q);
      var c = key == null ? null : rule.cases[key];
      if (key != null && !c) problems.push("規則 " + (rule.id || rule.items[0]) + " 沒有 " + key + " 這種情況");
      if (!c) return;

      var first = index[rule.items[0]];
      var th = theoryOption(c.theory || c.see);
      var sts = (resolve(c.fx, args) || []).map(function (ref) { return effectOf(ref, problems); });
      if (c.theory && th && th.option) {
        th.option.fx.forEach(function (f) {
          if (f.none) return;
          sts.push({ src: "x", when: th.option.label, text: f.t, tags: f.tags || [], signs: signsOf(f.tags || []), page: th.topic.pages });
        });
      }
      if (c.theory && window.RC_THEORY && !(th && th.option)) problems.push("找不到理論項目：" + c.theory);
      if (c.see && window.RC_THEORY && !th) problems.push("找不到理論項目：" + c.see);

      var finding = {
        id: rule.id || rule.items[0],
        name: rule.name || (first ? first.it.name : rule.items[0]),
        say: resolve(c.say, args) || "",
        show: rule.show ? rule.show(eff, fac, q) : "",
        changes: rule.items.map(touched).filter(function (x) { return x; }),
        card: first ? cardOf[first.it.id] : null,
        note: c.note || "",
        theory: th,
        sts: sts.filter(function (x) { return x; }),
        maybe: (resolve(c.maybe, args) || []).map(function (ref) { return effectOf(ref, problems); }).filter(function (x) { return x; })
      };
      finding.adjusted = finding.changes.length > 0;   // false：全部是原廠值，講的是原廠配置本身
      rule.items.forEach(function (id) { covered[id] = true; });
      findings.push(finding);
    });

    // 和原廠不同、但沒有任何一條規則講到的欄位
    var loose = [];
    Object.keys(index).forEach(function (id) {
      var at = index[id];
      if (covered[id] || at.it.calc || !fac[id]) return;
      if (!same(eff[id], fac[id])) loose.push(at.it.name);
    });
    return { findings: findings, loose: loose, problems: problems };
  }

  /* ---------- 畫面 ---------- */

  function sourceTag(st) {
    return el("span", { class: "tag " + (st.src === "m" ? "tag-m" : "tag-g"), text: st.src === "m" ? "說明書" : "一般原則" });
  }

  function signChips(st) {
    return st.signs.map(function (sg) {
      return el("span", { class: "tr-chip " + (sg.up ? "is-more" : "is-less"), text: SIGN_NAMES[sg.id] + (sg.up ? " ▲" : " ▼") });
    });
  }

  // 入彎、彎中、出彎的小圖：一個彎分三段，亮的是這一段
  function phaseIcon(phase) {
    var svg = s("svg", { viewBox: "0 0 24 24", class: "tr-phase", "aria-hidden": "true" });
    ["M5 22V14", "M5 14A9 9 0 0 1 14 5", "M14 5H22"].forEach(function (d, i) {
      svg.appendChild(s("path", { d: d, class: i === phase ? "is-on" : "" }));
    });
    return svg;
  }

  function cells(n) {
    var kids = [];
    for (var i = 0; i < Math.min(n, MAX_CELLS); i++) kids.push(el("i", { class: "tr-cell" }));
    return kids;
  }

  // 方向圖：沒有任何一句原書的敘述帶方向時不畫
  function renderMeters(all) {
    var count = {};
    METERS.forEach(function (m) { count[m.id] = { up: 0, down: 0 }; });
    all.forEach(function (st) {
      st.signs.forEach(function (sg) { if (count[sg.id]) count[sg.id][sg.up ? "up" : "down"]++; });
    });
    if (!METERS.some(function (m) { return count[m.id].up || count[m.id].down; })) return null;

    var box = el("div", { class: "tr-box" }, [
      el("p", { class: "tr-box-title", text: "和原廠比，車子往哪邊變" }),
      el("p", { class: "tr-axis" }, [
        el("span", { class: "is-less", text: "◀ 減少" }),
        el("span", { class: "is-more", text: "增加 ▶" })
      ])
    ]);
    Object.keys(METER_GROUPS).forEach(function (group) {
      // 轉向的四列固定都畫，其餘只畫有變化的
      var rows = METERS.filter(function (m) {
        return m.group === group && (group === "steer" || count[m.id].up || count[m.id].down);
      });
      if (!rows.length) return;
      box.appendChild(el("p", { class: "tr-sub", text: METER_GROUPS[group] }));
      rows.forEach(function (m) {
        var c = count[m.id];
        box.appendChild(el("div", {
          class: "tr-m" + (c.up || c.down ? "" : " is-zero"), role: "img",
          "aria-label": m.name + "：增加 " + c.up + " 句，減少 " + c.down + " 句"
        }, [
          el("span", { class: "tr-m-name" }, [m.phase != null ? phaseIcon(m.phase) : null, el("span", { text: m.name })]),
          el("span", { class: "tr-m-bar" }, [
            el("span", { class: "tr-m-less" }, cells(c.down)),
            el("span", { class: "tr-m-more" }, cells(c.up))
          ]),
          el("span", { class: "tr-m-num", text: c.up || c.down ? "▼" + c.down + " ▲" + c.up : "—" })
        ]));
      });
    });
    box.appendChild(el("p", { class: "tr-box-note", text: "一格是《XRAY 中文設定書》的一句敘述，只看得出方向，看不出幅度。" }));
    return box;
  }

  // 敘述一句一行。withWhen：前面加上條件文字（一項裡有好幾個條件，或兩種可能並列時才需要）
  function lines(sts, withWhen, cls) {
    return el("ul", { class: "tr-lines" + (cls ? " " + cls : "") }, sts.map(function (st) {
      return el("li", {}, [
        withWhen ? el("span", { class: "tr-line-when", text: st.when + "：" }) : null,
        el("span", { text: st.text })
      ].concat(signChips(st), st.src === "x" ? [] : [sourceTag(st)]));
    }));
  }

  // 一項：一行標題（名稱、往哪邊調、數值），下面直接列敘述。點標題開那一項所在的卡片，右邊的「理論」連到設定理論頁
  function renderFinding(f, api) {
    var values = f.show;
    if (!values) {
      values = f.changes.map(function (c) {
        var range = (c.from ? c.from + " → " : "") + c.to;
        return f.changes.length === 1 && c.name === f.name ? range : c.name + " " + range;   // 名稱和標題一樣就不重複
      }).join("、");
    } else if (f.changes.length) {
      values += "（改了" + f.changes.map(function (c) { return c.name; }).join("、") + "）";
    }
    var head = [
      el("span", { class: "tr-item-name", text: f.name }),
      f.say ? el("span", { class: "tr-item-say", text: f.say }) : null,
      values ? el("span", { class: "tr-item-val", text: values }) : null
    ];
    var own = f.sts.filter(function (st) { return st.src !== "x"; });
    var book = f.sts.filter(function (st) { return st.src === "x"; });
    return el("li", { class: "tr-item" + (f.adjusted ? " is-adjusted" : "") }, [
      el("div", { class: "tr-item-head" }, [
        f.card && api.open
          ? el("button", { type: "button", class: "tr-item-open", "aria-label": "調整：" + f.name, onclick: function () { api.open(f.card); } }, head)
          : el("p", { class: "tr-item-open" }, head),
        f.theory ? el("a", { class: "tr-item-theory", href: f.theory.href, "aria-label": "看理論：" + f.theory.topic.name, text: "理論" }) : null
      ]),
      own.length ? lines(own, own.length > 1) : null,
      book.length ? el("p", { class: "tr-src", text: "XRAY p." + book[0].page + "｜" + book[0].when }) : null,
      book.length ? lines(book, false) : null,
      f.maybe.length ? el("p", { class: "tr-item-note", text: "方向要自己對照，可能是下面其中一種：" }) : null,
      f.maybe.length ? lines(f.maybe, true, "is-maybe") : null,
      f.note ? el("p", { class: "tr-item-note", text: f.note }) : null
    ]);
  }

  function renderList(res, api) {
    var adjusted = res.findings.filter(function (f) { return f.adjusted; });
    var stock = res.findings.filter(function (f) { return !f.adjusted; });
    var kids = [];
    function block(title, list) {
      if (!list.length) return;
      // 兩種都有時才需要小標題分開
      if (adjusted.length && stock.length) kids.push(el("h4", { class: "tr-list-title", text: title }));
      kids.push(el("ul", { class: "tr-list" }, list.map(function (f) { return renderFinding(f, api); })));
    }
    block("已調整的項目", adjusted);
    block("原廠配置本身的特性", stock);
    if (res.loose.length) {
      kids.push(el("p", { class: "tr-item-note", text: "另外有 " + res.loose.length + " 項也和原廠不同，沒有對應的特性說明：" + res.loose.join("、") }));
    }
    return el("div", { class: "tr-all" }, kids);
  }

  function render(p, api) {
    var res = evaluate(p, api.values(), api.factory(), api.pretty);
    res.problems.forEach(function (text) { console.warn("車輛特性：" + text); });
    var all = [];
    res.findings.forEach(function (f) { all = all.concat(f.sts); });
    var adjusted = res.findings.some(function (f) { return f.adjusted; });
    var lead = adjusted
      ? "依目前的設定，把車子的特性全部列在下面：和原廠不同的每一項往哪邊調、車子會怎麼變。"
      : "目前全部是原廠值，下面列的是原廠配置本身的特性。調整任何一項，這裡會跟著列出車子往哪邊變。";
    return el("section", { class: "tr", "aria-label": "車輛特性" }, [
      el("h3", { class: "group-name", text: "車輛特性" }),
      el("p", { class: "tr-lead", text: lead }),
      renderMeters(all),
      res.findings.length || res.loose.length ? renderList(res, api) : null,
      el("p", { class: "tr-foot", text: FOOT })
    ]);
  }

  (window.RC_PLUGINS = window.RC_PLUGINS || []).push({
    overview: function (p, target, api) { return p.traits ? render(p, api) : null; }
  });

  // 給測試與除錯用
  window.RCTraits = { evaluate: evaluate };
})();
