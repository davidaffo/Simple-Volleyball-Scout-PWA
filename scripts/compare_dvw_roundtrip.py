#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ROOT / "resources"

SKILL_RE = re.compile(r"^([*a])(\d{1,2})([SRABDEF])([HMQTUNO])([#=!+\-/])(.*)$")


def parse_dvw_row(line: str) -> list[str]:
    return [part.strip() for part in str(line or "").split(";")]


def parse_zone_meta(zone_pair: tuple[str, str] | None) -> dict[str, str]:
    raw_start = (zone_pair[0] if zone_pair else "").upper()
    raw_end = (zone_pair[1] if zone_pair else "").upper()
    start_zone = raw_start if re.fullmatch(r"\d", raw_start) else ""
    end_zone = raw_end if re.fullmatch(r"\d", raw_end) else ""
    end_subzone = raw_end if (not end_zone and re.fullmatch(r"[A-Z]", raw_end)) else ""
    return {
        "startZone": start_zone,
        "endZone": end_zone,
        "endSubzone": end_subzone,
        "endCone": "",
    }


def parse_tail_parts(tail: str) -> dict[str, object]:
    raw = str(tail or "").strip().upper()
    if not raw:
        return {
            "advancedCode": "",
            "inlineCode": "",
            "zonePair": None,
            "suffix": "",
            "raw": raw,
        }
    zone_match = re.search(r"~(.)?(.)?(.*)$", raw)
    lead = raw[: zone_match.start()] if zone_match else raw
    advanced_code = lead[:2] if len(lead) >= 2 and re.match(r"^[A-Z0-9]{2}", lead) else ""
    inline_code = lead[2:] if advanced_code else lead
    if not zone_match:
        return {
            "advancedCode": advanced_code,
            "inlineCode": inline_code,
            "zonePair": None,
            "suffix": "",
            "raw": raw,
        }
    start_raw = (zone_match.group(1) or "").upper()
    end_raw = (zone_match.group(2) or "").upper()
    suffix = (zone_match.group(3) or "").upper()
    if suffix.startswith("~"):
        suffix = suffix[1:]
    return {
        "advancedCode": advanced_code,
        "inlineCode": inline_code,
        "zonePair": (
            start_raw if start_raw != "~" else "",
            end_raw if end_raw != "~" else "",
        ),
        "suffix": suffix,
        "raw": raw,
    }


