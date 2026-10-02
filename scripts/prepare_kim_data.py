"""Convert the author's Kim v2 volume to the existing Allen 50 µm grid.

Requires numpy. Inputs are the three public files from Figshare 25750983 v1;
no PDF, image tracing, registration fitting, or label interpolation is used.
"""
import argparse
import csv
import gzip
import json
from pathlib import Path
import struct

import numpy as np

from data_assets import file_digest as digest, sha256

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://figshare.com/articles/dataset/Unified_mouse_brain_atlas_v2/25750983"
ORIENTATION_SOURCE = "https://github.com/brainglobe/brainglobe-atlasapi/blob/main/atlas_scripts/kim_mouse_isotropic.py"


def read_volume(path, expected_md5):
    if digest(path, "md5") != expected_md5:
        raise ValueError(f"Source checksum mismatch: {path}")
    with path.open("rb") as stream:
        header = stream.read(352)
    endian = "<" if struct.unpack_from("<i", header)[0] == 348 else ">"
    assert struct.unpack_from(endian + "i", header)[0] == 348
    assert struct.unpack_from(endian + "8h", header, 40)[1:4] == (570, 400, 660)
    datatype, bits = struct.unpack_from(endian + "hh", header, 70)
    assert datatype in (4, 512) and bits == 16
    assert struct.unpack_from(endian + "f", header, 108)[0] == 352
    assert struct.unpack_from(endian + "ff", header, 112) in ((0, 0), (1, 0))
    data = np.memmap(path, dtype=endian + ("i2" if datatype == 4 else "u2"),
                     mode="r", offset=352, shape=(570, 400, 660), order="F")
    # BrainGlobe RSP names the origin sides: right/superior/posterior.
    # Reorder ML,DV,AP to AP,DV,ML, then reverse AP and ML to Allen PIR directions.
    return data.transpose(2, 1, 0)[::-1, :, ::-1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--annotation", required=True, type=Path)
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--ontology", required=True, type=Path)
    args = parser.parse_args()
    annotation = read_volume(args.annotation, "879bf3bc389c9392fddbefd3a9f8f1c7")
    template = read_volume(args.template, "e2e353d7fb00ffee1d9d42719bc41823")
    assert digest(args.ontology, "md5") == "8fc0dc6f6de293448f21d8691ddd8568"
    allen = json.loads((ROOT / "public/data/manifest.json").read_text())
    dimensions = allen["dimensions"]
    assert dimensions == [264, 160, 228] and allen["resolutionUm"] == 50
    indices = np.ix_(*(np.floor(np.arange(n) * 50 / 20 + 0.5).astype(int) for n in dimensions))
    labels = annotation[indices].astype("<u4")
    reference = template[indices]
    allen_reference = np.frombuffer(gzip.decompress(
        (ROOT / "public" / allen["template"]["url"].lstrip("/")).read_bytes()
    ), dtype="<u2").reshape(dimensions, order="F")
    correlation = float(np.corrcoef(allen_reference.ravel()[::5], reference.ravel()[::5])[0, 1])
    if correlation < 0.99:
        raise ValueError(f"Reference alignment failed: correlation {correlation}")

    with args.ontology.open(newline="") as stream:
        rows = {int(r["id"]): r for r in csv.DictReader(stream) if r["id"]}
    structures = [{"id": 997, "name": "root", "acronym": "root", "color": "#ffffff", "structureIdPath": [997]}]
    for id_, row in rows.items():
        path, node = [], id_
        while node in rows:
            if node in path:
                raise ValueError(f"Ontology cycle: {id_}")
            path.insert(0, node)
            parent = int(rows[node]["structure_id_path"])
            if parent == node:
                break
            node = parent
        structures.append({"id": id_, "name": row["name"], "acronym": row["acronym"],
                           "color": "#" + "".join(f"{int(row[f'RGB_{i}']):02x}" for i in (1, 2, 3)),
                           "structureIdPath": [997, *path]})
    present = set(map(int, np.unique(labels))) - {0}
    unknown = sorted(present - set(rows))
    # The published v2 volume contains label 728, absent from its ontology.
    # Preserve its ID explicitly instead of borrowing an Allen name for it.
    for id_ in unknown:
        structures.append({"id": id_, "name": f"源数据未提供名称 · ID {id_}",
                           "acronym": f"ID {id_}", "color": "#879fa1", "structureIdPath": [997, id_]})
    output = ROOT / "public/data/kim-v2"
    output.mkdir(exist_ok=True)
    raw = labels.tobytes(order="F")
    compressed = gzip.compress(raw, mtime=0)
    (output / "annotation.uint32.gz").write_bytes(compressed)
    (output / "ontology.json").write_text(json.dumps(structures, ensure_ascii=False, indent=2) + "\n")
    manifest = {
        "schemaVersion": 1, "dataset": "Enhanced and unified mouse brain atlas v2 (2024)",
        "sourceUrl": SOURCE, "citation": "Chon et al. (2019), Nature Communications 10:5067",
        "doi": "10.1038/s41467-019-13057-w", "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "basis": "Franklin–Paxinos 3rd edition with 4th edition updates; not a 5th edition reproduction",
        "space": "allen-ccf-v3", "resolutionUm": 50, "dimensions": dimensions,
        "orientation": "PIR", "axisOrder": ["AP", "DV", "ML"], "storageOrder": "AP-fastest",
        "sourceResolutionUm": 20, "sourceShape": [570, 400, 660],
        "unmappedLabelIds": unknown,
        "sourceOrientation": "RSP origin sides (BrainGlobe)", "orientationSource": ORIENTATION_SOURCE,
        "conversion": "Transpose (2,1,0), reverse AP and ML; nearest neighbor at floor(index*50/20+0.5). No label interpolation.",
        "referenceValidation": {"allenTemplateSha256": allen["template"]["uncompressedSha256"], "pearsonEveryFifthVoxel": correlation},
        "annotation": {"url": "/data/kim-v2/annotation.uint32.gz", "dtype": "uint32", "bytes": len(compressed),
                       "uncompressedBytes": len(raw), "sha256": sha256(compressed),
                       "uncompressedSha256": sha256(raw), "presentStructureCount": len(present)},
        "ontology": {"url": "/data/kim-v2/ontology.json", "structureCount": len(structures), "sha256": digest(output / "ontology.json")},
        "sources": [{"url": f"https://ndownloader.figshare.com/files/{id_}", "sha256": digest(path)}
                    for id_, path in [(46096131, args.annotation), (46096122, args.template), (46096116, args.ontology)]]
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(output), "labels": len(present), "compressedBytes": len(compressed), "referenceCorrelation": correlation}))


if __name__ == "__main__":
    main()
