/*
 * 車架 MST RMX 4 GT 的原廠圖：每個欄位在官方圖檔上的位置。要排在 data/chassis-mst-rmx4-gt.js 之後載入，
 * 這個檔把 sheets 加到那個產品物件上，並替欄位補上 fig（格式見 js/app.js 檔頭註解）。
 *
 * 圖直接連到 MST 官網，不放進這個 repo；沒有網路時圖不會出現，其餘照常。用到兩張圖，都是 3508×2480：
 *   - 空白設定表（Setup Sheet）：每一組設定都有一張線條圖，數值的空格與選項的方框就在圖旁邊
 *   - 變更說明（Updated Instruction）：轉向拉桿長度的圖
 * 說明書本身是 PDF，沒辦法只顯示其中一塊，所以只有說明書才有圖的欄位（例如伺服擺臂孔位）這裡沒有。
 *
 * 座標是原圖的像素，用格線對著圖量的。改的時候把圖下載回來對照，不要用猜的。
 *   box  要顯示的範圍
 *   at   數值寫在哪裡（設定表上留空的位置）
 *   opts 每個選項圈在哪裡（孔位就是那個孔，其餘是設定表上的方框）
 *   turn 擺臂座的方向：設定表畫的是原廠的裝法（說明書 p.5、p.17 的組裝圖也是這樣畫），選了另一個方向就把那支擺臂座轉 180°
 *   paint、say 擺臂座的刻度：把兩端長孔裡軸套的位置塗成紅色，圖說寫出是哪一種軸套、朝哪一邊（見下面的 bushes）
 *   hide 要塗黑的地方：前擺臂座下方的 F／R 標籤，擺臂座轉過來之後會壓到它
 *   jump 調這個欄位時釘圖區直接切到原廠圖；已經有自己畫的示意圖會跟著變的欄位不設，要看得按「原廠圖」分頁。
 *        寫成 "always" 的話，就算欄位已經指定了別的示意圖也切到原廠圖
 *
 * 設定表上灰色的孔是原廠孔。資料檔裡的「孔 A」「孔 B」是這個網頁自己取的名字（說明書沒有替孔命名），
 * 孔 A 就是設定表上灰色的那一個。
 */
