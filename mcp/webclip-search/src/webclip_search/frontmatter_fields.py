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


def get_time_on_page(frontmatter: dict[str, Any]) -> str:
    """Return time_on_page when present."""
    value = frontmatter.get("time_on_page")
    return str(value) if value else ""
