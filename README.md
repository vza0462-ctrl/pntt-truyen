# 📖 Phàm Nhân Tu Tiên - Web Reader

Trang đọc truyện **Phàm Nhân Tu Tiên** (Vong Ngữ) — **2468 chương** đầy đủ.

## 🚀 Deploy

### GitHub Pages
```bash
git init
git add .
git commit -m "init: pham nhan tu tien"
git remote add origin https://github.com/<username>/<repo>.git
git branch -M main
git push -u origin main
```
Settings → Pages → Deploy từ branch `main`, folder `/ (root)`.

### Vercel (nhanh hơn)
```bash
npm i -g vercel
vercel --prod
```

## 📁 Cấu trúc
```
├── index.html           ← Landing + Reader
├── assets/
│   ├── css/style.css    ← Styles (light/dark theme)
│   └── js/app.js        ← App logic
├── data/
│   ├── index.json       ← Chunk index (fast load)
│   └── chunk_*.json     ← 50 chapters per file
├── README.md
└── .gitignore
```

## 🎮 Tính năng
- 📚 **Landing page** — thông tin truyện, thống kê
- 📋 **Danh sách chương** — tìm kiếm, filter
- 📖 **Đọc truyện** — giao diện sạch, focus vào nội dung
- 🌙 **Dark/Light mode** — chuyển đổi 1 chạm
- 🔤 **Tăng/giảm font size**
- 📌 **Lưu tiến độ** — auto lưu localStorage
- ⌨️ **Phím tắt**: ← → chuyển chương, Escape về home
- 📱 **Responsive** — mobile friendly
- 🔗 **Bookmark** — link dạng `#123`
- ⚡ **Load nhanh** — chia chunk 50 chương/file
