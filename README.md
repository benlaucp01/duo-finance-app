# 雙人月結理財 App

手機優先的 PWA 記帳工具，適合兩個人記錄每月共同支出。支出可以用外幣輸入，系統會按支出日期換算成 HKD，月尾顯示誰要補誰多少。

## 功能

- 雙人成員帳本與邀請碼介面
- 每筆支出記錄日期、項目、金額、貨幣、付款人、分類、分攤方式和備註
- 支援 HKD、JPY、TWD、USD、EUR、GBP、CNY、KRW、THB、SGD
- 外幣自動查詢兌 HKD 匯率，並支援手動覆蓋匯率
- 月結統計本月總支出、各自已付、各自應付和最終轉帳建議
- 支援自訂分類
- PWA manifest 與 service worker，可部署後加入手機主畫面
- 未設定 Supabase 時會使用本機示範模式，方便立即試用

## 開發

```bash
npm install
npm run dev
```

## Supabase 設定

1. 在 Supabase 建立新專案。
2. 到 SQL Editor 執行 `supabase/schema.sql`。
3. 複製 `.env.example` 為 `.env.local`。
4. 填入：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

目前 App 已包含 Supabase client 和資料庫 schema；未填入環境變數時會退回本機示範模式。正式接雲端 CRUD 時，請把 `src/lib/store.ts` 的 demo fallback 換成 schema 對應的讀寫流程。

## 建置

```bash
npm run build
npm run preview
```
