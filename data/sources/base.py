"""Download-once cache with atomic writes, retrieval time and SHA-256."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def record_source(path: Path, *, source_id: str, title: str, url: str,
                  publisher: str, version: str, licence: str,
                  retrieved_at: str | None = None) -> dict:
    return {
        "source_id": source_id, "title": title, "url": url,
        "publisher": publisher, "version": version, "licence": licence,
        "retrieved_at": retrieved_at or datetime.fromtimestamp(
            path.stat().st_mtime, timezone.utc
        ).isoformat(),
        "sha256": checksum(path), "bytes": path.stat().st_size,
    }


def fetch_cached(url: str, path: Path, *, refresh: bool = False) -> Path:
    """A cached URL is immutable unless refresh is explicitly requested."""
    stamp = path.with_suffix(path.suffix + ".meta.json")
    if path.exists() and not refresh:
        if not stamp.exists():
            raise ValueError(f"Unverified cache file: {path}; refresh it explicitly.")
        metadata = json.loads(stamp.read_text(encoding="utf-8"))
        if metadata["url"] != url or metadata["sha256"] != checksum(path):
            raise ValueError(f"Cache URL/checksum mismatch: {path}")
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".part")
    request = Request(url, headers={"User-Agent": "FutureProof feasibility research"})
    try:
        with urlopen(request, timeout=90) as response, partial.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        partial.replace(path)
    finally:
        partial.unlink(missing_ok=True)
    stamp.write_text(json.dumps({
        "url": url, "sha256": checksum(path),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }, indent=2) + "\n", encoding="utf-8")
    return path
