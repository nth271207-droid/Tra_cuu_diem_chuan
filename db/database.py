import sqlite3
import os
from contextlib import contextmanager
from typing import List, Dict, Any, Optional, Generator

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "benchmark.db")

class Database:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.init_db()

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
        finally:
            conn.close()

    def init_db(self):
        """Khởi tạo các bảng và chỉ mục tối ưu cho việc tra cứu"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Bảng danh sách trường đại học
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS universities (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Bảng điểm chuẩn chi tiết
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS admission_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                university_code TEXT NOT NULL,
                university_name TEXT NOT NULL,
                year INTEGER NOT NULL,
                method TEXT NOT NULL,
                major_code TEXT DEFAULT '',
                major_name TEXT NOT NULL,
                subject_group TEXT DEFAULT '',
                cutoff_score REAL DEFAULT NULL,
                cutoff_score_text TEXT NOT NULL,
                notes TEXT DEFAULT '',
                quota TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (university_code) REFERENCES universities(code) ON DELETE CASCADE,
                UNIQUE(university_code, year, method, major_code, major_name, subject_group, cutoff_score_text) ON CONFLICT REPLACE
            );
            """)

            # Bảng nhật ký crawl
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawl_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_year INTEGER,
                universities_crawled INTEGER DEFAULT 0,
                scores_inserted INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP,
                error_message TEXT
            );
            """)

            # Các chỉ mục để tăng tốc độ tìm kiếm và lọc
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scores_uni_year ON admission_scores(university_code, year);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scores_year ON admission_scores(year);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scores_major ON admission_scores(major_name);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scores_score ON admission_scores(cutoff_score);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scores_subject ON admission_scores(subject_group);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scores_method ON admission_scores(method);")
            
            conn.commit()

    def upsert_university(self, code: str, name: str, url: str) -> None:
        """Lưu hoặc cập nhật thông tin trường"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO universities (code, name, url, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                url = excluded.url,
                updated_at = CURRENT_TIMESTAMP;
            """, (code, name, url))
            conn.commit()

    def upsert_universities_batch(self, universities: List[Dict[str, Any]]) -> int:
        """Lưu danh sách trường theo lô"""
        if not universities:
            return 0
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
            INSERT INTO universities (code, name, url, updated_at)
            VALUES (:code, :name, :url, CURRENT_TIMESTAMP)
            ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                url = excluded.url,
                updated_at = CURRENT_TIMESTAMP;
            """, universities)
            conn.commit()
            return len(universities)

    def insert_scores_batch(self, scores: List[Dict[str, Any]]) -> int:
        """Lưu danh sách điểm chuẩn theo lô"""
        if not scores:
            return 0
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
            INSERT INTO admission_scores (
                university_code, university_name, year, method,
                major_code, major_name, subject_group,
                cutoff_score, cutoff_score_text, notes, quota
            ) VALUES (
                :university_code, :university_name, :year, :method,
                :major_code, :major_name, :subject_group,
                :cutoff_score, :cutoff_score_text, :notes, :quota
            )
            ON CONFLICT(university_code, year, method, major_code, major_name, subject_group, cutoff_score_text)
            DO UPDATE SET
                cutoff_score = excluded.cutoff_score,
                notes = excluded.notes,
                quota = excluded.quota;
            """, scores)
            conn.commit()
            return len(scores)

    def log_crawl_start(self, target_year: Optional[int] = None) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO crawl_logs (target_year, status, started_at)
            VALUES (?, 'RUNNING', CURRENT_TIMESTAMP)
            """, (target_year,))
            conn.commit()
            return cursor.lastrowid

    def log_crawl_finish(self, log_id: int, universities_crawled: int, scores_inserted: int, status: str = "SUCCESS", error_msg: Optional[str] = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE crawl_logs
            SET universities_crawled = ?,
                scores_inserted = ?,
                status = ?,
                finished_at = CURRENT_TIMESTAMP,
                error_message = ?
            WHERE id = ?
            """, (universities_crawled, scores_inserted, status, error_msg, log_id))
            conn.commit()
