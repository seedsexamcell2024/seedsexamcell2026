p = r"C:\Users\Rasheed\.cline\data\workspaces\chat\seeds-academics-hub\app.js"
b = open(r"C:\Users\Rasheed\.cline\data\workspaces\chat\seeds-academics-hub\voice_hw_block.txt", encoding="utf-8").read()
s = open(p, encoding="utf-8").read()
marker = "  const saveHomeworkDiary = async event => {"
assert marker in s
s = s.replace(marker, b + "\n" + marker, 1)
open(p, "w", encoding="utf-8").write(s)
print("done")
