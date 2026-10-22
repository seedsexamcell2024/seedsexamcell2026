p = r"C:\Users\Rasheed\.cline\data\workspaces\chat\seeds-academics-hub\app.js"
b = open(r"C:\Users\Rasheed\.cline\data\workspaces\chat\seeds-academics-hub\homework_view_block.txt", encoding="utf-8").read()
s = open(p, encoding="utf-8").read()
marker = "  const accountsView = () => {"
assert marker in s, "marker not found"
s = s.replace(marker, b + "\n" + marker, 1)
open(p, "w", encoding="utf-8").write(s)
print("done")
