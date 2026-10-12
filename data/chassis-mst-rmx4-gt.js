/*
 * 車架：MST RMX 4 GT（532219R／BK）
 *
 * 欄位與原廠值來源（都在 manuals 清單裡）：
 *   - 說明書 A／B（共 36 頁），原廠設定值在第 30 頁「SETUP SHEET - ORIGINAL SETTING」
 *   - 變更說明 Updated Instruction：修正了部分數值，本檔 factory 以變更說明為準，原值寫在 fnote
 *
 * effect 每一筆的來源：
 *   m(...) 說明書原文有寫的特性
 *   g(...) RWD 甩尾車通用調校原則，說明書沒有寫
 */
(function () {
  "use strict";

  function g(when, then) { return { w: when, t: then }; }
  function m(when, then) { return { w: when, t: then, manual: true }; }

  var BASE = "https://www.rc-mst.com/_upload/down_item_img/";

  var FX_TRACK_F = [
    g("加厚／加大", "前輪距變寬：前端較穩、側傾小；scrub 半徑變大，轉向手感變重、打到底時輪胎掃掠範圍變大，容易磨到車殼"),
    g("減少", "前輪距變窄：轉向輕快、反應直接，前端較敏感")
  ];
  var FX_TRACK_R = [
    g("加厚／加大", "後輪距變寬：車尾穩定、側傾小，甩尾中較黏"),
    g("減少", "後輪距變窄：車尾靈活、容易轉動，較不穩")
  ];

  var FX_FSM_POS = [
    g("F、R 同時加大", "下擺臂內側支點外移，前輪距變寬（外傾角要重調）"),
    g("F、R 數值不同", "插銷在俯視角變斜，下擺臂掃掠角與輪軸前後位置改變，懸吊作動時的前束變化也會不同；一般先用前後同值")
  ];
  var FX_FSM_DIR = [
    g("插銷（內側支點）越高", "前側傾中心升高：車頭側傾變小、反應直接，前輪抓地感下降"),
    g("插銷越低", "前側傾中心降低：側傾變大、前輪抓地感增加、反應較柔")
  ];
  var FX_FSM_SPACER = [
    g("F、R 同時加墊片", "內側支點整體升高，前側傾中心升高：車頭側傾變小、反應直接"),
    g("只墊 F（前高後低）", "Kick-up：過顛簸吸收較好，煞車時點頭較多"),
    g("只墊 R（後高前低）", "Anti-dive：煞車與收油時點頭少、轉向反應較銳利，過顛簸較硬")
  ];
  var NOTE_DIR = "△／▽ 是設定表上的安裝方向記號。哪個方向插銷較高，說明書沒有文字說明，請對照實物。";

  var FX_RSM_POS = [
    g("R 刻度減 F 刻度的差越大", "後束（Toe-in）越大，特性見「後束」；原廠 +13.0 與 +12.0 對應 Toe-in 1°"),
    g("F、R 同時加大", "後輪距變寬：車尾穩定")
  ];
  var FX_RSM_HEIGHT = [
    g("F 支點高於 R（Anti-squat 增加）", "加速時車尾不易下沉，油門反應直接、起步牽引強；顛簸路面與收油時車尾較跳"),
    g("F 支點低於或等於 R（Anti-squat 減少）", "加速時車尾下沉多、重量平順移到後輪，牽引感綿密好控，反應較慢"),
    g("F、R 同時升高", "後側傾中心升高：車尾側傾小、反應快、較容易滑動"),
    g("F、R 同時降低", "後側傾中心降低：側傾增加、後輪抓地感增加")
  ];

  function damper(pre, zh, f) {
    var front = pre === "fd";
    return {
      id: pre,
      name: zh + "避震",
      src: "設定表 p.30／說明書 p.24、p.25",
      items: [
        {
          id: pre + "_oil", name: "避震油", en: "Shock oil", type: "num", prefix: "#", step: 5, min: 0, factory: f.oil,
          effect: [
            g("油號加大（越稠）", "阻尼變大：重量轉移變慢、車身動作穩定，反應較鈍"),
            g("油號減小（越稀）", "阻尼變小：動作快、路感多，車身容易晃")
          ]
        },
        {
          id: pre + "_spring_len", name: "彈簧長度", en: "Spring", type: "num", step: 1, min: 0, unit: "mm", factory: f.len,
          fnote: "原廠彈簧：DK-RWD Competition Drift Spring（" + f.len + " mm，" + f.color + "）",
          effect: [g("換不同長度", "同樣調整環位置下預壓與車高會改變，換完要重調車高")]
        },
        { id: pre + "_spring_wire", name: "彈簧線徑", en: "Spring", type: "num", step: 0.1, min: 0, unit: "mm", factory: f.wire,
          effect: [
            g("線徑越粗（越硬）", front
              ? "車頭反應快、側傾與點頭少；前輪抓地感下降，容易推頭"
              : "車尾反應快、側傾與蹲尾少；後輪抓地感下降，車尾容易滑出"),
            g("線徑越細（越軟）", front
              ? "前輪抓地感增加、轉向咬；重量轉移多、動作大、反應慢"
              : "後輪抓地與牽引增加、加速時車尾下沉多；動作大、反應慢")
          ]
        },
        { id: pre + "_spring_color", name: "彈簧顏色", en: "Spring color", type: "text", factory: f.color,
          effect: [g("記錄用", "用顏色辨識彈簧硬度，特性見「彈簧線徑」")] },
        {
          id: pre + "_piston_dia", name: "活塞孔徑", en: "Piston", type: "num", digits: 1, step: 0.1, min: 0, unit: "mm", factory: f.pdia,
          effect: [
            g("孔徑越小", "阻尼變大，快速作動時特別明顯：重量轉移慢、車身穩"),
            g("孔徑越大", "阻尼變小：避震作動快、較能跟隨路面")
          ]
        },
        {
          id: pre + "_piston_holes", name: "活塞孔數", en: "Piston hole", type: "num", step: 1, min: 1, unit: "孔", factory: f.pholes,
          effect: [
            g("孔數越少", "阻尼變大，特性同孔徑變小"),
            g("孔數越多", "阻尼變小，特性同孔徑變大")
          ]
        },
        {
          id: pre + "_retainer", name: "彈簧調整環位置", en: "Spring retainer", type: "num", step: 0.5, min: 0, unit: "mm", factory: f.ret,
          fnote: "說明書 p.25 圖示的調整環間距；目的是調出原廠車高（" + (front ? "前 9" : "後 5") + " mm）",
          effect: [
            g("調整環往下鎖", "車高升高（改的是車高，不是彈簧硬度）"),
            g("調整環往上退", "車高降低")
          ]
        },
        {
          id: pre + "_upper_end", name: "上端可調長度", en: "Adjustable shock upper end", type: "num", step: 0.5, min: 0, max: 3, unit: "mm", factory: "0",
          fnote: "說明書 p.25：可調範圍 0 ~ 3 mm",
          effect: [
            g("加長", "避震總長增加、下垂量（droop）變多：重量轉移幅度大、輪子伸展時仍貼地，抓地感增加、動作變大"),
            g("縮短", "下垂量變少：反應快、側傾受限，車身動作小")
          ]
        },
        {
          id: pre + "_lower_end", name: "下端拉桿型式", en: "Damper adjuster", type: "select", options: ["1", "3"], factory: "1",
          fnote: "設定表有「1」「3」兩種，原廠用「1」（說明書 p.24 標示 Damper adjuster+1）",
          effect: [g("換成較長的型式", "避震總長增加，特性同「上端可調長度」加長")]
        },
        {
          id: pre + "_rod_len", name: "避震軸露出長度", en: "Damper adjuster", type: "num", step: 0.5, min: 0, unit: "mm", factory: "12.5",
          fnote: "說明書 p.24：下蓋到拉桿的組裝基準 12.5 mm",
          effect: [g("改變長度", "避震總長跟著改變，影響下垂量與車高，四支要一致")]
        },
        {
          id: pre + "_rebound", name: "封蓋時軸心下拉量", en: "Rebound", type: "num", step: 0.5, min: 0, unit: "mm", factory: "4",
          fnote: "說明書 p.24 步驟 7：軸心下拉 4 mm 後蓋上避震上蓋，擦掉溢出的油",
          effect: [
            g("下拉越多（回彈越大）", "避震伸展快、反應快，車身較彈"),
            g("下拉越少（回彈越小）", "作動柔順、輪子較貼地，反應較慢")
          ]
        }
      ]
    };
  }

  (window.RC_PRODUCTS = window.RC_PRODUCTS || []).push({
    id: "mst-rmx4-gt",
    category: "車架",
    name: "MST RMX 4 GT",
    desc: "1/10 競賽級 RWD 甩尾車架套件（532219R／BK）",
    spec: [
      "軸距 257 mm（可調 +3／-1 mm）",
      "六角對六角寬度：前 182 mm／後 168 mm（可調）",
      "驅動：RWD（MR）",
      "後傾角 7°（可調 5.5°／8.6°）",
      "外傾角 10°（可調）"
    ],
    manuals: [
      { title: "說明書 A（第 1-18 頁）", url: BASE + "202602100900382a.pdf", note: "PDF，約 13 MB" },
      { title: "說明書 B（第 19-36 頁，含原廠設定表）", url: BASE + "202602100901232a.pdf", note: "PDF，約 14 MB" },
      { title: "變更說明 Updated Instruction", url: BASE + "202608171147102a.jpg", note: "圖檔；修正多處配件與數值，組裝前先看" },
      { title: "空白設定表 Setup Sheet", url: BASE + "202608260858482a.jpg", note: "圖檔" },
      { title: "MST 官網下載頁（Support > Drift Ins > RMX 4）", url: "https://www.rc-mst.com/support.php?class_sn=2&class_sn2=71", note: "上面的連結失效時從這裡找" }
    ],
    // 總覽頁的卡片：slot 是卡片在車圖周圍的位置（t 上排、l 左欄、r 右欄、b 下排），由車頭排到車尾
    cards: [
      { id: "steering", slot: "t1", name: "轉向", groups: ["steering"], hot: ["steering"], diagram: ["top-front"],
        summary: [["拉桿", "tie_rod_len"]] },
      { id: "wheels", slot: "t2", name: "輪胎與輪框", groups: ["wheels"], hot: ["front-wheel", "rear-wheel"], diagram: ["top-front", "top-rear"],
        summary: [["前", "f_tire"]] },
      { id: "front_upright", slot: "l1", name: "前輪座", groups: ["front_upright", "front_hub"], hot: ["front-wheel"], diagram: ["front", "top-front"],
        summary: [["六角", "f_hex"], ["墊片", "f_hub_spacer"]] },
      { id: "front_damper", slot: "l2", name: "前避震", groups: ["fd"], hot: ["front-damper"], diagram: ["damper-f"],
        summary: [["油", "fd_oil"], ["彈簧", "fd_spring_color"]] },
      { id: "power", slot: "l3", name: "電池與電子", groups: ["battery", "electronics"], hot: ["battery"], diagram: ["side"],
        summary: [["電池", "battery_type"]] },
      { id: "rear_damper", slot: "l4", name: "後避震", groups: ["rd"], hot: ["rear-damper"], diagram: ["damper-r"],
        summary: [["油", "rd_oil"], ["彈簧", "rd_spring_color"]] },
      { id: "rear_upright", slot: "l5", name: "後輪座", groups: ["rear_upright"], hot: ["rear-wheel"], diagram: ["rear"],
        summary: [["六角", "r_hex"], ["墊片", "ru_spacer"]] },
      { id: "front_sus", slot: "r1", name: "前懸吊", groups: ["front_sus", "caster"], hot: ["front-arm"], diagram: ["front", "top-front", "side"],
        summary: [["外傾", "f_camber"], ["前束", "f_toe"]] },
      { id: "front_mount", slot: "r2", name: "前擺臂座", groups: ["front_mount"], hot: ["front-arm"], diagram: ["front", "top-front"],
        summary: [["F", "fsm_f_pos"], ["R", "fsm_r_pos"]] },
      // 全車拉桿：把分散在轉向、前懸吊、後懸吊的拉桿長度集中在一張卡片，和原卡片裡的是同一個欄位
      { id: "links", slot: "r3", name: "全車拉桿", diagram: ["links"],
        items: ["tie_rod_len", "servo_link_len", "f_upper_arm_gap", "f_lower_arm_len", "r_upper_link_gap", "r_lower_arm_len"],
        summary: [["轉向", "tie_rod_len"], ["後上", "r_upper_link_gap"]] },
      { id: "rear_sus", slot: "r4", name: "後懸吊", groups: ["rear_sus"], hot: ["rear-arm"], diagram: ["rear", "top-rear"],
        summary: [["外傾", "r_camber"], ["後束", "r_toe"]] },
      { id: "rear_mount", slot: "r5", name: "後擺臂座", groups: ["rear_mount"], hot: ["rear-arm"], diagram: ["rear", "top-rear"],
        summary: [["F", "rsm_f_pos"], ["R", "rsm_r_pos"]] },
      { id: "drivetrain", slot: "b1", name: "傳動與馬達", groups: ["drivetrain"], hot: ["drive"], diagram: ["gear", "side"],
        summary: [["齒比", "final_ratio"]] },
      { id: "rear_diff", slot: "b2", name: "後差速器", groups: ["rear_diff"], hot: ["diff"], diagram: ["top-rear"],
        summary: [["油", "diff_oil"]] },
      // 沒有 slot 的卡片排在車圖下方
      { id: "info", name: "基本資料", groups: ["info"],
        summary: [["場地", "track"], ["地面", "surface"]] }
    ],
    // 把欄位值換成示意圖（js/diagram.js）的參數。v 是 { 欄位 id: 字串 }，生效值與原廠值各算一次
    derive: function (v) {
      function n(id) { var x = parseFloat(v[id]); return isFinite(x) ? x : null; }
      function d(id, base) { var x = n(id); return x == null ? 0 : x - base; }   // 和原廠基準的差
      function shock(pre) {
        return {
          oil: v[pre + "_oil"], len: n(pre + "_spring_len"), wire: n(pre + "_spring_wire"), color: v[pre + "_spring_color"],
          pistonDia: v[pre + "_piston_dia"], pistonHoles: v[pre + "_piston_holes"],
          retainer: n(pre + "_retainer"), upper: n(pre + "_upper_end"), lower: v[pre + "_lower_end"]
        };
      }
      var mode = /MODE (\d)/.exec(v.motor_mode || "");
      return {
        fToe: n("f_toe"), rToe: n("r_toe"), fCamber: n("f_camber"), rCamber: n("r_camber"), caster: n("caster"),
        fHeight: n("f_ride_height"), rHeight: n("r_ride_height"),
        // 輪距與軸距是推算值：以封面規格為基準，加上各調整項和原廠值的差
        fTrack: 182 + 2 * (d("f_hub_spacer", 0) + d("f_hex", 6) + d("f_offset", 7) + d("f_lower_arm_len", 13) +
          (d("fsm_f_pos", 4) + d("fsm_r_pos", 4)) / 2),
        rTrack: 168 + 2 * (d("r_hex", 4) + d("r_offset", 5) + (d("rsm_f_pos", 12) + d("rsm_r_pos", 13)) / 2),
        wheelbase: 257 + d("r_arm_shim_front", 1) - d("f_arm_shim_front", 2),
        fMount: ((n("fsm_f_spacer") || 0) + (n("fsm_r_spacer") || 0)) / 2,
        rMount: ((n("rsm_f_spacer") || 0) + (n("rsm_r_spacer") || 0)) / 2,
        fTopSpacer: n("fu_top_spacer"), rTopSpacer: n("ru_spacer"),
        fDamperBall: n("f_damper_ball_spacer"), rDamperBall: n("r_damper_ball_spacer"),
        motorMode: mode ? Number(mode[1]) : null,
        batteryThin: v.battery_type ? v.battery_type.indexOf("薄") === 0 : null,
        escHigh: v.esc_pos ? v.esc_pos.indexOf("後") === 0 : null,
        fd: shock("fd"), rd: shock("rd"),
        links: {
          tie: n("tie_rod_len"), servo: n("servo_link_len"), fUpper: n("f_upper_arm_gap"), fLower: n("f_lower_arm_len"),
          rUpper: n("r_upper_link_gap"), rLower: n("r_lower_arm_len")
        },
        spur: n("spur"), pinion: n("pinion"), ratio: v.final_ratio, gearMode: v.gear_mode
      };
    },
    notes: [
      "原廠值出自說明書第 30 頁的原廠設定表，場地 MST Station、地面 Plastic tiles（塑膠地磚）。",
      "變更說明修正了部分數值，這裡的原廠值以變更說明為準，原值寫在該項的備註。",
      "特性標「說明書」的是說明書原文；標「一般原則」的是 RWD 甩尾車通用調校原則，說明書沒有寫，實際感受會隨場地、輪胎、陀螺儀而不同，建議一次只改一項驗證。"
    ],
    groups: [
      {
        id: "info",
        name: "基本資料",
        src: "設定表 p.30 表頭",
        items: [
          { id: "date", name: "日期", en: "Date", type: "text" },
          { id: "track", name: "場地", en: "Track", type: "text", fnote: "原廠設定的場地：MST Station" },
          { id: "surface", name: "地面", en: "Surface", type: "text", fnote: "原廠設定的地面：Plastic tiles（塑膠地磚）" },
          { id: "note", name: "備註", en: "Note", type: "text" }
        ]
      },
      {
        id: "wheels",
        name: "輪胎與輪框",
        src: "設定表 p.30",
        items: [
          {
            id: "f_tire", name: "前輪胎", en: "Front tire", type: "text", factory: "PST-F",
            fnote: "輪胎與輪框不含在套件內；依場地地面選配方",
            effect: [
              g("前胎相對後胎越抓", "轉向反應銳利、車頭指向性強，車尾容易被帶出、角度來得快"),
              g("前胎相對後胎越滑", "車頭容易往外推、轉向變鈍，車尾相對穩定")
            ]
          },
          { id: "f_wheel", name: "前輪框", en: "Front wheel", type: "text", factory: "TE37" },
          { id: "f_offset", name: "前輪框 Offset", en: "Front offset", type: "num", signed: true, step: 1, unit: "mm", factory: "7", effect: FX_TRACK_F },
          {
            id: "r_tire", viz: "top-rear", name: "後輪胎", en: "Rear tire", type: "text", factory: "PST-R",
            effect: [
              g("後胎相對越抓", "前進牽引力強、車速快、車尾穩；需要更多動力與角度才甩得動"),
              g("後胎相對越滑", "車尾容易滑出、角度大；推進力與車速下降，容易 spin")
            ]
          },
          { id: "r_wheel", viz: "top-rear", name: "後輪框", en: "Rear wheel", type: "text", factory: "TE37" },
          { id: "r_offset", viz: "top-rear", name: "後輪框 Offset", en: "Rear offset", type: "num", signed: true, step: 1, unit: "mm", factory: "5", effect: FX_TRACK_R }
        ]
      },
      {
        id: "steering",
        name: "轉向",
        src: "設定表 p.30／說明書 p.7、p.19、p.20／變更說明",
        items: [
          {
            id: "steer_connecter_spacer", name: "轉向搖臂連接架球頭墊片", en: "Steering arm connecter", type: "num", step: 0.5, min: 0, unit: "mm", factory: "1",
            fnote: "設定表原值 2 mm；變更說明把這裡的墊片改成 3×5.5×1（1 mm）",
            effect: [
              g("加減墊片", "改變轉向拉桿內側球頭的位置，等於改變阿克曼（Ackermann，內外輪轉角差）與拉桿角度；改完要重新量前束"),
              g("阿克曼越多（內輪比外輪轉得多）", "入彎與左右切換靈敏、前輪拉力感強；大角度時前輪阻力大，車速容易掉"),
              g("阿克曼越少（內外輪接近平行）", "大角度時滑順、車速容易維持、線條較大；初段轉向反應較鈍")
            ],
            note: "墊片加厚是增加還是減少阿克曼，說明書沒有寫。改完把方向打到底，看內外輪的角度差確認。"
          },
          {
            id: "tie_rod_len", part: "tie", name: "轉向拉桿長度", en: "Steering adjuster", type: "num", step: 0.1, min: 0, unit: "mm", factory: "15.6",
            fnote: "說明書 p.7 原值 15.8 mm；變更說明：內附塑膠 ATK V3 輪座用 15.6 mm，鋁合金 ATK V3 輪座用 15.5 mm。左右相同，用卡尺量",
            effect: [g("調整長度", "決定前束角度，特性見「前束（Toe-out）」；左右長度不同會讓中立點偏移、左右轉角不對稱")]
          },
          {
            id: "steer_armB_hole", name: "轉向搖臂 B 球頭孔位", en: "Steering arm B", type: "text", factory: "紅點孔位",
            fnote: "說明書 p.7 步驟 1 圖中紅點標示的孔位，是伺服拉桿的接點",
            effect: [
              g("球頭離搖臂轉軸越遠", "同樣的伺服行程下轉向變慢、變細膩，伺服負擔輕；最大轉角可能減少"),
              g("球頭離搖臂轉軸越近", "轉向變快、轉角變大；伺服負擔重、手感較敏感")
            ]
          },
          {
            id: "servo_horn_hole", name: "伺服擺臂孔位", en: "Long servo horn", type: "select", options: ["21.5", "17.5"], unit: "mm", factory: "21.5",
            fnote: "說明書 p.19 圖示球頭鎖在外側孔；擺臂與伺服機身夾角要 ≤90°",
            effect: [
              g("21.5（外孔）", "轉向快、行程大，需要較大的伺服扭力"),
              g("17.5（內孔）", "轉向較慢較細、解析度高、伺服出力餘裕大；最大轉角可能不足")
            ]
          },
          {
            id: "servo_link_len", part: "servo", name: "伺服拉桿長度", en: "Servo saver turnbuckle M3×68", type: "num", step: 0.5, min: 0, unit: "mm",
            fnote: "說明書 p.20 沒有給數值",
            effect: [m("調整長度", "依伺服機規格調整長度，並對正轉向中立點；這不是操控調整項，長度不對會左右轉角不對稱")]
          },
          {
            id: "servo_saver_mount", name: "伺服緩衝座齒數", en: "Servo saver mount", type: "select",
            options: ["23T", "25T"],
            fnote: "說明書 p.19：依伺服機廠牌選用，23T 是 SANWA／KO，25T 是 FUTABA／SAVOX",
            effect: [m("23T／25T", "配合伺服機出力軸齒數選用，沒有操控特性差異")]
          }
        ]
      },
      {
        id: "caster",
        name: "後傾角",
        src: "設定表 p.30／封面規格",
        items: [
          {
            id: "caster", viz: "side", name: "後傾角（前上擺臂座）", en: "Caster angle - FR upper arm mount", type: "select",
            options: ["8.6°", "7°", "5.5°"], factory: "7°",
            fnote: "由前上擺臂座的安裝位置三選一",
            effect: [
              g("加大（8.6°）", "回正力強、甩尾中自動反打來得快；打方向時外側前輪外傾增加，大角度時前輪咬地較好；轉向手感較重、初段反應較鈍"),
              g("減小（5.5°）", "轉向輕快、初段靈敏、左右切換快；回正力弱，大角度時前輪支撐較少、容易轉過頭")
            ]
          }
        ]
      },
      {
        id: "front_upright",
        name: "前輪座（ATK V3）",
        src: "設定表 p.30／說明書 p.21",
        items: [
          {
            id: "fu_top_spacer", name: "上球頭墊片", en: "Front upright - top", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0",
            effect: [
              g("加墊片（上球頭升高）", "上擺臂角度變大：壓縮時外傾變化量變大、前側傾中心升高，車頭側傾變小、反應較直接"),
              g("減少", "側傾變大、前輪抓地感較多、反應較柔")
            ]
          },
          {
            id: "fu_steer_spacer", name: "轉向臂球頭墊片", en: "Front upright - steering arm", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0",
            effect: [
              g("加減墊片", "改變拉桿外側球頭高度，影響 bump steer（懸吊上下作動時前束的變化量）"),
              g("拉桿與下擺臂越接近平行", "懸吊作動時前束變化小，過起伏與重量轉移時方向穩定"),
              g("刻意不平行", "壓縮時前束會改變，可用來微調入彎瞬間的反應，但車子較難預測")
            ]
          },
          {
            id: "fu_bottom_spacer", name: "下球頭墊片", en: "Front upright - bottom", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0",
            effect: [
              g("加墊片", "下球頭離輪軸更遠，等於輪軸相對擺臂升高：同樣避震設定下車頭變低，下擺臂角度與前側傾中心跟著改變，改完要重調車高"),
              g("減少", "相反，車頭變高")
            ]
          },
          {
            id: "fu_knuckle_hole", name: "轉向臂孔位", en: "Front upright L／R", type: "select",
            options: ["孔 A", "孔 B"], factory: "孔 A",
            fnote: "左右輪座的轉向臂各有 2 個孔；孔 A 是設定表以灰色標出的原廠孔，左右相同",
            effect: [
              g("換到力臂較短的孔（離主銷近）", "同樣拉桿行程下轉角大、轉向快，最大角度增加；阿克曼特性也會跟著改變"),
              g("換到力臂較長的孔（離主銷遠）", "轉向較慢較穩，最大角度減少")
            ],
            note: "兩孔哪一個力臂較短，請對照實物；換孔後要重新量前束與左右轉角。"
          }
        ]
      },
      {
        id: "front_hub",
        name: "前輪六角座",
        src: "設定表 p.30／說明書 p.21、p.28／變更說明",
        items: [
          {
            id: "f_hub_spacer", name: "前輪座墊片", en: "Front wheel hubs", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0",
            fnote: "設定表原值 1 mm（說明書 p.28 原本註明 Wheel hub spacer 1.0 一定要裝）；變更說明改為「此墊片不安裝」",
            effect: FX_TRACK_F
          },
          {
            id: "f_hex", name: "前六角輪座厚度", en: "Alum. wheel hubs", type: "num", step: 1, min: 0, unit: "mm", factory: "6",
            fnote: "說明書 p.21：鋁合金六角輪座 6 mm", effect: FX_TRACK_F
          }
        ]
      },
      {
        id: "front_sus",
        name: "前懸吊",
        src: "設定表 p.30／說明書 p.5、p.8、p.29／變更說明",
        items: [
          {
            id: "f_camber", viz: "front", name: "前外傾角", en: "Camber", type: "num", step: 0.5, min: 0, unit: "°", factory: "10",
            fnote: "用前上擺臂拉桿長度調整",
            effect: [
              g("加大", "大轉向角時外側前輪胎面貼地較好，甩尾中車頭側向抓地與指向性增加；直線與小轉角時接地面積變小，直線穩定與煞車較差"),
              g("減小", "直線接地多、初段轉向較直接；大角度時前輪容易失去側向抓地，車頭往外推")
            ]
          },
          {
            id: "f_upper_arm_gap", part: "fUpper", name: "前上擺臂拉桿露出長度", en: "Front upper arm", type: "num", step: 0.1, min: 0, unit: "mm", factory: "4",
            fnote: "說明書 p.8：拉桿頭與擺臂之間 4 mm（從螺牙端量是 14 mm）；無法精確量測時可用 3×5.5×4 鋁墊片代替",
            effect: [
              g("加長", "上擺臂變長，前外傾角減小"),
              g("縮短", "前外傾角加大")
            ]
          },
          {
            id: "f_toe", viz: "top-front", name: "前束（Toe-out）", en: "Toe-out", type: "num", step: 0.1, unit: "°", factory: "2.4",
            fnote: "設定表原值 3°；變更說明改為 2.4°。用轉向拉桿長度調整",
            effect: [
              g("Toe-out 加大", "入彎與左右切換反應快、初段靈敏；直線較神經質、滾動阻力增加"),
              g("Toe-out 減小（趨近 0）", "直線穩定、甩尾中較平順；轉向初段較鈍")
            ]
          },
          {
            id: "f_lower_arm_len", part: "fLower", name: "前下擺臂拉桿頭露出長度", en: "Front lower arm", type: "num", step: 0.1, min: 0, unit: "mm", factory: "13",
            fnote: "說明書 p.5",
            effect: [
              g("加長", "下擺臂變長、前輪距變寬，外傾角同時加大（要一併調上擺臂）；前端較穩、反應較慢"),
              g("縮短", "前輪距變窄，轉向反應快、較敏感")
            ]
          },
          {
            id: "f_damper_ball_spacer", name: "前避震上固定球頭墊片", en: "Front damper stay", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0",
            fnote: "組裝基準：球頭與避震架的間距 3.5 mm（說明書 p.8）",
            effect: [
              g("球頭往外（避震越直立）", "避震作用直接、等效變硬：反應快、側傾小"),
              g("球頭往內（避震越斜）", "等效變軟：側向抓地感增加，動作較柔、反應較慢")
            ]
          },
          {
            id: "f_ride_height", viz: "front", name: "前車高", en: "Ride height", type: "num", step: 0.5, min: 0, unit: "mm", factory: "9",
            fnote: "裝好電子設備與車殼後的最終車高；用避震彈簧調整環調整",
            effect: [
              m("偏離 9 mm", "前車高 9 mm 是原廠阿克曼設定所需的高度，下場前要確認；太高或太低用避震調整環調回"),
              g("提高", "重心升高、重量轉移與側傾變大：抓地感增加、反應變慢"),
              g("降低", "反應快、側傾小；過低會托底"),
              g("前高後低（原廠前 9／後 5）", "靜態重量偏向後輪，有助後輪牽引")
            ]
          }
        ]
      },
      {
        id: "front_mount",
        name: "前下擺臂座（Rollcenter）",
        src: "設定表 p.30／說明書 p.5",
        items: [
          { id: "fsm_f_pos", viz: "top-front", name: "前座（F）刻度", en: "Suspension mount F", type: "num", signed: true, digits: 1, step: 0.5, min: 3.5, max: 5, factory: "4.0", effect: FX_FSM_POS },
          { id: "fsm_f_dir", name: "前座（F）方向", en: "Suspension mount F", type: "select", options: ["△", "▽"], factory: "▽", effect: FX_FSM_DIR, note: NOTE_DIR },
          { id: "fsm_f_spacer", name: "前座（F）下墊片", en: "Suspension mount F", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0", effect: FX_FSM_SPACER },
          { id: "fsm_r_pos", viz: "top-front", name: "後座（R）刻度", en: "Suspension mount R", type: "num", signed: true, digits: 1, step: 0.5, min: 3.5, max: 5, factory: "4.0", effect: FX_FSM_POS },
          { id: "fsm_r_dir", name: "後座（R）方向", en: "Suspension mount R", type: "select", options: ["△", "▽"], factory: "▽", effect: FX_FSM_DIR, note: NOTE_DIR },
          { id: "fsm_r_spacer", name: "後座（R）下墊片", en: "Suspension mount R", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0", effect: FX_FSM_SPACER },
          {
            id: "f_arm_shim_front", name: "前下擺臂前側墊片", en: "2.5×5.5×2 Spacer", type: "num", step: 0.5, min: 0, unit: "mm", factory: "2",
            fnote: "說明書 p.5：擺臂前後各一片 2.5×5.5×2",
            effect: [
              g("前薄後厚（擺臂往前）", "前輪軸前移、軸距變長：直線與大角度穩定，轉向反應變慢"),
              g("前厚後薄（擺臂往後）", "軸距變短：轉向靈活、切換快，較敏感")
            ],
            note: "說明書沒有把前擺臂墊片列為調整項，這一項是依零件配置整理的。"
          },
          {
            id: "f_arm_shim_rear", name: "前下擺臂後側墊片", en: "2.5×5.5×2 Spacer", type: "num", step: 0.5, min: 0, unit: "mm", factory: "2",
            effect: [g("與前側墊片搭配", "前後墊片總厚度不變，只改分配，特性見「前下擺臂前側墊片」")]
          }
        ]
      },
      {
        id: "rear_sus",
        name: "後懸吊",
        src: "設定表 p.30／說明書 p.15、p.16、p.17",
        items: [
          {
            id: "r_camber", viz: "rear", name: "後外傾角", en: "Camber", type: "num", step: 0.5, min: 0, unit: "°", factory: "2",
            fnote: "用後上拉桿長度調整",
            effect: [
              g("加大", "甩尾側滑時外側後輪貼地較好、側向支撐增加；接地面積變小，直線加速牽引下降"),
              g("減小（趨近 0）", "接地面積大、前進牽引與推進力強；側向支撐少，角度深時車尾較滑")
            ]
          },
          {
            id: "r_upper_link_gap", part: "rUpper", name: "後上拉桿露出長度", en: "Rear upper turnbuckle", type: "num", step: 0.1, min: 0, unit: "mm", factory: "20",
            fnote: "說明書 p.15：左右相同，用卡尺量",
            effect: [
              g("加長", "後外傾角減小"),
              g("縮短", "後外傾角加大")
            ]
          },
          {
            id: "r_toe", viz: "top-rear", name: "後束（Toe-in）", en: "Toe-in", type: "num", step: 0.5, unit: "°", factory: "1",
            fnote: "由後下擺臂座 F／R 的刻度差決定（原廠 +12.0／+13.0）",
            effect: [
              g("Toe-in 加大", "後輪牽引與直線、出彎穩定性增加，車尾不容易甩出；較難起甩、滾動阻力增加"),
              g("Toe-in 減小", "車尾靈活、容易起甩、切換快；穩定性下降，容易 spin")
            ]
          },
          {
            id: "r_damper_ball_spacer", name: "後避震上固定球頭墊片", en: "Rear damper stay", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0",
            fnote: "組裝基準：球頭與避震架的間距 4 mm（說明書 p.16）",
            effect: [
              g("球頭往外（避震越直立）", "避震作用直接、等效變硬：車尾反應快、側傾小"),
              g("球頭往內（避震越斜）", "等效變軟：後輪側向抓地感增加，動作較柔")
            ]
          },
          {
            id: "r_ride_height", viz: "rear", name: "後車高", en: "Ride height", type: "num", step: 0.5, min: 0, unit: "mm", factory: "5",
            fnote: "裝好電子設備與車殼後的最終車高；用避震彈簧調整環調整",
            effect: [
              g("提高", "後段重心升高、重量轉移變大：後輪抓地感增加，車尾動作變大"),
              g("降低", "車尾反應快、側傾小；過低會托底")
            ]
          },
          {
            id: "r_lower_arm_len", part: "rLower", name: "後下擺臂長度（THA）", en: "THA rear lower arm", type: "num", step: 0.5, min: 41, max: 55, unit: "mm",
            fnote: "擺臂上有刻度，可調 41 ~ 55 mm；說明書 p.17 沒有標示原廠長度",
            effect: [
              g("加長", "後輪距變寬：車尾穩定、側傾小"),
              g("縮短", "後輪距變窄：車尾靈活、容易轉動，較不穩")
            ],
            note: "改完長度後，後外傾角與後束要重新量。"
          },
          {
            id: "r_arm_shock_hole", name: "後下擺臂避震固定孔", en: "Rear lower arm B", type: "select", options: ["外孔", "中孔", "內孔"],
            fnote: "後下擺臂 B 上有 3 個孔（說明書 p.17），原廠孔位沒有文字標示，請對照圖",
            effect: [
              g("越靠外側", "避震槓桿比高、等效變硬：反應直接、側傾小"),
              g("越靠內側", "等效變軟、輪子行程相對避震行程變大：抓地感增加、動作較大")
            ]
          },
          {
            id: "r_arm_shim_front", name: "後下擺臂前側墊片", en: "2.5×5.5×1 Spacer", type: "num", step: 0.5, min: 0, unit: "mm", factory: "1",
            fnote: "說明書 p.17：前側 2.5×5.5×1、後側 2.5×5.5×3",
            effect: [
              g("前厚後薄（擺臂往後）", "後輪軸後移、軸距變長：直線與大角度穩定、動作平順，轉向反應變慢"),
              g("前薄後厚（擺臂往前）", "軸距變短：迴轉靈活、切換快，較敏感")
            ],
            note: "封面規格的軸距 257 mm 可調 +3／-1 mm，和原廠前 1／後 3 mm 墊片可移動的量一致；這是依數字推算的，說明書沒有明寫。"
          },
          {
            id: "r_arm_shim_rear", name: "後下擺臂後側墊片", en: "2.5×5.5×3 Spacer", type: "num", step: 0.5, min: 0, unit: "mm", factory: "3",
            effect: [g("與前側墊片搭配", "前後墊片總厚度不變，只改分配，特性見「後下擺臂前側墊片」")]
          }
        ]
      },
      {
        id: "rear_upright",
        name: "後輪座",
        src: "設定表 p.30／說明書 p.22",
        items: [
          {
            id: "ru_hole", name: "上球頭孔位", en: "Rear upright", type: "select",
            options: ["孔 A", "孔 B"], factory: "孔 A",
            fnote: "後輪座上方有 2 個孔；孔 A 是設定表以灰色標出的原廠孔",
            effect: [
              g("換到讓後上拉桿變短的孔", "壓縮時外傾變化量大、後側傾中心較高：車尾反應快，側傾時抓地變化明顯"),
              g("換到讓後上拉桿變長的孔", "外傾變化小：後輪抓地線性、穩定")
            ],
            note: "換孔後要重調後上拉桿長度與後外傾角。"
          },
          {
            id: "ru_spacer", name: "上球頭墊片", en: "Rear upright", type: "num", step: 0.5, min: 0, unit: "mm", factory: "0",
            effect: [
              g("加墊片（球頭升高）", "後上拉桿角度變大：外傾變化量變大、後側傾中心升高，車尾側傾變小、反應快，後輪抓地感下降"),
              g("減少", "後側傾變大、後輪抓地感增加、動作較柔")
            ]
          },
          {
            id: "r_hex", name: "後六角輪座厚度", en: "Alum. wheel hubs", type: "num", step: 1, min: 0, unit: "mm", factory: "4",
            fnote: "說明書 p.22：鋁合金六角輪座 4 mm", effect: FX_TRACK_R
          }
        ]
      },
      {
        id: "rear_mount",
        name: "後下擺臂座（Rollcenter）",
        src: "設定表 p.30／說明書 p.17、p.18",
        items: [
          { id: "rsm_f_pos", viz: "top-rear", name: "前座（F）刻度", en: "Suspension mount F", type: "num", signed: true, digits: 1, step: 0.5, min: 11.5, max: 13, factory: "12.0", effect: FX_RSM_POS },
          { id: "rsm_f_dir", name: "前座（F）方向", en: "Suspension mount F", type: "select", options: ["△", "▽"], factory: "▽",
            fnote: "原廠 F 為 ▽、R 為 △，兩座方向不同", effect: FX_RSM_HEIGHT, note: NOTE_DIR },
          { id: "rsm_f_spacer", name: "前座（F）下墊片", en: "Alum. suspension mount spacer", type: "num", step: 0.5, min: 0, unit: "mm", factory: "1",
            fnote: "說明書 p.18：鋁合金擺臂座墊片 1 mm", effect: FX_RSM_HEIGHT },
          { id: "rsm_r_pos", viz: "top-rear", name: "後座（R）刻度", en: "Suspension mount R", type: "num", signed: true, digits: 1, step: 0.5, min: 11.5, max: 13, factory: "13.0", effect: FX_RSM_POS },
          { id: "rsm_r_dir", name: "後座（R）方向", en: "Suspension mount R", type: "select", options: ["△", "▽"], factory: "△",
            fnote: "原廠 F 為 ▽、R 為 △，兩座方向不同", effect: FX_RSM_HEIGHT, note: NOTE_DIR },
          { id: "rsm_r_spacer", name: "後座（R）下墊片", en: "Alum. suspension mount spacer", type: "num", step: 0.5, min: 0, unit: "mm", factory: "1",
            fnote: "說明書 p.18：鋁合金擺臂座墊片 1 mm", effect: FX_RSM_HEIGHT }
        ]
      },
      {
        id: "rear_diff",
        name: "後差速器",
        src: "設定表 p.30／說明書 p.10",
        items: [
          {
            id: "diff_type", name: "差速器型式", en: "Rear diff", type: "select",
            options: ["Gear diff.", "LSD", "Ball diff."], factory: "Gear diff.",
            fnote: "套件內附齒輪差速器；LSD 與滾珠差速器是設定表上的選項，需另購",
            effect: [
              g("越接近鎖死", "兩後輪轉速同步：推進力強、甩尾角度好維持、直線加速穩；小彎迴轉較硬，收油時容易推頭"),
              g("越鬆（差速作用多）", "入彎迴轉靈活；出彎補油時動力容易跑到內側輪，角度與車速較難維持")
            ]
          },
          {
            id: "diff_oil", name: "差速器油", en: "Diff oil", type: "num", prefix: "#", step: 500, min: 0, factory: "3000",
            fnote: "說明書 p.10：填油不要超過十字軸的位置",
            effect: [
              g("油號加大（越稠）", "越接近鎖死，特性見「差速器型式」"),
              g("油號減小（越稀）", "差速作用越多")
            ]
          }
        ]
      },
      damper("fd", "前", { oil: "10", len: "24", wire: "1.5", color: "Green", pdia: "1.0", pholes: "3", ret: "5" }),
      damper("rd", "後", { oil: "15", len: "26", wire: "1.5", color: "Silver Green", pdia: "0.8", pholes: "6", ret: "4.5" }),
      {
        id: "drivetrain",
        name: "傳動與馬達",
        src: "設定表 p.30／說明書 p.11、p.12、p.13、p.27、p.29",
        items: [
          {
            id: "gear_mode", name: "齒輪箱模式", en: "Rear gear box", type: "select",
            options: ["4 齒輪", "3 齒輪"], factory: "4 齒輪",
            fnote: "不需額外零件就能在兩種模式間轉換",
            effect: [
              m("4 齒輪（標準）", "加速時馬達反扭力向後，增加後輪牽引力，提升加速表現"),
              m("3 齒輪", "加速時馬達反扭力向前，前後較均衡，提升操控穩定性")
            ]
          },
          {
            id: "motor_mode", viz: "side", name: "馬達座位置", en: "Motor mount", type: "select",
            options: ["MODE 1", "MODE 2", "MODE 3", "MODE 4"],
            fnote: "說明書 p.27 列出四種馬達座位置，沒有標示哪一種是原廠；官網說明是用 4 段高度調整重心",
            effect: [
              g("馬達越高", "重心高：重量轉移與側傾變大，牽引與抓地感增加；動作較大、反應較慢"),
              g("馬達越低", "重心低：車身穩、反應快、側傾小；重量轉移帶來的牽引感較少"),
              m("MODE 4", "380 規格馬達用的位置")
            ]
          },
          {
            id: "spur", name: "大直齒", en: "Spur gear", type: "num", step: 1, min: 1, unit: "T", factory: "80",
            effect: [g("換齒數", "和馬達齒一起決定終傳比，特性見「馬達齒」")]
          },
          {
            id: "pinion", name: "馬達齒", en: "Pinion gear", type: "num", step: 1, min: 1, unit: "T", factory: "22",
            fnote: "說明書 p.29 齒比表（80T 大直齒）：22T 10.91／23T 10.43／24T 10.00／25T 9.60／26T 9.23／27T 8.89／28T 8.57／29T 8.28／30T 8.00／31T 7.74／32T 7.50／33T 7.27／34T 7.06／35T 6.86。換齒後要調整齒隙",
            effect: [
              g("齒數加大（終傳比數字變小）", "輪速與極速高；扭力與低速油門細膩度下降，馬達負載與溫度上升"),
              g("齒數減小（終傳比數字變大）", "加速有力、油門好控；輪速較低")
            ]
          },
          {
            id: "reduction", name: "內部減速比", en: "Reduction gear", type: "num", calc: function () { return "3.00"; },
            fnote: "差速齒 60T ÷ 主軸齒 20T = 3.00，固定值",
            effect: [g("記錄用", "計算終傳比用")]
          },
          {
            id: "final_ratio", name: "終傳比", en: "Gear ratio", type: "num",
            calc: function (v) {
              var ratio = parseFloat(v.spur) / parseFloat(v.pinion) * 3;
              return isFinite(ratio) ? ratio.toFixed(2) : "";
            },
            fnote: "自動計算：（大直齒 ÷ 馬達齒）×（差速齒 60T ÷ 主軸齒 20T）；原廠 80T／22T 是 10.91",
            effect: [g("數字越大", "加速與扭力取向；數字越小是輪速取向，特性見「馬達齒」")]
          },
          {
            id: "esc_pos", viz: "side", name: "ESC 安裝位置", en: "ESC rear mount", type: "select",
            options: ["後齒箱座", "底板"], factory: "後齒箱座",
            fnote: "說明書 p.12 步驟 2 安裝 ESC 固定座；官網說明 ESC 可選高重心或低重心位置",
            effect: [
              g("後齒箱固定座（高、靠後）", "後軸荷重與重心高度增加：後輪牽引增加、重量轉移較大"),
              g("底板（低）", "重心低：車身穩、反應快")
            ]
          }
        ]
      },
      {
        id: "battery",
        name: "電池座",
        src: "說明書 p.6",
        items: [
          {
            id: "battery_type", name: "電池型式與電池座高度", en: "Battery holder height", type: "select",
            options: ["薄型 19 mm", "一般 26 mm"],
            factory: "薄型 19 mm",
            fnote: "薄型短電池不裝增高墊片、用 M3×8 螺絲；一般型加裝增高墊片並改用 M3×14 螺絲。電池擋片不要鎖死，要能正常開關",
            effect: [
              m("薄型短電池", "說明書建議使用，可獲得更出色的運動性能"),
              g("電池越薄越輕", "重心低、慣性小：反應快、側傾小")
            ]
          }
        ]
      },
      {
        id: "electronics",
        name: "電子設備",
        src: "設定表 p.30 下方欄位",
        note: "這裡只照設定表記型號；陀螺儀、伺服機、電變、遙控器的細部設定之後在各自的分類建立。",
        items: [
          { id: "motor_esc", name: "馬達與電變", en: "Motor & ESC", type: "text" },
          { id: "battery_model", name: "電池", en: "Battery", type: "text" },
          { id: "transceiver", name: "遙控器／接收機", en: "Transceiver", type: "text" },
          { id: "gyro", name: "陀螺儀", en: "Gyro", type: "text", fnote: "說明書 p.28 圖示搭配 MST MGX 陀螺儀（841015，不含在套件內）" },
          {
            id: "gyro_sens", name: "陀螺儀感度", en: "Sensitivity", type: "num", step: 1, min: 0, max: 100, start: 50, unit: "%",
            effect: [
              g("感度加大", "自動反打修正強：直線與甩尾中穩定；過高會左右抖動（hunting）、轉向變鈍"),
              g("感度減小", "手感自然、轉向直接；需要自己修正，車尾較容易轉過頭")
            ]
          }
        ]
      }
    ]
  });
})();
