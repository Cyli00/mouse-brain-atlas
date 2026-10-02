#!/usr/bin/env python3
"""Check packed atlas integrity, region jump points, and mesh/volume coordinates."""

import argparse
import array
from collections import Counter
import gzip
import json
import math
from pathlib import Path
import struct
import sys

from data_assets import sha256


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path(__file__).resolve().parents[1] / "public/data")
    parser.add_argument("--source-cache", type=Path,
                        help="Compare cached official OBJ files with their provenance hashes and packed payloads")
    args = parser.parse_args()
    manifest = json.loads((args.data / "manifest.json").read_text())
    ontology = json.loads((args.data / "ontology.json").read_text())
    catalog = json.loads((args.data / "adult-region-ids.json").read_text())
    assert [item["id"] for item in catalog] == [item["id"] for item in manifest["regions"]]
    by_id = {item["id"]: item for item in ontology}
    dimensions = manifest["dimensions"]
    spacing = manifest["spacingUm"]
    voxel_count = math.prod(dimensions)

    def unpack(asset: dict) -> bytes:
        packed = (args.data / asset["url"].removeprefix("/data/")).read_bytes()
        assert len(packed) == asset["bytes"]
        assert sha256(packed) == asset["sha256"]
        raw = gzip.decompress(packed)
        assert len(raw) == asset["uncompressedBytes"]
        assert sha256(raw) == asset["uncompressedSha256"]
        return raw

    template_raw = unpack(manifest["template"])
    annotation_raw = unpack(manifest["annotation"])
    assert len(template_raw) == voxel_count * 2
    assert len(annotation_raw) == voxel_count * 4
    template = array.array("H", template_raw)
    annotation = array.array("I", annotation_raw)
    if sys.byteorder != "little":
        template.byteswap()
        annotation.byteswap()
    assert [min(template), max(template)] == manifest["template"]["range"]
    assert not (set(annotation) - set(by_id) - {0})
    print(f"Verified template and annotation: {voxel_count:,} voxels, {dimensions}, {spacing[0]} µm")

    region_ids = {region["id"] for region in manifest["regions"]}
    for item in catalog:
        assert all(item[key] == by_id[item["id"]][key] for key in ["id", "acronym", "name"])
    label_counts = Counter(annotation)
    for report in manifest["corticalCoverage"]:
        root_id = report["rootId"]
        selected = {identifier for identifier in region_ids if root_id in by_id[identifier]["structureIdPath"]}
        assert selected == set(report["regionIds"])
        counts = {label: count for label, count in label_counts.items()
                  if label and root_id in by_id[label]["structureIdPath"]}
        covered = 0
        missing = []
        for label, count in sorted(counts.items()):
            parents = selected.intersection(by_id[label]["structureIdPath"])
            assert len(parents) <= 1, f"Cortical overlap at label {label}: {parents}"
            if parents:
                covered += count
            else:
                missing.append({"id": label, "acronym": by_id[label]["acronym"],
                                "name": by_id[label]["name"], "voxelCount": count})
        assert report["annotationVoxelCount"] == sum(counts.values())
        assert report["coveredVoxelCount"] == covered
        assert report["coverageFraction"] == covered / sum(counts.values())
        assert report["overlapVoxelCount"] == 0
        assert report["uncoveredLabels"] == missing
        if root_id == 315:
            assert not missing
        else:
            assert {item["id"] for item in missing} == {698, 1089}
        print(f"Verified {report['acronym']} coverage: {covered:,}/{sum(counts.values()):,} voxels, no overlaps")
    membership = {
        item["id"]: region_ids.intersection(item["structureIdPath"])
        for item in ontology
    }
    measured = {
        identifier: {"count": 0, "bounds": [[math.inf, -math.inf] for _ in range(3)]}
        for identifier in region_ids
    }
    for index, label in enumerate(annotation):
        parents = membership.get(label, ())
        if not parents:
            continue
        point = [index % dimensions[0], index // dimensions[0] % dimensions[1], index // (dimensions[0] * dimensions[1])]
        for identifier in parents:
            stats = measured[identifier]
            stats["count"] += 1
            for axis in range(3):
                stats["bounds"][axis][0] = min(stats["bounds"][axis][0], point[axis])
                stats["bounds"][axis][1] = max(stats["bounds"][axis][1], point[axis])

    for region in manifest["regions"]:
        ap, dv, ml = region["focusVoxel"]
        assert all(0 <= value < dimensions[axis] for axis, value in enumerate([ap, dv, ml]))
        index = ap + dimensions[0] * (dv + dimensions[1] * ml)
        label = annotation[index]
        assert region["id"] in by_id[label]["structureIdPath"], f"Invalid focus for {region['acronym']}"
        assert set(region["descendantIds"]) == {
            item["id"] for item in ontology if region["id"] in item["structureIdPath"]
        }
        stats = measured[region["id"]]
        assert stats["count"] == region["voxelCount"]
        assert stats["bounds"] == region["boundsVoxel"]
        difference_um = max(
            abs(region["mesh"]["boundsUm"][axis][side] - stats["bounds"][axis][side] * spacing[axis])
            for axis in range(3) for side in range(2)
        )
        assert round(difference_um, 3) == region["alignment"]["meshAnnotationExtentMaxDifferenceUm"]
    print(f"Verified {len(manifest['regions'])} region jump points against original annotation labels")
    print("Verified all region counts and bounds, including overlapping ontology ancestors")

    meshes = [manifest["rootMesh"]] + [region["mesh"] for region in manifest["regions"]]
    for mesh in meshes:
        raw = unpack(mesh)
        vertices, triangles = struct.unpack_from("<II", raw)
        assert vertices == mesh["vertexCount"]
        assert triangles == mesh["triangleCount"]
        assert len(raw) == 8 + vertices * 12 + triangles * 12
        coordinates = array.array("f", raw[8:8 + vertices * 12])
        indices = array.array("I", raw[8 + vertices * 12:])
        if sys.byteorder != "little":
            coordinates.byteswap()
            indices.byteswap()
        assert all(math.isfinite(value) for value in coordinates)
        assert max(indices) < vertices
        for axis in range(3):
            values = coordinates[axis::3]
            assert [min(values), max(values)] == mesh["boundsUm"][axis]
            assert min(values) >= -spacing[axis]
            assert max(values) <= dimensions[axis] * spacing[axis] + spacing[axis]
    print(f"Verified {len(meshes)} meshes: valid triangle indices, finite coordinates, Allen volume bounds")
    if args.source_cache:
        source_by_name = {source["filename"]: source for source in manifest["provenance"]["sources"]}
        compared = 0
        for mesh in meshes:
            filename = Path(mesh["url"]).name.removesuffix(".bin.gz") + ".obj"
            source_path = args.source_cache / filename
            if not source_path.exists():
                continue
            source = source_by_name[filename]
            data = source_path.read_bytes()
            assert len(data) == source["bytes"]
            assert sha256(data) == source["sha256"]
            coordinates, indices = [], []
            for line in data.decode().splitlines():
                fields = line.split()
                if fields and fields[0] == "v":
                    coordinates.extend(float(value) for value in fields[1:4])
                elif fields and fields[0] == "f":
                    face = [int(value.split("/")[0]) - 1 for value in fields[1:]]
                    for index in range(1, len(face) - 1):
                        indices.extend([face[0], face[index], face[index + 1]])
            raw = (struct.pack("<II", len(coordinates) // 3, len(indices) // 3)
                   + struct.pack(f"<{len(coordinates)}f", *coordinates)
                   + struct.pack(f"<{len(indices)}I", *indices))
            assert raw == unpack(mesh), f"OBJ vertex or triangle mismatch: {filename}"
            compared += 1
        assert compared, "No cached official OBJ files found"
        print(f"Verified {compared} packed mesh payloads against official OBJ vertices and triangles")
    differences = sorted(manifest["regions"], key=lambda region: region["alignment"]["meshAnnotationExtentMaxDifferenceUm"], reverse=True)
    print("Largest mesh/annotation extent differences: " + ", ".join(
        f"{region['acronym']} {region['alignment']['meshAnnotationExtentMaxDifferenceUm']} µm"
        for region in differences[:5]
    ))


if __name__ == "__main__":
    main()