(function () {
  "use strict";

  var product = (window.RC_PRODUCTS || []).filter(function (p) { return p.id === "mst-rmx4-gt"; })[0];
  if (!product) return;

  var BASE = "https://www.rc-mst.com/_upload/down_item_img/";
  product.sheets = {
    setup: { src: BASE + "202608260858482a.jpg", w: 3508, h: 2480, credit: "圖：MST 官方設定表" },
    updated: { src: BASE + "202608171147102a.jpg", w: 3508, h: 2480, credit: "圖：MST 官方變更說明" }
  };

  // 設定表上的各個區塊
  var B = {
    steering: [120, 380, 600, 620],
    fuSpacer: [90, 780, 480, 1135],          // 前輪座：三處球頭墊片
    fuHole: [200, 1200, 514, 1405],          // 前輪座：左右轉向臂的孔
    fHub: [660, 920, 1140, 1320],
    fSus: [1262, 736, 2070, 1412],
    fStay: [1570, 770, 2050, 1060],          // 前避震塔上端
    rSus: [2112, 736, 2990, 1412],
    rStay: [2440, 770, 2950, 1060],          // 後避震塔上端
    ruHole: [3135, 835, 3335, 1022],
    ruSpacer: [3110, 1065, 3350, 1300],
    fmTop: [380, 1470, 1260, 1760],          // 前擺臂座：側視，兩個座的下墊片
    fmF: [90, 1770, 580, 1895],
    fmR: [730, 1770, 1220, 1895],
    rmTop: [2700, 1470, 3430, 1760],
    rmF: [2240, 1760, 2820, 1920],
    rmR: [2850, 1760, 3430, 1920],
    diff: [1310, 1600, 2190, 2110],
    fd: [70, 1965, 1236, 2340],
    fdEnd: [466, 2200, 860, 2335],           // 前避震下端的兩種拉桿頭
    rd: [2262, 1965, 3428, 2340],
    rdEnd: [2662, 2200, 3055, 2335]
  };

  // 後傾角：設定表把三種裝法並排，只顯示選到的那一種
  var CASTER = { "8.6°": [800, 332, 1260, 690], "7°": [1370, 332, 1830, 690], "5.5°": [1930, 332, 2490, 690] };

  // 擺臂座的刻度是靠兩端長孔裡的軸套決定的，一支擺臂座只有四種放法。出處是 MST 官網可調擺臂座
  // （料號 820143）產品頁的「Suspension mount adjustment modes」圖，由小到大：
  //   軸套 A（圓孔）朝內、軸套 B（長孔）朝內、軸套 B 朝外、軸套 A 朝外
  // 後擺臂座官方沒有這張對照圖，但說明書 p.17 畫的原廠裝法（+12.0 是軸套 B 朝內、+13.0 是軸套 A 朝外）符合同一套規則。
  // base 是最小的刻度，slots 是設定表上那支擺臂座左右兩個長孔的內緣
  var BUSH = ["軸套 A（圓孔）朝內", "軸套 B（長孔）朝內", "軸套 B（長孔）朝外", "軸套 A（圓孔）朝外"];
  function bushStep(v, id, base) {
    var n = Math.round((parseFloat(v[id]) - base) / 0.5);
    return n >= 0 && n <= 3 && Math.abs(parseFloat(v[id]) - base - n * 0.5) < 0.01 ? n : -1;
  }
  function bushes(id, base, slots) {
    return {
      paint: function (v) {
        var n = bushStep(v, id, base);
        if (n < 0) return [];
        var round = n === 0 || n === 3, inward = n < 2;
        return slots.map(function (r, i) {
          var len = round ? r[3] - r[1] : (r[2] - r[0]) * 0.62;
          var x0 = (i === 0) !== inward ? r[0] : r[2] - len;   // 左邊的孔朝內是靠右，右邊的孔朝內是靠左
          return [x0, r[1], x0 + len, r[3]];
        });
      },
      say: function (v) {
        var n = bushStep(v, id, base);
        return n < 0 ? "不在四種放法裡" : BUSH[n];
      }
    };
  }
  function mount(box, at, bush) {
    return { box: box, at: at, jump: "always", paint: bush.paint, say: bush.say };
  }

  var FIGS = {
    steer_connecter_spacer: { box: B.steering, at: [340, 417, "r"], jump: true },
    // 圖上印的 15.6 mm 是原廠值：塗掉、改寫目前的值。不設 jump：這個欄位有自己的拉桿圖
    tie_rod_len: { on: "updated", box: [60, 1800, 715, 2010], at: [384, 1864], hide: [[322, 1846, 447, 1883]] },
    caster: { box: function (v) { return CASTER[v.caster] || CASTER["7°"]; } },

    fu_top_spacer: { box: B.fuSpacer, at: [173, 802, "r"], jump: true },
    fu_steer_spacer: { box: B.fuSpacer, at: [370, 929, "r"], jump: true },
    fu_bottom_spacer: { box: B.fuSpacer, at: [162, 1102, "r"], jump: true },
    fu_knuckle_hole: {
      box: B.fuHole, jump: true,
      opts: {
        "孔 A": [[300, 1346, "A", "r"], [422, 1346, "A", "l"]],
        "孔 B": [[307, 1372, "B", "r"], [415, 1372, "B", "l"]]
      }
    },
    f_hub_spacer: { box: B.fHub, at: [718, 982, "r"], jump: true },

    f_damper_ball_spacer: { box: B.fStay, at: [1768, 809, "r"], jump: true },
    f_camber: { box: B.fSus, at: [1471, 851, "l"] },
    f_toe: { box: B.fSus, at: [1471, 903, "l"] },
    f_ride_height: { box: B.fSus, at: [1502, 1373, "l"] },

    fsm_f_pos: mount(B.fmF, [195, 1860], bushes("fsm_f_pos", 3.5, [[277.8, 1855.4, 306.3, 1865], [518.7, 1855.4, 547.2, 1865]])),
    fsm_f_dir: {
      box: B.fmF, jump: true, opts: { "△": [314, 1806], "▽": [467, 1806] },
      turn: { box: [262, 1828, 562, 1886], drawn: "▽" }, hide: [[384, 1871, 438, 1920]]
    },
    fsm_f_spacer: { box: B.fmTop, at: [434, 1655, "r"], jump: true },
    fsm_r_pos: mount(B.fmR, [829, 1860], bushes("fsm_r_pos", 3.5, [[910.7, 1855, 939.2, 1864.6], [1151.6, 1855, 1180.1, 1864.6]])),
    fsm_r_dir: {
      box: B.fmR, jump: true, opts: { "△": [946, 1806], "▽": [1100, 1806] },
      turn: { box: [895, 1828, 1196, 1886], drawn: "▽" }, hide: [[1018, 1871, 1072, 1920]]
    },
    fsm_r_spacer: { box: B.fmTop, at: [895, 1653, "r"], jump: true },

    r_damper_ball_spacer: { box: B.rStay, at: [2525, 806, "r"], jump: true },
    r_camber: { box: B.rSus, at: [2885, 781, "l"] },
    r_toe: { box: B.rSus, at: [2868, 834, "l"] },
    r_ride_height: { box: B.rSus, at: [2815, 1375, "l"] },

    ru_hole: { box: B.ruHole, jump: true, opts: { "孔 A": [3280, 928, "A", "t"], "孔 B": [3233, 928, "B", "t"] } },
    ru_spacer: { box: B.ruSpacer, at: [3189, 1092, "r"], jump: true },

    rsm_f_pos: mount(B.rmF, [2303, 1842], bushes("rsm_f_pos", 11.5, [[2420.9, 1836.2, 2448.6, 1844.8], [2731.2, 1836.2, 2758.9, 1844.8]])),
    // 後擺臂座原廠是 F ▽（字是倒的）、R △（字是正的）
    rsm_f_dir: {
      box: B.rmF, jump: true, opts: { "△": [2491, 1788], "▽": [2645, 1788] },
      turn: { box: [2373, 1808, 2806, 1871], drawn: "▽" }
    },
    rsm_f_spacer: { box: B.rmTop, at: [2957, 1622, "r"], jump: true },
    rsm_r_pos: mount(B.rmR, [2918, 1842], bushes("rsm_r_pos", 11.5, [[3034.9, 1836.2, 3062.6, 1844.8], [3345.2, 1836.2, 3372.9, 1844.8]])),
    rsm_r_dir: {
      box: B.rmR, jump: true, opts: { "△": [3105, 1788], "▽": [3259, 1788] },
      turn: { box: [2987, 1808, 3421, 1871], drawn: "△" }
    },
    rsm_r_spacer: { box: B.rmTop, at: [3351, 1612, "r"], jump: true },

    diff_type: { box: B.diff, jump: true, opts: { "Gear diff.": [1355, 2029], "LSD": [1672, 2029], "Ball diff.": [1997, 2029] } },
    // 設定表只有齒輪差速器與 LSD 有差速器油的空格
    diff_oil: {
      box: B.diff, jump: true,
      at: function (v) { return v.diff_type === "LSD" ? [1789, 2072, "l"] : v.diff_type === "Ball diff." ? null : [1472, 2072, "l"]; }
    },

    fd_oil: { box: B.fd, at: [1034, 2034, "l"] },
    fd_spring_len: { box: B.fd, at: [1003, 2092, "l"] },
    fd_spring_wire: { box: B.fd, at: [1131, 2092, "l"] },
    fd_spring_color: { box: B.fd, at: [1073, 2152, "l"] },
    fd_piston_dia: { box: B.fd, at: [1003, 2229, "l"] },
    fd_piston_holes: { box: B.fd, at: [1062, 2296, "l"] },
    fd_retainer: { box: B.fd, at: [417, 2211, "r"] },
    fd_upper_end: { box: B.fd, at: [275, 2272, "r"] },
    fd_lower_end: { box: B.fdEnd, jump: true, opts: { "3": [530, 2226], "1": [772, 2226] } },

    rd_oil: { box: B.rd, at: [3208, 2002, "l"] },
    rd_spring_len: { box: B.rd, at: [3176, 2061, "l"] },
    rd_spring_wire: { box: B.rd, at: [3304, 2061, "l"] },
    rd_spring_color: { box: B.rd, at: [3089, 2177, "l"] },
    rd_piston_dia: { box: B.rd, at: [3176, 2254, "l"] },
    rd_piston_holes: { box: B.rd, at: [3237, 2318, "l"] },
    rd_retainer: { box: B.rd, at: [2613, 2211, "r"] },
    rd_upper_end: { box: B.rd, at: [2471, 2272, "r"] },
    rd_lower_end: { box: B.rdEnd, jump: true, opts: { "3": [2726, 2226], "1": [2969, 2226] } }
  };

  product.groups.forEach(function (grp) {
    grp.items.forEach(function (it) {
      var fig = FIGS[it.id];
      if (!fig) return;
      it.fig = fig;
      if (fig.jump && (!it.viz || fig.jump === "always")) it.viz = "sheet";
    });
  });
})();
