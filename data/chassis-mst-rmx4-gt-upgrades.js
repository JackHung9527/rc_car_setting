/*
 * 車架 MST RMX 4 GT 的改裝件（升級件）清單。要排在 data/chassis-mst-rmx4-gt.js 之後載入，
 * 這個檔把群組與卡片加到那個產品物件上。
 *
 * 來源：
 *   - MST「RMX 4 官方推薦全車升級件指南」（RMX 4 Vehicle Upgrade Guide，2 頁）：41 項的編號、料號、
 *     英文名稱、在車上的位置、哪些是 Designer Recommended
 *   - MST 官網 RMX 4 GT 產品頁的 OP 分頁：GT 的選配件清單；210633 只出現在這裡
 *   - RMX 4 GT 說明書 p.36 零件代碼表：用來判斷哪些升級件 GT 套件已經內含（std: true）
 *   - 各零件的官網產品頁：note 裡「官網：」開頭的說明、產品圖
 *
 * 中文名稱是照官方英文名稱翻的，官方沒有中文名稱。
 * 產品圖直接連到 MST 官網，不放進這個 repo；沒有網路時圖不會出現，其餘照常。
 */
(function () {
  "use strict";

  var product = (window.RC_PRODUCTS || []).filter(function (p) { return p.id === "mst-rmx4-gt"; })[0];
  if (!product) return;

  var SITE = "https://www.rc-mst.com/";
  var installable = [];   // GT 套件沒有內含的零件的欄位 id，用來算「已加裝幾項」

  // no：升級指南上的編號（指南沒列的寫 "—"）；page："分類/子分類/產品頁編號"；img：官網產品圖的檔名開頭
  // opt.std：GT 套件已內含；opt.pick：官方標為設計師推薦；opt.note：補充說明
  function part(no, pn, name, en, hot, page, img, opt) {
    opt = opt || {};
    var id = "up_" + pn.replace(/\D.*$/, "");
    var at = page.split("/");
    if (!opt.std) installable.push(id);
    var notes = [
      opt.std ? "GT 套件已內含（說明書 p.36 零件代碼表）" : "GT 套件沒有內含，需另購",
      opt.pick ? "官方升級指南標為設計師推薦（Designer Recommended）" : "",
      opt.note || ""
    ].filter(function (t) { return t; });
    return {
      id: id, name: name, en: en, type: "select", options: ["未裝", "已裝"], factory: opt.std ? "已裝" : "未裝",
      sub: (no === "—" ? "" : no + "｜") + pn + (opt.pick ? "｜推薦" : ""),
      hot: hot,
      img: SITE + "_upload/pro_item_img/" + img + "_s.jpg",
      link: SITE + "product_info.php?class_sn=" + at[0] + "&class_sn2=" + at[1] + "&sn=" + at[2],
      fnote: notes.join("；")
    };
  }

  var SHOCKS = ["front-damper", "rear-damper"];
  var groups = [
    {
      id: "up_info",
      name: "改裝件",
      note: "「已裝」預設是 GT 套件出廠的狀態；加裝或換掉之後改這裡，卡片上會標出和出廠不同的項目。點零件名稱看說明、官方產品頁，以及它在車上的位置。",
      items: [
        {
          id: "up_count", name: "已加裝的改裝件", type: "num", unit: "項",
          calc: function (v) { return installable.filter(function (id) { return v[id] === "已裝"; }).length; },
          fnote: "只算 GT 套件沒有內含的零件"
        }
      ]
    },
    {
      id: "up_front",
      name: "前懸吊與車頭",
      items: [
        part("01", "210709R／BK", "鋁合金前避震架", "Alum. front damper stay", ["front-damper"], "15/41/4206", "202601150126081",
          { note: "官網：高剛性鋁合金結構，避震回饋更直接；建議搭配 210710R／BK" }),
        part("09", "210710R／BK", "鋁合金車頭座", "Alum. head mount", ["bumper"], "15/41/4207", "202601150130281",
          { note: "官網：高剛性鋁合金，補強車頭整體剛性" }),
        part("39", "210736R／BK", "碳纖維輕量化車頭座", "RMX 4 Carbon lightweight front head mount", ["bumper"], "15/41/4189", "202510231109261",
          { std: true, pick: true }),
        part("07", "820143R／BK", "可調鋁合金前下擺臂座 +3.5～+5.0", "Adjustable alum. suspension mount (+3.5~+5.0)", ["front-arm"], "15/42/3604", "202212290936531",
          { std: true, pick: true }),
        part("03", "820162R／BK", "鋁合金 ATK V3 轉向輪座", "Alum. ATK V3 upright", ["front-wheel"], "15/42/4097", "202503310157471",
          { pick: true, note: "官網：專為大轉向角最佳化，轉向更精準、反應更快。說明書變更說明：換成鋁合金輪座時轉向拉桿長度改為 15.5 mm（塑膠輪座是 15.6 mm）" }),
        part("15", "820122R／BK", "鋁合金六角輪座 6 mm", "Alum. hex. wheel hubs 6mm", ["front-wheel"], "15/42/3954", "202401190301381",
          { std: true, pick: true }),
        part("16", "820135", "鋁合金輪座 6 mm（大煞車碟造型）", "Alum. wheel hubs 6mm (large brake disc shaped)", ["front-wheel"], "15/42/3509", "202212291051461"),
        part("17", "820139", "鋁合金輕量化二驅輪軸", "Alum. Lightweight 2WD axle", ["front-wheel"], "15/42/3527", "202212291044561",
          { note: "官網：適用 ATK／AKM 輪座。GT 內附的是 820095 AKM 2WD axle" }),
        part("—", "210633", "碳纖維下保桿 3.0", "Carbon lower bumper 3.0", ["bumper"], "15/41/3528", "202301030131451",
          { note: "只列在官網 RMX 4 GT 產品頁的選配清單，升級指南沒有這一項" })
      ]
    },
    {
      id: "up_steer",
      name: "轉向",
      items: [
        part("10", "210701R／BK", "鋁合金轉向連接架（阿克曼可調）", "Alum. steering joint plate (Ackermann adj.)", ["steering"], "15/41/4007", "202410240223551",
          { std: true, pick: true }),
        part("11", "210703R／BK", "碳纖維轉向搖臂組", "Carbon steering arm set", ["steering"], "15/41/4202", "202511200229291",
          { std: true, pick: true }),
        part("12", "210720R／BK", "鋁合金轉向搖臂座", "Alum. steering arm mount", ["steering"], "15/41/4203", "202511200232321",
          { std: true, pick: true }),
        part("13", "210739R／BK", "全車可調拉桿組", "RMX 4 Full turnbuckle set", ["steering", "front-arm", "rear-arm"], "15/41/4200", "202511110156311",
          { note: "GT 的零件代碼表沒有這個料號，但 GT 套件各處已經是可調拉桿（210218、810009、810028）；各支長度在「全車拉桿」卡片" }),
        part("36", "820127R／BK", "鋁合金 8 段可調伺服緩衝座", "Alum. 8-adjusting servo saver", ["servo"], "15/42/3173", "201712270302061",
          { note: "GT 內附的是 820126 NS 高扭力伺服緩衝座" }),
        part("37", "210732R／BK", "鋁合金伺服機座", "Alum. servo mount", ["servo"], "15/41/4183", "202510231106421",
          { std: true, pick: true })
      ]
    },
    {
      id: "up_chassis",
      name: "底盤與車殼",
      items: [
        part("18", "210737R／BK", "碳纖維輕量化底板（軸距 257／266／275）", "RMX 4 Carbon lightweight adj. WB 257/266/275 lower deck", ["chassis"], "15/41/4191", "202510231111121",
          { pick: true, note: "GT 內附的是專用底板 210747。官網：底板減重最多 50%，輕量化同時維持結構剛性，出彎加速更快、起甩更快" }),
        part("38", "210738", "碳纖維輕量化二樓板", "RMX 4 Carbon lightweight upper deck", ["chassis"], "15/41/4196", "202511110142061",
          { std: true, pick: true }),
        part("40", "210746R／BK", "鋁合金二樓板固定座", "Alum. upper deck mount", ["chassis"], "15/41/4205", "202511260151591",
          { std: true, pick: true }),
        part("08", "820141", "隱藏式磁吸車殼柱組", "MST F/R Stealth Magnetic Body Post set", ["shell"], "15/42/3542", "202212151046591",
          { note: "說明書 p.26 的選配件" })
      ]
    },
    {
      id: "up_rear",
      name: "後懸吊",
      items: [
        part("20", "210731R／BK", "鋁合金可調後下擺臂座組 +11.5～13.0", "RMX 4 Alum. adj. lower arm mount set (+11.5~13.0)", ["rear-arm"], "15/41/4181", "202510231104371",
          { std: true, pick: true }),
        part("21", "820163BK", "鋁合金後擺臂座墊片 1.0", "Alum. rear arm mount spacer 1.0", ["rear-arm"], "15/42/4176", "202510231048591",
          { std: true, note: "一包 4 片，說明書 p.18 用 2 片" }),
        part("22", "210730BK", "鋁合金擺臂座補強板", "RMX 4 Alum. suspension mount brace", ["rear-arm"], "15/41/4179", "202510231103261",
          { note: "說明書 p.18 的選配件，取代內附的擺臂座補強板。官網：補強底盤剛性" }),
        part("23", "210696R／BK", "鋁合金 THA 可調後下擺臂組", "Alum. THA adj. rear suspension arm set", ["rear-arm"], "15/41/3958", "202402160324431",
          { note: "GT 內附的是 230148 THA 後下擺臂" }),
        part("34", "210695R／BK", "鋁合金 THA 後輪座", "Alum. THA rear upright", ["rear-wheel"], "15/41/3947", "202401190237321",
          { note: "GT 內附的是 230153-1 THA 後輪座" }),
        part("35", "210740R／BK", "鋁合金 TMB 後輪座組", "RMX 4 Alum. TMB rear hub set", ["rear-wheel"], "15/41/4211", "202601280820571"),
        part("14", "820044R／BK", "鋁合金六角輪座 4 mm", "Alum. hex. wheel hubs 4mm", ["rear-wheel"], "15/42/1530", "201603140505031",
          { std: true }),
        part("31", "210729R／BK", "鋁合金後避震架組", "RMX 4 Alum. rear damper stay set", ["rear-damper"], "15/41/4178", "202510231102371",
          { note: "說明書 p.16 的選配件。官網：高剛性鋁合金結構，避震回饋更直接" }),
        part("19", "210735R／BK", "碳纖維輕量化後連接板組", "RMX 4 Carbon lightweight rear link plate set", ["diff"], "15/41/4187", "202510231108421",
          { std: true, pick: true })
      ]
    },
    {
      id: "up_drive",
      name: "傳動",
      items: [
        part("29", "210741", "鋁合金輕量化傳動軸組（42）", "Alum. lightweight drive shaft set (42)", ["diff", "rear-arm"], "15/41/4192", "202510231112011",
          { pick: true, note: "說明書 p.22 的選配件。GT 內附的是 820004 鋼製 CVD 傳動軸" }),
        part("30", "210734", "POM 惰輪 48P 22T／26T", "Idler gear 48P 22 & 26T (POM)", ["diff"], "15/41/4195", "202511110141341",
          { note: "官網：低摩擦 POM 材質、CNC 精密加工，提升傳動效率與耐用度" }),
        part("32", "210742R／BK", "鋁合金大直齒座", "RMX 4 Alum. spur gear holder", ["drive"], "15/41/4194", "202510231113061",
          { note: "官網：高剛性鋁合金；大直齒更換容易，快拆式設計方便保養" }),
        part("33", "210733R／BK", "鋁合金馬達座", "Alum. motor mount", ["drive"], "15/41/4185", "202510231107491",
          { std: true, pick: true }),
        part("41", "210743", "48P 60T LSD 差速器組", "48P 60T LSD set", ["diff"], "15/41/4197", "202601300343371",
          { note: "裝了之後「後差速器」卡片的差速器型式要改成 LSD" })
      ]
    },
    {
      id: "up_damper",
      name: "避震",
      items: [
        part("25", "820150R／BK", "TDA 鋁合金甩尾避震器組", "TDA Alum. Drift damper set", SHOCKS, "15/42/3730", "202212150929081",
          { std: true, note: "說明書封面規格列為 Aluminum TDA hydraulic damper set；零件代碼表列的是避震的各個散件" }),
        part("02", "820147", "可調避震上座", "Adjustable shock upper end", SHOCKS, "15/42/3664", "202212290850051", { std: true }),
        part("04", "820071", "精密活塞 3×1.0", "Machined piston 3X1.0", ["front-damper"], "15/42/1613", "202212200246481", { std: true }),
        part("24", "820151", "精密活塞 6×0.8", "Machined shock absorber piston 6X0.8", ["rear-damper"], "15/42/3748", "202212150844381", { std: true }),
        part("05", "820164", "DK-RWD 競賽甩尾彈簧組（前 24／後 26）", "DK-RWD Competition drift spring set (F24/R26)(6&6)", SHOCKS, "15/42/4214", "202602230357201",
          { std: true }),
        part("06", "820149R／BK", "輕量化降低型鋁合金避震下座", "Lightweight lowered alum. shocks mount", SHOCKS, "15/42/3732", "202212150910571"),
        part("26", "220011", "避震油 5#", "Mineral oil 5#", SHOCKS, "20/43/2721", "201603150235041"),
        part("27", "220012", "避震油 10#", "Mineral oil 10#", ["front-damper"], "20/43/2722", "201603150235191",
          { std: true, note: "原廠前避震用 #10" }),
        part("28", "220013", "避震油 15#", "Mineral oil 15#", ["rear-damper"], "20/43/3035", "201705170500011",
          { std: true, note: "原廠後避震用 #15" })
      ]
    }
  ];

  product.groups = product.groups.concat(groups);
  product.cards.push({
    id: "upgrades", name: "改裝件", diagram: ["car"],
    groups: groups.map(function (grp) { return grp.id; }),
    summary: [["已加裝", "up_count"]]
  });
  // 放在官網下載頁那一筆的前面
  product.manuals.splice(product.manuals.length - 1, 0, {
    title: "RMX 4 官方推薦全車升級件指南",
    url: SITE + "_upload/down_item_img/202604210138372a.pdf",
    note: "PDF，2 頁；41 個升級件在車上的位置圖與對照表"
  });
})();
