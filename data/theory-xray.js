/*
 * 設定理論：依《XRAY 中文設定書》（原著 XRAY setup book V2.0，翻譯：快手車隊 邱建清）整理。
 * 原書 PDF 放在 referance/Xray理論.pdf，頁碼指的是那份 PDF 的頁碼。
 *
 * 資料格式（js/theory.js 讀）：
 *   topics[]  一個設定項目一筆
 *     id      寫進網址，定了就不要改
 *     name    總覽頁項目鈕上的字（越短越好）；title 是內容頁的標題
 *     slot    在車圖周圍的位置：t1–t6 車頭上方（三欄）、l1–l10 左側、r1–r10 右側、b1–b3 車尾下方；
 *             沒有 slot 的排在車圖下方的「基礎觀念」
 *     zone    front／mid／rear，決定項目鈕的色條
 *     hot     總覽頁車圖要強調的零件（js/theory-diagram.js 的 data-part）
 *     view、base  內容頁釘在上方的示意圖種類與基本參數；option.params 會蓋過 base，
 *             option.view 可以換成另一種圖。cap 是圖下方的說明
 *     sets[].options[]  調整方向。short 是總覽頁標在項目鈕上的字（兩個字以內）
 *       fx[]  這個方向的影響，一句一筆。t 是原書的敘述；tags 是症狀查詢用的索引（見 goals）
 *       how[] 要往這個方向調時怎麼做；use 是原書說明這個方向用途的一段話
 *     keys、how、notes、table  重點、量測與調整步驟、注意事項、表格
 *     pair    前後成對的另一個項目；see 是相關項目
 *   goals[]   症狀查詢的選項。fx 的 tags 裡有同一個 id 就算符合
 *
 * 整理的規則：
 *   - fx 的文字照原書的表格與內文，只修標點與錯字；原書沒寫的影響不補
 *   - tags 是整理時加的索引，不是原書內容。只有原書寫明的才標：
 *       in／mid／out 加上 + 或 -  入彎／彎中／出彎的轉向增加或減少。依原書第 1 章的定義，
 *                                「煞車、收油門」算入彎，「放油門」算彎中，「加速、含油門」算出彎
 *       all+／all-               轉向增加或減少，原書沒有指明是哪一段
 *       @in／@mid／@out          只標示時機，不列入轉向查詢
 *   - 原書句尾帶問號的敘述用 ask()，照樣顯示問號，不加 tags
 *   - 原書的表不分前後、兩個項目都適用的敘述用 gen()
 *   - 示意圖的參數（角度、高度）只是讓圖看得出差別，不是建議值
 */
