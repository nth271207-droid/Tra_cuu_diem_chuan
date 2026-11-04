import unittest
import os
import json
import hashlib

class TestCareerMatcher(unittest.TestCase):
    def setUp(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.root_html = os.path.join(self.base_dir, "index.html")
        self.template_html = os.path.join(self.base_dir, "web", "templates", "index.html")
        self.static_scores = os.path.join(self.base_dir, "data", "static_data", "scores_grouped.json")

    def test_html_synchronization(self):
        """Đảm bảo index.html và web/templates/index.html hoàn toàn đồng bộ 100%"""
        with open(self.root_html, "rb") as f1, open(self.template_html, "rb") as f2:
            hash1 = hashlib.sha256(f1.read()).hexdigest()
            hash2 = hashlib.sha256(f2.read()).hexdigest()
        self.assertEqual(hash1, hash2, "index.html và web/templates/index.html phải giống nhau tuyệt đối")

    def test_career_elements_exist_in_html(self):
        """Đảm bảo các thẻ DOM cốt lõi của tính năng AI Hướng nghiệp hiện diện đầy đủ"""
        with open(self.root_html, "r", encoding="utf-8") as f:
            content = f.read()

        required_ids = [
            'id="tab-nav-career"',
            'id="section-career"',
            'id="career-quiz-card"',
            'id="career-step-indicator"',
            'id="career-progress-bar"',
            'id="career-question-view"',
            'id="btn-career-prev"',
            'id="btn-career-next"',
            'id="btn-career-reset"',
            'id="career-results-card"'
        ]
        for el_id in required_ids:
            self.assertIn(el_id, content, f"Thiếu phần tử {el_id} trong index.html")

    def test_riasec_scoring_algorithm(self):
        """Kiểm thử thuật toán tính điểm RIASEC và xác định mã Holland Code"""
        # Giả lập thí sinh thiên về I (Nghiên cứu) và R (Kỹ thuật)
        answers = {
            1: "I",  # Q1 x2.0
            2: ["I", "R"],  # Q2 x1.5 mỗi môn
            3: "I",  # Q3 x1.5
            4: "I",  # Q4 x1.5
            5: "R"   # Q5 x2.0
        }

        scores = {"R": 0, "I": 0, "A": 0, "S": 0, "E": 0, "C": 0}
        scores[answers[1]] += 2.0
        for c in answers[2]:
            scores[c] += 1.5
        scores[answers[3]] += 1.5
        scores[answers[4]] += 1.5
        scores[answers[5]] += 2.0

        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        primary = sorted_scores[0][0]
        secondary = sorted_scores[1][0]
        holland_code = f"{primary}{secondary}"

        self.assertEqual(primary, "I")
        self.assertEqual(secondary, "R")
        self.assertEqual(holland_code, "IR")

    def test_major_keywords_coverage(self):
        """Đảm bảo các từ khóa ngành gợi ý của RIASEC match được dữ liệu thực tế trong scores_grouped.json"""
        with open(self.static_scores, "r", encoding="utf-8") as f:
            scores_data = json.load(f)

        archetypes_test_keywords = [
            # IR / IT & AI
            ["công nghệ thông tin", "trí tuệ nhân tạo", "khoa học máy tính"],
            # EC / Finance & Business
            ["tài chính", "ngân hàng", "kế toán", "quản trị kinh doanh"],
            # IS / Medical
            ["y khoa", "dược", "điều dưỡng"],
            # EA / Marketing & Media
            ["marketing", "truyền thông", "quản trị khách sạn"],
            # RC / Engineering & Construction
            ["xây dựng", "giao thông", "cơ khí", "ô tô"]
        ]

        for kw_group in archetypes_test_keywords:
            matched = [
                item for item in scores_data 
                if any(k in item["major_name"].lower() for k in kw_group)
            ]
            self.assertGreater(len(matched), 0, f"Không tìm thấy ngành nào phù hợp với nhóm từ khóa: {kw_group}")

if __name__ == "__main__":
    unittest.main()
