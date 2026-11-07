#!/usr/bin/env python3
"""WAT branded-query detection. No third-party dependencies so it can be unit-tested anywhere."""
import re

# Matches "wat agency", "wat? agency", "wat-agency", "wat.agency", "watagency",
# "wat agency belgium" etc. \b stops false matches such as "what agency" or "swat agency".
BRAND_PATTERN = re.compile(
    r"(?i)(?:\bwat\W*agency\b|\bwatagency|\bwatagencybelgium\b|\bviktoriia\s*marketing\b|\bviktoriiamarketing\b)"
)


def is_brand_query(query):
    """True when a search query is WAT's own brand and must not be used as a Keyword Planner seed."""
    return bool(query) and bool(BRAND_PATTERN.search(query))
