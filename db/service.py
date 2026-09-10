from typing import List, Dict, Any, Optional, Tuple
from .database import Database

class BenchmarkService:
    """Lớp dịch vụ cung cấp các hàm tra cứu và tích hợp dữ liệu điểm chuẩn"""
    
    def __init__(self, db: Optional[Database] = None):
        self.db = db or Database()

    def get_universities(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lấy danh sách các trường đại học kèm tổng số ngành đã có điểm"""
        query = """
        SELECT u.code, u.name, u.url, 
               COUNT(s.id) as total_records,
               COUNT(DISTINCT s.year) as total_years
        FROM universities u
        LEFT JOIN admission_scores s ON u.code = s.university_code
        """
        params = []
        if search:
            query += " WHERE u.code LIKE ? OR u.name LIKE ?"
            like_term = f"%{search.strip()}%"
            params.extend([like_term, like_term])
            
        query += " GROUP BY u.code, u.name, u.url ORDER BY u.name ASC"
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_years(self) -> List[int]:
        """Lấy danh sách các năm có dữ liệu điểm chuẩn"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT year FROM admission_scores ORDER BY year DESC")
            return [row["year"] for row in cursor.fetchall()]

    def get_methods(self) -> List[str]:
        """Lấy danh sách các phương thức xét tuyển"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT method FROM admission_scores WHERE method != '' ORDER BY method ASC")
            return [row["method"] for row in cursor.fetchall()]

    def get_popular_subjects(self) -> List[str]:
        """Lấy danh sách tổ hợp môn phổ biến"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT subject_group, COUNT(*) as count 
            FROM admission_scores 
            WHERE subject_group != '' 
            GROUP BY subject_group 
            ORDER BY count DESC 
            LIMIT 25
            """)
            return [row["subject_group"] for row in cursor.fetchall()]

    def search_scores(
        self,
        keyword: Optional[str] = None,
        university_code: Optional[str] = None,
        year: Optional[int] = None,
        method: Optional[str] = None,
        subject_group: Optional[str] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        sort_by: str = "cutoff_score",
        sort_order: str = "DESC",
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Tra cứu điểm chuẩn đa tiêu chí:
        - keyword: từ khóa tìm theo tên ngành, mã ngành hoặc tên trường
        - university_code: mã trường (BKA, KHA...)
        - year: năm (2026, 2025...)
        - method: phương thức xét tuyển
        - subject_group: tổ hợp môn (A00, B00...)
        - min_score, max_score: khoảng điểm chuẩn
        """
        conditions = []
        params = []

        if keyword and keyword.strip():
            k = f"%{keyword.strip()}%"
            conditions.append("(major_name LIKE ? OR major_code LIKE ? OR university_name LIKE ? OR university_code LIKE ?)")
            params.extend([k, k, k, k])

        if university_code and university_code.strip():
            conditions.append("university_code = ?")
            params.append(university_code.strip().upper())

        if year:
            conditions.append("year = ?")
            params.append(int(year))

        if method and method.strip():
            conditions.append("method LIKE ?")
            params.append(f"%{method.strip()}%")

        if subject_group and subject_group.strip():
            conditions.append("subject_group LIKE ?")
            params.append(f"%{subject_group.strip()}%")

        if min_score is not None:
            conditions.append("cutoff_score >= ?")
            params.append(float(min_score))

        if max_score is not None:
            conditions.append("cutoff_score <= ?")
            params.append(float(max_score))

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        # Đếm tổng số kết quả
        count_query = f"SELECT COUNT(*) as total FROM admission_scores {where_clause}"
        
        # Valid sort fields
        valid_sort_fields = {
            "cutoff_score": "cutoff_score",
            "year": "year",
            "major_name": "major_name",
            "university_code": "university_code"
        }
        order_col = valid_sort_fields.get(sort_by, "cutoff_score")
        order_dir = "ASC" if sort_order.upper() == "ASC" else "DESC"

        # Phân trang
        offset = max(0, (page - 1) * page_size)
        data_query = f"""
        SELECT id, university_code, university_name, year, method,
               major_code, major_name, subject_group,
               cutoff_score, cutoff_score_text, notes, quota
        FROM admission_scores
        {where_clause}
        ORDER BY {order_col} {order_dir}, university_code ASC
        LIMIT ? OFFSET ?
        """
        data_params = list(params) + [page_size, offset]

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(count_query, params)
            total = cursor.fetchone()["total"]

            cursor.execute(data_query, data_params)
            rows = [dict(r) for r in cursor.fetchall()]

        total_pages = (total + page_size - 1) // page_size if total > 0 else 1

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "items": rows
        }

    def search_scores_grouped(
        self,
        keyword: Optional[str] = None,
        university_code: Optional[str] = None,
        year: Optional[int] = None,
        method: Optional[str] = None,
        subject_group: Optional[str] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        sort_by: str = "cutoff_score",
        sort_order: str = "DESC",
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Tra cứu điểm chuẩn gộp theo từng ngành (1 ngành hiển thị tất cả các phương thức trên 1 hàng):
        - keyword, university_code, year, method, subject_group, min_score, max_score
        """
        conditions = []
        params = []

        if keyword and keyword.strip():
            k = f"%{keyword.strip()}%"
            conditions.append("(major_name LIKE ? OR major_code LIKE ? OR university_name LIKE ? OR university_code LIKE ?)")
            params.extend([k, k, k, k])

        if university_code and university_code.strip():
            conditions.append("university_code = ?")
            params.append(university_code.strip().upper())

        if year:
            conditions.append("year = ?")
            params.append(int(year))

        if method and method.strip():
            conditions.append("method LIKE ?")
            params.append(f"%{method.strip()}%")

        if subject_group and subject_group.strip():
            conditions.append("subject_group LIKE ?")
            params.append(f"%{subject_group.strip()}%")

        if min_score is not None:
            conditions.append("cutoff_score >= ?")
            params.append(float(min_score))

        if max_score is not None:
            conditions.append("cutoff_score <= ?")
            params.append(float(max_score))

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        # 1. Đếm tổng số ngành duy nhất
        count_sql = f"""
        SELECT COUNT(*) as total FROM (
            SELECT 1
            FROM admission_scores
            {where_clause}
            GROUP BY university_code, year, major_name
        )
        """

        # Sắp xếp
        order_dir = "ASC" if sort_order.upper() == "ASC" else "DESC"
        if sort_by == "year":
            sort_expr = "year"
        elif sort_by == "major_name":
            sort_expr = "major_name"
        elif sort_by == "university_code":
            sort_expr = "university_code"
        else:
            sort_expr = "MAX(cutoff_score)"

        offset = max(0, (page - 1) * page_size)

        data_sql = f"""
        WITH page_majors AS (
            SELECT university_code, year, major_name, {sort_expr} as sort_metric
            FROM admission_scores
            {where_clause}
            GROUP BY university_code, year, major_name
            ORDER BY sort_metric {order_dir}, university_code ASC
            LIMIT ? OFFSET ?
        )
        SELECT s.university_code, s.university_name, s.year, s.major_code, s.major_name,
               s.method, s.subject_group, s.cutoff_score, s.cutoff_score_text, s.notes, s.quota
        FROM admission_scores s
        JOIN page_majors pm
          ON s.university_code = pm.university_code
         AND s.year = pm.year
         AND s.major_name = pm.major_name
        ORDER BY pm.sort_metric {order_dir}, s.university_code ASC, s.method ASC, s.cutoff_score DESC
        """
        data_params = list(params) + [page_size, offset]

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(count_sql, params)
            total = cursor.fetchone()["total"]

            cursor.execute(data_sql, data_params)
            rows = cursor.fetchall()

        # Nhóm dữ liệu các phương thức theo từng ngành
        grouped_dict = {}
        for r in rows:
            key = (r["university_code"], r["year"], r["major_name"])
            if key not in grouped_dict:
                grouped_dict[key] = {
                    "university_code": r["university_code"],
                    "university_name": r["university_name"],
                    "year": r["year"],
                    "major_code": r["major_code"],
                    "major_name": r["major_name"],
                    "quota": r["quota"],
                    "methods": []
                }
            elif not grouped_dict[key]["quota"] and r["quota"]:
                grouped_dict[key]["quota"] = r["quota"]

            # Kiểm tra xem phương thức và mức điểm này đã có trong danh sách chưa
            existing = next(
                (m for m in grouped_dict[key]["methods"] 
                 if m["method"] == r["method"] and m["cutoff_score_text"] == r["cutoff_score_text"]),
                None
            )
            if existing:
                if r["subject_group"] and r["subject_group"] not in existing["subject_group"]:
                    existing["subject_group"] = f"{existing['subject_group']}, {r['subject_group']}".strip(", ")
            else:
                grouped_dict[key]["methods"].append({
                    "method": r["method"],
                    "cutoff_score": r["cutoff_score"],
                    "cutoff_score_text": r["cutoff_score_text"],
                    "subject_group": r["subject_group"],
                    "notes": r["notes"]
                })

        total_pages = (total + page_size - 1) // page_size if total > 0 else 1

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "items": list(grouped_dict.values())
        }

    def get_stats(self) -> Dict[str, Any]:
        """Thống kê tổng quan cơ sở dữ liệu"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as uni_count FROM universities")
            uni_count = cursor.fetchone()["uni_count"]

            cursor.execute("SELECT COUNT(*) as score_count FROM admission_scores")
            score_count = cursor.fetchone()["score_count"]

            cursor.execute("SELECT DISTINCT year FROM admission_scores ORDER BY year DESC")
            years = [r["year"] for r in cursor.fetchall()]

            cursor.execute("""
            SELECT year, COUNT(*) as count, AVG(cutoff_score) as avg_score,
                   MAX(cutoff_score) as max_score, MIN(cutoff_score) as min_score
            FROM admission_scores
            WHERE cutoff_score IS NOT NULL
            GROUP BY year
            ORDER BY year DESC
            """)
            year_stats = [dict(r) for r in cursor.fetchall()]

            cursor.execute("SELECT * FROM crawl_logs ORDER BY id DESC LIMIT 1")
            last_log = cursor.fetchone()

            return {
                "total_universities": uni_count,
                "total_scores": score_count,
                "available_years": years,
                "year_stats": year_stats,
                "last_crawl": dict(last_log) if last_log else None
            }
