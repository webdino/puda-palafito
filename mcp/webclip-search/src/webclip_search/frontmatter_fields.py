"""Resolve normalized frontmatter fields with fallbacks."""

from __future__ import annotations

from typing import Any


def get_source(frontmatter: dict[str, Any]) -> str:
    """Return source URL, falling back to uri when source is absent."""
    value = frontmatter.get("source") or frontmatter.get("uri")
    return str(value) if value else ""


def get_created(frontmatter: dict[str, Any]) -> str:
    """Return creation date, falling back to clip date when created is absent."""
    value = frontmatter.get("created") or frontmatter.get("clip date")
    return str(value) if value else ""


def get_time_on_page(frontmatter: dict[str, Any]) -> str:
    """Return time on page when present."""
    value = frontmatter.get("time on page")
    return str(value) if value else ""
