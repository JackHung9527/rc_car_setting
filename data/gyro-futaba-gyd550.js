/*
 * 陀螺儀：Futaba GYD550（RC 甩尾車用）
 *
 * 欄位與說明來源（都在 manuals 清單裡）：
 *   - GYD550 說明書 1M23N35502（2020 年 3 月）：本體按鈕的 Parameter settings、Damper 八段檔位與出廠值
 *   - T10PX 說明書 p.219–222 Gyro Link：從遙控器無線設定的項目（Basic setting、Gyro data）
 *
 * 無線設定的項目，兩份說明書都沒有寫可調範圍與出廠值，所以這些欄位不寫 factory、min、max，
 * 沒填之前是空的；start 只是加減按鈕第一次按下時的起點，取自 T10PX 說明書畫面範例上的數字。
 * 增益（Gain）與 AVCS／NORMAL 的切換是遙控器 Gyro Mixing 的設定，記在遙控器那邊，這裡不重複。
 *
 * effect 每一筆的來源：
 *   m(...) 說明書原文有寫的特性
 * charts 只有 js/visual.js 會讀，格式見該檔開頭。
 */
(function () {
  "use strict";

  function m(when, then) { return { w: when, t: then, manual: true }; }

  var NO_RANGE = "說明書沒有寫可調範圍與出廠值，請填 Gyro Link 讀回來的實際數值";

  var DAMPER_STEP_FX = [
    m("出現 hunting", "往 Mild 側（數字大）調"),
    m("搭配增益", "說明書建議先用增益 70% 行駛，出現 hunting 再把 Damper 往 Mild 調；增益越高陀螺儀效果越強，也越容易 hunting")
  ];

  function damperStep(id, mode, led, factory) {
    return {
      id: id, name: "本體 Damper 檔位（" + mode + "）", en: "Damper (" + mode + ")", type: "num",
      min: 1, max: 8, step: 1, factory: factory,
      fnote: "用本體按鈕設定的八段檔位：短按一下顯示目前檔位（" + led + "燈閃幾下就是第幾段），再短按換下一段。1 是 Quick、8 是 Mild；NORMAL 與 AVCS 分開設定",
      effect: DAMPER_STEP_FX
    };
  }

  /* ---------- 轉向增益曲線 ---------- */

  var CURVE_IDS = [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return "curve_" + n; });

  function curvePoint(n) {
    return {
      id: "curve_" + n, name: "增益曲線點 " + n, en: "Steering gain curve " + n, type: "num", step: 1, start: 100,
      fnote: n === 1 ? "以中立為基準、到終點為止共八點，左右對稱一起設定。" + NO_RANGE : NO_RANGE
    };
  }

  function curveChart(v) {
    var title = "轉向增益曲線";
    var pts = CURVE_IDS.map(function (id, i) { return [i + 1, parseFloat(v[id])]; });
    if (pts.some(function (p) { return isNaN(p[1]); })) return { title: title, empty: "八個曲線點都填了之後顯示。" };
    var top = Math.max.apply(null, pts.map(function (p) { return p[1]; }).concat(100));
    return {
      title: title,
      x: { label: "曲線點", max: 8, ticks: [1, 2, 3, 4, 5, 6, 7, 8] },
      y: { label: "增益", max: top, ticks: [0, top / 4, top / 2, top * 3 / 4, top] },
      lines: [{ kind: "main", area: true, points: pts }],
      dots: pts.map(function (p) { return { x: p[0], y: p[1], kind: "main" }; }),
      note: "說明書只寫「以中立為基準、到終點為止可設八點，左右對稱」；圖上由左到右是點 1 到點 8。"
    };
  }

  /* ---------- 產品定義 ---------- */

  (window.RC_PRODUCTS = window.RC_PRODUCTS || []).push({
    id: "futaba-gyd550",
    category: "陀螺儀",
    name: "Futaba GYD550",
    desc: "RC 甩尾車專用陀螺儀，控制轉向伺服機；支援 S.BUS／S.BUS2，只能搭配 Futaba 數位伺服機",
    spec: [
      "感測器：MEMS 振動式陀螺儀（本體一體式）",
      "工作電壓：DC 3.5–8.4 V",
      "消耗電流：30 mA（不含伺服機）",
      "工作溫度：-10 到 +45 ℃",
      "尺寸／重量：22.6×19.6×11.0 mm（不含突出部）／5.6 g",
      "增益要由遙控器控制，遙控器需要 3 個頻道以上"
    ],
    manuals: [
      { title: "GYD550 說明書 Instruction Manual（英文）", url: "https://futabausa.com/wp-content/uploads/manuals/GYD550_ENG_0306.pdf", note: "PDF，約 1 MB；1M23N35502，2020 年 3 月版" },
      { title: "T10PX 說明書（英文），Gyro Link 在第 219–224 頁", url: "https://www.rc.futaba.co.jp/downloads/shop/WCI00000280N24101013006vlbo.pdf?mode=view", note: "PDF，約 19 MB；從遙控器無線設定的項目寫在這裡" }
    ],
    notes: [
      "「基本設定」的四項出自 GYD550 說明書，有寫出廠值。本體按鈕另外還能做 Neutral（中立點）與 Limit（最大轉向角）設定，但那兩項只看得到綠燈或紅燈、沒有數值，所以數值記在「無線基本設定」。",
      "「無線基本設定」「陀螺儀資料」「轉向增益曲線」出自 T10PX 說明書的 Gyro Link。這些項目兩份說明書都沒有寫可調範圍與出廠值，欄位一開始是空的，請用 Gyro Link 讀回實際數值後填入；加減按鈕第一次按下時的起點取自說明書畫面範例。",
      "無線設定需要支援的接收機：R404SBS／R404SBS-E，或 4.0 版以上的 R334SBS／R334SBS-E（T10PX 說明書 p.219，2021 年 12 月時的資訊）。",
      "增益（Gain）與 AVCS／NORMAL 的切換是在遙控器的 Gyro Mixing 設定，記在遙控器那邊，這裡不重複。"
    ],
    cards: [
      { id: "basic", name: "基本設定", groups: ["basic"], summary: [["伺服機", "servo_type"], ["方向", "reverse"]] },
      { id: "link", name: "無線基本設定", groups: ["link"], summary: [["反應", "response_mode"], ["中立", "neutral_offset"]] },
      { id: "data", name: "陀螺儀資料", groups: ["data"], summary: [["Damper", "damper"], ["甩尾", "tail_slide"]] },
      { id: "curve", name: "轉向增益曲線", groups: ["curve"], summary: [["點 1", "curve_1"], ["點 8", "curve_8"]] }
    ],
    groups: [
      {
        id: "basic",
        name: "基本設定",
        src: "GYD550 說明書 Parameter settings、Damper；T10PX 說明書 p.221 Gyro Link Basic setting",
        note: "開機後 3–5 秒是初始化並讀取中立點，這段時間不要動車、也不要動方向盤。不能使用類比伺服機。",
        items: [
          {
            id: "servo_type", name: "伺服機類型", en: "Servo type／SR mode setting", type: "select", options: ["Normal", "SR mode"],
            factory: "Normal",
            fnote: "本體按鈕：長按 3 秒進設定模式，LED 閃 1 下，綠燈是 Normal、紅燈是 SR mode。用 SR 模式時不能走 S.BUS 連接，遙控器的轉向頻道與陀螺儀增益頻道都要設成 SR-ON",
            effect: [
              m("SR mode", "伺服機能切到 SR 模式時使用，伺服機反應變快"),
              m("伺服機不能切到 SR 模式", "遙控器不要設成 SR 模式")
            ]
          },
          {
            id: "reverse", name: "陀螺儀修正方向", en: "Gyro reverse", type: "select", options: ["Normal", "Reverse"],
            factory: "Normal",
            fnote: "本體按鈕設定模式 LED 閃 2 下，綠燈是 Normal、紅燈是 Reverse。說明書要求每次都要確認陀螺儀的動作方向",
            effect: [m("確認方式", "用手把車頭往左轉，前輪要往右打；方向相反就切換這一項")]
          },
          damperStep("damper_step_normal", "NORMAL", "綠", "5"),
          damperStep("damper_step_avcs", "AVCS", "紅", "6")
        ]
      },
      {
        id: "link",
        name: "無線基本設定",
        src: "T10PX 說明書 p.221 Gyro Link：Basic setting",
        note: "改完要在遙控器上按 [Write] 才會寫進陀螺儀。",
        items: [
          {
            id: "response_mode", name: "反應模式", en: "Response mode", type: "select", options: ["Low", "Middle", "High"],
            fnote: "陀螺儀感測器的反應設定。說明書沒有寫出廠值",
            effect: [
              m("Low → Middle → High", "反應變快"),
              m("High", "死區角度太小時伺服機會持續作動，行駛沒有問題；持續作動得太厲害就改 Middle 或 Low")
            ]
          },
          {
            id: "limit_a", name: "最大轉向角 A", en: "Limit A", type: "num", unit: "%", step: 1, start: 40,
            fnote: "畫面上有 A、B 兩個值；說明書只說左右分開調，沒有寫哪一個是左。" + NO_RANGE,
            effect: [
              m("調整方式", "打方向盤，左右分開調到輪胎不干涉擺臂的最大轉向角"),
              m("數值太小（最大轉向角沒調足）", "容易 spin"),
              m("調整中", "轉向角會放大成 1.5 倍，不是故障；調完才能行駛")
            ]
          },
          { id: "limit_b", name: "最大轉向角 B", en: "Limit B", type: "num", unit: "%", step: 1, start: 40, fnote: NO_RANGE },
          {
            id: "neutral_offset", name: "中立點偏移", en: "Neutral offset", type: "num", step: 1, start: 0, signed: true,
            fnote: "轉向伺服機的中立點在這裡調，不要用遙控器的 trim 與 sub trim。" + NO_RANGE
          },
          {
            id: "gain_mode_normal", name: "內部增益（NORMAL）", en: "Gain mode: Normal", type: "select", options: ["Standard", "High"],
            fnote: "陀螺儀內部控制增益的切換，NORMAL 與 AVCS 各有一個。選項名稱依說明書的敘述（standard gain／high gain），實際字樣請對照遙控器畫面",
            effect: [
              m("High", "靈敏度是 Standard 的 1.5 倍"),
              m("建議", "平常用 Standard；遙控器的靈敏度調到最大還不夠時才改 High")
            ]
          },
          { id: "gain_mode_avcs", name: "內部增益（AVCS）", en: "Gain mode: AVCS", type: "select", options: ["Standard", "High"], fnote: "說明同上一項" }
        ]
      },
      {
        id: "data",
        name: "陀螺儀資料",
        src: "T10PX 說明書 p.222 Gyro Link：Gyro data 1/2",
        note: "陀螺儀最多有五組資料（Gyro data 1–5），每組在 NORMAL 與 AVCS 模式各有一套數值。這一頁只記一套，請記實際在用的那一套。",
        items: [
          {
            id: "data_no", name: "記錄的是第幾組", en: "Gyro data 1–5", type: "select", options: ["1", "2", "3", "4", "5"],
            fnote: "行駛中可以用遙控器的按鍵、旋鈕或 Condition 切換。不走 S.BUS 連接時只有 Gyro data 1"
          },
          {
            id: "data_mode", name: "記錄的是哪個模式", en: "AVCS／NORMAL", type: "select", options: ["NORMAL", "AVCS"],
            effect: [
              m("NORMAL", "車手自己反打，方向盤往轉彎的反方向打"),
              m("AVCS", "陀螺儀主動反打，車手往轉彎的方向打；陀螺儀的控制比較強")
            ]
          },
          {
            id: "damper", name: "Damper", en: "Damper", type: "num", step: 1, start: 30,
            fnote: "抑制 hunting。" + NO_RANGE,
            effect: [m("數值加大", "抑制 hunting 的效果變強，但會覺得伺服機反應變差")]
          },
          {
            id: "damper_point", name: "Damper 作用點", en: "Damper point", type: "num", step: 1, start: 10,
            fnote: "調整 Damper 對伺服機反應的影響。" + NO_RANGE,
            effect: [
              m("數值調小", "Damper 的影響變強，伺服機速度變慢"),
              m("數值調大", "Damper 比較慢才作用、反應變好，但比較容易 hunting")
            ]
          },
          {
            id: "steer_gain", name: "方向盤介入比例", en: "Steering control gain", type: "num", step: 1, start: 30,
            fnote: "方向盤操作對陀螺儀控制的介入比例。" + NO_RANGE,
            effect: [m("數值加大", "車手的方向盤操作反映得比較多，轉向反應感覺變快")]
          },
          {
            id: "tail_slide", name: "甩尾速度", en: "Tail slide speed", type: "num", step: 1, start: 120,
            fnote: "行駛中甩動車尾的速度，用來調整打方向盤時的甩尾量。" + NO_RANGE,
            effect: [
              m("數值調小", "甩尾速度變慢"),
              m("數值加大", "甩尾速度變快")
            ]
          },
          {
            id: "speed_turn", name: "轉向速度（打出去）", en: "Steering speed: Turn", type: "num", step: 1, start: 100,
            fnote: "方向盤操作時的伺服機速度，和遙控器的 Servo speed 是同一種功能。" + NO_RANGE,
            effect: [m("數值調小", "伺服機速度變慢")]
          },
          { id: "speed_return", name: "轉向速度（回中）", en: "Steering speed: Return", type: "num", step: 1, start: 100, fnote: NO_RANGE }
        ]
      },
      {
        id: "curve",
        name: "轉向增益曲線",
        src: "T10PX 說明書 p.222 Gyro Link：Gyro data 2/2 Steering gain curve",
        charts: [{ name: "增益曲線", after: "curve_8", uses: CURVE_IDS, build: curveChart }],
        items: [1, 2, 3, 4, 5, 6, 7, 8].map(curvePoint)
      }
    ]
  });
})();
