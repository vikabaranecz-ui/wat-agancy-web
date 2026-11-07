#!/usr/bin/env python3
"""Inventory actual Claude skills readable by the GitHub Actions runner.
Do not download, execute, or invent skill definitions.
"""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

def parse_frontmatter(file):
    try:
        src = file.read_text(encoding="utf-8")[:12000]
        m = re.match(r"^---\s*\n(.*?)\n---", src, re.S)
        if not m:
            return None
        fm = m.group(1)
        name = re.search(r"(?m)^name:\s*['\"]?([^\n'\"#]+)", fm)
        desc = re.search(r"(?m)^description:\s*['\"]?([^\n\"]+)", fm)
        return {"name": name.group(1).strip() if name else file.parent.name,
                "description": (desc.group(1) if desc else "").strip()[:500]}
    except (UnicodeError, OSError):
        return None

def main():
    # GitHub Actions may have only repo-local skills. Claude web/account skills
    # are NOT available automatically through the GitHub API-key action.
    roots = [
        (Path(".claude/skills"), "project"),
        (Path.home() / ".claude/skills", "runner_user"),
        (Path.home() / ".claude/plugins", "runner_plugin")
    ]
    found = []
    for base, origin in roots:
        if not base.is_dir():
            continue
        for file in sorted(base.glob("**/SKILL.md"))[:200]:
            if file.is_symlink() or not file.is_file():
                continue
            entry = parse_frontmatter(file)
            if not entry:
                continue
            relative = str(file) if origin == "project" else str(file.relative_to(base))
            found.append({**entry, "origin": origin, "manifest_path": relative,
                          "status": "DISCOVERED_READABLE_NOT_EXECUTED"})
    output = {"generated_at": datetime.now(timezone.utc).isoformat(),
              "scope": "skills visible in WAT GitHub Actions runner only",
              "skills": found,
              "skill_count": len(found),
              "account_skills_status": "NOT_ACCESSIBLE_BY_DEFAULT_USING_ANTHROPIC_API_KEY",
              "selection": "Claude must read full skill only if relevant to observed WAT evidence.",
              "security": "No automatic fetching or executing unreviewed external skills"}
    Path("seo-weekly-skills.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    print("Actual readable runner skill manifests:", len(found))
    if not found:
        print("No local skills found; do not claim account-level skills were discovered.")

if __name__ == "__main__":
    main()
