# HTML Stopwatch

精巧的線上碼錶，提供毫秒顯示、快捷鍵與同步迷你視窗。

[開啟線上碼錶](https://pulipulichen.github.io/html-stopwatch/)

## 操作

- **開始／暫停**：按下按鈕或 `Space`。
- **重設**：按下按鈕或 `Escape`，停止計時並歸零，保留標題。
- **複製**：複製當下的 `HH:MM:SS.mmm`。
- **編輯標題**：點擊標題，按 `Enter` 或離開欄位儲存；`Escape` 取消。編輯時不會觸發碼錶快捷鍵。
- **迷你視窗**：點擊右上角 ↗。主頁與迷你視窗共同控制同一個碼錶。
- **歷史紀錄**：點擊主頁右上角 ◷。暫停或重設時，自動保存當下的標題、操作日期時間、毫秒耗時與操作類型；可逐筆刪除，或確認後全部清除。迷你視窗的操作也會即時同步至此。
- **安裝 PWA**：使用瀏覽器的安裝功能；支援安裝提示的瀏覽器也會顯示 ↓。

標題只佔一行，超出寬度才啟動跑馬燈。開始前與文字尾端各停一秒，以約每秒 30 CSS px 捲動，重複之間保留空隙；偏好減少動態效果時維持靜態。

分頁標題顯示 `MM:SS - 自訂標題`，一小時以上才顯示 `HH:MM:SS`，不顯示毫秒。空標題以 HTML Stopwatch 代替。

## 同步與計時

採用時間戳計算經過時間，而非累加畫面更新次數。畫面更新頻率受螢幕與瀏覽器限制，毫秒數字不代表每毫秒重繪。

同一瀏覽器、相同來源的視窗透過 localStorage 同步；支援 Web Locks 的瀏覽器會序列化操作，避免同時改寫。重新載入仍可接續計時。需要允許網站儲存；不提供跨裝置同步。

迷你視窗要求 popup 模式與隱藏工具列；實際外框、網址列及最小尺寸由瀏覽器決定，網站無法保證完全移除。若被阻擋，請允許此網站的彈出式視窗。

## 歷史紀錄

暫停後再重設會留下兩筆不同操作的紀錄；開始、恢復計時與零耗時重設不會新增紀錄。標題是操作當下的快照，後續編輯不會改動舊紀錄。日期時間以本機時區顯示，耗時採 `MM:SS.mmm`，一小時以上才顯示 `HH:MM:SS.mmm`。

歷史紀錄使用 localStorage，每筆使用獨立的 `html-stopwatch:history:v1:` 前綴鍵，避免雙視窗同時新增時覆蓋其他紀錄，最多保留最新 500 筆。重新載入、重新開啟瀏覽器或同一瀏覽器環境的 PWA 後仍保留；清除網站資料也會清除紀錄。不需要帳號，不會上傳或跨裝置同步。

主頁與迷你視窗透過 storage 事件與 BroadcastChannel 更新紀錄。無法儲存或空間已滿時會顯示提示，當次紀錄先暫存於開啟的視窗，碼錶仍可操作。歷史紀錄視窗開啟時，Space 不控制碼錶，Escape 只關閉視窗。

## GitHub Pages 部署

純靜態 HTML、CSS 與 JavaScript，沒有執行階段外部依賴，所有資源皆使用相對路徑，支援 `/html-stopwatch/` 專案子路徑。

1. 本專案已將 **Settings → Pages → Build and deployment → Source** 設為 **GitHub Actions**。
2. 推送至 `main`，或在 Actions 手動執行 **Test and deploy GitHub Pages**。
3. 工作流程先執行計時單元測試與 Chromium 瀏覽器測試，全部通過後才部署。
4. 網址為 https://pulipulichen.github.io/html-stopwatch/ 。

首次啟用 Pages 需要 repository 管理權限。若 Actions 顯示找不到 Pages site，先完成上述 Source 設定，再重新執行工作流程。

## PWA 與網路

提供 manifest、192/512 px PNG 圖示與 standalone 模式。安裝功能取決於瀏覽器及其安裝政策；iOS 可使用 Safari「加入主畫面」。

不註冊 Service Worker、不建立 Cache Storage、不提供離線 HTML 或資源快取。載入需要網路；一般瀏覽器 HTTP 快取仍由瀏覽器管理。

## 開發與驗證

使用 Node.js 22 與 Python 3。先產生網頁圖示，再以 HTTP 靜態伺服器提供輸出目錄；不要以 file:// 直接開啟：

```sh
npm install
npm test
python3 -m pip install Pillow==12.0.0
python3 scripts/prepare_site.py _site
python3 -m http.server 8080 --directory _site
```

瀏覽器測試由 GitHub Actions 準備具有專案子路徑的測試網站並執行，涵蓋快捷鍵、編輯取消、暫停／恢復、重新載入、雙視窗同步、歷史紀錄與儲存失敗、剪貼簿、窄視窗、跑馬燈與 PWA 資源。

完整需求見 [Issue #1](https://github.com/pulipulichen/html-stopwatch/issues/1) 與 [Issue #2](https://github.com/pulipulichen/html-stopwatch/issues/2)。

## 應用程式圖示

使用你提供的 `assets/icon512.png` 作為圖示來源，部署時自動產生 favicon（32 px）、Apple touch icon（180 px）及 PWA 圖示（192、512 px），保留原始圖檔。網頁左上角也會顯示同一個圖示。未標記為 maskable，以避免瀏覽器裁切原圖內容。
