# プロセカ 書き下ろし楽曲 二選一

可直接部署到 GitHub Pages 的純靜態網站。歌曲資料固定為 156 首，所有 YouTube 影片連結均來自指定的試算表。

## 檔案結構

```text
index.html             首頁
sorter.html            二選一頁
results.html           結果與圖片輸出頁
404.html               找不到頁面
css/styles.css         共用樣式
js/songs.js            156 首歌曲資料
js/common.js           儲存、排名與共用功能
js/index.js            首頁功能
js/sorter.js           二選一及跳過邏輯
js/results.js          結果顯示及 PNG 輸出
.github/workflows/     GitHub Pages 自動部署
```

## 發布到 GitHub Pages

1. 在 GitHub 建立新的 Repository。
2. 將本資料夾內的所有檔案上傳至 Repository 根目錄，包含 `.github` 與 `.nojekyll`。
3. 確認預設分支名稱為 `main`。
4. 進入 Repository 的 `Settings` → `Pages`。
5. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`。
6. 開啟 `Actions`，等待 `Deploy static site to GitHub Pages` 完成。
7. 部署網址會顯示在工作流程及 `Settings` → `Pages`。

之後每次把修改推送到 `main`，GitHub Actions 都會自動重新發布。

## 不公開搜尋的設定

所有 HTML 頁面都包含：

```html
<meta name="robots" content="noindex, nofollow, noarchive">
```

這會要求搜尋引擎不要收錄頁面，但 GitHub Pages 網址本身仍是公開網址。取得網址的人可以進入，也可以將網址轉傳給其他人。請不要把連結貼在公開網頁或社群貼文中。

## 本機測試

不能只用雙擊 HTML 測試 YouTube 與圖片輸出，建議在此資料夾啟動簡易 HTTP 伺服器，例如：

```powershell
python -m http.server 8080
```

再開啟 `http://localhost:8080/`。

## 資料與隱私

- 沒有使用者帳號或公開排行榜。
- 排序進度只保存在瀏覽器 `localStorage`。
- 清除網站資料或更換瀏覽器後，進度不會保留。
- Top 10 圖片由瀏覽器即時合成，不會上傳或儲存在伺服器。
- 網站與 Top 10 圖片使用 Google Fonts 提供的 `Klee One`；開啟網站時需要網路連線載入字體。
- GitHub Pages 是公開的靜態網站託管服務，不應在 Repository 或網站檔案中放置秘密、密碼或私人資料。
