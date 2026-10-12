/*
 * 電變：Hobbywing XERUN XR10 Pro G2（30112608 黑／30112607 橘）
 *
 * 欄位、選項、可調範圍與原廠值來源（都在 manuals 清單裡）：
 *   - 說明書 HW-SM516ENG（印刷版次 20190530）：Programmable Items 參數表、各項說明、
 *     Default Settings of Different Preset Modes（十組模式的出廠值）
 *   - 原廠 Team Setup Sheet：基本資料與行駛資料記錄的欄位
 *
 * 這顆電變有 10 組 Preset Mode，出廠值每組不同，所以原廠值不是寫死在欄位上，
 * 而是由 factoryOf() 依「使用的模式」欄位回傳。
 *
 * effect 每一筆的來源：
 *   m(...) 說明書原文有寫的特性
 * 圖表（charts）是依說明書描述的規則畫的示意，不是實測資料。
 * min／max／step 骨架也會讀（加減按鈕）；scale、glyphs、charts、locks 只有 js/visual.js 會讀，格式見該檔開頭。
 */
(function () {
  "use strict";

  function m(when, then) { return { w: when, t: then, manual: true }; }

  var BASE = "https://www.hobbywing.com/en/";

  var FB = "Forward with Brake", FRB = "Forward/Reverse with Brake", FR = "Forward and Reverse";
  var T105 = "105℃/221℉", T125 = "125℃/257℉";
  var FULL = "Full Sensored", HYBRID = "Sensored/Sensorless Hybrid";
  var AUTO_CUT = "Auto (3.3V/Cell)";
  var CUSTOM = "自訂";
  // 說明書寫「=Drag brake」；開頭的 = 會被試算表當成公式，選項文字改成中文開頭
  var SAME_AS_DRAG = "等於拖曳煞車（=Drag Brake）";

  var PWM_STEPS = ["1K", "2K", "4K", "8K", "12K", "16K", "24K", "32K"];
  var BRAKE_FREQ_STEPS = ["0.5K", "1K", "2K", "4K", "8K", "16K"];
  var SOFT_RANGES = ["0%", "10%", "20%", "25%", "30%", "35%", "40%", "45%", "50%", "55%", "60%", "65%", "70%", "75%"];
  var TURBO_DELAYS = ["Instant", "0.05s", "0.1s", "0.15s", "0.2s", "0.25s", "0.3s", "0.35s", "0.4s", "0.45s",
    "0.5s", "0.6s", "0.7s", "0.8s", "0.9s", "1.0s"];
  var TURBO_RATES = ["3deg/0.1s", "6deg/0.1s", "9deg/0.1s", "12deg/0.1s", "15deg/0.1s", "18deg/0.1s",
    "21deg/0.1s", "24deg/0.1s", "27deg/0.1s", "30deg/0.1s", "Instant"];

  /* ---------- 十組模式的出廠值（說明書 Default Settings of Different Preset Modes） ---------- */

  var MODES = [
    "1 Zero Timing", "2 TC-Modify", "3 Buggy-2WD-Modify", "4 Buggy-4WD-Modify", "5 Practice",
    "6 Stock-13.5T", "7 Stock-17.5T", "8 SCT-4 Pole", "9 Crawler", "10 Drift 2WD Carpet"
  ];

  function all(v) { return MODES.map(function () { return v; }); }
  function rate(d) { return d === "Instant" ? d : d + "deg/0.1s"; }

  // 每一列依模式 1 到 10 的順序
  var DEFAULTS = {
    run_mode: [FB, FB, FB, FB, FRB, FB, FB, FB, FR, FRB],
    reverse_force: ["25%", "25%", "25%", "25%", "25%", "25%", "25%", "25%", "100%", "25%"],
    cutoff_mode: all(AUTO_CUT),
    esc_temp: all(T105),
    motor_temp: all(T105),
    bec_volt: all("6.0"),
    remote_off: ["Enabled", "Enabled", "Enabled", "Enabled", "Enabled", "Enabled", "Enabled", "Enabled", "Disabled", "Enabled"],
    sensor_mode: [FULL, FULL, FULL, FULL, FULL, FULL, FULL, HYBRID, FULL, FULL],
    motor_rotation: all("CCW"),
    thr_rate: ["30", "20", "10", "15", "15", "30", "30", "15", "20", "20"],
    thr_curve: all("Linear"),
    neutral_range: all("6%"),
    coast: all("0"),
    pwm_freq: ["2K", "8K", "8K", "8K", "8K", "4K", "4K", "8K", "4K", "4K"],
    soft_value: all("0"),
    soft_range: all("0%"),
    drag_brake: ["0", "10", "0", "0", "0", "5", "5", "0", "100", "0"],
    max_brake: ["100", "87", "87", "87", "100", "87", "87", "75", "100", "100"],
    init_brake_mode: all(SAME_AS_DRAG),
    brake_rate: ["20", "10", "20", "20", "20", "20", "20", "10", "20", "10"],
    brake_curve: all("Linear"),
    brake_freq: all("1K"),
    brake_control: ["Traditional", "Linear", "Linear", "Linear", "Linear", "Linear", "Linear", "Linear", "Traditional", "Traditional"],
    boost_timing: ["0", "0", "0", "0", "0", "30", "30", "0", "0", "10"],
    boost_activation: ["RPM", "RPM", "RPM", "RPM", "RPM", "Auto", "Auto", "RPM", "RPM", "Auto"],
    boost_start_rpm: ["6000", "15000", "6000", "6000", "6000", "4000", "2000", "6000", "6000", "6000"],
    boost_end_rpm: ["22500", "25000", "22500", "22500", "22500", "12000", "8000", "22500", "22500", "22500"],
    turbo_timing: ["0", "20", "0", "10", "0", "25", "35", "10", "0", "24"],
    turbo_delay: ["0.3s", "0.1s", "0.3s", "0.3s", "0.3s", "0.2s", "0.1s", "Instant", "0.3s", "0.3s"],
    turbo_inc: ["12", "18", "12", "12", "12", "24", "24", "12", "12", "Instant"].map(rate),
    turbo_dec: ["24", "24", "24", "24", "24", "18", "18", "24", "24", "Instant"].map(rate)
  };

  // 說明書沒有寫出廠時是哪一組模式，所以模式欄位沒有原廠值，只給頁面的預設（preset）。
  // 使用者的車是 2WD 甩尾車，先預設模式 10，一打開各欄就有整組出廠值；要換預設改這一行。
  var DEFAULT_MODE = MODES[9];

  function factoryOf(it, vals) {
    var i = MODES.indexOf(vals.mode);
    var row = DEFAULTS[it.id];
    return i >= 0 && row ? row[i] : "";
  }

  /* ---------- 圖表：依目前的值回傳圖表規格，資料不足時回傳 { title, empty } ---------- */

  function num(v) { return v == null || v === "" ? NaN : parseFloat(v); }

  var TIMING_Y = { label: "進角 °", max: 64, ticks: [0, 16, 32, 48, 64] };
  var TIMING_Y2 = { label: "進角 °", max: 128, ticks: [0, 32, 64, 96, 128] };
  var HYBRID_NOTE = "感應模式設為 Sensored/Sensorless Hybrid 時，說明書註明進角項目不可調整。";

  function percentAxis(label) { return { label: label, max: 100, ticks: [0, 25, 50, 75, 100] }; }

  function softeningChart(v) {
    var title = "柔化作用的油門範圍";
    var value = num(v.soft_value), range = num(v.soft_range);
    if (isNaN(value) || isNaN(range)) return { title: title, empty: "填入 2F 柔化值、2G 柔化範圍後顯示。" };
    if (!value || !range) return { title: title, empty: "柔化值或柔化範圍為 0，沒有使用柔化。" };
    return {
      title: title,
      x: percentAxis("油門 %"),
      y: { label: "柔化值 °", max: 30, ticks: [0, 10, 20, 30] },
      lines: [{ kind: "main", area: true, points: [[0, value], [range, value], [range, 0], [100, 0]] }],
      note: "油門 0%–" + range + "% 之間套用 " + value + "° 柔化。"
    };
  }

  function brakeChart(v) {
    var title = "煞車力度隨扳機行程的變化";
    var drag = num(v.drag_brake), max = num(v.max_brake);
    var init = v.init_brake_mode === SAME_AS_DRAG ? drag : v.init_brake_mode === CUSTOM ? num(v.init_brake) : NaN;
    if (isNaN(drag) || isNaN(max) || isNaN(init)) return { title: title, empty: "填入 3A 拖曳煞車、3B 最大煞車、3C 初始煞車後顯示。" };
    var custom = v.brake_curve === "Customized";
    return {
      title: title,
      x: percentAxis("煞車扳機行程 %"),
      y: { label: "煞車力度 %", max: 150, ticks: [0, 50, 100, 150] },
      lines: [
        { kind: custom ? "guess" : "main", area: !custom, label: "扳機煞車 " + init + "% → " + max + "%", points: [[0, init], [100, max]] },
        { kind: "ref", label: "拖曳煞車 " + drag + "%（收油時）", points: [[0, drag], [100, drag]] }
      ],
      note: custom ? "煞車曲線是 Customized，實際曲線依自訂內容，虛線只連接起點與終點。" : ""
    };
  }

  function boostChart(v) {
    var title = "Boost 進角隨轉速的變化";
    if (v.sensor_mode === HYBRID) return { title: title, empty: HYBRID_NOTE };
    var boost = num(v.boost_timing), turbo = num(v.turbo_timing) || 0;
    if (isNaN(boost) || !v.boost_activation) return { title: title, empty: "填入 4A Boost 進角、4B 觸發方式後顯示。" };
    var y = boost + turbo > 64 ? TIMING_Y2 : TIMING_Y;
    var turboLabel = "全油門 Turbo 啟動後 +" + turbo + "°";
    var lines;

    if (v.boost_activation === "Auto") {
      lines = [{ kind: "guess", label: "Boost 全油門時 " + boost + "°", points: [[0, 0], [100, boost]] }];
      if (turbo) lines.push({ kind: "alt", label: turboLabel, points: [[100, boost], [100, boost + turbo]] });
      return {
        title: "Boost 進角隨油門量的變化",
        x: percentAxis("油門 %"),
        y: y,
        lines: lines,
        dots: [{ x: 100, y: boost, kind: "main" }].concat(turbo ? [{ x: 100, y: boost + turbo, kind: "alt" }] : []),
        note: "說明書只說 Auto 依油門量調整、全油門才到設定值；中間怎麼變化沒寫，虛線僅為示意。"
      };
    }

    var start = num(v.boost_start_rpm), end = num(v.boost_end_rpm);
    if (isNaN(start) || isNaN(end)) return { title: title, empty: "填入 4C 起始轉速、4D 結束轉速後顯示。" };
    end = Math.max(end, start);
    var max = [10000, 20000, 40000, 60000, 80000].filter(function (n) { return n >= end * 1.15; })[0] || 80000;
    var pts = [[0, 0], [start, 0], [end, boost], [max, boost]];
    lines = [{ kind: "main", area: true, label: "Boost " + boost + "°", points: pts }];
    if (turbo) {
      lines.push({ kind: "alt", label: turboLabel, points: pts.map(function (p) { return [p[0], p[1] + turbo]; }) });
    }
    return {
      title: title,
      x: { label: "馬達轉速 RPM", max: max, ticks: [0, max / 4, max / 2, max * 3 / 4, max], fmt: function (t) { return t / 1000 + "k"; } },
      y: y,
      lines: lines,
      marks: [{ x: start, label: "起始" }, { x: end, label: "結束" }],
      note: boost ? "" : "Boost 進角為 0°，沒有使用 Boost 進角。"
    };
  }

  function turboChart(v) {
    var title = "Turbo 進角隨時間的變化";
    if (v.sensor_mode === HYBRID) return { title: title, empty: HYBRID_NOTE };
    var turbo = num(v.turbo_timing);
    if (isNaN(turbo) || !v.turbo_delay || !v.turbo_inc || !v.turbo_dec) return { title: title, empty: "填入 5A 到 5D 後顯示。" };
    if (!turbo) return { title: title, empty: "Turbo 進角為 0°，沒有使用 Turbo 進角。" };

    // 幾秒走完全部進角：度數 ÷（每 0.1 秒幾度）× 0.1
    function secs(r) { return r === "Instant" ? 0 : turbo / parseFloat(r) / 10; }
    function say(t) { return +t.toFixed(2) + " 秒"; }
    var HOLD = 0.3;   // 進角加滿後維持全油門的時間；說明書沒有這個參數，只是為了畫出收回段
    var delay = v.turbo_delay === "Instant" ? 0 : parseFloat(v.turbo_delay);
    var rise = secs(v.turbo_inc), fall = secs(v.turbo_dec);
    var up = delay + rise, release = up + HOLD, down = release + fall;
    var max = Math.max(1, Math.ceil((down + 0.05) * 2) / 2);
    var step = max <= 1 ? 0.25 : max <= 3 ? 0.5 : 1;
    var ticks = [];
    for (var t = 0; t <= max + 1e-9; t += step) ticks.push(t);
    return {
      title: title,
      x: { label: "拉到全油門後經過的時間 秒", max: max, ticks: ticks },
      y: TIMING_Y,
      lines: [{ kind: "main", area: true, points: [[0, 0], [delay, 0], [up, turbo], [release, turbo], [down, 0], [max, 0]] }],
      marks: [{ x: release, label: "收油" }],
      note: "全油門" + (delay ? " " + say(delay) + "後" : "立即") + "啟動，" + (rise ? say(rise) + "內" : "瞬間") + "加到 " + turbo + "°；收油後"
        + (fall ? " " + say(fall) + "內" : "瞬間") + "收回。全油門維持多久僅為示意。"
    };
  }

  /* ---------- 產品定義 ---------- */

  var NOT_IN_HYBRID = "感應模式（1H）設為 Sensored/Sensorless Hybrid 時，說明書註明此項不可調整";

  (window.RC_PRODUCTS = window.RC_PRODUCTS || []).push({
    id: "hobbywing-xr10pro-g2",
    category: "電變",
    name: "Hobbywing XERUN XR10 Pro G2",
    desc: "1/10 競賽用有感無刷電變（30112608 黑／30112607 橘）",
    spec: [
      "持續／瞬間電流：160A／1200A",
      "電池：2S LiPo／4-6S NiMH",
      "BEC：5-7.4V 可調，持續 5A（交換式）",
      "馬達限制（2S LiPo，3650 馬達）：房車 ≥4.5T、越野車 ≥5.5T",
      "尺寸／重量：37.5×30.9×32.5 mm（含風扇）／95 g（含線）",
      "設定方式：多功能 LCD 設定盒，或 WiFi 模組搭配手機 App（都是另購）"
    ],
    manuals: [
      { title: "說明書 User Manual（英文）", url: BASE + "uploads/file/20221024/c7c899724ffc421cf90154a7960384a0.pdf", note: "PDF，約 3 MB；HW-SM516ENG，印刷版次 20190530" },
      { title: "空白設定表 Team Setup Sheet", url: BASE + "uploads/file/20220916/a6d4c553237ca9e889b9395bd7576bdf.pdf", note: "PDF" },
      { title: "Hobbywing 官網產品頁", url: BASE + "products/xerun-xr10-pro-g2166.html", note: "上面的連結失效時從這裡找" }
    ],
    notes: [
      "欄位、選項與可調範圍出自說明書的 Programmable Items 參數表；基本資料與行駛資料記錄的欄位出自原廠 Team Setup Sheet。",
      "這顆電變有 10 組 Preset Mode，每組的出廠值不同。在「基本資料」選使用的模式，各欄的原廠值會跟著切換；頁面預設是模式 10（2WD 甩尾車），說明書沒有寫電變出廠時是哪一組。",
      "滑桿與刻度條上的金色記號是目前模式的原廠值。曲線圖是依說明書描述的規則畫的示意，不是實測資料。",
      "說明書是 2019 年的版本，之後韌體更新才新增或變更的選項不在這裡。"
    ],
    factoryOf: factoryOf,
    cards: [
      { id: "info", name: "基本資料", groups: ["info"], summary: [["模式", "mode"], ["馬達", "motor"]] },
      { id: "general", name: "一般設定", groups: ["general"], summary: [["BEC", "bec_volt"], ["轉向", "motor_rotation"]] },
      { id: "throttle", name: "油門控制", groups: ["throttle"], summary: [["反應", "thr_rate"], ["PWM", "pwm_freq"]] },
      { id: "brake", name: "煞車控制", groups: ["brake"], summary: [["拖曳", "drag_brake"], ["最大", "max_brake"]] },
      { id: "timing", name: "進角", groups: ["timing"], summary: [["Boost", "boost_timing"], ["Turbo", "turbo_timing"]] },
      { id: "record", name: "行駛資料記錄", groups: ["record"], summary: [["電變", "log_esc_temp"], ["馬達", "log_motor_temp"]] }
    ],
    // 說明書 Note 4：感應模式選 Hybrid 時不可調整的項目（4B 選 Auto 時的 4C、4D 用 showIf 直接收起來）
    locks: [
      { when: { id: "sensor_mode", is: HYBRID },
        items: ["pwm_freq", "brake_freq", "brake_control", "boost_timing", "boost_activation", "boost_start_rpm", "boost_end_rpm",
          "turbo_timing", "turbo_delay", "turbo_inc", "turbo_dec"],
        text: NOT_IN_HYBRID }
    ],
    groups: [
      {
        id: "info",
        name: "基本資料",
        src: "說明書 Preset Modes／原廠設定表表頭（日期、場地、地面、氣溫、終傳比記在車架那邊，這裡不重複）",
        items: [
          {
            id: "mode", name: "使用的模式", en: "Preset Mode", type: "select", options: MODES,
            preset: DEFAULT_MODE,
            rerender: true,   // 模式一換，其他欄位的原廠值都跟著換
            fnote: "電變內建 10 組模式，每組的設定值都能修改、也能改名。選了哪一組，各欄的原廠值就是那一組的出廠值。說明書沒有寫電變出廠時是哪一組，這裡先預設模式 10（2WD 甩尾車），請改成實際使用的那一組",
            effect: [
              m("1 Zero Timing", "所有要求零進角（blinky）的 Stock 賽事"),
              m("2 TC-Modify", "1/10 房車改裝組"),
              m("3 Buggy-2WD-Modify", "1/10 2WD 越野車改裝組"),
              m("4 Buggy-4WD-Modify", "1/10 4WD 越野車改裝組"),
              m("5 Practice", "練習與休閒，有倒車"),
              m("6 Stock-13.5T", "1/10 房車 13.5T Open Stock 組"),
              m("7 Stock-17.5T", "1/10 房車 17.5T Open Stock 組"),
              m("8 SCT-4 Pole", "使用 4 極馬達的 1/10 4WD SCT"),
              m("9 Crawler", "1/10 攀岩車"),
              m("10 Drift 2WD Carpet", "1/10 2WD 甩尾車，地毯場地")
            ]
          },
          { id: "mode_name", name: "模式名稱", en: "Mode name", type: "text", fnote: "有把模式改名才填，例如 TITC2019_MOD_4.5（2019 年 TITC、改裝組 4.5T）" },
          { id: "firmware", name: "韌體版本", en: "Firmware Version", type: "text" },
          { id: "motor", name: "馬達", en: "Motor", type: "text" },
          { id: "endbell_timing", name: "馬達機械進角", en: "Endbell Timing", type: "text" },
          { id: "rotor", name: "轉子", en: "Rotor", type: "text" },
          { id: "note", name: "備註", en: "Note", type: "text", fnote: "自訂的油門／煞車曲線、自訂頻率的內容可以寫在這裡" }
        ]
      },
      {
        id: "general",
        name: "一般設定",
        src: "說明書 Programmable Items：General Setting（1A–1I）",
        items: [
          {
            id: "run_mode", name: "運行模式", en: "1A Running Mode", type: "select", options: [FB, FRB, FR],
            glyphs: {
              "Forward with Brake": ["run-fb", "前進、煞車"],
              "Forward/Reverse with Brake": ["run-frb", "前進、煞車、倒車（推第二次才倒車）"],
              "Forward and Reverse": ["run-fr", "前進、倒車（一推就倒車）"]
            },
            effect: [
              m(FB, "競賽模式，只有前進與煞車"),
              m(FRB, "練習模式：第一次推煞車只會煞車，放開再推一次、而且車已經停下才會倒車，避免誤倒車"),
              m(FR, "推煞車就直接倒車，多用在攀岩車")
            ]
          },
          {
            id: "reverse_force", name: "最大倒車力度", en: "1B Max. Reverse Force", type: "select",
            options: ["25%", "50%", "75%", "100%"],
            effect: [
              m("數值加大", "倒車速度變快"),
              m("建議", "為了車子的安全，說明書建議用較低的值")
            ]
          },
          {
            id: "cutoff_mode", name: "低壓保護", en: "1C Cutoff Voltage", type: "select", options: ["Disabled", AUTO_CUT, CUSTOM],
            fnote: "電池電壓低於門檻時，3 秒內把輸出降到 30%，10 秒後切斷輸出，紅燈單閃",
            effect: [
              m("Disabled", "不會因為低電壓切斷輸出。用鎳氫電池時選這項；鋰電不建議，過放會造成無法復原的損壞"),
              m(AUTO_CUT, "依偵測到的鋰電節數，以每節 3.3V 計算，2S 就是 6.6V"),
              m(CUSTOM, "自己設定整顆電池的門檻電壓，例如 2S 想要每節 2.8V 就設 5.6V；選了之後下面會多一欄可以填")
            ]
          },
          {
            id: "cutoff_volt", name: "自訂低壓保護電壓", en: "1C Cutoff Voltage (Customized)", type: "num", unit: "V",
            showIf: function (v) { return v.cutoff_mode === CUSTOM; },
            min: 3, max: 7.4, step: 0.1,
            fnote: "低壓保護選「自訂」時才會出現，每格 0.1V。說明書內文另寫 3.0-11.1V，這裡依參數表與原廠設定表"
          },
          {
            id: "esc_temp", name: "電變過熱保護", en: "1D ESC Thermal Protection", type: "select", options: [T105, T125, "Disabled"],
            fnote: "說明書建議設 105℃/221℉（指電變內部溫度）；外殼超過 90℃ 就該停止使用",
            effect: [
              m("到達設定溫度", "切斷輸出，綠燈單閃；電變降溫後才恢復"),
              m("Disabled", "不保護。說明書警告：除了比賽不要關閉，高溫可能損壞電變與馬達")
            ]
          },
          {
            id: "motor_temp", name: "馬達過熱保護", en: "1E Motor Thermal Protection", type: "select", options: [T105, T125, "Disabled"],
            effect: [
              m("到達設定溫度", "切斷輸出，綠燈雙閃；馬達降溫後才恢復"),
              m("Disabled", "不保護。非 Hobbywing 的馬達因為溫度感測器不同，可能太早或太晚觸發，說明書建議這種情況關閉並自己監看馬達溫度")
            ]
          },
          {
            id: "bec_volt", name: "BEC 電壓", en: "1F BEC Voltage", type: "num", unit: "V",
            min: 5, max: 7.4, step: 0.1,
            fnote: "供給接收機與伺服機的電壓，每格 0.1V",
            effect: [
              m("6.0V", "一般伺服機用。高壓伺服機接 6.0V 可能因為電壓不足而動作不正常"),
              m("7.4V", "高壓伺服機用。一般伺服機接 7.4V 可能燒毀")
            ]
          },
          {
            id: "remote_off", name: "遙控關機", en: "1G Remote Off", type: "select", options: ["Enabled", "Disabled"],
            effect: [
              m("Enabled", "煞車扳機推到底維持 6 秒就能關閉電變"),
              m("Disabled", "只能按電變上的開關關機")
            ]
          },
          {
            id: "sensor_mode", name: "感應模式", en: "1H Sensor Mode", type: "select", options: [FULL, HYBRID],
            fnote: "選 Sensored/Sensorless Hybrid 時，2E、3F、3G 與 4A 到 5D 不可調整（說明書 Note 4）",
            effect: [
              m(FULL, "全程以有感方式驅動，效率與操控性最好。搭配非 Hobbywing 的 4 極有感馬達時不要選這項，可能損壞電變與馬達"),
              m(HYBRID, "低速起步用有感，之後切換成無感；適合用 4 極馬達的 4WD SCT")
            ]
          },
          {
            id: "motor_rotation", name: "馬達轉向", en: "1I Motor Rotation", type: "select", options: ["CCW", "CW"],
            glyphs: { CCW: ["ccw", "面對馬達軸，逆時針"], CW: ["cw", "面對馬達軸，順時針"] },
            fnote: "面對馬達軸、加油門時馬達軸的旋轉方向",
            effect: [
              m("CCW", "逆時針；一般車架這樣是前進"),
              m("CW", "順時針；少數車架因為設計不同，要選這項才會前進")
            ]
          }
        ]
      },
      {
        id: "throttle",
        name: "油門控制",
        src: "說明書 Programmable Items：Throttle Control（2A–2G）",
        charts: [{ name: "柔化", after: "soft_value", uses: ["soft_value", "soft_range"], build: softeningChart }],
        items: [
          {
            id: "thr_rate", name: "油門反應速率", en: "2A Throttle Rate Control", type: "num",
            min: 1, max: 30, step: 1,
            effect: [
              m("數值調低", "油門反應受到的限制變多，起步比較好控制"),
              m("數值調高", "油門反應快，適合油門控制熟練的人")
            ]
          },
          {
            id: "thr_curve", name: "油門曲線", en: "2B Throttle Curve", type: "select", options: ["Linear", "Customized"],
            effect: [
              m("Linear", "扳機位置與油門輸出成正比（預設）"),
              m("Customized：+EXP", "前段的油門輸出比線性高"),
              m("Customized：-EXP", "前段的油門輸出比線性低")
            ]
          },
          {
            id: "neutral_range", name: "中立點範圍", en: "2C Neutral Range", type: "select",
            options: ["4%", "6%", "8%"],
            effect: [m("調大", "遙控器的中立點不夠穩定時使用")]
          },
          {
            id: "coast", name: "滑行", en: "2D Coast", type: "num", unit: "%",
            min: 0, max: 20, step: 1,
            fnote: "拖曳煞車（3A）不是 0% 時，這項無效（說明書 Note 5）",
            effect: [
              m("數值加大", "收油時馬達轉速慢慢降，車子不會突然減速，滑行感越明顯；20% 最強"),
              m("0%", "關閉"),
              m("適用", "終傳比大的車收油時拖滯感重，用 Coast 讓車子能滑行，操控比較平順")
            ]
          },
          {
            id: "pwm_freq", name: "PWM 驅動頻率", en: "2E PWM Drive Frequency", type: "select",
            options: PWM_STEPS.concat("Customized"), scale: PWM_STEPS,
            effect: [
              m("頻率調低", "起步段的加速比較猛"),
              m("頻率調高", "比較平順，但電變發熱較多"),
              m("Customized", "依 0–100% 油門量設定不同的頻率（0K–32K），依實測結果選")
            ]
          },
          {
            id: "soft_value", name: "柔化值", en: "2F Softening Value", type: "num", unit: "°",
            min: 0, max: 30, step: 1,
            effect: [
              m("數值加大", "低轉段的出力越溫和；用在改裝組低轉太猛、一點油門就出太多力、彎中不好控制的情況"),
              m("搭配機械進角", "柔化值每增加 5°，馬達機械進角可以加 1°，總共不要加超過 5°")
            ]
          },
          {
            id: "soft_range", name: "柔化範圍", en: "2G Softening Range", type: "select",
            options: SOFT_RANGES, scale: SOFT_RANGES,
            fnote: "選項依說明書參數表；原廠設定表寫 0%–75% 可調",
            effect: [m("例：30%", "柔化值在 0%–30% 油門之間作用")]
          }
        ]
      },
      {
        id: "brake",
        name: "煞車控制",
        src: "說明書 Programmable Items：Brake Control（3A–3G）",
        charts: [{ name: "煞車", after: "brake_curve", uses: ["drag_brake", "max_brake", "init_brake_mode", "init_brake", "brake_curve"], build: brakeChart }],
        items: [
          {
            id: "drag_brake", name: "拖曳煞車力度", en: "3A Drag Brake Force", type: "num", unit: "%",
            min: 0, max: 100, step: 1,
            effect: [
              m("數值加大", "從全速收油回中立點時的煞車力變大，像有刷馬達滑行時的煞車感；耗電與發熱增加"),
              m("適用", "說明書不建議用在越野車與大腳車")
            ]
          },
          {
            id: "max_brake", name: "最大煞車力度", en: "3B Max. Brake Force", type: "num", unit: "%",
            min: 0, max: 150, step: 1,
            fnote: "扳機推到全煞車時的煞車力；煞車力與扳機位置成比例",
            effect: [m("數值加大", "煞車距離變短，但可能傷到馬達齒與大齒盤")]
          },
          {
            id: "init_brake_mode", name: "初始煞車力度", en: "3C Initial Brake Force", type: "select", options: [SAME_AS_DRAG, CUSTOM],
            fnote: "又稱最小煞車力：扳機從中立區剛推進煞車區時的煞車力",
            effect: [
              m("等於拖曳煞車", "預設。剛進煞車區的力道與拖曳煞車相同，煞車比較平順"),
              m(CUSTOM, "自己設定力道；選了之後下面會多一欄可以填")
            ]
          },
          {
            id: "init_brake", name: "自訂初始煞車力度", en: "3C Initial Brake Force (Customized)", type: "num", unit: "%",
            showIf: function (v) { return v.init_brake_mode === CUSTOM; },
            min: 0, max: 50, step: 1,
            fnote: "初始煞車力度選「自訂」時才會出現"
          },
          {
            id: "brake_rate", name: "煞車反應速率", en: "3D Brake Rate Control", type: "num",
            min: 1, max: 20, step: 1,
            effect: [
              m("數值調低", "煞車反應受到的限制變多；選到合適的值有助於煞得準"),
              m("數值調高", "煞車反應快")
            ]
          },
          {
            id: "brake_curve", name: "煞車曲線", en: "3E Brake Curve", type: "select", options: ["Linear", "Customized"],
            effect: [
              m("Linear", "煞車區的扳機行程與煞車力成正比（預設）"),
              m("Customized", "非線性曲線；要用 LCD 設定盒接電腦（HOBBYWING USB LINK）設定")
            ]
          },
          {
            id: "brake_freq", name: "煞車頻率", en: "3F Brake Frequency", type: "select",
            options: BRAKE_FREQ_STEPS.concat("Customized"), scale: BRAKE_FREQ_STEPS,
            effect: [
              m("頻率調低", "煞車力變強"),
              m("頻率調高", "煞車比較平順"),
              m("Customized", "依 0–100% 油門量設定不同的頻率（0K–16K），依實測結果選")
            ]
          },
          {
            id: "brake_control", name: "煞車控制方式", en: "3G Brake Control", type: "select", options: ["Linear", "Traditional", "Hybrid"],
            effect: [
              m("Linear", "說明書建議所有情況都用：煞車比 Traditional 稍弱，但好控制、手感好"),
              m("Traditional", "與舊款 XERUN 電變相同，煞車力較強"),
              m("Hybrid", "依車速在 Linear 與 Traditional 之間切換，避免輪胎打滑影響煞車")
            ]
          }
        ]
      },
      {
        id: "timing",
        name: "進角",
        src: "說明書 Programmable Items：Timing（4A–5D）",
        note: "說明書警告：Boost 與 Turbo 進角太激進可能燒毀電變或馬達，改完要試跑、量電變與馬達溫度，再調整進角與齒比。",
        charts: [
          { name: "Boost", after: "boost_activation", uses: ["boost_timing", "boost_activation", "boost_start_rpm", "boost_end_rpm"], build: boostChart },
          { name: "Turbo", after: "turbo_delay", uses: ["turbo_timing", "turbo_delay", "turbo_inc", "turbo_dec"], build: turboChart }
        ],
        items: [
          {
            id: "boost_timing", name: "Boost 進角", en: "4A Boost Timing", type: "num", unit: "°",
            min: 0, max: 64, step: 1,
            fnote: "在整個油門範圍都有作用；實際進角不是固定值，會依轉速或油門量動態調整（見 4B）",
            effect: [
              m("數值加大", "整條賽道各段的車速都提高，加速也變好；電變與馬達的溫度上升"),
              m("數值調低", "馬達溫度較低、行駛時間較長")
            ]
          },
          {
            id: "boost_activation", name: "Boost 觸發方式", en: "4B Boost Timing Activation", type: "select", options: ["RPM", "Auto"],
            effect: [
              m("RPM", "依馬達轉速調整：低於起始轉速時進角為 0，起始到結束轉速之間隨轉速增加，高於結束轉速就是設定值"),
              m("Auto", "依油門量調整，只有全油門時才是設定值；選 Auto 時 4C、4D 不可調整，這一頁會把那兩欄收起來")
            ]
          },
          {
            id: "boost_start_rpm", name: "Boost 起始轉速", en: "4C Boost Start RPM", type: "num", unit: "RPM",
            showIf: function (v) { return v.boost_activation !== "Auto"; },
            min: 500, max: 35000, step: 500,
            fnote: "轉速高於這個值，Boost 進角開始作用；每格 500 RPM",
            effect: [
              m("數值調低", "加速變好"),
              m("數值調高", "馬達溫度較低、行駛時間較長")
            ]
          },
          {
            id: "boost_end_rpm", name: "Boost 結束轉速", en: "4D Boost End RPM", type: "num", unit: "RPM",
            showIf: function (v) { return v.boost_activation !== "Auto"; },
            min: 3000, max: 60000, step: 500,
            fnote: "轉速高於這個值，Boost 進角達到設定的度數；每格 500 RPM",
            effect: [
              m("數值調低", "加速變好"),
              m("數值調高", "馬達溫度較低、行駛時間較長")
            ]
          },
          {
            id: "turbo_timing", name: "Turbo 進角", en: "5A Turbo Timing", type: "num", unit: "°",
            min: 0, max: 64, step: 1,
            fnote: "全油門時才會啟動的進角",
            effect: [
              m("數值加大", "直線尾速提高，通常在長直線發揮；電變與馬達的溫度上升"),
              m("數值調低", "馬達溫度較低、行駛時間較長")
            ]
          },
          {
            id: "turbo_delay", name: "Turbo 延遲", en: "5B Turbo Delay", type: "select", options: TURBO_DELAYS, scale: TURBO_DELAYS,
            effect: [
              m("Instant", "扳機拉到全油門就立刻啟動 Turbo 進角"),
              m("時間調短", "加速變好"),
              m("時間調長", "要維持全油門更久才啟動；馬達溫度較低、行駛時間較長")
            ]
          },
          {
            id: "turbo_inc", name: "Turbo 開啟速率", en: "5C Turbo Increase Rate", type: "select", options: TURBO_RATES, scale: TURBO_RATES,
            fnote: "Turbo 進角釋放的速度，例如 6deg/0.1s 是 0.1 秒內釋放 6 度",
            effect: [m("數值加大", "加速變猛，發熱也變高")]
          },
          {
            id: "turbo_dec", name: "Turbo 關閉速率", en: "5D Turbo Decrease Rate", type: "select", options: TURBO_RATES, scale: TURBO_RATES,
            fnote: "離開全油門後，Turbo 進角收回的速度",
            effect: [
              m("Instant 或數值大", "進角一下子收回，會有像煞車一樣的頓挫，車子比較難控制"),
              m("數值調小", "進角慢慢收回，減速比較線性、好控制；馬達溫度較低")
            ]
          }
        ]
      },
      {
        id: "record",
        name: "行駛資料記錄",
        src: "原廠設定表 Data Record／說明書 Data Checking",
        note: "電變會記錄行駛中的這四項資料，關機時存檔，用 LCD 設定盒查看。",
        items: [
          { id: "log_esc_temp", name: "最高電變溫度", en: "Max. ESC Temperature", type: "text" },
          { id: "log_motor_temp", name: "最高馬達溫度", en: "Max. Motor Temperature", type: "text" },
          { id: "log_min_volt", name: "最低電池電壓", en: "Min. Battery Voltage", type: "num", unit: "V" },
          { id: "log_max_rpm", name: "最高馬達轉速", en: "Max. Motor RPM", type: "num", unit: "RPM" }
        ]
      }
    ]
  });
})();
