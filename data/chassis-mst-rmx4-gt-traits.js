/*
 * 車架 MST RMX 4 GT 的「車輛特性」規則：總覽頁下方那份摘要要看哪些欄位、各種情況對應哪幾句敘述。
 * 要排在 data/chassis-mst-rmx4-gt.js 之後載入，這個檔把 traits 加到那個產品物件上。規則的格式看 js/traits.js 檔頭註解。
 *
 * 這個檔不寫特性的敘述，只做對應：
 *   fx      指到車架資料檔某個欄位的 effect（[欄位 id, 條件文字]），文字要和那邊的 w 一字不差
 *   theory  指到設定理論（data/theory-xray.js）的「項目 id/調整方向 id」
 * 對應的原則：
 *   - 全部原廠值時也要有內容（使用者 2026-10-13：「就算是原廠設定，也要總結出車輛目前的特性」）。
 *     有明確基準的設定直接寫目前的特性：前束、後束、外傾角以 0° 為基準（angle），彈簧看自己填的硬度等級，
 *     齒輪箱模式、ESC 位置這類選項看選了哪一個。之後再看和原廠比是加大還是減小
 *   - 避震油、差速這種「說明書和原書都沒有寫多少算硬」的，不判斷目前偏哪一邊，用 both 把往兩邊調的影響
 *     都列出來（使用者 2026-10-13：「彈簧、阻尼油、差速的特性，如果沒有，可以查設定理論」）；
 *     和原廠不同之後才寫比原廠硬還是軟
 *   - 其餘的設定只在和原廠不同時才列。說明書沒寫方向的（哪個孔力臂短、△▽ 哪個高）
 *     用 maybe 把兩種可能都列出來，不替使用者猜
 *   - 好幾個欄位決定同一件事時（輪距、軸距、阻尼、避震總長）合成一條規則，理論只算一次
 *   - 用來調出另一個量測值的欄位（拉桿長度之於外傾角與前束、調整環之於車高）不接理論，
 *     理論接在量測值那個欄位上，才不會同一件事算兩次
 *   - 接到理論的依據寫在各段的註解。原書談的是四驅房車，名稱對不上的地方（滾珠差速、Downstop）用 note 說明
 */
