import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def request_json(opener, method: str, url: str, headers: dict, data: dict | None = None) -> dict:
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with opener.open(req, timeout=300) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {e.code} for {method} {url}: {detail}") from e


def main() -> int:
    qid = int(sys.argv[1]) if len(sys.argv) > 1 else 1215383

    script_dir = Path(__file__).resolve().parent
    load_env(script_dir / ".env")
    api_key = os.getenv("DUNE_API_KEY")
    if not api_key:
        print("ERROR: Missing DUNE_API_KEY in .env")
        return 1

    headers = {
        "X-Dune-API-Key": api_key,
        "Content-Type": "application/json",
    }
    base = "https://api.dune.com/api/v1"

    # Ignore host proxy settings to avoid SOCKS dependency issues.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    execution = None
    for execute_url in (f"{base}/query/execute/{qid}", f"{base}/query/{qid}/execute"):
        try:
            execution = request_json(opener, "POST", execute_url, headers)
            break
        except RuntimeError:
            continue
    if execution is None:
        print("ERROR: Failed to execute query with known endpoint variants")
        return 1
    execution_id = execution.get("execution_id")
    if not execution_id:
        print(f"ERROR: No execution_id returned: {execution}")
        return 1

    while True:
        status = request_json(opener, "GET", f"{base}/execution/{execution_id}/status", headers)
        state = status.get("state")
        if state in {"PENDING", "EXECUTING", "QUERY_STATE_PENDING", "QUERY_STATE_EXECUTING"}:
            time.sleep(3)
            continue
        if state not in {"COMPLETED", "QUERY_STATE_COMPLETED"}:
            print(f"ERROR: Execution failed state={state} payload={status}")
            return 1
        break

    result = request_json(opener, "GET", f"{base}/execution/{execution_id}/results", headers)
    rows = result.get("result", {}).get("rows", [])

    print(f"execution_id={execution_id}")
    print(f"rows={len(rows)}")
    for i, row in enumerate(rows[:5], start=1):
        print(f"row_{i}={json.dumps(row, ensure_ascii=True)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
