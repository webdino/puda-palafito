"""Markdown body chunking for semantic search."""

from __future__ import annotations

import re

_CODE_FENCE_PATTERN = re.compile(r"(```[\s\S]*?```)", re.MULTILINE)
_HEADER_PATTERN = re.compile(r"^(#{1,6}\s.+)$", re.MULTILINE)


def chunk_markdown_body(
    body: str,
    *,
    max_chars: int = 2000,
    min_chars: int = 50,
    max_chunks: int = 30,
    overlap_ratio: float = 0.1,
) -> list[str]:
    """Split markdown body into chunks suitable for embedding.

    Code fences are kept intact. Sections are split on headings when possible,
    then merged or sub-split to respect size limits.
    """
    body = body.strip()
    if not body:
        return []

    chunks: list[str] = []
    for part in _CODE_FENCE_PATTERN.split(body):
        if not part or not part.strip():
            continue
        if part.startswith("```"):
            if len(part.strip()) >= min_chars:
                chunks.append(part.strip())
            continue
        chunks.extend(_chunk_text_part(part, max_chars=max_chars, overlap_ratio=overlap_ratio))

    filtered = [c for c in chunks if len(c) >= min_chars]
    if len(filtered) > max_chunks:
        filtered = filtered[:max_chunks]
    return filtered


def _chunk_text_part(text: str, *, max_chars: int, overlap_ratio: float) -> list[str]:
    sections = _split_by_headers(text)
    chunks: list[str] = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        if len(section) <= max_chars:
            chunks.append(section)
            continue
        chunks.extend(_split_long_text(section, max_chars=max_chars, overlap_ratio=overlap_ratio))
    return chunks


def _split_by_headers(text: str) -> list[str]:
    parts = _HEADER_PATTERN.split(text)
    if len(parts) == 1:
        return [text]

    sections: list[str] = []
    current = parts[0]
    i = 1
    while i < len(parts):
        header = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        piece = f"{header}{body}".strip()
        if current.strip():
            sections.append(current.strip())
        sections.append(piece)
        current = ""
        i += 2
    if current.strip():
        sections.append(current.strip())
    return [s for s in sections if s.strip()]


def _split_long_text(text: str, *, max_chars: int, overlap_ratio: float) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return [text[:max_chars]]

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        para_len = len(paragraph)
        if para_len > max_chars:
            if current:
                chunks.append("\n\n".join(current))
                current = []
                current_len = 0
            chunks.extend(
                _hard_split(paragraph, max_chars=max_chars, overlap_ratio=overlap_ratio)
            )
            continue

        added_len = para_len + (2 if current else 0)
        if current_len + added_len <= max_chars:
            current.append(paragraph)
            current_len += added_len
        else:
            if current:
                chunks.append("\n\n".join(current))
            current = [paragraph]
            current_len = para_len

    if current:
        chunks.append("\n\n".join(current))
    return chunks


def _hard_split(text: str, *, max_chars: int, overlap_ratio: float) -> list[str]:
    overlap = max(0, int(max_chars * overlap_ratio))
    step = max(1, max_chars - overlap)
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start += step
    return chunks
