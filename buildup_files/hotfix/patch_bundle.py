import sys

bundle = "/tmp/web-bundle.js"
out = "/tmp/web-bundle-patched.js"

with open(bundle, "r") as f:
    content = f.read()

orig_len = len(content)

old1 = 'getState().user;(y==null?void 0:y.userType)==="trucker"?c("/trucker/dashboard"):c("/dashboard")'
new1 = 'getState().user;(y==null?void 0:y.userType)==="trucker"?c("/trucker/dashboard"):(y==null?void 0:y.userType)==="admin"?(window.location.href="http://192.168.8.101:3011/admin"):c("/dashboard")'
c1 = content.count(old1)
content = content.replace(old1, new1)

old2 = '!==t?a.jsx(Ei,{to:(r==null?void 0:r.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(a.Fragment,{children:e})'
new2 = '!==t?(r==null?void 0:r.userType)==="admin"?(window.location.href="http://192.168.8.101:3011/admin",null):a.jsx(Ei,{to:(r==null?void 0:r.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(a.Fragment,{children:e})'
c2 = content.count(old2)
content = content.replace(old2, new2)

old3 = 'ted)?a.jsx(Ei,{to:(e==null?void 0:e.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(Ei,{to:"/login",replace:!0'
new3 = 'ted)?(e==null?void 0:e.userType)==="admin"?(window.location.href="http://192.168.8.101:3011/admin",null):a.jsx(Ei,{to:(e==null?void 0:e.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(Ei,{to:"/login",replace:!0'
c3 = content.count(old3)
content = content.replace(old3, new3)

print(f"Fix1: {c1}, Fix2: {c2}, Fix3: {c3}, len: {orig_len}->{len(content)}")

if c1 + c2 + c3 == 0:
    print("ERROR: no matches found - patterns not in bundle")
    sys.exit(1)

with open(out, "w") as f:
    f.write(content)
print(f"Patched bundle written to {out}")
