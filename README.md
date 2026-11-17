# AI Avatar Studio（一站式聲音克隆 × 人物對嘴平台）

這是一個可在本機執行前後端 Studio 介面，並透過 **Google Colab GPU** 進行真實「聲音克隆（F5-TTS）」與「人物對嘴（Wav2Lip）」推論的完整平台。

## 專案架構
- `backend/`：FastAPI 後端服務（管理分身素材、聲音模型、非同步任務佇列與 Colab 串接）
- `frontend/`：React + Vite + Tailwind CSS Studio 操作介面
- `colab/AI_Avatar_Colab_Worker.ipynb`：可上傳至 Google Colab 執行的 GPU Worker 筆記本

## 本機啟動方式

### 1. 啟動後端（Port 8000）
```powershell
cd e:\Downloads\ai-avatar-studio\backend
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000
```

### 2. 啟動前端（Port 5173）
```powershell
cd e:\Downloads\ai-avatar-studio\frontend
npm run dev
```
開啟瀏覽器前往 `http://localhost:5173` 即可使用！

## 串接 Google Colab GPU 生成真實影片
1. 將 `colab/AI_Avatar_Colab_Worker.ipynb` 上傳至 [Google Colab](https://colab.research.google.com/)。
2. 切換執行階段為 **T4 GPU**，依序執行 3 個儲存格。
3. 複製第 3 個儲存格輸出的 `https://xxxx.trycloudflare.com` 網址。
4. 回到本機網頁右上角點擊狀態按鈕 $\rightarrow$ 關閉「Demo 模擬模式」$\rightarrow$ 貼上 Colab Worker URL $\rightarrow$ 點擊「測試 Colab 連線」並儲存，即可開始生成！
