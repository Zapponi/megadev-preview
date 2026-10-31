"""PreToolUse hook: block edits under runs/ (real nights, read-only fixtures; AGENTS.md)."""
import json, os, sys

data = json.load(sys.stdin)
path = (data.get("tool_input") or {}).get("file_path") or ""
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
rel = os.path.relpath(os.path.abspath(path), root).replace("\\", "/") if path else ""
if rel == "runs" or rel.startswith("runs/"):
    print(f"guard_runs: {rel} is read-only (AGENTS.md: don't touch runs/). Tests use a temp runs dir.", file=sys.stderr)
    sys.exit(2)
