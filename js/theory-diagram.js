/*
 * 設定理論頁的示意圖：自己畫的 SVG（不使用原書的圖檔），樣式沿用 css/style.css 的 dg-* 類別，
 * 這一頁專用的 td-* 類別在 css/theory.css。角度與高度都放大過，只是讓差別看得出來。
 *
 * map()          整台四驅房車的俯視圖（車頭朝上）。每個零件帶 data-part，總覽頁用它來強調部位：
 *                f-wheel、r-wheel、f-arm、r-arm、f-hinge、r-hinge、f-upper、r-upper、steer、
 *                f-shock、r-shock、f-arb、r-arb、f-diff、r-diff、center、belt、gear、battery、chassis、cg
 * draw(kind, P)  P 是資料檔的 topic.base 併上 option.params；P.ghost 是要畫成虛線的對照狀態
 *   kind：atop   單一軸的俯視。end（f／r）、toe（正值 Toe-in）、track（車寬增減）、
 *                steer（[左輪, 右輪] 的轉向角，負值向左）
 *         afront 單一軸的正視。camber（負角度的大小）、roll（車體滾動）、lift（車體上提，畫 Droop）、
 *                arb（hard／soft）、shock（lean／upright）、upperLen（short／long）、
 *                rc（畫滾動中心的作圖）、upperIn／lowerIn（上擺臂內球頭、下擺臂內側轉軸抬高多少）、
 *                force（在重心畫離心力）
 *         side   整車側視，車頭朝右。fH／rH（前後車高）、wb（軸距增減）、caster、
 *                fPin／rPin（前後下擺臂轉軸的角度，正值前端較高）、force（accel／brake）、
 *                fade（f／r，把那一側的輪子畫淡）、dimH（標出車高）
 *         shock  避震器。focus（spring／damp）、spring、damp（hard／soft）
 *         drive  傳動配置，車頭朝右。focus（f／c／r）、front／center／rear（要顯示的文字）、
 *                fk／rk（前後軸的圖示：ball／spool／ows／oneway）、ck（中軸畫單向的圖示）
 *         roll   齒比與 Rollout。spur、pinion、fdr、rollout（由頁面算好傳進來）
 *   共用：bl、br 是左下、右下的文字
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var RAD = Math.PI / 180;
  var TOE_GAIN = 4, STEER_GAIN = 2, CAMBER_GAIN = 3, CASTER_GAIN = 3.5, PIN_GAIN = 3;
  var MMV = 2.2;   // 車高：1 mm 畫成幾個單位

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

  function pts(list) {
    return list.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
  }

  function line(a, b, cls) { return s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }); }
  function poly(list, cls) { return s("polygon", { points: pts(list), class: cls }); }
  function box(x, y, w, h, r, cls) { return s("rect", { x: x, y: y, width: w, height: h, rx: r, class: cls }); }
  function dot(p, r, cls) { return s("circle", { cx: p[0], cy: p[1], r: r, class: cls }); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function has(v) { return v != null && v !== ""; }

  function root(viewBox, fontSize, title) {
    return s("svg", { viewBox: viewBox, "font-size": fontSize, class: "dg", role: "img", "aria-label": title });
  }

  // 後面的蓋過前面的；ghost 不往下帶，免得對照狀態又有自己的對照
  function merge() {
    var out = {};
    Array.prototype.forEach.call(arguments, function (src) {
      Object.keys(src || {}).forEach(function (k) { out[k] = src[k]; });
    });
    return out;
  }
  function ghostOf(P) {
    var Q = merge(P, P.ghost);
    Q.ghost = null;
    return Q;
  }

  // 繞 c 點順時針轉 deg 度（SVG 的 y 朝下）
  function rot(p, deg, c) {
    var a = deg * RAD, x = p[0] - c[0], y = p[1] - c[1];
    return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
  }

  // 直線 ab 與直線 cd 的交點；平行時回傳 null
  function meet(a, b, c, d) {
    var den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
    if (Math.abs(den) < 1e-6) return null;
    var t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den;
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }

  function arrow(a, b, cls) {
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len, h = 8, w = 4;
    var base = [b[0] - ux * h, b[1] - uy * h];
    return s("g", { class: cls || "td-arrow" }, [
      line(a, base, "td-arrow-line"),
      poly([b, [base[0] - uy * w, base[1] + ux * w], [base[0] + uy * w, base[1] - ux * w]], "td-arrow-head")
    ]);
  }

  // 兩端帶短橫線的尺寸線
  function dim(a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * 4, ny = dx / len * 4;
    return s("g", { class: "td-dim" }, [
      line(a, b, "td-dimline"),
      line([a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny], "td-dimline"),
      line([b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], "td-dimline")
    ]);
  }

  function corners(svg, P, y) {
    if (P.bl) svg.appendChild(label(4, y, P.bl, "dg-label td-halo", "start"));
    if (P.br) svg.appendChild(label(svg.viewBox.baseVal.width - 4, y, P.br, "dg-label td-halo", "end"));
  }

  /* ---------- 總覽頁：整台車的俯視圖 ---------- */

  function map() {
    var CX = 100, YF = 92, YR = 342;
    var svg = root("0 0 200 392", 13, "四驅房車俯視圖，車頭朝上");
    function add(node, part) {
      if (part) node.setAttribute("data-part", part);
      svg.appendChild(node);
      return node;
    }

    add(box(10, 6, 180, 380, 34, "dg-shell"));
    [-1, 1].forEach(function (d) {
      add(poly([[CX + d * 24, YF - 15], [CX + d * 24, YF + 15], [CX + d * 68, YF + 7], [CX + d * 68, YF - 7]], "dg-arm"), "f-arm");
      add(poly([[CX + d * 22, YR - 16], [CX + d * 22, YR + 16], [CX + d * 68, YR + 8], [CX + d * 68, YR - 8]], "dg-arm"), "r-arm");
      add(line([CX + d * 17, YF], [CX + d * 71, YF], "td-shaft"));
      add(line([CX + d * 17, YR], [CX + d * 71, YR], "td-shaft"));
    });
    add(box(64, 46, 72, 318, 10, "dg-chassis"), "chassis");
    add(box(46, 22, 108, 12, 6, "dg-part"));

    // 傳動：後皮帶、前皮帶、中軸、大齒盤、馬達
    add(box(CX - 9, YR - 80, 7, 66, 2, "td-belt"), "belt");
    add(box(CX + 2, YF + 16, 7, YR - 80 - YF - 10, 2, "td-belt"), "belt");
    add(box(CX - 17, YF - 17, 34, 34, 7, "dg-part"), "f-diff");
    add(box(CX - 17, YR - 17, 34, 34, 7, "dg-part"), "r-diff");
    add(box(CX - 13, YR - 88, 34, 10, 3, "dg-part"), "center");
    add(box(CX + 14, YR - 108, 6, 50, 2, "dg-gear"), "gear");
    add(box(CX - 34, YR - 70, 23, 42, 7, "dg-motor"), "gear");

    // 電裝
    add(box(CX + 13, YF + 46, 21, 92, 4, "dg-battery"), "battery");
    add(box(CX - 34, YF + 36, 23, 40, 3, "dg-part"), "steer");
    add(box(CX - 12, YF + 22, 24, 9, 3, "dg-part"), "steer");
    add(box(CX - 34, YF + 84, 23, 34, 3, "dg-part"));
    add(box(CX - 34, YF + 124, 23, 20, 3, "dg-part"));

    [-1, 1].forEach(function (d) {
      add(line([CX + d * 17, YF - 10], [CX + d * 70, YF - 10], "dg-link"), "f-upper");
      add(line([CX + d * 17, YR - 11], [CX + d * 70, YR - 11], "dg-link"), "r-upper");
      add(line([CX + d * 10, YF + 27], [CX + d * 70, YF + 19], "dg-link"), "steer");
      add(line([CX + d * 25, YF - 17], [CX + d * 25, YF + 17], "td-hinge"), "f-hinge");
      add(line([CX + d * 23, YR - 18], [CX + d * 23, YR + 18], "td-hinge"), "r-hinge");
    });
    add(s("path", { d: "M50 " + (YF + 12) + " V" + (YF - 27) + " H150 V" + (YF + 12), class: "td-arb" }), "f-arb");
    add(s("path", { d: "M52 " + (YR - 12) + " V" + (YR + 28) + " H148 V" + (YR - 12), class: "td-arb" }), "r-arb");
    [-1, 1].forEach(function (d) {
      add(dot([CX + d * 42, YF], 8, "dg-damper"), "f-shock");
      add(dot([CX + d * 40, YR], 8, "dg-damper"), "r-shock");
    });

    add(dot([CX, YF + 122], 7, "td-cg"), "cg");
    add(s("path", { d: "M" + (CX - 7) + " " + (YF + 122) + " h14 M" + CX + " " + (YF + 115) + " v14", class: "td-cg-cross" }));
    add(s("path", { d: "M" + CX + " 52 l7 12 h-14 z", class: "dg-mark" }));

    [-1, 1].forEach(function (d) {
      add(box(CX + d * 84 - 13, YF - 32, 26, 64, 6, "dg-tire"), "f-wheel");
      add(box(CX + d * 84 - 13, YR - 32, 26, 64, 6, "dg-tire"), "r-wheel");
    });
    return svg;
  }

  /* ---------- 單一軸的俯視：束角、車寬、轉向角 ---------- */

  function axleTop(P) {
    var front = P.end !== "r", cx = 120, y = front ? 70 : 84;
    var svg = root("0 0 240 150", 12, (front ? "前" : "後") + "軸俯視圖，車頭朝上");
    function add(n) { svg.appendChild(n); return n; }

    function wheels(Q, cls, guide) {
      var out = [], half = 84 + (Q.track || 0);
      [-1, 1].forEach(function (d) {
        var x = cx + d * half, deg;
        if (Q.steer) deg = (d < 0 ? Q.steer[0] : Q.steer[1]) * STEER_GAIN;   // 負值：車頭往左
        else deg = -d * (Q.toe || 0) * TOE_GAIN;                             // Toe-in：輪胎前緣向內
        deg = clamp(deg, -40, 40);
        if (guide) out.push(line([x, y], rot([x, y - 62], deg, [x, y]), "td-guide"));
        out.push(s("rect", {
          x: x - 13, y: y - 32, width: 26, height: 64, rx: 6, class: cls,
          transform: "rotate(" + deg.toFixed(2) + " " + x + " " + y + ")"
        }));
      });
      return out;
    }

    var half = 84 + (P.track || 0);
    if (front) {
      add(box(cx - 34, 34, 68, 130, 8, "dg-chassis"));
      add(box(cx - 52, 14, 104, 10, 5, "dg-part"));
    } else {
      add(box(cx - 34, -14, 68, 134, 8, "dg-chassis"));
    }
    [-1, 1].forEach(function (d) {
      add(poly([[cx + d * 26, y - 14], [cx + d * 26, y + 14], [cx + d * (half - 16), y + 7], [cx + d * (half - 16), y - 7]], "dg-arm"));
      if (front) add(line([cx + d * 10, y + 28], [cx + d * (half - 14), y + 20], "dg-link"));
    });
    add(box(cx - 16, y - 16, 32, 32, 6, "dg-part"));
    if (front) add(box(cx - 12, y + 23, 24, 9, 3, "dg-part"));
    add(line([cx, 4], [cx, 146], "dg-dim"));

    if (P.ghost) wheels(ghostOf(P), "dg-ghost", false).forEach(add);
    wheels(P, "dg-tire", has(P.toe) || !!P.steer).forEach(add);
    if (has(P.track) && P.ghost) add(dim([cx - half - 13, y + 42], [cx + half + 13, y + 42]));

    add(label(cx, front ? y + 52 : y - 34, front ? "前軸" : "後軸", "dg-small"));
    corners(svg, P, 143);
    return svg;
  }

  /* ---------- 單一軸的正視：外傾、滾動中心、防傾桿、Droop、避震器角度 ---------- */

  function axleFront(P) {
    var front = P.end !== "r", cx = 120, G = 126;
    var svg = root("0 0 240 150", 12, (front ? "前" : "後") + "軸正視圖");
    function add(n) { svg.appendChild(n); return n; }

    function geo(Q) {
      var deckY = G - 5.5 * MMV - 5 - (Q.lift || 0);
      var roll = Q.roll || 0, pivot = [cx, G - 10];
      function body(p) { return roll ? rot(p, roll, pivot) : p; }
      var cam = (Q.camber || 0) * CAMBER_GAIN;
      var upX = Q.upperLen === "short" ? 28 : Q.upperLen === "long" ? 6 : 16;
      var topX = Q.shock === "upright" ? 46 : Q.shock === "lean" ? 22 : 34;
      var k = Q.shock === "upright" ? 0.55 : Q.shock === "lean" ? 0.9 : 0.72;
      var sides = [-1, 1].map(function (d) {
        var xc = cx + d * 92, xin = xc - d * 12;
        var lowIn = body([cx + d * 22, deckY - 3 - (Q.lowerIn || 0)]), lowOut = [xin, G - 14];
        var upIn = body([cx + d * upX, deckY - 26 - (Q.upperIn || 0)]);
        var upOut = [xin - d * 34 * Math.sin(cam * RAD), G - 48];
        return {
          d: d, xc: xc, cam: cam, lowIn: lowIn, lowOut: lowOut, upIn: upIn, upOut: upOut,
          shockTop: body([cx + d * topX, deckY - 58]),
          shockLow: [lowIn[0] + (lowOut[0] - lowIn[0]) * k, lowIn[1] + (lowOut[1] - lowIn[1]) * k - 3],
          armMid: [(lowIn[0] + lowOut[0]) / 2, (lowIn[1] + lowOut[1]) / 2]
        };
      });
      return { deckY: deckY, body: body, sides: sides, cg: body([cx, deckY - 24]) };
    }

    // 負外傾：輪胎上緣向車身內側倒
    function tires(g, cls) {
      return g.sides.map(function (sd) {
        return s("rect", {
          x: sd.xc - 12, y: G - 58, width: 24, height: 58, rx: 6, class: cls,
          transform: "rotate(" + clamp(-sd.d * sd.cam, -30, 30).toFixed(2) + " " + sd.xc + " " + G + ")"
        });
      });
    }
    function plate(g, cls) {
      var y = g.deckY;
      return poly([[cx - 30, y], [cx + 30, y], [cx + 30, y + 5], [cx - 30, y + 5]].map(g.body), cls);
    }

    var g = geo(P), y = g.deckY;
    add(line([4, G], [236, G], "dg-ground"));
    if (P.ghost) {
      var gg = geo(ghostOf(P));
      if (has(P.ghost.camber)) tires(gg, "dg-ghost").forEach(add);
      else add(plate(gg, "dg-ghost"));
    }

    var bare = !!(P.rc || P.arb);   // 滾動中心與防傾桿的圖不畫避震器，免得和作圖線、防傾桿混在一起
    if (!bare) {
      add(poly([[cx - 50, y - 62], [cx + 50, y - 62], [cx + 50, y - 55], [cx + 20, y - 49], [cx + 18, y - 34],
        [cx - 18, y - 34], [cx - 20, y - 49], [cx - 50, y - 55]].map(g.body), "dg-part td-tower"));
    }
    add(poly([[cx - 18, y - 34], [cx + 18, y - 34], [cx + 18, y], [cx - 18, y]].map(g.body), "dg-part"));
    g.sides.forEach(function (sd) {
      add(line(sd.lowIn, sd.lowOut, "dg-arm-line"));
      // 上擺臂內球頭比齒箱座還外側時，補一段固定座，免得球頭懸空
      if (Math.abs(sd.upIn[0] - cx) > 20) add(line(sd.upIn, g.body([cx + sd.d * 17, y - 26 - (P.upperIn || 0)]), "td-mount"));
      add(line(sd.upIn, sd.upOut, "dg-link" + (P.upperLen ? " td-on" : "")));
      add(dot(sd.upIn, 2.6, "td-ball"));
      add(dot(sd.upOut, 2.6, "td-ball"));
      if (!bare) add(line(sd.shockTop, sd.shockLow, "dg-damper-line"));
    });
    if (P.arb) {
      var bar = [g.sides[0].armMid, g.body([cx - 24, y - 15]), g.body([cx + 24, y - 15]), g.sides[1].armMid];
      add(s("polyline", { points: pts(bar), class: "td-arb", "stroke-width": P.arb === "hard" ? 5.5 : 1.8 }));
    }
    tires(g, "dg-tire").forEach(add);
    add(plate(g, "dg-chassis"));

    if (P.rc) {
      // 只畫左輪這一側的作圖：A、B 線交於 IC，WC 連到 IC 是線 C，線 C 和中垂線的交點是 RC
      var L = g.sides[0], wc = [L.xc, G];
      var ic = meet(L.lowOut, L.lowIn, L.upOut, L.upIn);
      var far = ic || [L.lowOut[0] + (L.lowIn[0] - L.lowOut[0]) * 60, L.lowOut[1] + (L.lowIn[1] - L.lowOut[1]) * 60];
      var rc = meet(wc, far, [cx, 0], [cx, 150]);
      var edge = function (a) {   // 延伸線畫到 IC；IC 在圖外時畫到右邊界
        if (far[0] <= 236) return far;
        var t = (236 - a[0]) / (far[0] - a[0]);
        return [236, a[1] + t * (far[1] - a[1])];
      };
      add(line([cx, 18], [cx, G], "dg-dim"));
      add(line(L.upOut, edge(L.upOut), "td-con"));
      add(line(L.lowOut, edge(L.lowOut), "td-con"));
      add(line(wc, edge(wc), "td-con td-con-c"));
      add(line(rc, g.cg, "td-lever"));
      if (far[0] <= 232) {
        add(dot(far, 3.5, "td-ic"));
        add(label(far[0] + 7, far[1] + 4, "IC", "dg-label td-halo", "start"));
      } else {
        add(label(236, edge(L.upOut)[1] - 6, "IC 在更遠處 ›", "dg-small td-halo", "end"));
      }
      add(dot(wc, 3.5, "td-ic"));
      add(label(wc[0], G + 14, "WC", "dg-label td-halo"));
      add(dot(rc, 5, "td-rc"));
      add(label(cx - 9, rc[1] + 4, "RC", "dg-label td-halo", "end"));
      add(dot(g.cg, 5, "td-cgdot"));
      add(label(cx - 9, g.cg[1] + 4, "CG", "dg-label td-halo", "end"));
    }

    if (P.force) {
      add(arrow(g.cg, [g.cg[0] + 44, g.cg[1]]));
      add(dot(g.cg, 5, "td-cgdot"));
    }
    if (P.lift) {
      var y0 = G - 5.5 * MMV;
      add(dim([cx + 46, y0], [cx + 46, y + 5]));
      add(label(cx + 54, (y0 + y + 5) / 2 + 4, "Droop", "dg-label td-halo", "start"));
    }

    add(label(cx, 12, (front ? "前軸" : "後軸") + "，由車頭看", "dg-small td-halo"));
    corners(svg, P, 145);
    return svg;
  }

  /* ---------- 整車側視：車高、軸距、Caster、潛角與蹲角、重量轉移 ---------- */

  function carSide(P) {
    var svg = root("0 0 260 136", 11.5, "整車側視圖，車頭朝右");
    var G = 106, R = 26, cy = G - R;
    function add(n) { svg.appendChild(n); return n; }

    function geo(Q) {
      var wb = Q.wb || 0, xr = 62 - wb / 2, xf = 198 + wb / 2;
      var fH = has(Q.fH) ? Q.fH : 5.5, rH = has(Q.rH) ? Q.rH : 5.5;
      return {
        xr: xr, xf: xf, mid: (xr + xf) / 2,
        top: function (x) { return G - (rH + (fH - rH) * (x - xr) / (xf - xr)) * MMV - 5; }
      };
    }
    function deck(q, cls) {
      var x0 = q.xr - 36, x1 = q.xf + 38;
      return poly([[x0, q.top(x0) + 5], [x1, q.top(x1) + 5], [x1, q.top(x1)], [x0, q.top(x0)]], cls);
    }
    function wheel(x, cls) { return s("circle", { cx: x, cy: cy, r: R, class: cls }); }

    var g = geo(P), gg = P.ghost ? geo(ghostOf(P)) : null;
    add(line([4, G], [256, G], "dg-ground"));
    add(box(g.xr - 3, g.top(g.xr) - 50, 6, 50, 2, "dg-part td-tower"));
    add(box(g.xf - 3, g.top(g.xf) - 48, 6, 48, 2, "dg-part td-tower"));
    if (gg && gg.xr !== g.xr) { add(wheel(gg.xr, "dg-ghost")); add(wheel(gg.xf, "dg-ghost")); }

    add(wheel(g.xr, "dg-tire" + (P.fade === "r" ? " td-fade" : "")));
    add(wheel(g.xf, "dg-tire" + (P.fade === "f" ? " td-fade" : "")));
    add(dot([g.xr, cy], 9, "td-hub"));
    add(dot([g.xf, cy], 9, "td-hub"));
    if (gg && (gg.top(g.xr) !== g.top(g.xr) || gg.top(g.xf) !== g.top(g.xf))) add(deck(gg, "dg-ghost"));
    add(deck(g, "dg-chassis"));
    add(box(g.mid - 12, g.top(g.mid + 12) - 12, 48, 12, 2, "dg-battery"));
    add(dot([g.xr + 38, g.top(g.xr + 38) - 11], 11, "dg-motor"));

    if (P.dimH) add(dim([g.mid - 34, G], [g.mid - 34, g.top(g.mid - 34) + 5]));
    if (has(P.wb) && gg) add(dim([g.xr, G + 8], [g.xf, G + 8]));

    if (has(P.caster)) {
      // 正傾角：大王銷上端往車尾（圖的左邊）倒
      var axis = function (deg, cls) {
        var th = clamp(deg * CASTER_GAIN, -40, 40) * RAD;
        return line([g.xf - 50 * Math.sin(th), cy - 50 * Math.cos(th)], [g.xf + 22 * Math.sin(th), cy + 22 * Math.cos(th)], cls);
      };
      add(line([g.xf, cy - 52], [g.xf, G], "dg-dim"));
      if (P.ghost && has(P.ghost.caster)) add(axis(P.ghost.caster, "dg-ghost"));
      add(axis(P.caster, "dg-axis"));
    }

    // 下擺臂轉軸：deg 為正時前端（車頭側，圖的右邊）較高
    function pin(xc, deg, cls) {
      var yc = g.top(xc) - 7, a = clamp(deg * PIN_GAIN, -25, 25) * RAD, len = 27;
      return line([xc - len * Math.cos(a), yc + len * Math.sin(a)], [xc + len * Math.cos(a), yc - len * Math.sin(a)], cls);
    }
    if (has(P.fPin)) { add(pin(g.xf, 0, "dg-ghost")); add(pin(g.xf, P.fPin, "td-pin")); }
    if (has(P.rPin)) { add(pin(g.xr, 0, "dg-ghost")); add(pin(g.xr, P.rPin, "td-pin")); }

    if (P.force) {
      // 慣性力：加速時往後，煞車時往前；被壓的那一軸畫向下的箭頭
      var accel = P.force === "accel", cg = [g.mid, g.top(g.mid) - 24];
      var loaded = accel ? g.xr : g.xf, light = accel ? g.xf : g.xr;
      add(arrow(cg, [cg[0] + (accel ? -44 : 44), cg[1]]));
      add(dot(cg, 5, "td-cgdot"));
      add(arrow([loaded, 6], [loaded, 30]));
      add(arrow([light, 30], [light, 6], "td-arrow is-muted"));
      add(label(loaded, 130, "負載增加", "dg-label"));
      add(label(light, 130, "負載減少", "dg-small"));
    }

    add(label(256, 12, "車頭 ›", "dg-small", "end"));
    corners(svg, P, 130);
    return svg;
  }

  /* ---------- 避震器：彈簧、避震油與活塞 ---------- */

  function shock(P) {
    var svg = root("0 0 240 116", 11.5, "避震器");
    var cy = 46, onSpring = P.focus === "spring", onDamp = P.focus === "damp";
    function add(n) { svg.appendChild(n); return n; }

    // 左：避震器外觀
    add(line([22, cy], [70, cy], "dg-rod"));
    add(dot([14, cy], 8, "dg-eye"));
    add(box(70, cy - 14, 76, 28, 4, "dg-part"));
    add(dot([155, cy], 8, "dg-eye"));
    add(box(30, cy - 21, 6, 42, 2, "dg-part"));
    add(box(100, cy - 21, 7, 42, 2, "dg-collar"));
    var coils = P.spring === "hard" ? 9 : P.spring === "soft" ? 5 : 7;
    var wire = P.spring === "hard" ? 3.8 : P.spring === "soft" ? 1.6 : 2.6;
    var zig = [[36, cy - 19]];
    for (var i = 1; i <= coils * 2; i++) zig.push([36 + 64 * i / (coils * 2), cy + (i % 2 ? 19 : -19)]);
    add(s("polyline", { class: "dg-spring" + (onSpring ? " td-on" : ""), points: pts(zig), "stroke-width": wire }));

    // 右：活塞正面與避震油（顏色越深代表號數越高）
    var px = 202, holes = P.damp === "hard" ? 2 : P.damp === "soft" ? 6 : 4;
    var oil = add(dot([px, cy], 31, "td-oil"));
    oil.style.opacity = P.damp === "hard" ? 0.75 : P.damp === "soft" ? 0.22 : 0.45;
    add(dot([px, cy], 24, "td-piston" + (onDamp ? " td-on" : "")));
    for (var k = 0; k < holes; k++) {
      add(dot(rot([px, cy - 14], k * 360 / holes, [px, cy]), 3.4, "td-hole"));
    }
    add(dot([px, cy], 4, "td-hole-shaft"));

    var word = { hard: "硬", soft: "軟" };
    if (onSpring) {
      add(label(68, 92, "彈簧" + (word[P.spring] ? "：" + word[P.spring] : ""), "dg-label"));
      add(label(px, 92, "活塞與避震油", "dg-small"));
    } else {
      add(label(68, 92, "彈簧", "dg-small"));
      add(label(px, 92, P.damp === "hard" ? "孔少、油濃" : P.damp === "soft" ? "孔多、油稀" : "活塞與避震油", "dg-label"));
    }
    if (P.note) add(label(120, 110, P.note, "dg-small"));
    return svg;
  }

  /* ---------- 傳動配置：前差速、中單向、後差速 ---------- */

  function drive(P) {
    var svg = root("0 0 260 150", 11.5, "傳動配置，車頭朝右");
    var cy = 78, xr = 46, xf = 214, xc = 108;
    function add(n) { svg.appendChild(n); return n; }
    function on(key) { return P.focus === key ? " td-on" : ""; }

    [xr, xf].forEach(function (x) {
      add(line([x, cy - 44], [x, cy + 44], "td-shaft"));
      [-1, 1].forEach(function (d) { add(box(x - 22, cy + d * 48 - 8, 44, 16, 5, "dg-tire")); });
    });
    add(line([xr, cy - 5], [xc, cy - 5], "td-belt2"));
    add(line([xc, cy + 5], [xf, cy + 5], "td-belt2"));
    add(box(xc - 38, cy + 14, 26, 20, 5, "dg-motor"));
    add(box(xc - 9, cy + 12, 5, 30, 2, "dg-gear"));
    add(box(xr - 15, cy - 16, 30, 32, 6, "td-unit" + on("r")));
    add(box(xf - 15, cy - 16, 30, 32, 6, "td-unit" + on("f")));
    add(box(xc - 8, cy - 15, 16, 30, 4, "td-unit" + on("c")));

    // 圖示：四個點是滾珠差速，沿著軸的粗線是直軸，朝車頭的箭頭是單向
    function glyph(x, kind) {
      if (kind === "ball") {
        [[-6, -7], [6, -7], [-6, 7], [6, 7]].forEach(function (o) { add(dot([x + o[0], cy + o[1]], 2.8, "td-glyph")); });
      }
      if (kind === "spool" || kind === "ows") add(line([x - (kind === "ows" ? 6 : 0), cy - 11], [x - (kind === "ows" ? 6 : 0), cy + 11], "td-glyph-bar"));
      if (kind === "oneway" || kind === "ows") {
        var ax = x + (kind === "ows" ? 4 : 0);
        add(poly([[ax + 7, cy], [ax - 4, cy - 7], [ax - 4, cy + 7]], "td-glyph"));
      }
    }
    glyph(xf, P.fk);
    glyph(xr, P.rk);
    if (P.ck) add(poly([[xc + 5, cy], [xc - 4, cy - 6], [xc - 4, cy + 6]], "td-glyph"));

    add(label(4, 13, P.rear || "後軸", P.rear ? "dg-label" : "dg-small", "start"));
    add(label(256, 13, P.front || "前軸", P.front ? "dg-label" : "dg-small", "end"));
    add(label(4, 146, P.center || "中軸與皮帶", P.center ? "dg-label" : "dg-small", "start"));
    if (!P.center) add(label(256, 146, "車頭 ›", "dg-small", "end"));
    return svg;
  }

  /* ---------- 齒比與 Rollout ---------- */

  function rollout(P) {
    var svg = root("0 0 240 120", 11.5, "齒比與 Rollout");
    function add(n) { svg.appendChild(n); return n; }
    var ok = isFinite(P.fdr) && isFinite(P.rollout) && P.rollout > 0;

    add(label(4, 15, "終傳比", "dg-small", "start"));
    add(label(4, 40, ok ? P.fdr.toFixed(2) : "—", "dg-big", "start"));
    add(label(4, 64, "Rollout（mm）", "dg-small", "start"));
    add(label(4, 89, ok ? P.rollout.toFixed(2) : "—", "dg-big", "start"));

    // 大齒盤與馬達齒
    var rs = clamp((P.spur || 80) * 0.2, 6, 22), rp = clamp((P.pinion || 22) * 0.2, 3, 14);
    add(dot([208, 30], rs, "dg-gear-ring"));
    add(dot([208 - rs - rp, 30], rp, "dg-gear-ring dg-pinion"));

    // 輪胎滾一段：長度等於 Rollout
    var gy = 98, r = 19, x0 = 128;
    var len = ok ? clamp(P.rollout * 2.2, 4, 236 - x0 - r) : 0;
    add(line([x0 - r - 4, gy], [236, gy], "dg-ground"));
    if (ok) add(dot([x0 + len, gy - r], r, "dg-ghost"));
    add(dot([x0, gy - r], r, "dg-tire"));
    add(dot([x0, gy - r], 6, "td-hub"));
    if (ok) add(dim([x0, gy + 9], [x0 + len, gy + 9]));
    return svg;
  }

  function draw(kind, P) {
    P = P || {};
    if (kind === "atop") return axleTop(P);
    if (kind === "afront") return axleFront(P);
    if (kind === "side") return carSide(P);
    if (kind === "shock") return shock(P);
    if (kind === "drive") return drive(P);
    if (kind === "roll") return rollout(P);
    return null;
  }

  window.RCTheoryDiagram = { map: map, draw: draw };
})();