def refine_tail_by_skill(skill: str, raw_tail: str, parsed_parts: dict[str, object]) -> dict[str, object]:
    raw = str(raw_tail or "").strip().upper()
    fallback = {
        "zoneMeta": parse_zone_meta(parsed_parts.get("zonePair")),
        "suffix": parsed_parts.get("suffix", ""),
    }
    if not raw:
        return fallback
    if skill == "A":
        match = re.match(r"^(?:[A-Z0-9]{2})?~(\d)(\d)?([A-D]?)(?:~)?(.*)$", raw)
        if match:
            return {
                "zoneMeta": {
                    "startZone": match.group(1) or "",
                    "endZone": match.group(2) or "",
                    "endSubzone": match.group(3) or "",
                    "endCone": "",
                },
                "suffix": (match.group(4) or "").upper(),
            }
    if skill == "E":
        no_start_zone = re.match(r"^(?:[A-Z0-9]{2,3})?~~(\d)([A-D]?)(?:~~)?(.*)$", raw)
        if no_start_zone:
            return {
                "zoneMeta": {
                    "startZone": "",
                    "endZone": no_start_zone.group(1) or "",
                    "endSubzone": no_start_zone.group(2) or "",
                    "endCone": "",
                },
                "suffix": (no_start_zone.group(3) or "").upper(),
            }
        simple_suffix = re.match(r"^(?:[A-Z0-9]{2,3})?~~(.*)$", raw)
        if simple_suffix:
            return {
                "zoneMeta": {"startZone": "", "endZone": "", "endSubzone": "", "endCone": ""},
                "suffix": (simple_suffix.group(1) or "").upper(),
            }
        match = re.match(r"^(?:[A-Z0-9]{2})?([A-Z0-9]*)~(\d)([A-D]?)(.*)$", raw)
        if match:
            return {
                "zoneMeta": {
                    "startZone": "",
                    "endZone": match.group(2) or "",
                    "endSubzone": match.group(3) or "",
                    "endCone": "",
                },
                "suffix": (match.group(4) or "").upper(),
            }
    if skill in {"S", "R", "D", "F"}:
        match = re.match(r"^~~~(\d)(\d)([A-D]?)(.*)$", raw)
        if match:
            return {
                "zoneMeta": {
                    "startZone": match.group(1) or "",
                    "endZone": match.group(2) or "",
                    "endSubzone": match.group(3) or "",
                    "endCone": "",
                },
                "suffix": (match.group(4) or "").upper(),
            }
        single_zone = re.match(r"^~~~(\d)(.*)$", raw)
        if single_zone:
            return {
                "zoneMeta": {
                    "startZone": "",
                    "endZone": single_zone.group(1) or "",
                    "endSubzone": "",
                    "endCone": "",
                },
                "suffix": (single_zone.group(2) or "").upper(),
            }
        end_only = re.match(r"^~~~~(\d)([A-D]?)(.*)$", raw)
        if end_only:
            return {
                "zoneMeta": {
                    "startZone": "",
                    "endZone": end_only.group(1) or "",
                    "endSubzone": end_only.group(2) or "",
                    "endCone": "",
                },
                "suffix": (end_only.group(3) or "").upper(),
            }
        suffix_only = re.match(r"^~{6,}(.*)$", raw)
        if suffix_only:
            return {
                "zoneMeta": {"startZone": "", "endZone": "", "endSubzone": "", "endCone": ""},
                "suffix": (suffix_only.group(1) or "").upper(),
            }
    if skill == "B":
        match = re.match(r"^~~~~(\d)(.*)$", raw)
        if match:
            return {
                "zoneMeta": {
                    "startZone": "",
                    "endZone": match.group(1) or "",
                    "endSubzone": "",
                    "endCone": "",
                },
                "suffix": (match.group(2) or "").upper(),
            }
        suffix_only = re.match(r"^~{6,}(.*)$", raw)
        if suffix_only:
            return {
                "zoneMeta": {"startZone": "", "endZone": "", "endSubzone": "", "endCone": ""},
                "suffix": (suffix_only.group(1) or "").upper(),
            }
    return fallback


def parse_suffix_meta(skill: str, inline_code: str, suffix: str) -> dict[str, object]:
    inline = str(inline_code or "").strip().upper()
    raw_suffix = str(suffix or "").strip().upper()
    cleaned = raw_suffix.lstrip("~")
    base = {"skillSubtype": "", "specialCode": "", "numPlayersNumeric": None}
    if skill == "A":
        match = re.match(r"^([A-Z])(\d*)(.*)$", cleaned)
        if match:
            return {
                "skillSubtype": match.group(1) or "",
                "numPlayersNumeric": int(match.group(2)) if match.group(2) else None,
                "specialCode": match.group(3) or "",
            }
        return {
            "skillSubtype": cleaned[:1] if cleaned else "",
            "specialCode": cleaned[1:] if cleaned else "",
            "numPlayersNumeric": None,
        }
    if skill == "B":
        match = re.match(r"^(\d*)(.*)$", cleaned)
        if match:
            return {
                "skillSubtype": "",
                "numPlayersNumeric": int(match.group(1)) if match.group(1) else None,
                "specialCode": match.group(2) or "",
            }
        return {"skillSubtype": "", "numPlayersNumeric": None, "specialCode": cleaned}
    if skill == "E":
        return {"skillSubtype": inline, "specialCode": cleaned, "numPlayersNumeric": None}
    if skill == "R":
        if raw_suffix.startswith("~~"):
            return {**base, "specialCode": cleaned}
        if re.match(r"^[A-Z]", cleaned):
            return {"skillSubtype": cleaned[:1], "specialCode": cleaned[1:], "numPlayersNumeric": None}
        return {**base, "specialCode": cleaned}
    if skill in {"S", "D", "F"}:
        return {**base, "specialCode": cleaned}
    return {
        "skillSubtype": inline or (cleaned[:1] if cleaned else ""),
        "specialCode": cleaned if inline else (cleaned[1:] if cleaned else ""),
        "numPlayersNumeric": None,
    }


