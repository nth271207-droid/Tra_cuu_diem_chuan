import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from typing import Optional, List, Dict, Any

from db.database import Database
from db.service import BenchmarkService

app = FastAPI(
    title="Đại Học Benchmark",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

# Khởi tạo service
db = Database()
service = BenchmarkService(db=db)

# Mount static files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "web", "static")
static_data_dir = os.path.join(BASE_DIR, "data", "static_data")
os.makedirs(static_dir, exist_ok=True)
os.makedirs(static_data_dir, exist_ok=True)

app.mount("/web/static", StaticFiles(directory=static_dir), name="web_static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.mount("/data/static_data", StaticFiles(directory=static_data_dir), name="static_data")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Giao diện chính trang tra cứu điểm chuẩn"""
    root_html = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(root_html):
        return FileResponse(root_html)
    tmpl_html = os.path.join(BASE_DIR, "web", "templates", "index.html")
    if os.path.exists(tmpl_html):
        return FileResponse(tmpl_html)
    return HTMLResponse("<h1>Trang web tra cứu điểm chuẩn đang chuẩn bị...</h1>")

@app.get("/api/scores")
async def get_scores(
    keyword: Optional[str] = Query(None, description="Từ khóa ngành, trường"),
    university_code: Optional[str] = Query(None, description="Mã trường (ví dụ BKA, KHA)"),
    year: Optional[int] = Query(None, description="Năm tuyển sinh (ví dụ 2026, 2025)"),
    method: Optional[str] = Query(None, description="Phương thức xét tuyển"),
    subject_group: Optional[str] = Query(None, description="Tổ hợp môn xét tuyển (A00, D01...)"),
    min_score: Optional[float] = Query(None, description="Điểm chuẩn tối thiểu"),
    max_score: Optional[float] = Query(None, description="Điểm chuẩn tối đa"),
    sort_by: str = Query("cutoff_score", description="Sắp xếp theo (cutoff_score, year, major_name)"),
    sort_order: str = Query("DESC", description="Thứ tự (ASC, DESC)"),
    view: str = Query("grouped", description="Chế độ hiển thị: 'grouped' (tất cả phương thức 1 hàng) hoặc 'flat'"),
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Số bản ghi mỗi trang")
):
    """API tìm kiếm điểm chuẩn với chế độ gộp ngành và nhiều bộ lọc nâng cao"""
    if view == "grouped":
        return service.search_scores_grouped(
            keyword=keyword,
            university_code=university_code,
            year=year,
            method=method,
            subject_group=subject_group,
            min_score=min_score,
            max_score=max_score,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size
        )
    return service.search_scores(
        keyword=keyword,
        university_code=university_code,
        year=year,
        method=method,
        subject_group=subject_group,
        min_score=min_score,
        max_score=max_score,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )

@app.get("/api/universities")
async def get_universities(search: Optional[str] = None):
    """Lấy danh sách tất cả các trường đại học"""
    return service.get_universities(search=search)

@app.get("/api/years")
async def get_years():
    """Lấy danh sách năm có dữ liệu điểm chuẩn"""
    return service.get_years()

@app.get("/api/methods")
async def get_methods():
    """Lấy danh sách các phương thức xét tuyển"""
    return service.get_methods()

@app.get("/api/subjects")
async def get_subjects():
    """Lấy danh sách các tổ hợp môn phổ biến"""
    return service.get_popular_subjects()

@app.get("/api/stats")
async def get_stats():
    """Thống kê tổng quan cơ sở dữ liệu"""
    return service.get_stats()
