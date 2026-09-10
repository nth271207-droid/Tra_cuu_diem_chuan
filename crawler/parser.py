import re
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional, Tuple

class TuyensinhParser:
    BASE_URL = "https://diemthi.tuyensinh247.com"

    @staticmethod
    def parse_university_list(html: str) -> List[Dict[str, Any]]:
        """
        Bóc tách danh sách các trường đại học từ trang chính diem-chuan.html
        """
        soup = BeautifulSoup(html, "html.parser")
        universities = {}

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            # Match pattern /diem-chuan/slug-CODE.html
            m = re.search(r"^/diem-chuan/([a-zA-Z0-9\-]+)-([A-Z0-9]+)\.html$", href)
            if m:
                code = m.group(2).upper()
                raw_text = a.text.strip()
                # Text usually like "BKA - Đại Học Bách Khoa Hà Nội"
                if " - " in raw_text:
                    parts = raw_text.split(" - ", 1)
                    name = parts[1].strip()
                else:
                    name = raw_text or m.group(1).replace("-", " ").title()

                full_url = href if href.startswith("http") else TuyensinhParser.BASE_URL + href
                universities[code] = {
                    "code": code,
                    "name": name,
                    "url": full_url
                }

        return list(universities.values())

    @staticmethod
    def parse_school_page(
        html: str, 
        school_code: str, 
        school_name: str,
        target_year: Optional[int] = 2026
    ) -> List[Dict[str, Any]]:
        """
        Bóc tách tất cả các bảng điểm chuẩn từ trang chi tiết của một trường.
        Nhận diện phương thức, năm tuyển sinh, tên ngành, tổ hợp môn, điểm chuẩn, ghi chú.
        """
        soup = BeautifulSoup(html, "html.parser")
        scores = []

        # Phát hiện năm chung của trang từ tiêu đề (ví dụ: 'Điểm chuẩn ... 2026 chính xác')
        page_title = soup.title.string if soup.title else ""
        year_match = re.search(r"202[0-9]", page_title)
        page_default_year = int(year_match.group(0)) if year_match else (target_year or 2026)

        tables = soup.find_all("table")

        for table in tables:
            # 1. Tìm tiêu đề gần nhất phía trên bảng để xác định năm và phương thức
            heading_text = ""
            curr = table
            while curr:
                curr = curr.previous_element
                if curr and getattr(curr, "name", None) in ["h1", "h2", "h3", "h4", "h5"]:
                    heading_text = curr.text.strip()
                    break

            # Xác định năm của bảng này
            table_year = page_default_year
            h_year = re.search(r"năm\s*(202[0-9])|(202[0-9])", heading_text, re.I)
            if h_year:
                table_year = int(h_year.group(1) or h_year.group(2))

            # Xác định phương thức từ tiêu đề
            method = "Điểm thi THPT"
            if "phương thức" in heading_text.lower():
                # ví dụ: "Điểm chuẩn theo phương thức Điểm thi THPT năm 2025"
                m_method = re.search(r"phương thức\s*(.*?)(?:\s*năm|\s*$)", heading_text, re.I)
                if m_method:
                    method = m_method.group(1).strip()
            elif "đgnl" in heading_text.lower():
                method = "Đánh giá năng lực"
            elif "đgtd" in heading_text.lower():
                method = "Đánh giá tư duy"
            elif "học bạ" in heading_text.lower():
                method = "Xét học bạ"

            # 2. Xử lý các hàng của bảng
            rows = table.find_all("tr")
            if not rows:
                continue

            # Kiểm tra xem có thead / multi-level header (như bảng YHB 2026) hay không
            thead = table.find("thead")
            if thead and len(thead.find_all("tr")) > 1:
                # Bảng cấu trúc phức tạp nhiều phương thức
                parsed_complex = TuyensinhParser._parse_complex_table(
                    table, school_code, school_name, table_year
                )
                scores.extend(parsed_complex)
                continue

            # Bảng đơn chuẩn (1 hàng header)
            header_cells = [c.text.strip() for c in rows[0].find_all(["th", "td"])]
            col_map = TuyensinhParser._map_table_columns(header_cells)

            # Duyệt từng dòng dữ liệu
            for row in rows[1:]:
                cells = [c.text.strip().replace("\xa0", " ") for c in row.find_all(["th", "td"])]
                if not cells or len(cells) < 2:
                    continue

                # Bỏ qua dòng quảng cáo Tuyensinh247
                if any("tuyensinh247" in c.lower() for c in cells):
                    continue

                major_name = ""
                major_code = ""
                subject_group = ""
                score_str = ""
                notes = ""
                quota = ""

                if "major_code" in col_map and col_map["major_code"] < len(cells):
                    major_code = cells[col_map["major_code"]]

                if "major_name" in col_map and col_map["major_name"] < len(cells):
                    major_name = cells[col_map["major_name"]]

                if "subject" in col_map and col_map["subject"] < len(cells):
                    subject_group = cells[col_map["subject"]]

                if "score" in col_map and col_map["score"] < len(cells):
                    score_str = cells[col_map["score"]]

                if "notes" in col_map and col_map["notes"] < len(cells):
                    notes = cells[col_map["notes"]]

                if "quota" in col_map and col_map["quota"] < len(cells):
                    quota = cells[col_map["quota"]]

                # Nếu tên ngành trống thì bỏ qua
                if not major_name:
                    continue

                # Tách ghi chú phương thức con nếu bị dính vào tên ngành kiểu "Tên ngành(XTTN diện 1.3...)"
                m_sub_note = re.search(r'\s*(\((?:XTTN|Điểm đã được quy đổi|Kết hợp|CCNN|Xét tuyển|dựa trên).*?\))$', major_name, re.I)
                if m_sub_note:
                    extra_from_name = m_sub_note.group(1).strip('()')
                    major_name = major_name[:m_sub_note.start()].strip()
                    notes = f"{notes}; {extra_from_name}".strip("; ")

                # Tách mã ngành nếu nằm trong tên ngành kiểu "Công nghệ thông tin (7480201)"
                if not major_code:
                    code_in_name = re.search(r"\((\d{7}[A-Z0-9]*)\)", major_name)
                    if code_in_name:
                        major_code = code_in_name.group(1)

                # Chuyển đổi điểm số
                numeric_score = TuyensinhParser._clean_score(score_str)

                # Nếu cột ghi chú/kết hợp chứa phương thức chi tiết
                row_method = method
                if "kết hợp" in col_map and col_map.get("kết hợp") and col_map["kết hợp"] < len(cells):
                    extra_method = cells[col_map["kết hợp"]]
                    if extra_method and len(extra_method) > 2:
                        notes = f"{notes}; {extra_method}".strip("; ")

                scores.append({
                    "university_code": school_code,
                    "university_name": school_name,
                    "year": table_year,
                    "method": row_method,
                    "major_code": major_code,
                    "major_name": major_name,
                    "subject_group": subject_group,
                    "cutoff_score": numeric_score,
                    "cutoff_score_text": score_str if score_str else (str(numeric_score) if numeric_score is not None else ""),
                    "notes": notes,
                    "quota": quota
                })

        return scores

    @staticmethod
    def _map_table_columns(headers: List[str]) -> Dict[str, int]:
        """Tự động ánh xạ chỉ số các cột dựa vào tên tiêu đề"""
        col_map = {}
        for idx, h in enumerate(headers):
            hl = h.lower()
            if "mã ngành" in hl or "mã xét tuyển" in hl or "mã ptxt" in hl:
                col_map["major_code"] = idx
            elif "tên ngành" in hl or "ngành" in hl or "chuyên ngành" in hl:
                col_map["major_name"] = idx
            elif "tổ hợp" in hl or "khối" in hl:
                col_map["subject"] = idx
            elif "chỉ tiêu" in hl:
                col_map["quota"] = idx
            elif "điểm chuẩn" in hl or "điểm trúng tuyển" in hl:
                col_map["score"] = idx
            elif "phương thức kết hợp" in hl:
                col_map["kết hợp"] = idx
            elif "ghi chú" in hl or "tiêu chí" in hl:
                col_map["notes"] = idx

        # Dự phòng mặc định nếu là bảng 4 cột tiêu chuẩn: [Tên ngành, Tổ hợp, Điểm chuẩn, Ghi chú]
        if "major_name" not in col_map and len(headers) >= 3:
            col_map["major_name"] = 0
            col_map["subject"] = 1
            col_map["score"] = 2
            if len(headers) >= 4:
                col_map["notes"] = 3

        return col_map

    @staticmethod
    def _parse_complex_table(
        table, 
        school_code: str, 
        school_name: str, 
        year: int
    ) -> List[Dict[str, Any]]:
        """
        Xử lý bảng phức tạp với nhiều phương thức xét tuyển xếp theo từng cột (như Y Hà Nội 2026)
        """
        results = []
        thead = table.find("thead")
        header_rows = thead.find_all("tr")
        
        # Hàng 1 có STT, Mã xét tuyển, Tên ngành, Chỉ tiêu 2026, Điểm trúng tuyển (colspan)
        # Hàng 2 có các phương thức con (PTXT 100, PTXT 402...)
        sub_methods = [td.text.strip() for td in header_rows[1].find_all(["th", "td"])]
        
        tbody = table.find("tbody") or table
        for tr in tbody.find_all("tr"):
            cells = [td.text.strip().replace("\xa0", " ") for td in tr.find_all(["th", "td"])]
            if len(cells) < 4:
                continue
            if any("tuyensinh247" in c.lower() for c in cells):
                continue

            # Thường cấu trúc: [STT, Mã xét tuyển, Tên ngành, Chỉ tiêu, Điểm PTXT 1, Điểm PTXT 2...]
            # Tìm xem cột nào là tên ngành
            stt = cells[0]
            major_code = cells[1] if len(cells) > 1 else ""
            major_name = cells[2] if len(cells) > 2 else ""
            quota = cells[3] if len(cells) > 3 else ""

            # Các cột điểm tiếp theo tương ứng với sub_methods
            score_cells = cells[4:]
            for i, score_val in enumerate(score_cells):
                if not score_val or score_val in ["-", "–", ""]:
                    continue
                method_name = sub_methods[i] if i < len(sub_methods) else f"PTXT {i+1}"
                numeric_score = TuyensinhParser._clean_score(score_val)
                
                results.append({
                    "university_code": school_code,
                    "university_name": school_name,
                    "year": year,
                    "method": method_name,
                    "major_code": major_code,
                    "major_name": major_name,
                    "subject_group": "",
                    "cutoff_score": numeric_score,
                    "cutoff_score_text": score_val,
                    "notes": "",
                    "quota": quota
                })

        return results

    @staticmethod
    def _clean_score(score_str: str) -> Optional[float]:
        """Làm sạch chuỗi điểm và chuyển sang float nếu hợp lệ"""
        if not score_str:
            return None
        cleaned = score_str.strip().replace(",", ".")
        # Trích xuất số thực đầu tiên trong chuỗi
        m = re.search(r"(\d+(?:\.\d+)?)", cleaned)
        if m:
            try:
                val = float(m.group(1))
                # Điểm chuẩn thường từ 10 đến 1200 (ĐGNL/ĐGTD)
                if 0 <= val <= 1500:
                    return val
            except ValueError:
                pass
        return None
