/*
 * 遙控車設定記錄：畫面、本機儲存、CSV 匯入匯出。
 * 產品資料由 data/*.js 推進 window.RC_PRODUCTS，這裡只負責呈現。
 * 不用 ES module 與 fetch，手機直接開本機檔案（file://）也能跑。
 *
 * 畫面分兩層：總覽頁是一格一格的卡片（產品有 cards 與 derive 時，卡片圍著車圖排），
 * 點卡片進編輯頁，一次只顯示那張卡片的欄位，上方釘著會跟著數值變化的示意圖。
 *
 * 值的規則：欄位沒有存值時，生效值就是原廠值，使用者只需要改和原廠不同的項目。
 *
 * 資料檔可以用的屬性（都可省略）：
 *   產品 p.factoryOf(it, values)  原廠值會隨其他欄位改變時提供（例如電變的模式）；values 是生效值，
 *                                 依欄位順序算出，所以決定原廠值的欄位要排在前面。沒提供就用 it.factory
 *        p.cards                  總覽頁的卡片：{ id, name, slot, groups: [群組 id], items: [欄位 id],
 *                                 diagram: [示意圖種類], hot: [要強調的部位], summary: [[短標題, 欄位 id]] }；
 *                                 沒提供就一個群組一張。items 可以列出別的群組的欄位，同一個欄位能出現在
 *                                 不只一張卡片；沒有 slot 的卡片排在車圖下方
 *        p.derive(values)         把欄位值換成 js/diagram.js 的參數
 *        p.sheets                 原廠圖的來源：{ 名稱: { src: 圖檔網址, w, h: 原圖的像素大小, credit: 出處 } }，
 *                                 第一個是預設的那張。圖直接連到原廠網站，不放進 repo
 *   欄位 type                     num、text、select
 *        preset                   說明書沒寫原廠值、但頁面想給一個起始值時用。畫面標成「預設」而不是「原廠」
 *        showIf: function (values)  回傳 false 時這一列不顯示（例如「自訂電壓」只在選了自訂時出現）
 *        step／min／max           num 欄位的加減按鈕每次走多少、上下限
 *        prefix／signed／digits   顯示在數值前的固定文字／正數顯示加號／固定小數位數
 *        calc: function (values)  唯讀的計算欄位
 *        viz                      調整這個欄位時，釘在上方的示意圖切到哪一種；"sheet" 是原廠圖（要有 fig）
 *        fig                      這個欄位在原廠圖上的位置，座標是原圖的像素：
 *                                 { on: p.sheets 的名稱（省略就是第一張）,
 *                                   box: [x0, y0, x1, y1] 要顯示的範圍，也可以是 function (values)，
 *                                   at: [x, y, 對齊] 數值寫在哪裡；對齊是 "l"（從這一點往右寫）、"r"（寫到這一點為止），
 *                                       省略就是置中。也可以是 function (values)，回傳 null 就不寫,
 *                                   opts: { 選項: [x, y, 標籤, 標籤放哪一側 t／b／l／r] } 每個選項圈在哪裡，
 *                                         同一個選項有好幾處時給陣列的陣列,
 *                                   turn: { box: [x0, y0, x1, y1], drawn: 選項 } 圖上這一塊畫的是 drawn 那個選項的樣子，
 *                                         選了別的選項就把這一塊轉 180°（零件翻面安裝時用）,
 *                                   hide: [[x0, y0, x1, y1], ...] 要塗黑的地方（會和翻轉後的零件重疊的記號）,
 *                                   paint: function (values) 回傳 [[x0, y0, x1, y1], ...]，在圖上塗紅色的圓角色塊
 *                                         （例如長孔裡軸套的位置）；落在 turn 那一塊裡的會跟著一起轉,
 *                                   say: function (values) 回傳一句話，接在圖說的欄位名稱後面 }
 *                                 卡片裡有欄位寫了 fig，釘圖區就多一個「原廠圖」分頁；同一塊圖裡其他欄位的值也會寫上去
 *        part                     調整這個欄位時交給 diagram.js 的 opt.active：要強調哪個零件，或是同一種圖要畫哪一個版本
 *        hot                      點這個欄位時，示意圖要強調的部位（取代卡片的 hot）；零件清單用
 *        sub／img／link           名稱下方的小字（例如料號）／名稱左邊的小圖網址／說明裡的外部連結
 *        rerender: true           這個欄位改變後整頁重畫（其他欄位的原廠值跟著換的時候用）
 *
 * 外掛掛點：在 app.js 之前載入的檔案執行
 *   (window.RC_PLUGINS = window.RC_PLUGINS || []).push({ item: fn, group: fn })
 *   item(p, it, api)    回傳要放在該欄位下方的節點，不需要就回傳 null
 *   group(p, grp, api)  回傳要放在該群組標題下方的節點，不需要就回傳 null
 *   pin(p, card, api)   回傳要釘在編輯頁上方（示意圖後面）的節點；api.pin 為 true 表示有這個掛點
 *   card(p, card, api)  回傳要放進總覽頁卡片（摘要文字後面）的節點；卡片本身是按鈕，裡面不能再放可點的東西。
 *                       api.card 為 true 表示有這個掛點
 *   overview(p, p, api) 回傳要放在總覽頁工具列下方的節點（例如 js/traits.js 的「車輛特性」）；
 *                       api.overview 為 true 表示有這個掛點
 *   api.values()        目前產品的生效值 { 欄位 id: 字串 }
 *   api.factory()       目前產品的原廠值，格式同上；說明書沒寫原廠值的欄位是空字串
 *   api.pretty(it, v)   把欄位的值寫成給人看的樣子（加上前置文字、正號與單位）
 *   api.open(cardId)    開啟某張卡片的編輯頁
 *   api.set(id, value)  寫入某個欄位，等同使用者輸入
 *   api.onChange(fn)    任何欄位改變後呼叫 fn()；整頁重畫時舊的 fn 會被丟掉
 *   api.stepper         true：num 欄位已有內建的加減按鈕，外掛不要再畫一組
 */
