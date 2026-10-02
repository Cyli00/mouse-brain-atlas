#!/usr/bin/env python3
"""Prepare real Allen Developing Mouse Brain Atlas volumes for the web viewer.

Requires Python 3.10+, numpy, scipy, scikit-image and curl. The original archives
stay in the system temporary directory. No adult anatomy or mirroring is used.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import gzip
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

import numpy as np
from scipy.ndimage import map_coordinates
from skimage.measure import marching_cubes

from data_assets import mesh_bytes, sha256 as digest, write_gzip

BASE = "https://download.alleninstitute.org/informatics-archive/current-release/mouse_annotation"
ONTOLOGY_URL = "https://api.brain-map.org/api/v2/structure_graph_download/17.json"
DOCS = "https://brain-map.org/support/documentation/allen-developing-mouse-brain-reference-atlas"
STAGES = {"E11.5": ("E11pt5", 1), "E13.5": ("E13pt5", 2), "E15.5": ("E15pt5", 3), "E18.5": ("E18pt5", 5)}
REGION_IDS = [15739, 15569, 15622, 16211, 16309, 16375, 16509, 16650, 16751, 16809, 17092, 17220, 17352]
TISSUE_ROOTS = [15566, 16649, 16808]
VENTRICLE_ROOTS = [126651562, 126651722, 126651782]
BRAIN_ROOTS = TISSUE_ROOTS + VENTRICLE_ROOTS
ROOT_ID = 15565
HEMISPHERE = "Predominantly unilateral, incomplete source annotation; not mirrored"
LIMITATIONS = "Single-specimen, stage-specific reconstruction. Annotation derives from spaced sagittal atlas drawings interpolated by Allen. Native reconstruction spacing and display sampling do not imply equally fine anatomical boundary accuracy. Source labels mainly cover the left side, with missing lateral and contralateral regions and some midline skew; this is not a complete hemisphere. No missing labels are inferred, mirrored or smoothed. No cross-stage pointwise registration or stereotaxic use."


def save_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def download(url: str, target: Path) -> dict:
    if not target.exists():
        partial = target.with_suffix(target.suffix + ".part")
        subprocess.run(["curl", "-fLsS", "--retry", "2", "--max-time", "900", url, "-o", str(partial)], check=True)
        partial.replace(target)
    raw = target.read_bytes()
    return {"url": url, "filename": target.name, "bytes": len(raw), "sha256": digest(raw)}


def flatten_ontology(path: Path) -> list[dict]:
    source = json.loads(path.read_text())
    assert source["success"]
    result = []

    def visit(node: dict, ancestors: list[int]) -> None:
        ids = ancestors + [node["id"]]
        result.append({"id": node["id"], "acronym": node["acronym"], "name": node["name"],
                       "color": "#" + node["color_hex_triplet"], "parentId": node["parent_structure_id"],
                       "structureIdPath": ids})
        for child in node.get("children", []):
            visit(child, ids)

    for root in source["msg"]:
        visit(root, [])
    return result


def read_volume(path: Path) -> tuple[np.ndarray, dict]:
    with zipfile.ZipFile(path) as archive:
        name = next(name for name in archive.namelist() if name.endswith(".mhd"))
        header = dict(line.split(" = ", 1) for line in archive.read(name).decode().strip().splitlines())
        assert header["NDims"] == "3" and header["BinaryDataByteOrderMSB"] == "False"
        assert header["CompressedData"] == "False" and header["TransformMatrix"] == "1 0 0 0 1 0 0 0 1"
        dtype = {"MET_UINT": "<u4", "MET_UCHAR": "u1"}[header["ElementType"]]
        dims = list(map(int, header["DimSize"].split()))
        raw = archive.read(str(Path(name).parent / header["ElementDataFile"]))
        array = np.frombuffer(raw, dtype=dtype).reshape(dims[::-1])
        return array, header


def pack_gzip(path: Path, raw: bytes, output_root: Path) -> dict:
    if path.exists() and gzip.decompress(path.read_bytes()) == raw:
        compressed = path.read_bytes()
        info = {"bytes": len(compressed), "uncompressedBytes": len(raw),
                "sha256": digest(compressed), "uncompressedSha256": digest(raw)}
    else:
        info = write_gzip(path, raw)
    return {"url": "/embryo/" + path.relative_to(output_root).as_posix(), "compression": "gzip", **info}


def pack_surface(mask: np.ndarray, path: Path, spacing: int, output_root: Path) -> dict:
    # Padding closes surfaces at the sampled extent without inventing a hemisphere.
    vertices, faces, _, _ = marching_cubes(
        np.pad(mask.astype(np.uint8), 1), 0.5,
        gradient_direction="ascent", allow_degenerate=False,
    )
    vertices = np.ascontiguousarray((vertices[:, ::-1] - 1) * spacing, dtype="<f4")
    faces = np.ascontiguousarray(faces[:, ::-1], dtype="<u4")
    raw = mesh_bytes(len(vertices), len(faces), vertices.tobytes(), faces.tobytes())
    info = pack_gzip(path, raw, output_root)
    info.update({"format": "allen-mesh-v1", "vertexCount": len(vertices), "triangleCount": len(faces),
                 "boundsUm": [[float(vertices[:, i].min()), float(vertices[:, i].max())] for i in range(3)]})
    return info


def prepare_surfaces(annotation: np.ndarray, ontology: list[dict], stage_dir: Path,
                     resolution: int, output_root: Path,
                     expected_bounds: list[list[float]] | None = None) -> tuple[dict, list[dict], dict]:
    by_id = {item["id"]: item for item in ontology}
    tissue_ids = [item["id"] for item in ontology
                  if any(root in item["structureIdPath"] for root in TISSUE_ROOTS)]
    tissue_mask = np.isin(annotation, tissue_ids)
    if expected_bounds is not None:
        tissue_points = np.array(np.where(tissue_mask))[::-1]
        bounds = [[float((axis.min() - 0.5) * resolution), float((axis.max() + 0.5) * resolution)] for axis in tissue_points]
        if bounds != expected_bounds:
            raise ValueError("Tissue surface would change the established coordinate origins")
    root_mesh = pack_surface(tissue_mask, stage_dir / "meshes/root.bin.gz", resolution, output_root)
    regions = []
    represented = np.zeros(annotation.shape, dtype=np.uint8)
    for identifier in REGION_IDS + VENTRICLE_ROOTS:
        descendants = [item["id"] for item in ontology if identifier in item["structureIdPath"]]
        mask = np.isin(annotation, descendants)
        points = np.transpose(np.where(mask))[:, ::-1]
        if not len(points):
            continue
        represented += mask
        center = points.mean(axis=0)
        focus = points[np.argmin(np.sum((points - center) ** 2, axis=1))].tolist()
        regions.append({**by_id[identifier], "descendantIds": descendants,
                        "anatomyKind": "ventricular-space" if identifier in VENTRICLE_ROOTS else "brain-tissue",
                        "mesh": pack_surface(mask, stage_dir / f"meshes/{identifier}.bin.gz", resolution, output_root),
                        "voxelCount": len(points), "volumeMm3": len(points) * (resolution / 1000) ** 3,
                        "centroidVoxel": center.round(3).tolist(), "focusVoxel": focus,
                        "boundsVoxel": [[int(points[:, i].min()), int(points[:, i].max())] for i in range(3)]})
    if not np.array_equal(represented, (annotation > 0).astype(np.uint8)):
        raise ValueError("Region meshes must cover every retained label exactly once")
    coverage = {"brainTissueRoots": TISSUE_ROOTS, "ventricularRoots": VENTRICLE_ROOTS,
                "retainedVoxelCount": int(np.count_nonzero(annotation)),
                "brainTissueVoxelCount": int(np.count_nonzero(tissue_mask)),
                "ventricularVoxelCount": int(np.count_nonzero(annotation)) - int(np.count_nonzero(tissue_mask)),
                "rootMeshMeaning": "Brain tissue only; ventricular spaces are separate region meshes when labels are present."}
    return root_mesh, regions, coverage


def rebuild_surfaces(stage: str, args: argparse.Namespace, ontology: list[dict]) -> dict:
    stage_dir = args.output / stage
    manifest = json.loads((stage_dir / "manifest.json").read_text())
    packed = (stage_dir / "annotation.uint32.gz").read_bytes()
    if digest(packed) != manifest["annotation"]["sha256"]:
        raise ValueError(f"{stage}: packaged annotation hash mismatch")
    annotation = np.frombuffer(gzip.decompress(packed), dtype="<u4").reshape(manifest["dimensions"][::-1])
    root_mesh, regions, coverage = prepare_surfaces(annotation, ontology, stage_dir, manifest["resolutionUm"], args.output,
                                                    expected_bounds=manifest["rootMesh"]["boundsUm"])
    manifest.update({"rootMesh": root_mesh, "regions": regions, "meshCoverage": coverage, "hemisphere": HEMISPHERE})
    manifest["provenance"].update({"limitations": LIMITATIONS,
                                    "annotationLimitationsReferenceUrl": "https://elifesciences.org/articles/61408"})
    save_json(stage_dir / "manifest.json", manifest)
    print(f"{stage}: {len(regions)} source-derived meshes; {coverage['brainTissueVoxelCount']} tissue and {coverage['ventricularVoxelCount']} ventricular voxels", flush=True)
    return {"stage": stage, "manifest": "/embryo/" + stage + "/manifest.json", "dimensions": manifest["dimensions"],
            "resolutionUm": manifest["resolutionUm"], "regionIds": [region["id"] for region in regions]}


def prepare_stage(stage: str, args: argparse.Namespace, ontology: list[dict], sources: dict) -> dict:
    prefix, reference_space = STAGES[stage]
    native_annotation, annotation_header = read_volume(args.cache / f"{prefix}_DevMouse2012_annotation.zip")
    native_template, template_header = read_volume(args.cache / f"{prefix}_atlasVolume.zip")
    assert annotation_header["DimSize"] == template_header["DimSize"]
    assert annotation_header["ElementSpacing"] == template_header["ElementSpacing"] == "16 16 20"
    by_id = {item["id"]: item for item in ontology}
    assert not set(np.unique(native_annotation)) - set(by_id) - {0}
    retained_ids = [item["id"] for item in ontology if any(root in item["structureIdPath"] for root in BRAIN_ROOTS)]
    native_mask = np.isin(native_annotation, retained_ids)
    coordinates = np.array(np.where(native_mask))
    # Keep a 2-voxel presentation margin around the actual annotated brain.
    native_spacing = np.array([20, 16, 16], dtype=float)
    start = np.maximum(0, coordinates.min(axis=1) - np.ceil(2 * args.resolution / native_spacing).astype(int))
    stop = np.minimum(np.array(native_annotation.shape) - 1, coordinates.max(axis=1) + np.ceil(2 * args.resolution / native_spacing).astype(int))
    shape = np.floor((stop - start) * native_spacing / args.resolution).astype(int) + 1
    grid = np.indices(shape, dtype=np.float32)
    for axis in range(3):
        grid[axis] = start[axis] + grid[axis] * (args.resolution / native_spacing[axis])
    annotation = map_coordinates(native_annotation, grid, order=0, prefilter=False)
    annotation[~np.isin(annotation, retained_ids)] = 0
    template = map_coordinates(native_template, grid, order=1, prefilter=False).astype("<u2")
    template[annotation == 0] = 0
    annotation = annotation.astype("<u4")
    dims = list(map(int, shape[::-1]))
    stage_dir = args.output / stage
    template_info = pack_gzip(stage_dir / "template.uint16.gz", template.tobytes(), args.output)
    template_info.update({"dtype": "uint16", "range": [int(template.min()), int(template.max())], "displayWindow": [0, 230]})
    annotation_info = pack_gzip(stage_dir / "annotation.uint32.gz", annotation.tobytes(), args.output)
    annotation_info.update({"dtype": "uint32", "backgroundId": 0, "presentStructureCount": len(np.unique(annotation)) - 1})
    root_mesh, regions, coverage = prepare_surfaces(annotation, ontology, stage_dir, args.resolution, args.output)
    native_origin = np.array(list(map(float, annotation_header["Offset"].split())))
    origin_um = (start[::-1] * native_spacing[::-1] + native_origin).tolist()
    manifest = {
        "schemaVersion": 1, "atlas": "Allen Developing Mouse Brain Atlas, DevMouse2012", "stage": stage,
        "referenceSpaceId": reference_space, "rootId": ROOT_ID, "dimensions": dims, "resolutionUm": args.resolution,
        "axisOrder": ["AP", "DV", "ML"], "orientation": "PIR", "voxelOrder": "AP-fastest",
        "hemisphere": HEMISPHERE,
        "coordinateSpace": "Stage-specific cropped reference, not adult CCF or Bregma",
        "cropOffsetNativeVoxel": start[::-1].tolist(), "originUmInNativeReference": origin_um,
        "template": template_info, "annotation": annotation_info,
        "ontology": {"url": "/embryo/ontology.json", "structureCount": len(ontology), "graphId": 17},
        "rootMesh": root_mesh, "regions": regions, "meshCoverage": coverage,
        "meshFormat": {"name": "allen-mesh-v1", "endian": "little", "compression": "gzip",
                       "header": "uint32 vertexCount, uint32 triangleCount",
                       "vertices": "float32 AP,DV,ML in cropped-local micrometers",
                       "triangles": "uint32 zero-based indices",
                       "processing": "Marching cubes at 0.5 on the resampled label mask; no smoothing, mirroring or mesh interpolation across stages."},
        "provenance": {
            "provider": "Allen Institute for Brain Science", "retrieved": str(datetime.date.today()),
            "sources": [sources[f"{prefix}_atlasVolume.zip"], sources[f"{prefix}_DevMouse2012_annotation.zip"], sources["structure_graph_17.json"]],
            "nativeDimensions": list(map(int, annotation_header["DimSize"].split())), "nativeSpacingUm": [16, 16, 20],
            "originalHeaders": {"template": template_header, "annotation": annotation_header},
            "processing": f"Crop official brain and brain-ventricle labels; omit spinal cord/body/tract-only labels. Resample grayscale with trilinear interpolation and labels with nearest neighbour onto a {args.resolution} micrometer isotropic grid. Preserve grayscale polarity and the native 0-255 intensity scale, promote uint8 to uint16 and set voxels outside retained labels to zero. No synthetic or mirrored tissue.",
            "brainMaskRoots": BRAIN_ROOTS,
            "orientationNote": "Allen documentation explicitly defines these raw reference volumes as PIR, +x posterior, +y inferior, +z right. We preserve raw axis order. Original MetaImage headers contain AnatomicalOrientation=RAI and identity TransformMatrix; that header token is retained for audit rather than used to override the documented raw array convention.",
            "limitations": LIMITATIONS,
            "annotationLimitationsReferenceUrl": "https://elifesciences.org/articles/61408",
            "documentationUrl": DOCS, "termsUrl": "https://alleninstitute.org/legal/terms-of-use",
            "citationPolicyUrl": "https://alleninstitute.org/citation-policy/",
            "reference": {"authors": "Thompson CL, Ng L, Menon V, et al.", "year": 2014,
                          "title": "A high-resolution spatiotemporal atlas of gene expression of the developing mouse brain",
                          "url": "https://doi.org/10.1016/j.neuron.2014.05.033"},
        },
    }
    save_json(stage_dir / "manifest.json", manifest)
    print(f"{stage}: {dims}, {len(regions)} region meshes, {annotation_info['presentStructureCount']} finest labels", flush=True)
    return {"stage": stage, "manifest": "/embryo/" + stage + "/manifest.json", "dimensions": dims,
            "resolutionUm": args.resolution, "regionIds": [region["id"] for region in regions]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "mice-embryo-source")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public/embryo")
    parser.add_argument("--resolution", type=int, default=40, choices=[40, 80])
    parser.add_argument("--stages", nargs="+", choices=STAGES, default=list(STAGES))
    parser.add_argument("--meshes-only", action="store_true", help="Rebuild surfaces from hash-verified packaged annotation; preserve volumes and coordinates")
    args = parser.parse_args()
    if args.meshes_only:
        ontology = json.loads((args.output / "ontology.json").read_text())
        updates = {stage: rebuild_surfaces(stage, args, ontology) for stage in args.stages}
        index = json.loads((args.output / "index.json").read_text())
        index["stages"] = [updates.get(stage["stage"], stage) for stage in index["stages"]]
        save_json(args.output / "index.json", index)
        return
    args.cache.mkdir(parents=True, exist_ok=True)
    jobs = [(ONTOLOGY_URL, args.cache / "structure_graph_17.json")]
    for stage in args.stages:
        prefix = STAGES[stage][0]
        jobs.extend((f"{BASE}/{prefix}_{kind}.zip", args.cache / f"{prefix}_{kind}.zip")
                    for kind in ["atlasVolume", "DevMouse2012_annotation"])
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        sources = {source["filename"]: source for source in executor.map(lambda job: download(*job), jobs)}
    ontology = flatten_ontology(args.cache / "structure_graph_17.json")
    save_json(args.output / "ontology.json", ontology)
    stages = [prepare_stage(stage, args, ontology, sources) for stage in args.stages]
    save_json(args.output / "index.json", {"stages": stages})


if __name__ == "__main__":
    main()
