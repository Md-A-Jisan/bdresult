"""Applies migrations to in-memory SQLite (FK on, like D1) and checks the constraints. Run: python3 migrations/test_schema.py"""
import sqlite3, glob, sys
db = sqlite3.connect(":memory:"); db.execute("PRAGMA foreign_keys=ON")
for f in sorted(glob.glob("migrations/0*.sql")):
    db.executescript(open(f, encoding="utf-8").read())
ok = fail = 0
def expect(name, sql, args=(), should_fail=False):
    global ok, fail
    try: db.execute(sql, args); err = None
    except sqlite3.Error as e: err = e
    good = (err is not None) == should_fail
    ok += good; fail += (not good)
    print(("PASS" if good else "FAIL"), name, "" if good else f"-> {err}")
assert db.execute('SELECT count(*) FROM districts').fetchone()[0] == 64   # district id 1 comes from migration 0003
base = "INSERT INTO institutions(eiin,slug,name_en,name_norm,type_id,district_id,{x}) VALUES (?,?, 'X','x',2,1,{v})"
ins = lambda eiin, slug, x="address", v="'a'": db.execute(base.format(x=x, v=v), (eiin, slug))
expect("valid institution", base.format(x="address", v="'a'"), ("123456","college-one"))
expect("duplicate EIIN rejected", base.format(x="address", v="'a'"), ("123456","college-two"), True)
expect("multiple NULL EIIN allowed", base.format(x="address", v="'a'"), (None,"no-eiin-one"))
expect("second NULL EIIN allowed", base.format(x="address", v="'a'"), (None,"no-eiin-two"))
expect("non-numeric EIIN rejected", base.format(x="address", v="'a'"), ("12A456","bad-eiin"), True)
expect("short EIIN rejected", base.format(x="address", v="'a'"), ("123","short-eiin"), True)
expect("duplicate slug rejected", base.format(x="address", v="'a'"), ("654321","college-one"), True)
expect("uppercase slug rejected", base.format(x="address", v="'a'"), ("654321","Bad-Slug"), True)
expect("latitude outside Bangladesh rejected", base.format(x="latitude", v="48.0"), ("111111","far-away"), True)
expect("valid latitude accepted", base.format(x="latitude", v="23.7"), ("222222","near-dhaka"))
expect("bad management type rejected", base.format(x="management_type", v="'weird'"), ("333333","mgmt-bad"), True)
expect("bad district FK rejected", "INSERT INTO institutions(slug,name_en,name_norm,type_id,district_id) VALUES ('fk-bad','X','x',2,999)", (), True)
expect("bad postal code rejected", base.format(x="postal_code", v="'12'"), ("444444","post-bad"), True)
R = "INSERT INTO institution_results(institution_id,exam,exam_year,appeared,passed,gpa5,total_students,failed) VALUES (1,'HSC',?,?,?,?,?,?)"
expect("valid result", R, (2025,100,90,10,105,10))
expect("passed > appeared rejected", R, (2024,100,101,0,None,None), True)
expect("gpa5 > passed rejected", R, (2023,100,90,95,None,None), True)
expect("appeared > total rejected", R, (2022,100,90,5,50,None), True)
expect("inconsistent failed rejected", R, (2021,100,90,5,None,3), True)
expect("duplicate exam/year/group rejected", R, (2025,100,90,10,105,10), True)
expect("bad exam type rejected", "INSERT INTO institution_results(institution_id,exam,exam_year,appeared,passed) VALUES (1,'JSC',2020,1,1)", (), True)
row = db.execute("SELECT pass_rate,gpa5_rate FROM v_institution_results WHERE exam_year=2025").fetchone()
print("PASS" if row == (90.0, 10.0) else "FAIL", "rates derived correctly", row); ok += row == (90.0,10.0); fail += row != (90.0,10.0)
db.execute("INSERT INTO institution_results(institution_id,exam,exam_year,appeared,passed) VALUES (1,'SSC',2020,0,0)")
z = db.execute("SELECT pass_rate FROM v_institution_results WHERE exam_year=2020").fetchone()[0]
print("PASS" if z is None else "FAIL", "zero appeared gives NULL, not 0%"); ok += z is None; fail += z is not None
expect("short correction message rejected", "INSERT INTO correction_requests(institution_id,message) VALUES (1,'bad')", (), True)
expect("valid correction accepted", "INSERT INTO correction_requests(institution_id,message) VALUES (1,'The address is outdated, see link.')")
expect("admin role check", "INSERT INTO admin_users(github_login,role) VALUES ('x','superuser')", (), True)
db.execute("INSERT INTO admin_users(github_login,role) VALUES ('Admin1','owner')")
expect("github login unique case-insensitive", "INSERT INTO admin_users(github_login) VALUES ('ADMIN1')", (), True)
db.execute("UPDATE institutions SET updated_at='2000-01-01T00:00:00Z' WHERE id=1")
db.execute("UPDATE institutions SET address='new' WHERE id=1")
u = db.execute("SELECT updated_at FROM institutions WHERE id=1").fetchone()[0]
print("PASS" if u > "2000-01-01" else "FAIL", "updated_at trigger", u); ok += u > "2000-01-01"; fail += not (u > "2000-01-01")
expect("cascade delete clears results", "DELETE FROM institutions WHERE id=1")
n = db.execute("SELECT count(*) FROM institution_results").fetchone()[0]
print("PASS" if n == 0 else "FAIL", "cascade removed results", n); ok += n == 0; fail += n != 0
print("seed counts:", [db.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in ("institution_types","divisions","districts","education_boards")])
print(f"\n{ok} passed, {fail} failed"); sys.exit(1 if fail else 0)
