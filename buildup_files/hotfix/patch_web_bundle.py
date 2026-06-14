import sys

bundle = "/usr/share/nginx/html/assets/index-BtpoGK-n.js"

with open(bundle, "r") as f:
    content = f.read()

orig_len = len(content)

# Fix 1: LoginPage - add admin redirect after login
old1 = 'getState().user;(y==null?void 0:y.userType)==="trucker"?c("/trucker/dashboard"):c("/dashboard")'
new1 = 'getState().user;(y==null?void 0:y.userType)==="trucker"?c("/trucker/dashboard"):(y==null?void 0:y.userType)==="admin"?(window.location.href="http://192.168.8.101:3011/admin"):c("/dashboard")'
c1 = content.count(old1)
content = content.replace(old1, new1)

# Fix 2: ProtectedRoute - admin user on wrong role route
old2 = '!==t?a.jsx(Ei,{to:(r==null?void 0:r.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(a.Fragment,{children:e})'
new2 = '!==t?(r==null?void 0:r.userType)==="admin"?(window.location.href="http://192.168.8.101:3011/admin",null):a.jsx(Ei,{to:(r==null?void 0:r.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(a.Fragment,{children:e})'
c2 = content.count(old2)
content = content.replace(old2, new2)

# Fix 3: RootRedirect - admin at root path
old3 = 'ted)?a.jsx(Ei,{to:(e==null?void 0:e.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(Ei,{to:"/login",replace:!0'
new3 = 'ted)?(e==null?void 0:e.userType)==="admin"?(window.location.href="http://192.168.8.101:3011/admin",null):a.jsx(Ei,{to:(e==null?void 0:e.userType)==="trucker"?"/trucker/dashboard":"/dashboard",replace:!0}):a.jsx(Ei,{to:"/login",replace:!0'
c3 = content.count(old3)
content = content.replace(old3, new3)

print(f"Fix1 matches: {c1}, Fix2 matches: {c2}, Fix3 matches: {c3}")
print(f"Length: {orig_len} -> {len(content)}")

if c1 + c2 + c3 == 0:
    print("ERROR: no matches found - bundle may have changed")
    sys.exit(1)

with open(bundle, "w") as f:
    f.write(content)

print("Bundle patched OK")
