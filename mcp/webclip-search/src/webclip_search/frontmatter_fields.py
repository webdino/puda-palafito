"""Resolve normalized frontmatter fields with fallbacks."""

from __future__ import annotations

from typing import Any


def get_source(frontmatter: dict[str, Any]) -> str:
    """Return source URL, falling back to url when source is absent."""
    value = frontmatter.get("source") or frontmatter.get("url")
    return str(value) if value else ""


def get_created(frontmatter: dict[str, Any]) -> str:
    """Return creation date, falling back to clip_date when created is absent."""
    value = frontmatter.get("created") or frontmatter.get("clip_date")
    return str(value) if value else ""


def get_visit_duration(frontmatter: dict[str, Any]) -> str:
    """Return visit_duration when present."""
    value = frontmatter.get("visit_duration")
    return str(value) if value else ""


def get_window_id(frontmatter: dict[str, Any]) -> str:
    """Return window_id when present."""
    if "window_id" not in frontmatter:
        return ""
    return str(frontmatter["window_id"])


def get_tab_id(frontmatter: dict[str, Any]) -> str:
    """Return tab_id when present."""
    if "tab_id" not in frontmatter:
        return ""
    return str(frontmatter["tab_id"])
