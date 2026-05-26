# Google Sheets 資料源設定指南 (白話文版)

當 Yahoo Finance 擋住你的電腦抓資料時，我們可以用 Google Sheets 當作跳板。

## 🛠 設定步驟

1. **建立試算表**：去 [Google Sheets](https://sheets.new) 開一個新的空白檔案。
2. **開啟腳本編輯器**：點選選單的 `延伸模組` -> `Apps Script`。
3. **貼上程式碼**：刪除裡面原本的程式碼，把對話框中提供的 `function doGet(e) { ... }` 完整貼上去。
4. **存檔並命名**：點擊上方的儲存圖示，取個名字（例如：Z-Money-Sync）。
5. **部署為網頁應用**：
   - 點擊右上角 `部署` -> `新增部署`。
   - 選取類型點齒輪圖示，選擇 `網頁應用程式`。
   - **誰可以存取**：選 `所有人` (Anyone)。
   - 點擊 `部署`
6. **授權權限**：
   - 點 `授權存取`。
   - 選你的 Google 帳號。
   - 看到「Google 尚未驗證此應用程式」時，點 **進階** (Advanced)。
   - 點最下方的 **前往「Z-Money-Sync」（不安全）**。
   - 點 `允許`。
7. **複製網址**：部署完成後，會看到一個「網頁應用程式網址」，複製它！
8. **更新設定**：
   - 在你的專案目錄下找到 `.env` 檔案。
   - 新增一行：`GOOGLE_SHEET_URL=你的網址`。
   - 例如：`GOOGLE_SHEET_URL=https://script.google.com/macros/s/XXX/exec`

## 💡 原理
- 你的電腦 -> 向 Google Sheets 請求數據
- Google Sheets -> 用內建的 `GOOGLEFINANCE` 抓資料 (Yahoo 不敢擋 Google)
- Google Sheets -> 把資料整理好回傳給你的電腦
- Z-Money -> 畫出漂亮的圖表！
