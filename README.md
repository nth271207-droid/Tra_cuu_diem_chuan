# Tool Crawl Điểm Chuẩn Đại Học 2026 & Web Tra Cứu

Hệ thống thu thập dữ liệu (crawler) điểm chuẩn đại học từ website [Tuyensinh247.com](https://diemthi.tuyensinh247.com/diem-chuan.html), lưu trữ chuẩn hóa bằng **SQLite**, cung cấp công cụ dòng lệnh CLI, tầng dịch vụ Python SDK, REST API và trang web tra cứu điểm trực quan, hiện đại.

---

## 🌟 Tính Năng Nổi Bật

- **Crawler thông minh & đa luồng**:
  - Tự động lấy danh sách gần 300 trường đại học trên cả nước.
  - Bóc tách đa dạng phương thức: Điểm thi THPT, Đánh giá năng lực (HSA, V-ACT), Đánh giá tư duy (TSA), Xét học bạ, Xét tuyển kết hợp, Chứng chỉ quốc tế...
  - Nhận diện năm tuyển sinh (ưu tiên **2026** và các năm mới nhất).
  - Tự động bóc tách các bảng có cấu trúc phức tạp (như bảng đa phương thức của ĐH Y Hà Nội 2026).
  - Loại bỏ hoàn toàn watermark/quảng cáo.
  - Chạy đa luồng (`ThreadPoolExecutor`) siêu tốc độ và có rate-limiting lịch sự.
- **Cơ sở dữ liệu SQLite tối ưu**:
  - Lưu trữ tại `data/benchmark.db`.
  - Đánh index trên các cột `(year, university_code)`, `major_name`, `cutoff_score`, `subject_group`, `method`.
  - Hỗ trợ chế độ WAL (`PRAGMA journal_mode=WAL`) xử lý đồng thời đọc/ghi an toàn.
- **Giao diện Web tra cứu hiện đại**:
  - Tìm kiếm tức thì (live search) theo tên ngành, mã ngành, tên trường.
  - Bộ lọc đa chiều: Trường đại học, năm (2026, 2025), phương thức xét tuyển, tổ hợp môn (A00, B00, D01...), khoảng điểm chuẩn.
  - Sắp xếp linh hoạt, phân trang mượt mà, responsive trên cả mobile và máy tính.
  - Xuất file CSV trực tiếp từ bộ lọc tìm kiếm.
- **Dễ dàng tích hợp**:
  - Cung cấp `BenchmarkService` thuần Python để `import` vào bất kỳ project nào (FastAPI, Flask, Django, Streamlit...).
  - Cung cấp REST API đầy đủ với tài liệu OpenAPI tương tác tại `/docs`.

---

## 📁 Cấu Trúc Dự Án

```
goofy-babbage/
├── crawler/
│   ├── __init__.py
│   ├── parser.py          # Parser HTML bóc tách bảng điểm, năm, ngành, phương thức
│   └── scraper.py         # Engine crawl đa luồng với session & retry
├── db/
│   ├── __init__.py
│   ├── database.py        # Quản lý kết nối SQLite, tạo bảng và đánh chỉ mục
│   └── service.py         # Lớp dịch vụ truy vấn, tìm kiếm đa tiêu chí & thống kê
├── web/
│   ├── static/
│   │   ├── css/style.css  # Giao diện responsive tra cứu điểm
│   │   └── js/app.js      # Logic tìm kiếm realtime, lọc, phân trang, xuất CSV
│   └── templates/
│       └── index.html     # Giao diện web tra cứu điểm chuẩn
├── data/
│   └── benchmark.db       # Cơ sở dữ liệu SQLite lưu trữ thông tin
├── tests/
│   └── test_system.py     # Bộ kiểm thử tự động
├── app.py                 # FastAPI server cung cấp REST API & phục vụ Web UI
├── main.py                # Công cụ dòng lệnh CLI (crawl, search, serve, stats, export)
├── requirements.txt       # Danh sách thư viện phụ thuộc
└── README.md              # Hướng dẫn sử dụng chi tiết
```

---

## 🚀 Hướng Dẫn Cài Đặt

### 1. Cài đặt thư viện phụ thuộc
```bash
pip install -r requirements.txt
```

---

## 💻 Hướng Dẫn Sử Dụng CLI (`main.py`)

### 1. Thu thập dữ liệu (Crawl)
```bash
# Crawl thử nghiệm 15 trường đầu tiên với 4 luồng
python main.py crawl --limit 15 --workers 4

# Crawl toàn bộ ~300 trường đại học trên cả nước
python main.py crawl --workers 5

# Chỉ định năm mục tiêu (mặc định 2026)
python main.py crawl --year 2026
```

### 2. Xem thống kê dữ liệu
```bash
python main.py stats
```

### 3. Tra cứu điểm chuẩn trên terminal
```bash
# Tìm ngành theo từ khóa
python main.py search "Công nghệ thông tin"

# Lọc theo trường và năm 2026
python main.py search "Y khoa" --uni YHB --year 2026

# Lọc theo phương thức thi THPT và khoảng điểm từ 24 đến 28
python main.py search --method "THPT" --min-score 24.0 --max-score 28.0 --limit 15
```

### 4. Khởi chạy Web Server tra cứu
```bash
python main.py serve --port 8000
```
Truy cập:
- Trang tra cứu điểm: **http://127.0.0.1:8000**
- Tài liệu API (Swagger UI): **http://127.0.0.1:8000/docs**

### 5. Xuất dữ liệu ra file
```bash
# Xuất toàn bộ ra file CSV
python main.py export --format csv --out diem_chuan_full.csv

# Xuất dữ liệu năm 2026 ra file JSON
python main.py export --year 2026 --format json --out diem_chuan_2026.json
```

---

## 🔌 Hướng Dẫn Tích Hợp Vào Trang Web Của Bạn

### Cách 1: Sử dụng Thư Viện Python Trực Tiếp (Khuyên Dùng Cho Dự Án Python)
Nếu trang web tra cứu điểm của bạn viết bằng **FastAPI**, **Flask**, **Django** hoặc **Streamlit**, bạn chỉ cần import `BenchmarkService`:

```python
from db.service import BenchmarkService

# Khởi tạo service (kết nối trực tiếp tới SQLite benchmark.db)
service = BenchmarkService()

# 1. Tìm kiếm điểm chuẩn theo nhiều tiêu chí
results = service.search_scores(
    keyword="Trí tuệ nhân tạo",    # Từ khóa tìm kiếm
    university_code="BKA",          # Mã trường
    year=2026,                     # Năm
    method="THPT",                 # Phương thức xét tuyển
    subject_group="A00",           # Khối / tổ hợp môn
    min_score=25.0,                # Điểm thấp nhất
    max_score=30.0,                # Điểm cao nhất
    page=1,
    page_size=20
)

print("Tổng kết quả:", results["total"])
for item in results["items"]:
    print(f"{item['university_code']} - {item['major_name']}: {item['cutoff_score']}")

# 2. Lấy danh sách các trường đại học
universities = service.get_universities()

# 3. Lấy danh sách các phương thức và tổ hợp môn
methods = service.get_methods()
subjects = service.get_popular_subjects()
```

---

### Cách 2: Tích Hợp Qua REST API (Cho Next.js, React, Vue, PHP, Mobile App...)
Khởi chạy `python main.py serve --port 8000` và gọi các endpoint REST API:

- **`GET /api/scores`**: Tra cứu điểm chuẩn.
  - *Query Params*: `keyword`, `university_code`, `year`, `method`, `subject_group`, `min_score`, `max_score`, `sort_by`, `sort_order`, `page`, `page_size`.
- **`GET /api/universities`**: Danh sách tất cả các trường.
- **`GET /api/years`**: Danh sách các năm có điểm.
- **`GET /api/methods`**: Danh sách các phương thức tuyển sinh.
- **`GET /api/subjects`**: Danh sách khối thi / tổ hợp môn.
- **`GET /api/stats`**: Thống kê tổng quan.

Ví dụ gọi bằng JavaScript (`fetch`):
```javascript
const response = await fetch("http://127.0.0.1:8000/api/scores?keyword=Kinh+tế&year=2026&page=1");
const data = await response.json();
console.log("Tổng số ngành:", data.total);
console.log("Danh sách ngành:", data.items);
```

---

### Cách 3: Truy Vấn Trực Tiếp CSDL SQLite (`data/benchmark.db`)
Bạn có thể kết nối file CSDL `data/benchmark.db` từ bất kỳ ngôn ngữ nào bằng câu lệnh SQL:

```sql
-- Tìm điểm chuẩn năm 2026 theo tổ hợp môn A00
SELECT university_code, university_name, major_name, cutoff_score, method, notes
FROM admission_scores
WHERE year = 2026 AND subject_group LIKE '%A00%'
ORDER BY cutoff_score DESC;
```

---

## 🗄️ Cấu Trúc Bảng SQLite

### Bảng `universities` (Thông tin trường)
| Cột | Kiểu | Mô tả |
|---|---|---|
| `code` | TEXT (PK) | Mã trường (BKA, KHA, YHB...) |
| `name` | TEXT | Tên đầy đủ của trường đại học |
| `url` | TEXT | Đường dẫn chi tiết trên Tuyensinh247 |
| `created_at` | TIMESTAMP | Thời gian tạo |
| `updated_at` | TIMESTAMP | Thời gian cập nhật gần nhất |

### Bảng `admission_scores` (Điểm chuẩn chi tiết)
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | INTEGER (PK) | Khóa chính tự tăng |
| `university_code` | TEXT | Mã trường (Foreign Key) |
| `university_name` | TEXT | Tên trường |
| `year` | INTEGER | Năm tuyển sinh (2026, 2025...) |
| `method` | TEXT | Phương thức xét tuyển (THPT, ĐGNL, TSA...) |
| `major_code` | TEXT | Mã ngành (nếu có) |
| `major_name` | TEXT | Tên ngành / chuyên ngành |
| `subject_group` | TEXT | Tổ hợp môn xét tuyển (A00, B00...) |
| `cutoff_score` | REAL | Điểm chuẩn dạng số thực |
| `cutoff_score_text` | TEXT | Điểm chuẩn dạng chuỗi gốc |
| `notes` | TEXT | Ghi chú môn chính, tiêu chí phụ |
| `quota` | TEXT | Chỉ tiêu tuyển sinh |
