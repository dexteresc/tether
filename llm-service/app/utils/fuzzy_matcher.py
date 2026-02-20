"""
Fuzzy Matching Utilities using RapidFuzz (Feature 003)

This module provides helper functions for fuzzy string matching using
the Jaro-Winkler algorithm via RapidFuzz.
"""

from rapidfuzz.distance import JaroWinkler
from typing import Optional


def jaro_winkler_similarity(str1: str, str2: str) -> float:
    """
    Calculate Jaro-Winkler similarity between two strings.

    Args:
        str1: First string to compare
        str2: Second string to compare

    Returns:
        Similarity score between 0.0 (no match) and 1.0 (exact match)
    """
    if not str1 or not str2:
        return 0.0

    # Normalize to lowercase for case-insensitive comparison
    str1_lower = str1.lower()
    str2_lower = str2.lower()

    # Calculate Jaro-Winkler similarity
    similarity = JaroWinkler.similarity(str1_lower, str2_lower)

    return similarity


def fuzzy_match_name(
    reference: str,
    candidate: str,
    threshold: float = 0.8
) -> Optional[float]:
    """
    Check if a candidate name fuzzy matches a reference with a threshold.

    Args:
        reference: The reference name to match against
        candidate: The candidate name to check
        threshold: Minimum similarity score to consider a match (0.0-1.0)

    Returns:
        Similarity score if above threshold, None otherwise
    """
    similarity = jaro_winkler_similarity(reference, candidate)

    if similarity >= threshold:
        return similarity

    return None


def extract_first_name(full_name: str) -> str:
    """
    Extract the first name from a full name string.

    Args:
        full_name: Full name string (e.g., "John Smith", "John")

    Returns:
        First name component
    """
    if not full_name:
        return ""

    parts = full_name.strip().split()
    return parts[0] if parts else ""


def extract_last_name(full_name: str) -> Optional[str]:
    """
    Extract the last name from a full name string.

    Args:
        full_name: Full name string (e.g., "John Smith", "John")

    Returns:
        Last name component if present, None otherwise
    """
    if not full_name:
        return None

    parts = full_name.strip().split()
    return parts[-1] if len(parts) > 1 else None
