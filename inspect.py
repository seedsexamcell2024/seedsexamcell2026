p = r"C:\Users\Rasheed\.cline\data\workspaces\chat\seeds-academics-hub\app.js"
s = open(p, encoding="utf-8").read()
i = s.find("credit: creditView")
print(repr(s[i-20:i+40]))