def build_zone_tail(skill: str, zone_meta: dict[str, str]) -> str:
    start_zone = zone_meta.get("startZone", "")
    end_zone = zone_meta.get("endZone", "")
    end_subzone = zone_meta.get("endSubzone", "")
    if skill == "A":
        if not start_zone and not end_zone and not end_subzone:
            return ""
        if start_zone and not end_zone and not end_subzone:
            return f"~{start_zone}~"
        return f"~{start_zone}{end_zone}{end_subzone}"
    if skill == "E":
        inline = zone_meta.get("_inlineSkillSubtype", "")
        if not end_zone and not end_subzone:
            return ""
        return f"{'~' if inline else '~~'}{end_zone}{end_subzone}"
    if skill in {"S", "R", "D", "F"}:
        if start_zone:
            return f"~~~{start_zone}{end_zone}{end_subzone}"
        if end_zone or end_subzone:
            return f"~~~~{end_zone}{end_subzone}"
        return ""
    if skill == "B":
        if not end_zone:
            return ""
        return f"~~~~{end_zone}"
    return ""


def build_post_zone_tail(skill: str, meta: dict[str, object]) -> str:
    if skill == "A":
        subtype = str(meta.get("skillSubtype") or "").upper()
        num = "" if meta.get("numPlayersNumeric") is None else str(meta["numPlayersNumeric"])
        special = str(meta.get("specialCode") or "").upper()
        has_subzone = bool(meta.get("_end_subzone"))
        return f"{'' if has_subzone else '~'}{subtype}{num}{special}" if (subtype or num or special) else ""
    if skill == "B":
        num = "" if meta.get("numPlayersNumeric") is None else str(meta["numPlayersNumeric"])
        special = str(meta.get("specialCode") or "").upper()
        if num or special:
            if not num and special:
                return f"~~~{special}" if meta.get("_has_zone") else f"~~~~~~~~~{special}"
            return f"~~{num}{special}" if meta.get("_has_zone") else f"~~~~~~~~{num}{special}"
        return ""
    if skill == "R":
        subtype = str(meta.get("skillSubtype") or "").upper()
        special = str(meta.get("specialCode") or "").upper()
        has_subzone = bool(meta.get("_end_subzone"))
        if subtype:
            return f"{'' if has_subzone else '~'}{subtype}{special}"
        if special:
            return f"~~{special}"
        return ""
    if skill == "E":
        special = str(meta.get("specialCode") or "").upper()
        if not special:
            return ""
        has_zone = bool(meta.get("_has_zone"))
        has_set_lead = bool(meta.get("_set_lead"))
        if not has_zone and not has_set_lead and re.match(r"^(U|I|0)$", special):
            return f"~~~~~~~~{special}"
        return special if re.match(r"^[0-9~]", special) else f"~~{special}"
    if skill == "S":
        special = str(meta.get("specialCode") or "").upper()
        if not special:
            return ""
        if not meta.get("_has_zone"):
            return f"~~~~~~~~~{special}"
        return f"~~{special}"
    if skill == "D":
        special = str(meta.get("specialCode") or "").upper()
        if not special:
            return ""
        has_subzone = bool(meta.get("_end_subzone"))
        return f"{'' if has_subzone else '~'}{special}" if meta.get("_has_zone") else f"~~~~~~{special}"
    if skill == "F":
        special = str(meta.get("specialCode") or "").upper()
        if not special:
            return ""
        has_subzone = bool(meta.get("_end_subzone"))
        return f"{'' if has_subzone else '~'}{special}" if meta.get("_has_zone") else f"~~~~~~~~{special}"
    return str(meta.get("specialCode") or "").upper()


