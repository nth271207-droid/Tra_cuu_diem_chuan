import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')
from db.database import Database

def main():
    db = Database()
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, major_name, notes FROM admission_scores")
        rows = cursor.fetchall()
        updated = 0
        for r in rows:
            major_name = r["major_name"]
            m_sub_note = re.search(r'\s*(\((?:XTTN|Điểm đã được quy đổi|Kết hợp|CCNN|Xét tuyển|dựa trên).*?\))$', major_name, re.I)
            if m_sub_note:
                extra = m_sub_note.group(1).strip('()')
                base_name = major_name[:m_sub_note.start()].strip()
                new_notes = f"{r['notes']}; {extra}".strip("; ")
                cursor.execute(
                    "UPDATE admission_scores SET major_name = ?, notes = ? WHERE id = ?",
                    (base_name, new_notes, r["id"])
                )
                updated += 1
        conn.commit()
        print(f"Đã chuẩn hóa {updated} bản ghi tên ngành trong cơ sở dữ liệu.")

if __name__ == "__main__":
    main()
