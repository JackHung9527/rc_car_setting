/*
 * 伺服機：Power HD TDS-2（1/10 甩尾車用的高壓數位伺服機）
 *
 * 欄位與說明來源（都在 manuals 清單裡）：
 *   - TDS-2 規格書（Digital Servo TDS-2，Version V1，3 頁）：電氣、機械、控制特性與尺寸圖
 *   - 官網產品頁：8.4 V 的扭力與速度、馬達、軸承（規格書的電氣特性只列 6.0 V 與 7.4 V）
 *   - PG-CB63 設定盒說明書：八個可調參數、可調範圍、調整後特性
 *
 * 參數要接 PG-CB63 設定盒（或設定盒接電腦的 PowerHD USB-Link 軟體）才能改。
 * 設定盒說明書是各型號共用的，沒有寫 TDS-2 的出廠值，所以參數欄位不寫 factory，沒填之前是空的；
 * 可調範圍說明書有寫，所以有 min／max。
 *
 * 規格是唯讀的 calc 欄位（回傳固定文字），圖表和它用同一組常數。
 * effect 每一筆的來源：
 *   m(...) 說明書原文有寫的特性
 * charts 只有 js/visual.js 會讀，格式見該檔開頭；尺寸圖與角度圖是用 svg 回傳自己畫的圖。
 */
