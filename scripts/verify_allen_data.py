#!/usr/bin/env python3
"""Check packed atlas integrity, region jump points, and mesh/volume coordinates."""

import argparse
import array
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path(__file__).resolve().parents[1] / "public/data")
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
        assert hashlib.sha256(packed).hexdigest() == asset["sha256"]
        raw = gzip.decompress(packed)
        assert len(raw) == asset["uncompressedBytes"]
        assert hashlib.sha256(raw).hexdigest() == asset["uncompressedSha256"]
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
    differences = sorted(manifest["regions"], key=lambda region: region["alignment"]["meshAnnotationExtentMaxDifferenceUm"], reverse=True)
    print("Largest mesh/annotation extent differences: " + ", ".join(
        f"{region['acronym']} {region['alignment']['meshAnnotationExtentMaxDifferenceUm']} µm"
        for region in differences[:5]
    ))


if __name__ == "__main__":
    main()
