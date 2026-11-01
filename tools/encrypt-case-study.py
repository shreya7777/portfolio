#!/usr/bin/env python3
"""Encrypt a private case study so it can live in the public repo.

  python3 tools/encrypt-case-study.py [source_dir] [output_file]

Defaults:  private/ux-design  ->  Work/NCR/ux-design.enc

The source dir holds `case-study.md` (same markdown conventions as a project.md)
plus any images it references. Images are embedded in the encrypted bundle, so
nothing readable ends up in the repo. `private/` is gitignored; only the .enc
file is committed.

Password: set CASE_STUDY_PASSWORD, or you'll be prompted (typed twice).

File layout:  salt(16) | iv(16) | hmac(32) | ciphertext
Keys:         PBKDF2-HMAC-SHA256 (ITERATIONS) -> 64 bytes = AES-256 key | HMAC key
Cipher:       AES-256-CBC, encrypt-then-MAC (HMAC-SHA256 over iv|ciphertext)
The page's script.js (unlockSecurePage) must use the same ITERATIONS.
"""
import base64, getpass, hashlib, hmac, json, mimetypes, os, re, subprocess, sys

ITERATIONS = 250_000

src = sys.argv[1] if len(sys.argv) > 1 else "private/ux-design"
out = sys.argv[2] if len(sys.argv) > 2 else "Work/NCR/ux-design.enc"

md_path = os.path.join(src, "case-study.md")
if not os.path.exists(md_path):
    sys.exit(f"missing {md_path}")
md = open(md_path, encoding="utf-8").read()

# embed every local file the markdown mentions: ![alt](file "caption"){wide} and "- file | caption"
names = set(re.findall(r'\]\(([^)"]+?)(?:\s+"[^"]*")?\)', md))
names |= {m.group(1).strip() for m in re.finditer(r'^\s*-\s*([^|\n]+?)\s*\|', md, re.M)}
images = {}
for name in sorted(names):
    path = os.path.join(src, name)
    if os.path.isfile(path):
        mime = mimetypes.guess_type(path)[0] or {".webp": "image/webp"}.get(os.path.splitext(path)[1].lower(), "application/octet-stream")
        images[name] = f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()

password = os.environ.get("CASE_STUDY_PASSWORD")
if not password:
    password = getpass.getpass("Password for the case study: ")
    if password != getpass.getpass("Type it again: "):
        sys.exit("passwords don't match")
if len(password) < 8:
    sys.exit("use at least 8 characters — the encrypted file is public, so the password is the only protection")

plain = json.dumps({"md": md, "images": images}).encode()
salt, iv = os.urandom(16), os.urandom(16)
keys = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS, 64)
enc_key, mac_key = keys[:32], keys[32:]
ct = subprocess.run(
    ["openssl", "enc", "-aes-256-cbc", "-K", enc_key.hex(), "-iv", iv.hex()],
    input=plain, capture_output=True, check=True,
).stdout
mac = hmac.new(mac_key, iv + ct, hashlib.sha256).digest()
open(out, "wb").write(salt + iv + mac + ct)
print(f"wrote {out}  ({len(images)} image(s) embedded, {os.path.getsize(out) // 1024} KB)")
