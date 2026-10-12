/*
 * 設定理論頁：以車為中心的查詢頁。資料在 data/theory-xray.js，圖在 js/theory-diagram.js。
 * 和設定記錄頁一樣不用 ES module 與 fetch，手機直接開本機檔案（file://）也能跑。
 *
 * 畫面分兩層：總覽頁是車的俯視圖，各個設定項目圍在四周；點項目進內容頁，上方釘著示意圖，
 * 點不同的調整方向，圖跟著換。
 * 查詢有兩種：選症狀（例如入彎轉向不足）或打關鍵字。符合的項目會亮起來並標出調整方向，
 * 車圖上對應的部位也會標色，詳細的原書敘述列在車圖下方。
 * 網址 # 後面是「項目 id/調整方向 id」，瀏覽器的返回鍵可以回總覽。
 */
(function () {
  "use strict";

  var T = window.RC_THEORY;
  var Diagram = window.RCTheoryDiagram;   // 沒載入 theory-diagram.js 時頁面照常運作，只是沒有圖
  var app = document.getElementById("app");
  if (!T) { app.textContent = "找不到資料檔 data/theory-xray.js。"; return; }

  var CALC_KEY = "rc_car_theory:calc";
  // 資料檔的 source.localOnly 是 true 時，表示原書的 PDF 沒有放進 repo、只有直接開本機檔案時才連得到；
  // 那種情況下放在網站上不顯示連結，免得點了是找不到的頁面
  var HAS_PDF = !T.source.localOnly || location.protocol === "file:";
  var PHASES = { "in": "入彎", mid: "彎中", out: "出彎" };
  var SLOTS = {
    top: ["t1", "t2", "t3", "t4", "t5", "t6"],
    left: ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10"],
    right: ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"],
    bottom: ["b1", "b2", "b3"]
  };
  // Rollout 計算的起始值：前三項是設定記錄裡 MST RMX 4 GT 的原廠值，胎徑是暫填的數字
  var CALC_FIELDS = [
    { id: "spur", name: "大齒盤", unit: "T", step: 1, min: 1, digits: 0, start: 80 },
    { id: "pinion", name: "馬達齒", unit: "T", step: 1, min: 1, digits: 0, start: 22 },
    { id: "internal", name: "內齒比", unit: "", step: 0.1, min: 0.1, digits: 2, start: 3 },
    { id: "tire", name: "胎徑", unit: "mm", step: 0.5, min: 1, digits: 1, start: 64 }
  ];

  var view = { goal: null, q: "", panel: false, mapScroll: 0, fromMap: false };
  var mapUi = null;   // 總覽頁目前的節點。查詢條件改變時只更新這些，不整頁重畫，輸入框才不會失焦

  var goalIndex = {};
  T.goals.forEach(function (grp) { grp.items.forEach(function (g) { goalIndex[g.id] = g; }); });

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

  function merge() {
    var out = {};
    Array.prototype.forEach.call(arguments, function (src) {
      Object.keys(src || {}).forEach(function (k) { out[k] = src[k]; });
    });
    return out;
  }

  function joined(list) { return list.filter(Boolean).join(" ").toLowerCase(); }

  function topicById(id) {
    return T.topics.filter(function (t) { return t.id === id; })[0] || null;
  }

  function eachOption(tp, fn) {
    (tp.sets || []).forEach(function (set) {
      set.options.forEach(function (op) { fn(op, set); });
    });
  }

  // 沒給 id 時回傳第一個調整方向
  function findOption(tp, id) {
    var found = null;
    eachOption(tp, function (op, set) {
      if (!found && !set.plain && (!id || op.id === id)) found = op;
    });
    return found;
  }

  function phasesOf(f) {
    var out = [];
    f.tags.forEach(function (tag) {
      var m = /^@?(in|mid|out)[+-]?$/.exec(tag);
      if (m && out.indexOf(m[1]) < 0) out.push(m[1]);
    });
    return out;
  }

  function matchesGoal(f, goal) {
    if (!goal) return "";
    if (f.tags.indexOf(goal.id) >= 0) return "strong";
    if (goal.also && f.tags.indexOf(goal.also) >= 0) return "weak";
    return "";
  }

  // 一個項目裡所有看得到的文字，關鍵字搜尋用
  function textOf(tp) {
    if (tp.searchText) return tp.searchText;
    var parts = [tp.name, tp.title, tp.intro, tp.line].concat(tp.keys || [], tp.notes || []);
    (tp.how || []).forEach(function (h) {
      parts = parts.concat([h.title], h.prep || [], h.tools || [], h.steps || []);
    });
    (tp.sets || []).forEach(function (set) { parts.push(set.title, set.text); });
    eachOption(tp, function (op) {
      parts = parts.concat([op.label, op.sub, op.use], op.how || [], op.fx.map(function (f) { return f.t; }));
    });
    if (tp.table) tp.table.rows.forEach(function (row) { parts = parts.concat(row); });
    tp.searchText = joined(parts);
    return tp.searchText;
  }

  /* ---------- 換頁 ---------- */

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, "");
    try { raw = decodeURIComponent(raw); } catch (e) { /* 解不開就照原樣用 */ }
    var parts = raw.split("/");
    return { topic: parts[0] || "", option: parts[1] || "" };
  }

  function hashOf(topicId, optionId) {
    return "#/" + topicId + (optionId ? "/" + optionId : "");
  }

  // 由總覽頁進內容頁：多一筆瀏覽紀錄，返回鍵可以回總覽
  function go(topicId, optionId) {
    view.mapScroll = window.scrollY;
    view.fromMap = true;
    location.hash = hashOf(topicId, optionId);
  }

  // 內容頁之間互跳：取代目前這一筆，返回鍵仍然回總覽
  function jump(topicId, optionId) {
    location.replace(hashOf(topicId, optionId));
  }

  function back() {
    if (view.fromMap) history.back();
    else location.hash = "#/";
  }

  /* ---------- 查詢 ---------- */

  // 依目前的症狀與關鍵字，找出符合的「項目 + 調整方向」。
  // strong：tags 直接符合；weak：轉向類的症狀下，原書沒有指明入彎、彎中或出彎的敘述
  function compute() {
    var goal = view.goal ? goalIndex[view.goal] : null;
    var q = view.q.trim().toLowerCase();
    var m = { active: !!(goal || q), goal: goal, q: q, groups: [], loose: [], by: {} };
    if (!m.active) return m;

    T.topics.forEach(function (tp) {
      var hit = { strong: [], weak: [] };
      eachOption(tp, function (op) {
        var rows = { strong: [], weak: [] };
        op.fx.forEach(function (f) {
          var kind = goal ? matchesGoal(f, goal) : "strong";
          if (!kind) return;
          if (q) {
            // 已經選了症狀時，關鍵字也可以比對項目名稱（例如「彈簧」）；只有關鍵字時只比對敘述本身
            var hay = goal ? joined([f.t, op.label, op.sub, tp.title, tp.name]) : joined([f.t, op.label, op.sub]);
            if (hay.indexOf(q) < 0) return;
          }
          rows[kind].push(f);
        });
        ["strong", "weak"].forEach(function (kind) {
          if (!rows[kind].length) return;
          m.groups.push({ topic: tp, option: op, fx: rows[kind], weak: kind === "weak" });
          hit[kind].push(op);
        });
      });
      if (hit.strong.length || hit.weak.length) m.by[tp.id] = hit;
      else if (!goal && q && textOf(tp).indexOf(q) >= 0) { m.loose.push(tp); m.by[tp.id] = hit; }
    });
    return m;
  }

  function setHot(parts) {
    if (!mapUi || !mapUi.car) return;
    Array.prototype.forEach.call(mapUi.car.querySelectorAll("[data-part]"), function (n) {
      n.classList.toggle("is-hot", parts.indexOf(n.getAttribute("data-part")) >= 0);
    });
  }

  function setGoal(id) {
    view.goal = view.goal === id ? null : id;
    if (view.goal) view.panel = false;   // 選好就收起來，把畫面讓給車圖
    refresh();
  }

  // 查詢條件改變後更新總覽頁：項目鈕、車圖、結果清單
  function refresh() {
    if (!mapUi) return;
    var m = compute(), hot = [];

    T.topics.forEach(function (tp) {
      var ui = mapUi.chips[tp.id];
      if (!ui) return;
      var hit = m.by[tp.id];
      var ops = hit ? (hit.strong.length ? hit.strong : hit.weak) : [];
      var shorts = [];
      ops.forEach(function (op) { if (op.short && shorts.indexOf(op.short) < 0) shorts.push(op.short); });
      ui.btn.classList.toggle("is-hit", !!hit);
      ui.btn.classList.toggle("is-dim", m.active && !hit);
      // 兩個方向都符合時上下疊著放，側邊的項目鈕才放得下
      ui.dir.textContent = "";
      shorts.slice(0, 2).forEach(function (text) { ui.dir.appendChild(el("span", { class: "th-chip-tag", text: text })); });
      ui.dir.hidden = !shorts.length;
      ui.dir.classList.toggle("is-two", shorts.length > 1);
      ui.dir.classList.toggle("is-weak", !!hit && !hit.strong.length);
      ui.option = ops.length ? ops[0].id : "";
      if (hit && tp.hot) hot = hot.concat(tp.hot);
    });
    mapUi.baseHot = hot;
    setHot(hot);

    mapUi.panel.hidden = !view.panel;
    mapUi.goalBtn.setAttribute("aria-expanded", view.panel ? "true" : "false");
    Object.keys(mapUi.goalBtns).forEach(function (id) {
      mapUi.goalBtns[id].classList.toggle("is-on", id === view.goal);
      mapUi.goalBtns[id].setAttribute("aria-pressed", id === view.goal ? "true" : "false");
    });
    renderNow(m);
    renderResults(m);
  }

  /* ---------- 總覽頁 ---------- */

  function goalTitle(g) {
    return g.also ? g.full + " → " + g.want : g.want;
  }

  function renderNow(m) {
    var box = mapUi.now;
    box.textContent = "";
    box.hidden = !m.goal;
    if (!m.goal) return;
    var strong = m.groups.filter(function (g) { return !g.weak; }).length;
    var weak = m.groups.length - strong;
    box.appendChild(el("span", { class: "th-now-text" }, [
      el("b", { text: goalTitle(m.goal) }),
      el("span", { text: "　" + strong + " 個調整方向" + (weak ? "，另有 " + weak + " 個沒指明時機" : "") })
    ]));
    box.appendChild(el("button", { type: "button", class: "btn-small", text: "清除", onclick: function () { setGoal(view.goal); } }));
  }

  function resultList(groups) {
    return el("ul", { class: "th-res-list" }, groups.map(function (g) {
      return el("li", {}, [
        el("button", {
          type: "button", class: "th-res", "data-zone": g.topic.zone,
          onclick: function () { go(g.topic.id, g.option.id); }
        }, [
          el("span", { class: "th-res-head" }, [
            el("span", { class: "th-res-opt", text: g.option.label }),
            el("span", { class: "th-res-where", text: g.topic.name + "・第 " + g.topic.pages + " 頁" })
          ])
        ].concat(g.fx.map(function (f) {
          return el("span", { class: "th-res-fx" }, [
            el("span", { text: f.t }),
            f.gen ? el("span", { class: "tag tag-g", text: "不分前後" }) : null
          ]);
        })))
      ]);
    }));
  }

  function topicCards(list) {
    return el("div", { class: "card-grid" }, list.map(function (tp) {
      return el("button", { type: "button", class: "card-btn", onclick: function () { go(tp.id); } }, [
        el("span", { class: "card-name", text: tp.name }),
        el("span", { class: "card-line", text: tp.line || tp.title })
      ]);
    }));
  }

  function renderResults(m) {
    var box = mapUi.results;
    box.textContent = "";
    if (!m.active) {
      box.appendChild(el("h2", { class: "group-name th-h", text: "基礎觀念" }));
      box.appendChild(topicCards(T.topics.filter(function (tp) { return tp.basic; })));
      return;
    }

    var strong = m.groups.filter(function (g) { return !g.weak; });
    var weak = m.groups.filter(function (g) { return g.weak; });
    box.appendChild(el("h2", { class: "group-name th-h", text: m.goal ? m.goal.want + "：原書提到的調整" : "「" + view.q.trim() + "」的搜尋結果" }));
    if (!m.groups.length && !m.loose.length) {
      box.appendChild(el("p", { class: "hint", text: m.goal && m.q ? "這個症狀底下沒有符合「" + view.q.trim() + "」的敘述。" : "原書沒有提到符合的內容。" }));
    }
    if (strong.length) box.appendChild(resultList(strong));
    if (weak.length) {
      box.appendChild(el("h3", { class: "group-name", text: "原書沒有指明入彎、彎中或出彎" }));
      box.appendChild(resultList(weak));
    }
    if (m.loose.length) {
      box.appendChild(el("h3", { class: "group-name", text: "內文提到「" + view.q.trim() + "」的項目" }));
      box.appendChild(topicCards(m.loose));
    }
    if (m.goal && m.goal.see) {
      box.appendChild(el("p", { class: "th-also" }, [el("span", { text: "也可以查：" })].concat(m.goal.see.map(function (id) {
        return el("button", { type: "button", class: "th-goal", text: goalIndex[id].want, onclick: function () { setGoal(id); } });
      }))));
    }
    if (m.groups.length) {
      box.appendChild(el("p", { class: "hint", text: "這份清單是原書敘述的索引，每一句都是原書的說法。點進去看完整的說明與示意圖；所有設定都會互相影響，一次改一項。" }));
    }
  }

  function renderGoalPanel(goalBtns) {
    var rows = T.goals.map(function (grp) {
      return el("div", { class: "th-goalrow" }, [el("span", { class: "th-goalrow-name", text: grp.row })].concat(
        grp.items.map(function (g) {
          var b = el("button", { type: "button", class: "th-goal", title: g.want, text: g.name, onclick: function () { setGoal(g.id); } });
          goalBtns[g.id] = b;
          return b;
        })
      ));
    });
    rows.push(el("p", { class: "hint", text: T.phaseNote }));
    return el("div", { class: "th-panel", id: "th-panel" }, rows);
  }

  function renderSource() {
    var src = T.source;
    return el("div", {}, [
      el("details", { class: "fold" }, [
        el("summary", { text: "資料來源" }),
        el("ul", { class: "manuals" }, [
          el("li", {}, [
            HAS_PDF
              ? el("a", { href: encodeURI(src.file), target: "_blank", rel: "noopener", text: "《" + src.title + "》PDF" })
              : el("b", { text: "《" + src.title + "》" }),
            el("span", { class: "manual-note", text: "原著：" + src.original + "；翻譯：" + src.translator + "。" + src.detail + (HAS_PDF ? "" : "。這份 PDF 沒有放在網站上") })
          ]),
          el("li", { text: src.scope + "這一頁的內容都依這份 PDF 整理，標示的頁碼是 PDF 的頁碼。" })
        ].concat(T.editorNotes.map(function (n) { return el("li", { text: "整理註：" + n }); })))
      ]),
      el("details", { class: "fold" }, [
        el("summary", { text: "原書疑似誤植的地方" }),
        el("ul", { class: "fold-list" }, T.errata.map(function (n) { return el("li", { text: n }); }))
      ])
    ]);
  }

  function renderMap() {
    var chips = {}, goalBtns = {};
    var car = Diagram ? Diagram.map() : null;

    function chip(slot) {
      var tp = T.topics.filter(function (t) { return t.slot === slot; })[0];
      if (!tp) return el("span", {});   // 空位，維持格線
      var dir = el("span", { class: "th-chip-dir", hidden: "" });
      function lit() { setHot(tp.hot || []); }
      function unlit() { setHot(mapUi ? mapUi.baseHot : []); }
      var btn = el("button", {
        type: "button", class: "th-chip", "data-zone": tp.zone, title: tp.title,
        onclick: function () { go(tp.id, chips[tp.id].option); },
        onmouseenter: lit, onmouseleave: unlit, onfocus: lit, onblur: unlit
      }, [el("span", { class: "th-chip-name", text: tp.name }), dir]);
      chips[tp.id] = { btn: btn, dir: dir, option: "" };
      return btn;
    }

    var q = el("input", {
      type: "search", class: "th-q", placeholder: "搜尋：翻車、顛簸…", "aria-label": "搜尋設定理論",
      value: view.q, autocomplete: "off",
      oninput: function () { view.q = q.value; refresh(); }
    });
    var goalBtn = el("button", {
      type: "button", class: "btn th-goalbtn", "aria-controls": "th-panel", text: "症狀查詢",
      onclick: function () { view.panel = !view.panel; refresh(); }
    });
    var panel = renderGoalPanel(goalBtns);
    var now = el("div", { class: "th-now", role: "status", "aria-live": "polite", hidden: "" });
    var results = el("div", { class: "th-results" });

    var node = el("div", {}, [
      el("div", { class: "th-find" }, [q, goalBtn]),
      panel,
      now,
      el("div", { class: "stage th-stage" }, [
        el("div", { class: "th-row" }, SLOTS.top.map(chip)),
        el("div", { class: "stage-mid" }, [
          el("div", { class: "stage-col" }, SLOTS.left.map(chip)),
          el("div", { class: "stage-car" }, [el("div", { class: "dg-box" }, [car])]),
          el("div", { class: "stage-col" }, SLOTS.right.map(chip))
        ]),
        el("div", { class: "th-row" }, SLOTS.bottom.map(chip))
      ]),
      el("p", { class: "th-legend" }, [
        el("span", { class: "th-key", "data-zone": "front", text: "前軸" }),
        el("span", { class: "th-key", "data-zone": "mid", text: "車身與全車" }),
        el("span", { class: "th-key", "data-zone": "rear", text: "後軸" }),
        el("span", { text: "點項目看理論與調整方向" })
      ]),
      results,
      renderSource()
    ]);

    mapUi = { chips: chips, car: car, panel: panel, goalBtn: goalBtn, goalBtns: goalBtns, now: now, results: results, baseHot: [] };
    return node;
  }

  /* ---------- Rollout 計算 ---------- */

  function loadCalc() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(CALC_KEY)) || {}; }
    catch (e) { /* 讀不到就用起始值 */ }
    var out = {};
    CALC_FIELDS.forEach(function (f) {
      var v = parseFloat(saved[f.id]);
      out[f.id] = isFinite(v) && v >= f.min ? v : f.start;
    });
    return out;
  }

  function saveCalc(calc) {
    // 無痕模式等情況可能寫不進去，這次開著的頁面仍然有效
    try { localStorage.setItem(CALC_KEY, JSON.stringify(calc)); }
    catch (e) { /* ignore */ }
  }

  // 公式照原書第 44 頁，圓周率用 3.14
  function calcParams(calc) {
    var fdr = calc.spur / calc.pinion * calc.internal;
    return { spur: calc.spur, pinion: calc.pinion, fdr: fdr, rollout: calc.tire * 3.14 / fdr };
  }

  function renderCalc(calc, changed) {
    var inputs = {};
    var outFdr = el("span", { class: "calc" }), outRoll = el("span", { class: "calc" }), outTurn = el("span", { class: "calc" });

    function show() {
      var r = calcParams(calc);
      CALC_FIELDS.forEach(function (f) { inputs[f.id].value = calc[f.id].toFixed(f.digits); });
      outFdr.textContent = isFinite(r.fdr) ? r.fdr.toFixed(2) : "—";
      outTurn.textContent = (calc.tire * 3.14).toFixed(1);
      outRoll.textContent = isFinite(r.rollout) ? r.rollout.toFixed(2) : "—";
    }
    function set(f, value) {
      if (!isFinite(value) || value < f.min) { show(); return; }   // 打錯就回到原本的值
      calc[f.id] = Math.round(value * 1000) / 1000;
      saveCalc(calc);
      show();
      changed();
    }

    var rows = CALC_FIELDS.map(function (f) {
      var input = el("input", {
        class: "num", type: "text", inputmode: "decimal", "aria-label": f.name,
        onchange: function () { set(f, parseFloat(input.value)); }
      });
      inputs[f.id] = input;
      function stepBy(dir) {
        return el("button", {
          type: "button", class: "step", "aria-label": f.name + (dir > 0 ? " 增加" : " 減少"), text: dir > 0 ? "+" : "−",
          onclick: function () { set(f, calc[f.id] + dir * f.step); }
        });
      }
      return el("div", { class: "row" }, [el("div", { class: "row-main" }, [
        el("span", { class: "row-name", text: f.name }),
        el("div", { class: "row-ctl" }, [stepBy(-1), input, stepBy(1), el("span", { class: "unit th-unit", text: f.unit })])
      ])]);
    });

    function result(name, node, unit) {
      return el("div", { class: "row" }, [el("div", { class: "row-main" }, [
        el("span", { class: "row-name", text: name }),
        el("div", { class: "row-ctl" }, [node, el("span", { class: "unit th-unit", text: unit })])
      ])]);
    }

    show();
    return el("section", { class: "th-calc" }, [
      el("h3", { class: "group-name", text: "Rollout 計算" })
    ].concat(rows, [
      result("終傳比", outFdr, ""),
      result("輪胎轉一圈", outTurn, "mm"),
      result("Rollout", outRoll, "mm"),
      el("p", { class: "hint", text: "公式照原書：終傳比 =（大齒盤 ÷ 馬達齒）× 內齒比；Rollout = 胎徑 × 3.14 ÷ 終傳比。起始值的大齒盤 80T、馬達齒 22T、內齒比 3.00 是設定記錄裡 MST RMX 4 GT 的原廠值；胎徑 64 mm 是暫填的數字，請改成自己量到的。數值記在這台裝置的瀏覽器裡。" }),
      el("button", {
        type: "button", class: "reset th-reset", text: "回到起始值",
        onclick: function () {
          CALC_FIELDS.forEach(function (f) { calc[f.id] = f.start; });
          saveCalc(calc);
          show();
          changed();
        }
      })
    ]));
  }

  /* ---------- 內容頁 ---------- */

  function renderTable(tb) {
    return el("div", { class: "th-table-wrap" }, [
      el("table", { class: "th-table" }, [
        el("caption", { text: tb.title }),
        el("thead", {}, [el("tr", {}, tb.head.map(function (h) { return el("th", { scope: "col", text: h }); }))]),
        el("tbody", {}, tb.rows.map(function (row) {
          return el("tr", {}, row.map(function (cell, i) {
            return i ? el("td", { text: cell }) : el("th", { scope: "row", text: cell });
          }));
        }))
      ])
    ]);
  }

  function renderHow(h) {
    return el("details", { class: "fold", open: h.open ? "" : null }, [
      el("summary", { text: h.title + (h.page ? "（第 " + h.page + " 頁）" : "") }),
      h.prep ? el("p", { class: "th-sub", text: "準備工作" }) : null,
      h.prep ? el("ul", { class: "fold-list" }, h.prep.map(function (t) { return el("li", { text: t }); })) : null,
      h.tools ? el("p", { class: "th-sub", text: "使用工具：" + h.tools.join("、") }) : null,
      h.steps ? el("ol", { class: "th-steps" }, h.steps.map(function (t) { return el("li", { text: t }); })) : null
    ]);
  }

  function renderTopic(tp, optionId) {
    var goal = view.goal ? goalIndex[view.goal] : null;
    var current = findOption(tp, optionId) || findOption(tp);
    var calc = tp.calc ? loadCalc() : null;
    var pinBox = el("div", { class: "dg-box" }), cap = el("p", { class: "th-cap" });
    var cards = [];

    function drawPin() {
      var kind = (current && current.view) || tp.view;
      var svg = Diagram && kind ? Diagram.draw(kind, merge(tp.base, current && current.params, calc ? calcParams(calc) : null)) : null;
      pinBox.textContent = "";
      if (svg) pinBox.appendChild(svg);
      cap.textContent = (current && current.cap) || tp.cap || "";
      cap.hidden = !cap.textContent;
    }

    function select(op) {
      current = op;
      cards.forEach(function (c) {
        c.node.classList.toggle("is-on", c.op === op);
        c.head.setAttribute("aria-pressed", c.op === op ? "true" : "false");
      });
      drawPin();
      // 記在網址上，重新整理或分享連結時停在同一個方向；不多留一筆瀏覽紀錄
      try { history.replaceState(history.state, "", hashOf(tp.id, op.id)); }
      catch (e) { /* 有些環境不給用，照常運作 */ }
    }

    function optionCard(op, set) {
      var on = op === current;
      var title = [
        set.plain ? null : el("span", { class: "th-radio" }),
        el("span", { class: "th-opt-name" }, [
          el("span", { text: op.label }),
          op.sub ? el("span", { class: "th-opt-sub", text: op.sub }) : null
        ])
      ];
      var head = set.plain
        ? el("div", { class: "th-opt-head" }, title)
        : el("button", { type: "button", class: "th-opt-head", "aria-pressed": on ? "true" : "false", onclick: function () { select(op); } }, title);
      var node = el("section", { class: "th-opt" + (on ? " is-on" : "") + (set.plain ? " is-plain" : "") }, [
        head,
        op.use ? el("p", { class: "th-use", text: op.use }) : null,
        el("ul", { class: "th-fx" }, op.fx.map(function (f) {
          return el("li", { class: matchesGoal(f, goal) ? "is-match" : null }, [el("span", { text: f.t })].concat(
            // data-ph 給樣式用：入彎、彎中、出彎各一種顏色
            phasesOf(f).map(function (key) { return el("span", { class: "tag th-ph", "data-ph": key, text: PHASES[key] }); }),
            [
              f.gen ? el("span", { class: "tag tag-g", text: "不分前後" }) : null,
              f.ask ? el("span", { class: "tag tag-g", text: "原書帶問號" }) : null
            ]
          ));
        })),
        op.how ? el("div", { class: "th-do" }, [
          el("p", { class: "th-do-title", text: "怎麼做" }),
          el("ul", { class: "fold-list" }, op.how.map(function (t) { return el("li", { text: t }); }))
        ]) : null
      ]);
      if (!set.plain) cards.push({ op: op, node: node, head: head });
      return node;
    }

    var pair = tp.pair ? topicById(tp.pair) : null;
    var body = [];

    if (goal) {
      body.push(el("p", { class: "th-now" }, [
        el("span", { class: "th-now-text" }, [el("b", { text: goalTitle(goal) }), el("span", { text: "　符合的敘述用粗體標出" })])
      ]));
    }
    body.push(el("p", { class: "th-intro", text: tp.intro }));
    if (tp.only4wd) body.push(el("p", { class: "hint", text: "整理註：這是四驅車才有的零件。" }));

    (tp.sets || []).forEach(function (set) {
      if (set.title) body.push(el("h3", { class: "group-name", text: set.title }));
      if (set.text) body.push(el("p", { class: "group-note", text: set.text }));
      set.options.forEach(function (op) { body.push(optionCard(op, set)); });
    });
    if (cards.length > 1) body.push(el("p", { class: "hint", text: "點調整方向的標題，上方的圖會換成那個狀態。" }));

    if (calc) body.push(renderCalc(calc, drawPin));
    if (tp.table) body.push(renderTable(tp.table));
    if (tp.keys) {
      body.push(el("h3", { class: "group-name", text: tp.keysTitle || "重點" }));
      body.push(el("ul", { class: "th-keys" }, tp.keys.map(function (t) { return el("li", { text: t }); })));
    }
    (tp.how || []).forEach(function (h) { body.push(renderHow(h)); });
    if (tp.notes) {
      body.push(el("h3", { class: "group-name", text: "注意" }));
      body.push(el("ul", { class: "th-keys" }, tp.notes.map(function (t) { return el("li", { text: t }); })));
    }
    if (tp.see) {
      body.push(el("p", { class: "th-also" }, [el("span", { text: "相關：" })].concat(tp.see.map(function (id) {
        var other = topicById(id);
        return other ? el("button", { type: "button", class: "th-goal", text: other.name, onclick: function () { jump(other.id); } }) : null;
      }))));
    }
    body.push(el("p", { class: "hint" }, [
      el("span", { text: "原書第 " + tp.ch + " 章，PDF 第 " + tp.pages + " 頁。" }),
      HAS_PDF ? el("a", { class: "th-pdf", href: encodeURI(T.source.file) + "#page=" + parseInt(tp.pages, 10), target: "_blank", rel: "noopener", text: "開啟 PDF" }) : null
    ]));
    body.push(el("button", { type: "button", class: "btn back-bottom", text: "‹ 回總覽", onclick: back }));

    drawPin();
    return el("div", {}, [
      el("div", { class: "editor-top" }, [
        el("div", { class: "editor-bar" }, [
          el("button", { type: "button", class: "back", text: "‹ 總覽", onclick: back }),
          el("h2", { text: tp.title }),
          pair ? el("button", {
            type: "button", class: "btn-small", text: pair.name + " ›",
            onclick: function () { jump(pair.id, current && findOption(pair, current.id) ? current.id : ""); }
          }) : null
        ]),
        tp.view ? el("div", { class: "pin" }, [pinBox, cap]) : null
      ]),
      el("div", { class: "th-body" }, body)
    ]);
  }

  /* ---------- 整頁 ---------- */

  function render() {
    var route = parseHash();
    var tp = route.topic ? topicById(route.topic) : null;
    app.textContent = "";
    mapUi = null;
    if (tp) {
      app.appendChild(renderTopic(tp, route.option));
      document.title = tp.title + "｜遙控車設定理論";
      window.scrollTo(0, 0);
      return;
    }
    view.fromMap = false;
    app.appendChild(renderMap());
    refresh();
    document.title = "遙控車設定理論";
    window.scrollTo(0, view.mapScroll);
  }

  window.addEventListener("hashchange", render);
  render();

  // 給測試與除錯用
  window.RCTheoryApp = { view: view, compute: compute, setGoal: setGoal, go: go };
})();