(function () {
  "use strict";

  function fx(text, tags, extra) {
    var o = { t: text, tags: tags ? tags.split(" ") : [] };
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  function gen(text, tags) { return fx(text, tags, { gen: true }); }
  function ask(text) { return fx(text, "", { ask: true }); }

  var DIFF_INTRO = "過彎時內、外輪的半徑不同，轉速也不同，所以需要差速器。差速器較緊時，過彎內、外輪的轉速會互相對抗，造成抓地力的損失。一般而言，抓地力較好的路面可以用較緊的差速。";
  var ONEWAY_NOTE = "使用中單向或前單向時，最好不要用自動拖煞或煞車。";

  var SPRING_INTRO = "避震器是為了讓輪子盡可能和路面保持接觸。彈簧決定車子的重量如何轉移到輪胎上，彈簧的硬度也影響避震器被壓縮後的回彈速度。彈簧的選擇取決於賽道的型態：高低速、抓地力大小等。";
  var SPRING_HARD = [
    gen("反應較好", "resp+"),
    gen("轉向反應較快", "resp+"),
    gen("不使用在顛簸的賽道"),
    gen("損失些微的轉向，降低車體滾動", "roll-")
  ];
  var SPRING_SOFT = [
    gen("提高在低抓地賽道的抓地力", "g+ lowgrip"),
    gen("適用顛簸賽道", "bumpy"),
    gen("過軟的彈簧讓車體滾動增加，變得遲鈍、變慢")
  ];

  var DAMP_INTRO = "避震油在避震器裡提供阻尼力，主要影響車子對起伏、轉向、煞車與加速的反應。阻尼力的大小和避震器的動作速度有關：動作愈快、愈激烈，阻尼的效果愈明顯。阻尼力讓避震器快速回到穩定的位置，減少彈簧振盪的時間。";
  var DAMP_KEYS = [
    "影響阻尼力的因素：避震油的黏度、活塞的孔數與大小、活塞運動的速度",
    "避震油以黏度係數表示，數值愈高愈濃。表示法大致分成 wt 與 cst 兩種；不同廠牌、同數值的油，黏度不一定相等",
    "活塞孔數較少，同樣黏度的油通過活塞較慢，阻尼力較大；孔數較多則較快通過，阻尼力較小",
    "避震油的設定主要還是依車手的經驗判斷"
  ];

  var ARB_INTRO = "防傾桿用來調整車子的側向抓地力，利用內、外側輪負載的轉移來抵抗車體滾動。防傾桿較硬，轉移的效果較大；但外側輪並不能轉移額外的抓地力，內、外側輪的總抓地力會降低。";
  var ARB_KEYS = [
    "整體的抓地力不能被改變，但可以被分配：後防傾桿加硬，後半部的側向抓地力減少、前半部增加",
    "可以配合軟彈簧使用，提高顛簸路面的操控性，又不會增加過彎時多餘的車體滾動",
    "車體剛性愈好，防傾桿的設定效果愈明顯"
  ];

  var DROOP_INTRO = "Downstop（擺臂下死點）與 Droop（車體上抬量）指的是同一件事，只是測量的方式不同。下死點限制擺臂往下的行程，決定車體往上的抬升量，影響車子的操控性（因為上開角與滾動中心的效應）與輪胎的循跡性。";
  var DROOP_KEYS = [
    "Droop 是車子平放後往上提，直到輪子剛好離開地面時，底盤上提的距離",
    "Droop 的大小由 Downstop 與車高共同決定。改變車高時也要調 Downstop，才能維持原本的 Droop；用海綿胎的車特別重要（胎磨小後提高車高，Droop 會變小）",
    "有效範圍：車子平放時彈簧被車重壓縮，慢慢上抬時彈簧逐漸回到未壓縮的長度。Downstop 與 Droop 只在這段範圍內有效，超過之後擺臂行程再大也沒有影響；所以量 Droop 比量 Downstop 直接且有意義",
    "兩側的 Downstop 量相同非常重要"
  ];
  var DROOP_LESS = gen("擺臂行程較小（Downstop 數值較高）：有較佳的穩定性，用於較平順的場地", "stab+ smooth");
  var DROOP_MORE = gen("擺臂行程較多（Downstop 數值較低）：反應較佳、穩定性較低，通常用在較顛簸或慢速彎較多的場地", "resp+ bumpy tight");
  var DROOP_HOW = [
    {
      title: "Downstop 怎麼量", page: 38,
      prep: ["把避震器從擺臂上移除", "把防傾桿從擺臂上移除", "把輪胎移除"],
      steps: ["把車子放在調車板上，並墊在墊高規上", "搖動一下擺臂，確保它們在最低位置", "量擺臂的最低點（前後相同），不可量到 C 座"]
    },
    {
      title: "Droop 怎麼量", page: 39,
      prep: ["把避震器固定在擺臂上", "把防傾桿從擺臂上移除", "把輪胎裝上，並確保左右輪徑相同"],
      steps: [
        "車子在全配狀態下放在調車板上，壓一下前後懸吊",
        "用直尺量底盤與地面間的位置",
        "直尺保持不動，由車體中間慢慢把車體往上抬，直到胎面正好離開調車板；這時直尺的刻度扣掉正常狀態的刻度，就是 Droop 量"
      ]
    },
    { title: "怎麼調整", page: 40, steps: ["把調整螺絲往下鎖，擺臂會輕微上抬；反之亦然"] }
  ];

  var RC_INTRO = "滾動中心是過彎的瞬間，車體相對於地面滾動的中心。前、後懸吊各有自己的滾動中心，兩者的連線是滾動中心軸線。";
  var RC_KEYS = [
    "位置怎麼決定：下擺臂（B 線）與上擺臂（A 線）的延伸線交於 IC；輪胎與地面的接觸點（WC）和 IC 連成線 C；線 C 與車體中垂線 CL 的交點就是滾動中心",
    "滾動中心在重心下方，並且在車體的中垂線上。車子前後各有滾動中心，重心只有一個；重心的高低不會改變",
    "過彎的離心力作用在重心上，繞著滾動中心把車體往彎外推",
    "滾動中心遠離重心（較低）：力臂加長，相同離心力下車體滾動更多。接近重心（較高）：力臂變短，滾動較少。放到重心上方就不會有車體滾動",
    "愈多的車體滾動，愈多的抓地力；但要有最快的過彎速度，要在足夠的抓地力下盡量降低重量轉移。高抓地力的跑道可以盡量提高滾動中心，相反的就要降低"
  ];
  var RC_NOTES = [
    "左右邊的設定必須相等",
    "滾動中心改變會影響其他設定，例如擺臂行程量（Downstop）、Camber、車高。改完最好再確認一次",
    "用上擺臂設定滾動中心時，Camber 的變化量也會改變：提高滾動中心，變化量增加；降低滾動中心，變化量減少"
  ];
  var RC_LOWER = [
    "上擺臂內球頭：提高，或往內移動固定位置",
    "上擺臂外球頭：移除輪座上的墊片，或把輪座上的固定位置往外移動",
    "下擺臂：使用較低的擺臂固定座"
  ];
  var RC_HIGHER = [
    "上擺臂內球頭：降低，或往外移動固定位置",
    "上擺臂外球頭：增加輪座上的墊片，或把輪座上的固定位置往內移動",
    "下擺臂：使用較高的擺臂固定座"
  ];
  var RC_CAP_LOW = "金色虛線是上、下擺臂的延伸線，紅色虛線是線 C。上擺臂內側抬高後 IC 跑到更遠，RC 降低，離重心 CG 更遠";
  var RC_CAP_HIGH = "金色虛線是上、下擺臂的延伸線，交在 IC；紅色虛線是線 C。上擺臂內側降低後 IC 靠近，RC 升高，離重心 CG 更近";

  var PIN_NOTES = [
    "潛角、蹲角都是針對彎中油門變化產生的轉向反應來設定；增減前、後懸吊的上抬量（Droop）也會影響它們的效果",
    "後車高高於前車高時，擺臂已經和地面有一些角度，會有類似防潛角與助蹲角的效果；後擺臂上抬量（Droop）較大時效果更大。但後懸吊通常彈簧較軟，加速時壓縮量較大，會抵消這個效果"
  ];

  window.RC_THEORY = {
    source: {
      title: "XRAY 中文設定書",
      original: "XRAY setup book V2.0",
      translator: "快手車隊（邱建清）",
      file: "referance/Xray理論.pdf",
      localOnly: false,   // PDF 有放進 repo，網站上也顯示連結。改成 true 的話，只有直接開本機檔案時才顯示
      detail: "PDF 共 44 頁，建立日期 2010-06-03",
      scope: "原書談的是四驅電動房車（文中以 XRAY T2 車系為例）在賽道上的抓地跑法。"
    },

    // 以下兩句是整理時加的說明，不是原書內容
    editorNotes: [
      "前差速、中單向皮帶輪是四驅車才有的零件，後驅車沒有這兩項。",
      "圖是依原書的敘述自己重畫的示意圖，角度與高度都放大過，不是實際比例，也不是建議值。"
    ],

    errata: [
      "第 15 頁避震阻尼表：後避震「硬阻尼」那一列印成「號數低、較多孔」，和軟阻尼那一列相同；依同頁內文（孔數較少阻尼力較大）與前避震的列，應該是「號數高、較少孔」。頁面採用後者",
      "第 34 頁第 17 章開頭寫「前低後高則為助潛角」；依同章的表格（後下擺臂轉軸前低後高），應該是「助蹲角」。頁面採用後者",
      "第 29–30 頁滾動中心的表裡有四句句尾帶問號（重量轉移與抓地力的關係）。頁面照原樣保留問號，這四句不列入症狀查詢"
    ],

    phaseNote: "原書第 1 章的定義：入彎（初期）是煞車狀態、剛收油門；彎中（中期）是放油門狀態；出彎（末期）是開始加速、含油門。",

    goals: [
      {
        row: "推頭（轉向不足）：想增加轉向",
        items: [
          { id: "in+", name: "入彎", full: "入彎轉向不足", want: "增加入彎轉向", also: "all+", see: ["fg+", "rg-"] },
          { id: "mid+", name: "彎中", full: "彎中轉向不足", want: "增加彎中轉向", also: "all+", see: ["fg+", "rg-"] },
          { id: "out+", name: "出彎", full: "出彎轉向不足", want: "增加出彎轉向", also: "all+", see: ["fg+", "rg-"] }
        ]
      },
      {
        row: "甩尾（轉向過度）：想減少轉向",
        items: [
          { id: "in-", name: "入彎", full: "入彎轉向過度", want: "減少入彎轉向", also: "all-", see: ["rg+", "fg-"] },
          { id: "mid-", name: "彎中", full: "彎中轉向過度", want: "減少彎中轉向", also: "all-", see: ["rg+", "fg-"] },
          { id: "out-", name: "出彎", full: "出彎轉向過度", want: "減少出彎轉向", also: "all-", see: ["rg+", "fg-"] }
        ]
      },
      {
        row: "抓地力",
        items: [
          { id: "fg+", name: "前輪增加", full: "前輪抓地力", want: "增加前輪抓地力" },
          { id: "fg-", name: "前輪減少", full: "前輪抓地力", want: "減少前輪抓地力" },
          { id: "rg+", name: "後輪增加", full: "後輪抓地力", want: "增加後輪抓地力" },
          { id: "rg-", name: "後輪減少", full: "後輪抓地力", want: "減少後輪抓地力" },
          { id: "g+", name: "整體增加", full: "抓地力", want: "增加整體或側向抓地力" }
        ]
      },
      {
        row: "反應與穩定",
        items: [
          { id: "resp+", name: "反應變快", full: "轉向反應", want: "讓轉向反應變快" },
          { id: "resp-", name: "反應變慢", full: "轉向反應", want: "讓轉向反應變慢" },
          { id: "stab+", name: "更穩定", full: "穩定性", want: "增加直線或整體的穩定性" },
          { id: "brk+", name: "煞車穩定", full: "煞車穩定性", want: "增加煞車時的穩定性" },
          { id: "roll-", name: "少滾動", full: "車體滾動", want: "減少車體滾動" },
          { id: "flip", name: "防翻車", full: "翻車", want: "避免翻車" }
        ]
      },
      {
        row: "場地",
        items: [
          { id: "bumpy", name: "顛簸", full: "顛簸的場地", want: "適合顛簸的場地" },
          { id: "smooth", name: "平順", full: "平順的場地", want: "適合平順的場地" },
          { id: "lowgrip", name: "低抓地", full: "低抓地力的場地", want: "適合低抓地力的場地" },
          { id: "highgrip", name: "高抓地", full: "高抓地力的場地", want: "適合高抓地力的場地" },
          { id: "tight", name: "小彎多", full: "小彎多的場地", want: "適合小彎、技術型的場地" },
          { id: "fast", name: "高速彎", full: "大型、高速彎的場地", want: "適合大型、高速彎的場地" }
        ]
      }
    ],

    topics: [

      /* ---------- 車頭上方：轉向與前軸 ---------- */

      {
        id: "f-toe", name: "前束角", title: "前輪束角 Toe", ch: "14", pages: "24–26",
        slot: "t1", zone: "front", hot: ["f-wheel", "steer"], pair: "r-toe",
        view: "atop", base: { end: "f", ghost: { toe: 0 } },
        intro: "束角是由車子的正上方往下看，輪胎與車體中心線的夾角。往內束是 Toe-in（+），往外開是 Toe-out（−）。束角是消耗輪胎的摩擦力來讓車子穩定。前輪通常可以調成 Toe-in 或 Toe-out，後輪只能做 Toe-in。",
        sets: [{
          options: [
            {
              id: "in", label: "較多 Toe-in（前束）", short: "內束", params: { toe: 3, bl: "Toe-in", br: "前緣向內" },
              cap: "前輪前緣向內。虛線是 0°，角度放大過",
              fx: [
                fx("增加轉向不足（減少轉向過度）", "all-"),
                fx("降低初期轉向（入彎）", "in-"),
                fx("增加敏感度"),
                fx("讓車子變得不容易駕駛")
              ]
            },
            {
              id: "out", label: "較多 Toe-out（前開）", short: "外開", params: { toe: -3, bl: "Toe-out", br: "前緣向外" },
              cap: "前輪前緣向外。虛線是 0°，角度放大過",
              fx: [
                fx("減少轉向不足（增加轉向過度）", "all+"),
                fx("增加初期轉向（入彎）", "in+"),
                fx("提高直線的穩定性", "stab+"),
                fx("讓車子比較容易駕駛")
              ]
            }
          ]
        }],
        how: [
          {
            title: "怎麼量", page: 25,
            prep: ["把避震器裝在擺臂上", "把輪胎卸除"], tools: ["調車組", "束角尺"],
            steps: ["車子全配狀態下架好調車組，放在調車板上", "放上束角尺，把束角尺往左、右推到底，讀取束角"]
          },
          { title: "怎麼調整", page: 26, steps: ["調整轉向拉桿的長度來設定前輪束角；左右轉向拉桿的長度要相等"] }
        ],
        notes: ["最好先調好後輪的 Toe-in，把車子放下去跑，調遙控器的 trim 讓車子跑得筆直，然後再調前輪的 Toe"]
      },

      {
        id: "ackermann", name: "阿克曼", title: "阿克曼角 Ackermann", ch: "13", pages: "22–23",
        slot: "t2", zone: "front", hot: ["steer", "f-wheel"],
        view: "atop", base: { end: "f" },
        intro: "轉彎時內、外輪的轉向弧度差稱為阿克曼角度。阿克曼的目標是出彎時保持線性的圓弧（純滾動出彎、小的側滑角），而不是讓內側輪以過大的轉向角度把車子往彎內拉。",
        sets: [
          {
            options: [
              {
                id: "more", label: "加大阿克曼角", short: "加大", params: { steer: [-11, -6.5], bl: "內側輪", br: "外側輪" },
                cap: "向左轉：內側輪（左）轉得比外側輪多，兩輪的角度差較大",
                fx: [fx("出彎（加速）轉向不足時，可以加大阿克曼角度，並減少轉向伺服機的行程", "out+")],
                how: ["兩支轉向拉桿愈平行，阿克曼角度愈大", "伺服器片愈短（轉向拉桿愈平行），阿克曼角度愈大"]
              },
              {
                id: "less", label: "減少阿克曼角", short: "減少", params: { steer: [-9.5, -8], bl: "內側輪", br: "外側輪" },
                cap: "向左轉：內、外側輪的角度差較小",
                fx: [fx("出彎（加速）轉向過度、入彎（收油門）轉向不足，或是在彎中聽到前輪出現吱吱的聲音時，可以減少阿克曼角", "out- in+")]
              }
            ]
          },
          {
            title: "原書的模擬：伺服器片長度",
            text: "用三種長度的伺服器片模擬相同的轉向行程量，伺服器片愈短，阿克曼角度愈大。",
            options: [
              { id: "h10", label: "伺服器片長度 10", params: { steer: [-8.35, -5.86], bl: "內 8.35°", br: "外 5.86°" }, cap: "阿克曼角度 2.49°（8.35 − 5.86）。圖上的角度放大過", fx: [fx("阿克曼角度 2.49°")] },
              { id: "h12", label: "伺服器片長度 12", params: { steer: [-9.82, -7.43], bl: "內 9.82°", br: "外 7.43°" }, cap: "阿克曼角度 2.39°。圖上的角度放大過", fx: [fx("阿克曼角度 2.39°")] },
              { id: "h14", label: "伺服器片長度 14", params: { steer: [-11.27, -9.02], bl: "內 11.27°", br: "外 9.02°" }, cap: "阿克曼角度 2.25°。圖上的角度放大過", fx: [fx("阿克曼角度 2.25°")] }
            ]
          }
        ],
        keys: ["抓地力主要由輪胎提供，抓地力關係到車子的轉向弧度與速度", "減速過彎與加速出彎時，不同的輪子有不同的側滑角；加速出彎時，輪胎會把車子往前拉"]
      },

      {
        id: "servo", name: "轉向對稱", title: "伺服器左、右轉的對稱", ch: "9", pages: "17",
        slot: "t3", zone: "front", hot: ["steer"],
        view: "atop", base: { end: "f", steer: [-11, -11], ghost: { steer: [11, 11] }, bl: "左打到底", br: "右打到底（虛線）" },
        cap: "左打到底與右打到底（虛線）的角度應該相同",
        intro: "大部分車子的懸吊幾何設計，左右轉的角度會相等，但實際上有時並不是如此。可以用束角尺確認伺服器左右轉的行程量是否相同；不相同時依下面的程序調整。",
        how: [{
          title: "怎麼調整", page: 17, open: true,
          prep: ["把避震器裝在擺臂上", "把輪胎卸除", "移除馬達齒", "連接遙控設備，並打開開關"], tools: ["調車組", "束角尺"],
          steps: [
            "卸除轉向伺服器擺臂",
            "打開遙控器與接收機",
            "把遙控器設在中立點位置（sub-trim 與 trim），左右行程量（EPA 或 balance）設成相等",
            "確保左右轉向拉桿長度相同",
            "把伺服器擺臂重新裝到適當的位置，讓前輪位於直線位置",
            "把車放在調車板上，並裝上調車組",
            "把束角尺放在調車組上方；束角尺的槽要放進調車組的定位銷",
            "對遙控器做轉向動作並保持，再把束角尺往左（或右）推到底，量左、右轉的角度是否相同",
            "理論上應該相同；不同時調整遙控器的 EPA 或 balance，讓兩邊對稱"
          ]
        }]
      },

      {
        id: "bumpsteer", name: "起伏轉向", title: "起伏轉向 Bump steer", ch: "12", pages: "21",
        slot: "t4", zone: "front", hot: ["steer", "f-arm"],
        view: "atop", base: { end: "f", toe: 0, ghost: { toe: -2.5 }, bl: "自然狀態", br: "下壓後（虛線）" },
        cap: "前擺臂上下運動時，前輪束角跟著改變（虛線）。要調到變化量接近 0",
        intro: "起伏轉向是不被需要的操控特性：前擺臂上下運動時，前輪的束角跟著改變。越野車會用它來改變車子對抗起伏、鬆散路面的轉向特性；原書強烈建議在房車上消除起伏轉向。",
        how: [{
          title: "怎麼消除", page: 21, open: true,
          steps: [
            "車子全配狀態下架好調車組，放在調車板上",
            "壓一下前後懸吊，讓車子位於自然狀態",
            "打開遙控器與接收器，用束角尺量束角",
            "用手壓下前懸吊，讓底盤離調車板還有 1～2 mm 的空間，並保持這個位置",
            "再用束角尺量下壓狀態的束角；如果和自然狀態下的束角不同，做下一步",
            "增加或減少轉向拉桿與轉向座間的墊片，再重複前面的步驟，直到束角的變化量接近 0"
          ]
        }]
      },

      {
        id: "f-track", name: "前車寬", title: "前車寬", ch: "4", pages: "10–11",
        slot: "t5", zone: "front", hot: ["f-wheel", "f-arm"], pair: "r-track",
        view: "atop", base: { end: "f", track: 0, ghost: { track: 0 } },
        intro: "車寬是左右輪外側邊緣間的距離，影響車子的操控性與轉向反應。車寬的左右對稱很重要：左、右輪到車子中心線的距離必須相等。",
        sets: [{
          options: [
            {
              id: "wide", label: "前車寬較寬", short: "寬", params: { track: 9, bl: "較寬" }, cap: "虛線是原本的寬度",
              fx: [
                fx("減少前輪抓地", "fg-"),
                fx("增加轉向不足", "all-"),
                fx("較慢的轉向反應", "resp-"),
                fx("可用來避免翻車", "flip")
              ]
            },
            {
              id: "narrow", label: "前車寬較窄", short: "窄", params: { track: -9, bl: "較窄" }, cap: "虛線是原本的寬度",
              fx: [
                fx("增加前輪抓地力", "fg+"),
                fx("減少轉向不足", "all+"),
                fx("較快的轉向反應", "resp+")
              ]
            }
          ]
        }],
        how: [{ title: "怎麼調整（T2 車系）", page: 11, steps: ["在擺臂固定座之間用墊片調整"] }]
      },

      {
        id: "f-diff", name: "前差速", title: "前差速、前直軸與前單向", ch: "19", pages: "41–43",
        slot: "t6", zone: "front", hot: ["f-diff"], pair: "r-diff", only4wd: true,
        view: "drive", base: { focus: "f" },
        intro: DIFF_INTRO,
        sets: [
          {
            title: "前滾珠差速",
            text: "使用前滾差可以得到一些前直軸在煞車上的優勢，並且還有一些差速的效果。前滾差通常用在低抓地力的賽道，可以在進彎前煞車，並含油門進彎；通常配合後滾差使用。在非常高抓地力的賽道，可以把前後差速調緊，提高車子的反應性。",
            options: [
              {
                id: "tight", label: "前滾差較緊", short: "緊", params: { front: "前滾差（較緊）", fk: "ball" }, cap: "車頭在右邊，紅色是前軸。圖示：四個點是滾珠差速，粗線是直軸，箭頭是單向",
                fx: [fx("降低轉向反應", "resp-"), fx("煞車時較為穩定", "brk+"), fx("可以在出彎時使用動力轉向", "out+")]
              },
              {
                id: "loose", label: "前滾差較鬆", short: "鬆", params: { front: "前滾差（較鬆）", fk: "ball" }, cap: "車頭在右邊，紅色是前軸。圖示：四個點是滾珠差速，粗線是直軸，箭頭是單向",
                fx: [fx("提高轉向反應", "resp+"), fx("煞車時較為不穩定"), fx("出彎時較易轉向不足", "out-")]
              }
            ]
          },
          {
            title: "其他前軸形式",
            options: [
              {
                id: "spool", label: "前直軸", short: "直軸", params: { front: "前直軸", fk: "spool" }, cap: "車頭在右邊，紅色是前軸。圖示：四個點是滾珠差速，粗線是直軸，箭頭是單向",
                fx: [
                  fx("適用在中低抓地的大型戶外賽道，或是需要煞車的場地", "lowgrip fast"),
                  fx("增加含油門時的轉向", "out+"),
                  fx("整體而言，讓車子變得較容易操控"),
                  fx("降低收油門時的轉向", "in-"),
                  fx("左右輪徑有差異時會變得較敏感；可以用滾動中心、彈簧等其他設定來彌補")
                ]
              },
              {
                id: "ows", label: "前單向直軸", short: "單向", params: { front: "前單向直軸", fk: "ows" }, cap: "車頭在右邊，紅色是前軸。圖示：四個點是滾珠差速，粗線是直軸，箭頭是單向",
                fx: [fx("適用在中高抓地賽道，並且賽道不需要煞車", "highgrip"), fx("有更好的收油轉向與效率", "in+")]
              },
              {
                id: "oneway", label: "前單向", short: "單向", params: { front: "前單向", fk: "oneway" }, cap: "車頭在右邊，紅色是前軸。圖示：四個點是滾珠差速，粗線是直軸，箭頭是單向",
                fx: [
                  fx("適用在高抓地賽道，並且收油入彎有轉向不足的情形，或是賽道不需煞車", "highgrip in+"),
                  fx("有較佳的收油轉向與效率，最適合平穩的駕駛風格", "in+"),
                  fx("可以讓後輪稍微大於前輪（偏後驅）；後輪失去抓地（打滑）時，前輪可以輔助產生前進的循跡性")
                ]
              }
            ]
          }
        ],
        keys: ["前單向和中單向的差別：前差速搭配中單向時，彎中內側輪失去抓地力，外側輪也不會有動力；前單向則是一輪失去抓地力時，另一輪還是有動力，可以把車子帶出彎"],
        notes: [ONEWAY_NOTE],
        see: ["center"]
      },

      /* ---------- 左側：幾何 ---------- */

      {
        id: "camber", name: "Camber", title: "Camber（上開角）", ch: "10", pages: "18–19",
        slot: "l1", zone: "front", hot: ["f-wheel", "r-wheel", "f-upper", "r-upper"],
        view: "afront", base: { end: "f", ghost: { camber: 0 } },
        intro: "Camber 是由車子的正前方或後方看，輪胎與地面的夾角。輪胎與地面垂直是 0 度；輪胎的上緣往內側傾斜是負角度，反之是正角度。Camber 會影響車子的側滑。",
        sets: [
          {
            title: "靜態 Camber",
            options: [
              {
                id: "more", label: "負角度加大", short: "加大", params: { camber: 3.5, bl: "負角度較大" },
                cap: "由車頭看：輪胎上緣向內倒。虛線是 0°，角度放大過",
                fx: [fx("一般而言，設定較大的負 Camber，抓地力會隨著輪胎側滑的增加而增加", "g+")],
                how: ["把上拉桿縮短"]
              },
              {
                id: "less", label: "負角度減少", short: "減少", params: { camber: 0.8, bl: "負角度較小" },
                cap: "由車頭看：輪胎接近垂直。虛線是 0°，角度放大過",
                fx: [fx("原書沒有另外列出負角度減少的影響")],
                how: ["把上拉桿放長"]
              }
            ]
          },
          {
            title: "Camber 的變化量",
            text: "擺臂上下運動時，Camber 角度會跟著改變。可以用上擺臂的長度與固定位置來設定；量 Camber 時下壓車身就能觀察變化量。",
            options: [
              {
                id: "gain-big", label: "變化量較大", params: { camber: 1.5, upperLen: "short", bl: "變化量較大" },
                cap: "由車頭看：紅色是上擺臂，內側固定點較靠外，擺臂較短", fx: [fx("上擺臂愈短，變化量愈大"), fx("上擺臂與下擺臂愈不平行，變化量愈大")]
              },
              {
                id: "gain-small", label: "變化量較小", params: { camber: 1.5, upperLen: "long", bl: "變化量較小" },
                cap: "由車頭看：紅色是上擺臂，內側固定點較靠內，擺臂較長", fx: [fx("上擺臂愈長，變化量愈小"), fx("上擺臂與下擺臂愈平行，變化量愈小")]
              }
            ]
          }
        ],
        keys: [
          "前輪的 Camber 以讓前輪得到平整的磨損為主；後輪以得到輕微的圓錐狀（外大內小）為主",
          "前輪的 Camber 取決於保持最大的 contact patch（輪胎與地面的接觸面積），也取決於 Caster：傾角較大需要較小的 Camber，傾角較小需要較大的 Camber"
        ],
        how: [{
          title: "怎麼量", page: 18,
          prep: ["把避震器裝在擺臂上", "把防傾桿卸除", "把輪胎卸除"],
          steps: ["車子在全配狀態下放在調車板上，壓一下前後懸吊", "讀取 Camber 角度值"]
        }],
        notes: [
          "設定完 Camber 後，最好再重新量車高。車高與 Camber 會互相影響，設定完其中一項，最好再確認另一項",
          "改變上擺臂的長度或位置都會影響滾動中心的設定，要互相配合"
        ],
        see: ["caster", "f-rc", "r-rc", "ride"]
      },

      {
        id: "caster", name: "Caster", title: "Caster（傾角）", ch: "11", pages: "20–21",
        slot: "l2", zone: "front", hot: ["f-wheel"],
        view: "side", base: { ghost: { caster: 4 }, fade: "f" },
        intro: "Caster 是由車子側面往車內看，轉向座大王銷與地面的夾角；垂直是 90 度，往後傾是正傾角。Caster 主要影響加速與收油門時的轉向，因為傾角決定車體傾斜的程度。",
        sets: [{
          options: [
            {
              id: "less", label: "減少傾角（較垂直）", short: "直立", params: { caster: 2, bl: "較垂直" },
              cap: "紅線是大王銷的軸線，車頭在右邊。虛線是兩個方向中間的角度，角度放大過",
              fx: [
                fx("降低直線的穩定性"),
                fx("增加初期（入彎）轉向", "in+"),
                fx("減少中段與末期轉向", "mid- out-"),
                fx("較適合路面較滑、較差的賽道", "lowgrip")
              ]
            },
            {
              id: "more", label: "增加傾角（較傾斜）", short: "傾斜", params: { caster: 6, bl: "較傾斜" },
              cap: "紅線是大王銷的軸線，上端往車尾倒，車頭在右邊。虛線是兩個方向中間的角度，角度放大過",
              fx: [
                fx("增加直線穩定性", "stab+"),
                fx("減少初期轉向", "in-"),
                fx("增加中段與末期（出彎）轉向", "mid+ out+"),
                fx("較適合路面較平、摩擦力較高的賽道", "highgrip smooth")
              ]
            }
          ]
        }],
        keys: [
          "Camber 主要決定輪胎與地面接觸面積的大小；傾角主要影響前輪轉向時 Camber 的變化量",
          "傾角愈大，轉向時產生的 Camber 變化愈大。所以加大傾角後可以減少靜態 Camber 的設定，反之亦然",
          "通常先決定傾角，再依輪胎磨耗的形狀回去調靜態 Camber，讓輪胎磨耗的形狀是平的",
          "傾角較大時，轉向時彎道外側的 Camber 變化量較大，可以增加轉向",
          "傾角的另一個效應：轉向時彎道內側輪會把車子抬升，使車體傾斜，增加過彎時由內側轉移到外側的重量"
        ],
        how: [{
          title: "怎麼調整", page: 21,
          steps: ["更換不同角度的 C 座。以 T2 車系為例，有 2°、4°、6° 可以選", "也可以用潛角（Dive）來設定傾角，見「前潛角」"]
        }],
        notes: ["這些影響可能因賽道表面與輪胎硬度而有所不同，特別是高摩擦力的路面與較軟的胎"],
        see: ["f-dive", "camber"]
      },

      {
        id: "f-rc", name: "前滾動中心", title: "前滾動中心 Roll center", ch: "15", pages: "27–31",
        slot: "l3", zone: "front", hot: ["f-upper", "f-hinge"], pair: "r-rc",
        view: "afront", base: { end: "f", rc: true },
        intro: RC_INTRO + "前滾動中心主要影響車子在彎中加速與出彎加速時的轉向。",
        sets: [{
          options: [
            {
              id: "low", label: "較低的前滾動中心", short: "低", params: { upperIn: 6, lowerIn: -4 }, cap: RC_CAP_LOW,
              fx: [
                fx("增加加速時的轉向（彎中、末期）", "mid+ out+"),
                fx("降低車子的反應", "resp-"),
                ask("減少前半部重量轉移，但是增加抓地力？"),
                fx("車體的滾動增加"),
                fx("用在路面平順、高摩擦力、高速彎的賽道", "smooth highgrip fast")
              ],
              how: RC_LOWER
            },
            {
              id: "high", label: "較高的前滾動中心", short: "高", params: { upperIn: -6, lowerIn: 4 }, cap: RC_CAP_HIGH,
              fx: [
                fx("降低加速時的轉向", "out-"),
                fx("提升反應性", "resp+"),
                ask("增加前半部重量轉移，減少抓地力？"),
                fx("車體的滾動減小", "roll-"),
                fx("用在高抓地力的場地，可避免翻車", "highgrip flip"),
                fx("用在左右彎變化快速的賽道")
              ],
              how: RC_HIGHER
            }
          ]
        }],
        keys: RC_KEYS, notes: RC_NOTES, see: ["camber", "f-dive", "f-droop"]
      },

      {
        id: "f-dive", name: "前潛角", title: "防潛角與助潛角（前懸吊）", ch: "16", pages: "32–33",
        slot: "l4", zone: "front", hot: ["f-hinge"], pair: "r-squat",
        view: "side", base: { fade: "f" },
        intro: "潛角是由車子的左右兩側往車內看，前下擺臂轉軸與地面的夾角。前高後低是（助）潛角，前低後高是防潛角。",
        sets: [{
          options: [
            {
              id: "anti", label: "防潛角", sub: "前下擺臂轉軸前低後高", short: "防潛", params: { fPin: -4, br: "前低後高" },
              cap: "紅線是前下擺臂的轉軸，車頭在右邊。虛線是水平，角度放大過",
              use: "使用軟彈簧時，防潛角可以減少車子減速或煞車時前半部往下沉的趨勢：讓下擺臂吸收部分的重量轉移，避免全部作用在軟彈簧上。",
              fx: [
                fx("入彎時，前懸吊會抵抗下沉。收油門的轉向與前輪抓地力會下降，因為較少的後端重量轉移到前端", "in- fg-"),
                fx("前懸吊會花較長的時間達到最大滾動點，彎中轉向與前輪抓地力會降低，直到再加油門", "mid- fg-"),
                fx("防潛角會減少傾角，出彎加油門的轉向會降低。可以加大轉向 C 座的角度來補償傾角", "out-"),
                fx("會降低前懸吊處理顛簸路面的穩定性，可以改用軟彈簧來改善"),
                fx("最好用在車體配重偏前半部，且中、高抓地力的路面", "highgrip")
              ]
            },
            {
              id: "pro", label: "助潛角", sub: "前下擺臂轉軸前高後低", short: "助潛", params: { fPin: 4, br: "前高後低" },
              cap: "紅線是前下擺臂的轉軸，車頭在右邊。虛線是水平，角度放大過",
              use: "助潛角主要用來增加入彎與出彎的轉向。減速、煞車時重量往前轉移，助潛角會讓更多的重量轉移作用在彈簧上；助潛角也會增加傾角（Caster），增加出彎的轉向。",
              fx: [
                fx("增加收油門入彎的轉向及前端抓地力，因為後端的重量較容易轉移到前端", "in+ fg+"),
                fx("彎中轉向及前端抓地力會增加", "mid+ fg+"),
                fx("出彎含油門時，轉向及前端抓地會增加（C 座角度不變），並降低前端的擺臂上抬量、抑制前端上抬，保持前輪的重量不會轉移到後端；這是因為助潛角增加了傾角", "out+ fg+"),
                fx("增加前懸吊對顛簸路面的處理能力，提高穩定度", "bumpy")
              ]
            }
          ]
        }],
        how: [{
          title: "怎麼調整", page: 33,
          steps: ["使用不同尺寸的擺臂固定座，設定成前低後高或前高後低", "相同的潛角又可以分成「高滾動中心」與「低滾動中心」兩種設定（整組固定座較高或較低）"]
        }],
        notes: PIN_NOTES, see: ["caster", "f-rc", "f-droop"]
      },

      {
        id: "ride", name: "車高", title: "車高", ch: "3", pages: "8–10",
        slot: "l5", zone: "mid", hot: ["chassis"],
        view: "side", base: { ghost: { fH: 5.5, rH: 5.5 }, dimH: true },
        intro: "車高是底盤到地面的高度差。車高影響車子的牽引力，也改變了重心與滾動中心的高度。因為懸吊的幾何與地面間隙跟著改變，車高改變太多也會有負面的影響。",
        sets: [{
          options: [
            {
              id: "low", label: "降低車高", short: "低", params: { fH: 3, rH: 3, bl: "車高較低" }, cap: "虛線是原本的高度",
              fx: [fx("增加整體抓地力", "g+"), fx("適合在平坦的賽道", "smooth")]
            },
            {
              id: "high", label: "提高車高", short: "高", params: { fH: 8.5, rH: 8.5, bl: "車高較高" }, cap: "虛線是原本的高度",
              fx: [fx("減少整體抓地力"), fx("適合在顛簸的賽道（避免觸地）", "bumpy")]
            }
          ]
        }],
        keys: [
          "車高是在輪胎已經裝上、全配的狀態下量的。用膠胎時車高應該保持一定，因為膠胎的磨損不會太劇烈；棉胎則需要時常調整",
          "懸吊設定不會因為裝上不同的輪胎而改變，而是被車高影響"
        ],
        how: [
          {
            title: "怎麼量", page: 9,
            prep: ["把避震器裝在擺臂上", "把防傾桿裝在擺臂上", "把輪胎裝上，並確保左右輪徑相同"],
            steps: ["車子在全配狀態下（無車殼）放在調車板上，壓一下前後懸吊", "用車高尺量前、後車高"]
          },
          {
            title: "怎麼調整", page: 10,
            steps: [
              "車高只能用避震筒上的調整環設定，不可以用 Downstop 的調整螺絲調",
              "調整時注意 Downstop 的調整螺絲是否已經碰到底盤；有的話先退開一些再調車高",
              "把調整環轉到需要的車高後，用游標卡尺確認兩邊調整環到避震器上蓋的距離相等"
            ]
          }
        ],
        see: ["f-droop", "r-droop", "camber"]
      },

      {
        id: "wheelbase", name: "軸距", title: "軸距", ch: "5", pages: "12",
        slot: "l6", zone: "mid", hot: ["f-wheel", "r-wheel"],
        view: "side", base: { ghost: { wb: 0 }, wb: 0 },
        intro: "軸距是由車子側面量前後輪的中心距。改變軸距會對操控產生戲劇性的影響：它調整車重在前後輪上的分佈，也調整了抓地力。例如縮短後半部的軸距，後輪負擔較多的重量，後輪的抓地力就比較大。",
        sets: [{
          options: [
            {
              id: "long", label: "軸距較長", short: "長", params: { wb: 14, bl: "軸距較長" }, cap: "虛線是原本的輪子位置",
              fx: [
                fx("較難通過小彎"),
                fx("增加穩定性", "stab+"),
                fx("對顛簸路面的操控性較佳", "bumpy"),
                fx("適用於大型、高速彎的賽道", "fast")
              ]
            },
            {
              id: "short", label: "軸距較短", short: "短", params: { wb: -14, bl: "軸距較短" }, cap: "虛線是原本的輪子位置",
              fx: [
                fx("較容易過小彎", "tight"),
                fx("增加轉向反應", "resp+"),
                fx("適用小型技術賽道", "tight")
              ]
            }
          ]
        }],
        how: [{ title: "怎麼調整", page: 12, steps: ["用下擺臂轉軸上的墊片來調整"] }]
      },

      {
        id: "weight", name: "重心", title: "重心與重量轉移", ch: "2", pages: "7–8",
        slot: "l7", zone: "mid", hot: ["cg"],
        view: "side",
        intro: "重量轉移是掌控車子的關鍵。重量轉移到哪一側，那一側的輪胎就被壓向路面，得到更多的抓地力或摩擦力。轉移多少取決於車子的重心（CG）、重量的分佈與駕駛的方式。",
        sets: [{
          title: "三種狀況",
          options: [
            {
              id: "corner", label: "過彎", view: "afront", params: { end: "f", roll: 6, force: true, bl: "內側", br: "外側" },
              cap: "由車頭看：箭頭是作用在重心上的離心力，車體往彎外傾斜",
              fx: [fx("離心力把車子推往彎的外側；這個力作用在重心上，使車子傾斜、往外側滾動"), fx("轉移的重量施加在外側輪上")]
            },
            {
              id: "accel", label: "加速", params: { fH: 7.5, rH: 3.5, force: "accel", ghost: { fH: 5.5, rH: 5.5 } },
              cap: "車頭在右邊：慣性力往後作用在重心上，車尾下沉",
              fx: [fx("慣性力往後施加在重心上，把車子往後傾斜"), fx("前端的重量轉移到後輪上")]
            },
            {
              id: "brake", label: "減速、煞車", params: { fH: 3.5, rH: 7.5, force: "brake", ghost: { fH: 5.5, rH: 5.5 } },
              cap: "車頭在右邊：慣性力往前作用在重心上，車頭下沉",
              fx: [fx("慣性力往前施加在重心上，把車子往前傾斜"), fx("後端的重量轉移到前輪上")]
            }
          ]
        }],
        keys: [
          "開始調整設定之前，先確認：車子的機械狀態正常，沒有損壞、動作不順或鬆動；左右、前後有適當的平衡",
          "重量平衡：持續調整車子的左右平衡。可以用平衡工具檢查重量分配，確保全配狀態下不會傾向一邊",
          "重心的位置取決於車子的重量與零件的配置。左右、前後不平衡時重心不在中心，左右轉彎的特性就不會相同",
          "重心愈低愈好，可以減低重量轉移的負面影響：零件盡量放低，減少上方的重量",
          "沒有一種神奇的設定可以解決所有問題。所有設定都會互相影響，車子的設定永遠是妥協"
        ],
        see: ["f-rc", "r-rc"]
      },

      {
        id: "gear", name: "齒比", title: "齒比與 Rollout", ch: "20", pages: "44",
        slot: "l8", zone: "mid", hot: ["gear"],
        view: "roll", calc: true,
        cap: "輪胎由實線滾到虛線的距離，就是馬達轉一圈車子走的距離（Rollout）",
        intro: "針對不同的賽道、馬達、車輛設定與駕駛方式，最適合的齒比關鍵是找出並維持最佳的 Rollout：馬達轉一圈，車子走的距離。輪徑不變時，馬達齒與大齒盤決定 Rollout，Rollout 決定車子的極速與加速。",
        sets: [{
          options: [
            {
              id: "high", label: "Rollout 較高", short: "高",
              fx: [
                fx("提高極速、降低加速性"),
                fx("過高時：過大的扭力負載會快速消耗電池的安培數，馬達溫度快速升高，甚至燒毀")
              ]
            },
            {
              id: "low", label: "Rollout 較低", short: "低",
              fx: [
                fx("加速性較佳、極速降低"),
                fx("太低時：馬達轉速提升過快，可能失去出彎所需的低轉速扭力。電車馬達的最大扭力只出現在起動時，隨轉速提高而下降")
              ]
            }
          ]
        }],
        keys: [
          "最好的搭配是電池足夠跑完比賽，且馬達溫度不會過高",
          "內齒比是車子內部傳動的齒比，由皮帶齒與差速齒決定。每種車因設計不同而不同，通常不能改變，可以查各車的說明書",
          "終傳比是輪胎轉一圈，馬達要轉幾圈；賽場上一般都用終傳比來稱呼齒比。終傳比 =（大齒盤 ÷ 馬達齒）× 內齒比",
          "輪胎轉一圈的距離 = 胎徑 × 3.14；Rollout = 胎徑 × 3.14 ÷ 終傳比"
        ]
      },

      {
        id: "r-rc", name: "後滾動中心", title: "後滾動中心 Roll center", ch: "15", pages: "27–31",
        slot: "l9", zone: "rear", hot: ["r-upper", "r-hinge"], pair: "f-rc",
        view: "afront", base: { end: "r", rc: true },
        intro: RC_INTRO + "後滾動中心會影響出彎加速與入彎減速時的操控。",
        sets: [{
          options: [
            {
              id: "low", label: "較低的後滾動中心", short: "低", params: { upperIn: 6, lowerIn: -4 }, cap: RC_CAP_LOW,
              fx: [
                fx("提高加速時後輪抓地", "rg+ @out"),
                ask("減少後半部重量轉移，提升抓地力？"),
                fx("提高抓地，減少後輪磨耗", "rg+"),
                fx("車體滾動增加"),
                fx("可用於避免入彎翻車", "flip @in"),
                fx("適合低抓地賽道", "lowgrip")
              ],
              how: RC_LOWER
            },
            {
              id: "high", label: "較高的後滾動中心", short: "高", params: { upperIn: -6, lowerIn: 4 }, cap: RC_CAP_HIGH,
              fx: [
                fx("降低加速時的轉向（出彎）", "out-"),
                ask("重量轉移增加？，減少抓地力？"),
                fx("提高車子反應性", "resp+"),
                fx("車體滾動減小", "roll-"),
                fx("避免在高抓地力賽道的彎中與出彎翻車", "flip highgrip @mid @out"),
                fx("用在左右彎變化快速的賽道")
              ],
              how: RC_HIGHER
            }
          ]
        }],
        keys: RC_KEYS, notes: RC_NOTES, see: ["camber", "r-squat", "r-droop"]
      },

      {
        id: "r-squat", name: "後蹲角", title: "防蹲角與助蹲角（後懸吊）", ch: "17", pages: "34–35",
        slot: "l10", zone: "rear", hot: ["r-hinge"], pair: "f-dive",
        view: "side", base: { fade: "r" },
        intro: "蹲角是由車子的左右兩側往車內看，後下擺臂轉軸與地面的夾角。前高後低是防蹲角，前低後高是助蹲角。",
        sets: [{
          options: [
            {
              id: "anti", label: "防蹲角", sub: "後下擺臂轉軸前高後低", short: "防蹲", params: { rPin: 4, bl: "前高後低" },
              cap: "紅線是後下擺臂的轉軸，車頭在右邊。虛線是水平，角度放大過",
              use: "後懸吊必須使用軟彈簧時，防蹲角可以減少車子加速時後半部往下沉的趨勢：讓下擺臂吸收部分的重量轉移，避免全部作用在軟彈簧上。額外的好處是提高起跑時加速的反應。",
              fx: [
                fx("入彎收油門時，後懸吊會抵抗車體後端抬升的趨勢。使用較硬的前彈簧與較小的後擺臂上抬量（Droop）時，收油門的轉向會降低（減少重量轉移到前輪）", "in-"),
                fx("後懸吊可以較快到達最大滾動點。彎中轉向會降低，直到再加油門", "mid-"),
                fx("出彎時抵抗後懸吊往下沉的趨勢，出彎含油門的轉向會增加；因為較少的重量轉移到後輪，保持了前輪的抓地力", "out+"),
                fx("增加後懸吊對顛簸路面的處理能力，提高穩定度", "bumpy")
              ]
            },
            {
              id: "pro", label: "助蹲角", sub: "後下擺臂轉軸前低後高", short: "助蹲", params: { rPin: -4, bl: "前低後高" },
              cap: "紅線是後下擺臂的轉軸，車頭在右邊。虛線是水平，角度放大過",
              use: "助蹲角用來提高進彎時的轉向與出彎時的後輪抓地力，對低抓地力的柏油路面是很有用的設定。",
              fx: [
                fx("入彎收油門時，較多的後端重量轉移到前端，降低後輪抓地力，所以會增加轉向；除非把後下擺臂的上抬量（Droop）做小，限制後半部車體上抬的趨勢", "in+ rg-"),
                fx("直到再加油門，彎中轉向會因為後輪抓地力減少而增加", "mid+ rg-"),
                fx("出彎含油門時，較多的前端重量轉移到後端，增加後輪抓地力，但會產生轉向不足", "out- rg+"),
                fx("會降低後懸吊處理顛簸路面的穩定性"),
                fx("最好用於橡膠胎、低抓地力的柏油路面", "lowgrip")
              ]
            }
          ]
        }],
        how: [{
          title: "怎麼調整", page: 35,
          steps: ["使用不同尺寸的擺臂固定座，設定成前低後高或前高後低", "相同的蹲角又可以分成「高滾動中心」與「低滾動中心」兩種設定（整組固定座較高或較低）"]
        }],
        notes: PIN_NOTES, see: ["r-rc", "r-droop"]
      },

      /* ---------- 右側：避震與傳動 ---------- */

      {
        id: "f-spring", name: "前彈簧", title: "前避震彈簧", ch: "6", pages: "13",
        slot: "r1", zone: "front", hot: ["f-shock"], pair: "r-spring",
        view: "shock", base: { focus: "spring" },
        intro: SPRING_INTRO,
        sets: [{
          options: [
            {
              id: "hard", label: "前彈簧較硬", short: "硬", params: { spring: "hard" },
              fx: [
                fx("增加彎中與出彎時的轉向不足", "mid- out-"),
                fx("增加煞車時的轉向", "in+"),
                fx("提高反應性，讓車子變靈活", "resp+")
              ].concat(SPRING_HARD)
            },
            {
              id: "soft", label: "前彈簧較軟", short: "軟", params: { spring: "soft" },
              fx: [
                fx("讓車子在彎中與出彎有較佳的轉向", "mid+ out+"),
                fx("過軟的前彈簧會讓車子在煞車時轉向不足", "@in")
              ].concat(SPRING_SOFT)
            }
          ]
        }],
        see: ["f-damp", "shockpos", "f-arb"]
      },

      {
        id: "f-damp", name: "前阻尼", title: "前避震阻尼", ch: "7", pages: "14–15",
        slot: "r2", zone: "front", hot: ["f-shock"], pair: "r-damp",
        view: "shock", base: { focus: "damp" },
        intro: DAMP_INTRO,
        sets: [{
          options: [
            {
              id: "soft", label: "前阻尼較軟", sub: "避震油號數低、活塞較多孔", short: "軟", params: { damp: "soft" },
              fx: [
                fx("較慢的轉向反應", "resp-"),
                fx("降低入彎初期轉向", "in-"),
                fx("出彎／加速時，增加轉向過度", "out+")
              ]
            },
            {
              id: "hard", label: "前阻尼較硬", sub: "避震油號數高、活塞較少孔", short: "硬", params: { damp: "hard" },
              fx: [
                fx("較快的轉向反應", "resp+"),
                fx("增加入彎初期轉向", "in+"),
                fx("出彎／加速時，增加轉向不足", "out-")
              ]
            }
          ]
        }],
        keys: DAMP_KEYS, see: ["f-spring"]
      },

      {
        id: "f-arb", name: "前防傾桿", title: "前防傾桿", ch: "8", pages: "16",
        slot: "r3", zone: "front", hot: ["f-arb"], pair: "r-arb",
        view: "afront", base: { end: "f", force: true },
        intro: ARB_INTRO,
        sets: [{
          options: [
            {
              id: "hard", label: "前防傾桿較硬", short: "硬", params: { arb: "hard", roll: 2.5, bl: "滾動較少" },
              cap: "由車頭看：金色是防傾桿，粗細代表軟硬；箭頭是作用在重心上的離心力",
              fx: [
                fx("減少車身滾動", "roll-"),
                fx("降低前抓地（增加後輪抓地）", "fg- rg+"),
                fx("降低入彎時的轉向", "in-"),
                fx("轉向反應速度快", "resp+")
              ]
            },
            {
              id: "soft", label: "前防傾桿較軟", short: "軟", params: { arb: "soft", roll: 8, bl: "滾動較多" },
              cap: "由車頭看：金色是防傾桿，粗細代表軟硬；箭頭是作用在重心上的離心力",
              fx: [
                fx("增加車體滾動"),
                fx("增加前輪抓地（降低後輪抓地）", "fg+ rg-"),
                fx("增加入彎時的轉向", "in+"),
                fx("轉向反應慢", "resp-")
              ]
            }
          ]
        }],
        keys: ARB_KEYS, see: ["f-spring"]
      },

      {
        id: "f-droop", name: "前 Droop", title: "前輪 Downstop 與 Droop", ch: "18", pages: "36–40",
        slot: "r4", zone: "front", hot: ["f-arm"], pair: "r-droop",
        view: "afront", base: { end: "f", ghost: { lift: 0 } },
        intro: DROOP_INTRO,
        sets: [{
          options: [
            {
              id: "less", label: "前 Droop 較小", sub: "前輪 Downstop 數值較大", short: "小", params: { lift: 6, br: "上抬量小" },
              cap: "虛線是車子平放時的底盤；實線是把車體往上提、輪子剛要離地時的位置",
              fx: [
                fx("減少加速時前車身上抬"),
                fx("增加高速時的轉向", "all+"),
                fx("增加出彎初期加速時的轉向不足", "out-"),
                fx("用於較平順的場地", "smooth"),
                DROOP_LESS
              ]
            },
            {
              id: "more", label: "前 Droop 較大", sub: "前輪 Downstop 數值較小", short: "大", params: { lift: 17, br: "上抬量大" },
              cap: "虛線是車子平放時的底盤；實線是把車體往上提、輪子剛要離地時的位置",
              fx: [
                fx("增加加速時前車身上抬"),
                fx("減少高速時的轉向", "all-"),
                fx("減少出彎初期加速時的轉向不足", "out+"),
                fx("用於較顛簸的場地", "bumpy"),
                DROOP_MORE
              ]
            }
          ]
        }],
        keys: DROOP_KEYS, how: DROOP_HOW, see: ["ride", "f-rc", "f-dive"]
      },

      {
        id: "shockpos", name: "避震器位置", title: "避震器固定位置", ch: "6.1", pages: "14",
        slot: "r5", zone: "mid", hot: ["f-shock", "r-shock"],
        view: "afront", base: { end: "f" },
        intro: "避震器的固定位置決定下擺臂運動時，有多少避震器的效果被作用，以及避震器作用力相對的變化。",
        sets: [{
          options: [
            {
              id: "lean", label: "較斜放", short: "斜", params: { shock: "lean", bl: "避震器較斜" }, cap: "由車頭看：金色是避震器",
              fx: [fx("讓避震器變得較軟些"), fx("讓車子較柔和，提供較柔順的感覺與側向抓地力", "g+")]
            },
            {
              id: "upright", label: "較直立", short: "直", params: { shock: "upright", bl: "避震器較直立" }, cap: "由車頭看：金色是避震器",
              fx: [fx("讓避震器變得較硬些"), fx("讓車子有較直接的感覺，但減少側向抓地")]
            }
          ]
        }],
        see: ["f-spring", "r-spring"]
      },

      {
        id: "center", name: "中單向", title: "中單向皮帶輪", ch: "19.7", pages: "42–43",
        slot: "r6", zone: "mid", hot: ["center", "belt"], only4wd: true,
        view: "drive", base: { focus: "c" },
        intro: "中單向皮帶輪讓前輪可以獨立於後輪動作；可調式的可以設定前輪獨立於後輪運動的程度。設定較緊時，前輪與後輪沒有相對運動；反之前輪獨立於後輪運動，收油門時是後驅，加油門時是四驅。",
        sets: [{
          options: [
            {
              id: "loose", label: "中單向較鬆", short: "鬆", params: { center: "中單向（較鬆）：收油門後驅、加油門四驅", ck: true }, cap: "車頭在右邊，紅色是中軸上的中單向皮帶輪",
              fx: [
                fx("放油門時較多轉向", "mid+"),
                fx("提升車子極速"),
                fx("使用在不需煞車的高抓地力或大型賽道", "highgrip fast")
              ]
            },
            {
              id: "tight", label: "中單向較緊", short: "緊", params: { center: "中單向（較緊）：前後輪沒有相對運動", ck: true }, cap: "車頭在右邊，紅色是中軸上的中單向皮帶輪",
              fx: [
                fx("較少轉向", "all-"),
                fx("配合煞車使用"),
                fx("傳動阻力較大"),
                fx("用於路面較滑的賽道", "lowgrip")
              ]
            }
          ]
        }],
        table: {
          title: "原書建議的搭配（第 43 頁）",
          head: ["賽道條件", "建議"],
          rows: [
            ["低抓地力", "中單向較緊"],
            ["中抓地力（慢速彎）", "中單向較緊或較鬆"],
            ["高抓地力（慢速彎）", "中單向較鬆"],
            ["高抓地力（高速彎）", "前單向"]
          ]
        },
        keys: ["前差速搭配中單向時，加速狀態下一樣有前差速效果：彎中內側輪失去抓地力，外側輪也不會有動力。前單向則相反，一輪失去抓地力時另一輪還是有動力，可以把車子帶出彎"],
        notes: [ONEWAY_NOTE],
        see: ["f-diff", "r-diff"]
      },

      {
        id: "r-spring", name: "後彈簧", title: "後避震彈簧", ch: "6", pages: "13",
        slot: "r7", zone: "rear", hot: ["r-shock"], pair: "f-spring",
        view: "shock", base: { focus: "spring" },
        intro: SPRING_INTRO,
        sets: [{
          options: [
            {
              id: "hard", label: "後彈簧較硬", short: "硬", params: { spring: "hard" },
              fx: [
                fx("讓後輪抓地減少一些，但是增加彎中與出彎時的轉向，特別適用在長的高速彎", "rg- mid+ out+ fast")
              ].concat(SPRING_HARD)
            },
            {
              id: "soft", label: "後彈簧較軟", short: "軟", params: { spring: "soft" },
              fx: [
                fx("讓車子在彎中有較佳的抓地（特別是顛簸的賽道），以及加速時的後輪抓地", "rg+ bumpy @mid @out")
              ].concat(SPRING_SOFT)
            }
          ]
        }],
        see: ["r-damp", "shockpos", "r-arb"]
      },

      {
        id: "r-damp", name: "後阻尼", title: "後避震阻尼", ch: "7", pages: "14–15",
        slot: "r8", zone: "rear", hot: ["r-shock"], pair: "f-damp",
        view: "shock", base: { focus: "damp" },
        intro: DAMP_INTRO,
        sets: [{
          options: [
            {
              id: "soft", label: "後阻尼較軟", sub: "避震油號數低、活塞較多孔", short: "軟", params: { damp: "soft" },
              fx: [
                fx("較快的轉向反應", "resp+"),
                fx("出彎／加速時，提高後輪抓地", "rg+ @out"),
                fx("降低煞車時的後輪抓地力", "rg- @in")
              ]
            },
            {
              id: "hard", label: "後阻尼較硬", sub: "避震油號數高、活塞較少孔", short: "硬", params: { damp: "hard" },
              fx: [
                fx("較慢的轉向反應", "resp-"),
                fx("出彎／加速時，降低後輪抓地", "rg- @out"),
                fx("提高煞車時的後輪抓地力", "rg+ @in")
              ]
            }
          ]
        }],
        keys: DAMP_KEYS,
        notes: ["原書第 15 頁的表格把「後阻尼較硬」那一列印成「號數低、較多孔」，和較軟的那一列相同；這裡依同頁內文改成「號數高、較少孔」"],
        see: ["r-spring"]
      },

      {
        id: "r-arb", name: "後防傾桿", title: "後防傾桿", ch: "8", pages: "16",
        slot: "r9", zone: "rear", hot: ["r-arb"], pair: "f-arb",
        view: "afront", base: { end: "r", force: true },
        intro: ARB_INTRO,
        sets: [{
          options: [
            {
              id: "hard", label: "後防傾桿較硬", short: "硬", params: { arb: "hard", roll: 2.5, bl: "滾動較少" },
              cap: "由車頭看：金色是防傾桿，粗細代表軟硬；箭頭是作用在重心上的離心力",
              fx: [
                fx("減少車體滾動", "roll-"),
                fx("降低後輪抓地（增加前輪抓地）", "rg- fg+"),
                fx("增加出彎加速的轉向", "out+"),
                fx("提高轉向反應速度", "resp+")
              ]
            },
            {
              id: "soft", label: "後防傾桿較軟", short: "軟", params: { arb: "soft", roll: 8, bl: "滾動較多" },
              cap: "由車頭看：金色是防傾桿，粗細代表軟硬；箭頭是作用在重心上的離心力",
              fx: [
                fx("增加車身滾動"),
                fx("增加後輪抓地（減少前輪抓地）", "rg+ fg-"),
                fx("降低出彎轉向", "out-")
              ]
            }
          ]
        }],
        keys: ARB_KEYS, see: ["r-spring"]
      },

      {
        id: "r-droop", name: "後 Droop", title: "後輪 Downstop 與 Droop", ch: "18", pages: "36–40",
        slot: "r10", zone: "rear", hot: ["r-arm"], pair: "f-droop",
        view: "afront", base: { end: "r", ghost: { lift: 0 } },
        intro: DROOP_INTRO,
        sets: [{
          options: [
            {
              id: "less", label: "後 Droop 較小", sub: "後輪 Downstop 數值較大", short: "小", params: { lift: 6, br: "上抬量小" },
              cap: "虛線是車子平放時的底盤；實線是把車體往上提、輪子剛要離地時的位置",
              fx: [
                fx("減少減速或煞車時後車身上抬"),
                fx("增加煞車時的穩定性", "brk+"),
                fx("用於較平順的場地", "smooth"),
                DROOP_LESS
              ]
            },
            {
              id: "more", label: "後 Droop 較大", sub: "後輪 Downstop 數值較小", short: "大", params: { lift: 17, br: "上抬量大" },
              cap: "虛線是車子平放時的底盤；實線是把車體往上提、輪子剛要離地時的位置",
              fx: [
                fx("增加減速或煞車時後車身上抬"),
                fx("減少煞車時的穩定性"),
                fx("用於較顛簸的場地", "bumpy"),
                DROOP_MORE
              ]
            }
          ]
        }],
        keys: DROOP_KEYS, how: DROOP_HOW, see: ["ride", "r-rc", "r-squat"]
      },

      /* ---------- 車尾下方：後軸 ---------- */

      {
        id: "r-toe", name: "後束角", title: "後輪束角 Toe", ch: "14", pages: "24–26",
        slot: "b1", zone: "rear", hot: ["r-wheel"], pair: "f-toe",
        view: "atop", base: { end: "r", ghost: { toe: 2.5 } },
        intro: "束角是由車子的正上方往下看，輪胎與車體中心線的夾角。束角是消耗輪胎的摩擦力來讓車子穩定。後輪只能做 Toe-in；後輪的 Toe-in 是最基本的調整，代表車子操控的對稱性，調好它對車子左右的對稱很重要。",
        sets: [{
          options: [
            {
              id: "more", label: "後輪 Toe-in 較多", short: "多", params: { toe: 4.5, bl: "Toe-in 較多" },
              cap: "後輪前緣向內。虛線是兩個方向中間的角度，角度放大過",
              fx: [
                fx("增加轉向不足", "all-"),
                fx("提高出彎與入彎煞車的穩定性", "brk+ @in @out"),
                fx("較小的機會損失後輪循跡性", "rg+"),
                fx("提升直線穩定性", "stab+")
              ]
            },
            {
              id: "less", label: "後輪 Toe-in 較少", short: "少", params: { toe: 1, bl: "Toe-in 較少" },
              cap: "後輪前緣向內。虛線是兩個方向中間的角度，角度放大過",
              fx: [
                fx("降低出彎與入彎煞車的穩定性", "@in @out"),
                fx("較大的機會損失後輪循跡性", "rg-")
              ]
            }
          ]
        }],
        how: [
          {
            title: "怎麼量", page: 25,
            prep: ["把避震器裝在擺臂上", "把輪胎卸除"], tools: ["調車組", "束角尺"],
            steps: ["車子全配狀態下架好調車組，放在調車板上", "放上束角尺，把束角尺往左、右推到底，讀取束角"]
          },
          {
            title: "怎麼調整", page: 26,
            steps: ["後輪的束角 = 輪座本身的束角 + 擺臂固定座墊片的束角", "可以換不同角度的輪座，或是在擺臂固定座增加、減少墊片"]
          }
        ],
        notes: ["最好先調好後輪的 Toe-in，把車子放下去跑，調遙控器的 trim 讓車子跑得筆直，然後再調前輪的 Toe"]
      },

      {
        id: "r-track", name: "後車寬", title: "後車寬", ch: "4", pages: "10–11",
        slot: "b2", zone: "rear", hot: ["r-wheel", "r-arm"], pair: "f-track",
        view: "atop", base: { end: "r", track: 0, ghost: { track: 0 } },
        intro: "車寬是左右輪外側邊緣間的距離，影響車子的操控性與轉向反應。車寬的左右對稱很重要：左、右輪到車子中心線的距離必須相等。",
        sets: [{
          options: [
            {
              id: "wide", label: "後車寬較寬", short: "寬", params: { track: 9, bl: "較寬" }, cap: "虛線是原本的寬度",
              fx: [
                fx("增加入彎（初期）的抓地", "@in"),
                fx("增加高速時的轉向", "all+"),
                fx("可用來避免翻車", "flip")
              ]
            },
            {
              id: "narrow", label: "後車寬較窄", short: "窄", params: { track: -9, bl: "較窄" }, cap: "虛線是原本的寬度",
              fx: [
                fx("增加出彎（末期）的抓地", "@out"),
                fx("增加高速時的轉向不足", "all-"),
                fx("提高髮夾彎的前輪抓地力", "fg+ tight")
              ]
            }
          ]
        }],
        how: [{ title: "怎麼調整（T2 車系）", page: 11, steps: ["在擺臂固定座之間用墊片調整"] }]
      },

      {
        id: "r-diff", name: "後差速", title: "後差速與後直軸", ch: "19", pages: "41–42",
        slot: "b3", zone: "rear", hot: ["r-diff"], pair: "f-diff",
        view: "drive", base: { focus: "r" },
        intro: DIFF_INTRO,
        sets: [
          {
            title: "後滾珠差速",
            text: "後滾差是最常見的配置，可以配合各種前差速類型。缺點是重量與慣性都比後直軸大，而且需要時常保養。",
            options: [
              {
                id: "tight", label: "後滾差較緊", short: "緊", params: { rear: "後滾差（較緊）", rk: "ball" }, cap: "車頭在右邊，紅色是後軸。圖示：四個點是滾珠差速，粗線是直軸",
                fx: [
                  fx("入彎會有些微的轉向不足；出彎則因為動力打滑，會比較難駕駛", "in-"),
                  fx("增加含油門時的轉向", "out+"),
                  fx("通常用在高抓地力賽道，但是會減少後輪在彎道中段的穩定性", "highgrip @mid")
                ]
              },
              {
                id: "loose", label: "後滾差較鬆", short: "鬆", params: { rear: "後滾差（較鬆）", rk: "ball" }, cap: "車頭在右邊，紅色是後軸。圖示：四個點是滾珠差速，粗線是直軸",
                fx: [
                  fx("在彎道中段與出彎較穩定", "@mid @out"),
                  fx("加速時轉向不足", "out-"),
                  fx("適用於低抓地賽道，或是配合前單向使用", "lowgrip")
                ]
              }
            ]
          },
          {
            title: "其他後軸形式",
            options: [{
              id: "spool", label: "後直軸", short: "直軸", params: { rear: "後直軸", rk: "spool" }, cap: "車頭在右邊，紅色是後軸。圖示：四個點是滾珠差速，粗線是直軸",
              fx: [
                fx("通常用在非常高抓地力的賽道，通常配合前單向使用", "highgrip"),
                fx("煞車時只有後輪有作用，必須調整自己的駕駛方式來配合")
              ]
            }]
          }
        ],
        see: ["center"]
      },

      /* ---------- 車圖下方：基礎觀念 ---------- */

      {
        id: "b-phases", name: "過彎三階段與術語", title: "過彎三階段與專業術語", ch: "1", pages: "5–6", basic: true,
        line: "入彎、彎中、出彎；推頭與甩尾",
        intro: "原書把車子在彎道的表現分成三部分，後面每一章都用這三個階段與「轉向不足、轉向過度」來描述影響。",
        keysTitle: "過彎三階段",
        keys: ["入彎（初期）＝煞車狀態（剛收油門）", "彎中（中期）＝放油門狀態", "出彎（末期）＝開始加速狀態（含油門）"],
        sets: [{
          title: "專業術語", plain: true,
          options: [
            {
              id: "us", label: "轉向不足＝推頭",
              fx: [
                fx("前輪抓地力不足、後輪抓地太好，車子就會轉向不足：前端滑動太多"),
                fx("轉向不足的車子比較容易駕駛，但是會慢於具有輕微轉向過度的車子")
              ]
            },
            {
              id: "os", label: "轉向過度＝甩尾",
              fx: [
                fx("前輪抓地力太好、後輪抓地力不足，車子就會轉向過度：後端滑動太多"),
                fx("過度的轉向過度會讓後輪失去控制而打滑")
              ]
            }
          ]
        }]
      },

      {
        id: "b-rules", name: "調車的原則", title: "設定理論與準備事項", ch: "1", pages: "5", basic: true,
        line: "左右相同、一次改一些、先顧好機械狀態",
        intro: "要讓車子有好表現，設定好四輪獨立懸吊是必要的。車子的設定是複雜的關係，所有的調整都會交互影響。",
        keysTitle: "原則",
        keys: [
          "永遠確保左右做出相同的調整",
          "一次做一些調整；有改善就保持這個設定，並記錄它對哪些賽道條件最佳",
          "保持車子正常的機械狀態，車子才會對調整有正確的回饋：檢查懸吊與避震器的順暢度、傳動件的潤滑與磨損，特別是在碰撞之後",
          "車體剛性（特別是扭曲）是設定的重要因素。硬車體可以避免車體扭曲引發其他不容易量測或調整的因素；但車體剛性也是設定的工具之一",
          "最後微調的設定會讓車子更快，通常也更容易駕駛，更接近車子的極限性能"
        ],
        see: ["weight", "b-tools"]
      },

      {
        id: "b-tools", name: "量測時的零件狀態", title: "設定項目與相關零件、工具", ch: "1.1", pages: "6", basic: true,
        line: "量每個項目時避震器、防傾桿、輪子要不要裝",
        intro: "量各個設定項目時，車上的避震器、防傾桿、輪子要裝著還是拆掉，以及會用到哪些設定工具。",
        table: {
          title: "原書第 6 頁的表",
          head: ["項目", "避震器", "防傾桿", "輪子", "用到的工具"],
          rows: [
            ["下死點", "去除", "去除", "去除", "Droop 尺"],
            ["上抬量", "安裝", "安裝", "安裝", "（表中沒有勾選工具）"],
            ["車高", "安裝", "安裝", "安裝", "車高尺"],
            ["車寬", "安裝", "無關", "去除", "設定組、扭曲（平衡）調整組"],
            ["上開與上開變化", "安裝", "去除", "去除", "設定組"],
            ["傾角", "安裝", "無關", "去除", "設定組"],
            ["束角", "安裝", "無關", "去除", "設定組、束角尺"],
            ["轉向對稱", "安裝", "無關", "去除", "設定組、束角尺"],
            ["扭曲", "安裝", "視情況", "去除", "設定組、扭曲（平衡）調整組"]
          ]
        },
        notes: ["上抬量（Droop）那一列，原書第 6 頁標示三樣零件都安裝；第 39 頁的量測步驟則是把防傾桿從擺臂上移除，並用直尺量"],
        see: ["ride", "camber", "f-toe", "f-droop"]
      }
    ]
  };
})();