(function () {
  "use strict";

  var CATEGORIES = ["車架", "陀螺儀", "伺服機", "電變", "遙控器"];
  var STORE_KEY = "rc_car_setting:v2";   // v2：只存和原廠不同的設定
  var CSV_HEADER = ["product_id", "product", "group", "item_id", "item", "value", "unit", "factory"];
  var PIN_NAMES = {
    map: "全車", "top-front": "俯視", "top-rear": "俯視", front: "正視", rear: "正視",
    side: "側視", "damper-f": "避震", "damper-r": "避震", gear: "齒輪", links: "全車", car: "位置",
    rod: "拉桿", holes: "孔位", sheet: "原廠圖"
  };
  var FIG_HEIGHT = 148;   // 原廠圖釘在上方時的高度上限（px），加上圖說和示意圖差不多高

  var products = window.RC_PRODUCTS || [];
  var plugins = window.RC_PLUGINS || [];
  var Diagram = window.RCDiagram;   // 沒載入 diagram.js 時頁面照常運作，只是沒有示意圖
  var store = loadStore();
  var view = { category: CATEGORIES[0], productId: null, cardId: null, pin: null, message: "" };

  // 以下只對目前畫面有效，每次整頁重畫都會清空
  var liveViews = [];   // 數值改變後要更新的東西（欄位、示意圖、外掛）
  var fields = {};      // 欄位 id -> 寫入該欄位的函式，給 api.set 用
  var cache = null;     // 目前產品的生效值與原廠值，寫入後作廢
  var skipPop = false;

  /* ---------- 儲存與取值 ---------- */

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveStore() {
    // 無痕模式等情況可能寫不進去，這次開著的頁面仍然有效
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { /* ignore */ }
  }

  function stored(p) {
    return store[p.id] || (store[p.id] = {});
  }

  function eachItem(p, fn) {
    p.groups.forEach(function (grp) {
      grp.items.forEach(function (it) { fn(it, grp); });
    });
  }

  // eff：生效值（有存值用存值，否則預設值）；fac：原廠值；base：預設值，也就是原廠值，
  // 說明書沒寫原廠值的欄位才用 it.preset。依欄位順序算。
  function compute(p) {
    var mine = stored(p), eff = {}, fac = {}, base = {};
    eachItem(p, function (it) {
      if (it.calc) return;
      var f = p.factoryOf ? p.factoryOf(it, eff) : it.factory;
      fac[it.id] = f == null ? "" : String(f);
      base[it.id] = fac[it.id] || (it.preset == null ? "" : String(it.preset));
      eff[it.id] = mine[it.id] != null && mine[it.id] !== "" ? mine[it.id] : base[it.id];
    });
    eachItem(p, function (it) {
      if (!it.calc) return;
      eff[it.id] = String(it.calc(eff));
      fac[it.id] = base[it.id] = String(it.calc(base));
    });
    return { p: p, eff: eff, fac: fac, base: base };
  }

  // 這個產品的預設值該怎麼稱呼：全部來自說明書就叫原廠，有用到 preset 就叫預設
  function baseWord(p) {
    var preset = false;
    eachItem(p, function (it) { if (it.preset != null) preset = true; });
    return preset ? "預設" : "原廠";
  }

  function state(p) {
    if (!cache || cache.p !== p) cache = compute(p);
    return cache;
  }

  function setValue(p, itemId, value) {
    var mine = stored(p);
    if (value == null || value === "") delete mine[itemId];
    else mine[itemId] = value;
    saveStore();
    cache = null;
  }

  function isChanged(p, it) {
    var v = stored(p)[it.id], b = state(p).base[it.id];
    return v != null && v !== "" && !!b && !sameValue(v, b);
  }

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

  var BOM = String.fromCharCode(0xFEFF);
  var NUMERIC = /^[+-]?\d+(\.\d+)?$/;

  // 「+4.0」和從試算表存回來的「4」要視為相同
  function sameValue(a, b) {
    a = String(a).trim();
    b = String(b).trim();
    if (a === b) return true;
    return NUMERIC.test(a) && NUMERIC.test(b) && parseFloat(a) === parseFloat(b);
  }

  function decimals(step) { return (String(step).split(".")[1] || "").length; }

  function formatNumber(it, n) {
    if (it.digits != null) return n.toFixed(it.digits);
    return String(parseFloat(n.toFixed(Math.max(decimals(it.step || 1), 3))));
  }

  // 輸入框裡顯示的文字：加上前置文字（例如 #）與正號
  function display(it, v) {
    if (v == null || v === "") return "";
    v = String(v);
    if (it.signed && NUMERIC.test(v) && parseFloat(v) >= 0) v = "+" + v.replace(/^\+/, "");
    return (it.prefix || "") + v;
  }

  // 把輸入框裡的文字還原成存檔值
  function typed(it, text) {
    text = text.trim();
    if (it.prefix && text.indexOf(it.prefix) === 0) text = text.slice(it.prefix.length).trim();
    return text.replace(/^\+/, "");
  }

  // 給人看的完整寫法：數值加單位
  function pretty(it, v) {
    if (v == null || v === "") return "";
    var unit = it.unit ? (it.unit === "°" || it.unit === "%" ? it.unit : " " + it.unit) : "";
    return display(it, v) + unit;
  }

  function refreshLive() {
    liveViews.forEach(function (update) { update(); });
  }

  // 點一下做一次；按住 0.4 秒後連續做
  function holdButton(text, title, cls, fn) {
    var timer = null, repeat = null, held = false;
    function stop() { clearTimeout(timer); clearInterval(repeat); timer = repeat = null; }
    var b = el("button", { type: "button", class: cls, "aria-label": title, text: text });
    b.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      held = false;
      timer = setTimeout(function () { held = true; fn(); repeat = setInterval(fn, 80); }, 400);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (type) { b.addEventListener(type, stop); });
    b.addEventListener("click", function () {
      if (held) { held = false; return; }   // 長按放開時的那一下不要再多做一次
      fn();
    });
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    return b;
  }

  /* ---------- 卡片 ---------- */

  function cardsOf(p) {
    if (!p.cards) {
      return p.groups.map(function (grp) { return { id: grp.id, name: grp.name, groups: [grp.id] }; });
    }
    p.cards.forEach(function (card) { if (!card.groups) card.groups = []; });
    return p.cards;
  }

  function groupsOf(p, card) {
    return card.groups.map(function (id) {
      return p.groups.filter(function (grp) { return grp.id === id; })[0];
    }).filter(function (grp) { return grp; });
  }

  function findItem(p, id) {
    var found = null;
    eachItem(p, function (it) { if (it.id === id) found = it; });
    return found;
  }

  // 卡片直接列出的欄位（可以來自任何群組）
  function looseItems(p, card) {
    return (card.items || []).map(function (id) { return findItem(p, id); }).filter(function (it) { return it; });
  }

  function itemsOf(p, card) {
    var list = [];
    groupsOf(p, card).forEach(function (grp) { list = list.concat(grp.items); });
    return list.concat(looseItems(p, card));
  }

  function openCard(id) {
    view.cardId = id;
    view.pin = null;
    view.message = "";
    try { history.pushState({ card: id }, ""); } catch (e) { /* 有些環境不給用，照常運作 */ }
    render();
    window.scrollTo(0, 0);
  }

  function closeCard() {
    view.cardId = null;
    render();
    window.scrollTo(0, 0);
    // 把進卡片時推的那一筆瀏覽紀錄收掉，手機的返回鍵才不會多按一次
    try {
      if (history.state && history.state.card) { skipPop = true; history.back(); }
    } catch (e) { /* ignore */ }
  }

  window.addEventListener("popstate", function () {
    if (skipPop) { skipPop = false; return; }
    if (view.cardId) { view.cardId = null; render(); window.scrollTo(0, 0); }
  });

  /* ---------- 示意圖與外掛 ---------- */

  function diagramBox(p, kind, opt) {
    if (!Diagram || !p.derive) return null;
    var box = el("div", { class: "dg-box dg-" + kind });
    function redraw() {
      var st = state(p);
      var svg = Diagram.draw(kind, p.derive(st.eff), p.derive(st.fac), opt);
      box.textContent = "";
      if (svg) box.appendChild(svg);
    }
    redraw();
    liveViews.push(redraw);
    return box;
  }

  function pluginNodes(kind, p, target) {
    var api = {
      stepper: true,
      pin: true,
      card: true,
      overview: true,
      values: function () { return state(p).eff; },
      factory: function () { return state(p).fac; },
      pretty: pretty,
      open: openCard,
      set: function (id, value) {
        if (fields[id]) fields[id](String(value));
        else { setValue(p, id, String(value)); refreshLive(); }
      },
      onChange: function (fn) { liveViews.push(fn); }
    };
    return plugins.map(function (plugin) {
      if (!plugin[kind]) return null;
      try {
        return plugin[kind](p, target, api);
      } catch (e) {
        // 外掛是各自獨立開發的檔案：其中一個出錯時記在主控台並略過，不要讓整頁空白
        console.error("外掛的 " + kind + " 掛點出錯（" + (target.id || "") + "）", e);
        return null;
      }
    }).filter(function (node) { return node; });
  }

  /* ---------- CSV ---------- */

  function csvCell(s) {
    s = s == null ? "" : String(s);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // 匯出生效值：沒改過的欄位寫原廠值，檔案本身就是一份完整的設定
  function toCsv(p) {
    var st = state(p);
    var rows = [CSV_HEADER];
    eachItem(p, function (it, grp) {
      rows.push([p.id, p.name, grp.name, it.id, it.name, st.eff[it.id], it.unit || "", st.fac[it.id]]);
    });
    return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n";
  }

  function parseCsv(text) {
    var rows = [], row = [], cell = "", quoted = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') {
        quoted = true;
      } else if (c === ",") {
        row.push(cell); cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        rows.push(row); row = [];
      } else {
        cell += c;
      }
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x !== ""; }); });
  }

  // 依 product_id + item_id 對應；這個頁面不認得的列、計算欄位都略過
  function applyCsv(text) {
    var rows = parseCsv(text.charAt(0) === BOM ? text.slice(1) : text);
    if (!rows.length) throw new Error("檔案是空的");
    var head = rows[0].map(function (h) { return h.trim(); });
    var iP = head.indexOf("product_id"), iI = head.indexOf("item_id"), iV = head.indexOf("value");
    if (iP < 0 || iI < 0 || iV < 0) throw new Error("找不到 product_id、item_id、value 欄位");

    var known = {};
    products.forEach(function (p) {
      known[p.id] = { p: p, items: {} };
      eachItem(p, function (it) { known[p.id].items[it.id] = it; });
    });

    var applied = 0, skipped = 0;
    rows.slice(1).forEach(function (r) {
      var entry = known[(r[iP] || "").trim()];
      var it = entry && entry.items[(r[iI] || "").trim()];
      if (!it) { skipped++; return; }
      if (it.calc) return;   // 計算欄位由其他欄位算出來，不用匯入，也不算略過
      var mine = stored(entry.p), value = (r[iV] || "").trim();
      // 原廠值固定的產品，和原廠值相同就不存，維持「只存不同的」
      if (value === "" || (!entry.p.factoryOf && it.factory && sameValue(value, it.factory))) delete mine[it.id];
      else mine[it.id] = value;
      applied++;
    });
    saveStore();
    cache = null;
    return { applied: applied, skipped: skipped };
  }

  function download(name, text) {
    // 加 BOM，Excel 才會把中文當 UTF-8 開
    var blob = new Blob([BOM + text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function stamp() {
    var d = new Date();
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + "-" + p2(d.getHours()) + p2(d.getMinutes());
  }

  /* ---------- 欄位 ---------- */

  function stepped(p, it, dir) {
    var step = it.step || 1;
    var n = parseFloat(state(p).eff[it.id]);
    if (isNaN(n)) n = it.start != null ? it.start : (it.min != null ? it.min : 0);   // 還沒有值：從起點開始
    else n = Math.round((n + dir * step) / step) * step;
    if (it.min != null) n = Math.max(it.min, n);
    if (it.max != null) n = Math.min(it.max, n);
    return formatNumber(it, n);
  }

  function isSegmented(it) {
    return it.type === "select" && !it.icons && it.options.length <= 4 && it.options.join("").length <= 24;
  }

  function renderDetail(it) {
    var range = it.min != null && it.max != null ? "可調範圍：" + pretty(it, String(it.min)) + " ~ " + pretty(it, String(it.max)) : "";
    var parts = [
      it.img ? el("img", { class: "detail-img", src: it.img, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null,
      it.en ? el("p", { class: "detail-en", text: it.en }) : null,
      range ? el("p", { class: "detail-note", text: range }) : null,
      it.fnote ? el("p", { class: "detail-note", text: it.fnote }) : null,
      it.effect && it.effect.length ? el("ul", { class: "fx" }, it.effect.map(function (fx) {
        return el("li", {}, [
          el("span", { class: "fx-when", text: fx.w }),
          el("span", { class: "fx-then", text: fx.t }),
          el("span", { class: "tag " + (fx.manual ? "tag-m" : "tag-g"), text: fx.manual ? "說明書" : "一般原則" })
        ]);
      })) : null,
      it.note ? el("p", { class: "detail-note", text: it.note }) : null,
      it.link ? el("p", { class: "detail-note" }, [el("a", { href: it.link, target: "_blank", rel: "noopener", text: "官方產品頁" })]) : null
    ].filter(function (node) { return node; });
    return parts.length ? el("div", { class: "row-detail", hidden: "" }, parts) : null;
  }

  // ctx.touch(it)：使用者正在調這個欄位，讓釘在上方的示意圖切到對應的圖、強調對應的零件
  function renderRow(p, it, ctx) {
    var inputId = p.id + "__" + it.id;
    var row = el("div", { class: "row" });
    var input = null;       // 文字輸入框或下拉選單（有的話）
    var buttons = [];       // 分段按鈕（有的話）
    var output = null;      // 計算欄位的顯示
    var extras = it.calc ? [] : pluginNodes("item", p, it);

    function commit(value, settled) {
      setValue(p, it.id, value);
      ctx.touch(it);
      if (settled && it.rerender) {
        render();
        var again = document.getElementById(inputId);
        if (again) again.focus();
        return;
      }
      refreshLive();
    }
    fields[it.id] = function (value) { commit(value, true); };

    var control;
    if (it.calc) {
      output = el("output", { class: "calc" });
      control = [output];
    } else if (isSegmented(it)) {
      buttons = it.options.map(function (opt) {
        // 再點一次已選的選項＝取消自己的設定，回到原廠值
        return el("button", { type: "button", class: "seg-btn", text: opt, value: opt, onclick: function () {
          commit(stored(p)[it.id] === opt ? "" : opt, true);
        } });
      });
      control = [el("div", { class: "seg", role: "group", "aria-label": it.name }, buttons)];
    } else if (it.type === "select") {
      input = el("select", { id: inputId, class: "sel", "aria-label": it.name,
        onchange: function () { commit(input.value, true); } });
      control = [input];
    } else {
      var numeric = it.type === "num";
      input = el("input", {
        id: inputId, type: "text", class: numeric ? "num" : "txt", "aria-label": it.name,
        inputmode: numeric ? "decimal" : null, autocomplete: "off",
        oninput: function () { commit(typed(it, input.value), false); },
        onchange: function () { commit(typed(it, input.value), true); sync(); },
        onfocus: function () { ctx.touch(it); }
      });
      control = numeric ? [
        holdButton("−", it.name + " 減少", "step", function () { commit(stepped(p, it, -1), true); }),
        input,
        holdButton("+", it.name + " 增加", "step", function () { commit(stepped(p, it, 1), true); })
      ] : [input];
    }
    if (it.unit && !it.calc) control.push(el("span", { class: "unit", text: it.unit }));

    var detail = renderDetail(it);
    var nameKids = [el("span", { text: it.name }), it.sub ? el("span", { class: "row-sub", text: it.sub }) : null];
    var name = detail
      ? el("button", { type: "button", class: "row-name has-detail", "aria-expanded": "false", onclick: function () {
          detail.hidden = !detail.hidden;
          name.setAttribute("aria-expanded", detail.hidden ? "false" : "true");
          ctx.touch(it);
        } }, nameKids)
      : el("span", { class: "row-name" }, nameKids);
    // 沒有網路時圖載不到，就不要留一個破圖的框
    var thumb = it.img ? el("img", { class: "row-img", src: it.img, alt: "", loading: "lazy", referrerpolicy: "no-referrer",
      onerror: function () { thumb.hidden = true; } }) : null;
    var reset = el("button", { type: "button", class: "reset", onclick: function () { commit("", true); } });

    row.appendChild(el("div", { class: "row-main" }, [thumb, name, el("div", { class: "row-ctl" }, control)]));
    row.appendChild(reset);
    extras.forEach(function (node) { row.appendChild(node); });
    if (detail) row.appendChild(detail);

    function sync() {
      var st = state(p), value = st.eff[it.id], base = st.base[it.id];
      row.hidden = !!it.showIf && !it.showIf(st.eff);
      if (output) output.textContent = pretty(it, value) || "—";
      if (buttons.length) {
        buttons.forEach(function (b) {
          b.classList.toggle("is-on", b.value === value);
          b.setAttribute("aria-pressed", b.value === value ? "true" : "false");
        });
      }
      if (input && input.tagName === "SELECT") {
        var options = it.options.slice();
        if (value && options.indexOf(value) < 0) options.push(value);   // 匯入的值不在選項裡也照樣保留
        input.textContent = "";
        if (!base) input.appendChild(el("option", { value: "", text: "未設定" }));
        options.forEach(function (o) { input.appendChild(el("option", { value: o, text: o })); });
        input.value = value;
      } else if (input && document.activeElement !== input) {
        input.value = display(it, value);   // 正在打字的輸入框不要改它
      }
      var changed = isChanged(p, it);
      row.classList.toggle("is-changed", changed);
      reset.hidden = !changed;
      reset.textContent = (st.fac[it.id] ? "回原廠 " : "回預設 ") + pretty(it, base);
    }
    sync();
    liveViews.push(sync);
    return row;
  }

  /* ---------- 原廠圖 ---------- */

  function figSheet(p, fig) {
    return p.sheets[fig.on || Object.keys(p.sheets)[0]];
  }

  function figBox(fig, values) {
    return typeof fig.box === "function" ? fig.box(values) : fig.box;
  }

  function inBox(at, box) {
    return !!at && at[0] >= box[0] && at[0] <= box[2] && at[1] >= box[1] && at[1] <= box[3];
  }

  // 原廠圖的一塊（反白成黑底白線），上面疊目前的設定：數值寫在圖上留空的位置，選項圈在圖上對應的地方。
  // 同一塊圖裡其他欄位的值也一起寫上去（顏色較淡），看起來就像填好的設定表
  function makeFigure(p, sheet, box) {
    var bw = box[2] - box[0], bh = box[3] - box[1];
    var under = el("div", { class: "fig-layer" });   // 塗黑與會翻轉的區塊：裡面有圖片，做一次就不再重做
    var layer = el("div", { class: "fig-layer" });   // 目前設定的記號：每次都重畫
    var missing = el("p", { class: "fig-missing", hidden: "", text: "原廠的圖載不到（需要網路）" });
    var turns = [], hides = [];

    // 把原圖放進只看得到 r 這一塊的容器裡；容器的長寬比要和 r 一樣
    function picture(r, onerror) {
      var w = r[2] - r[0], h = r[3] - r[1];
      return el("img", {
        class: "fig-img", src: sheet.src, alt: "", referrerpolicy: "no-referrer", draggable: "false", onerror: onerror,
        style: "width:" + (sheet.w / w * 100) + "%;left:" + (-r[0] / w * 100) + "%;top:" + (-r[1] / h * 100) + "%"
      });
    }
    // r 在 base 這一塊裡佔的位置
    function within(r, base) {
      var w = base[2] - base[0], h = base[3] - base[1];
      return "left:" + ((r[0] - base[0]) / w * 100) + "%;top:" + ((r[1] - base[1]) / h * 100) + "%;width:" +
        ((r[2] - r[0]) / w * 100) + "%;height:" + ((r[3] - r[1]) / h * 100) + "%";
    }
    function overlap(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }

    var crop = el("div", {
      class: "fig-crop",
      style: "aspect-ratio:" + bw + "/" + bh + ";width:min(100%," + Math.round(FIG_HEIGHT * bw / bh) + "px)"
    }, [picture(box, function () { crop.hidden = true; missing.hidden = false; }), under, layer]);
    var caption = el("figcaption", { class: "fig-cap" });

    eachItem(p, function (it) {
      if (it.fig && figSheet(p, it.fig) === sheet) hides = hides.concat(it.fig.hide || []);
    });
    hides.forEach(function (r) {
      if (overlap(r, box)) under.appendChild(el("div", { class: "fig-hide", style: within(r, box) }));
    });
    eachItem(p, function (it) {
      var t = it.fig && figSheet(p, it.fig) === sheet && it.fig.turn;
      if (!t || !overlap(t.box, box)) return;
      var node = el("div", { class: "fig-turn", style: within(t.box, box) }, [picture(t.box)].concat(
        hides.filter(function (r) { return overlap(r, t.box); }).map(function (r) {
          return el("div", { class: "fig-hide", style: within(r, t.box) });
        })));
      var paint = el("div", { class: "fig-layer" });
      node.appendChild(paint);
      under.appendChild(node);
      turns.push({ item: it, drawn: t.drawn, box: t.box, node: node, paint: paint });
    });

    function place(cls, at, text, side) {
      layer.appendChild(el("span", {
        class: cls, "data-label": text || null, "data-side": side || null, text: cls.indexOf("fig-val") === 0 ? text : null,
        style: "left:" + ((at[0] - box[0]) / bw * 100) + "%;top:" + ((at[1] - box[1]) / bh * 100) + "%"
      }));
    }

    function sync(active) {
      var st = state(p);
      turns.forEach(function (t) {
        var value = st.eff[t.item.id];
        t.node.classList.toggle("is-turned", value !== "" && value !== t.drawn);
        t.paint.textContent = "";
      });
      layer.textContent = "";
      eachItem(p, function (it) {
        var f = it.fig;
        if (!f || figSheet(p, f) !== sheet || (it.showIf && !it.showIf(st.eff))) return;
        (f.paint ? f.paint(st.eff) : []).forEach(function (r) {
          if (!overlap(r, box)) return;
          // 色塊畫在會翻轉的那一塊上時，放進那一塊裡面，零件轉的時候才會跟著轉
          var host = turns.filter(function (t) { return overlap(r, t.box); })[0];
          (host ? host.paint : layer).appendChild(el("span", { class: "fig-paint", style: within(r, host ? host.box : box) }));
        });
        var on = it === active, value = st.eff[it.id];
        Object.keys(f.opts || {}).forEach(function (opt) {
          var picked = opt === value, factory = opt === st.fac[it.id];
          if (!on && !picked) return;   // 別的欄位只標出選中的那一個
          var spots = f.opts[opt];
          (Array.isArray(spots[0]) ? spots : [spots]).forEach(function (spot) {
            if (!inBox(spot, box)) return;
            place("fig-opt" + (on ? " is-on" : "") + (picked ? " is-picked" : factory ? " is-factory" : ""), spot, spot[2], spot[3]);
          });
        });
        var at = typeof f.at === "function" ? f.at(st.eff) : f.at;
        if (value !== "" && inBox(at, box)) place("fig-val" + (on ? " is-on" : ""), at, display(it, value), at[2]);
      });
      var say = active.fig.say ? active.fig.say(st.eff) : "";
      caption.textContent = active.name + (say ? "：" + say : "") + "｜" + sheet.credit;
    }

    return { node: el("figure", { class: "fig" }, [crop, missing, caption]), sync: sync };
  }

  /* ---------- 編輯頁 ---------- */

  function renderEditor(p, card) {
    var drawn = Diagram && p.derive && card.diagram ? card.diagram : [];
    var figItems = p.sheets ? itemsOf(p, card).filter(function (it) { return it.fig; }) : [];
    var kinds = drawn.concat(figItems.length ? ["sheet"] : []);
    var pin = { kind: kinds.indexOf(view.pin) >= 0 ? view.pin : kinds[0] };
    var pinBox = el("div", { class: "pin" });
    var figures = {};   // 做好的原廠圖。同一塊圖重畫時只換上面的記號，圖片不必重新載入

    function drawFigure(st) {
      // 目前的欄位在原廠圖上沒有位置時（例如直接按「原廠圖」分頁），顯示上一個看過的，或這張卡片的第一個
      var it = pin.item && pin.item.fig ? pin.item : (pin.figItem || figItems[0]);
      var sheet = figSheet(p, it.fig), box = figBox(it.fig, st.eff);
      var key = sheet.src + "|" + box.join(",");
      var figure = figures[key] || (figures[key] = makeFigure(p, sheet, box));
      pin.figItem = it;
      figure.sync(it);
      return figure.node;
    }

    function drawPin() {
      if (!pin.kind) return;
      var st = state(p);
      var at = pin.item || {};
      var node = pin.kind === "sheet" ? drawFigure(st) : Diagram.draw(pin.kind, p.derive(st.eff), p.derive(st.fac),
        { hot: at.hot || card.hot, active: at.part, caption: at.hot ? at.name : "" });
      // 還是同一張原廠圖：上面的記號已經換好，不要拆掉重放，翻轉的動畫才不會被打斷
      if (node === pinBox.firstChild) return;
      pinBox.textContent = "";
      pinBox.appendChild(node);
      if (kinds.length < 2) return;
      pinBox.appendChild(el("div", { class: "pin-tabs" }, kinds.map(function (kind) {
        return el("button", {
          type: "button", class: "pin-tab" + (kind === pin.kind ? " is-on" : ""), text: PIN_NAMES[kind] || kind,
          onclick: function () { ctx.focus(kind); }
        });
      })));
    }
    var ctx = {
      focus: function (kind) {
        if (kinds.indexOf(kind) < 0 || kind === pin.kind) return;
        pin.kind = view.pin = kind;
        pin.kept = kind === "sheet";   // 使用者自己切到原廠圖
        drawPin();
      },
      touch: function (it) {
        var kind = kinds.indexOf(it.viz) >= 0 ? it.viz : pin.kind;
        // 使用者自己切到原廠圖之後，調有原廠圖的欄位就留在原廠圖，不要又跳回示意圖
        if (pin.kept && it.fig) kind = "sheet";
        // 正在看原廠圖，但這個欄位在圖上沒有位置：回到這張卡片的第一種示意圖
        if (kind === "sheet" && !it.fig && kinds[0] !== "sheet") kind = kinds[0];
        if (kind !== "sheet") pin.kept = false;
        if (kind === pin.kind && it === pin.item) return;
        pin.kind = view.pin = kind;
        pin.item = it;
        drawPin();
      }
    };
    drawPin();
    liveViews.push(drawPin);

    var groups = groupsOf(p, card);
    var body = [];
    groups.forEach(function (grp) {
      if (groups.length > 1) body.push(el("h3", { class: "group-name", text: grp.name }));
      if (grp.note) body.push(el("p", { class: "group-note", text: grp.note }));
      body = body.concat(pluginNodes("group", p, grp));
      grp.items.forEach(function (it) { body.push(renderRow(p, it, ctx)); });
    });
    looseItems(p, card).forEach(function (it) { body.push(renderRow(p, it, ctx)); });

    return el("div", { class: "editor" }, [
      el("div", { class: "editor-top" }, [
        el("div", { class: "editor-bar" }, [
          el("button", { type: "button", class: "back", text: "‹ 總覽", onclick: closeCard }),
          el("h2", { text: card.name }),
          el("button", { type: "button", class: "btn-small", text: "本卡回" + baseWord(p), onclick: function () {
            if (!confirm("「" + card.name + "」的設定全部回到" + baseWord(p) + "值，要繼續嗎？")) return;
            itemsOf(p, card).forEach(function (it) { delete stored(p)[it.id]; });
            saveStore();
            cache = null;
            render();
          } })
        ]),
        pinBox
      ].concat(pluginNodes("pin", p, card))),
      el("div", { class: "rows" }, body),
      el("p", { class: "hint", text: "點欄位名稱看說明與調整後特性。" + (drawn.length ? "虛線是原廠值。" : "") +
        (figItems.length ? "「原廠圖」是官方的圖，紅色是目前的設定。" : "") }),
      el("button", { type: "button", class: "btn back-bottom", text: "‹ 回總覽", onclick: closeCard })
    ]);
  }

  /* ---------- 總覽頁 ---------- */

  function cardButton(p, card) {
    var st = state(p);
    var changed = itemsOf(p, card).filter(function (it) { return isChanged(p, it); }).length;
    var lines = (card.summary || []).map(function (pair) {
      var it = findItem(p, pair[1]);
      var value = it ? pretty(it, st.eff[it.id]) : "";
      return el("span", { class: "card-line", text: pair[0] + " " + (value || "—") });
    });
    if (!lines.length) lines = [el("span", { class: "card-line", text: itemsOf(p, card).length + " 項" })];
    return el("button", {
      type: "button", class: "card-btn" + (changed ? " is-changed" : ""),
      onclick: function () { openCard(card.id); }
    }, [
      el("span", { class: "card-name", text: card.name }),
      changed ? el("span", { class: "badge", title: "和" + baseWord(p) + "不同的項目數", text: String(changed) }) : null
    ].concat(lines).concat(pluginNodes("card", p, card)));
  }

  function renderStage(p, cards) {
    var used = {};
    function slot(name) {
      var card = cards.filter(function (c) { return c.slot === name; })[0];
      if (!card) return null;
      used[card.id] = true;
      return cardButton(p, card);
    }
    var stage = el("div", { class: "stage" }, [
      el("div", { class: "stage-row" }, [slot("t1"), slot("t2")]),
      el("div", { class: "stage-mid" }, [
        el("div", { class: "stage-col" }, ["l1", "l2", "l3", "l4", "l5"].map(slot)),
        el("div", { class: "stage-car" }, [diagramBox(p, "map")]),
        el("div", { class: "stage-col" }, ["r1", "r2", "r3", "r4", "r5"].map(slot))
      ]),
      el("div", { class: "stage-row" }, [slot("b1"), slot("b2")])
    ]);
    var rest = cards.filter(function (c) { return !used[c.id]; });
    if (rest.length) stage.appendChild(el("div", { class: "card-grid" }, rest.map(function (c) { return cardButton(p, c); })));
    stage.appendChild(el("div", { class: "stage-side" }, [diagramBox(p, "side")]));
    return stage;
  }

  function renderToolbar(p) {
    var file = el("input", {
      type: "file", accept: ".csv,text/csv", hidden: "",
      onchange: function () {
        var f = file.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var r = applyCsv(String(reader.result));
            view.message = "已匯入 " + r.applied + " 筆" + (r.skipped ? "，略過 " + r.skipped + " 筆對不上的列" : "");
          } catch (e) {
            view.message = "匯入失敗：" + e.message;
          }
          render();
        };
        reader.readAsText(f, "utf-8");
      }
    });

    function button(text, onclick, cls) {
      return el("button", { type: "button", class: "btn" + (cls ? " " + cls : ""), text: text, onclick: onclick });
    }

    return el("div", { class: "toolbar" }, [
      button("匯出 CSV", function () {
        download("rc_setting_" + p.id + "_" + stamp() + ".csv", toCsv(p));
      }, "btn-main"),
      button("匯入 CSV", function () {
        if (confirm("匯入會覆蓋檔案裡有列出的欄位，要繼續嗎？")) { file.value = ""; file.click(); }
      }),
      button("全部回" + baseWord(p) + "值", function () {
        if (!confirm(p.name + " 的設定全部回到" + baseWord(p) + "值，要繼續嗎？")) return;
        store[p.id] = {};
        saveStore();
        cache = null;
        view.message = "已全部回到" + baseWord(p) + "值";
        render();
      }),
      file
    ]);
  }

  function renderOverview(p) {
    var cards = cardsOf(p);
    var st = state(p);
    var total = 0, known = 0, filled = 0;
    eachItem(p, function (it) {
      if (isChanged(p, it)) total++;
      if (it.calc) return;
      if (st.base[it.id]) known++;
      else if (st.eff[it.id]) filled++;
    });
    // 說明書完全沒寫原廠值的產品（例如要接設定盒才讀得到參數的伺服機）沒有「和原廠不同」可言，改報已填幾項
    var headNote = total ? "有 " + total + " 項和" + baseWord(p) + "不同"
      : known ? "全部是" + baseWord(p) + "值"
      : "已填 " + filled + " 項，說明書沒有出廠值";
    return el("div", {}, [
      el("div", { class: "phead" }, [
        el("h2", { text: p.name }),
        el("span", { class: "phead-note", text: headNote })
      ]),
      p.cards && Diagram && p.derive
        ? renderStage(p, cards)
        : el("div", { class: "card-grid" }, cards.map(function (c) { return cardButton(p, c); })),
      renderToolbar(p),
      el("p", { class: "message", role: "status", "aria-live": "polite", text: view.message })
    ].concat(pluginNodes("overview", p, p)).concat([
      el("details", { class: "fold" }, [
        el("summary", { text: "說明書下載" }),
        el("ul", { class: "manuals" }, (p.manuals || []).map(function (mn) {
          return el("li", {}, [
            el("a", { href: mn.url, target: "_blank", rel: "noopener", text: mn.title }),
            mn.note ? el("span", { class: "manual-note", text: mn.note }) : null
          ]);
        }))
      ]),
      el("details", { class: "fold" }, [
        el("summary", { text: "規格與說明" }),
        p.desc ? el("p", { class: "fold-text", text: p.desc }) : null,
        p.spec ? el("ul", { class: "fold-list" }, p.spec.map(function (s) { return el("li", { text: s }); })) : null,
        p.notes ? el("ul", { class: "fold-list" }, p.notes.map(function (n) { return el("li", { text: n }); })) : null,
        known ? el("p", { class: "fold-text", text: "每個欄位都有預設值（原廠值），只需要改不一樣的項目；改過的欄位與卡片會標上顏色。" }) : null
      ])
    ]));
  }

  /* ---------- 整頁 ---------- */

  function renderTabs() {
    var tabs = document.getElementById("tabs");
    tabs.textContent = "";
    CATEGORIES.forEach(function (cat) {
      tabs.appendChild(el("button", {
        type: "button",
        class: "tab" + (cat === view.category ? " is-on" : ""),
        "aria-pressed": cat === view.category ? "true" : "false",
        text: cat,
        onclick: function () {
          view.category = cat;
          view.productId = null;
          view.cardId = null;
          view.message = "";
          render();
        }
      }));
    });
  }

  function render() {
    renderTabs();
    liveViews = [];
    fields = {};
    cache = null;
    var app = document.getElementById("app");
    var scroll = window.scrollY;
    app.textContent = "";

    var list = products.filter(function (p) { return p.category === view.category; });
    if (!list.length) {
      app.appendChild(el("p", { class: "empty", text: "「" + view.category + "」還沒有建立子項目。每個子項目會先找到它的說明書再建立。" }));
      return;
    }

    var current = list.filter(function (p) { return p.id === view.productId; })[0] || list[0];
    view.productId = current.id;
    var card = cardsOf(current).filter(function (c) { return c.id === view.cardId; })[0];
    if (!card) view.cardId = null;

    if (!card && list.length > 1) {
      var picker = el("select", {
        class: "picker", "aria-label": "選擇子項目",
        onchange: function () { view.productId = picker.value; view.message = ""; render(); }
      }, list.map(function (p) { return el("option", { value: p.id, text: p.name }); }));
      picker.value = current.id;
      app.appendChild(picker);
    }

    app.appendChild(card ? renderEditor(current, card) : renderOverview(current));
    window.scrollTo(0, scroll);
  }

  render();

  // 給測試與除錯用
  window.RCApp = { toCsv: toCsv, parseCsv: parseCsv, applyCsv: applyCsv, sameValue: sameValue, openCard: openCard, closeCard: closeCard };
})();
