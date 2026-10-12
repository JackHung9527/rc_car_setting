/*
 * 設定示意圖：自己畫的 SVG，跟著欄位數值即時變化（不使用說明書的圖檔）。
 *
 * draw(kind, cur, fac, opt)
 *   kind：map        整台車的俯視圖（總覽頁中央那張）
 *         top-front／top-rear   俯視圖裁出前軸／後軸：前束、後束、輪距
 *         links      全車拉桿：車頭朝右的俯視圖，每支拉桿標出長度
 *         car        零件位置：車頭朝右的整車俯視圖，強調 opt.hot 的部位，下方寫 opt.caption
 *         front／rear           前軸／後軸正視：外傾角、車高、輪距、擺臂座高度
 *         side       側視：後傾角、前後車高、馬達座位置、電池與 ESC 位置
 *         damper-f／damper-r    避震：調整環位置、彈簧；上端長度與軸露出長度會改變整支的長度。
 *                               opt.active 是 rebound 時改畫封蓋那一步（軸心拉出下拉量的長度）
 *         rod        拉桿：兩個拉桿頭之間露出的長度。opt.active 是 tie（轉向拉桿，預設）或 servo（伺服拉桿）
 *         holes      孔位：轉向搖臂 B 的球頭孔（預設）；opt.active 是 horn 時畫伺服擺臂的孔
 *         gear       大直齒與馬達齒、終傳比
 *   cur ：目前生效的參數；fac：原廠值的參數。都由產品資料檔的 derive() 產生，沒有的填 null。
 *         目前值畫實線；和原廠值不同的部分，原廠值另外畫成虛線。
 *   opt ：{ hot: [部位名稱] } 要強調的部位（steering、front-arm、rear-arm、front-wheel、
 *         rear-wheel、front-damper、rear-damper、battery、drive、diff、servo、bumper、chassis、shell）
 *         { active: 名稱 } 正在調整的欄位的 part。links 圖用它決定哪一支拉桿加粗
 *         （tie、servo、fUpper、fLower、rUpper、rLower），damper、rod、holes 圖用它決定畫哪一種（見上）
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var TOE_GAIN = 3;      // 前束、後束只有幾度，放大才看得出來
  var CASTER_GAIN = 2;
  var MMV = 2.2;         // 車高：1 mm 畫成幾個單位

  // 沒有資料時用的尺寸（1/10 RWD 甩尾車的典型值）
  var DEFAULTS = {
    fToe: 0, rToe: 0, fCamber: 0, rCamber: 0, caster: 0, fHeight: 6, rHeight: 6,
    fTrack: 182, rTrack: 168, wheelbase: 257,
    fMount: 0, rMount: 0, fTopSpacer: 0, rTopSpacer: 0, fDamperBall: 0, rDamperBall: 0
  };

  function s(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function label(x, y, str, cls, anchor) {
    var t = s("text", { x: x, y: y, class: cls || "dg-label", "text-anchor": anchor || "middle" });
    t.textContent = str;
    return t;
  }

  function line(a, b, cls) {
    return s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls });
  }

  function pts(list) {
    return list.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function has(v) { return v != null && v !== "" && !(typeof v === "number" && isNaN(v)); }
  function round1(n) { return String(Math.round(n * 10) / 10); }
  function shown(v, unit) { return has(v) ? v + unit : "未設定"; }

  // 後面的參數優先；沒有值的欄位不蓋掉前面的
  function merged() {
    var out = {};
    Array.prototype.forEach.call(arguments, function (src) {
      Object.keys(src || {}).forEach(function (k) { if (has(src[k])) out[k] = src[k]; });
    });
    return out;
  }

  function differs(P, F, keys) {
    return keys.some(function (k) { return P[k] !== F[k]; });
  }

  function root(box, fontSize, title) {
    return s("svg", { viewBox: box, "font-size": fontSize, class: "dg", role: "img", "aria-label": title });
  }

  // tags 可以是一個部位名稱或一串；opt.hot 裡有任何一個就強調
  function hot(opt, tags, cls) {
    var list = (opt && opt.hot) || [];
    var on = [].concat(tags).some(function (tag) { return list.indexOf(tag) >= 0; });
    return cls + (on ? " is-hot" : "");
  }

  /* ---------- 俯視：整台車，或裁出前軸／後軸 ---------- */

  var CX = 120, YF = 100;   // 1 單位 = 1 mm；車頭朝上，前軸在 y = 100

  function topWheels(Q, clsFront, clsRear) {
    function wheel(x, y, deg, cls) {
      return s("rect", {
        x: x - 13, y: y - 32, width: 26, height: 64, rx: 6, class: cls,
        transform: "rotate(" + clamp(deg * TOE_GAIN, -35, 35) + " " + x + " " + y + ")"
      });
    }
    var fx = Q.fTrack / 2 + 6, rx = Q.rTrack / 2 + 6, yr = YF + Q.wheelbase;
    // Toe-out：前輪前緣向外；Toe-in：後輪前緣向內
    return [
      wheel(CX - fx, YF, -Q.fToe, clsFront), wheel(CX + fx, YF, Q.fToe, clsFront),
      wheel(CX - rx, yr, Q.rToe, clsRear), wheel(CX + rx, yr, -Q.rToe, clsRear)
    ];
  }

  // 把整台車的俯視圖交給 add() 畫出來；top() 與 links() 共用
  function carTop(P, F, opt, add) {
    var yr = YF + P.wheelbase, fx = P.fTrack / 2 + 6, rx = P.rTrack / 2 + 6;
    function rect(x, y, w, h, r, cls) { add(s("rect", { x: x, y: y, width: w, height: h, rx: r, class: cls })); }

    rect(22, 6, 196, yr + 72, 36, hot(opt, "shell", "dg-shell"));
    [-1, 1].forEach(function (d) {
      add(s("polygon", { class: hot(opt, "front-arm", "dg-arm"),
        points: pts([[CX + d * 24, YF - 13], [CX + d * 24, YF + 13], [CX + d * (fx - 15), YF + 6], [CX + d * (fx - 15), YF - 6]]) }));
      add(s("polygon", { class: hot(opt, "rear-arm", "dg-arm"),
        points: pts([[CX + d * 20, yr - 15], [CX + d * 20, yr + 15], [CX + d * (rx - 15), yr + 7], [CX + d * (rx - 15), yr - 7]]) }));
      add(line([CX + d * 12, YF + 26], [CX + d * (fx - 13), YF + 18], hot(opt, "steering", "dg-link")));
    });
    rect(88, 40, 64, yr + 4, 10, hot(opt, "chassis", "dg-chassis"));
    rect(74, 20, 92, 11, 5, hot(opt, "bumper", "dg-part"));
    rect(CX - 13, YF + 21, 26, 9, 3, hot(opt, "steering", "dg-part"));
    add(line([CX, YF + 30], [CX, YF + 52], hot(opt, "steering", "dg-link")));
    rect(CX - 11, YF + 52, 22, 40, 3, hot(opt, ["steering", "servo"], "dg-part"));
    rect(CX - 24, YF + 104, 48, 96, 4, hot(opt, "battery", "dg-battery"));
    rect(CX - 34, yr - 66, 52, 34, 8, hot(opt, "drive", "dg-motor"));
    rect(CX + 22, yr - 74, 5, 52, 2, hot(opt, "drive", "dg-gear"));
    rect(CX - 18, yr - 26, 36, 46, 6, hot(opt, "diff", "dg-part"));
    [-1, 1].forEach(function (d) {
      add(s("circle", { cx: CX + d * 42, cy: YF, r: 8, class: hot(opt, "front-damper", "dg-damper") }));
      add(s("circle", { cx: CX + d * 38, cy: yr, r: 8, class: hot(opt, "rear-damper", "dg-damper") }));
    });
    add(s("path", { d: "M" + CX + " 46 l8 13 h-16 z", class: "dg-mark" }));

    if (differs(P, F, ["fToe", "rToe", "fTrack", "rTrack", "wheelbase"])) {
      topWheels(F, "dg-ghost", "dg-ghost").forEach(add);
    }
    topWheels(P, hot(opt, "front-wheel", "dg-tire"), hot(opt, "rear-wheel", "dg-tire")).forEach(add);
  }

  function top(kind, P, F, opt) {
    var yr = YF + P.wheelbase;
    var box = kind === "top-front" ? "0 30 240 150"
      : kind === "top-rear" ? "0 " + (yr - 84) + " 240 150"
      : "0 0 240 " + (yr + 84);
    var svg = root(box, 13, "俯視圖");
    function add(n) { svg.appendChild(n); }
    carTop(P, F, opt, add);

    if (kind === "top-front") {
      add(label(6, 46, "前束 " + round1(P.fToe) + "°", "dg-label", "start"));
      add(label(234, 46, "前寬 " + round1(P.fTrack), "dg-label", "end"));
    } else if (kind === "top-rear") {
      add(label(6, yr - 68, "後束 " + round1(P.rToe) + "°", "dg-label", "start"));
      add(label(234, yr - 68, "後寬 " + round1(P.rTrack), "dg-label", "end"));
    }
    return svg;
  }

  /* ---------- 全車拉桿：車頭朝右的俯視圖，每支拉桿標出長度 ---------- */

  function links(P, F, opt) {
    var yr = YF + P.wheelbase, W = yr + 84, fx = P.fTrack / 2 + 6, rx = P.rTrack / 2 + 6;
    var svg = root("0 0 " + W + " 260", 17, "全車拉桿長度");
    function add(n) { svg.appendChild(n); }
    function h(x, y) { return [W - y, x]; }   // 車身座標（車頭朝上）轉成這張圖的座標（車頭朝右）

    // 車身淡化當底圖，拉桿另外用顏色畫在上面
    var car = s("g", { transform: "matrix(0 1 -1 0 " + W + " 0)", class: "dg-dimmed" });
    carTop(P, F, null, function (n) { car.appendChild(n); });
    add(car);

    var now = P.links || {}, fac = F.links || {};
    // side：標籤放在哪一側（-1 左輪側，在圖的上半；1 右輪側，在下半；0 中線上只有一支）
    // a、b：拉桿兩端離車身中線的距離與前後位置；at：標籤位置
    var list = [
      { key: "fUpper", name: "前上", side: -1, a: [22, YF - 11], b: [fx - 14, YF - 9], at: [W - 6, 64], anchor: "end" },
      { key: "fLower", name: "前下", side: -1, a: [fx - 34, YF + 5], b: [fx - 15, YF + 5], at: [W - YF - 44, 62], anchor: "end" },
      { key: "tie", name: "轉向", side: 1, a: [12, YF + 26], b: [fx - 13, YF + 18], at: [W - YF - 44, 198], anchor: "end" },
      { key: "servo", name: "伺服", side: 0, a: [0, YF + 30], b: [0, YF + 52], at: [W - YF - 72, 174], anchor: "middle" },
      { key: "rUpper", name: "後上", side: -1, a: [18, yr - 13], b: [rx - 14, yr - 11], at: [W - yr + 52, 62], anchor: "start" },
      { key: "rLower", name: "後下", side: 1, a: [20, yr + 7], b: [rx - 15, yr + 7], at: [W - yr + 52, 198], anchor: "start" }
    ];
    list.forEach(function (ln) {
      var changed = has(now[ln.key]) && has(fac[ln.key]) && now[ln.key] !== fac[ln.key];
      var state = (changed ? " is-changed" : "") + (opt && opt.active === ln.key ? " is-active" : "");
      (ln.side ? [-1, 1] : [1]).forEach(function (d) {
        add(line(h(CX + d * ln.a[0], ln.a[1]), h(CX + d * ln.b[0], ln.b[1]), "dg-rod-link" + state));
      });
      var text = ln.name + " " + (has(now[ln.key]) ? round1(now[ln.key]) : "—");
      var width = 34 + (text.length - 2) * 9.5;   // 大約的字寬，用來決定引線接到哪裡
      var d = ln.side || 1;
      var mid = h(CX + d * (ln.a[0] + ln.b[0]) / 2, (ln.a[1] + ln.b[1]) / 2);
      var end = ln.anchor === "start" ? [ln.at[0] - 3, ln.at[1] - 6]
        : ln.anchor === "end" ? [ln.at[0] - width - 3, ln.at[1] - 6]
        : [ln.at[0], ln.at[1] - 17];
      add(line(mid, end, "dg-callout"));
      add(label(ln.at[0], ln.at[1], text, "dg-label" + state, ln.anchor));
    });
    add(label(6, 254, "單位 mm；橘色是和原廠不同的拉桿", "dg-small", "start"));
    add(label(W - 6, 254, "車頭 >", "dg-small", "end"));
    return svg;
  }

  /* ---------- 零件位置：車頭朝右的整車俯視圖，強調指定的部位 ---------- */

  function carWide(P, F, opt) {
    var W = YF + P.wheelbase + 84;
    var svg = root("0 0 " + W + " 260", 17, "零件位置");
    var car = s("g", { transform: "matrix(0 1 -1 0 " + W + " 0)" });
    carTop(P, F, opt, function (n) { car.appendChild(n); });
    svg.appendChild(car);
    var caption = opt && opt.caption;
    svg.appendChild(label(6, 254, caption || "點零件名稱，看它在車上的位置", caption ? "dg-label" : "dg-small", "start"));
    svg.appendChild(label(W - 6, 254, "車頭 >", "dg-small", "end"));
    return svg;
  }

  /* ---------- 軸向正視：外傾角、車高、輪距、擺臂座高度 ---------- */

  function axle(front, P, F) {
    var name = front ? "前" : "後";
    var svg = root("0 0 240 150", 12.5, name + "軸正視圖");
    var G = 128, K = 0.9;
    function add(n) { svg.appendChild(n); }

    function build(Q, ghost) {
      var camber = Math.abs(front ? Q.fCamber : Q.rCamber);
      var height = front ? Q.fHeight : Q.rHeight;
      var half = ((front ? Q.fTrack : Q.rTrack) / 2 + 6) * K;
      var mount = front ? Q.fMount : Q.rMount;
      var topSpacer = front ? Q.fTopSpacer : Q.rTopSpacer;
      var ball = front ? Q.fDamperBall : Q.rDamperBall;
      var deckY = G - height * MMV - 6, rad = camber * Math.PI / 180;
      var nodes = [];
      [-1, 1].forEach(function (d) {
        var xc = 120 + d * half, xin = xc - d * 11.5;
        var lowIn = [120 + d * 24, deckY - 2 - mount * 2.5], lowOut = [xin, G - 13];
        var upIn = [120 + d * 16, deckY - 36], upOut = [xin - d * 44 * Math.sin(rad), G - 47 - topSpacer * 2.5];
        var towerTop = [120 + d * (30 + ball * 2.5), deckY - 56];
        var armMid = [(lowIn[0] + lowOut[0]) / 2 + d * 8, (lowIn[1] + lowOut[1]) / 2];
        if (!ghost) {
          nodes.push(line(lowIn, lowOut, "dg-arm-line"), line(upIn, upOut, "dg-link"), line(towerTop, armMid, "dg-damper-line"));
        }
        // 負外傾：輪胎上緣向車身內側倒
        nodes.push(s("rect", {
          x: xc - 11.5, y: G - 58, width: 23, height: 58, rx: 6, class: ghost ? "dg-ghost" : "dg-tire",
          transform: "rotate(" + clamp(-d * camber, -30, 30) + " " + xc + " " + G + ")"
        }));
      });
      nodes.push(s("rect", { x: 91, y: deckY, width: 58, height: 6, rx: 2, class: ghost ? "dg-ghost" : "dg-chassis" }));
      if (!ghost) nodes.unshift(s("rect", { x: 104, y: deckY - 56, width: 32, height: 56, rx: 4, class: "dg-part" }));
      return { nodes: nodes, deckY: deckY };
    }

    add(line([4, G], [236, G], "dg-ground"));
    var keys = front ? ["fCamber", "fHeight", "fTrack"] : ["rCamber", "rHeight", "rTrack"];
    if (differs(P, F, keys)) build(F, true).nodes.forEach(add);
    var now = build(P, false);
    now.nodes.forEach(add);
    add(line([120, now.deckY + 6], [120, G], "dg-dim"));
    add(label(120, 14, name + "外傾 " + round1(Math.abs(front ? P.fCamber : P.rCamber)) + "°"));
    add(label(6, 145, "車高 " + round1(front ? P.fHeight : P.rHeight) + " mm", "dg-label", "start"));
    add(label(234, 145, name + "寬 " + round1(front ? P.fTrack : P.rTrack), "dg-label", "end"));
    return svg;
  }

  /* ---------- 側視：後傾角、前後車高、馬達座位置、電池與 ESC ---------- */

  // 馬達相對大直齒的方位（度，車頭方向為 0、往上為 90），依說明書 p.27 四種馬達座位置的圖
  var MOTOR_ANGLE = { 1: 12, 2: 52, 3: 92, 4: 140 };

  function side(P, F) {
    var svg = root("0 0 260 136", 11.5, "側視圖");
    var G = 108, R = 28, xr = 56, xf = xr + P.wheelbase * 0.53;
    function add(n) { svg.appendChild(n); }
    function deckTop(Q, x) { return G - (Q.rHeight + (Q.fHeight - Q.rHeight) * (x - xr) / (xf - xr)) * MMV - 6; }
    function deck(Q, cls) {
      var x0 = 16, x1 = xf + 36;
      return s("polygon", { class: cls,
        points: pts([[x0, deckTop(Q, x0) + 6], [x1, deckTop(Q, x1) + 6], [x1, deckTop(Q, x1)], [x0, deckTop(Q, x0)]]) });
    }
    function axis(deg, cls) {
      var rad = clamp(deg * CASTER_GAIN, -40, 40) * Math.PI / 180, cy = G - R;
      // 後傾：轉向軸上端往車尾（圖的左邊）倒
      return line([xf - 46 * Math.sin(rad), cy - 46 * Math.cos(rad)], [xf + 28 * Math.sin(rad), cy + 28 * Math.cos(rad)], cls);
    }

    add(line([4, G], [256, G], "dg-ground"));
    add(s("circle", { cx: xr, cy: G - R, r: R, class: "dg-tire" }));
    add(s("circle", { cx: xf, cy: G - R, r: R, class: "dg-tire" }));
    if (differs(P, F, ["fHeight", "rHeight"])) add(deck(F, "dg-ghost"));
    add(deck(P, "dg-chassis"));

    var batteryH = P.batteryThin === false ? 17 : 12, bx = 122;
    add(s("rect", { x: bx - 26, y: deckTop(P, bx) - batteryH, width: 52, height: batteryH, rx: 2, class: "dg-battery" }));
    var sx = xr + 20, sy = deckTop(P, xr + 20) - 22;
    add(s("circle", { cx: sx, cy: sy, r: 17, class: "dg-gear-ring" }));
    var rad = (MOTOR_ANGLE[P.motorMode] || MOTOR_ANGLE[1]) * Math.PI / 180;
    add(s("circle", { cx: sx + 29 * Math.cos(rad), cy: sy - 29 * Math.sin(rad), r: 11,
      class: has(P.motorMode) ? "dg-motor" : "dg-motor dg-unknown" }));
    if (has(P.escHigh)) {
      var ex = P.escHigh ? xr - 34 : 176;
      add(s("rect", { x: ex, y: deckTop(P, ex) - (P.escHigh ? 34 : 9), width: 24, height: 9, rx: 2, class: "dg-part" }));
    }

    add(line([xf, 22], [xf, G], "dg-dim"));
    if (differs(P, F, ["caster"])) add(axis(F.caster, "dg-ghost"));
    add(axis(P.caster, "dg-axis"));
    add(label(xf - 30, 14, "後傾角 " + round1(P.caster) + "°"));
    add(label(xr, 124, "後 " + round1(P.rHeight) + " mm"));
    add(label(xf, 124, "前 " + round1(P.fHeight) + " mm"));
    add(label((xr + xf) / 2, 124, "軸距 " + round1(P.wheelbase), "dg-small"));
    add(label(8, 14, has(P.motorMode) ? "馬達座 MODE " + P.motorMode : "馬達座未設定", "dg-small", "start"));
    add(label(256, 34, "車頭 >", "dg-small", "end"));
    return svg;
  }

  /* ---------- 避震 ---------- */

  function springColor(name) {
    var n = String(name || "").toLowerCase();
    if (n.indexOf("green") >= 0) return n.indexOf("silver") >= 0 ? "#86b89c" : "#3e9b5f";
    if (n.indexOf("red") >= 0) return "#c0392b";
    if (n.indexOf("blue") >= 0) return "#2f6fbf";
    if (n.indexOf("yellow") >= 0 || n.indexOf("gold") >= 0) return "#c9a227";
    if (n.indexOf("silver") >= 0 || n.indexOf("white") >= 0) return "#a7acb2";
    return "";
  }

  var MMD = 4;   // 避震圖：1 mm 畫成幾個單位（調整量只有幾 mm，放大才看得出來）

  // 上端的吊耳固定在左邊：「上端可調長度」「避震軸露出長度」一變，整支避震就跟著變長或變短。
  // opt.active 是 rebound 時改畫封蓋那一步的樣子（說明書 p.24 步驟 7：還沒裝彈簧，軸心拉出指定的長度）
  function damper(name, D, DF, opt) {
    D = D || {}; DF = DF || {};
    var capping = !!opt && opt.active === "rebound";
    var svg = root("0 0 240 116", 11.5, name + "避震" + (capping ? "封蓋時" : ""));
    function add(n) { svg.appendChild(n); }
    function num(v, fallback) { return has(v) ? v : fallback; }
    var cy = 50;
    // base：避震筒上蓋的左緣；end：筒身下蓋的外側；tip：下端拉桿頭靠軸心的那一面
    function layout(S) {
      var up = clamp(num(S.upper, 0), 0, 4);
      var out = capping ? clamp(num(S.rebound, 0), 0, 20) : clamp(num(S.rod, 12.5), 3, 18);
      var base = 28 + up * MMD;
      return { up: up, base: base, end: base + 83, tip: base + 83 + out * MMD };
    }
    var L = layout(D), LF = layout(DF);
    var gap = clamp(num(D.retainer, 0), 0, 13), wire = num(D.wire, 1.5);
    function collar(g, cls) { return s("rect", { x: L.base + 16 + clamp(g, 0, 13) * MMD, y: cy - 22, width: 7, height: 44, rx: 2, class: cls }); }
    function dim(x1, x2, y) {
      add(line([x1, y], [x2, y], "dg-dim"));
      add(line([x1, y - 3], [x1, y + 3], "dg-dim"));
      add(line([x2, y - 3], [x2, y + 3], "dg-dim"));
    }

    // 總長和原廠不同時，下端吊耳的原廠位置畫成虛線
    if (Math.abs(LF.tip - L.tip) > 0.01) add(s("circle", { cx: LF.tip + 20, cy: cy, r: 9, class: "dg-ghost" }));

    // 上端：吊耳固定，可調的那一段畫成螺牙
    add(s("circle", { cx: 14, cy: cy, r: 9, class: "dg-eye" }));
    add(line([23, cy], [28, cy], "dg-rod"));
    if (L.up > 0) add(s("rect", { x: 28, y: cy - 6, width: L.up * MMD, height: 12, class: "dg-thread" }));
    // 避震筒：上蓋、有螺牙的筒身、下蓋
    add(s("rect", { x: L.base, y: cy - 19, width: 16, height: 38, rx: 4, class: "dg-part" }));
    add(s("rect", { x: L.base + 16, y: cy - 13, width: 64, height: 26, class: "dg-thread" }));
    add(s("rect", { x: L.base + 80, y: cy - 15, width: 3, height: 30, class: "dg-part" }));
    // 軸心
    add(line([L.end, cy], [L.tip + 11, cy], "dg-rod"));

    if (capping) {
      add(collar(gap, "dg-part"));
    } else {
      // 彈簧：從調整環到下座，線徑越粗畫得越粗
      var from = L.base + 23 + gap * MMD, coils = 7, zig = [[from, cy - 18]];
      for (var i = 1; i <= coils * 2; i++) zig.push([from + (L.tip - from) * i / (coils * 2), cy + (i % 2 ? 18 : -18)]);
      var spring = s("polyline", { class: "dg-spring", points: pts(zig), "stroke-width": clamp(wire * 1.7, 1.5, 4) });
      var color = springColor(D.color);
      if (color) spring.style.stroke = color;
      add(spring);
      if (has(DF.retainer) && DF.retainer !== D.retainer) add(collar(DF.retainer, "dg-ghost"));
      add(collar(gap, "dg-collar"));
      add(s("rect", { x: L.tip, y: cy - 20, width: 6, height: 40, rx: 2, class: "dg-part" }));
    }
    // 下端拉桿頭
    add(s("circle", { cx: L.tip + 20, cy: cy, r: 9, class: "dg-eye" }));
    if (has(D.lower)) add(label(L.tip + 20, cy + 4, String(D.lower), "dg-small"));

    if (L.up > 0) {
      dim(28, L.base, cy + 25);
      add(label(4, 90, "上端 +" + round1(D.upper) + " mm", "dg-small", "start"));
    }
    if (capping) {
      add(label(4, 14, "封蓋時（還沒裝彈簧）", "dg-label", "start"));
      dim(L.end, L.tip, cy + 25);
      add(label(clamp((L.end + L.tip) / 2, 118, 200), 90, "下拉 " + shown(D.rebound, " mm"),
        "dg-label" + (has(DF.rebound) && DF.rebound !== D.rebound ? " is-changed" : "")));
      add(label(120, 102, "軸心拉出這個長度後蓋上避震上蓋", "dg-small"));
      add(label(120, 114, has(DF.rebound) ? "原廠 " + DF.rebound + " mm" : "", "dg-small"));
      return svg;
    }
    dim(L.base + 16, L.base + 16 + gap * MMD, cy - 27);
    add(label(clamp(L.base + 16 + gap * MMD / 2, 46, 110), 14, "調整環 " + shown(D.retainer, " mm")));
    dim(L.end, L.tip, cy - 27);
    add(label(clamp((L.end + L.tip) / 2, 150, 208), 14, "軸 " + shown(D.rod, " mm"), "dg-small"));
    add(label(120, 102, "油 #" + shown(D.oil, "") + "　活塞 " + shown(D.pistonHoles, " 孔") + " φ" + shown(D.pistonDia, "") +
      (has(D.rebound) ? "　下拉 " + D.rebound : ""), "dg-small"));
    add(label(120, 114, "彈簧 " + shown(D.len, " mm") + " φ" + shown(D.wire, "") + " " + (D.color || ""), "dg-small"));
    return svg;
  }

  /* ---------- 拉桿：兩個拉桿頭之間露出的長度 ---------- */

  var ROD_NAMES = { tie: "轉向拉桿", servo: "伺服拉桿" };

  // 左邊的拉桿頭固定，右邊的跟著長度移動。opt.active 指定畫哪一支，沒指定就畫轉向拉桿
  function rod(P, F, opt) {
    var key = opt && ROD_NAMES[opt.active] ? opt.active : "tie";
    var now = (P.links || {})[key], fac = (F.links || {})[key];
    var svg = root("0 0 240 116", 11.5, ROD_NAMES[key]);
    function add(n) { svg.appendChild(n); }
    var cy = 56, MM = 5, left = 66;
    function face(v) { return left + clamp(has(v) ? v : 15, 4, 22) * MM; }
    // 拉桿頭：x 是靠螺牙的那一面，dir 是它朝哪一邊伸出去
    function head(x, dir, ghost) {
      add(s("rect", { x: dir > 0 ? x : x - 36, y: cy - 9, width: 36, height: 18, rx: 2, class: ghost ? "dg-ghost" : "dg-part" }));
      add(s("circle", { cx: x + dir * 45, cy: cy, r: 9, class: ghost ? "dg-ghost" : "dg-eye" }));
    }
    var right = face(now), changed = has(now) && has(fac) && now !== fac;

    if (changed) head(face(fac), 1, true);
    add(s("rect", { x: left, y: cy - 4, width: right - left, height: 8, class: "dg-thread" }));
    add(s("rect", { x: (left + right) / 2 - 6, y: cy - 7, width: 12, height: 14, rx: 1, class: "dg-part" }));
    head(left, -1);
    head(right, 1);

    add(line([left, cy - 22], [right, cy - 22], "dg-dim"));
    add(line([left, cy - 27], [left, cy - 11], "dg-dim"));
    add(line([right, cy - 27], [right, cy - 11], "dg-dim"));
    add(label(clamp((left + right) / 2, 70, 170), 20, ROD_NAMES[key] + " " + shown(now, " mm"), "dg-label" + (changed ? " is-changed" : "")));
    add(label(120, 88, key === "tie" ? "量兩個拉桿頭之間露出的長度，左右兩支要一樣" : "依伺服機調整，對正轉向的中立點", "dg-small"));
    add(label(120, 103, has(fac) ? "原廠 " + fac + " mm" + (changed ? "（虛線）" : "") : "說明書沒有給數值", "dg-small"));
    return svg;
  }

  /* ---------- 孔位：轉向搖臂 B、伺服擺臂 ---------- */

  function holes(P, F, opt) {
    return opt && opt.active === "horn" ? horn(P, F) : armB(P, F);
  }

  // 球頭畫成紅色的圓，原廠的孔畫成虛線圈
  function ball(add, x, y, now, fac) {
    if (fac && !now) add(s("circle", { cx: x, cy: y, r: 7.5, class: "dg-ghost" }));
    if (now) add(s("circle", { cx: x, cy: y, r: 6.5, class: "dg-collar" }));
  }

  // 轉向搖臂 B：長孔有 4 個位置，由轉軸往外編成孔 1～孔 4
  function armB(P, F) {
    var svg = root("0 0 240 116", 11.5, "轉向搖臂 B 的球頭孔位");
    function add(n) { svg.appendChild(n); }
    var cy = 50, xs = [136, 153, 170, 187];
    add(s("circle", { cx: 15, cy: cy, r: 8, class: "dg-part" }));
    add(s("circle", { cx: 50, cy: cy, r: 31, class: "dg-part" }));
    add(s("polygon", { points: pts([[58, cy - 30], [190, cy - 15], [190, cy + 15], [58, cy + 30]]), class: "dg-part" }));
    add(s("circle", { cx: 190, cy: cy, r: 15, class: "dg-part" }));
    add(s("circle", { cx: 50, cy: cy, r: 21, class: "dg-hole" }));
    add(s("circle", { cx: 13, cy: cy, r: 3.5, class: "dg-hole" }));
    add(s("circle", { cx: 89, cy: cy, r: 3.5, class: "dg-hole" }));
    add(s("rect", { x: 100, y: cy - 9, width: 17, height: 18, rx: 5, class: "dg-hole" }));
    xs.forEach(function (x) { add(s("circle", { cx: x, cy: cy, r: 8.5, class: "dg-hole" })); });
    xs.forEach(function (x, i) {
      var n = i + 1;
      ball(add, x, cy, P.armB === n, F.armB === n);
      add(label(x, cy + 32, String(n), P.armB === n ? "dg-label" : "dg-small"));
    });
    add(label(50, cy + 4, "轉軸", "dg-small"));
    add(label(236, 14, has(P.armB) ? "球頭在孔 " + P.armB : "球頭孔位未設定", "dg-label" + (has(P.armB) && has(F.armB) && P.armB !== F.armB ? " is-changed" : ""), "end"));
    add(label(120, 102, "孔由轉軸往外數；紅色是球頭的位置", "dg-small"));
    add(label(120, 114, has(F.armB) ? "原廠在孔 " + F.armB + (P.armB !== F.armB ? "（虛線）" : "") : "", "dg-small"));
    return svg;
  }

  // 伺服擺臂：擺臂上刻著 21.5、17.5 兩個孔
  function horn(P, F) {
    var svg = root("0 0 240 116", 11.5, "伺服擺臂的球頭孔位");
    function add(n) { svg.appendChild(n); }
    var cy = 50, spots = [[17.5, 158], [21.5, 186]];
    add(s("circle", { cx: 52, cy: cy, r: 28, class: "dg-part" }));
    add(s("polygon", { points: pts([[58, cy - 27], [190, cy - 12], [190, cy + 12], [58, cy + 27]]), class: "dg-part" }));
    add(s("circle", { cx: 190, cy: cy, r: 12, class: "dg-part" }));
    add(s("circle", { cx: 52, cy: cy, r: 17, class: "dg-hole" }));
    add(s("circle", { cx: 52, cy: cy, r: 5, class: "dg-part" }));
    spots.forEach(function (sp) {
      add(s("circle", { cx: sp[1], cy: cy, r: 6, class: "dg-hole" }));
      ball(add, sp[1], cy, P.hornHole === sp[0], F.hornHole === sp[0]);
      add(label(sp[1], cy + 30, String(sp[0]), P.hornHole === sp[0] ? "dg-label" : "dg-small"));
    });
    add(label(52, cy + 44, "伺服機出力軸", "dg-small"));
    add(label(236, 14, has(P.hornHole) ? "球頭在 " + P.hornHole + " 孔" : "球頭孔位未設定", "dg-label" + (has(P.hornHole) && has(F.hornHole) && P.hornHole !== F.hornHole ? " is-changed" : ""), "end"));
    add(label(120, 114, "紅色是球頭的位置" + (has(F.hornHole) ? "；原廠在 " + F.hornHole + " 孔" + (P.hornHole !== F.hornHole ? "（虛線）" : "") : ""), "dg-small"));
    return svg;
  }

  /* ---------- 齒輪 ---------- */

  function gear(P, F) {
    var svg = root("0 0 240 120", 11.5, "大直齒與馬達齒");
    function add(n) { svg.appendChild(n); }
    function wheel(teeth, x, y, cls) {
      var r = clamp(teeth * 0.46, 6, 50);
      add(s("circle", { cx: x, cy: y, r: r, class: cls }));
      add(s("circle", { cx: x, cy: y, r: 3, class: "dg-mark" }));
      return r;
    }
    var spur = has(P.spur) ? P.spur : 80, pinion = has(P.pinion) ? P.pinion : 22;
    // 齒輪畫在右半邊，文字集中在左邊，兩者不重疊
    var cx = 184, cy = 60, rs = clamp(spur * 0.46, 6, 50), rp = clamp(pinion * 0.46, 6, 50);
    if (differs(P, F, ["spur", "pinion"]) && has(F.spur) && has(F.pinion)) {
      var gs = clamp(F.spur * 0.46, 6, 50), gp = clamp(F.pinion * 0.46, 6, 50);
      add(s("circle", { cx: cx, cy: cy, r: gs, class: "dg-ghost" }));
      add(s("circle", { cx: cx - gs - gp, cy: cy, r: gp, class: "dg-ghost" }));
    }
    wheel(spur, cx, cy, "dg-gear-ring");
    wheel(pinion, cx - rs - rp, cy, "dg-gear-ring dg-pinion");
    add(label(4, 16, "終傳比", "dg-small", "start"));
    add(label(4, 40, has(P.ratio) ? String(P.ratio) : "未設定", "dg-big", "start"));
    if (has(P.gearMode)) add(label(4, 58, String(P.gearMode), "dg-small", "start"));
    add(label(4, 84, "馬達齒 " + pinion + "T", "dg-label", "start"));
    add(label(4, 102, "大直齒 " + spur + "T", "dg-label", "start"));
    return svg;
  }

  function draw(kind, cur, fac, opt) {
    cur = cur || {};
    fac = fac || {};
    var P = merged(DEFAULTS, fac, cur), F = merged(DEFAULTS, fac);
    if (kind === "map" || kind === "top-front" || kind === "top-rear") return top(kind, P, F, opt);
    if (kind === "links") return links(P, F, opt);
    if (kind === "car") return carWide(P, F, opt);
    if (kind === "front") return axle(true, P, F);
    if (kind === "rear") return axle(false, P, F);
    if (kind === "side") return side(P, F);
    if (kind === "damper-f") return damper("前", cur.fd, fac.fd, opt);
    if (kind === "damper-r") return damper("後", cur.rd, fac.rd, opt);
    if (kind === "rod") return rod(P, F, opt);
    if (kind === "holes") return holes(P, F, opt);
    if (kind === "gear") return gear(P, F);
    return null;
  }

  window.RCDiagram = { draw: draw };
})();
