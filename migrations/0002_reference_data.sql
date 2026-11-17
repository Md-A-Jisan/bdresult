-- Reference data that is stable and well known. Districts/upazilas are intentionally NOT seeded here:
-- they must come from an official list (BBS/LGED codes) through the import tool, not from memory.
INSERT INTO institution_types (id, slug, url_slug, name_en, name_bn, sort_order) VALUES
 (1,'school','schools','School','স্কুল',1),
 (2,'college','colleges','College','কলেজ',2),
 (3,'madrasa','madrasas','Madrasa','মাদ্রাসা',3),
 (4,'technical','technical','Technical & Vocational','কারিগরি ও বৃত্তিমূলক',4),
 (5,'university','universities','University','বিশ্ববিদ্যালয়',5);

INSERT INTO divisions (id, slug, name_en, name_bn) VALUES
 (1,'barishal','Barishal','বরিশাল'),(2,'chattogram','Chattogram','চট্টগ্রাম'),
 (3,'dhaka','Dhaka','ঢাকা'),(4,'khulna','Khulna','খুলনা'),
 (5,'mymensingh','Mymensingh','ময়মনসিংহ'),(6,'rajshahi','Rajshahi','রাজশাহী'),
 (7,'rangpur','Rangpur','রংপুর'),(8,'sylhet','Sylhet','সিলেট');

INSERT INTO education_boards (id, slug, name_en, name_bn) VALUES
 (1,'dhaka','Dhaka','ঢাকা'),(2,'rajshahi','Rajshahi','রাজশাহী'),(3,'cumilla','Cumilla','কুমিল্লা'),
 (4,'jashore','Jashore','যশোর'),(5,'chattogram','Chattogram','চট্টগ্রাম'),(6,'barishal','Barishal','বরিশাল'),
 (7,'sylhet','Sylhet','সিলেট'),(8,'dinajpur','Dinajpur','দিনাজপুর'),(9,'mymensingh','Mymensingh','ময়মনসিংহ'),
 (10,'madrasah','Bangladesh Madrasah Education Board','বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড'),
 (11,'technical','Bangladesh Technical Education Board','বাংলাদেশ কারিগরি শিক্ষা বোর্ড');
