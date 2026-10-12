# RC／Futaba 踩坑筆記

來源：Notion 頁面「RC／Futaba 踩坑筆記」（最後編輯 2026-10-09），2026-10-12 複製進本專案。
原筆記記錄的機型是 T7PX + R334SBS + GYD550。

## 1. 進入更新狀態操作步驟

### 接收機（R334SBS）進入更新模式

1. 上電前，先按住接收機的對頻（Link）按鈕
2. 按住不放，接上電源
3. 看到紅燈閃一下後，**1 秒內**放開按鈕
4. 再次按住約 **4 秒**
5. 紅綠燈同時亮起 → 已進入更新模式（update ready）

### 遙控器（T7PX）進入更新模式

- 按住 **HOME** 鍵，再按電源鍵開機

### 注意

- 第 3 步放開太慢會進不了更新模式，需斷電重來
- 更新過程中不可斷電、不可拔線

---

## 2. 接收機更新「找不到檔案」踩坑（T7PX + R334SBS + GYD550）

### 目的

讓 GYD550 能透過遙控器無線設定進階參數，需更新 T7PX 與 R334SBS 韌體（R334SBS 需 V4.x）。

### 最終解法（關鍵）

1. 準備一張**空白** microSD（32GB、FAT32）
2. 插進遙控器，**先隨意儲存一個模型資料** → 由遙控器自己在卡上建立 FUTABA 資料夾
3. 把更新檔內容放進這個由遙控器建立的 FUTABA 資料夾
4. 插回遙控器 → Menu → System → Receiver update → 完成

### 根因推測

電腦手動建立或直接複製的 FUTABA 資料夾，結構／屬性與遙控器預期不一致，遙控器讀不到。讓遙控器自己建資料夾就能對上。

### 踩過但不是主因的坑

- zip 未解壓縮直接放卡
- FUTABA 資料夾多包一層，不在根目錄
- 卡上有舊資料夾，新舊混雜
- 誤放遙控器更新檔／PC 版接收機更新檔（PC 版含 .exe，給 CIU-3 用）
- 遙控器本體版本太舊，沒有對應 Receiver update 項目
- R334SBS 與 R334SBS-E 型號選錯

### 連線提醒

- 遙控器背面 COM 埠 ↔ 接收機 S.BUS2 埠，用公對公伺服線，注意訊號/+/− 方向
- 更新中不可斷電、不可拔線

### 備案

遙控器更新失敗時，可改用 CIU-3/CIU-2 + 電腦更新。

---

## 3. GYD550 設定重點

- 本體按鈕可設：Servo type、Reverse、Neutral、Limit、Reset、Damper
- Gain 與 AVCS/NORMAL 由 CH3 決定（+ 側 AVCS、− 側 NORMAL），建議從 70% gain 開始，有 hunting 再把 Damper 調溫和
- 進階參數（Tail slide speed、Gyro curve、Stick priority 等）必須遙控器無線設定
- 開機後 3–5 秒初始化期間不要動車和方向盤；遙控器 trim / sub-trim 不要用
- NORMAL：只抵抗旋轉，需自己 counter-steer，手感較自然
- AVCS：鎖住方向，gyro 主動反打，較穩、適合新手；gain 太高易 hunting

### 參考

- [GYD550 Instruction Manual](https://futabausa.com/wp-content/uploads/manuals/GYD550_ENG_0306.pdf)
- [R334SBS Software Update Manual](https://www.manualslib.com/manual/1639649/Futaba-R334sbs.html)
