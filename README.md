# 📖 Phàm Nhân Tu Tiên - Web Reader

Trang đọc truyện **Phàm Nhân Nhân Tu Tiên** (Vong Ngữ) — **2468 chương** đầy đủ.

## 🚀 Deploy lên GitHub Pages

### 1. Push lên GitHub

```bash
# Tạo repo trên GitHub trước, rồi:
cd /home/thangvu/pham-nhan-tu-tien
git init
git add .
git commit -m "init: pham nhan tu tien full 2468 chapters"
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

### 2. Bật GitHub Pages

- Vào repo trên GitHub → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: `main`, folder: `/ (root)`
- Save → sau ~2 phút có link: `https://<your-username>.github.io/<repo-name>/`

### 3. Hoặc dùng Vercel (nhanh hơn)

```bash
npm i -g vercel
vercel --prod
```

## 📁 Cấu trúc

```
pham-nhan-tu-tien/
├── index.html              ← Web reader (mở là đọc)
├── data/
│   ├── all_chapters_full.json   ← Full 2468 chương (32 MB)
│   └── all_chapters_partial.json  ← Backup
├── README.md
└── .gitignore
```

## 🎮 Tính năng

- 📂 **Chọn chương** từ dropdown + nút Đọc
- ◀️▶️ **Chương trước / sau**
- 🔍 **Nhảy đến chương** bằng ô nhập số
- ⌨️ **Phím tắt**: ← → để chuyển chapter
- 🔗 **Bookmark**: link dạng `index.html#123`
- 📱 **Responsive**: xem được trên mobile

## ⚡ Lưu ý

- File JSON ~32 MB, lần đầu tải có thể hơi chậm nếu mạng yếu
- Dùng GitHub Pages hoặc Vercel để host free
- Không cần server backend — thuần HTML + JS tĩnh

---

📝 Dữ liệu crawl từ TruyenFull. Chỉ dùng cho mục đích học tập cá nhân.
