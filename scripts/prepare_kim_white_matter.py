#!/usr/bin/env python3
"""Rebuild true 3D meshes for every white-matter label present in the Kim v2 (PF) volume.

Classification follows the shared frontend helper src/lib/white-matter.ts:
a structure is white matter when its structureIdPath contains the fiber-tracts
root 1009, or it is one of the explicit superior colliculus white-layer
exceptions (17 InWh, 42 DpWh) that the Kim ontology files under SC motor
related (294) instead of fiber tracts. Name matching is never used, so nuclei
named after tracts (e.g. 619 "Nucleus of the lateral olfactory tract") stay
gray matter.

Each label present in the annotation gets its own mesh from the exact label
mask via marching cubes at level 0.5 with 50 µm spacing. There is no
smoothing, no simplification and no connected-component filtering, so small
labels and disjoint components are preserved. Meshes use the existing
allen-mesh-v1 binary layout (see public/data/manifest.json meshFormat).

Run with an environment providing numpy and scikit-image, e.g.:
    uv run --with numpy --with scikit-image python scripts/prepare_kim_white_matter.py
"""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import numpy as np
from skimage import measure

from data_assets import mesh_bytes, sha256, write_gzip

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data/kim-v2"
FIBER_TRACTS_ROOT_ID = 1009
# White matter filed outside the fiber-tracts subtree by the Kim ontology:
# 17 InWh / 42 DpWh / 851 Op are SC white layers (under 294 SCm / 302 SCs);
# 2219 SMV (superior medullary velum) is filed under the ventricular branch.
WHITE_MATTER_EXCEPTION_IDS = (17, 42, 851, 2219)
EXCEPTION_RULES = {
    17: "superior-colliculus-white-layer-exception",
    42: "superior-colliculus-white-layer-exception",
    851: "superior-colliculus-white-layer-exception",
    2219: "superior-medullary-velum-exception",
}
MESH_FORMAT = "allen-mesh-v1"


def load_inputs() -> tuple[np.ndarray, list[dict], dict]:
    manifest = json.loads((DATA / "manifest.json").read_text())
    assert manifest["dimensions"] == [264, 160, 228]
    assert manifest["resolutionUm"] == 50
    assert manifest["storageOrder"] == "AP-fastest"
    compressed = (DATA / "annotation.uint32.gz").read_bytes()
    assert sha256(compressed) == manifest["annotation"]["sha256"], "annotation checksum mismatch"
    raw = gzip.decompress(compressed)
    assert sha256(raw) == manifest["annotation"]["uncompressedSha256"]
    volume = np.frombuffer(raw, dtype="<u4").reshape(manifest["dimensions"], order="F")
    ontology_bytes = (DATA / "ontology.json").read_bytes()
    assert sha256(ontology_bytes) == manifest["ontology"]["sha256"], "ontology checksum mismatch"
    ontology = json.loads(ontology_bytes)
    return volume, ontology, manifest


def classify(ontology: list[dict]) -> dict[int, str]:
    """Map white-matter structure id -> classification rule, mirroring src/lib/white-matter.ts."""
    result = {}
    for structure in ontology:
        if structure["id"] == 2461:
            continue
        path = structure["structureIdPath"]
        if FIBER_TRACTS_ROOT_ID in path:
            result[structure["id"]] = "fiber-tracts-subtree"
        elif structure["id"] in WHITE_MATTER_EXCEPTION_IDS:
            result[structure["id"]] = EXCEPTION_RULES[structure["id"]]
    return result


def build_mesh(mask: np.ndarray, spacing: float) -> tuple[np.ndarray, np.ndarray]:
    """Marching cubes on the exact padded label mask; all components kept, no decimation."""
    padded = np.pad(mask.astype(np.float32), 1)
    vertices, faces, _, _ = measure.marching_cubes(padded, level=0.5, spacing=(spacing,) * 3)
    vertices -= spacing  # undo the one-voxel pad so coordinates stay in volume micrometers
    return vertices.astype("<f4"), faces.astype("<u4")


def pack_mesh(vertices: np.ndarray, faces: np.ndarray) -> bytes:
    assert len(vertices) and len(faces)
    assert faces.max() < len(vertices)
    return mesh_bytes(len(vertices), len(faces), vertices.tobytes(), faces.tobytes())


