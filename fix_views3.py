p = r"C:\Users\Rasheed\.cline\data\workspaces\chat\seeds-academics-hub\app.js"
s = open(p, encoding="utf-8").read()
s = s.replace("      credit: creditView\n    };", "      credit: creditView,\n      homework: homeworkView\n    };")
open(p, "w", encoding="utf-8").write(s)
print("done")
