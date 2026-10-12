/*
 * 遙控器：Futaba T10PX
 *
 * 欄位、選項、可調範圍與初始值來源（在 manuals 清單裡）：
 *   - 原廠英文完整說明書 WEB FULL MANUAL（1M23Z08002，封面標示 Compatible with ~Ver.11.1，237 頁）
 *     每個群組的 src 寫的是這份說明書的頁碼。
 *
 * 預設值的規則：
 *   factory   說明書寫明「Initial value」或「Initial settings」的值，畫面上標成「原廠」
 *   preset    說明書沒寫初始值、取自說明書畫面截圖的值（欄位的 fnote 會註明），畫面上標成「預設」
 *   factoryOf Model Type 選 Drift 時，說明書 p.69 列出的初始設定（Gyro mixing ON、Ch3、DL1→Gyro Gain、Step 1）
 *
 * T10PX 的 Condition 可以讓部分功能存最多 4 組值；這個檔只記錄 Condition 1 的值。
 * 10 個頻道的逐頻道欄位用小函式產生；CH5–CH10 由頁面的顯示開關 aux_shown 收起來（不是遙控器上的設定）。
 *
 * effect 每一筆的來源：
 *   m(...) 說明書原文有寫的特性
 * 圖表（charts）：說明書沒有給 EXP／VTR 的計算式，比率不是 0 的線一律用 guess（示意）；
 * Acceleration 只有 0 與 100 是說明書寫明的，中間值按比例畫，也用 guess。
 * min／max／step 骨架也會讀（加減按鈕）；scale、charts、locks 只有 js/visual.js 會讀，格式見該檔開頭。
 */
