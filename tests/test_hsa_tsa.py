import unittest
from crawler.parser import TuyensinhParser

class TestHsaTsaDisambiguation(unittest.TestCase):
    def test_tsa_normalization(self):
        m, s = TuyensinhParser.normalize_method_and_subject("Điểm ĐGTD TSA", "", "", 65.5)
        self.assertEqual(m, "Đánh giá tư duy Bách Khoa (TSA)")
        self.assertEqual(s, "K00")

        # Traditional subject combo is preserved without prepending K00 if standard combo present
        m2, s2 = TuyensinhParser.normalize_method_and_subject("ĐGTD", "A00; A01", "", 55.0)
        self.assertEqual(m2, "Đánh giá tư duy Bách Khoa (TSA)")
        self.assertEqual(s2, "A00; A01")

    def test_hsa_normalization(self):
        m, s = TuyensinhParser.normalize_method_and_subject("Điểm ĐGNL HSA", "", "", 95.0)
        self.assertEqual(m, "Đánh giá năng lực ĐHQG Hà Nội (HSA)")
        self.assertEqual(s, "Q00")

        # Standard combo preserved
        m2, s2 = TuyensinhParser.normalize_method_and_subject("Điểm thi HSA", "D01; A01", "", 88.0)
        self.assertEqual(m2, "Đánh giá năng lực ĐHQG Hà Nội (HSA)")
        self.assertEqual(s2, "D01; A01")

    def test_score_over_150_cannot_be_hsa(self):
        # LAH/HQH case: table heading or row had Q00, but score is 951 and notes say V-ACT
        m, s = TuyensinhParser.normalize_method_and_subject(
            raw_method="Điểm ĐGNL HSA",
            raw_subject="Q00",
            notes="Quy đổi từ A01 sang V-ACT",
            score=951.0
        )
        self.assertEqual(m, "Đánh giá năng lực ĐHQG TP.HCM (V-ACT)")
        self.assertEqual(s, "")

    def test_score_over_100_cannot_be_tsa(self):
        # HHT case: table heading was TSA, but score is 111.03 (HSA scale 150)
        m, s = TuyensinhParser.normalize_method_and_subject(
            raw_method="Điểm ĐGTD TSA",
            raw_subject="K00",
            notes="",
            score=111.03
        )
        self.assertEqual(m, "Đánh giá năng lực ĐHQG Hà Nội (HSA)")
        self.assertEqual(s, "Q00")

    def test_multi_column_table_parsing(self):
        html = """
        <html>
        <head><title>Điểm chuẩn UTT 2026</title></head>
        <body>
            <h3>Điểm chuẩn UTT 2026</h3>
            <table>
                <tr>
                    <th>Mã xét tuyển</th>
                    <th>Tên ngành/chương trình</th>
                    <th>Điểm chuẩn THPT</th>
                    <th>Điểm chuẩn HB</th>
                    <th>TSA</th>
                    <th>HSA</th>
                    <th>SPT</th>
                </tr>
                <tr>
                    <td>GTADCAT2</td>
                    <td>An toàn dữ liệu và an ninh mạng</td>
                    <td>24.5</td>
                    <td>27.13</td>
                    <td>56.75</td>
                    <td>101.5</td>
                    <td>18.5</td>
                </tr>
            </table>
        </body>
        </html>
        """
        scores = TuyensinhParser.parse_school_page(html, "GTA", "ĐH Công nghệ GTVT", 2026)
        methods = {s["method"]: s["cutoff_score"] for s in scores}
        self.assertIn("Đánh giá tư duy Bách Khoa (TSA)", methods)
        self.assertIn("Đánh giá năng lực ĐHQG Hà Nội (HSA)", methods)
        self.assertEqual(methods["Đánh giá tư duy Bách Khoa (TSA)"], 56.75)
        self.assertEqual(methods["Đánh giá năng lực ĐHQG Hà Nội (HSA)"], 101.5)
        self.assertEqual(methods["Điểm thi tốt nghiệp THPT"], 24.5)
        self.assertEqual(methods["Xét học bạ THPT"], 27.13)

if __name__ == "__main__":
    unittest.main()
