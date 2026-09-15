import re
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional, Tuple

class TuyensinhParser:
    BASE_URL = "https://diemthi.tuyensinh247.com"

    @staticmethod
    def normalize_method_and_subject(
        raw_method: str, 
        raw_subject: str = "", 
        notes: str = "", 
        score: Optional[float] = None,
        school_code: str = ""
    ) -> Tuple[str, str]:
        """
        Chuẩn hóa tên phương thức và tổ hợp môn về các danh mục chuẩn.
        Đặc biệt nhận diện và gán chính xác mã K00 (ĐGTD Bách Khoa, thang 100)
        và Q00 (ĐGNL ĐHQGHN, thang 150), đối chiếu thang điểm để tránh nhầm lẫn.
        """
        m_clean = raw_method.strip() if raw_method else ""
        s_clean = raw_subject.strip() if raw_subject else ""
        n_clean = notes.strip() if notes else ""

        # Làm sạch ký tự lỗi hiển thị UTF-8 (mojibake) và khoảng trắng đặc biệt
        m_clean = re.sub(r"[\ufffd\xa0]+", " ", m_clean).strip()
        s_clean = re.sub(r"[\ufffd\xa0]+", " ", s_clean).strip()
        n_clean = re.sub(r"[\ufffd\xa0]+", " ", n_clean).strip()

        m_lower = m_clean.lower()
        s_lower = s_clean.lower()
        s_upper = s_clean.upper()
        n_lower = n_clean.lower()

        is_score_over_150 = score is not None and score > 150
        is_score_over_100 = score is not None and score > 100

        # 1. Đánh giá năng lực ĐHQG TP.HCM (V-ACT) - thang 1200
        # Nhận diện sớm nếu có từ khóa V-ACT/HCM hoặc điểm số > 150 (điểm quy đổi sang V-ACT)
        # Chú ý: nếu ghi chú "sang hsa" và điểm <= 150 thì thuộc về HSA, không phải V-ACT
        if not ("sang hsa" in n_lower and score is not None and score <= 150) and (
            "sang v-act" in n_lower or "sang vact" in n_lower or "v-act" in m_lower or "vact" in m_lower or (
                "v-act" in n_lower and not ("sang hsa" in n_lower or "sang tsa" in n_lower)
            ) or (
                is_score_over_150 and score <= 1200 and ("đgnl" in m_lower or "v-act" in n_lower or "hcm" in n_lower or "tp" in m_lower)
            ) or ("đgnl" in m_lower and ("hcm" in m_lower or "tp.hcm" in m_lower or "tp hcm" in m_lower or "hồ chí minh" in m_lower))
        ):
            norm_method = "Đánh giá năng lực ĐHQG TP.HCM (V-ACT)"
            s_clean = re.sub(r"\b[QK]00\b[;\s]*", "", s_clean).strip("; ")

        # 2. Chứng chỉ quốc tế (IELTS/SAT/ACT) - SAT thang 1600
        elif "quốc tế" in m_lower or "quoc te" in m_lower or "ielts" in m_lower or "sat" in m_lower or "act" in m_lower or "ccqt" in m_lower or "chứng chỉ" in m_lower or (
            score is not None and score > 1200 and score <= 1600
        ):
            norm_method = "Chứng chỉ quốc tế (IELTS/SAT/ACT)"
            s_clean = re.sub(r"\b[QK]00\b[;\s]*", "", s_clean).strip("; ")

        # 3. Đánh giá tư duy Bách Khoa (TSA) - Mã tổ hợp K00, thang 100
        # Điểm TSA tối đa là 100 điểm. Nếu điểm > 100 thì KHÔNG PHẢI TSA (ví dụ HHT bị Tuyensinh247 copy nhầm điểm HSA 111.03 sang TSA)
        elif not is_score_over_100 and not ("sang hsa" in n_lower or "sang v-act" in n_lower or "sang vact" in n_lower) and (
            "sang tsa" in n_lower or "tsa" in m_lower or "đgtd" in m_lower or "tư duy" in m_lower or "đhbkhn" in m_lower or "tsa" in n_lower or (
                "k00" in m_lower or s_clean == "K00" or s_clean.startswith("K00;")
            )
        ):
            norm_method = "Đánh giá tư duy Bách Khoa (TSA)"
            # Loại bỏ mã Q00 nếu bị nhầm sang TSA
            s_clean = re.sub(r"\bQ00\b[;\s]*", "", s_clean).strip("; ")
            s_u = s_clean.upper()
            if not s_clean or s_clean in ["-", "–"]:
                s_clean = "K00"
            elif "K00" not in s_u and not any(c in s_u for c in ["A00", "A01", "D01"]):
                s_clean = f"K00; {s_clean}".strip("; ")

        # 4. Đánh giá năng lực ĐHQG Hà Nội (HSA) - Mã tổ hợp Q00, thang 150
        elif not is_score_over_150 and not ("sang v-act" in n_lower or "sang vact" in n_lower or "sang tsa" in n_lower) and (
            "sang hsa" in n_lower or "hsa" in m_lower or "hsa" in n_lower or "q00" in m_lower or s_clean == "Q00" or s_clean.startswith("Q00;") or (
                "đgnl" in m_lower and ("hà nội" in m_lower or "đhqghn" in m_lower or "hanoi" in m_lower)
            ) or (
                is_score_over_100 and score <= 150 and ("tsa" in m_lower or "đgnl" in m_lower or "tư duy" in m_lower)
            )
        ):
            norm_method = "Đánh giá năng lực ĐHQG Hà Nội (HSA)"
            # Loại bỏ mã K00 nếu bị nhầm sang HSA
            s_clean = re.sub(r"\bK00\b[;\s]*", "", s_clean).strip("; ")
            s_u = s_clean.upper()
            if not s_clean or s_clean in ["-", "–"]:
                s_clean = "Q00"
            elif "Q00" not in s_u and not any(c in s_u for c in ["A00", "A01", "D01"]):
                s_clean = f"Q00; {s_clean}".strip("; ")

        # 5. Đánh giá đầu vào Đại học V-SAT
        elif "v-sat" in m_lower or "vsat" in m_lower or "đầu vào" in m_lower or "v_sat" in m_lower:
            norm_method = "Đánh giá đầu vào V-SAT"
            s_clean = re.sub(r"\b[QK]00\b[;\s]*", "", s_clean).strip("; ")

        # 6. Đánh giá năng lực Sư phạm (SPT)
        elif "spt" in m_lower or "sp2e" in m_lower or ("đgnl" in m_lower and ("sư phạm" in m_lower or "đhsp" in m_lower)):
            norm_method = "Đánh giá năng lực Sư phạm (SPT)"
            s_clean = re.sub(r"\b[QK]00\b[;\s]*", "", s_clean).strip("; ")

        # 7. Đánh giá Bộ Công An / Quân đội (BCA/QDA)
        elif "sang qda" in n_lower or "qda" in m_lower or "bca" in m_lower or "công an" in m_lower:
            norm_method = "Đánh giá Bộ Công An (BCA/QDA)"
            s_clean = re.sub(r"\b[QK]00\b[;\s]*", "", s_clean).strip("; ")

        # 8. Xét học bạ THPT
        elif "học bạ" in m_lower or "hoc ba" in m_lower or "học b" in m_lower or "hoc b" in m_lower or "ptxt 200" in m_lower or m_clean in ["Điểmhọc bạ", "Điểm học bạ", "Điểm chuẩn HB", "HB"]:
            norm_method = "Xét học bạ THPT"

        # 9. Tuyển thẳng & Ưu tiên xét tuyển
        elif "ưtxt" in m_lower or "utxt" in m_lower or "tuyển thẳng" in m_lower or "xt thẳng" in m_lower:
            norm_method = "Tuyển thẳng & Ưu tiên xét tuyển"

        # 10. Xét tuyển kết hợp
        elif "kết hợp" in m_lower or "ket hop" in m_lower or "xtkh" in m_lower or m_lower in ["pt2a", "pt2c", "pt3", "pt4", "ptxt 402"]:
            norm_method = "Xét tuyển kết hợp"

        # 11. Điểm thi tốt nghiệp THPT
        elif "thpt" in m_lower or "tốt nghiệp" in m_lower or "ptxt 100" in m_lower or m_clean in ["ĐiểmTHPT", "THPT", "Điểm thi THPT", "Điểm chuẩn THPT"]:
            norm_method = "Điểm thi tốt nghiệp THPT"

        # 12. Generic ĐGNL
        elif "đgnl" in m_lower or "năng lực" in m_lower:
            if school_code and any(hcm_kw in school_code for hcm_kw in ["DKC", "QS", "IUH", "SG", "UEH", "TDM"]):
                norm_method = "Đánh giá năng lực ĐHQG TP.HCM (V-ACT)"
            else:
                norm_method = "Đánh giá năng lực (ĐGNL)"

        # 13. Thi năng khiếu / Thi riêng
        elif "năng khiếu" in m_lower or "thi riêng" in m_lower:
            norm_method = "Thi năng khiếu & Thi riêng"

        else:
            norm_method = m_clean if m_clean else "Điểm thi tốt nghiệp THPT"

        # Chuẩn hóa tổ hợp môn
        if s_clean:
            if norm_method not in ["Đánh giá tư duy Bách Khoa (TSA)", "Đánh giá năng lực ĐHQG Hà Nội (HSA)"]:
                s_clean = re.sub(r"\b[QK]00\b[;\s]*", "", s_clean).strip("; ")
            s_clean = re.sub(r"[,;]+", "; ", s_clean)
            s_clean = re.sub(r"\s+", " ", s_clean).strip("; ")
            s_clean = re.sub(r"\bBO3\b", "B03", s_clean)
            s_clean = re.sub(r"\bAU\b", "A11", s_clean)

        return norm_method, s_clean

    @staticmethod
    def parse_university_list(html: str) -> List[Dict[str, Any]]:
        """
        Bóc tách danh sách các trường đại học từ trang chính diem-chuan.html
        """
        soup = BeautifulSoup(html, "html.parser")
        universities = {}

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            m = re.search(r"^/diem-chuan/([a-zA-Z0-9\-]+)-([A-Z0-9]+)\.html$", href)
            if m:
                code = m.group(2).upper()
                raw_text = a.text.strip()
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

        # Phát hiện năm chung của trang từ tiêu đề
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
                if curr and getattr(curr, "name", None) in ["h1", "h2", "h3", "h4", "h5", "b", "strong"]:
                    t = curr.text.strip()
                    if len(t) > 5 and ("điểm" in t.lower() or "phương thức" in t.lower() or "202" in t.lower()):
                        heading_text = t
                        break

            # Xác định năm của bảng này
            table_year = page_default_year
            h_year = re.search(r"năm\s*(202[0-9])|(202[0-9])", heading_text, re.I)
            if h_year:
                table_year = int(h_year.group(1) or h_year.group(2))

            # Xác định phương thức thô từ tiêu đề
            raw_method = "Điểm thi tốt nghiệp THPT"
            h_low = heading_text.lower()
            if "phương thức" in h_low:
                m_method = re.search(r"phương thức\s*(.*?)(?:\s*năm|\s*$)", heading_text, re.I)
                if m_method:
                    raw_method = m_method.group(1).strip()
            elif "đgnl hsa" in h_low or "hsa" in h_low:
                raw_method = "Đánh giá năng lực ĐHQG Hà Nội (HSA)"
            elif "đgtd tsa" in h_low or "tsa" in h_low:
                raw_method = "Đánh giá tư duy Bách Khoa (TSA)"
            elif "v-act" in h_low or "vact" in h_low:
                raw_method = "Đánh giá năng lực ĐHQG TP.HCM (V-ACT)"
            elif "đgtd" in h_low or "tư duy" in h_low:
                raw_method = "Đánh giá tư duy Bách Khoa (TSA)"
            elif "đgnl" in h_low:
                raw_method = "Đánh giá năng lực"
            elif "học bạ" in h_low:
                raw_method = "Xét học bạ THPT"

            # 2. Xử lý các hàng của bảng
            rows = table.find_all("tr")
            if not rows:
                continue

            # Kiểm tra xem có thead đa hàng (bảng đa cột phương thức) hay không
            thead = table.find("thead")
            if thead and len(thead.find_all("tr")) > 1:
                parsed_complex = TuyensinhParser._parse_complex_table(
                    table, school_code, school_name, table_year
                )
                scores.extend(parsed_complex)
                continue

            # Bảng đơn chuẩn (1 hàng header)
            header_cells = [c.text.strip().replace("\xa0", " ") for c in rows[0].find_all(["th", "td"])]
            col_map = TuyensinhParser._map_table_columns(header_cells)

            # Phát hiện tất cả các cột điểm và phương thức tương ứng trong hàng header
            score_cols = []
            for idx, h in enumerate(header_cells):
                hl = h.lower().strip()
                col_method = None
                if any(k in hl for k in ["tsa", "đgtd"]):
                    col_method = "Đánh giá tư duy Bách Khoa (TSA)"
                elif any(k in hl for k in ["hsa"]):
                    col_method = "Đánh giá năng lực ĐHQG Hà Nội (HSA)"
                elif any(k in hl for k in ["v-act", "vact"]):
                    col_method = "Đánh giá năng lực ĐHQG TP.HCM (V-ACT)"
                elif any(k in hl for k in ["spt", "sp2e"]):
                    col_method = "Đánh giá năng lực Sư phạm (SPT)"
                elif any(k in hl for k in ["vsat", "v-sat"]):
                    col_method = "Đánh giá đầu vào V-SAT"
                elif any(k in hl for k in ["học bạ", "hb"]) and ("điểm" in hl or hl == "hb"):
                    col_method = "Xét học bạ THPT"
                elif any(k in hl for k in ["thpt", "ttn", "tốt nghiệp"]) and ("điểm" in hl or hl in ["thpt", "ttn"]):
                    col_method = "Điểm thi tốt nghiệp THPT"
                elif "chứng chỉ" in hl or "ccqt" in hl or "sat" in hl or "ielts" in hl:
                    col_method = "Chứng chỉ quốc tế (IELTS/SAT/ACT)"
                elif "điểm chuẩn" in hl or "điểm trúng tuyển" in hl or "điểm xét tuyển" in hl:
                    col_method = raw_method
                
                if col_method:
                    score_cols.append({"idx": idx, "method": col_method, "header": h})

            # Nếu bảng có cả cột phương thức riêng cụ thể (VD: 'Điểm chuẩn ĐGNL HSA')
            # và cột 'Điểm chuẩn' chung (thường là cột tham chiếu THPT của TS247),
            # ưu tiên lấy cột phương thức cụ thể để tránh nhầm điểm
            specific_cols = [sc for sc in score_cols if any(k in sc["header"].lower() for k in ["tsa", "hsa", "v-act", "spt", "học bạ", "thpt", "chứng chỉ"])]
            generic_cols = [sc for sc in score_cols if sc["header"].lower() in ["điểm chuẩn", "điểm trúng tuyển", "điểm xét tuyển"]]
            if specific_cols and generic_cols:
                score_cols = specific_cols
            elif not score_cols and "score" in col_map:
                score_cols = [{"idx": col_map["score"], "method": raw_method, "header": header_cells[col_map["score"]] if col_map["score"] < len(header_cells) else ""}]

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
                notes = ""
                quota = ""

                if "major_code" in col_map and col_map["major_code"] < len(cells):
                    major_code = cells[col_map["major_code"]]

                if "major_name" in col_map and col_map["major_name"] < len(cells):
                    major_name = cells[col_map["major_name"]]

                if "subject" in col_map and col_map["subject"] < len(cells):
                    subject_group = cells[col_map["subject"]]

                if "notes" in col_map and col_map["notes"] < len(cells):
                    notes = cells[col_map["notes"]]

                if "quota" in col_map and col_map["quota"] < len(cells):
                    quota = cells[col_map["quota"]]

                # Nếu tên ngành trống thì bỏ qua
                if not major_name:
                    continue

                # Tách ghi chú phương thức con nếu bị dính vào tên ngành
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

                # Nếu cột ghi chú/kết hợp chứa phương thức chi tiết
                if "kết hợp" in col_map and col_map.get("kết hợp") and col_map["kết hợp"] < len(cells):
                    extra_method = cells[col_map["kết hợp"]]
                    if extra_method and len(extra_method) > 2:
                        notes = f"{notes}; {extra_method}".strip("; ")

                # Trích xuất điểm cho từng phương thức trong các cột điểm
                for sc in score_cols:
                    col_idx = sc["idx"]
                    if col_idx >= len(cells):
                        continue
                    score_str = cells[col_idx].strip()
                    if not score_str or score_str in ["-", "–", "N/A", ""]:
                        continue

                    # Chuyển đổi điểm số
                    numeric_score = TuyensinhParser._clean_score(score_str)
                    if numeric_score is None:
                        continue

                    # Chuẩn hóa phương thức xét tuyển & tổ hợp môn (K00, Q00...)
                    norm_method, clean_subject = TuyensinhParser.normalize_method_and_subject(
                        raw_method=sc["method"],
                        raw_subject=subject_group,
                        notes=notes,
                        score=numeric_score,
                        school_code=school_code
                    )

                    scores.append({
                        "university_code": school_code,
                        "university_name": school_name,
                        "year": table_year,
                        "method": norm_method,
                        "major_code": major_code,
                        "major_name": major_name,
                        "subject_group": clean_subject,
                        "cutoff_score": numeric_score,
                        "cutoff_score_text": score_str,
                        "notes": notes,
                        "quota": quota
                    })

        return scores

    @staticmethod
    def _map_table_columns(headers: List[str]) -> Dict[str, int]:
        """Tự động ánh xạ chỉ số các cột dựa vào tên tiêu đề"""
        col_map = {}
        for idx, h in enumerate(headers):
            hl = h.lower().replace("\xa0", " ")
            if "mã ngành" in hl or "mã xét tuyển" in hl or "mã ptxt" in hl or ("mã" in hl and "ngành" not in hl):
                col_map["major_code"] = idx
            elif "tên ngành" in hl or "ngành" in hl or "chuyên ngành" in hl or "chương trình" in hl:
                col_map["major_name"] = idx
            elif "tổ hợp" in hl or "khối" in hl:
                col_map["subject"] = idx
            elif "chỉ tiêu" in hl:
                col_map["quota"] = idx
            elif "điểm chuẩn" in hl or "điểm trúng tuyển" in hl or "điểm xét tuyển" in hl:
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
        Xử lý bảng phức tạp với nhiều phương thức xét tuyển xếp theo từng cột
        (ví dụ: HUTECH DKC, Đại học Y Hà Nội YHB 2026...)
        """
        results = []
        thead = table.find("thead")
        if not thead:
            return results

        header_rows = thead.find_all("tr")
        if len(header_rows) < 2:
            return results

        # Hàng 0 có các cột chung (rowspan=2) và cột điểm chuẩn gộp (colspan > 1)
        r0_cells = header_rows[0].find_all(["th", "td"])
        r1_cells = header_rows[1].find_all(["th", "td"])
        sub_methods = [td.text.strip().replace("\xa0", " ") for td in r1_cells]

        col_map = {}
        current_col = 0
        score_start_col = -1

        for c in r0_cells:
            txt = c.text.strip().lower().replace("\xa0", " ")
            colspan = int(c.get("colspan", 1))

            if colspan > 1:
                score_start_col = current_col
                current_col += colspan
            else:
                if "mã ngành" in txt or "mã xét tuyển" in txt or "mã" in txt:
                    col_map["major_code"] = current_col
                elif "tên ngành" in txt or "ngành" in txt or "chương trình" in txt:
                    col_map["major_name"] = current_col
                elif "tổ hợp" in txt or "khối" in txt:
                    col_map["subject"] = current_col
                elif "chỉ tiêu" in txt:
                    col_map["quota"] = current_col
                elif "ghi chú" in txt:
                    col_map["notes"] = current_col
                current_col += 1

        if score_start_col == -1:
            score_start_col = len(r0_cells)

        tbody = table.find("tbody") or table
        for tr in tbody.find_all("tr"):
            if tr.parent == thead:
                continue

            cells = [td.text.strip().replace("\xa0", " ") for td in tr.find_all(["th", "td"])]
            if len(cells) <= score_start_col:
                continue
            if any("tuyensinh247" in c.lower() for c in cells):
                continue

            major_code = cells[col_map["major_code"]] if "major_code" in col_map and col_map["major_code"] < len(cells) else ""
            major_name = cells[col_map["major_name"]] if "major_name" in col_map and col_map["major_name"] < len(cells) else ""
            subject_group = cells[col_map["subject"]] if "subject" in col_map and col_map["subject"] < len(cells) else ""
            quota = cells[col_map["quota"]] if "quota" in col_map and col_map["quota"] < len(cells) else ""
            notes = cells[col_map["notes"]] if "notes" in col_map and col_map["notes"] < len(cells) else ""

            # Đổi lại vị trí nếu tên ngành bị nhầm thành mã số
            if major_name.isdigit() and not major_code.isdigit():
                major_name, major_code = major_code, major_name

            if not major_name:
                continue

            # Duyệt các cột điểm tương ứng từng phương thức con
            for i, method_raw in enumerate(sub_methods):
                col_idx = score_start_col + i
                if col_idx >= len(cells):
                    break
                score_val = cells[col_idx].strip()
                if not score_val or score_val in ["-", "–", "N/A", ""]:
                    continue

                numeric_score = TuyensinhParser._clean_score(score_val)

                # Chuẩn hóa phương thức & tổ hợp
                norm_method, clean_subject = TuyensinhParser.normalize_method_and_subject(
                    raw_method=method_raw,
                    raw_subject=subject_group,
                    notes=notes,
                    score=numeric_score,
                    school_code=school_code
                )

                results.append({
                    "university_code": school_code,
                    "university_name": school_name,
                    "year": year,
                    "method": norm_method,
                    "major_code": major_code,
                    "major_name": major_name,
                    "subject_group": clean_subject,
                    "cutoff_score": numeric_score,
                    "cutoff_score_text": score_val,
                    "notes": notes,
                    "quota": quota
                })

        return results

    @staticmethod
    def _clean_score(score_str: str) -> Optional[float]:
        """Làm sạch chuỗi điểm và chuyển sang float nếu hợp lệ"""
        if not score_str:
            return None
        cleaned = score_str.strip().replace(",", ".")
        m = re.search(r"(\d+(?:\.\d+)?)", cleaned)
        if m:
            try:
                val = float(m.group(1))
                if 0 <= val <= 1500:
                    return val
            except ValueError:
                pass
        return None