(function () {
  "use strict";

  function m(when, then) { return { w: when, t: then, manual: true }; }

  var BASE = "https://www.rc.futaba.co.jp/";

  /* ---------- 共用的選項與文字 ---------- */

  var OFF_ON = ["OFF", "ON"];
  var NOR_REV = ["Nor.", "Rev."];
  var NOR_ALT = ["Nor.", "Alt."];
  var CURVE_TYPES = ["EXP", "VTR", "Curve"];
  var SHOW_4 = "CH1-4", SHOW_ALL = "CH1-10";
  var F4G = "F-4G", TFHSS_SR = "T-FHSS SR", TFHSS = "T-FHSS", SFHSS = "S-FHSS", MINIZ = "Mini-Z";
  var RATIO_100_0 = "Forward 100 : Brake 0";
  var FS = "Fail-safe";
  var GAIN_1 = "1 gain", GAIN_2 = "2 gains", GAIN_4 = "4 gains";
  var STEPS = ["1", "2", "5", "10", "20", "30", "40", "50", "100", "200"];
  var BFS_VOLTS = ["3.8", "4.0", "4.2", "4.4", "4.6", "4.8", "5.0", "5.3", "5.6", "5.9", "6.2", "6.5", "6.8", "7.1", "7.4"];

  // 說明書沒寫初始值的欄位，預設值取自畫面截圖時加上這句
  var SHOT = "說明書沒有寫初始值，預設取自說明書的畫面截圖";
  var NO_BRAKE = "Ratio 設成 Forward 100 : Brake 0 時煞車側不動作（說明書）";

  function range(a, b) {
    var out = [];
    for (var i = a; i <= b; i++) out.push(i);
    return out;
  }

  function numbered(prefix, a, b, suffix) {
    return range(a, b).map(function (n) { return prefix + n + (suffix || ""); });
  }

  // 說明書 p.93 Set table functions（DL1／DT1–DT6）。表上寫成一列的「Channel 3 to 10 control」「Sub trim Ch.1 to 10」
  // 「Prog. mixing 1~5 A／B」依畫面上看得到的寫法（Channel 3 control…）展開成單項。
  var TRIM_FUNCS = ["Off", "Steering trim", "Throttle trim"]
    .concat(numbered("Channel ", 3, 10, " control"))
    .concat(["Flap", "Dual rate"])
    .concat(numbered("Sub trim Ch.", 1, 10))
    .concat([
      "Acceleration (forward)", "Acceleration (brake 1)", "Acceleration (brake 2)", "Acceleration (brake 3)",
      "Steering curve", "Throttle curve", "Steering speed(turn)", "Steering speed(return)",
      "Th speed(turn/high)", "Th speed(turn/middle)", "Th speed(turn/low)",
      "Th speed(return/high)", "Th speed(return/middle)", "Th speed(return/low)",
      "ABS(return brake 1)", "ABS(delay brake 1)", "ABS(cycle brake 1)",
      "ABS(return brake 2)", "ABS(delay brake 2)", "ABS(cycle brake 2)",
      "ABS(return brake 3)", "ABS(delay brake 3)", "ABS(cycle brake 3)",
      "Traction control(return)", "Traction control(delay)", "Traction control(cycle)",
      "Brake1 rate(ATL)", "Brake EXP (brake 1)", "Brake delay (brake 1)",
      "Brake rate (brake 2)", "Brake EXP (brake 2)", "Brake delay (brake 2)",
      "Brake rate (brake 3)", "Brake EXP (brake 3)", "Brake delay (brake 3)",
      "Brake 2,3 rate", "Tilt mixing (RUD→FLP)", "Tilt mixing (FLP→RUD)", "Idle up"
    ])
    .concat(numbered("Prog. mixing ", 1, 5, " A"))
    .concat(numbered("Prog. mixing ", 1, 5, " B"))
    .concat([
      "4WS rear rate", "Dual ESC", "Dual ESC ratio", "Gyro gain", "Ackermann rate", "Condition",
      "Throttle rate", "Engine cut", "Gyro data", "Steering response", "Throttle response"
    ]);

  // 說明書 p.96 Set table functions（SW1–SW7、SSW1、PD1、PD2、SS、TS），另加 p.103 的 Throttle rate、p.223 的 Gyro data 1–5。
  var SW_FUNCS = ["Off"]
    .concat(numbered("Channel ", 3, 10, " control"))
    .concat(["Condition 1 ⇄ 2"])
    .concat(numbered("Condition ", 1, 4))
    .concat(numbered("Program mixing ", 1, 5))
    .concat([
      "A.B.S. (Brake 1)", "A.B.S. (Brake 2,3)", "Traction control", "4WS mixing",
      "4WS type1 (Front)", "4WS type2 (Reverse)", "4WS type3 (Same)", "4WS type4 (Rear)",
      "Dual ESC (Rear)", "Dual ESC (4WD)", "Dual ESC (Front)", "Gyro mixing", "Gyro gain", "Gyro group"
    ])
    .concat(numbered("CPS mixing ", 1, 3))
    .concat([
      "Brake", "Start", "Engine cut", "Idle up", "Neutral brake", "Timer start", "Timer reset",
      "Telemetry speech", "Telemetry log", "Screen capture", "Backlight", "Throttle rate"
    ])
    .concat(numbered("Gyro data ", 1, 5));

  /* ---------- 原廠值：Model Type 選 Drift 時的初始設定（說明書 p.69） ---------- */

  // 說明書沒有寫新模型的 Model Type 是哪一種，所以只給頁面預設（preset）。
  // 說明書各頁的畫面截圖都是 Normal 的狀態，先預設 Normal；使用者的車是甩尾車，要改成 Drift 當預設就改這一行。
  var DEFAULT_TYPE = "Normal";

  var DRIFT = { gyro_mix: "ON", gyro_ch: "Ch.3", dl1_func: "Gyro gain", dl1_step: "1" };

  function factoryOf(it, vals) {
    if (vals.model_type === "Drift" && Object.prototype.hasOwnProperty.call(DRIFT, it.id)) return DRIFT[it.id];
    return it.factory;
  }

  /* ---------- 欄位產生器 ---------- */

  function ext(it, extra) {
    Object.keys(extra || {}).forEach(function (k) { if (extra[k] !== undefined) it[k] = extra[k]; });
    return it;
  }

  // 說明書有寫範圍的數值，每格 1
  function num(id, name, en, min, max, extra) {
    return ext({ id: id, name: name, en: en, type: "num", min: min, max: max, step: 1 }, extra);
  }

  function sel(id, name, en, options, extra) {
    return ext({ id: id, name: name, en: en, type: "select", options: options }, extra);
  }

  function text(id, name, en, extra) {
    return ext({ id: id, name: name, en: en, type: "text" }, extra);
  }

  function is(id, value) { return function (v) { return v[id] === value; }; }
  function not(id, value) { return function (v) { return v[id] !== value; }; }
  function all(a, b) { return function (v) { return a(v) && b(v); }; }

  // CH5–CH10 的欄位要把顯示開關切到 CH1-10 才出現
  function auxOn(v) { return v.aux_shown === SHOW_ALL; }
  function shown(n, extra) {
    if (n <= 4) return extra;
    return extra ? all(auxOn, extra) : auxOn;
  }

  function system(list) { return function (v) { return list.indexOf(v.rx_system) >= 0; }; }

  // Condition 2–4 的欄位：Condition 功能開啟、而且組數夠才出現
  function condShown(n) {
    return function (v) { return n === 1 || (v.cond_mode === "ON" && parseInt(v.cond_count, 10) >= n); };
  }

  function chLabel(n) { return "CH" + n + (n === 1 ? "（轉向）" : n === 2 ? "（油門）" : ""); }

  /* ----- 逐頻道：Channel Reverse、Sub Trim、End Point、Channel Limiter ----- */

  function reverse(n, name) {
    return sel("rev_ch" + n, name, "Channel reverse: Channel " + n, ["N", "R"], {
      preset: "N",
      showIf: shown(n),
      fnote: "N＝Normal、R＝Reverse。" + SHOT,
      effect: [
        m("R", "這個頻道的伺服機動作方向反過來"),
        m("注意", "微調或 Sub trim 讓位置偏離中心時，反向後中心會跑到另一側")
      ]
    });
  }

  function subtrim(n, name) {
    return num("subtrim_ch" + n, name, "Sub trim: Ch." + n, -100, 100, {
      factory: 0, signed: true,
      showIf: shown(n),
      fnote: n <= 2 ? "調之前先照車架說明書裝好伺服機擺臂，並把轉向、油門的微調歸 0" : "調之前先把輔助頻道歸到中心 0",
      effect: [m("作用", "調整伺服機的中立位置；Sub trim 會讓伺服機的整個行程往設定的方向移動")]
    });
  }

  var AUX_SIDES = "輔助頻道兩個方向的數值在畫面上沒有名稱，這裡依畫面的左欄、右欄記錄";

  function auxItems(n) {
    var c = "CH" + n;
    return [
      reverse(n, c + " 反向"),
      subtrim(n, c + " Sub trim"),
      num("ep_ch" + n + "_l", c + " End point（左欄）", "End point: Channel" + n + " (left value)", 0, 140,
        { factory: 100, showIf: shown(n), fnote: AUX_SIDES }),
      num("ep_ch" + n + "_r", c + " End point（右欄）", "End point: Channel" + n + " (right value)", 0, 140,
        { factory: 100, showIf: shown(n), fnote: AUX_SIDES }),
      num("lim_ch" + n + "_l", c + " Limiter（左欄）", "Channel limiter: Channel" + n + " (left value)", 0, 145,
        { factory: 145, showIf: shown(n), fnote: AUX_SIDES }),
      num("lim_ch" + n + "_r", c + " Limiter（右欄）", "Channel limiter: Channel" + n + " (right value)", 0, 145,
        { factory: 145, showIf: shown(n), fnote: AUX_SIDES })
    ];
  }

  /* ----- 逐頻道：Channel Setting ----- */

  function chSetting(n) {
    var own = "Channel" + n;
    var options = n <= 2 ? ["Steering", "Throttle"] : [own, "Steering", "Throttle"];
    var items = [sel("chset_ch" + n, "CH" + n + " 的操作來源", "Channel setting: Ch." + n, options, {
      preset: n === 1 ? "Steering" : n === 2 ? "Throttle" : own,
      showIf: shown(n),
      fnote: (n <= 2 ? "" : "選單裡按 Reset 就回到 " + own + "。") + SHOT,
      effect: n === 1 ? [m("作用", "把轉向或油門指定給任何頻道：可以用別的頻道輸出轉向、油門，其他頻道也能像轉向、油門一樣操作")] : undefined
    })];
    if (n >= 3) {
      items.push(num("chpos_ch" + n, "CH" + n + " 位置", "Channel setting: Ch." + n + " Position", -100, 100, {
        factory: 0, signed: true,
        showIf: shown(n, is("chset_ch" + n, own)),
        fnote: "沒有指定開關、微調鍵或旋鈕來操作這個輔助頻道時，可以在這裡直接設定位置"
      }));
    }
    return items;
  }

  /* ----- 逐頻道：Fail-safe ----- */

  function failsafe(n) {
    var mode = "fs_ch" + n, c = chLabel(n);
    var effect = [
      m(FS, "收不到發射機訊號時，伺服機移到預先設定的位置"),
      m("Hold", "維持在訊號中斷前的位置"),
      m("Off", "停止輸出訊號，伺服機變成自由狀態")
    ];
    if (n === 2) effect.push(m("引擎車", "為了安全，說明書建議把油門頻道設成往煞車的方向"));
    return [
      sel(mode, c + " 失控模式", "Fail-safe: Channel " + n + " Mode", ["Off", "Hold", FS], {
        preset: n <= 4 ? "Off" : undefined,
        showIf: shown(n),
        fnote: n <= 4 ? SHOT : "說明書 p.87 的文字寫 F-4G 的 CH5–CH10 不能設成 Off，但同一頁的畫面截圖顯示 Off；初始值說明書未標示，所以沒有給預設",
        effect: effect
      }),
      ext({ id: "fs_pos_ch" + n, name: c + " 失控位置", en: "Fail-safe: Channel " + n + " Position", type: "num", step: 1 }, {
        signed: true,
        showIf: shown(n, is(mode, FS)),
        fnote: "把方向盤、扳機或其他操作件固定在想要的位置，再點 Position 按鈕寫入；畫面顯示的數值記在這裡。說明書沒有寫數值範圍"
      }),
      sel("bfs_ch" + n, c + " 電池失控保護", "Fail-safe: Channel " + n + " B-F/S", OFF_ON, {
        factory: "OFF",
        showIf: shown(n, is(mode, FS)),
        fnote: "失控模式設成 Fail-safe 的頻道才能用",
        effect: [m("ON", "接收機電池電壓低於設定值時，伺服機移到失控保護設定的位置（說明書以油門伺服機說明）；電壓回復後自動解除")]
      })
    ];
  }

  /* ----- 接收機 Response ----- */

  function rxResponse(n) {
    return sel("rx_resp_ch" + n, "CH" + n + " 反應模式", "Receiver: Response Ch." + n + " (F-4G)",
      ["Analog servo", "Digital servo", "SR mode", "UR mode"], {
        preset: "Digital servo",
        showIf: system([F4G]),
        fnote: "UR mode、SR mode 要搭配設成同一種模式的專用伺服機；一般伺服機與電變用 Digital servo 或 Analog servo。" + SHOT,
        effect: [
          m("UR mode", "UR 伺服機（設成 UR mode）專用，反應比 SR mode 更好；V2.0 以後"),
          m("SR mode", "UR／SR 伺服機（設成 SR mode）專用"),
          m("Digital servo", "Futaba 數位伺服機"),
          m("Analog servo", "Futaba 數位或類比伺服機"),
          m("注意", "開了 UR／SR mode 的頻道，一般伺服機、電變、一般陀螺儀都不會動作，接上去有損壞的風險")
        ]
      });
  }

  function rxSr(n) {
    return sel("rx_sr_ch" + n, "CH" + n + " SR 模式", "Receiver: Response Ch." + n + " (T-FHSS SR)", OFF_ON, {
      preset: "OFF",
      showIf: system([TFHSS_SR]),
      fnote: (n === 1 ? "T-FHSS SR 的畫面上另有一個 Servo 按鈕，說明書沒有說明用途，這裡沒有建立。" : "") + SHOT,
      effect: [
        m("ON", "Futaba SR 伺服機專用；切換後要把接收機重新開機"),
        m("OFF", "Futaba 數位伺服機")
      ]
    });
  }

  /* ----- 曲線：轉向、油門、煞車共用同一組欄位 ----- */

  function curveItems(key, label, enTitle, src) {
    var type = key + "_curve_type";
    var notCurve = not(type, "Curve"), isCurve = is(type, "Curve");
    return [
      sel(type, label + "曲線類型", enTitle + ": Type", CURVE_TYPES, {
        preset: "EXP",
        fnote: src.typeNote + SHOT,
        effect: [
          m("EXP", "從中立到底是一條彎曲的曲線"),
          m("VTR", "在中立到底之間設一個切換點，切換點前後各是一段直線"),
          m("Curve", "最多 21 個點連成的折線")
        ]
      }),
      num(key + "_curve_rate", label + "曲線比率", enTitle + ": EXP rate / VTR rate", -100, 100, {
        factory: src.rateFactory, preset: src.ratePreset, signed: true,
        showIf: notCurve,
        fnote: src.rateNote,
        effect: src.rateEffect
      }),
      num(key + "_vtr_point", label + " VTR 切換點", enTitle + ": Point", 1, 99, {
        factory: src.rateFactory == null ? undefined : 50, preset: src.ratePreset == null ? undefined : 50,
        showIf: is(type, "VTR"),
        fnote: src.pointNote
      })
    ].concat(src.extra || []).concat([
      text(key + "_curve_points", label + " Curve 各點比率", enTitle + ": Point rate", {
        showIf: isCurve,
        fnote: "Curve 類型最多 21 點，每一點的比率 0–100，中立與兩端的比率不能改。把有開啟（ON）的點號與比率記在這裡，例如「P5:27, P9:60」"
      })
    ]);
  }

  /* ----- Trim/Dial Select、Switch Select ----- */

  var STEP_NOTE = "每撥一格的變化量。轉向／油門微調：設 1 時全行程 200 格、設 100 時 2 格；比率類：每格相對設定值變化的 %；輔助頻道：設 1 時全行程 200 格、設 200 時 1 格";

  function trim(key, label, initial) {
    var func = key + "_func", used = not(func, "Off");
    return [
      sel(func, label + " 功能", "Trim/Dial select: " + label + " Function", TRIM_FUNCS, {
        factory: initial || undefined,
        preset: initial ? undefined : "Off",
        fnote: initial ? "初始設定出自說明書 p.13；功能名稱依 p.91 的畫面" : "Model Type 選 Drift 時初始是 Gyro gain（說明書 p.69）。其餘情況" + SHOT
      }),
      sel(key + "_dir", label + " 方向", "Trim/Dial select: " + label + " Dir.", NOR_REV, {
        preset: "Nor.",
        showIf: used,
        fnote: "Nor.＝Normal、Rev.＝Reverse（操作方向相反）。" + SHOT
      }),
      sel(key + "_step", label + " 每格變化量", "Trim/Dial select: " + label + " Step", STEPS, {
        factory: "2", scale: STEPS,
        showIf: used,
        fnote: STEP_NOTE
      })
    ];
  }

  function switchItems(key, label, opt) {
    var func = key + "_func", used = not(func, "Off");
    var items = [sel(func, label + " 功能", "Switch select: " + label + " Function", SW_FUNCS, {
      preset: "Off",
      fnote: (opt.note ? opt.note + "。" : "") + SHOT
    })];
    if (opt.point) {
      items.push(num(key + "_point", label + " 切換位置", "Switch select: " + opt.pointEn, opt.point[0], opt.point[1], {
        factory: 100,
        showIf: used,
        fnote: "ON／OFF 切換的位置。也可以把" + opt.grip + "固定在想要切換的位置後點 Set 寫入，再用加減鍵微調；畫面上長條圖紅色的範圍是 ON"
      }));
    }
    items.push(sel(key + "_dir", label + " 方向", "Switch select: " + label + " Dir.", NOR_REV, {
      preset: "Nor.",
      showIf: used,
      fnote: (opt.dirNote ? opt.dirNote + "。" : "") + SHOT,
      effect: [m("Rev.", "ON／OFF 的方向相反；選反向的功能一律從 ON 的狀態開始（SS、TS 則依當時的位置而定）")]
    }));
    if (!opt.noType) {
      items.push(sel(key + "_type", label + " 型式", "Switch select: " + label + " Type", NOR_ALT, {
        preset: "Nor.",
        showIf: used,
        fnote: "Nor.＝Normal、Alt.＝Alternate。" + SHOT,
        effect: [m("Alt.", "每按一次就在 ON 與 OFF 之間切換")]
      }));
    }
    return items;
  }

  function flat(lists) {
    return lists.reduce(function (out, list) { return out.concat(list); }, []);
  }

  /* ---------- 圖表：依目前的值回傳圖表規格，資料不足時回傳 { title, empty } ---------- */

  function val(v) { return v == null || v === "" ? NaN : parseFloat(v); }

  var PCT = [0, 25, 50, 75, 100];
  function axis(label) { return { label: label, max: 100, ticks: PCT }; }

  // 說明書沒有給 EXP 的計算式：這裡用三次曲線表示彎曲的方向與大概的形狀，只當示意
  function expPoints(rate) {
    var k = Math.abs(rate) / 100, pts = [];
    for (var x = 0; x <= 100; x += 5) {
      var t = x / 100, u = 1 - t;
      var mild = (1 - k) * t + k * t * t * t;
      var quick = 1 - ((1 - k) * u + k * u * u * u);
      pts.push([x, +((rate < 0 ? mild : quick) * 100).toFixed(1)]);
    }
    return pts;
  }

  // VTR：切換點前後各一段直線（說明書）。切換點的高度說明書沒有給算式，這裡按比率在直線與上下限之間內插，只當示意
  function vtrPoints(rate, point) {
    var y = rate >= 0 ? point + (100 - point) * rate / 100 : point * (1 + rate / 100);
    return [[0, 0], [point, +y.toFixed(1)], [100, 100]];
  }

  function curveChart(key, title, xLabel, extraNote) {
    return function (v) {
      var type = v[key + "_curve_type"], rate = val(v[key + "_curve_rate"]), point = val(v[key + "_vtr_point"]);
      if (type === "Curve") return { title: title, empty: "Curve 類型的各點比率記在文字欄位，這裡不畫。" };
      if (!type || isNaN(rate) || (type === "VTR" && isNaN(point))) return { title: title, empty: "選好曲線類型並填入比率後顯示。" };
      var lines = [];
      if (rate) lines.push({ kind: "ref", label: "0（Normal）", points: [[0, 0], [100, 100]] });
      lines.push({
        kind: rate ? "guess" : "main", area: !rate,
        label: type + " " + (rate > 0 ? "+" : "") + rate + (rate > 0 ? "（Quick）" : rate < 0 ? "（Mild）" : ""),
        points: type === "VTR" ? vtrPoints(rate, point) : expPoints(rate)
      });
      return {
        title: title,
        x: axis(xLabel),
        y: axis("伺服機行程 %"),
        lines: lines,
        marks: type === "VTR" && rate ? [{ x: point, label: "切換點" }] : [],
        note: (rate
          ? "說明書只用示意圖表示 + 側（Quick）往上、- 側（Mild）往下，沒有給計算式；虛線的彎曲程度僅為示意。"
          : "比率 0 是直線，操作量與伺服機行程成正比。") + (extraNote || "")
      };
    };
  }

  // Acceleration：說明書寫 100 時前進側一離開中立就跳到約 1/2 行程、煞車側跳到最大行程，之後維持直線
  function accelChart(id, title, full) {
    return function (v) {
      var a = val(v[id]);
      if (isNaN(a)) return { title: title, empty: "填入數值後顯示。" };
      var jump = +(a / 100 * full).toFixed(1);
      var exact = a === 0 || a === 100;
      var lines = [];
      if (a) lines.push({ kind: "ref", label: "0（沒有加速補償）", points: [[0, 0], [100, 100]] });
      lines.push({ kind: exact ? "main" : "guess", area: exact, label: "設定 " + a, points: [[0, 0], [0, jump], [100, 100]] });
      return {
        title: title,
        x: axis("扳機操作量 %"),
        y: axis("伺服機行程 %"),
        lines: lines,
        note: "說明書：設 100 時一離開中立就跳到" + (full === 50 ? "約 1/2 行程" : "最大行程") + "，之後維持直線。"
          + (exact ? "" : "中間的設定值按比例畫，僅為示意。")
      };
    };
  }

  /* ---------- 產品定義 ---------- */

  var BRAKE_ITEMS = ["ep_th_brk", "acc_brk1", "brk_curve_type", "brk_curve_rate", "brk_vtr_point", "brk_curve_points",
    "abs_mode", "abs_return", "abs_delay", "abs_cycle", "abs_duty", "abs_point", "abs_point_dir"];

  var trcOn = is("trc_mode", "ON"), absOn = is("abs_mode", "ON"), startOn = is("start_mode", "ON");
  var respOn = is("resp_mode", "ON"), gyroOn = is("gyro_mix", "ON"), condOn = is("cond_mode", "ON");

  function gainShown(n) {
    return function (v) {
      if (v.gyro_mix !== "ON") return false;
      return n === 1 || (n === 2 && v.gyro_type !== GAIN_1) || (n >= 3 && v.gyro_type === GAIN_4);
    };
  }

  function gainItems(n) {
    return [
      sel("gyro_gain" + n + "_mode", "感度 " + n + " 模式", "Gyro mixing: Gain " + n + " (Normal/AVCS)", ["Normal", "AVCS"], {
        factory: "Normal",
        showIf: gainShown(n),
        fnote: n === 1 ? "Gyro type 選 1 gain 時畫面上只寫 Gain。數值不是 0 的時候點 Normal／AVCS 就會切換模式" : "4 gains 時 Gain 1、2 屬於 Group 1，Gain 3、4 屬於 Group 2",
        effect: [
          m("Normal", "只控制擺動的速度（rate）"),
          m("AVCS", "在 Normal 的速度控制之外同時控制角度，直線穩定性比 Normal 高；操作手感不同，選自己喜歡的")
        ]
      }),
      num("gyro_gain" + n, "感度 " + n, "Gyro mixing: Gain " + n, 0, 120, {
        factory: 50,
        showIf: gainShown(n),
        fnote: "Normal、AVCS 都是 0–120。感度可以指定給微調鍵或旋鈕調整（Trim/Dial select 選 Gyro gain）"
      })
    ];
  }

  function speedPair(key, label, enLabel, showIf) {
    return [
      num("th_spd_" + key + "_turn", "油門速度 " + label + "：加油（Turn）", "Throttle speed: " + enLabel + " Turn", 1, 100, {
        factory: 100, showIf: showIf,
        effect: [
          m("數值調低", "油門伺服機（電變）的動作被延遲，扳機拉得比需要的多，驅動輪也比較不會空轉"),
          m("100", "沒有延遲")
        ]
      }),
      num("th_spd_" + key + "_return", "油門速度 " + label + "：回油（Return）", "Throttle speed: " + enLabel + " Return", 1, 100, {
        factory: 100, showIf: showIf,
        fnote: "點這一欄時遙控器會先警告 Return speed will be slow",
        effect: [
          m("數值調低", "回油方向也被延遲，車子減速會變慢；說明書警告要小心設定"),
          m("100", "沒有延遲")
        ]
      })
    ];
  }

  var spd1 = is("th_spd_mode", "1"), spd23 = not("th_spd_mode", "1"), spd3 = is("th_spd_mode", "3");

  (window.RC_PRODUCTS = window.RC_PRODUCTS || []).push({
    id: "futaba-t10px",
    category: "遙控器",
    name: "Futaba T10PX",
    desc: "10 頻道槍型遙控器（F-4G 2.4GHz，套裝附 R404SBS／R404SBS-E 接收機）",
    spec: [
      "頻道數：F-4G 10 頻道、S-FHSS 7 頻道、T-FHSS SR／T-FHSS 4 頻道",
      "通訊系統：F-4G／T-FHSS SR／T-FHSS／MINI-Z T-FHSS／S-FHSS，2.4GHz，輸出 100 mW EIRP",
      "螢幕：4.3 吋彩色背光 TFT 觸控螢幕",
      "模型記憶：40 組；軟體與模型資料可用 microSD 卡更新、儲存",
      "套裝接收機 R404SBS／R404SBS-E：F-4G、S.BUS2，電源 3.7–7.4V（不能用乾電池）"
    ],
    manuals: [
      { title: "完整說明書 WEB FULL MANUAL（英文）", url: BASE + "downloads/shop/WCI00000280N24101013006vlbo.pdf?mode=view", note: "PDF，237 頁；1M23Z08002，封面標示 Compatible with ~Ver.11.1。這一頁的內容出自這一份" },
      { title: "完整說明書（日文，Ver.11.1 對應版）", url: BASE + "downloads/shop/WCI00000280N25070415107rlj2.pdf?mode=view", note: "PDF" },
      { title: "Futaba 官網產品頁", url: BASE + "products/detail/I00000280", note: "上面的連結失效時從這裡找" }
    ],
    notes: [
      "欄位、選項、可調範圍與初始值出自原廠英文完整說明書（1M23Z08002，對應 ~Ver.11.1）；軟體版本不同時，選項可能有出入。",
      "標「原廠」的是說明書寫明 Initial value 的值；標「預設」的是說明書沒寫初始值、取自說明書畫面截圖的值（各欄的說明有註明），請對照自己的遙控器。",
      "Condition 可以讓部分功能存最多 4 組不同的值（畫面上方有顯示 Condition 編號的功能才是）。這一頁只記錄 Condition 1 的值；Condition 功能本身的設定在「基本設定」。",
      "CH5–CH10 的逐頻道欄位預設收起來，在「輔助頻道」「失控保護」把顯示範圍切到 CH1-10 才會列出。",
      "說明書文字與畫面截圖不一致的地方（D/R 與 ATL 的初始值、Start 的 Trigger point、Response 的數值、A.B.S. 的 Delay 秒數）都寫在該欄位的說明裡。",
      "曲線圖是依說明書的示意圖畫的：說明書沒有給 EXP、VTR 的計算式，虛線只表示方向與大概的形狀，不是實測資料。",
      "第一版沒有建立的功能：引擎車專用的 Idle-Up、Engine Cut、Drag Racing；Steering／Brake／4WS／Dual ESC／CPS／Tank／Program／Tilt／Winch 混控（連同 Brake mixing 才有的 Brake2、Brake3 項目）；Mini-Z 專用設定；Telemetry、Timer 與 System menu（不屬於模型的設定）；S.BUS Servo、MC (ESC) Link、Gyro Link（參數存在裝置本身，Gyro Link 記在陀螺儀那一頁）。"
    ],
    factoryOf: factoryOf,
    cards: [
      { id: "basic", name: "基本設定", groups: ["model", "condition"], summary: [["類型", "model_type"], ["Condition", "cond_mode"]] },
      { id: "receiver", name: "接收機", groups: ["receiver"], summary: [["系統", "rx_system"], ["頻道數", "rx_channels"]] },
      { id: "steering", name: "轉向", groups: ["st_linkage", "st_curve", "st_speed"], summary: [["D/R", "dr"], ["左舵角", "ep_st_l"]] },
      { id: "throttle", name: "油門與煞車", groups: ["th_linkage", "th_accel"], summary: [["ATL", "atl"], ["中立煞車", "nb_rate"]] },
      { id: "th_curve", name: "油門曲線與速度", groups: ["th_curve", "brk_curve", "th_speed"], summary: [["油門", "th_curve_type"], ["煞車", "brk_curve_type"]] },
      { id: "gyro", name: "陀螺儀混控", groups: ["gyro"], summary: [["混控", "gyro_mix"], ["感度", "gyro_gain1"]] },
      { id: "assist", name: "行駛輔助", groups: ["trc", "abs", "start", "response"], summary: [["循跡", "trc_mode"], ["ABS", "abs_mode"]] },
      { id: "aux", name: "輔助頻道", groups: ["view", "ch_setting", "aux_linkage"], summary: [["CH3", "chset_ch3"], ["CH4", "chset_ch4"]] },
      { id: "failsafe", name: "失控保護", groups: ["view", "failsafe"], summary: [["轉向", "fs_ch1"], ["油門", "fs_ch2"]] },
      { id: "trimdial", name: "微調鍵與旋鈕", groups: ["trimdial"], summary: [["DL1", "dl1_func"], ["DT3", "dt3_func"]] },
      { id: "switches", name: "開關", groups: ["switches"], summary: [["SW1", "sw1_func"], ["SW2", "sw2_func"]] }
    ],
    // 說明書 p.86、p.90、p.113、p.127：Ratio 設成 100:0 時煞車側停止動作
    locks: [{ when: { id: "th_ratio", is: RATIO_100_0 }, items: BRAKE_ITEMS, text: NO_BRAKE }],
    groups: [
      {
        id: "model",
        name: "基本資料",
        src: "說明書 p.69 Model Type、p.66 Model Name、p.44 Information（版本資訊）",
        items: [
          sel("model_type", "模型類型", "Model type", ["Normal", "1/5 (Big)", "Drift"], {
            preset: DEFAULT_TYPE,
            rerender: true,   // 類型一換，陀螺儀混控與 DL1 的原廠值跟著換
            fnote: "更換 Model Type 會把目前的模型資料初始化，說明書建議在設定各功能之前先選好。這裡選 Drift 時，陀螺儀混控與 DL1 的原廠值會換成 Drift 的初始設定；1/5 (Big) 的初始設定牽涉第一版沒有建立的 Steering／Brake mixing，這一頁不會跟著切換。說明書沒有寫新模型是哪一種類型，頁面先預設 Normal（說明書的畫面截圖都是 Normal 的狀態），請改成實際使用的類型",
            effect: [
              m("Normal", "所有混控的初始設定都是 OFF"),
              m("1/5 (Big)", "Steering mixing ON（Ch3→Steering 2）、Brake mixing ON（Ch4→Brake 2、DL1→Brake 2 Rate）"),
              m("Drift", "Gyro mixing ON（Ch3→Gyro、DL1→Gyro Gain、Step 1）")
            ]
          }),
          text("model_name", "模型名稱", "Model name"),
          text("sw_version", "軟體版本", "Information (version)", { fnote: "System menu 的 Information 可以看版本。這一頁依據的說明書對應到 Ver.11.1" }),
          text("note", "備註", "Note")
        ]
      },
      {
        id: "condition",
        name: "Condition",
        src: "說明書 p.97–100 Condition",
        note: "切換 Condition 用的開關、微調鍵或旋鈕，在「開關」與「微調鍵與旋鈕」指定（開關選 Condition 1 ⇄ 2 或 Condition 1–4，微調鍵／旋鈕選 Condition）。這一頁各功能記錄的是 Condition 1 的值。",
        items: [
          sel("cond_mode", "Condition 功能", "Condition: Mode", OFF_ON, {
            preset: "OFF",
            fnote: "Reverse、End point 這類畫面上方沒有顯示 Condition 編號的功能，各組共用同一個值。Condition 2–4 的資料在關閉功能後仍會保留，直到執行 Data reset。" + SHOT,
            effect: [m("ON", "同一個模型的特定功能可以存最多 4 組資料，例如平常 Steering D/R 90%、第二組 80%")]
          }),
          sel("cond_count", "使用的組數", "Condition: Condition (number)", ["2", "3", "4"], {
            preset: "2",
            showIf: condOn,
            fnote: "最多 4 組。" + SHOT
          }),
          text("cond_name1", "Condition 1 名稱", "Condition name 1", { showIf: condOn, fnote: "最多 15 個字元" }),
          text("cond_name2", "Condition 2 名稱", "Condition name 2", { showIf: condOn }),
          text("cond_name3", "Condition 3 名稱", "Condition name 3", { showIf: all(condOn, condShown(3)) }),
          text("cond_name4", "Condition 4 名稱", "Condition name 4", { showIf: all(condOn, condShown(4)) })
        ]
      },
      {
        id: "receiver",
        name: "接收機",
        src: "說明書 p.70–73 Receiver、p.5 Receiver Mode Precautions、p.9 Specifications、p.166 Telemetry System",
        note: "更換系統或 Response 之後要重新對頻（Link），並把接收機重新開機，設定才會生效。",
        items: [
          sel("rx_system", "通訊系統", "Receiver: System", [F4G, TFHSS_SR, TFHSS, SFHSS, MINIZ], {
            preset: F4G,
            fnote: "套裝附的 R404SBS／R404SBS-E 用 F-4G。Mini-Z 另分 MINI-Z EVO、EVO2、FHSS，專用設定這裡沒有建立。" + SHOT,
            effect: [
              m(F4G, "有遙測，反應比 T-FHSS SR 更快；最多 10 頻道"),
              m(TFHSS_SR, "4 頻道，沒有遙測功能"),
              m(TFHSS, "4 頻道，有遙測"),
              m(SFHSS, "7 頻道，沒有遙測功能")
            ]
          }),
          {
            id: "rx_channels", name: "可用頻道數", en: "Number of channels", type: "num",
            calc: function (v) {
              return { "F-4G": "10", "S-FHSS": "7", "T-FHSS SR": "4", "T-FHSS": "4" }[v.rx_system] || "說明書未標示";
            },
            fnote: "依通訊系統而定（說明書 p.9）；各功能畫面列出的頻道數會跟著變"
          },
          text("rx_model", "接收機型號", "Receiver", {
            fnote: "說明書 p.5 列的接收機：F-4G 是 R404SBS、R404SBS-E；T-FHSS SR 是 R334SBS、R334SBS-E；T-FHSS 是 R324SBS、R314SB、R314SB-E、R304SB、R304SB-E；S-FHSS 是 R202GF、R203GF、R204GF-E、R214GF-E、R2104GF。R404SBS-E 是電動車用"
          }),
          sel("rx_telemetry", "遙測", "Receiver: Telemetry", OFF_ON, {
            preset: "ON",
            showIf: system([F4G, TFHSS]),
            fnote: "T-FHSS SR 與 S-FHSS 沒有遙測功能。" + SHOT
          })
        ].concat(range(1, 4).map(rxResponse)).concat(range(1, 4).map(rxSr)).concat([
          sel("rx_resp_other", "反應模式", "Receiver: Response (T-FHSS / S-FHSS)", ["Digital servo", "Analog servo"], {
            showIf: system([TFHSS, SFHSS]),
            fnote: "說明書 p.5 的對照表在 T-FHSS、S-FHSS 這一格列了 Digital servo 與 Analog servo 兩種 Response（表格的排法像是 T-FHSS 的接收機對 Digital servo、S-FHSS 的接收機對 Analog servo），但 p.70–78 沒有這兩個系統的設定畫面；能不能選、是不是逐頻道設定、初始值是哪一個，說明書未標示，這一欄只供記錄",
            effect: [
              m("Digital servo", "Futaba 數位伺服機"),
              m("Analog servo", "Futaba 數位或類比伺服機")
            ]
          })
        ])
      },
      {
        id: "st_linkage",
        name: "轉向行程",
        src: "說明書 p.82 Channel Reverse、p.83 Sub Trim、p.84–85 End Point、p.103 D/R, ATL、p.105 Channel Limiter",
        items: [
          reverse(1, "轉向反向"),
          subtrim(1, "轉向 Sub trim"),
          num("ep_st_l", "轉向 End point 左", "End point: Steering Left", 0, 140, {
            factory: 100,
            fnote: "調之前先把 Steering D/R 調到 100。車子放好、接收機開機，方向盤打到底，看輪子到極限的位置決定數值；伺服機發出嗡嗡聲表示設定不當",
            effect: [m("用途", "決定左右的最大舵角；左右轉彎半徑不一樣時用來修正")]
          }),
          num("ep_st_r", "轉向 End point 右", "End point: Steering Right", 0, 140, { factory: 100 }),
          sel("epa_trim", "用微調鍵調舵角 EPA Trim", "End point: EPA Trim", OFF_ON, {
            preset: "OFF",
            fnote: SHOT,
            effect: [m("ON", "方向盤打到底時撥轉向微調（初始是 DT1），調的是那一側的 End point（Quick EPA）")]
          }),
          num("dr", "轉向雙比率 D/R", "D/R, ATL: Dual rate", 0, 100, {
            preset: 100,
            fnote: "說明書 p.103 的文字寫 Initial value: 0，但同一頁的設定畫面與主畫面截圖（p.91、p.96）都顯示 100，p.85 也寫調 End point 前先把 D/R 調到最大的 100；這裡依畫面用 100 當預設，沒有標成原廠值",
            effect: [m("作用", "左右兩側的舵角同時調整；與握把上的 DT5 連動，DT5 改派其他功能時才需要在這個畫面調")]
          }),
          num("lim_st_l", "轉向 Limiter 左", "Channel limiter: Steering Left", 0, 145, {
            factory: 145,
            effect: [m("用途", "限制伺服機的最大動作量；混控疊加讓動作量意外變大時，用來保護連桿")]
          }),
          num("lim_st_r", "轉向 Limiter 右", "Channel limiter: Steering Right", 0, 145, { factory: 145 })
        ]
      },
      {
        id: "st_curve",
        name: "轉向曲線",
        src: "說明書 p.107–109 Curve (EXP)：Steering curve",
        charts: [{
          name: "轉向曲線", after: "st_curve_rate", uses: ["st_curve_type", "st_curve_rate", "st_vtr_point"],
          build: curveChart("st", "轉向曲線", "方向盤操作量 %", "Fine tune 沒有畫進圖裡。")
        }],
        items: curveItems("st", "轉向", "Steering curve", {
          typeNote: "改變轉向伺服機在中立附近的靈敏度，不影響最大舵角。",
          rateFactory: 0,
          rateNote: "數值不是 0 的時候點畫面上的 Quick／Mild 會把正負反過來",
          rateEffect: [
            m("+ 側（Quick）", "轉向的動作變靈敏"),
            m("- 側（Mild）", "轉向的動作變溫和")
          ],
          extra: [
            ext({ id: "st_fine_l", name: "轉向曲線 Fine tune 左", en: "Steering curve: Fine tune Left", type: "num", step: 1 }, {
              preset: 0, signed: true,
              showIf: not("st_curve_type", "Curve"),
              fnote: "左右兩側的曲線比率分開調整時用。範圍與初始值說明書沒有另外寫，預設取自畫面截圖"
            }),
            ext({ id: "st_fine_r", name: "轉向曲線 Fine tune 右", en: "Steering curve: Fine tune Right", type: "num", step: 1 }, {
              preset: 0, signed: true,
              showIf: not("st_curve_type", "Curve"),
              fnote: "範圍與初始值說明書沒有另外寫，預設取自畫面截圖"
            }),
            sel("st_curve_sep", "轉向 Curve 左右設定", "Steering curve: Combination / Separate", ["Combination", "Separate"], {
              preset: "Combination",
              showIf: is("st_curve_type", "Curve"),
              fnote: SHOT,
              effect: [m("Separate", "左右兩側的曲線可以分開設定")]
            })
          ]
        })
      },
      {
        id: "st_speed",
        name: "轉向速度",
        src: "說明書 p.114–115 Speed：Steering speed",
        items: [
          num("st_spd_turn", "轉向速度：打舵（Turn）", "Steering speed: Turn", 1, 100, {
            factory: 100,
            effect: [
              m("數值調低", "轉向伺服機的動作被延遲（限制伺服機的最高速度）"),
              m("100", "沒有延遲"),
              m("用途", "打舵太快造成瞬間轉向不足、掉速或打轉時使用；方向盤轉得比設定的速度慢時不受影響")
            ]
          }),
          num("st_spd_return", "轉向速度：回正（Return）", "Steering speed: Return", 1, 100, {
            factory: 100,
            effect: [m("數值調低", "回正方向的伺服機動作被延遲；打舵與回正可以分開設定"), m("100", "沒有延遲")]
          })
        ]
      },
      {
        id: "th_linkage",
        name: "油門與煞車行程",
        src: "說明書 p.80–81 Throttle Mode (Trigger)、p.82 Channel Reverse、p.83 Sub Trim、p.86 End Point、p.103–104 D/R, ATL、p.105 Channel Limiter",
        items: [
          sel("th_ratio", "扳機前進／煞車比例", "Throttle mode (Trigger): Ratio",
            ["Forward 50 : Brake 50", "Forward 60 : Brake 40", "Forward 70 : Brake 30", RATIO_100_0], {
              preset: "Forward 50 : Brake 50",
              fnote: SHOT,
              effect: [
                m("作用", "改變油門伺服機的中立位置，選擇前進側與煞車（倒車）側的動作比例"),
                m(RATIO_100_0, "煞車側停止動作：End point、Acceleration 的煞車側不能調，煞車曲線與 A.B.S. 也不會動作")
              ]
            }),
          num("nb_rate", "中立煞車", "Throttle mode (Trigger): Neutral brake Rate", 0, 100, {
            factory: 0,
            fnote: "要先在「開關」把某個開關指定成 Neutral brake 才能使用。開啟時油門微調會自動變成調整中立煞車量；油門側的 End point 與 ATL 也會影響中立煞車",
            effect: [
              m("作用", "扳機在中立位置時就施加煞車"),
              m("搭配電變", "可以和電變本身的中立煞車同時使用，但說明書建議只用其中一個，設定比較好理解")
            ]
          }),
          reverse(2, "油門反向"),
          subtrim(2, "油門 Sub trim"),
          num("ep_th_fwd", "油門 End point 前進", "End point: Throttle Forward", 0, 140, {
            factory: 100,
            fnote: "調之前先把 ATL 調到 100",
            effect: [m("使用電變時", "設 100")]
          }),
          num("ep_th_brk", "油門 End point 煞車", "End point: Throttle Brake", 0, 140, {
            factory: 100,
            fnote: "煞車（倒車）側。ATL 可以在行駛中調整煞車側的動作量，用 End point 調動作角度時要一併考慮",
            effect: [m("使用電變時", "設 100")]
          }),
          num("atl", "煞車量 ATL", "D/R, ATL: Brake1 rate(ATL)", 0, 100, {
            preset: 100,
            fnote: "說明書 p.104 的文字寫 Initial value: 0，但同一頁的設定畫面與主畫面截圖（p.91、p.96）都顯示 100，p.86 也寫調 End point 前先把 ATL 調到最大的 100；這裡依畫面用 100 當預設，沒有標成原廠值。與握把上的 DT6 連動，DT6 改派其他功能時才需要在這個畫面調",
            effect: [
              m("數值調低", "煞車效果太強時用"),
              m("數值調高", "煞車力不夠時用")
            ]
          }),
          sel("th_rate_mode", "油門上限 Throttle rate", "D/R, ATL: Throttle rate (ON/OFF)", OFF_ON, {
            preset: "OFF",
            fnote: "可以在「開關」指定 Throttle rate 開關來切換，也能指定給微調鍵或旋鈕調整。" + SHOT,
            effect: [m("ON", "扳機拉到底時，油門只動作到設定的比率，不會到全油門")]
          }),
          num("th_rate", "油門上限比率", "D/R, ATL: Throttle rate", 0, 100, {
            factory: 100,
            showIf: is("th_rate_mode", "ON")
          }),
          num("lim_th_fwd", "油門 Limiter 前進", "Channel limiter: Throttle Forward", 0, 145, {
            factory: 145,
            effect: [m("用途", "限制伺服機的最大動作量；混控疊加讓動作量意外變大時，用來保護連桿")]
          }),
          num("lim_th_brk", "油門 Limiter 煞車", "Channel limiter: Throttle Brake", 0, 145, { factory: 145 })
        ]
      },
      {
        id: "th_accel",
        name: "起步加速 Acceleration",
        src: "說明書 p.89–90 Acceleration",
        note: "Brake2、Brake3 要開啟 Brake mixing 才會出現，這裡沒有建立。",
        charts: [
          { name: "前進", after: "acc_fwd", uses: ["acc_fwd"], build: accelChart("acc_fwd", "Acceleration：前進側", 50) },
          { name: "煞車", after: "acc_brk1", uses: ["acc_brk1"], build: accelChart("acc_brk1", "Acceleration：煞車側", 100) }
        ],
        items: [
          num("acc_fwd", "起步加速：前進", "Acceleration: Forward", 0, 100, {
            factory: 0,
            fnote: "這裡的 100% 基準會影響油門 End point 設定的動作量",
            effect: [
              m("作用", "扳機一離開中立，伺服機（電變）就直接跳到設定的量，之後維持直線；中立附近的反應變得銳利"),
              m("0", "沒有加速補償"),
              m("100", "最大，約為前進側油門行程的 1/2")
            ]
          }),
          num("acc_brk1", "起步加速：煞車", "Acceleration: Brake1", 0, 100, {
            factory: 0,
            effect: [
              m("0", "沒有加速補償"),
              m("100", "最大，為煞車側的最大行程")
            ]
          })
        ]
      },
      {
        id: "th_curve",
        name: "油門曲線（前進側）",
        src: "說明書 p.110–112 Curve (EXP)：Throttle curve (Forward side)",
        charts: [{
          name: "油門", after: "th_curve_rate", uses: ["th_curve_type", "th_curve_rate", "th_vtr_point"],
          build: curveChart("th", "油門曲線（前進側）", "扳機操作量 %")
        }],
        items: curveItems("th", "油門", "Throttle curve", {
          typeNote: "讓油門前進側的伺服機（電變）動作變快或變溫和，不影響最大動作量。",
          rateFactory: 0,
          rateNote: "數值不是 0 的時候點畫面上的 Quick／Mild 會把正負反過來",
          rateEffect: [
            m("+ 側（Quick）", "油門的動作變快；場地狀況好、路面抓地力高時用"),
            m("- 側（Mild）", "油門的動作變溫和；路面滑、驅動輪抓不住時用")
          ]
        })
      },
      {
        id: "brk_curve",
        name: "煞車曲線",
        src: "說明書 p.113 Curve (EXP)：Brake curve（設定方法與範圍同 p.110–112 的油門曲線）",
        charts: [{
          name: "煞車", after: "brk_curve_rate", uses: ["brk_curve_type", "brk_curve_rate", "brk_vtr_point"],
          build: curveChart("brk", "煞車曲線", "扳機操作量（煞車側）%")
        }],
        items: curveItems("brk", "煞車", "Brake curve", {
          typeNote: "讓煞車側的伺服機（電變）動作變快或變溫和，不影響最大動作量。",
          rateFactory: 0,
          rateNote: "說明書寫設定方法與油門前進側的曲線相同，範圍與初始值依油門曲線",
          pointNote: "說明書寫設定方法與油門前進側的曲線相同，範圍與初始值依油門曲線",
          rateEffect: [
            m("+ 側（Quick）", "煞車側的動作變快"),
            m("- 側（Mild）", "煞車側的動作變溫和")
          ]
        })
      },
      {
        id: "th_speed",
        name: "油門速度",
        src: "說明書 p.116–121 Speed：Throttle speed",
        items: [
          sel("th_spd_mode", "油門速度段數", "Throttle speed: Mode", ["1", "2", "3"], {
            preset: "1",
            fnote: SHOT,
            effect: [
              m("1", "整個油門範圍用同一個延遲（All）"),
              m("2", "以 Point 1 為界，分成 Low、High 兩段"),
              m("3", "以 Point 1、Point 2 為界，分成 Low、Middle、High 三段")
            ]
          }),
          sel("th_spd_type", "油門速度類型", "Throttle speed: Speed Type", ["Normal", "Alternate"], {
            preset: "Normal",
            fnote: "V5.0 以後才有。" + SHOT,
            effect: [
              m("Normal", "傳統的速度與曲線動作，油門曲線不受速度功能影響"),
              m("Alternate", "速度會沿著油門曲線作用；適合馬力大、容易失去抓地力的車")
            ]
          })
        ]
          .concat(speedPair("all", "All", "All", spd1))
          .concat(speedPair("high", "High", "High", spd23))
          .concat(speedPair("mid", "Middle", "Middle", spd3))
          .concat(speedPair("low", "Low", "Low", spd23))
          .concat([
            num("th_spd_point1", "油門速度 Point 1", "Throttle speed: Point 1", 1, 100, {
              factory: 30, showIf: spd23,
              fnote: "Low 與 High（3 段時是 Low 與 Middle）的分界點"
            }),
            num("th_spd_point2", "油門速度 Point 2", "Throttle speed: Point 2", 1, 100, {
              factory: 60, showIf: spd3,
              fnote: "Middle 與 High 的分界點"
            })
          ])
      },
      {
        id: "trc",
        name: "循跡控制 Traction Control",
        src: "說明書 p.122–125 Traction Control",
        items: [
          sel("trc_mode", "循跡控制", "Traction control: Mixing", OFF_ON, {
            preset: "OFF",
            fnote: "可以在「開關」指定 Traction control 開關來切換。" + SHOT,
            effect: [
              m("ON", "加油時讓油門伺服機（電變）往前進方向斷斷續續地動作，在滑的路面過彎比較容易抓住路面"),
              m("甩尾車", "讓馬達往高速側斷續運轉，可以模擬引擎催油門的聲音")
            ]
          }),
          num("trc_return", "油門回收量", "Traction control: Throttle return", 0, 100, {
            factory: 50, showIf: trcOn,
            fnote: "實際的回收量會隨油門曲線等設定而變",
            effect: [
              m("0", "循跡控制不作用"),
              m("50", "回到扳機操作量的 50%"),
              m("100", "回到中立位置")
            ]
          }),
          num("trc_delay", "延遲", "Traction control: Delay", 0, 100, {
            factory: 0, showIf: trcOn,
            effect: [
              m("0", "沒有延遲，立刻作用"),
              m("50", "約 0.5 秒後開始作用"),
              m("100", "約 1.0 秒後開始作用")
            ]
          }),
          num("trc_cycle", "脈動速度", "Traction control: Cycle speed", 1, 100, {
            factory: 30, showIf: trcOn,
            effect: [m("數值調低", "脈動的速度變快")]
          }),
          num("trc_duty", "作動比", "Traction control: Duty ratio", -4, 4, {
            factory: 0, signed: true, showIf: trcOn,
            fnote: "往高速側動作的時間（X）與回收的時間（Y）的比例，+4 到 -4 共 9 段。說明書這一段的 -4、+4 說明沿用 A.B.S. 的文字（煞車作用時間最短、最長），沒有另外寫油門側是哪一邊變長"
          }),
          num("trc_point", "作用起點", "Traction control: Trigger point", 5, 95, {
            factory: 30, showIf: trcOn,
            fnote: "循跡控制開始作用的扳機位置"
          }),
          sel("trc_point_dir", "作用範圍", "Traction control: Trigger point (Normal/Reverse)", ["Normal", "Reverse"], {
            preset: "Reverse", showIf: trcOn,
            fnote: SHOT + "（p.122–125 的畫面都顯示 Reverse）",
            effect: [
              m("Normal", "從作用起點到高速側是作用範圍"),
              m("Reverse", "從中立到作用起點是作用範圍")
            ]
          })
        ]
      },
      {
        id: "abs",
        name: "A.B.S.",
        src: "說明書 p.126–130 A.B.S.",
        note: "這裡是 Brake1（油門頻道）的設定；Brake2、Brake3 要開啟 Brake mixing 才會出現，沒有建立。",
        items: [
          sel("abs_mode", "A.B.S.", "A.B.S.: Brake1", OFF_ON, {
            preset: "OFF",
            fnote: "可以在「開關」指定 A.B.S. (Brake 1) 開關來切換。" + SHOT,
            effect: [m("ON", "煞車時讓油門伺服機（電變）斷斷續續地動作，效果像實車的點放煞車；可以消除煞車入彎時的轉向不足")]
          }),
          num("abs_return", "煞車回收量", "A.B.S.: Brake return", 0, 100, {
            factory: 50, showIf: absOn,
            fnote: "實際的回收量會隨煞車曲線等設定而變",
            effect: [
              m("0", "A.B.S. 不作用"),
              m("50", "回到煞車操作量的 50%"),
              m("100", "回到中立位置"),
              m("設定範例", "約 30；設太高煞車距離會變長"),
              m("全煞車時輪胎鎖死或打轉", "從 30 往上加"),
              m("煞車效果差、煞車距離長", "從 30 往下減")
            ]
          }),
          num("abs_delay", "延遲", "A.B.S.: Delay", 0, 100, {
            factory: 0, showIf: absOn,
            fnote: "說明書兩處寫的秒數不同：p.127 寫 50 約 0.7 秒、100 約 1.4 秒；p.128 寫 50 約 0.5 秒、100 約 1.0 秒",
            effect: [
              m("0", "沒有延遲，立刻作用"),
              m("設定範例", "10–15"),
              m("全煞車時輪胎鎖死或打轉", "把延遲縮短"),
              m("煞車效果差、煞車距離長", "把延遲加長")
            ]
          }),
          num("abs_cycle", "脈動速度", "A.B.S.: Cycle speed", 1, 100, {
            factory: 30, showIf: absOn,
            effect: [
              m("數值調低", "脈動的速度變快"),
              m("設定範例", "5–7")
            ]
          }),
          num("abs_duty", "作動比", "A.B.S.: Duty ratio", -4, 4, {
            factory: 0, signed: true, showIf: absOn,
            fnote: "煞車作用的時間與放開的時間的比例，+4 到 -4 共 9 段",
            effect: [
              m("-4", "煞車作用的時間最短，不容易鎖死"),
              m("+4", "煞車作用的時間最長，容易鎖死"),
              m("設定範例", "0；抓地力低往 - 側、抓地力高往 + 側"),
              m("全煞車時輪胎鎖死或打轉", "從 0 往 - 側"),
              m("煞車效果差、煞車距離長", "從 0 往 + 側")
            ]
          }),
          num("abs_point", "作用起點", "A.B.S.: Trigger point", 5, 95, {
            factory: 30, showIf: absOn,
            fnote: "A.B.S. 開始作用的扳機位置，以全煞車為 100 的百分比。Brake1–3 共用這一個值",
            effect: [m("設定範例", "約 70")]
          }),
          sel("abs_point_dir", "作用範圍", "A.B.S.: Trigger point (Normal/Reverse)", ["Normal", "Reverse"], {
            preset: "Normal", showIf: absOn,
            fnote: SHOT + "（p.126–129 的畫面都顯示 Normal）。兩個選項的說明照 p.129 的原文",
            effect: [
              m("Normal", "從中立到作用起點是作用範圍"),
              m("Reverse", "從作用起點到全煞車是作用範圍")
            ]
          })
        ]
      },
      {
        id: "start",
        name: "起步 Start",
        src: "說明書 p.131–132 Start",
        items: [
          sel("start_mode", "起步功能", "Start: Mode", OFF_ON, {
            preset: "OFF",
            fnote: "畫面上的 Status（Ready／Active）是當下的狀態，不是設定值；可以在「開關」指定 Start 開關進入待命。" + SHOT,
            effect: [
              m("ON", "扳機到達作用起點時，油門伺服機（電變）直接移到預設的位置；慢慢拉扳機，車子就能不空轉地加速到設定的速度"),
              m("注意", "只對起步的第一次扳機操作有效，每次起步前都要重新進入待命；扳機稍微回收就自動解除")
            ]
          }),
          num("start_point", "作用起點", "Start: Trigger point", 5, 95, {
            factory: 30, showIf: startOn,
            fnote: "說明書 p.132 的文字寫 Initial value: 30，但 p.131–132 的畫面截圖顯示 5；這裡依文字"
          }),
          num("start_preset", "預設油門位置", "Start: Preset", 0, 100, {
            factory: 0, showIf: startOn,
            fnote: "扳機到達作用起點時，油門伺服機（電變）要移到的位置"
          })
        ]
      },
      {
        id: "response",
        name: "反應調整 Response",
        src: "說明書 p.135 Response",
        items: [
          sel("resp_mode", "反應調整", "Response: Response adjuster", OFF_ON, {
            preset: "OFF",
            fnote: SHOT,
            effect: [
              m("OFF", "反應最快（畫面顯示 Fastest）"),
              m("ON", "把反應調得比較溫和；伺服機反應太敏感時使用")
            ]
          }),
          num("resp_st", "轉向反應", "Response: Steering", 1, 6, {
            factory: 1, showIf: respOn,
            fnote: "說明書的文字寫範圍 1–6、初始值 1（Mild），但同一頁第一張畫面截圖顯示 0；這裡依文字",
            effect: [m("1", "Mild，最溫和"), m("6", "Quick，最快")]
          }),
          num("resp_th", "油門反應", "Response: Throttle", 1, 6, {
            factory: 1, showIf: respOn,
            fnote: "說明書的文字寫範圍 1–6、初始值 1（Mild），但同一頁第一張畫面截圖顯示 0；這裡依文字",
            effect: [m("1", "Mild，最溫和"), m("6", "Quick，最快")]
          })
        ]
      },
      {
        id: "gyro",
        name: "陀螺儀混控 Gyro Mixing",
        src: "說明書 p.144–146 Gyro Mixing、p.223–224 Gyro Data Switching Function、p.69 Model Type",
        note: "這裡只記遙控器端的混控；陀螺儀本身的參數（Gyro Link）記在陀螺儀那一頁。用支援 SR mode 的陀螺儀接在 SR mode 的頻道時，轉向與感度兩個頻道都要設成 SR mode，只設一個陀螺儀不會正常動作。",
        items: [
          sel("gyro_mix", "陀螺儀混控", "Gyro mixing: Mixing", OFF_ON, {
            factory: "OFF",
            fnote: "說明書 p.69：Normal 類型所有混控的初始設定是 OFF，Drift 類型是 ON。要在 Normal 與 AVCS 之間切換時，在「開關」指定開關",
            effect: [m("ON", "從遙控器調整 Futaba 車用陀螺儀的感度（remote gain），會佔用一個輔助頻道")]
          }),
          sel("gyro_ch", "感度使用的頻道", "Gyro mixing: Channel", numbered("Ch.", 3, 10), {
            showIf: gyroOn,
            fnote: "開啟混控時從頻道清單選陀螺儀感度線接的輔助頻道。已經被其他混控佔用的頻道不能選，全部被佔用時會顯示 No assignable channel。Normal 類型沒有初始值，Drift 類型是 Ch3（說明書 p.69）；可選的頻道數依通訊系統而定"
          }),
          sel("gyro_type", "感度組數", "Gyro mixing: Gyro type", [GAIN_1, GAIN_2, GAIN_4], {
            preset: GAIN_1,
            showIf: gyroOn,
            fnote: "1 gain、4 gains 的寫法取自說明書的畫面截圖；2 gains 是依此類推（說明書內文寫成 2 gain）。" + SHOT,
            effect: [
              m(GAIN_1, "只有一組感度"),
              m(GAIN_2, "用開關在 Gain 1 與 Gain 2 之間切換"),
              m(GAIN_4, "4 組感度：分成兩個 Group，每個 Group 兩組，要用兩個開關分別切換 Group 與 Group 裡的感度")
            ]
          })
        ]
          .concat(flat(range(1, 4).map(gainItems)))
          .concat(range(1, 4).map(function (n) {
            return sel("gyro_data_c" + n, "Condition " + n + " 用的陀螺儀資料", "Gyro mixing 2/2: Condition " + n, numbered("Gyro data ", 1, 5), {
              preset: "Gyro data 1",
              showIf: all(gyroOn, condShown(n)),
              fnote: (n === 1 ? "陀螺儀接在接收機的 S.BUS2、而且開啟陀螺儀混控時，可以依 Condition 切換陀螺儀裡的資料（依 Condition 最多 4 組）；也可以改用開關（Gyro data 1–5）或微調鍵、旋鈕（Gyro data）切換，最多 5 組。" : "") + SHOT
            });
          }))
      },
      {
        id: "view",
        name: "顯示範圍",
        src: "頁面的顯示開關（不是遙控器上的設定）",
        items: [
          sel("aux_shown", "列出的頻道", "Display range (page option)", [SHOW_4, SHOW_ALL], {
            preset: SHOW_4,
            rerender: true,
            fnote: "這是頁面的顯示開關，不是遙控器上的設定：選 CH1-10 才會列出 CH5–CH10 的逐頻道欄位。實際可用的頻道數依通訊系統而定（F-4G 10 頻道、S-FHSS 7 頻道、T-FHSS SR／T-FHSS 4 頻道）"
          })
        ]
      },
      {
        id: "ch_setting",
        name: "頻道指定 Channel Setting",
        src: "說明書 p.106 Channel Setting",
        items: flat(range(1, 10).map(chSetting))
      },
      {
        id: "aux_linkage",
        name: "輔助頻道行程",
        src: "說明書 p.82 Channel Reverse、p.83 Sub Trim、p.86 End Point、p.105 Channel Limiter",
        note: "CH1（轉向）與 CH2（油門）的這四項在「轉向」「油門與煞車」。",
        items: flat(range(3, 10).map(auxItems))
      },
      {
        id: "failsafe",
        name: "失控保護 Fail-safe",
        src: "說明書 p.87–88 Fail-safe/Battery Fail-safe",
        note: "失控保護的資料在發射機開機 10 秒後才會傳給接收機。接收機的電源取自電變的電動車，說明書建議把電池失控保護設成 OFF，因為電壓瞬間下降可能誤觸發。S-FHSS 的電池失控保護電壓固定 3.8V，不能調。",
        items: flat(range(1, 10).map(failsafe)).concat([
          {
            id: "bfs_volt_f4g", name: "電池失控保護電壓", en: "Battery Fail-safe Voltage (F-4G)", type: "num", unit: "V",
            min: 3.5, max: 8.6, step: 0.1,
            preset: 3.8,
            showIf: system([F4G]),
            fnote: "F-4G 可設 3.5–8.6V，在對頻時寫入接收機，改了要重新對頻。說明書沒有寫每格多少，這裡的加減按鈕以 0.1V 計。說明書的範例：Ni-MH／Ni-Cd 4 cell 3.8V、6 cell 4.4V；LiFe 2 cell 4.75／4.8V；Li-Po 2 cell 5.5／5.6V。" + SHOT
          },
          sel("bfs_volt_tfhss", "電池失控保護電壓", "Battery Fail-safe Voltage (T-FHSS / T-FHSS SR)", BFS_VOLTS, {
            unit: "V", scale: BFS_VOLTS,
            showIf: system([TFHSS, TFHSS_SR]),
            fnote: "T-FHSS、T-FHSS SR 只能選這 15 個電壓。初始值說明書未標示"
          })
        ])
      },
      {
        id: "trimdial",
        name: "微調鍵與旋鈕 Trim/Dial Select",
        src: "說明書 p.91–93 Trim/Dial Select、p.13 Digital Trim Operation（初始設定）、p.69 Model Type",
        note: "DT1–DT4 在方向盤周圍，DT5、DT6 在握把上，DL1 是方向盤旁的旋鈕（按下去是 SW5）。功能清單裡「Channel 3–10 control」「Sub trim Ch.1–10」「Prog. mixing 1–5 A／B」在說明書的表上各寫成一列，這裡展開成單項，字樣可能和遙控器畫面略有出入。",
        items: flat([
          trim("dt1", "DT1", "Steering trim"),
          trim("dt2", "DT2", "Throttle trim"),
          trim("dt3", "DT3", "Channel 3 control"),
          trim("dt4", "DT4", "Channel 4 control"),
          trim("dt5", "DT5", "Dual rate"),
          trim("dt6", "DT6", "Brake1 rate(ATL)"),
          trim("dl1", "DL1", null)
        ])
      },
      {
        id: "switches",
        name: "開關 Switch Select",
        src: "說明書 p.94–96 Switch Select、p.103 D/R, ATL（Throttle rate）、p.223 Gyro Data Switching Function（Gyro data 1–5）",
        note: "SW5 就是按下旋鈕 DL1；SS、TS 是把方向盤、扳機當開關用。功能選 Off 時方向與型式收起來。說明書 p.96 的功能表把頻道寫成 Channel 3 to 7 control、Condition 寫成 (1-5)，但 p.94 的畫面列到 Channel 8 以後、內文寫 Condition 1–4；這裡列 Channel 3–10 與 Condition 1–4，請以遙控器畫面為準。",
        items: flat(
          range(1, 7).map(function (n) { return switchItems("sw" + n, "SW" + n, {}); })
            .concat([
              switchItems("pd1", "PD1", { note: "方向盤旁的撥片開關" }),
              switchItems("pd2", "PD2", { note: "方向盤旁的撥片開關" }),
              switchItems("ss", "SS", { note: "Steering Switch：把方向盤當開關用", point: [0, 100], pointEn: "Steering Switch (SS) point", grip: "方向盤" }),
              switchItems("ts", "TS", { note: "Trigger Switch：把油門扳機當開關用", point: [-100, 100], pointEn: "Trigger Switch (TS) point", grip: "扳機" }),
              switchItems("ssw1", "SSW1", {
                note: "握把上的三段開關（Slide Switch）",
                noType: true,
                dirNote: "畫面上 SSW1 只有一個 Nor. 按鈕，說明書沒有說明它是方向還是型式，這裡當作方向記錄"
              })
            ])
        )
      }
    ]
  });
})();
