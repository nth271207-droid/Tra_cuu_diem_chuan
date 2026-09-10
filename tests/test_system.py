import unittest
import os
import tempfile
from fastapi.testclient import TestClient

from db.database import Database
from db.service import BenchmarkService
from crawler.parser import TuyensinhParser
from app import app

class TestBenchmarkSystem(unittest.TestCase):
    def setUp(self):
        # Create temp db for isolated testing
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_db_path = os.path.join(self.temp_dir.name, "test_benchmark.db")
        self.db = Database(db_path=self.temp_db_path)
        self.service = BenchmarkService(db=self.db)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_database_and_service(self):
        # Insert test university
        self.db.upsert_university("BKA", "Đại Học Bách Khoa Hà Nội", "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-bach-khoa-ha-noi-BKA.html")
        self.db.upsert_university("YHB", "Trường Đại Học Y Hà Nội", "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-y-ha-noi-YHB.html")

        # Insert test scores
        test_scores = [
            {
                "university_code": "BKA",
                "university_name": "Đại Học Bách Khoa Hà Nội",
                "year": 2026,
                "method": "Điểm thi THPT",
                "major_code": "IT1",
                "major_name": "Khoa học máy tính",
                "subject_group": "A00; A01",
                "cutoff_score": 28.29,
                "cutoff_score_text": "28.29",
                "notes": "Môn Toán >= 9.0",
                "quota": "300"
            },
            {
                "university_code": "YHB",
                "university_name": "Trường Đại Học Y Hà Nội",
                "year": 2026,
                "method": "PTXT 100",
                "major_code": "7720101",
                "major_name": "Y khoa",
                "subject_group": "B00",
                "cutoff_score": 28.5,
                "cutoff_score_text": "28.5",
                "notes": "",
                "quota": "440"
            },
            {
                "university_code": "BKA",
                "university_name": "Đại Học Bách Khoa Hà Nội",
                "year": 2025,
                "method": "Điểm ĐGTD TSA",
                "major_code": "IT1",
                "major_name": "Khoa học máy tính",
                "subject_group": "K00",
                "cutoff_score": 83.9,
                "cutoff_score_text": "83.9",
                "notes": "",
                "quota": ""
            }
        ]
        inserted = self.db.insert_scores_batch(test_scores)
        self.assertEqual(inserted, 3)

        # Test search by keyword
        res_kw = self.service.search_scores(keyword="Khoa học máy tính")
        self.assertEqual(res_kw["total"], 2)

        # Test search by year 2026
        res_2026 = self.service.search_scores(year=2026)
        self.assertEqual(res_2026["total"], 2)

        # Test filter by score range
        res_score = self.service.search_scores(min_score=28.0, max_score=28.4)
        self.assertEqual(res_score["total"], 1)
        self.assertEqual(res_score["items"][0]["major_code"], "IT1")

        # Test stats
        stats = self.service.get_stats()
        self.assertEqual(stats["total_universities"], 2)
        self.assertEqual(stats["total_scores"], 3)
        self.assertIn(2026, stats["available_years"])

    def test_score_cleaner(self):
        self.assertEqual(TuyensinhParser._clean_score("28,5"), 28.5)
        self.assertEqual(TuyensinhParser._clean_score(" 21.0 "), 21.0)
        self.assertEqual(TuyensinhParser._clean_score("850"), 850.0)
        self.assertIsNone(TuyensinhParser._clean_score("-"))
        self.assertIsNone(TuyensinhParser._clean_score(""))

    def test_fastapi_endpoints(self):
        client = TestClient(app)
        
        # Test index page
        resp = client.get("/")
        self.assertEqual(resp.status_code, 200)

        # Test stats API
        resp_stats = client.get("/api/stats")
        self.assertEqual(resp_stats.status_code, 200)
        data = resp_stats.json()
        self.assertIn("total_universities", data)

        # Test search API
        resp_scores = client.get("/api/scores?page=1&page_size=10")
        self.assertEqual(resp_scores.status_code, 200)
        scores_data = resp_scores.json()
        self.assertIn("items", scores_data)

if __name__ == "__main__":
    unittest.main()
