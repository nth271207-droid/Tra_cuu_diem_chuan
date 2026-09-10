import argparse
import sys
import os
import json
import csv
import uvicorn
from typing import Optional

# Ensure UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from crawler.scraper import TuyensinhScraper
from db.database import Database
from db.service import BenchmarkService

def cmd_crawl(args):
    print("=" * 60)
    print(f"🚀 BẮT ĐẦU CRAWL ĐIỂM CHUẨN ĐẠI HỌC")
    print(f"   - Năm mục tiêu: {args.year}")
    print(f"   - Giới hạn số trường: {'Tất cả' if not args.limit else args.limit}")
    print(f"   - Số luồng chạy: {args.workers}")
    print(f"   - Delay giữa các request: {args.delay}s")
    print("=" * 60)

    db = Database()
    scraper = TuyensinhScraper(db=db)

    def on_progress(current, total, code):
        percent = int(current / total * 100)
        bar = "█" * (percent // 5) + "-" * (20 - percent // 5)
        print(f"\r[{bar}] {percent}% ({current}/{total}) Đang xử lý: {code:<6}", end="", flush=True)

    result = scraper.crawl_all(
        limit=args.limit,
        target_year=args.year,
        workers=args.workers,
        delay=args.delay,
        progress_callback=on_progress
    )

    print("\n" + "=" * 60)
    if result["status"] == "SUCCESS":
        print(f"✅ Hoàn thành thành công!")
        print(f"   - Số trường đã crawl: {result['universities_crawled']}")
        print(f"   - Tổng số bản ghi điểm chuẩn: {result['scores_inserted']}")
        print(f"   - Thời gian thực hiện: {result['elapsed_seconds']} giây")
    else:
        print(f"❌ Crawl thất bại: {result.get('error')}")
    print("=" * 60)

def cmd_search(args):
    service = BenchmarkService()
    if getattr(args, "flat", False):
        res = service.search_scores(
            keyword=args.keyword,
            university_code=args.uni,
            year=args.year,
            method=args.method,
            subject_group=args.subject,
            min_score=args.min_score,
            max_score=args.max_score,
            page=1,
            page_size=args.limit
        )

        print("=" * 80)
        print(f"🔍 KẾT QUẢ TÌM KIẾM ({res['total']} kết quả tìm thấy, hiển thị {len(res['items'])} dòng đầu)")
        print("=" * 80)
        
        if not res["items"]:
            print("Không tìm thấy kết quả nào phù hợp.")
            return

        header_fmt = "{:<6} | {:<5} | {:<32} | {:<7} | {:<12} | {:<20}"
        print(header_fmt.format("Năm", "Mã", "Tên ngành", "Điểm", "Tổ hợp", "Phương thức"))
        print("-" * 95)
        for item in res["items"]:
            m_name = item["major_name"][:30]
            pts = (item["method"] or "")[:18]
            score_val = str(item["cutoff_score"]) if item["cutoff_score"] is not None else item["cutoff_score_text"]
            print(header_fmt.format(
                item["year"],
                item["university_code"],
                m_name,
                score_val,
                item["subject_group"] or "-",
                pts
            ))
        print("=" * 80)
        return

    # Mặc định: Gộp tất cả phương thức của 1 ngành trên cùng 1 hàng
    res = service.search_scores_grouped(
        keyword=args.keyword,
        university_code=args.uni,
        year=args.year,
        method=args.method,
        subject_group=args.subject,
        min_score=args.min_score,
        max_score=args.max_score,
        page=1,
        page_size=args.limit
    )

    print("=" * 105)
    print(f"🔍 KẾT QUẢ TÌM KIẾM (Tìm thấy {res['total']} ngành, hiển thị {len(res['items'])} ngành)")
    print("=" * 105)
    if not res["items"]:
        print("Không tìm thấy kết quả nào phù hợp.")
        return

    for item in res["items"]:
        methods_str = "  |  ".join([
            f"{m['method']}: {m['cutoff_score_text']}" + (f" ({m['subject_group']})" if m['subject_group'] else "")
            for m in item["methods"]
        ])
        quota_str = f" [Chỉ tiêu: {item['quota']}]" if item["quota"] else ""
        code_str = f" ({item['major_code']})" if item['major_code'] else ""
        print(f"[{item['year']}] {item['university_code']} - {item['major_name']}{code_str}{quota_str}")
        print(f"       ► Điểm các PT: {methods_str}")
    print("=" * 105)

def cmd_stats(args):
    service = BenchmarkService()
    stats = service.get_stats()
    print("=" * 60)
    print("📊 BÁO CÁO THỐNG KÊ CƠ SỞ DỮ LIỆU ĐIỂM CHUẨN")
    print("=" * 60)
    print(f"Tổng số trường đại học trong DB: {stats['total_universities']}")
    print(f"Tổng số bản ghi điểm chuẩn:     {stats['total_scores']}")
    print(f"Các năm có dữ liệu:             {', '.join(map(str, stats['available_years']))}")
    print("\nChi tiết theo từng năm:")
    for ys in stats["year_stats"]:
        avg = f"{ys['avg_score']:.2f}" if ys['avg_score'] else "N/A"
        print(f"  - Năm {ys['year']}: {ys['count']} bản ghi | Điểm cao nhất: {ys['max_score']} | Điểm thấp nhất: {ys['min_score']} | Trung bình: {avg}")
    
    if stats["last_crawl"]:
        lc = stats["last_crawl"]
        print(f"\nLần crawl gần nhất:")
        print(f"  - Thời gian: {lc['started_at']} -> {lc['finished_at']}")
        print(f"  - Trạng thái: {lc['status']}")
        print(f"  - Đã crawl: {lc['universities_crawled']} trường, lưu {lc['scores_inserted']} điểm")
    print("=" * 60)

def cmd_serve(args):
    import os
    port = int(os.environ.get("PORT", args.port))
    host = os.environ.get("HOST", args.host)
    print("=" * 60)
    print(f"🌐 KHỞI CHẠY TRANG WEB TRA CỨU ĐIỂM CHUẨN")
    print(f"   - Địa chỉ truy cập: http://{host}:{port}")
    print("=" * 60)
    uvicorn.run("app:app", host=host, port=port, reload=args.reload)

def cmd_export(args):
    service = BenchmarkService()
    res = service.search_scores(year=args.year, page_size=100000)
    items = res["items"]
    
    out_path = args.out or f"diem_chuan_{args.year or 'all'}.{args.format}"
    print(f"Đang xuất {len(items)} bản ghi ra file: {out_path}...")

    if args.format.lower() == "csv":
        if items:
            keys = items[0].keys()
            with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(items)
        print(f"✅ Đã xuất file CSV thành công: {out_path}")
    else:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"✅ Đã xuất file JSON thành công: {out_path}")

