/*
 * 車輛特性：總覽頁下方的一份總覽，把「目前的設定」換成「車子會怎樣」，全部直接寫出來。
 * 掛在 app.js 的 RC_PLUGINS 掛點（overview）上，要在 app.js 之前載入。產品有 p.traits 才會出現。
 *
 * 做法：p.traits.rules 的每條規則看一個或幾個欄位，判斷現在是哪一種情況（選了哪個選項、在基準的哪一邊、
 * 和原廠比變大還是變小），再列出那種情況下的敘述。敘述有三個來源，畫面上都標出來：
 *   說明書     產品資料檔的 effect 裡 m() 的那幾筆
 *   一般原則   產品資料檔的 effect 裡 g() 的那幾筆
 *   XRAY       data/theory-xray.js（設定理論頁的資料）裡對應的調整方向。index.html 沒載入它時就只列前兩種
 * 這裡不自己寫特性的敘述，只負責挑出適用的那幾句。
 *
 * 畫面（使用者 2026-10-13 的指示，依時間順序）：
 *   - 一條規則一段，全部攤開，不用點就看得到；不要再依入彎、加油門這類大項目分成一格一格去點
 *     （第一版那樣做，使用者看了說「不要這樣分類，把整體的特性全部寫出來，我只是要總覽」）
 *   - 「就算是原廠設定，也要總結出車輛目前的特性」；「彈簧、阻尼油、差速的特性，如果沒有，可以查設定理論」。
 *     所以全部原廠值時也要有內容：有明確基準的設定直接寫目前的特性，看不出偏向的用 both 把兩邊都列出來
 *
 * 規則的格式：
 *   { id, name,            省略時用 items 第一個欄位的 id 與名稱
 *     items: [欄位 id],     這條規則看哪些欄位；點標題開第一個欄位所在的卡片。有欄位和原廠不同（或自己填了沒有
 *                          原廠值的欄位）就算「已調整」，否則算原廠配置
 *     pick: function (v, f, q)   回傳目前是 cases 裡的哪一種，都不是就回傳 null。
 *                                v 是生效值、f 是原廠值（{ 欄位 id: 字串 }），q 是 { now, fac }：p.derive 算出來的參數
 *     show: function (v, f, q)   顯示在標題上的數值（省略時列出 items 裡和原廠不同的欄位）
 *     names: true          show 後面再附上改了哪些欄位（好幾個欄位合成一個推算值時用）
 *     cases: { 名稱: {
 *       say      這種情況的說法（例如「Toe-out，比原廠大」），可以是 function (v, f, q)
 *       fx       [[欄位 id, effect 的條件文字 w], ...]，可以是 function (v, f, q)。每筆可以有第三個元素：
 *                一項列出好幾句時寫在句子前面的標題（省略就用 w）
 *       theory   "理論項目 id/調整方向 id"：列出原書在那個方向的敘述，並計入上方的傾向圖。可以是陣列，
 *                項目也可以寫成 { ref, why }（why 會寫在那一組的標題前，例如「比原廠小」）。
 *                同一個方向出現兩次（目前的狀態和「比原廠再多調」是同一邊）只列一次，在傾向圖算兩格
 *       both     [{ label, fx, theory }, ...]：看不出目前偏哪一邊時，把往兩邊調的影響都列出來當參考；
 *                不計入傾向圖
 *       see      "理論項目 id"：只放連結，不列敘述
 *       maybe    格式同 fx：說明書沒寫方向，兩種可能都列出來給使用者對照；不計入傾向圖
 *       note     這個網頁補的說明（不是說明書也不是原書的內容）
 *     } } }
 *
 * 傾向圖（METERS）只統計原書敘述的 tags，一句算一格。
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var THEORY_PAGE = "theory.html";
  var MAX_CELLS = 8;   // 傾向圖一邊最多畫幾格

  // 傾向圖：原書敘述的 tags 一句算一格。group 是小標題
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

  var FOOT = "點項目名稱可以直接去調那一項，右邊的「理論」會開設定理論頁對應的項目。每一句都是「只看那一項」時的方向，幾項加在一起會互相影響，實際感受還要看場地、輪胎與陀螺儀。" +
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

  // tags 裡有方向的那幾個：[{ id: 傾向圖的 id, up: true 是增加 }]
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
    var problems = [];
    function show(it, v) { return fmt ? fmt(it, v) : v; }
    function touched(id) {
      var at = index[id];
      if (!at || at.it.calc) return null;
      var now = eff[id] == null ? "" : eff[id], base = fac[id] == null ? "" : fac[id];
      if (base !== "") return same(now, base) ? null : { name: at.it.name, from: show(at.it, base), to: show(at.it, now) };
      return now === "" ? null : { name: at.it.name, from: "", to: show(at.it, now) };   // 沒有原廠值、自己填的
    }
    // 產品資料檔的 effect：refs 是 [[欄位 id, 條件文字, 顯示用的標題（可省略）], ...]，重複的只留第一筆
    function effects(refs) {
      var seen = {}, out = [];
      (refs || []).forEach(function (ref) {
        var key = ref[0] + "|" + ref[1];
        if (seen[key]) return;
        seen[key] = true;
        var at = index[ref[0]];
        var hit = at && (at.it.effect || []).filter(function (fx) { return fx.w === ref[1]; })[0];
        if (!hit) { problems.push("找不到 effect：" + ref[0] + " / " + ref[1]); return; }
        out.push({ src: hit.manual ? "m" : "g", when: ref[2] || hit.w, text: hit.t, tags: [], signs: [], weight: 1 });
      });
      return out;
    }
    // 設定理論的某個調整方向：回傳 { th, sts }，找不到回傳 null
    function book(ref, weight) {
      var th = theoryOption(ref);
      if (!(th && th.option)) {
        if (window.RC_THEORY) problems.push("找不到理論項目：" + ref);
        return null;
      }
      return {
        th: th,
        sts: th.option.fx.filter(function (f) { return !f.none; }).map(function (f) {
          return { src: "x", when: th.option.label, text: f.t, tags: f.tags || [], signs: signsOf(f.tags || []), page: th.topic.pages, weight: weight };
        })
      };
    }

    var q = p.derive ? { now: p.derive(eff), fac: p.derive(fac) } : { now: {}, fac: {} };
    var args = [eff, fac, q];
    var findings = [], covered = {};

    (p.traits && p.traits.rules || []).forEach(function (rule) {
      var key = rule.pick(eff, fac, q);
      var c = key == null ? null : rule.cases[key];
      if (key != null && !c) problems.push("規則 " + (rule.id || rule.items[0]) + " 沒有 " + key + " 這種情況");
      if (!c) return;

      // 原書的敘述：同一個方向出現兩次就合成一組、算兩格
      var wanted = [];
      [].concat(resolve(c.theory, args) || []).forEach(function (r) {
        r = typeof r === "string" ? { ref: r } : r;
        var hit = wanted.filter(function (w) { return w.ref === r.ref; })[0];
        if (hit) hit.weight++;
        else wanted.push({ ref: r.ref, why: r.why || "", weight: 1 });
      });
      var blocks = [];
      wanted.forEach(function (w) {
        var b = book(w.ref, w.weight);
        if (b) blocks.push({ th: b.th, why: w.why, sts: b.sts });
      });
      // 往兩邊調的參考
      var both = (c.both || []).map(function (d) {
        var b = d.theory ? book(d.theory, 0) : null;
        return { label: d.label, own: effects(resolve(d.fx, args)), th: b && b.th, sts: b ? b.sts : [] };
      });
      var see = c.see ? theoryOption(c.see) : null;
      if (c.see && window.RC_THEORY && !see) problems.push("找不到理論項目：" + c.see);
      var topic = blocks.length ? blocks[0].th : (both.filter(function (d) { return d.th; })[0] || {}).th;

      var first = index[rule.items[0]];
      var finding = {
        id: rule.id || rule.items[0],
        name: rule.name || (first ? first.it.name : rule.items[0]),
        say: resolve(c.say, args) || "",
        show: rule.show ? rule.show(eff, fac, q) : "",
        names: !!rule.names,
        changes: rule.items.map(touched).filter(function (x) { return x; }),
        card: first ? cardOf[first.it.id] : null,
        note: resolve(c.note, args) || "",
        own: effects(resolve(c.fx, args)),
        blocks: blocks,
        both: both,
        maybe: effects(resolve(c.maybe, args)),
        // 「理論」連到哪裡：有列出敘述就連到那個方向，兩邊都列或只是參考就連到項目本身
        href: blocks.length ? blocks[0].th.href : topic ? THEORY_PAGE + "#/" + topic.topic.id : see ? see.href : "",
        topicName: topic ? topic.topic.name : see ? see.topic.name : ""
      };
      finding.sts = finding.own.slice();   // 確定適用的敘述（傾向圖只算這些）
      blocks.forEach(function (b) { finding.sts = finding.sts.concat(b.sts); });
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

  // 傾向圖：沒有任何一句原書的敘述帶方向時不畫
  function renderMeters(all) {
    var count = {};
    METERS.forEach(function (m) { count[m.id] = { up: 0, down: 0 }; });
    all.forEach(function (st) {
      st.signs.forEach(function (sg) { if (count[sg.id]) count[sg.id][sg.up ? "up" : "down"] += st.weight; });
    });
    if (!METERS.some(function (m) { return count[m.id].up || count[m.id].down; })) return null;

    var box = el("div", { class: "tr-box" }, [
      el("p", { class: "tr-box-title", text: "車子目前的傾向" }),
      el("p", { class: "tr-axis" }, [
        el("span", { class: "is-less", text: "◀ 減少" }),
        el("span", { class: "is-more", text: "增加 ▶" })
      ])
    ]);
    Object.keys(METER_GROUPS).forEach(function (group) {
      // 轉向的四列固定都畫，其餘只畫有內容的
      var rows = METERS.filter(function (m) {
        return m.group === group && (group === "steer" || count[m.id].up || count[m.id].down);
      });
      if (!rows.length) return;
      box.appendChild(el("p", { class: "tr-sub", text: METER_GROUPS[group] }));
      rows.forEach(function (m) {
        var c = count[m.id];
        box.appendChild(el("div", {
          class: "tr-m" + (c.up || c.down ? "" : " is-zero"), role: "img",
          "aria-label": m.name + "：增加 " + c.up + " 格，減少 " + c.down + " 格"
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
    box.appendChild(el("p", { class: "tr-box-note", text: "一格是《XRAY 中文設定書》的一句敘述，比原廠再往同一邊調的算兩格。只看得出方向，看不出幅度。" }));
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

  // 往某一邊調的參考：這個網站自己的說明一句一行，原書的幾句接成一行（只是參考，不必逐句標方向）
  function direction(d) {
    var rows = d.own.map(function (st) {
      return el("li", {}, [el("span", { text: st.text }), sourceTag(st)]);
    });
    if (d.sts.length) {
      rows.push(el("li", {}, [
        el("span", { class: "tr-line-src", text: "XRAY p." + d.sts[0].page + "：" }),
        el("span", { text: d.sts.map(function (st) { return st.text; }).join("；") })
      ]));
    }
    return [el("p", { class: "tr-both", text: d.label }), el("ul", { class: "tr-lines is-ref" }, rows)];
  }

  // 一項：一行標題（名稱、目前的情況、數值），下面直接列敘述。點標題開那一項所在的卡片，右邊的「理論」連到設定理論頁
  function renderFinding(f, api) {
    var values = f.show;
    if (!values) {
      values = f.changes.map(function (c) {
        var range = (c.from ? c.from + " → " : "") + c.to;
        return f.changes.length === 1 && c.name === f.name ? range : c.name + " " + range;   // 名稱和標題一樣就不重複
      }).join("、");
    } else if (f.names && f.changes.length) {
      values += "（改了" + f.changes.map(function (c) { return c.name; }).join("、") + "）";
    }
    var head = [
      el("span", { class: "tr-item-name", text: f.name }),
      f.say ? el("span", { class: "tr-item-say", text: f.say }) : null,
      values ? el("span", { class: "tr-item-val", text: values }) : null
    ];
    var kids = [
      el("div", { class: "tr-item-head" }, [
        f.card && api.open
          ? el("button", { type: "button", class: "tr-item-open", "aria-label": "調整：" + f.name, onclick: function () { api.open(f.card); } }, head)
          : el("p", { class: "tr-item-open" }, head),
        f.href ? el("a", { class: "tr-item-theory", href: f.href, "aria-label": "看理論：" + f.topicName, text: "理論" }) : null
      ]),
      f.own.length ? lines(f.own, f.own.length > 1) : null
    ];
    f.blocks.forEach(function (b) {
      if (!b.sts.length) return;
      kids.push(el("p", { class: "tr-src", text: "XRAY p." + b.sts[0].page + "｜" + (b.why ? b.why + "：" : "") + b.sts[0].when }));
      kids.push(lines(b.sts, false));
    });
    // 兩邊都列的時候，說明放在前面：先講為什麼沒有判斷偏向，再列兩邊
    if (f.note && f.both.length) kids.push(el("p", { class: "tr-item-note", text: f.note }));
    f.both.forEach(function (d) { kids = kids.concat(direction(d)); });
    if (f.maybe.length) {
      kids.push(el("p", { class: "tr-item-note", text: "方向要自己對照，可能是下面其中一種：" }));
      kids.push(lines(f.maybe, true, "is-ref"));
    }
    if (f.note && !f.both.length) kids.push(el("p", { class: "tr-item-note", text: f.note }));
    return el("li", { class: "tr-item" + (f.adjusted ? " is-adjusted" : "") }, kids);
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
    block("維持原廠的項目", stock);
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
      ? "依目前的設定，把車子的特性全部列在下面。橘色是和原廠不同的項目。"
      : "目前全部是原廠值，下面是原廠設定的特性。調整任何一項，這裡會跟著變。";
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
