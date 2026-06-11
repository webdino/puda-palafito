"""Semantic search index: embed markdown body chunks and search by similarity."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from fastembed import TextEmbedding

from webclip_search.chunker import chunk_markdown_body
from webclip_search.frontmatter_fields import get_created, get_source, get_visit_duration

INDEX_VERSION = 1
DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
SNIPPET_CHARS = 200

_embedder: TextEmbedding | None = None
_embedder_model: str | None = None


@dataclass(frozen=True)
class SearchHit:
    relative_path: str
    filename: str
    score: float
    snippet: str
    chunk_index: int
    title: str
    source: str
    created: str
    visit_duration: str


@dataclass
class IndexStatus:
    index_path: Path
    model: str
    file_count: int
    chunk_count: int
    indexed_files: int
    pending_files: int
    with_summary: int
    with_description: int
    total_files: int


def get_index_path(webclip_dir: Path) -> Path:
    custom = os.environ.get("WEBCLIP_INDEX_PATH")
    if custom:
        return Path(custom)
    return webclip_dir / ".webclip-semantic-index.json"


def get_embed_model_name() -> str:
    return os.environ.get("WEBCLIP_EMBED_MODEL", DEFAULT_MODEL)


def get_max_chunk_chars() -> int:
    return int(os.environ.get("WEBCLIP_MAX_CHUNK_CHARS", "2000"))


def get_max_chunks_per_file() -> int:
    return int(os.environ.get("WEBCLIP_MAX_CHUNKS_PER_FILE", "30"))


def _get_embedder(model_name: str) -> TextEmbedding:
    global _embedder, _embedder_model
    if _embedder is None or _embedder_model != model_name:
        _embedder = TextEmbedding(model_name=model_name)
        _embedder_model = model_name
    return _embedder


def _relative_path(webclip_dir: Path, file_path: Path) -> str:
    return file_path.relative_to(webclip_dir).as_posix()


def _uses_e5_prefix(model_name: str) -> bool:
    return "e5" in model_name.lower()


def _embed_passages(model_name: str, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    embedder = _get_embedder(model_name)
    if _uses_e5_prefix(model_name):
        prefixed = [f"passage: {text}" for text in texts]
    else:
        prefixed = texts
    return [vec.tolist() for vec in embedder.embed(prefixed)]


def _embed_query(model_name: str, query: str) -> np.ndarray:
    embedder = _get_embedder(model_name)
    text = f"query: {query}" if _uses_e5_prefix(model_name) else query
    vector = next(embedder.embed([text]))
    return np.asarray(vector, dtype=np.float32)


def _cosine_similarity(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return np.zeros(matrix.shape[0], dtype=np.float32)
    row_norms = np.linalg.norm(matrix, axis=1)
    row_norms = np.where(row_norms == 0, 1.0, row_norms)
    return (matrix @ query_vec) / (row_norms * query_norm)


def _load_index(index_path: Path) -> dict[str, Any] | None:
    if not index_path.exists():
        return None
    try:
        data = json.loads(index_path.read_text(encoding="utf-8"))
        if data.get("version") != INDEX_VERSION:
            return None
        return data
    except (json.JSONDecodeError, OSError):
        return None


def _save_index(index_path: Path, data: dict[str, Any]) -> None:
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def _build_meta_prefix(frontmatter: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("title", "description", "summary"):
        value = frontmatter.get(key)
        if value:
            parts.append(str(value).strip())
    if not parts:
        return ""
    return "\n".join(parts)


def _index_file_chunks(
    webclip_dir: Path,
    file_path: Path,
    frontmatter: dict[str, Any],
    body: str,
    *,
    model_name: str,
    max_chunk_chars: int,
    max_chunks_per_file: int,
) -> list[dict[str, Any]]:
    body_chunks = chunk_markdown_body(
        body,
        max_chars=max_chunk_chars,
        max_chunks=max_chunks_per_file,
    )
    if not body_chunks:
        return []

    meta_prefix = _build_meta_prefix(frontmatter)
    embed_texts = [
        f"{meta_prefix}\n\n{chunk}".strip() if meta_prefix else chunk
        for chunk in body_chunks
    ]
    vectors = _embed_passages(model_name, embed_texts)
    rel_path = _relative_path(webclip_dir, file_path)
    mtime = file_path.stat().st_mtime

    records: list[dict[str, Any]] = []
    for idx, (text, vector) in enumerate(zip(embed_texts, vectors, strict=True)):
        records.append(
            {
                "relative_path": rel_path,
                "mtime": mtime,
                "chunk_index": idx,
                "text": text,
                "vector": vector,
                "title": str(frontmatter.get("title", "")),
                "source": get_source(frontmatter),
                "created": get_created(frontmatter),
                "visit_duration": get_visit_duration(frontmatter),
                "has_summary": bool(frontmatter.get("summary")),
                "has_description": bool(frontmatter.get("description")),
            }
        )
    return records


def sync_index(
    webclip_dir: Path,
    markdown_files: list[Path],
    parse_file_content: Any,
    *,
    rebuild: bool = False,
) -> dict[str, Any]:
    """Update the semantic index for changed files and return index data."""
    index_path = get_index_path(webclip_dir)
    model_name = get_embed_model_name()
    max_chunk_chars = get_max_chunk_chars()
    max_chunks_per_file = get_max_chunks_per_file()

    if rebuild:
        data: dict[str, Any] | None = None
    else:
        data = _load_index(index_path)
        if data and data.get("model") != model_name:
            data = None

    if data is None:
        data = {
            "version": INDEX_VERSION,
            "model": model_name,
            "chunks": [],
        }

    existing_by_path: dict[str, list[dict[str, Any]]] = {}
    for chunk in data["chunks"]:
        existing_by_path.setdefault(chunk["relative_path"], []).append(chunk)

    current_paths: set[str] = set()
    for file_path in markdown_files:
        rel_path = _relative_path(webclip_dir, file_path)
        current_paths.add(rel_path)
        mtime = file_path.stat().st_mtime

        existing = existing_by_path.get(rel_path, [])
        if existing and not rebuild and existing[0].get("mtime") == mtime:
            continue

        frontmatter, body = parse_file_content(file_path)
        new_chunks = _index_file_chunks(
            webclip_dir,
            file_path,
            frontmatter,
            body,
            model_name=model_name,
            max_chunk_chars=max_chunk_chars,
            max_chunks_per_file=max_chunks_per_file,
        )
        existing_by_path[rel_path] = new_chunks

    for rel_path in list(existing_by_path.keys()):
        if rel_path not in current_paths:
            del existing_by_path[rel_path]

    merged: list[dict[str, Any]] = []
    for rel_path in sorted(existing_by_path.keys()):
        merged.extend(existing_by_path[rel_path])

    data["chunks"] = merged
    data["model"] = model_name
    _save_index(index_path, data)
    return data


def search_semantic(
    webclip_dir: Path,
    query: str,
    markdown_files: list[Path],
    parse_file_content: Any,
    *,
    top_k: int = 10,
    rebuild: bool = False,
) -> tuple[list[SearchHit], dict[str, Any]]:
    """Run semantic search over body chunks."""
    data = sync_index(
        webclip_dir,
        markdown_files,
        parse_file_content,
        rebuild=rebuild,
    )
    chunks = data.get("chunks", [])
    if not chunks:
        return [], data

    model_name = data["model"]
    query_vec = _embed_query(model_name, query)
    matrix = np.asarray([chunk["vector"] for chunk in chunks], dtype=np.float32)
    scores = _cosine_similarity(query_vec, matrix)

    best_by_file: dict[str, tuple[float, int]] = {}
    for i, score in enumerate(scores.tolist()):
        rel_path = chunks[i]["relative_path"]
        current = best_by_file.get(rel_path)
        if current is None or score > current[0]:
            best_by_file[rel_path] = (score, i)

    ranked = sorted(best_by_file.items(), key=lambda item: item[1][0], reverse=True)[:top_k]

    hits: list[SearchHit] = []
    for rel_path, (score, chunk_idx) in ranked:
        chunk = chunks[chunk_idx]
        text = chunk["text"]
        snippet = text[:SNIPPET_CHARS]
        if len(text) > SNIPPET_CHARS:
            snippet += "..."
        hits.append(
            SearchHit(
                relative_path=rel_path,
                filename=Path(rel_path).name,
                score=score,
                snippet=snippet,
                chunk_index=chunk["chunk_index"],
                title=chunk.get("title", ""),
                source=chunk.get("source", ""),
                created=chunk.get("created", ""),
                visit_duration=chunk.get("visit_duration", ""),
            )
        )
    return hits, data


def get_index_status(
    webclip_dir: Path,
    markdown_files: list[Path],
    parse_file_content: Any,
) -> IndexStatus:
    """Return index statistics without forcing a full rebuild."""
    index_path = get_index_path(webclip_dir)
    model_name = get_embed_model_name()
    data = _load_index(index_path)

    indexed_paths: dict[str, float] = {}
    if data and data.get("model") == model_name:
        for chunk in data.get("chunks", []):
            indexed_paths[chunk["relative_path"]] = chunk.get("mtime", 0.0)

    pending = 0
    with_summary = 0
    with_description = 0
    for file_path in markdown_files:
        rel_path = _relative_path(webclip_dir, file_path)
        mtime = file_path.stat().st_mtime
        if rel_path not in indexed_paths or indexed_paths[rel_path] != mtime:
            pending += 1
        frontmatter, _ = parse_file_content(file_path)
        if frontmatter.get("summary"):
            with_summary += 1
        if frontmatter.get("description"):
            with_description += 1

    chunk_count = len(data.get("chunks", [])) if data else 0
    return IndexStatus(
        index_path=index_path,
        model=model_name,
        file_count=len(markdown_files),
        chunk_count=chunk_count,
        indexed_files=len(indexed_paths),
        pending_files=pending,
        with_summary=with_summary,
        with_description=with_description,
        total_files=len(markdown_files),
    )
