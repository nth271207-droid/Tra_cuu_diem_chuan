import time
import logging
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Callable

from .parser import TuyensinhParser
from db.database import Database

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TuyensinhScraper")

class TuyensinhScraper:
    MAIN_URL = "https://diemthi.tuyensinh247.com/diem-chuan.html"

    def __init__(self, db: Optional[Database] = None, timeout: int = 15):
        self.db = db or Database()
        self.timeout = timeout
        self.session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(pool_connections=30, pool_maxsize=30, max_retries=2)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        })

    def fetch_university_list(self) -> List[Dict[str, Any]]:
        """Lấy danh sách tất cả các trường từ trang chủ Tuyensinh247"""
        logger.info(f"Đang tải danh sách trường từ {self.MAIN_URL}...")
        try:
            resp = self.session.get(self.MAIN_URL, timeout=self.timeout)
            resp.raise_for_status()
            universities = TuyensinhParser.parse_university_list(resp.text)
            logger.info(f"Đã tìm thấy {len(universities)} trường đại học.")
            
            # Lưu vào CSDL
            self.db.upsert_universities_batch(universities)
            return universities
        except Exception as e:
            logger.error(f"Lỗi khi lấy danh sách trường: {e}")
            raise

    def crawl_single_school(
        self, 
        school: Dict[str, Any], 
        target_year: Optional[int] = 2026
    ) -> List[Dict[str, Any]]:
        """Crawl dữ liệu điểm chuẩn của 1 trường cụ thể"""
        url = school["url"]
        code = school["code"]
        name = school["name"]

        try:
            resp = self.session.get(url, timeout=self.timeout)
            if resp.status_code == 404:
                logger.warning(f"Trường {code} không tồn tại hoặc bị 404: {url}")
                return []
            resp.raise_for_status()

            scores = TuyensinhParser.parse_school_page(
                resp.text, 
                school_code=code, 
                school_name=name,
                target_year=target_year
            )

            # Lưu vào CSDL
            if scores:
                self.db.insert_scores_batch(scores)
                logger.info(f"[{code}] {name}: Lưu thành công {len(scores)} bản ghi điểm.")
            else:
                logger.info(f"[{code}] {name}: Chưa có bảng điểm hoặc đang cập nhật.")

            return scores
        except Exception as e:
            logger.error(f"[{code}] Lỗi crawl {url}: {e}")
            return []

    def crawl_all(
        self,
        limit: Optional[int] = None,
        target_year: Optional[int] = 2026,
        workers: int = 5,
        delay: float = 0.3,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Crawl toàn bộ các trường với đa luồng ThreadPoolExecutor
        - limit: giới hạn số trường để test nhanh (None = crawl tất cả)
        - target_year: năm tuyển sinh mục tiêu (mặc định 2026)
        - workers: số luồng song song
        - delay: thời gian nghỉ giữa các yêu cầu
        """
        log_id = self.db.log_crawl_start(target_year)
        start_time = time.time()

        try:
            # 1. Lấy danh sách trường
            universities = self.fetch_university_list()
            if limit and limit > 0:
                universities = universities[:limit]

            total_schools = len(universities)
            logger.info(f"Bắt đầu crawl {total_schools} trường (workers={workers}, target_year={target_year})...")

            total_scores = 0
            crawled_count = 0

            # 2. Chạy đa luồng
            with ThreadPoolExecutor(max_workers=workers) as executor:
                future_to_school = {
                    executor.submit(self.crawl_single_school, school, target_year): school
                    for school in universities
                }

                for future in as_completed(future_to_school):
                    school = future_to_school[future]
                    crawled_count += 1
                    try:
                        scores = future.result()
                        total_scores += len(scores)
                    except Exception as e:
                        logger.error(f"Lỗi trường {school['code']}: {e}")

                    if delay > 0:
                        time.sleep(delay)

                    if progress_callback:
                        progress_callback(crawled_count, total_schools, school["code"])

            elapsed = round(time.time() - start_time, 2)
            logger.info(f"Hoàn tất crawl: {crawled_count}/{total_schools} trường, tổng cộng {total_scores} điểm chuẩn trong {elapsed}s.")

            self.db.log_crawl_finish(log_id, crawled_count, total_scores, "SUCCESS")

            return {
                "status": "SUCCESS",
                "universities_crawled": crawled_count,
                "scores_inserted": total_scores,
                "elapsed_seconds": elapsed,
                "target_year": target_year
            }
        except Exception as e:
            logger.error(f"Quá trình crawl thất bại: {e}")
            self.db.log_crawl_finish(log_id, 0, 0, "FAILED", str(e))
            return {
                "status": "FAILED",
                "error": str(e),
                "elapsed_seconds": round(time.time() - start_time, 2)
            }