def roundtrip_code(code: str) -> str:
    raw = str(code or "").strip()
    if not raw:
        return raw
    if re.match(r"^([*a])c(\d{1,2}):(\d{1,2})$", raw, re.I):
        return raw
    if re.match(r"^([*a])T$", raw, re.I):
        return raw
    if re.match(r"^([*a])\$\$&([A-Z])([#=!+\-/])?$", raw, re.I):
        return raw
    if re.match(r"^([*a])p(\d+):(\d+)$", raw, re.I):
        return raw
    if re.match(r"^([*a])z\d+", raw, re.I):
        return raw
    if re.match(r"^([*a])P\d+>LUp", raw, re.I):
        return raw
    if re.match(r"^\*\*\d+set", raw, re.I):
        return raw
    match = SKILL_RE.match(raw)
    if not match:
        return raw
    prefix, player_number, skill, type_letter, evaluation, tail = match.groups()
    parts = parse_tail_parts(tail)
    refined = refine_tail_by_skill(skill, tail, parts)
    refined["zoneMeta"]["_inlineSkillSubtype"] = str(parts.get("inlineCode") or "")
    suffix_meta = parse_suffix_meta(skill, str(parts.get("inlineCode") or ""), str(refined.get("suffix") or ""))
    zone_tail = build_zone_tail(skill, refined["zoneMeta"])
    suffix_meta["_has_zone"] = bool(zone_tail)
    suffix_meta["_end_subzone"] = str(refined["zoneMeta"].get("endSubzone") or "")
    suffix_meta["_set_lead"] = bool(parts.get("advancedCode") or parts.get("inlineCode"))
    post_zone = build_post_zone_tail(skill, suffix_meta)
    rebuilt_tail = ""
    if skill == "E":
        rebuilt_tail += str(parts.get("advancedCode") or "")
        rebuilt_tail += str(suffix_meta.get("skillSubtype") or "")
    elif skill == "A":
        rebuilt_tail += str(parts.get("advancedCode") or "")
    rebuilt_tail += zone_tail
    rebuilt_tail += post_zone
    return f"{prefix}{player_number}{skill}{type_letter}{evaluation}{rebuilt_tail}"


def compare_file(path: Path) -> tuple[Counter, list[tuple[str, str]]]:
    counts = Counter()
    examples: list[tuple[str, str]] = []
    in_scout = False
    for line in path.read_text(errors="ignore").splitlines():
        stripped = line.strip()
        if stripped == "[3SCOUT]":
            in_scout = True
            continue
        if in_scout and stripped.startswith("[3") and stripped != "[3SCOUT]":
            break
        if not in_scout or not stripped:
            continue
        row = parse_dvw_row(line)
        if not row:
            continue
        original = row[0].strip()
        rebuilt = roundtrip_code(original)
        counts["rows"] += 1
        if original == rebuilt:
            counts["identical"] += 1
        else:
            counts["changed"] += 1
            skill_match = SKILL_RE.match(original)
            if skill_match:
                counts[f"changed_{skill_match.group(3)}"] += 1
            if len(examples) < 25:
                examples.append((original, rebuilt))
    return counts, examples


def main() -> int:
    totals = Counter()
    per_file = {}
    examples = {}
    for path in sorted(RESOURCES.glob("*.dvw")):
        counts, sample = compare_file(path)
        per_file[path.name] = counts
        totals.update(counts)
        if sample:
            examples[path.name] = sample
    print("DVW roundtrip code comparison")
    print("files:", len(per_file))
    print("totals:", dict(totals))
    for name, counts in per_file.items():
        changed = counts.get("changed", 0)
        rows = counts.get("rows", 0)
        if changed:
            print(f"{name}: changed {changed}/{rows}")
    if examples:
        print("\nexamples:")
        for name, sample in examples.items():
            print(f"\n[{name}]")
            for original, rebuilt in sample[:10]:
                print("ORIG ", original)
                print("NEW  ", rebuilt)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
