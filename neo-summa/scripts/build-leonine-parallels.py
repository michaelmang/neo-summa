#!/usr/bin/env python3
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUMMA_FILE = ROOT / "public" / "summa.json"
OUTPUT_FILE = ROOT / "public" / "leonine-parallels.json"
DEFAULT_SOURCES = [
    ("FP", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui04thom_abbyy.gz")),
    ("FP", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui5thom_abbyy.gz")),
    ("FS", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui06thom_abbyy.gz")),
    ("FS", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui07thom_abbyy.gz")),
    ("SS", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui08thom_abbyy.gz")),
    ("SS", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui09thom_abbyy.gz")),
    ("SS", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui10thom_abbyy.gz")),
    ("TP", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui11thom_abbyy.gz")),
    ("TP", Path("/Users/michael.mangialardi/Downloads/operaomniaiussui12thom_abbyy.gz")),
]
NS = "{http://www.abbyy.com/FineReader_xml/FineReader6-schema-v1.xml}"

ORDINALS = {
    "PRIMUS": 1,
    "PRIMA": 1,
    "SECUNDUS": 2,
    "SECUNDA": 2,
    "TERTIUS": 3,
    "TERTIA": 3,
    "QUARTUS": 4,
    "QUARTA": 4,
    "QUINTUS": 5,
    "QUINTA": 5,
    "SEXTUS": 6,
    "SEXTA": 6,
    "SEPTIMUS": 7,
    "SEPTIMA": 7,
    "OCTAVUS": 8,
    "OCTAVA": 8,
    "NONUS": 9,
    "NONA": 9,
    "DECIMUS": 10,
    "DECIMA": 10,
    "UNDECIMUS": 11,
    "UNDECIMA": 11,
    "DUODECIMUS": 12,
    "DUODECIMA": 12,
}
ROMANS = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
ORDINAL_UNITS = {
    "": 0,
    "PRIMA": 1,
    "SECUNDA": 2,
    "TERTIA": 3,
    "QUARTA": 4,
    "QUINTA": 5,
    "SEXTA": 6,
    "SEPTIMA": 7,
    "OCTAVA": 8,
    "NONA": 9,
}
ORDINAL_TENS = {
    "DECIMA": 10,
    "VIGESIMA": 20,
    "TRIGESIMA": 30,
    "QUADRAGESIMA": 40,
    "QUINQUAGESIMA": 50,
    "SEXAGESIMA": 60,
    "SEPTUAGESIMA": 70,
    "OCTOGESIMA": 80,
    "NONAGESIMA": 90,
}


def normalize_space(text=""):
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    text = re.sub(r"([([])\s+", r"\1", text)
    text = re.sub(r"\s+([])])", r"\1", text)
    return text.strip()


def roman_to_int(value=""):
    roman = value.upper().replace("J", "I")
    if not re.fullmatch(r"[IVXLCDM]+", roman):
        return None
    total = 0
    previous = 0
    for char in reversed(roman):
        current = ROMANS.get(char, 0)
        if current < previous:
            total -= current
        else:
            total += current
            previous = current
    return total or None


def ordinal_to_int(value=""):
    normalized = re.sub(r"[^A-Z]", "", value.upper())
    normalized = normalized.replace("GESLMA", "GESIMA").replace("GESL", "GESI")
    if normalized in ORDINALS:
        return ORDINALS[normalized]
    for tens_label, tens_value in ORDINAL_TENS.items():
        if normalized == tens_label:
            return tens_value
        if normalized.startswith(tens_label):
            unit = ORDINAL_UNITS.get(normalized[len(tens_label):])
            if unit:
                return tens_value + unit
    return None


def parse_number(value=""):
    value = value.strip()
    if value.isdigit():
        return int(value)
    ordinal = ordinal_to_int(value)
    if ordinal:
        return ordinal
    return roman_to_int(value)


def article_key(ref):
    return f"{ref['part']}:{ref['question']}:{ref['article']}"


def get_line_text(line):
    return normalize_space("".join(char.text or "" for char in line.iter(f"{NS}charParams")))


def get_page_lines(page):
    lines = []
    for block in page.findall(f"{NS}block"):
        if block.attrib.get("blockType") != "Text":
            continue
        for line in block.iter(f"{NS}line"):
            text = get_line_text(line)
            if text:
                lines.append(text)
    return lines


def is_index_page(lines):
    joined = " ".join(normalize_space(line).upper() for line in lines[:4])
    return "I N D E X" in joined or re.search(r"\bINDEX\b", joined)


def find_question_number(line):
    match = re.search(r"\b[QG9]UAESTIO\s+([A-Z]+|\d+)\.?\b", normalize_space(line).upper())
    return parse_number(match.group(1)) if match else None


def find_article_number(line):
    normalized = normalize_space(line).upper().replace("-", " ")
    match = re.match(r"^ARTICULUS\s+([A-Z]+)\b", normalized)
    if match:
        return parse_number(match.group(1))
    match = re.match(r"^ART\.?\s+([IVXLCDM]+|\d+)\.?\b", normalized)
    if match:
        return parse_number(match.group(1))
    return None


def get_inline_article_title(line):
    stripped = re.sub(r"^ARTICULUS\s+[A-Z]+\.?\s*", "", normalize_space(line), flags=re.I)
    stripped = re.sub(r"^ART\.?\s+(?:[IVXLCDM]+|\d+)\.?\s*", "", stripped, flags=re.I)
    return normalize_space(stripped) if is_article_title_line(stripped) else ""


def is_article_title_line(line):
    return normalize_space(line).upper().startswith("UTRUM ")


def is_body_start(line):
    normalized = normalize_space(line).upper()
    return bool(
        re.search(r"D\s+(PRIMUM|SECUNDUM|TERTIUM|QUARTUM|QUINTUM|SEXTUM|SEPTIMUM|OCTAVUM|NONUM|DECIMUM)\s+SIC\s+PROC", normalized)
        or re.search(r"^AD\s+(PRIMUM|SECUNDUM|TERTIUM|QUARTUM|QUINTUM|SEXTUM|SEPTIMUM|OCTAVUM|NONUM|DECIMUM)\s+SIC\s+PROC", normalized)
        or re.search(r"\b(PRIMUM|SECUNDUM|TERTIUM|QUARTUM|QUINTUM|SEXTUM|SEPTIMUM|OCTAVUM|NONUM|DECIMUM)\s+SIC\s+PROC", normalized)
        or "SIC PROCEDITUR" in normalized
    )


def clean_appartus(lines):
    while lines and not re.search(r"\b(I-II|II-II|III|Infra|Supra|Sent|Cont|Gent|Verit|Pot|Opusc|Quodl|Boet|Trin|Ethic|Metaphys|Physic|Psalm|Rom|Cor|Tim|De\s)", lines[0], re.I):
        lines = lines[1:]
    joined = " ".join(line for line in lines if not re.match(r"^[-•*']+$", line))
    joined = re.split(r"[<»►>a-z]*D\s+primu[.\w]*\s+si[ec]\s+proc", joined, flags=re.I)[0]
    joined = re.split(r"\bproceditur\b", joined, flags=re.I)[0]
    return normalize_space(re.sub(r"[»►>]+", "", joined))


def get_part_from_label(label, source_part):
    if not label:
        return source_part
    normalized = re.sub(r"\s+", "", label.upper())
    if normalized in {"I", "PRIMAPARS", "INFRA", "SUPRA"}:
        return source_part
    if normalized in {"I-II", "I*II", "IªIIAE"}:
        return "FS"
    if normalized in {"II-II", "II*II", "IIªIIAE"}:
        return "SS"
    if normalized == "III":
        return "TP"
    if normalized.startswith("SUPPL"):
        return "XP"
    return None


def normalize_note_for_refs(note):
    return (
        normalize_space(note)
        .replace("ir II", "I-II")
        .replace("irII", "I-II")
        .replace("r II", "I-II")
        .replace("I* II", "I-II")
        .replace("II* II", "II-II")
        .replace("I*II", "I-II")
        .replace("II*II", "II-II")
        .replace("qu*", "qu.")
        .replace('qu"', "qu.")
        .replace("art,", "art.")
    )


def parse_internal_targets(note, source_part):
    targets = []
    normalized = normalize_note_for_refs(note)
    part_pattern = r"(?:I-II|II-II|III|Suppl\.|Suppl|I|Prima Pars|Infra|Supra)"
    pattern = re.compile(
        rf"(?:^|;)\s*(?:({part_pattern})[\"']?\s*,?\s*)?qu\.?\s*([ivxlcdm]+|\d+)\s*,\s*art\.?\s*((?:\d+|[ivxlcdm]+)(?:\s*,\s*(?:\d+|[ivxlcdm]+))*)",
        re.I,
    )

    for match in pattern.finditer(normalized):
        if not match.group(1):
            continue
        part = get_part_from_label(match.group(1), source_part)
        question = parse_number(match.group(2))
        if not part or not question:
            continue
        for raw_article in re.split(r"\s*,\s*", match.group(3)):
            article = parse_number(raw_article)
            if article:
                targets.append({"part": part, "question": question, "article": article})
    return targets


def add_passage(passages, source, target, note):
    source_key = article_key(source)
    target_key = article_key(target)
    if source_key == target_key:
        return

    passages.setdefault(source_key, [])
    if not any(article_key(entry) == target_key and entry["source"] == "Leonine apparatus" for entry in passages[source_key]):
        passages[source_key].append({**target, "relation": "parallel", "source": "Leonine apparatus", "note": note})

    passages.setdefault(target_key, [])
    if not any(article_key(entry) == source_key and entry["source"] == "Leonine apparatus" for entry in passages[target_key]):
        passages[target_key].append({**source, "relation": "parallel", "source": "Leonine apparatus", "note": note})


def extract_volume(source_path, source_part):
    current_part = source_part
    current_question = None
    page_number = 0

    with gzip.open(source_path, "rb") as handle:
        for _, page in ET.iterparse(handle, events=("end",)):
            if page.tag != f"{NS}page":
                continue

            page_number += 1
            lines = get_page_lines(page)
            next_part = find_part_override(lines, current_part, page_number)
            if next_part != current_part:
                current_part = next_part
                current_question = None
            if is_index_page(lines):
                page.clear()
                continue
            index = 0

            while index < len(lines):
                question = find_question_number(lines[index])
                if question:
                    current_question = question

                article = find_article_number(lines[index])
                if not article or not current_question:
                    index += 1
                    continue

                cursor = index + 1
                title = get_inline_article_title(lines[index])
                while cursor < len(lines) and not is_article_title_line(lines[cursor]) and not is_body_start(lines[cursor]):
                    cursor += 1

                if not title and cursor < len(lines) and is_article_title_line(lines[cursor]):
                    title = normalize_space(lines[cursor])
                    cursor += 1

                apparatus_lines = []
                while cursor < len(lines) and not is_body_start(lines[cursor]) and not find_article_number(lines[cursor]):
                    line = lines[cursor]
                    if not find_question_number(line) and not re.match(r"^Commentaria", line, re.I):
                        apparatus_lines.append(line)
                    cursor += 1

                note = clean_appartus(apparatus_lines)
                if note:
                    yield {
                        "part": current_part,
                        "question": current_question,
                        "article": article,
                        "page": page_number,
                        "title": title,
                        "note": note,
                    }

                index = max(cursor, index + 1)

            page.clear()


def find_part_override(lines, current_part, page_number):
    if current_part == "TP" and page_number > 400:
        joined = " ".join(normalize_space(line).upper() for line in lines[:12])
        if "SUPPLEMENTUM" in joined and "TERTIAE PARTIS" in joined:
            return "XP"
    return current_part


def sort_entries(entries):
    return sorted(entries, key=lambda entry: (entry["part"], entry["question"], entry["article"], entry["source"]))


def main():
    sources = [("FP", Path(arg)) for arg in sys.argv[1:]] or DEFAULT_SOURCES
    summa = json.loads(SUMMA_FILE.read_text())
    article_index = {article_key(article) for article in summa["articles"]}
    apparatus = {}
    passages = {}

    for source_part, source_path in sources:
        if not source_path.exists():
            print(f"Skipping missing source: {source_path}", file=sys.stderr)
            continue

        source_seen = set()
        for entry in extract_volume(source_path, source_part):
            # The Supplement in volume XII uses a different page apparatus layout;
            # avoid surfacing partial OCR matches until it has its own parser pass.
            if entry["part"] == "XP":
                continue

            source = {"part": entry["part"], "question": entry["question"], "article": entry["article"]}
            while article_key(source) in source_seen:
                candidate = {**source, "article": source["article"] + 1}
                if article_key(candidate) not in article_index:
                    break
                source = candidate

            if article_key(source) not in article_index:
                continue

            source_seen.add(article_key(source))
            key = article_key(source)
            apparatus[key] = {
                "source": "Leonine apparatus",
                "volume": source_path.name.replace("_abbyy.gz", ""),
                "page": entry["page"],
                "note": entry["note"],
                "title": entry["title"],
            }

            for target in parse_internal_targets(entry["note"], entry["part"]):
                if article_key(target) in article_index:
                    add_passage(passages, source, target, entry["note"])

    for key, entries in list(passages.items()):
        passages[key] = sort_entries(entries)

    OUTPUT_FILE.write_text(json.dumps({
        "generatedFrom": [{"part": source_part, "file": source_path.name} for source_part, source_path in sources],
        "description": "Article-level Leonine apparatus extracted from ABBYY OCR. Internal Summa references are converted into bidirectional parallel passages; original notes are preserved for verification and future external linking.",
        "apparatus": apparatus,
        "passages": passages,
    }, indent=2) + "\n")

    passage_count = sum(len(entries) for entries in passages.values())
    print(f"Wrote {len(apparatus)} apparatus notes and {passage_count} passage links to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
