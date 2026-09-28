#!/usr/bin/env python3
"""Download official Allen CCFv3 2017 data and pack it for the web viewer.

Requires Python 3.10+ and curl; no Python packages are needed.
"""

from __future__ import annotations

import argparse
import array
import concurrent.futures
import datetime
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import tempfile


BASE = "https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf"
ONTOLOGY_URL = "https://api.brain-map.org/api/v2/structure_graph_download/1.json"
ROOT_ID = 997
DEFAULT_REGION_CATALOG = Path(__file__).resolve().parents[1] / "public/data/adult-region-ids.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def download(url: str, destination: Path) -> dict:
    if not destination.exists():
        part = destination.with_suffix(destination.suffix + ".part")
        subprocess.run(
            ["curl", "--fail", "--location", "--silent", "--show-error", "--retry", "2",
             "--connect-timeout", "30", "--max-time", "300", url, "--output", str(part)],
            check=True,
        )
        part.replace(destination)
    data = destination.read_bytes()
    print(f"Source {destination.name}: {len(data):,} bytes", flush=True)
    return {"url": url, "filename": destination.name, "bytes": len(data), "sha256": sha256(data)}


def read_nrrd(path: Path, expected_type: str, resolution: int) -> tuple[bytes, dict]:
    header_bytes, encoded = path.read_bytes().split(b"\n\n", 1)
    header = {}
    for line in header_bytes.decode("ascii").splitlines():
        if ":" in line and not line.startswith("#"):
            key, value = line.split(":", 1)
            header[key] = value.strip()
    assert header["dimension"] == "3"
    assert header["type"] == expected_type
    assert header["endian"] == "little"
    assert header["encoding"] == "gzip"
    assert header["space origin"] == "(0,0,0)"
    sizes = [int(value) for value in header["sizes"].split()]
    assert sizes == [13200 // resolution, 8000 // resolution, 11400 // resolution]
    raw = gzip.decompress(encoded)
    bytes_per_voxel = 2 if expected_type == "unsigned short" else 4
    assert len(raw) == math.prod(sizes) * bytes_per_voxel
    return raw, header


def write_gzip(path: Path, raw: bytes) -> dict:
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(compressed)
    return {
        "url": f"/data/{path.parent.name + '/' if path.parent.name == 'meshes' else ''}{path.name}",
        "compression": "gzip", "bytes": len(compressed), "uncompressedBytes": len(raw),
        "sha256": sha256(compressed), "uncompressedSha256": sha256(raw),
    }


def flatten_ontology(source: Path) -> list[dict]:
    payload = json.loads(source.read_text())
    assert payload["success"]
    result = []

    def visit(node: dict, path: list[int]) -> None:
        ancestors = path + [node["id"]]
        result.append({
            "id": node["id"], "acronym": node["acronym"], "name": node["name"],
            "color": "#" + node["color_hex_triplet"],
            "parentId": node["parent_structure_id"], "structureIdPath": ancestors,
        })
        for child in node.get("children", []):
            visit(child, ancestors)

    for root in payload["msg"]:
        visit(root, [])
    return result


def pack_mesh(source: Path, output: Path) -> dict:
    vertices = array.array("f")
    triangles = array.array("I")
    for line in source.read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            vertices.extend(float(value) for value in fields[1:4])
        elif fields[0] == "f":
            face = [int(value.split("/")[0]) - 1 for value in fields[1:]]
            assert all(value >= 0 for value in face)
            for index in range(1, len(face) - 1):
                triangles.extend([face[0], face[index], face[index + 1]])
    vertex_count = len(vertices) // 3
    triangle_count = len(triangles) // 3
    assert vertex_count and triangle_count
    assert max(triangles) < vertex_count
    bounds = [[min(vertices[axis::3]), max(vertices[axis::3])] for axis in range(3)]
    if sys.byteorder != "little":
        vertices.byteswap()
        triangles.byteswap()
    raw = struct.pack("<II", vertex_count, triangle_count) + vertices.tobytes() + triangles.tobytes()
    details = write_gzip(output, raw)
    details.update({
        "format": "allen-mesh-v1", "vertexCount": vertex_count,
        "triangleCount": triangle_count, "boundsUm": bounds,
    })
    return details


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resolution", type=int, choices=[25, 50, 100], default=50)
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "mouse-brain-allen-source")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public/data")
    parser.add_argument("--regions", type=Path, default=DEFAULT_REGION_CATALOG)
    args = parser.parse_args()
    region_catalog = json.loads(args.regions.read_text())
    region_ids = [item["id"] for item in region_catalog]
    assert region_ids and len(region_ids) == len(set(region_ids))
    assert all(isinstance(identifier, int) and identifier > 0 for identifier in region_ids)
    args.cache.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    jobs = [
        (f"{BASE}/average_template/average_template_{args.resolution}.nrrd", args.cache / f"average_template_{args.resolution}.nrrd"),
        (f"{BASE}/annotation/ccf_2017/annotation_{args.resolution}.nrrd", args.cache / f"annotation_{args.resolution}.nrrd"),
        (ONTOLOGY_URL, args.cache / "structure_graph_1.json"),
    ]
    jobs += [
        (f"{BASE}/annotation/ccf_2017/structure_meshes/{identifier}.obj", args.cache / f"{identifier}.obj")
        for identifier in [ROOT_ID] + region_ids
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        sources = list(executor.map(lambda job: download(*job), jobs))

    template_raw, template_header = read_nrrd(jobs[0][1], "unsigned short", args.resolution)
    annotation_raw, annotation_header = read_nrrd(jobs[1][1], "unsigned int", args.resolution)
    dims = [int(value) for value in template_header["sizes"].split()]
    assert template_header["sizes"] == annotation_header["sizes"]
    template = array.array("H", template_raw)
    annotation = array.array("I", annotation_raw)
    if sys.byteorder != "little":
        template.byteswap()
        annotation.byteswap()
    ontology = flatten_ontology(jobs[2][1])
    by_id = {item["id"]: item for item in ontology}
    for item in region_catalog:
        assert item["id"] in by_id, f"Unknown Allen structure: {item}"
        assert by_id[item["id"]]["acronym"] == item["acronym"], f"Structure ID/acronym mismatch: {item}"
    unknown = set(annotation) - set(by_id) - {0}
    assert not unknown, f"Unrecognized annotation IDs: {unknown}"
    save_json(args.output / "ontology.json", ontology)
    template_asset = write_gzip(args.output / "template.uint16.gz", template_raw)
    annotation_asset = write_gzip(args.output / "annotation.uint32.gz", annotation_raw)
    template_asset.update({"dtype": "uint16", "range": [min(template), max(template)], "displayWindow": [0, 350]})
    annotation_asset.update({"dtype": "uint32", "backgroundId": 0, "presentStructureCount": len(set(annotation) - {0})})

    # Aggregate through the ontology so parent regions include all of their layers/subregions.
    voxel_groups = {identifier: [] for identifier in region_ids}
    region_membership = {
        item["id"]: [identifier for identifier in region_ids if identifier in item["structureIdPath"]]
        for item in ontology
    }
    for index, identifier in enumerate(annotation):
        for parent in region_membership.get(identifier, []):
            ap = index % dims[0]
            dv = index // dims[0] % dims[1]
            ml = index // (dims[0] * dims[1])
            voxel_groups[parent].append((ap, dv, ml))

    meshes = {}
    for identifier in [ROOT_ID] + region_ids:
        meshes[identifier] = pack_mesh(args.cache / f"{identifier}.obj", args.output / "meshes" / f"{identifier}.bin.gz")
        print(f"Mesh {identifier}: {meshes[identifier]['vertexCount']:,} vertices, {meshes[identifier]['bytes']:,} compressed bytes", flush=True)

    regions = []
    for identifier in region_ids:
        voxels = voxel_groups[identifier]
        assert voxels, f"Region {identifier} has no labeled voxels"
        centroid = [sum(point[axis] for point in voxels) / len(voxels) for axis in range(3)]
        left = [point for point in voxels if point[2] < dims[2] / 2]
        focus_pool = left or voxels
        focus_center = [sum(point[axis] for point in focus_pool) / len(focus_pool) for axis in range(3)]
        # A bilateral centroid can fall outside the region; choose an actual labeled voxel.
        focus = min(focus_pool, key=lambda point: sum((point[axis] - focus_center[axis]) ** 2 for axis in range(3)))
        regions.append({
            **by_id[identifier], "mesh": meshes[identifier],
            "descendantIds": [item["id"] for item in ontology if identifier in item["structureIdPath"]],
            "voxelCount": len(voxels), "volumeMm3": len(voxels) * (args.resolution / 1000) ** 3,
            "centroidVoxel": [round(value, 3) for value in centroid],
            "centroidUm": [round(value * args.resolution, 3) for value in centroid],
            "focusVoxel": list(focus), "focusUm": [value * args.resolution for value in focus],
            "boundsVoxel": [[min(point[axis] for point in voxels), max(point[axis] for point in voxels)] for axis in range(3)],
            "alignment": {
                "meshAnnotationExtentMaxDifferenceUm": round(max(
                    abs(meshes[identifier]["boundsUm"][axis][side] -
                        (min(point[axis] for point in voxels) if side == 0 else max(point[axis] for point in voxels)) * args.resolution)
                    for axis in range(3) for side in range(2)
                ), 3),
                "note": "The official smoothed mesh is not an exact isosurface of the coarser annotation. Extent differences are reported, not corrected by moving or stretching the mesh.",
            },
        })

    manifest = {
        "schemaVersion": 1,
        "dataset": "Allen Mouse Brain Common Coordinate Framework v3",
        "annotationVersion": "ccf_2017",
        "preparedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "resolutionUm": args.resolution, "dimensions": dims,
        "spacingUm": [args.resolution] * 3, "originUm": [0, 0, 0],
        "axisOrder": ["AP", "DV", "ML"], "orientation": "PIR",
        "positiveDirections": ["posterior", "inferior", "right"],
        "endian": "little", "storageOrder": "AP-fastest",
        "voxelIndexFormula": "ap + dimensions[0] * (dv + dimensions[1] * ml)",
        "coordinateNote": "Coordinates are Allen CCF origin coordinates, not bregma stereotaxic coordinates. Voxel sample position in micrometers equals its index times spacing.",
        "nrrdHeaderNote": "Original NRRDs label their space left-posterior-superior; the Allen API documentation explicitly defines anatomical array axes as AP,SI,LR in PIR orientation. This viewer uses that anatomical convention without transposing the original raster.",
        "template": template_asset, "annotation": annotation_asset,
        "ontology": {"url": "/data/ontology.json", "structureCount": len(ontology), "sourceUrl": ONTOLOGY_URL},
        "rootMesh": meshes[ROOT_ID], "regions": regions,
        "regionCatalog": {"url": "/data/adult-region-ids.json", "regionCount": len(regions)},
        "meshFormat": {
            "name": "allen-mesh-v1", "endian": "little", "compression": "gzip",
            "header": "uint32 vertexCount, uint32 triangleCount",
            "vertices": "vertexCount * 3 float32 at byte 8, coordinates in micrometers, AP/DV/ML order",
            "triangles": "triangleCount * 3 uint32 at byte 8 + vertexCount * 12, zero-based vertex indices",
            "processing": "Official Allen CCFv3 2017 OBJ vertices and triangle indices, packed without spatial resampling or mesh simplification; original vertex normals omitted and recomputed by the renderer.",
        },
        "provenance": {
            "provider": "Allen Institute for Brain Science",
            "templateDescription": "Shape and background fluorescence intensity average of 1,675 serial two-photon tomography mouse brains. This is a registered reference volume, not an individual specimen or MRI.",
            "processing": "Lossless repack of official NRRD payloads. No resampling, relabeling, generated anatomy, or intensity scaling.",
            "sources": sources,
            "originalHeaders": {"template": template_header, "annotation": annotation_header},
            "reference": {"title": "The Allen Mouse Brain Common Coordinate Framework: A 3D Reference Atlas", "authors": "Wang et al.", "year": 2020, "doi": "10.1016/j.cell.2020.04.007", "url": "https://doi.org/10.1016/j.cell.2020.04.007"},
            "orientationDocumentation": "https://community.brain-map.org/t/api-allen-brain-connectivity/2988",
            "termsUrl": "https://alleninstitute.org/legal/terms-of-use",
            "citationPolicyUrl": "https://alleninstitute.org/citation-policy/",
            "usage": "Allen Institute Terms of Use apply. Research and other noncommercial uses are permitted with attribution. Commercial use requires the Institute's written permission.",
        },
    }
    save_json(args.output / "manifest.json", manifest)
    save_json(args.output / "adult-region-ids.json", region_catalog)
    print(f"Prepared {math.prod(dims):,} voxels and {len(meshes)} meshes in {args.output}")


if __name__ == "__main__":
    main()
