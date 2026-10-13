/*
 * 檢查「車輛特性」的規則（data/chassis-mst-rmx4-gt-traits.js）有沒有指到不存在的敘述。
 * 規則是用文字對應的：fx 要和車架資料檔 effect 的條件文字一字不差，theory 要對得上設定理論的項目 id。
 * 改了那兩邊的文字或 id 之後跑一次：
 *
 *   node tools/check-traits.js          只報對應有沒有問題
 *   node tools/check-traits.js in,on    另外列出歸到這幾個大項目的敘述（all 是全部），用來看分類的關鍵字合不合理
 *
 * 做法：在 Node 裡載入資料檔與 js/traits.js，把每個欄位逐一改大、改小、換選項，再加幾組一起改的組合，
 * 每一組都跑一次判斷。瀏覽器裡同樣的問題會出現在主控台（「車輛特性：找不到…」），但只會報當下用到的規則。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const window = { RC_PRODUCTS: [], RC_PLUGINS: [] };
const sandbox = { window: window, console: console, document: {} };
vm.createContext(sandbox);
[
  "data/chassis-mst-rmx4-gt.js", "data/chassis-mst-rmx4-gt-upgrades.js", "data/chassis-mst-rmx4-gt-traits.js",
  "data/theory-xray.js", "js/traits.js"
].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
});

const p = window.RC_PRODUCTS.filter(function (x) { return x.id === "mst-rmx4-gt"; })[0];
const items = [];
p.groups.forEach(function (grp) { grp.items.forEach(function (it) { items.push(it); }); });

// 和 js/app.js 的 compute() 一樣：沒有存值的欄位用原廠值，計算欄位最後算
function compute(mine) {
  const eff = {}, fac = {};
  items.forEach(function (it) {
    if (it.calc) return;
    fac[it.id] = it.factory == null ? "" : String(it.factory);
    eff[it.id] = mine[it.id] != null ? String(mine[it.id]) : fac[it.id];
  });
  items.forEach(function (it) {
    if (!it.calc) return;
    eff[it.id] = String(it.calc(eff));
    fac[it.id] = String(it.calc(fac));
  });
  return { eff: eff, fac: fac };
}

const problems = {}, fired = {}, seen = {};
let runs = 0;
function run(mine) {
  const st = compute(mine);
  const res = window.RCTraits.evaluate(p, st.eff, st.fac);
  res.problems.forEach(function (text) { problems[text] = problems[text] || JSON.stringify(mine); });
  res.findings.forEach(function (f) {
    fired[f.id] = true;
    f.sts.forEach(function (s) { seen[s.text] = s; });
  });
  runs++;
}

run({});
items.forEach(function (it) {
  if (it.calc || /^up_/.test(it.id)) return;
  if (it.type === "num") {
    const base = it.factory != null ? parseFloat(it.factory) : (it.start != null ? it.start : (it.min != null ? it.min : 0));
    const step = it.step || 1;
    [base + step, base - step, base + 3 * step, base - 3 * step, it.min, it.max].forEach(function (n) {
      if (n == null || isNaN(n)) return;
      const mine = {};
      mine[it.id] = String(Math.round(n * 1000) / 1000);
      run(mine);
    });
  } else if (it.type === "select") {
    it.options.forEach(function (option) { const mine = {}; mine[it.id] = option; run(mine); });
  } else {
    const mine = {};
    mine[it.id] = "TEST";
    run(mine);
  }
});
// 要好幾個欄位一起改才會出現的情況
[
  { fsm_f_spacer: "1", fsm_r_spacer: "1" }, { fsm_f_spacer: "2", fsm_r_spacer: "1" }, { fsm_f_spacer: "1", fsm_r_spacer: "2" },
  { rsm_f_spacer: "2", rsm_r_spacer: "2" }, { rsm_f_spacer: "0", rsm_r_spacer: "0" }, { rsm_f_spacer: "2", rsm_r_spacer: "0" },
  { fsm_f_pos: "5.0", fsm_r_pos: "5.0" }, { fsm_f_pos: "3.5", fsm_r_pos: "3.5" },
  { rsm_f_pos: "12.5", rsm_r_pos: "13.0" }, { rsm_f_pos: "13.0", rsm_r_pos: "13.0" }, { rsm_f_pos: "11.5", rsm_r_pos: "13.0" },
  { fd_oil: "15", fd_piston_holes: "6" }, { fd_oil: "15", fd_piston_holes: "2", fd_piston_dia: "0.8" }, { rd_oil: "10", rd_piston_dia: "1.0" },
  { fd_upper_end: "2", fd_rod_len: "11" }, { fd_upper_end: "1", fd_rod_len: "11.5" }, { rd_rod_len: "14" },
  { fd_spring_rate: "2" }, { fd_spring_rate: "5" }, { fd_spring_rate: "9", fd_spring_wire: "1.3" }, { rd_spring_rate: "2" }, { rd_spring_rate: "9" },
  { f_arm_shim_front: "1", f_arm_shim_rear: "3" }, { r_arm_shim_front: "3", r_arm_shim_rear: "1" },
  { f_arm_shim_front: "3", r_arm_shim_front: "0" }, { f_arm_shim_front: "1", r_arm_shim_front: "0" },
  { spur: "80", pinion: "26" }, { spur: "84", pinion: "22" }, { f_ride_height: "5", r_ride_height: "5" }, { f_ride_height: "4", r_ride_height: "6" },
  { f_offset: "9", f_hex: "5" }, { r_hex: "6", rsm_f_pos: "12.5", rsm_r_pos: "13.0" }, { diff_oil: "5000", diff_type: "LSD" }
].forEach(run);

const idle = p.traits.rules.map(function (r) { return r.id || r.items[0]; }).filter(function (id) { return !fired[id]; });
const bad = Object.keys(problems);
console.log("規則 " + p.traits.rules.length + " 條，試了 " + runs + " 組設定，出現過的敘述 " + Object.keys(seen).length + " 句");
console.log("沒被觸發過的規則：" + (idle.join("、") || "無"));
console.log("對應有問題：" + bad.length + " 個");
bad.forEach(function (text) { console.log("  " + text + "（設定：" + problems[text] + "）"); });

if (process.argv[2]) {
  const byCat = {};
  Object.keys(seen).forEach(function (text) {
    seen[text].cats.forEach(function (cat) { (byCat[cat] = byCat[cat] || []).push(seen[text]); });
  });
  (process.argv[2] === "all" ? Object.keys(byCat) : process.argv[2].split(",")).forEach(function (cat) {
    console.log("\n[" + cat + "] " + (byCat[cat] || []).length + " 句");
    (byCat[cat] || []).forEach(function (s) {
      console.log("  (" + s.src + ") " + s.text + (s.tags.length ? "  {" + s.tags.join(" ") + "}" : ""));
    });
  });
}
process.exitCode = bad.length ? 1 : 0;