(function () {
  "use strict";

  var product = (window.RC_PRODUCTS || []).filter(function (p) { return p.id === "mst-rmx4-gt"; })[0];
  if (!product) return;

  function num(x) { var y = parseFloat(x); return isFinite(y) ? y : null; }
  // 和原廠的差；有一邊不是數字就當作沒有差
  function diff(v, f, id) { var a = num(v[id]), b = num(f[id]); return a == null || b == null ? 0 : a - b; }
  function sign(x) { return x > 1e-6 ? 1 : x < -1e-6 ? -1 : 0; }
  function cmp(v, f, id) { return sign(diff(v, f, id)); }
  function changed(v, f, id) {
    if (f[id] == null || f[id] === "" || v[id] === f[id]) return false;
    var a = num(v[id]), b = num(f[id]);
    return !(a != null && b != null && a === b && /^[+-]?[\d.]+$/.test(v[id]) && /^[+-]?[\d.]+$/.test(f[id]));
  }
  function mm(x) { return String(Math.round(x * 10) / 10); }

  // 數值欄位：比原廠大是 up，比原廠小是 down
  function step(id, up, down) {
    return { items: [id], pick: function (v, f) { var d = cmp(v, f, id); return d > 0 ? "up" : d < 0 ? "down" : null; }, cases: { up: up, down: down } };
  }
  // 以 0° 為基準的角度：目前在 0° 的哪一邊就先寫那一邊的特性（原廠值也一樣），再看和原廠比是加大還是減小。
  // pos／neg：大於 0／小於 0 時的 { say, fx, theory }；up／down：比原廠大／小時的 { fx, theory }。
  // 兩者是同一個方向時敘述只列一次，傾向圖算兩格
  function angle(id, pos, neg, up, down) {
    function parts(v, f) {
      var n = num(v[id]), d = cmp(v, f, id);
      return { state: n == null ? null : n > 0 ? pos : n < 0 ? neg : null, delta: d > 0 ? up : d < 0 ? down : null, why: d > 0 ? "比原廠大" : "比原廠小" };
    }
    function labelled(refs, label) { return (refs || []).map(function (r) { return [r[0], r[1], label]; }); }
    return {
      items: [id],
      pick: function (v, f) { var x = parts(v, f); return x.state || x.delta ? "now" : null; },
      show: function (v, f) { return v[id] + "°" + (cmp(v, f, id) ? "（原廠 " + f[id] + "°）" : ""); },
      cases: { now: {
        say: function (v, f) {
          var x = parts(v, f);
          return [x.state && x.state.say, x.delta && x.why].filter(function (t) { return t; }).join("，");
        },
        fx: function (v, f) {
          var x = parts(v, f);
          return labelled(x.state && x.state.fx, "相對於 0°").concat(labelled(x.delta && x.delta.fx, x.why));
        },
        theory: function (v, f) {
          var x = parts(v, f), out = [];
          if (x.state && x.state.theory) out.push(x.state.theory);
          if (x.delta && x.delta.theory) out.push({ ref: x.delta.theory, why: x.why });
          return out;
        }
      } }
    };
  }
  // 只知道改過、方向無法判斷
  function any(ids, c) {
    return { items: ids, pick: function (v, f) { return ids.some(function (id) { return changed(v, f, id); }) ? "any" : null; }, cases: { any: c } };
  }

  var NOTE_DIR = "△／▽ 哪個方向的插銷比較高，說明書沒有文字說明，要對照實物";
  var NOTE_DIFF = "原書講的是滾珠差速的鬆緊；齒輪差速用油號調，油越稠越接近鎖死";
  var NOTE_NO_SCALE = "說明書和原書都沒有寫多少算硬，所以不判斷目前偏哪一邊，只列出往兩邊調的影響";
  var NOTE_DROOP = "原書的 Droop 是用 Downstop 螺絲調的；這台車沒有 Downstop，下垂量由避震總長決定";
  var NOTE_RETAINER = "調整環改的是車高，特性看車高那一項；量到的車高記得一起更新";

  /* ---------- 前後各一組的規則 ---------- */

  // 彈簧：有填自評的硬度（1～10）就看硬度，1～4 偏軟、7～10 偏硬；沒填才看線徑和原廠比變粗還是變細。
  // 5～6 級或什麼都沒填時看不出偏向，把換硬、換軟的影響都列出來。理論：前／後彈簧較硬、較軟（原書第 6 章）
  function spring(pre, zh, topic) {
    var rate = pre + "_spring_rate", wire = pre + "_spring_wire";
    function level(v) { return num(v[rate]); }
    var hard = { fx: [[rate, "越硬（數字越大）"]], theory: topic + "/hard" };
    var soft = { fx: [[rate, "越軟（數字越小）"]], theory: topic + "/soft" };
    var both = [
      { label: "換硬一點", fx: hard.fx, theory: hard.theory },
      { label: "換軟一點", fx: soft.fx, theory: soft.theory }
    ];
    return {
      id: pre + "_spring", name: zh + "彈簧", items: [rate, wire],
      pick: function (v, f) {
        var n = level(v);
        if (n != null) return n >= 7 ? "hard" : n <= 4 ? "soft" : "mid";
        var d = cmp(v, f, wire);
        return d > 0 ? "thick" : d < 0 ? "thin" : "none";
      },
      show: function (v) {
        return level(v) != null ? "硬度 " + level(v) + "／10" : v[pre + "_spring_len"] + " mm φ" + v[wire] + " " + v[pre + "_spring_color"];
      },
      cases: {
        hard: { say: "偏硬", fx: hard.fx, theory: hard.theory },
        soft: { say: "偏軟", fx: soft.fx, theory: soft.theory },
        mid: { say: "中等", both: both, note: "5～6 級當成中等，不算偏硬也不算偏軟" },
        thick: { say: "線徑比原廠粗", fx: [[wire, "線徑越粗（越硬）"]], theory: hard.theory },
        thin: { say: "線徑比原廠細", fx: [[wire, "線徑越細（越軟）"]], theory: soft.theory },
        none: { say: "硬度還沒填", both: both, note: "到避震卡片填「彈簧硬度」（1～10 級），這裡就會改成偏軟或偏硬的特性" }
      }
    };
  }

  // 阻尼：油號、活塞孔徑、活塞孔數一起看。和原廠比，三者方向一致才接理論（原書第 7 章：號數高、孔少是硬）；
  // 方向相反時只把各自的說明列出來。全部原廠值時看不出偏向，把調硬、調軟的影響都列出來
  function damping(pre, zh, topic) {
    var oil = pre + "_oil", dia = pre + "_piston_dia", holes = pre + "_piston_holes";
    function parts(v, f) {
      return [
        { d: cmp(v, f, oil), hard: [oil, "油號加大（越稠）"], soft: [oil, "油號減小（越稀）"] },
        { d: -cmp(v, f, dia), hard: [dia, "孔徑越小"], soft: [dia, "孔徑越大"] },
        { d: -cmp(v, f, holes), hard: [holes, "孔數越少"], soft: [holes, "孔數越多"] }
      ].filter(function (x) { return x.d; });
    }
    function fx(v, f) { return parts(v, f).map(function (x) { return x.d > 0 ? x.hard : x.soft; }); }
    return {
      id: pre + "_damping", name: zh + "避震阻尼", items: [oil, dia, holes],
      pick: function (v, f) {
        var list = parts(v, f), hard = list.filter(function (x) { return x.d > 0; }).length;
        return !list.length ? "stock" : hard === list.length ? "hard" : hard === 0 ? "soft" : "mixed";
      },
      show: function (v) { return "油 #" + v[oil] + "、活塞 " + v[holes] + " 孔 φ" + v[dia]; },
      cases: {
        stock: { note: NOTE_NO_SCALE, both: [
          { label: "調硬（油號加大、活塞孔小或孔少）", fx: [[oil, "油號加大（越稠）"]], theory: topic + "/hard" },
          { label: "調軟（油號減小、活塞孔大或孔多）", fx: [[oil, "油號減小（越稀）"]], theory: topic + "/soft" }
        ] },
        hard: { say: "比原廠硬", fx: fx, theory: topic + "/hard" },
        soft: { say: "比原廠軟", fx: fx, theory: topic + "/soft" },
        mixed: { say: "油和活塞往相反的方向改", maybe: fx, see: topic, note: "整體變硬還是變軟要實際試" }
      }
    };
  }

  // 避震總長：上端可調長度加避震軸露出長度。變長就是下垂量（Droop）變多（車架資料檔「上端可調長度」的說明）
  function length(pre, zh, topic) {
    var up = pre + "_upper_end", rod = pre + "_rod_len";
    function fx(v, f) {
      var out = [], d = cmp(v, f, up);
      if (d) out.push([up, d > 0 ? "加長" : "縮短"]);
      if (cmp(v, f, rod)) out.push([rod, "改變長度"]);
      return out;
    }
    return {
      id: pre + "_length", name: zh + "避震總長", items: [up, rod],
      pick: function (v, f) { var d = sign(diff(v, f, up) + diff(v, f, rod)); return d > 0 ? "long" : d < 0 ? "short" : null; },
      cases: {
        long: { say: "變長，下垂量變多", fx: fx, theory: topic + "/more", note: NOTE_DROOP },
        short: { say: "變短，下垂量變少", fx: fx, theory: topic + "/less", note: NOTE_DROOP }
      }
    };
  }

  function shock(pre, zh, key) {
    var ball = key + "_damper_ball_spacer";
    return [
      spring(pre, zh, key + "-spring"),
      any([pre + "_spring_len"], { say: "換了不同長度的彈簧", fx: [[pre + "_spring_len", "換不同長度"]] }),
      damping(pre, zh, key + "-damp"),
      length(pre, zh, key + "-droop"),
      any([pre + "_lower_end"], { say: "換了型式", maybe: [[pre + "_lower_end", "換成較長的型式"]], note: "「1」和「3」哪一種比較長，說明書沒有寫" }),
      step(pre + "_rebound",
        { say: "下拉量加大", fx: [[pre + "_rebound", "下拉越多（回彈越大）"]] },
        { say: "下拉量減小", fx: [[pre + "_rebound", "下拉越少（回彈越小）"]] }),
      any([pre + "_retainer"], { say: "位置改了", note: NOTE_RETAINER }),
      any([ball], { say: "墊片厚度改了", maybe: [[ball, "球頭往外（避震越直立）"], [ball, "球頭往內（避震越斜）"]], see: "shockpos",
        note: "加墊片是讓避震更直立還是更斜，說明書沒有寫" })
    ];
  }

  /* ---------- 輪距、軸距：好幾個欄位合起來 ---------- */

  // 輪距是車架資料檔 derive() 推算的。outer 是在輪座外側加寬的欄位（Offset、六角座、墊片），共用同一句說明
  function track(id, name, key, topic, outer, arm, mount) {
    function fx(dir) {
      return function (v, f) {
        var out = [], o = 0;
        outer.forEach(function (x) { o += diff(v, f, x); });
        if (sign(o) === dir) out.push([outer[0], dir > 0 ? "加厚／加大" : "減少"]);
        if (arm && cmp(v, f, arm) === dir) out.push([arm, dir > 0 ? "加長" : "縮短"]);
        if (dir > 0 && cmp(v, f, mount[0]) > 0 && cmp(v, f, mount[1]) > 0) out.push([mount[0], "F、R 同時加大"]);
        return out;
      };
    }
    return {
      id: id, name: name, names: true, items: outer.concat(arm ? [arm] : [], mount),
      pick: function (v, f, q) { var d = sign(q.now[key] - q.fac[key]); return d > 0 ? "wide" : d < 0 ? "narrow" : null; },
      show: function (v, f, q) { return "推算 " + mm(q.fac[key]) + " → " + mm(q.now[key]) + " mm"; },
      cases: {
        wide: { say: "變寬", fx: fx(1), theory: topic + "/wide" },
        narrow: { say: "變窄", fx: fx(-1), theory: topic + "/narrow" }
      }
    };
  }

  // 軸距也是 derive() 推算的：前擺臂往前或後擺臂往後都是變長
  function wheelbaseFx(dir) {
    return function (v, f) {
      var out = [], a = cmp(v, f, "f_arm_shim_front"), b = cmp(v, f, "r_arm_shim_front");
      if (a && -a === dir) out.push(["f_arm_shim_front", a < 0 ? "前薄後厚（擺臂往前）" : "前厚後薄（擺臂往後）"]);
      if (b && b === dir) out.push(["r_arm_shim_front", b > 0 ? "前厚後薄（擺臂往後）" : "前薄後厚（擺臂往前）"]);
      return out;
    };
  }

  /* ---------- 擺臂座 ---------- */

  // 下墊片：F、R 都加（或都減）是整組升降，接滾動中心（原書第 15 章：使用較高、較低的擺臂固定座）
  function mountHeight(id, name, F, R, topic, upWord, downWord) {
    return {
      id: id, name: name, items: [F, R],
      pick: function (v, f) {
        var a = cmp(v, f, F), b = cmp(v, f, R);
        return a > 0 && b > 0 ? "up" : a < 0 && b < 0 ? "down" : null;
      },
      cases: {
        up: { say: "F、R 都加高", fx: [[F, upWord]], theory: topic + "/high" },
        down: { say: "F、R 都降低", fx: downWord ? [[F, downWord]] : [], theory: topic + "/low" }
      }
    };
  }

  // 下墊片的前後差：和原廠的差距比。front 是 F 相對變高的那種情況，rear 是 R 相對變高
  function mountTilt(id, name, F, R, front, rear) {
    return {
      id: id, name: name, items: [F, R],
      pick: function (v, f) { var d = sign(diff(v, f, F) - diff(v, f, R)); return d > 0 ? "front" : d < 0 ? "rear" : null; },
      show: function (v) { return "F " + v[F] + " mm／R " + v[R] + " mm"; },
      cases: { front: front, rear: rear }
    };
  }

  var rules = [

    /* ---------- 轉向 ---------- */

    any(["steer_connecter_spacer"], { say: "墊片厚度改了", fx: [["steer_connecter_spacer", "加減墊片"]], see: "ackermann",
      note: "加厚是增加還是減少阿克曼，說明書沒有寫。把方向打到底，看內外輪的角度差確認" }),
    any(["tie_rod_len"], { say: "長度改了", fx: [["tie_rod_len", "調整長度"]], see: "f-toe" }),
    {
      // 孔的編號是由轉軸往外數的（車架資料檔的備註）
      items: ["steer_armB_hole"],
      pick: function (v, f) {
        var a = /(\d)/.exec(v.steer_armB_hole || ""), b = /(\d)/.exec(f.steer_armB_hole || "");
        return !a || !b || a[1] === b[1] ? null : a[1] > b[1] ? "far" : "near";
      },
      cases: {
        far: { say: "球頭往外移，離轉軸較遠", fx: [["steer_armB_hole", "球頭離搖臂轉軸越遠"]] },
        near: { say: "球頭往內移，離轉軸較近", fx: [["steer_armB_hole", "球頭離搖臂轉軸越近"]] }
      }
    },
    {
      items: ["servo_horn_hole"],
      pick: function (v) { var n = num(v.servo_horn_hole); return n === 21.5 ? "outer" : n === 17.5 ? "inner" : null; },
      cases: {
        outer: { say: "21.5 外孔", fx: [["servo_horn_hole", "21.5（外孔）"]] },
        inner: { say: "17.5 內孔", fx: [["servo_horn_hole", "17.5（內孔）"]] }
      }
    },

    /* ---------- 前輪定位 ---------- */

    // 理論：前輪束角（第 14 章）。欄位的正值是 Toe-out；比原廠小就是往 Toe-in 的方向
    angle("f_toe",
      { say: "Toe-out", fx: [["f_toe", "Toe-out 加大"]], theory: "f-toe/out" },
      { say: "Toe-in", theory: "f-toe/in" },
      { fx: [["f_toe", "Toe-out 加大"]], theory: "f-toe/out" },
      { fx: [["f_toe", "Toe-out 減小（趨近 0）"]], theory: "f-toe/in" }),
    // 理論：Camber（第 10 章），原書只列了負角度加大的影響。欄位的正值是負外傾（輪胎上緣向內）
    angle("f_camber",
      { fx: [["f_camber", "加大"]], theory: "camber/more" },
      null,
      { fx: [["f_camber", "加大"]], theory: "camber/more" },
      { fx: [["f_camber", "減小"]], theory: "camber/less" }),
    step("f_upper_arm_gap",
      { say: "加長", fx: [["f_upper_arm_gap", "加長"]] },
      { say: "縮短", fx: [["f_upper_arm_gap", "縮短"]] }),
    // 理論：Caster（第 11 章）
    step("caster",
      { say: "加大", fx: [["caster", "加大（8.6°）"]], theory: "caster/more" },
      { say: "減小", fx: [["caster", "減小（5.5°）"]], theory: "caster/less" }),

    /* ---------- 前輪座 ---------- */

    // 理論：前滾動中心（第 15 章）的作法「上擺臂外球頭：增加輪座上的墊片」是提高，移除是降低
    step("fu_top_spacer",
      { say: "加墊片", fx: [["fu_top_spacer", "加墊片（上球頭升高）"]], theory: "f-rc/high" },
      { say: "減墊片", fx: [["fu_top_spacer", "減少"]], theory: "f-rc/low" }),
    any(["fu_steer_spacer"], { say: "墊片厚度改了", fx: [["fu_steer_spacer", "加減墊片"]], see: "bumpsteer" }),
    step("fu_bottom_spacer",
      { say: "加墊片", fx: [["fu_bottom_spacer", "加墊片"]] },
      { say: "減墊片", fx: [["fu_bottom_spacer", "減少"]] }),
    any(["fu_knuckle_hole"], { say: "換了孔",
      maybe: [["fu_knuckle_hole", "換到力臂較短的孔（離主銷近）"], ["fu_knuckle_hole", "換到力臂較長的孔（離主銷遠）"]],
      note: "兩個孔哪一個力臂較短，說明書沒有寫，要對照實物" }),

    /* ---------- 前輪距、前擺臂座 ---------- */

    // 理論：前車寬（第 4 章）
    track("f_track", "前輪距", "fTrack", "f-track", ["f_offset", "f_hub_spacer", "f_hex"], "f_lower_arm_len", ["fsm_f_pos", "fsm_r_pos"]),
    {
      id: "fsm_skew", name: "前擺臂座刻度", items: ["fsm_f_pos", "fsm_r_pos"],
      pick: function (v) { var a = num(v.fsm_f_pos), b = num(v.fsm_r_pos); return a != null && b != null && a !== b ? "skew" : null; },
      show: function (v) { return "F +" + v.fsm_f_pos + "／R +" + v.fsm_r_pos; },
      cases: { skew: { say: "F、R 刻度不同", fx: [["fsm_f_pos", "F、R 數值不同"]] } }
    },
    any(["fsm_f_dir", "fsm_r_dir"], { say: "方向改了", maybe: [["fsm_f_dir", "插銷（內側支點）越高"], ["fsm_f_dir", "插銷越低"]], see: "f-rc", note: NOTE_DIR }),
    mountHeight("fsm_height", "前擺臂座高度", "fsm_f_spacer", "fsm_r_spacer", "f-rc", "F、R 同時加墊片", ""),
    // 理論：前潛角（第 16 章）。前下擺臂轉軸前高後低是助潛角，前低後高是防潛角
    mountTilt("fsm_tilt", "前擺臂座前後高度差", "fsm_f_spacer", "fsm_r_spacer",
      { say: "F 相對變高，往前高後低（助潛角）", fx: [["fsm_f_spacer", "只墊 F（前高後低）"]], theory: "f-dive/pro" },
      { say: "R 相對變高，往前低後高（防潛角）", fx: [["fsm_f_spacer", "只墊 R（後高前低）"]], theory: "f-dive/anti" }),

    /* ---------- 軸距、車高 ---------- */

    // 理論：軸距（第 5 章）
    {
      id: "wheelbase", name: "軸距", names: true, items: ["f_arm_shim_front", "f_arm_shim_rear", "r_arm_shim_front", "r_arm_shim_rear"],
      pick: function (v, f, q) { var d = sign(q.now.wheelbase - q.fac.wheelbase); return d > 0 ? "long" : d < 0 ? "short" : null; },
      show: function (v, f, q) { return "推算 " + mm(q.fac.wheelbase) + " → " + mm(q.now.wheelbase) + " mm"; },
      cases: {
        long: { say: "變長", fx: wheelbaseFx(1), theory: "wheelbase/long" },
        short: { say: "變短", fx: wheelbaseFx(-1), theory: "wheelbase/short" }
      }
    },
    // 理論：車高（第 3 章）。原書講的是整台車的高度，前、後各算一項
    step("f_ride_height",
      { say: "提高", fx: [["f_ride_height", "提高"], ["f_ride_height", "偏離 9 mm"]], theory: "ride/high" },
      { say: "降低", fx: [["f_ride_height", "降低"], ["f_ride_height", "偏離 9 mm"]], theory: "ride/low" }),
    step("r_ride_height",
      { say: "提高", fx: [["r_ride_height", "提高"]], theory: "ride/high" },
      { say: "降低", fx: [["r_ride_height", "降低"]], theory: "ride/low" }),
    {
      id: "rake", name: "前後車高差", items: ["f_ride_height", "r_ride_height"],
      pick: function (v) { var a = num(v.f_ride_height), b = num(v.r_ride_height); return a != null && b != null && a > b ? "nose" : null; },
      show: function (v) { return "前 " + v.f_ride_height + " mm／後 " + v.r_ride_height + " mm"; },
      cases: { nose: { say: "前高後低", fx: [["f_ride_height", "前高後低（原廠前 9／後 5）"]] } }
    }

  ].concat(shock("fd", "前", "f"), [

    /* ---------- 後輪定位 ---------- */

    // 理論：後輪束角（第 14 章）。欄位的正值是 Toe-in；原書說後輪只能做 Toe-in，所以負值沒有敘述
    angle("r_toe",
      { say: "Toe-in", fx: [["r_toe", "Toe-in 加大"]], theory: "r-toe/more" },
      { say: "Toe-out" },
      { fx: [["r_toe", "Toe-in 加大"]], theory: "r-toe/more" },
      { fx: [["r_toe", "Toe-in 減小"]], theory: "r-toe/less" }),
    angle("r_camber",
      { fx: [["r_camber", "加大"]], theory: "camber/more" },
      null,
      { fx: [["r_camber", "加大"]], theory: "camber/more" },
      { fx: [["r_camber", "減小（趨近 0）"]], theory: "camber/less" }),
    step("r_upper_link_gap",
      { say: "加長", fx: [["r_upper_link_gap", "加長"]] },
      { say: "縮短", fx: [["r_upper_link_gap", "縮短"]] }),

    /* ---------- 後輪座、後下擺臂 ---------- */

    // 理論：後滾動中心（第 15 章），依據同前輪座的上球頭墊片
    step("ru_spacer",
      { say: "加墊片", fx: [["ru_spacer", "加墊片（球頭升高）"]], theory: "r-rc/high" },
      { say: "減墊片", fx: [["ru_spacer", "減少"]], theory: "r-rc/low" }),
    any(["ru_hole"], { say: "換了孔",
      maybe: [["ru_hole", "換到讓後上拉桿變短的孔"], ["ru_hole", "換到讓後上拉桿變長的孔"]], see: "r-rc",
      note: "孔 B 讓後上拉桿變長還是變短，說明書沒有寫，要對照實物" }),
    {
      // 說明書沒有標示原廠用哪個孔，所以只看目前選的是最外還是最內
      items: ["r_arm_shock_hole"],
      pick: function (v) { return v.r_arm_shock_hole === "外孔" ? "outer" : v.r_arm_shock_hole === "內孔" ? "inner" : null; },
      cases: {
        outer: { say: "外孔", fx: [["r_arm_shock_hole", "越靠外側"]] },
        inner: { say: "內孔", fx: [["r_arm_shock_hole", "越靠內側"]] }
      }
    },

    /* ---------- 後輪距、後擺臂座 ---------- */

    // 理論：後車寬（第 4 章）
    track("r_track", "後輪距", "rTrack", "r-track", ["r_offset", "r_hex"], null, ["rsm_f_pos", "rsm_r_pos"]),
    {
      // R 刻度減 F 刻度的差決定後束。量到的後束另外記在「後束」，理論接在那一項
      id: "rsm_gap", name: "後擺臂座刻度差", items: ["rsm_f_pos", "rsm_r_pos"],
      pick: function (v, f) { var d = sign(diff(v, f, "rsm_r_pos") - diff(v, f, "rsm_f_pos")); return d > 0 ? "more" : d < 0 ? "less" : null; },
      show: function (v) { return "F +" + v.rsm_f_pos + "／R +" + v.rsm_r_pos; },
      cases: {
        more: { say: "R 減 F 的差變大", fx: [["rsm_f_pos", "R 刻度減 F 刻度的差越大"]], note: "後束跟著變大，量到的角度記得更新到「後束」" },
        less: { say: "R 減 F 的差變小", note: "後束跟著變小，特性看「後束」那一項；量到的角度記得更新" }
      }
    },
    any(["rsm_f_dir", "rsm_r_dir"], { say: "方向改了",
      maybe: [["rsm_f_dir", "F 支點高於 R（Anti-squat 增加）"], ["rsm_f_dir", "F 支點低於或等於 R（Anti-squat 減少）"],
        ["rsm_f_dir", "F、R 同時升高"], ["rsm_f_dir", "F、R 同時降低"]],
      see: "r-squat", note: NOTE_DIR }),
    mountHeight("rsm_height", "後擺臂座高度", "rsm_f_spacer", "rsm_r_spacer", "r-rc", "F、R 同時升高", "F、R 同時降低"),
    // 理論：後蹲角（第 17 章）。後下擺臂轉軸前高後低是防蹲角，前低後高是助蹲角
    mountTilt("rsm_tilt", "後擺臂座前後高度差", "rsm_f_spacer", "rsm_r_spacer",
      { say: "F 相對變高，往前高後低（防蹲角）", fx: [["rsm_f_spacer", "F 支點高於 R（Anti-squat 增加）"]], theory: "r-squat/anti" },
      { say: "R 相對變高，往前低後高（助蹲角）", fx: [["rsm_f_spacer", "F 支點低於或等於 R（Anti-squat 減少）"]], theory: "r-squat/pro" })

  ], shock("rd", "後", "r"), [

    /* ---------- 差速器、傳動、配置 ---------- */

    // 理論：後差速（第 19 章）。油號和原廠不同才判斷較緊或較鬆；原廠的油號或換了型式時看不出偏向，兩邊都列
    {
      id: "diff", name: "後差速器", items: ["diff_type", "diff_oil"],
      pick: function (v, f) { var d = cmp(v, f, "diff_oil"); return d > 0 ? "tight" : d < 0 ? "loose" : "ref"; },
      show: function (v) { return v.diff_type + "，油 #" + v.diff_oil; },
      cases: {
        tight: { say: "油號比原廠大，較緊", fx: [["diff_type", "越接近鎖死"]], theory: "r-diff/tight", note: NOTE_DIFF },
        loose: { say: "油號比原廠小，較鬆", fx: [["diff_type", "越鬆（差速作用多）"]], theory: "r-diff/loose", note: NOTE_DIFF },
        ref: {
          say: function (v, f) { return changed(v, f, "diff_type") ? "換了型式" : ""; },
          both: [
            { label: "調緊（油號加大，越接近鎖死）", fx: [["diff_type", "越接近鎖死"]], theory: "r-diff/tight" },
            { label: "調鬆（油號減小，差速作用多）", fx: [["diff_type", "越鬆（差速作用多）"]], theory: "r-diff/loose" }
          ],
          note: function (v, f) {
            return (changed(v, f, "diff_type") ? "換上的差速器比原本緊還是鬆，要看它的設定。" : "說明書和原書都沒有寫多少算緊，所以不判斷目前偏哪一邊。") + NOTE_DIFF;
          }
        }
      }
    },
    {
      items: ["gear_mode"],
      pick: function (v) { return /^4/.test(v.gear_mode) ? "four" : /^3/.test(v.gear_mode) ? "three" : null; },
      cases: {
        four: { say: "4 齒輪", fx: [["gear_mode", "4 齒輪（標準）"]] },
        three: { say: "3 齒輪", fx: [["gear_mode", "3 齒輪"]] }
      }
    },
    {
      // 理論：齒比與 Rollout（第 20 章）。輪徑不變時，終傳比的數字變小就是 Rollout 變高
      id: "final_ratio", name: "終傳比", names: true, items: ["spur", "pinion"],
      pick: function (v, f) { var d = sign(diff(v, f, "final_ratio")); return d < 0 ? "tall" : d > 0 ? "short" : null; },
      show: function (v, f) { return f.final_ratio + " → " + v.final_ratio; },
      cases: {
        tall: { say: "數字變小，Rollout 變高", fx: [["pinion", "齒數加大（終傳比數字變小）"]], theory: "gear/high" },
        short: { say: "數字變大，Rollout 變低", fx: [["pinion", "齒數減小（終傳比數字變大）"]], theory: "gear/low" }
      }
    },
    {
      items: ["motor_mode"],
      pick: function (v) { return v.motor_mode ? "set" : null; },
      cases: { set: {
        say: function (v) { return v.motor_mode; },
        fx: function (v) { return v.motor_mode === "MODE 4" ? [["motor_mode", "MODE 4"]] : []; },
        maybe: [["motor_mode", "馬達越高"], ["motor_mode", "馬達越低"]],
        note: "四種位置哪一種比較高，說明書沒有標示"
      } }
    },
    {
      items: ["esc_pos"],
      pick: function (v) { return /^後/.test(v.esc_pos) ? "high" : /^底/.test(v.esc_pos) ? "low" : null; },
      cases: {
        high: { say: "後齒箱座", fx: [["esc_pos", "後齒箱固定座（高、靠後）"]] },
        low: { say: "底板", fx: [["esc_pos", "底板（低）"]] }
      }
    },
    {
      items: ["battery_type"],
      pick: function (v) { return /^薄/.test(v.battery_type) ? "thin" : /^一般/.test(v.battery_type) ? "tall" : null; },
      cases: {
        thin: { say: "薄型短電池", fx: [["battery_type", "薄型短電池"], ["battery_type", "電池越薄越輕"]] },
        tall: { say: "一般型電池", maybe: [["battery_type", "薄型短電池"], ["battery_type", "電池越薄越輕"]], note: "下面兩句講的是薄型電池，一般型沒有這些好處" }
      }
    },

    /* ---------- 輪胎 ---------- */

    any(["f_tire"], { say: "換了輪胎", maybe: [["f_tire", "前胎相對後胎越抓"], ["f_tire", "前胎相對後胎越滑"]], note: "新的胎比原本抓還是滑，要自己判斷" }),
    any(["r_tire"], { say: "換了輪胎", maybe: [["r_tire", "後胎相對越抓"], ["r_tire", "後胎相對越滑"]], note: "新的胎比原本抓還是滑，要自己判斷" })
  ]);

  product.traits = { rules: rules };
})();