def cmd_export_static(args=None):
    service = BenchmarkService()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(base_dir, "data", "static_data")
    os.makedirs(out_dir, exist_ok=True)
    print("📦 Đang xuất dữ liệu tĩnh cho GitHub Pages...")

    # 1. Scores grouped
    res = service.search_scores_grouped(page=1, page_size=50000)
    with open(os.path.join(out_dir, "scores_grouped.json"), "w", encoding="utf-8") as f:
        json.dump(res["items"], f, ensure_ascii=False, separators=(",", ":"))

    # 2. Universities
    unis = service.get_universities()
    with open(os.path.join(out_dir, "universities.json"), "w", encoding="utf-8") as f:
        json.dump(unis, f, ensure_ascii=False, separators=(",", ":"))

    # 3. Methods & Subjects & Stats
    with open(os.path.join(out_dir, "methods.json"), "w", encoding="utf-8") as f:
        json.dump(service.get_methods(), f, ensure_ascii=False)
    with open(os.path.join(out_dir, "subjects.json"), "w", encoding="utf-8") as f:
        json.dump(service.get_popular_subjects(), f, ensure_ascii=False)
    with open(os.path.join(out_dir, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(service.get_stats(), f, ensure_ascii=False)

    print(f"✅ Đã xuất dữ liệu tĩnh thành công vào: {out_dir}")

def main():
    parser = argparse.ArgumentParser(
        description="Tool crawl và tra cứu điểm chuẩn đại học 2026 từ Tuyensinh247",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="Lệnh thực thi")

    # Command: crawl
    crawl_parser = subparsers.add_parser("crawl", help="Thu thập dữ liệu điểm chuẩn từ web")
    crawl_parser.add_argument("--year", type=int, default=2026, help="Năm tuyển sinh mục tiêu")
    crawl_parser.add_argument("--limit", type=int, default=None, help="Giới hạn số trường cần crawl (để test)")
    crawl_parser.add_argument("--workers", type=int, default=5, help="Số luồng chạy song song")
    crawl_parser.add_argument("--delay", type=float, default=0.2, help="Độ trễ giữa các request (giây)")
    crawl_parser.set_defaults(func=cmd_crawl)

    # Command: search
    search_parser = subparsers.add_parser("search", help="Tra cứu điểm chuẩn qua dòng lệnh")
    search_parser.add_argument("keyword", nargs="?", default=None, help="Từ khóa tìm kiếm (tên ngành, tên trường)")
    search_parser.add_argument("--uni", type=str, default=None, help="Mã trường (ví dụ: BKA, KHA, YHB)")
    search_parser.add_argument("--year", type=int, default=None, help="Năm tuyển sinh")
    search_parser.add_argument("--method", type=str, default=None, help="Phương thức xét tuyển")
    search_parser.add_argument("--subject", type=str, default=None, help="Tổ hợp môn (ví dụ: A00, D01)")
    search_parser.add_argument("--min-score", type=float, default=None, help="Điểm chuẩn tối thiểu")
    search_parser.add_argument("--max-score", type=float, default=None, help="Điểm chuẩn tối đa")
    search_parser.add_argument("--flat", action="store_true", help="Hiển thị tách từng dòng thay vì gộp theo ngành")
    search_parser.add_argument("--limit", type=int, default=20, help="Số kết quả hiển thị")
    search_parser.set_defaults(func=cmd_search)

    # Command: stats
    stats_parser = subparsers.add_parser("stats", help="Xem thống kê CSDL")
    stats_parser.set_defaults(func=cmd_stats)

    # Command: serve
    serve_parser = subparsers.add_parser("serve", help="Khởi chạy web server tra cứu điểm chuẩn")
    serve_parser.add_argument("--host", type=str, default="127.0.0.1", help="Địa chỉ host")
    serve_parser.add_argument("--port", type=int, default=8000, help="Cổng chạy web server")
    serve_parser.add_argument("--reload", action="store_true", help="Bật chế độ hot reload")
    serve_parser.set_defaults(func=cmd_serve)

    # Command: export
    export_parser = subparsers.add_parser("export", help="Xuất dữ liệu ra file CSV hoặc JSON")
    export_parser.add_argument("--year", type=int, default=None, help="Lọc theo năm tuyển sinh")
    export_parser.add_argument("--format", choices=["csv", "json"], default="csv", help="Định dạng xuất")
    export_parser.add_argument("--out", type=str, default=None, help="Đường dẫn file đầu ra")
    export_parser.set_defaults(func=cmd_export)

    # Command: export-static
    export_static_parser = subparsers.add_parser("export-static", help="Xuất dữ liệu tĩnh cho GitHub Pages")
    export_static_parser.set_defaults(func=cmd_export_static)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)

if __name__ == "__main__":
    main()