(function () {
  "use strict";

  function m(when, then) { return { w: when, t: then, manual: true }; }

  var SITE = "https://www.chd.hk/";
  var NO_FACTORY = "說明書沒有寫 TDS-2 的出廠值，請填設定盒 Read Data 讀回來的數值";

  /* ---------- 規格書的數值 ---------- */

  // 6.0 V、7.4 V 出自規格書 4-1、4-3；8.4 V 出自官網產品頁
  var VOLTS = [6.0, 7.4, 8.4];
  var TORQUE = [18.0, 22.0, 25.0];      // kg-cm
  var SPEED = [0.13, 0.10, 0.09];       // 秒/60°

  // 規格書第 3 頁尺寸圖上標的數字，單位 mm
  var DIM = {
    body: 41.0, width: 20.0, height: 29.0,     // 本體長、寬、高（高不含輸出軸）
    overall: 54.4, tall: 34.0,                 // 含固定耳全長、含輸出軸全高
    holeL: 49.0, holeW: 10.0,                  // 固定孔距：長向、橫向
    earLow: 19.7, earHigh: 22.2                // 固定耳下緣、上緣離底面的高度
  };
  // 尺寸圖沒有標、只用來畫示意圖的數字
  var SHAFT_X = 30.4, BOSS_R = 5.5, SPLINE_R = 2.9, HOLE_R = 1.7;

  // 規格書 6-3、6-4、6-7、6-8
  var PULSE = { min: 800, low: 1000, mid: 1500, high: 2000, max: 2200, travel: 90, maxTravel: 110 };

  function join(list, digits) {
    return list.map(function (n) { return n.toFixed(digits); }).join("／");
  }

  /* ---------- 自己畫的圖 ---------- */

  var NS = "http://www.w3.org/2000/svg";
  // 畫布比 js/visual.js 的曲線圖扁：釘在編輯頁上方的圖高度上限是 148px，照這個比例字才不會被縮小
  var W = 328, H = 152;

  function s(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function label(x, y, str, anchor, cls) {
    var t = s("text", { x: x, y: y, "text-anchor": anchor || "middle", class: cls || "vz-text" });
    t.textContent = str;
    return t;
  }

  function canvas(title, kids) {
    return s("svg", { viewBox: "0 0 " + W + " " + H, class: "vz-svg", role: "img", "aria-label": title }, kids);
  }

  function r1(n) { return n.toFixed(1); }

  // 水平尺寸線：數字寫在線中間的缺口，兩端的延伸線拉到 to 這個高度
  function hDim(x1, x2, y, str, to) {
    var mid = (x1 + x2) / 2, gap = 12;
    return [
      s("path", { class: "vz-dim", d: "M" + r1(x1) + " " + (y - 3) + "V" + r1(to) + "M" + r1(x2) + " " + (y - 3) + "V" + r1(to) +
        "M" + r1(x1) + " " + y + "H" + r1(mid - gap) + "M" + r1(mid + gap) + " " + y + "H" + r1(x2) }),
      label(mid, y + 3.5, str)
    ];
  }

  // 垂直尺寸線：數字寫在 at 這個高度的缺口，兩端的延伸線各拉到 to1、to2
  function vDim(x, y1, y2, str, at, to1, to2) {
    return [
      s("path", { class: "vz-dim", d: "M" + (x - 3) + " " + r1(y1) + "H" + r1(to1) + "M" + (x - 3) + " " + r1(y2) + "H" + r1(to2) +
        "M" + x + " " + r1(y1) + "V" + (at - 7) + "M" + x + " " + (at + 5) + "V" + r1(y2) }),
      label(x, at + 3.5, str)
    ];
  }

  function dimsFigure() {
    var title = "外形尺寸";
    var k = 1.8;                                   // 1 mm 畫成幾個單位
    var ear = (DIM.overall - DIM.body) / 2;        // 固定耳伸出本體的長度
    var hole = (DIM.overall - DIM.holeL) / 2;      // 固定孔中心離端面的距離
    var kids = [];
    function add(list) { kids = kids.concat(list); }

    // 俯視
    var x0 = 58, y0 = 33;
    function tx(mm) { return x0 + mm * k; }
    function ty(mm) { return y0 + mm * k; }
    var holeY = [(DIM.width - DIM.holeW) / 2, (DIM.width + DIM.holeW) / 2];
    add([
      s("rect", { class: "vz-shape2", x: x0, y: y0, width: r1(DIM.overall * k), height: DIM.width * k, rx: 3 }),
      s("rect", { class: "vz-shape", x: r1(tx(ear)), y: y0, width: r1(DIM.body * k), height: DIM.width * k, rx: 3 })
    ]);
    [hole, DIM.overall - hole].forEach(function (hx) {
      holeY.forEach(function (hy) {
        kids.push(s("circle", { class: "vz-hole", cx: r1(tx(hx)), cy: r1(ty(hy)), r: r1(HOLE_R * k) }));
      });
    });
    add([
      s("circle", { class: "vz-hole", cx: r1(tx(ear + SHAFT_X)), cy: r1(ty(DIM.width / 2)), r: r1(BOSS_R * k) }),
      s("circle", { class: "vz-shape2", cx: r1(tx(ear + SHAFT_X)), cy: r1(ty(DIM.width / 2)), r: r1(SPLINE_R * k) })
    ]);
    add(hDim(tx(0), tx(DIM.overall), 7, r1(DIM.overall), y0));
    add(hDim(tx(hole), tx(DIM.overall - hole), 16.5, r1(DIM.holeL), y0));
    add(hDim(tx(ear), tx(ear + DIM.body), 26, r1(DIM.body), y0));
    add(vDim(Math.round(tx(DIM.overall)) + 14, ty(holeY[0]), ty(holeY[1]), r1(DIM.holeW), y0 + DIM.width * k / 2,
      tx(DIM.overall - hole), tx(DIM.overall - hole)));

    // 側視與正視共用同一條底線
    var base = 138;
    function up(mm) { return base - mm * k; }
    function finLines(xa, xb) {
      return [7.5, 9.5, 11.5, 13.5].map(function (mm) {
        return s("path", { class: "vz-dim", d: "M" + r1(xa) + " " + r1(up(mm)) + "H" + r1(xb) });
      });
    }
    function shaft(cx) {
      return [
        s("rect", { class: "vz-shape2", x: r1(cx - BOSS_R * k), y: r1(up(DIM.height + 0.8)), width: r1(BOSS_R * 2 * k), height: r1(0.8 * k) }),
        s("rect", { class: "vz-shape2", x: r1(cx - SPLINE_R * k), y: r1(up(DIM.tall)), width: r1(SPLINE_R * 2 * k), height: r1((DIM.tall - DIM.height - 0.8) * k) })
      ];
    }

    // 側視
    var bl = tx(ear), br = tx(ear + DIM.body);
    add([
      s("rect", { class: "vz-shape2", x: x0, y: r1(up(DIM.earHigh)), width: r1(DIM.overall * k), height: r1((DIM.earHigh - DIM.earLow) * k) }),
      s("path", { class: "vz-shape", d: "M" + r1(bl) + " " + base + "V" + r1(up(26.3)) + "L" + r1(bl + 2.8 * k) + " " + r1(up(DIM.height)) +
        "H" + r1(br - 0.7 * k) + "L" + r1(br) + " " + r1(up(26.5)) + "V" + base + "Z" })
    ]);
    add(finLines(bl, br));
    add(shaft(tx(ear + SHAFT_X)));
    add(vDim(10, up(DIM.height), base, r1(DIM.height), 104, bl + 2.8 * k, bl));
    add(vDim(27, up(DIM.earHigh), base, r1(DIM.earHigh), 114, x0, 27));
    add(vDim(44, up(DIM.earLow), base, r1(DIM.earLow), 124, x0, 44));

    // 正視
    var fx = 222, fw = DIM.width * k;
    add([
      s("rect", { class: "vz-shape", x: fx, y: r1(up(DIM.height)), width: fw, height: r1(DIM.height * k), rx: 2 }),
      s("rect", { class: "vz-shape2", x: fx, y: r1(up(DIM.earHigh)), width: fw, height: r1((DIM.earHigh - DIM.earLow) * k) })
    ]);
    add(finLines(fx, fx + fw));
    add(shaft(fx + fw / 2));
    add(vDim(fx + fw + 14, up(DIM.tall), base, r1(DIM.tall), 108, fx + fw / 2 + SPLINE_R * k, fx + fw));
    add(hDim(fx, fx + fw, 146, r1(DIM.width), base));

    add([
      label(W - 4, 12, "本體 " + r1(DIM.body) + " × " + r1(DIM.width) + " × " + r1(DIM.height), "end"),
      label(W - 4, 25, "重量 61 ± 1 g", "end"),
      label(W - 4, 38, "單位 mm", "end")
    ]);

    return {
      title: title,
      svg: canvas(title, kids),
      note: "上：俯視；左下：側視；右下：正視。數字是規格書第 3 頁尺寸圖標的尺寸；外形細節與輸出軸的位置沒有標尺寸，只是示意。"
    };
  }

  function travelFigure() {
    var title = "脈寬與輸出軸角度";
    var cx = 164, cy = 128, R = 84;
    var half = PULSE.travel / 2, halfMax = PULSE.maxTravel / 2;
    // 角度從正上方起算、逆時針為正
    function at(deg, r) {
      var a = deg * Math.PI / 180;
      return [cx - r * Math.sin(a), cy - r * Math.cos(a)];
    }
    function arc(from, to, r) {
      var a = at(from, r), b = at(to, r);
      return "M" + r1(a[0]) + " " + r1(a[1]) + "A" + r + " " + r + " 0 0 0 " + r1(b[0]) + " " + r1(b[1]);
    }
    function spoke(deg) {
      var a = at(deg, R - 8), b = at(deg, R + 5);
      return s("path", { class: "vz-dim", d: "M" + r1(a[0]) + " " + r1(a[1]) + "L" + r1(b[0]) + " " + r1(b[1]) });
    }
    function tag(deg, str, dy) {
      var p = at(deg, R + 10);
      return label(p[0], p[1] + dy, str, deg > 0 ? "end" : "start");
    }
    var k = 1.6, tip = at(0, R - 12);
    var kids = [
      // 伺服機本體（俯視），輸出軸在圓心
      s("rect", { class: "vz-shape", x: r1(cx - SHAFT_X * k), y: cy - DIM.width * k / 2, width: DIM.body * k, height: DIM.width * k, rx: 3 }),
      s("path", { class: "vz-line vz-guess", d: arc(-halfMax, -half, R) }),
      s("path", { class: "vz-line vz-guess", d: arc(half, halfMax, R) }),
      s("path", { class: "vz-line vz-main", d: arc(-half, half, R) }),
      spoke(-halfMax), spoke(-half), spoke(0), spoke(half), spoke(halfMax),
      // 舵片停在中立
      s("path", { class: "vz-horn", d: "M" + cx + " " + cy + "L" + r1(tip[0]) + " " + r1(tip[1]) }),
      s("circle", { class: "vz-hole", cx: cx, cy: cy, r: BOSS_R * k }),
      s("circle", { class: "vz-shape2", cx: cx, cy: cy, r: SPLINE_R * k }),
      label(cx, cy - R - 10, PULSE.mid + " μs（中立）"),
      tag(half, PULSE.high + " μs", -4),
      tag(halfMax, PULSE.max + " μs", 9),
      tag(-half, PULSE.low + " μs", -4),
      tag(-halfMax, PULSE.min + " μs", 9),
      label(cx - 8, cy - 50, "← 加大", "end"),
      label(cx + 8, cy - 50, "減小 →", "start"),
      label(4, cy - 4, "實線 " + PULSE.travel + "°", "start"),
      label(4, cy + 9, PULSE.low + "→" + PULSE.high + " μs", "start"),
      label(W - 4, cy - 4, "虛線 約 " + PULSE.maxTravel + "°", "end"),
      label(W - 4, cy + 9, PULSE.min + "→" + PULSE.max + " μs", "end")
    ];
    return {
      title: title,
      svg: canvas(title, kids),
      note: "實線：" + PULSE.low + "→" + PULSE.high + " μs 轉 " + PULSE.travel + "°（規格書 6-3）。虛線：" + PULSE.min + "→" + PULSE.max +
        " μs 合計約 " + PULSE.maxTravel + "°（規格書 6-8）。脈寬由 " + PULSE.mid + " 加大到 " + PULSE.high +
        " μs 時逆時針轉（規格書 6-6）；規格書沒有寫從哪一面看，圖上當作面對輸出軸。"
    };
  }

  /* ---------- 曲線圖 ---------- */

  // 橫軸只畫 5 V 以上，三個點才不會擠在右邊；曲線圖的軸固定從 0 開始，所以先減 5 再用 fmt 加回來
  var V0 = 5;
  var VOLT_AXIS = {
    label: "電壓 V", max: 4,
    ticks: VOLTS.map(function (v) { return v - V0; }),
    fmt: function (t) { return (t + V0).toFixed(1); }
  };
  var POINT_NOTE = "6.0 V、7.4 V 的點出自規格書，8.4 V 出自官網產品頁；虛線只是把三個點連起來。";

  function byVolt(title, values, digits, yAxis, note) {
    var pts = VOLTS.map(function (v, i) { return [v - V0, values[i]]; });
    return {
      title: title,
      x: VOLT_AXIS,
      y: yAxis,
      lines: [{ kind: "guess", points: pts }],
      dots: pts.map(function (p) { return { x: p[0], y: p[1], kind: "main" }; }),
      marks: pts.map(function (p) { return { x: p[0], label: p[1].toFixed(digits) }; }),
      note: note + POINT_NOTE
    };
  }

  function torqueChart() {
    return byVolt("扭力與電壓", TORQUE, 1, { label: "扭力 kg-cm", max: 30, ticks: [0, 10, 20, 30] }, "");
  }

  function speedChart() {
    return byVolt("速度與電壓", SPEED, 2, { label: "秒/60°", max: 0.15, ticks: [0, 0.05, 0.1, 0.15] }, "數值越小越快。");
  }

  // 設定輪廓：六個分段參數各畫一根，高度就是設定值
  var PROFILE = [
    ["max_power", "輸出", 10], ["boost", "爆發", 10], ["dead_band", "死區", 10],
    ["tension", "繃緊", 3], ["force", "力度", 10], ["brake", "剎車", 10]
  ];
  var PROFILE_IDS = PROFILE.map(function (row) { return row[0]; });

  function profileChart(v) {
    var title = "設定輪廓";
    var lines = [], dots = [];
    PROFILE.forEach(function (row, i) {
      var x = i + 1, n = parseFloat(v[row[0]]);
      // 可調上限，繃緊度只到 3
      lines.push({ kind: "ref", points: [[x - 0.3, row[2]], [x + 0.3, row[2]]] });
      if (isNaN(n)) return;
      lines.push({ kind: "main", points: [[x, 0], [x, n]] });
      dots.push({ x: x, y: n, kind: "main" });
    });
    if (!dots.length) return { title: title, empty: "用設定盒 Read Data 讀回伺服機的數值、填進下面的欄位後顯示。" };
    return {
      title: title,
      x: { label: "", max: 6.5, ticks: [1, 2, 3, 4, 5, 6], fmt: function (t) { return PROFILE[t - 1][1]; } },
      y: { label: "設定值", max: 10, ticks: [0, 5, 10] },
      lines: lines,
      dots: dots,
      note: "每根的高度是設定值，上方的短虛線是可調上限（繃緊度只到 3）。中位調節與緩啟動不在圖上。"
    };
  }

  /* ---------- 欄位 ---------- */

  function level(id, name, en, max, fnote, effect) {
    return { id: id, name: name, en: en, type: "num", min: 1, max: max, step: 1, fnote: fnote + NO_FACTORY, effect: effect };
  }

  // 規格：唯讀，值固定
  function fixed(id, name, value, unit, en, fnote) {
    var it = { id: id, name: name, type: "text", calc: function () { return value; } };
    if (unit) it.unit = unit;
    if (en) it.en = en;
    if (fnote) it.fnote = fnote;
    return it;
  }

  var SPEC_NOTE = "規格是固定的，不能改；點名稱可以看規格書上的項目編號與出處。";
  var FROM_SITE = "出自官網產品頁，規格書沒有列";
  var V84 = "6.0 V 與 7.4 V 出自規格書，8.4 V 出自官網產品頁";

  /* ---------- 產品定義 ---------- */

  (window.RC_PRODUCTS = window.RC_PRODUCTS || []).push({
    id: "powerhd-tds2",
    category: "伺服機",
    name: "Power HD TDS-2",
    desc: "1/10 甩尾車用的高壓數位伺服機，本體高 29 mm；八個參數要接 PG-CB63 設定盒才能調整",
    spec: [
      "扭力：" + join(TORQUE, 1) + " kg-cm（" + join(VOLTS, 1) + " V）",
      "速度：" + join(SPEED, 2) + " 秒/60°（" + join(VOLTS, 1) + " V，空載）",
      "工作電壓：6.0–8.4 V；PWM 控制、333 Hz 數位",
      "尺寸／重量：41.0×20.0×29.0 mm（含固定耳全長 54.4、含輸出軸全高 34.0）／61 ± 1 g",
      "無鐵芯馬達、鈦＋鋼齒輪、滾珠軸承 ×2；輸出軸 25T",
      "完整規格、尺寸圖與角度圖在三張「規格」卡片"
    ],
    manuals: [
      { title: "TDS-2 規格書 Specification（中英對照）", url: SITE + "UploadFiles/Att/2024111314082653.pdf", note: "PDF，約 0.5 MB；Version V1，3 頁，第 3 頁是尺寸圖" },
      { title: "PG-CB63 設定盒說明書（英文＋簡體中文）", url: SITE + "UploadFiles/Att/2024110615362858.pdf", note: "PDF，約 1.2 MB；參數表、可調範圍、操作步驟" },
      { title: "PG-CB63 接電腦的軟體 PowerHD Ver.1.3 使用說明", url: SITE + "UploadFiles/Att/2026031015404659.pdf", note: "PDF，約 0.6 MB；用電腦調參數、設定盒韌體升級" },
      { title: "TDS-2 官方產品頁", url: SITE + "Product_Detail.aspx?id=238", note: "8.4 V 的扭力與速度、馬達、軸承出自這一頁" },
      { title: "PG-CB63 官方產品頁", url: SITE + "Product_Detail.aspx?id=204", note: "適用型號清單（含 TDS-2）與電腦軟體的下載位址" }
    ],
    notes: [
      "參數要接 PG-CB63 設定盒才能改（官網產品頁：Compatible with program box only）。設定盒要另外供電 5–8.4 V，改完要選 9. Write Data → To Servo 寫進伺服機才會生效。",
      "設定盒說明書是各型號共用的，沒有寫 TDS-2 的出廠值，所以參數欄位一開始是空的。先用 10. Read Data → From Servo 讀回伺服機目前的數值再填；11. Default 可以把伺服機還原成出廠參數。",
      "說明書提醒：非專業車手不建議把數值調得比出廠設定高，數值太高會多耗電、發熱；Boost、Tension、Force、Brake 四項會互相影響，要依實際需要一起調。",
      "中立位置規格書寫 1500 μs，官網產品頁寫的是 Working frequency：1520μs / 333hz，兩處不一致，這裡照規格書。",
      "規格書（V1）的電氣特性只列 6.0 V 與 7.4 V；8.4 V 的扭力與速度出自官網產品頁。規格書 4-4 停止電流的單位印成 mAh，這裡照電流的單位寫 mA。",
      "供電電壓由電變的 BEC 決定，記在電變那邊，這裡不重複。"
    ],
    cards: [
      { id: "params", name: "設定盒參數", groups: ["params"], summary: [["輸出", "max_power"], ["爆發", "boost"], ["死區", "dead_band"], ["中位", "center"]] },
      { id: "record", name: "設定盒記錄", groups: ["record"], summary: [["記憶組", "box_memory"]] },
      // 規格書的三個章節各一張卡片，各自釘自己的圖
      { id: "spec_e", name: "規格：電氣", groups: ["spec_e"], summary: [["電壓", "sp_volt"], ["待機", "sp_idle"]] },
      { id: "spec_m", name: "規格：機械", groups: ["spec_m"], summary: [["全長", "sp_len"], ["全高", "sp_tall"], ["重量", "sp_weight"]] },
      { id: "spec_c", name: "規格：控制", groups: ["spec_c"], summary: [["中立", "sp_neutral"], ["死區", "sp_deadband"]] }
    ],
    groups: [
      {
        id: "params",
        name: "設定盒參數",
        src: "PG-CB63 設定盒說明書 Parameters（編程卡參數介紹）",
        note: "接 PG-CB63 設定盒調整，改完要 Write Data → To Servo 才生效。說明書沒有寫 TDS-2 的出廠值，先用 Read Data → From Servo 讀回目前的數值再填。",
        charts: [{ name: "設定輪廓", after: "brake", uses: PROFILE_IDS, build: profileChart }],
        items: [
          level("max_power", "最大輸出", "1. Max Power", 10, "伺服機最終的輸出，也就是最大扭力與速度。", [
            m("數值加大", "扭力變大、速度變快，但耗電與發熱也增加")
          ]),
          level("boost", "啟動爆發力", "2. Boost", 10, "伺服機開始擺動時頭段的爆發力（punch）。", [
            m("數值加大", "頭段爆發力變強、速度變快，發熱增加")
          ]),
          level("dead_band", "死區", "3. Dead Band", 10, "訊號變化多小以內伺服機不動作。規格書的死區寬度是 2 μs，和這裡的 1–10 怎麼對應說明書沒有寫。", [
            m("數值加大", "比較能抑制抖動，但反應時間變長")
          ]),
          level("tension", "繃緊度", "4. Tension", 3, "只有 1–3 三段。", [
            m("數值加大", "反應速度變快、手感更跟手，但容易引起異常抖動與發熱")
          ]),
          level("force", "力度", "5. Force", 10, "單獨調整輸出扭力，主要影響靜止以及再次擺動時的瞬間扭力（中文版說明書）。", [
            m("數值加大", "扭力變大，發熱增加")
          ]),
          level("brake", "剎車", "6. Brake", 10, "馬達煞停的時機。", [
            m("數值加大", "馬達提早煞車，減少過衝與抖動，但擺動速度變慢")
          ]),
          {
            id: "center", name: "中位調節", en: "7. Center", type: "num", min: -10, max: 10, step: 1, start: 0, signed: true,
            fnote: "微調伺服機的中位角度。設定盒上顯示 L10–0–R10，這裡用負數記 L、正數記 R（L3 記成 -3，R3 記成 +3）。說明書沒有寫一格是幾度，也沒有寫 L、R 各往哪個方向轉。" + NO_FACTORY
          },
          {
            id: "soft_start", name: "緩啟動", en: "8. Soft Start", type: "select", options: ["關（N）", "開（Y）"],
            fnote: "通電時伺服機不在中位的話，要不要慢慢回到中位。" + NO_FACTORY,
            effect: [
              m("開（Y）", "通電瞬間緩慢回到中位"),
              m("注意", "設成 Y 時，設定盒的 Servo Test 功能可能無法正常運作")
            ]
          }
        ]
      },
      {
        id: "spec_e",
        name: "電氣特性",
        src: "TDS-2 規格書 1. Apply Environmental Condition、4. Electrical Specification；8.4 V 的數值出自官網產品頁",
        note: SPEC_NOTE,
        charts: [
          { name: "扭力", uses: [], build: torqueChart },
          { name: "速度", uses: [], build: speedChart }
        ],
        items: [
          fixed("sp_volt", "操作電壓", "6.0 ~ 8.4", "V", "1-3 Operating Voltage Range"),
          fixed("sp_torque", "扭力（" + join(VOLTS, 1) + " V）", join(TORQUE, 1), "kg-cm", "4-3 Stall torque (at locked)", V84 + "（347.2 oz/in）"),
          fixed("sp_speed", "速度（" + join(VOLTS, 1) + " V）", join(SPEED, 2), "秒/60°", "4-1 Operating speed (at no load)", "空載轉 60° 的時間。" + V84),
          fixed("sp_stall", "堵轉電流（6.0／7.4 V）", "1900／2400", "mA", "4-4 Stall current (at locked)", "規格書把單位印成 mAh，這裡照電流的單位寫 mA"),
          fixed("sp_run", "空載電流（6.0／7.4 V）", "400／400", "mA", "4-2 Running current at no load (Slow to Fast)", "伺服機無負載運轉時的平均值（規格書註）"),
          fixed("sp_idle", "待機電流（6.0／7.4 V）", "60／70", "mA", "4-5 Idle current (at stopped)"),
          fixed("sp_temp", "溫度範圍", "操作 -10 ~ 60，保存 -20 ~ 60", "℃", "1-1 Storage Temperature Range；1-2 Operating Temperature Range")
        ]
      },
      {
        id: "spec_m",
        name: "機械特性",
        src: "TDS-2 規格書 5. Mechanical Specification 與第 3 頁尺寸圖；馬達與軸承出自官網產品頁",
        note: SPEC_NOTE,
        charts: [{ name: "尺寸", uses: [], build: dimsFigure }],
        items: [
          fixed("sp_size", "本體長 × 寬 × 高", r1(DIM.body) + " × " + r1(DIM.width) + " × " + r1(DIM.height), "mm", "5-1 Overall Dimensions",
            "高 29.0 是底面到上蓋頂面，不含輸出軸"),
          fixed("sp_len", "含固定耳全長", r1(DIM.overall), "mm"),
          fixed("sp_tall", "含輸出軸全高", r1(DIM.tall), "mm"),
          fixed("sp_mount", "固定孔距（長向 × 橫向）", r1(DIM.holeL) + " × " + r1(DIM.holeW), "mm", "",
            "尺寸圖上的 49.0 與 10.0，量的是固定孔中心到中心"),
          fixed("sp_ear", "固定耳高度（底面起算）", r1(DIM.earLow) + " ~ " + r1(DIM.earHigh), "mm", "",
            "尺寸圖上的 19.7 與 22.2：固定耳下緣與上緣離底面的高度，相減得耳厚 2.5 mm"),
          fixed("sp_weight", "重量", "61 ± 1", "g", "5-3 Weight"),
          fixed("sp_spline", "輸出軸齒數", "25T（ψ5.8）", "", "5-6 Horn gear spline：ψ5.8*25T"),
          fixed("sp_horn", "附的舵片", "半臂、一字", "", "5-7 Horn type：Single, Double"),
          fixed("sp_gear", "齒輪", "鈦＋鋼，減速比 1/217", "", "5-8 Reduction ratio；5-9 Materials of the gear：Titanium & Steel"),
          fixed("sp_motor", "馬達與軸承", "無鐵芯馬達，滾珠軸承 ×2", "", "Coreless Motor；Ball Bearing x 2", FROM_SITE),
          fixed("sp_wire", "導線", "#28 AWG，長 120 ± 5 mm", "", "5-4 Connector wire gauge：#28 AWG 0.08*60；5-5 Connector wire length"),
          fixed("sp_limit", "機構極限角度", "180 ± 10", "°", "5-2 Limit angle")
        ]
      },
      {
        id: "spec_c",
        name: "控制特性",
        src: "TDS-2 規格書 6. Control Specification",
        note: SPEC_NOTE,
        charts: [{ name: "角度", uses: [], build: travelFigure }],
        items: [
          fixed("sp_signal", "控制訊號", "PWM，333 Hz 數位", "", "6-1 Control system：Pulse Width Modification；6-2 Amplifier type：333Hz Digital Controller"),
          fixed("sp_neutral", "中立位置", String(PULSE.mid), "μs", "6-4 Neutral position", "官網產品頁寫的是 Working frequency：1520μs / 333hz，和規格書不一致"),
          fixed("sp_travel", "操作角度", PULSE.travel + "°（" + PULSE.low + "→" + PULSE.high + " μs）", "", "6-3 Operating travel"),
          fixed("sp_max_travel", "最大作動角度", "約 " + PULSE.maxTravel + "°（" + PULSE.min + "→" + PULSE.max + " μs）", "", "6-8 Maximum travel"),
          fixed("sp_pulse", "脈寬範圍", PULSE.min + " → " + PULSE.max, "μs", "6-7 Pulse width range"),
          fixed("sp_deadband", "死區寬度", "2", "μs", "6-5 Dead band width", "設定盒的 Dead Band（1–10）也是調死區，兩者怎麼對應說明書沒有寫"),
          fixed("sp_dir", "旋轉方向", "逆時針（" + PULSE.mid + "→" + PULSE.high + " μs）", "", "6-6 Rotating direction：Counterclockwise", "規格書沒有寫是從哪一面看")
        ]
      },
      {
        id: "record",
        name: "設定盒記錄",
        src: "PG-CB63 設定盒說明書 Saving settings procedures、How to read data；20 組記憶出自中文版",
        note: "設定盒本身可以存 20 組參數。存進設定盒只是備份，要寫進伺服機（To Servo）才會生效。",
        items: [
          {
            id: "box_memory", name: "存在設定盒第幾組", en: "9. Write Data → To Memory（DATA 01–20）", type: "num", min: 1, max: 20, step: 1,
            fnote: "這一頁記的參數存在設定盒的哪一組。之後用 10. Read Data → From Memory 選同一組就能叫回來"
          },
          {
            id: "box_id", name: "設定盒顯示的型號字串", en: "設定盒畫面第一行", type: "text",
            fnote: "設定盒讀到伺服機之後，畫面第一行顯示的字串。說明書的範例是 S15 的「v1.2 PGB-S15-00」；TDS-2 會顯示什麼說明書沒有寫，照實際畫面填"
          }
        ]
      }
    ]
  });
})();
