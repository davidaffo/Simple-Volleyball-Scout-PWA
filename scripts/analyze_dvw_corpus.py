#!/usr/bin/env python3
from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ROOT / "resources"

SKILL_RE = re.compile(r"^([*a])(\d{1,2})([SRABDEF])([HMQTUNO])([#=!+\-/])(.*?)(?:;|$)")


def parse_attack_tail(tail: str) -> bool:
    return bool(re.match(r"^(?:[A-Z0-9]{2})?~(\d)(\d)?([A-D]?)(?:~)?(.*)$", tail))


def parse_set_tail(tail: str) -> bool:
    if tail == "":
        return True
    if re.match(r"^[A-Z0-9]{2,3}$", tail):
        return True
    if re.match(r"^(?:[A-Z0-9]{2,3})?~~(\d)([A-D]?)(?:~~)?(.*)$", tail):
        return True
    if re.match(r"^(?:[A-Z0-9]{2,3})?~~(.*)$", tail):
        return True
    return bool(re.match(r"^(?:[A-Z0-9]{2})?([A-Z0-9]*)~(\d)([A-D]?)(.*)$", tail))


def parse_srv_tail(tail: str) -> bool:
    if not tail:
        return True
    return (
        bool(re.match(r"^~~~(\d)(\d)([A-D]?)(.*)$", tail))
        or bool(re.match(r"^~~~(\d)(.*)$", tail))
        or bool(re.match(r"^~~~~(\d)([A-D]?)(.*)$", tail))
        or bool(re.match(r"^~{6,}(.*)$", tail))
    )


def parse_block_tail(tail: str) -> bool:
    if not tail:
        return True
    return bool(re.match(r"^~~~~(\d)(.*)$", tail)) or bool(re.match(r"^~{6,}(.*)$", tail))


def analyze() -> tuple[Counter, dict[str, list[tuple[str, str]]], Counter]:
    unmatched = Counter()
    examples: dict[str, list[tuple[str, str]]] = defaultdict(list)
    totals = Counter()
    for path in sorted(RESOURCES.glob("*.dvw")):
        for line in path.read_text(errors="ignore").splitlines():
            match = SKILL_RE.match(line)
            if not match:
                continue
            _, _, skill, _, _, tail = match.groups()
            totals[skill] += 1
            ok = True
            if skill == "A":
                ok = parse_attack_tail(tail)
            elif skill == "E":
                ok = parse_set_tail(tail)
            elif skill in {"S", "R", "D", "F"}:
                ok = parse_srv_tail(tail)
            elif skill == "B":
                ok = parse_block_tail(tail)
            if not ok:
                unmatched[skill] += 1
                if len(examples[skill]) < 25:
                    examples[skill].append((path.name, line))
    return unmatched, examples, totals


def main() -> int:
    unmatched, examples, totals = analyze()
    print("DVW corpus coverage check")
    print("files:", len(list(RESOURCES.glob("*.dvw"))))
    print("totals:", dict(sorted(totals.items())))
    print("unmatched:", dict(sorted(unmatched.items())))
    if not unmatched:
        return 0
    print("\nexamples:")
    for skill in sorted(examples):
        print(f"\n[{skill}]")
        for name, line in examples[skill]:
            print(f"{name}: {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