def main() -> None:
    volume, ontology, manifest = load_inputs()
    spacing = float(manifest["resolutionUm"])
    dims = manifest["dimensions"]
    by_id = {s["id"]: s for s in ontology}
    white = classify(ontology)
    present = set(map(int, np.unique(volume))) - {0}
    target_ids = sorted(set(white) & present)
    ontology_only = sorted(set(white) - present)
    assert set(target_ids) <= set(by_id)

    mesh_dir = DATA / "meshes"
    mesh_dir.mkdir(exist_ok=True)
    regions = []
    for identifier in target_ids:
        voxels = np.argwhere(volume == identifier)  # (ap, dv, ml) per row
        # Restrict marching cubes to the label bounding box; classification and
        # mesh both use the exact label, never a dilated or aggregated mask.
        lo = voxels.min(axis=0)
        hi = voxels.max(axis=0) + 1
        mask = volume[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]] == identifier
        vertices, faces = build_mesh(mask, spacing)
        vertices += lo.astype(np.float32) * spacing
        raw = pack_mesh(vertices, faces)
        path = mesh_dir / f"{identifier}.bin.gz"
        packed = write_gzip(path, raw)
        counts = voxels.shape[0]
        centroid = voxels.mean(axis=0)
        # Bilateral centroids can fall outside the region; focus is a real
        # labeled voxel in the left hemisphere when one exists.
        pool = voxels[voxels[:, 2] < dims[2] / 2]
        if not len(pool):
            pool = voxels
        center = pool.mean(axis=0)
        focus = pool[np.argmin(((pool - center) ** 2).sum(axis=1))]
        regions.append({
            "id": identifier,
            "name": by_id[identifier]["name"],
            "acronym": by_id[identifier]["acronym"],
            "classification": white[identifier],
            "mesh": {
                "url": f"/data/kim-v2/meshes/{identifier}.bin.gz",
                "format": MESH_FORMAT,
                "compression": "gzip",
                **packed,
                "vertexCount": int(len(vertices)),
                "triangleCount": int(len(faces)),
                "boundsUm": [[round(float(vertices[:, a].min()), 3), round(float(vertices[:, a].max()), 3)] for a in range(3)],
            },
            "voxelCount": int(counts),
            "volumeMm3": round(counts * (spacing / 1000) ** 3, 6),
            "centroidVoxel": [round(float(v), 3) for v in centroid],
            "focusVoxel": [int(v) for v in focus],
            "focusUm": [int(v * spacing) for v in focus],
            "boundsVoxel": [[int(lo[a]), int(hi[a] - 1)] for a in range(3)],
        })
        print(f"WM {identifier:>5} {by_id[identifier]['acronym']:<8} voxels={counts:>6} "
              f"verts={len(vertices):>6} tris={len(faces):>6}", flush=True)

    manifest["whiteMatterProvenance"] = {
        "classificationRule": "structureIdPath contains fiber-tracts root 1009, or id is an explicit ontology exception; exclude I8 nucleus 2461; no name matching",
        "fiberTractsRootId": FIBER_TRACTS_ROOT_ID,
        "excludedNucleusIds": [2461],
        "exceptionIds": list(WHITE_MATTER_EXCEPTION_IDS),
        "exceptionNote": "17 InWh, 42 DpWh and 851 Op are white layers of the superior colliculus (Op carries retinal afferent and myelinated fibers) filed under SC subtrees 294/302; 2219 SMV is a white-matter lamina filed under the ventricular branch. All four sit outside the fiber-tracts subtree in the Kim ontology.",
        "ontologyStructureCount": len(white),
        "ontologyWithoutVoxels": ontology_only,
        "ontologyWithoutVoxelsNote": "These fiber-tract structures exist in the Kim v2 ontology but have no voxels in the packaged 50 um label volume (mostly grouping parents and tracts the authors did not paint), so no mesh can be built from real labels.",
        "meshMethod": "skimage.measure.marching_cubes level 0.5 on the exact padded label mask, 50 um spacing; no smoothing, no simplification, all connected components kept",
        "sharedHelper": "src/lib/white-matter.ts",
        "runtime": {"python": sys.version.split()[0], "numpy": np.__version__,
                    "scikit-image": __import__("skimage").__version__},
    }
    manifest["whiteMatterRegions"] = regions
    (DATA / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({
        "whiteMatterRegions": len(regions),
        "ontologyWhiteMatter": len(white),
        "ontologyWithoutVoxels": len(ontology_only),
        "totalVoxels": int(sum(r["voxelCount"] for r in regions)),
        "meshDir": str(mesh_dir),
    }))


if __name__ == "__main__":
    main()
