"""Build selected MICe CBA vessel surfaces in registered Allen CCF coordinates.

Offline dependencies: numpy, scipy, nibabel, scikit-image. Downloaded MINC
volumes remain in a temporary cache; this script only publishes derived meshes.
"""
from __future__ import annotations

import argparse
import json
import platform
from importlib.metadata import version
from pathlib import Path

import nibabel as nib
import numpy as np
from scipy import ndimage, sparse
from scipy.sparse import csgraph
from skimage.measure import marching_cubes
from skimage.morphology import skeletonize

from data_assets import file_digest as sha256, mesh_bytes, write_gzip

ROOT = Path(__file__).resolve().parents[1]
SOURCE_BASE = "https://www.mouseimaging.ca/mnc/cerebral_vasc_atlas/"
SOURCE_PAGE = "https://www.mouseimaging.ca/technologies/mouse_atlas/cerebral_vasc_atlas.html"
LABEL_KEY = "https://www.mouseimaging.ca/technologies/mouse_atlas/cerebral_vasc_atlas/mouse_vasculature_atlas_key.pdf"
SOURCE_SHA256 = {
    "cba_vasculature_labels.mnc": "2f604d3ad2d8d122bfe66de18ccb9aef82d2de5b9f929c328d09f9577ede1b37",
    "cba_brain_labels.mnc": "35ebc62a70e6b4d9b0892f375ce3d9e7aabdefb6a60b4600930cdd7e32ada983",
}
VESSELS = [
    (11, "上矢状窦", "Superior sagittal sinus", "sinus", "midline"),
    (246, "左横窦", "Transverse sinus", "sinus", "left"),
    (30, "右横窦", "Transverse sinus", "sinus", "right"),
    (24, "左乙状窦", "Sigmoid sinus", "sinus", "left"),
    (101, "右乙状窦", "Sigmoid sinus", "sinus", "right"),
    (35, "大脑前动脉", "Anterior cerebral artery", "artery", "bilateral"),
    (190, "左大脑中动脉", "Middle cerebral artery", "artery", "left"),
    (191, "右大脑中动脉", "Middle cerebral artery", "artery", "right"),
    (5, "左大脑后动脉", "Posterior cerebral artery", "artery", "left"),
    (8, "右大脑后动脉", "Posterior cerebral artery", "artery", "right"),
    (21, "左头端鼻裂静脉", "Rostral rhinal vein", "vein", "left"),
    (20, "右头端鼻裂静脉", "Rostral rhinal vein", "vein", "right"),
    (34, "左尾端鼻裂静脉", "Caudal rhinal vein", "vein", "left"),
    (192, "右尾端鼻裂静脉", "Caudal rhinal vein", "vein", "right"),
]


def source_record(path: Path, image: nib.spatialimages.SpatialImage) -> dict:
    return {
        "file": path.name,
        "url": SOURCE_BASE + path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "shape": list(image.shape),
        "storageAxisOrder": ["xspace", "yspace", "zspace"],
        "voxelSpacingUm": (nib.affines.voxel_sizes(image.affine) * 1000).tolist(),
        "voxelToSourceWorldRasMm": image.affine.tolist(),
    }


def coarse_backbone(mask: np.ndarray) -> tuple[np.ndarray, dict]:
    distance = ndimage.distance_transform_edt(mask)
    skeleton = skeletonize(mask, method="lee")
    coordinates = np.argwhere(skeleton)
    flat = np.ravel_multi_index(coordinates.T, mask.shape)
    radii = distance[tuple(coordinates.T)]
    del distance
    anchors = radii > 2
    if not anchors.any():
        raise ValueError("Selected vessel has no coarse skeleton core")

    # The mask is padded, so neighboring flat indices cannot wrap between rows.
    # Path costs prefer existing wider routes; they do not model blood flow.
    offsets = [
        (x * mask.shape[1] * mask.shape[2] + y * mask.shape[2] + z,
         (x * x + y * y + z * z) ** 0.5)
        for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1)
        if x or y or z
    ]
    rows, columns, costs = [], [], []
    # argwhere returns sorted flat indices. Look up each neighbor offset for all
    # skeleton nodes at once while retaining the same graph edges and weights.
    for offset, length in offsets:
        candidates = flat + offset
        positions = np.searchsorted(flat, candidates)
        positions = np.minimum(positions, len(flat) - 1)
        nodes = np.flatnonzero(flat[positions] == candidates)
        neighbors = positions[nodes]
        rows.append(nodes)
        columns.append(neighbors)
        costs.append(length / np.minimum(radii[nodes], radii[neighbors]) ** 2)
    graph = sparse.csr_matrix(
        (np.concatenate(costs), (np.concatenate(rows), np.concatenate(columns))),
        shape=(len(flat), len(flat)),
    )
    count, components = csgraph.connected_components(graph, directed=False)
    roots = []
    for component in range(count):
        choices = np.flatnonzero((components == component) & anchors)
        if len(choices):
            roots.append(int(choices[np.argmax(radii[choices])]))
    _, predecessors, _ = csgraph.dijkstra(
        graph, indices=roots, directed=False, return_predecessors=True, min_only=True,
    )
    alive = np.zeros(len(flat), dtype=bool)
    for node in np.flatnonzero(anchors):
        while node >= 0 and not alive[node]:
            alive[node] = True
            node = predecessors[node]

    # Assign original vessel voxels to their nearest original skeleton point.
    # Keeping only assignments to selected paths removes branches without
    # reconstructing them, widening the vessel, or adding a synthetic connection.
    retained_skeleton = np.zeros_like(mask)
    retained_skeleton[tuple(coordinates[alive].T)] = True
    nearest = ndimage.distance_transform_edt(
        ~skeleton, return_distances=False, return_indices=True,
    )
    kept = mask & retained_skeleton[tuple(nearest)]
    del nearest
    connectivity = np.ones((3, 3, 3), dtype=bool)
    output_components, output_count = ndimage.label(kept, connectivity)
    supported = np.zeros(output_count + 1, dtype=bool)
    supported[np.unique(output_components[retained_skeleton])] = True
    unsupported_voxels = int(np.count_nonzero(kept & ~supported[output_components]))
    kept &= supported[output_components]
    # Removing entire unsupported components cannot split or join the others;
    # retain their labels instead of scanning the volume a second time.
    output_components[~kept] = 0
    output_count = int(np.count_nonzero(supported))
    del retained_skeleton

    if np.any(kept & ~mask) or not kept[tuple(coordinates[anchors].T)].all():
        raise ValueError("Display selection added voxels or removed a protected core")
    original_components, original_count = ndimage.label(mask, connectivity)
    original_sizes = np.bincount(original_components[mask])
    output_sizes = np.bincount(output_components[kept])
    main_component = original_components == original_sizes.argmax()
    remaining_main_parts = np.unique(output_components[main_component & kept])
    main_split_count = int(np.count_nonzero(remaining_main_parts))
    if main_split_count != 1:
        raise ValueError("Display selection split or removed the original main component")
    original_core_components = original_components[tuple(coordinates[anchors].T)]
    retained_core_components = output_components[tuple(coordinates[anchors].T)]
    core_component_count = len(np.unique(original_core_components))
    component_split_counts = []
    for component in np.unique(original_core_components):
        if len(np.unique(retained_core_components[original_core_components == component])) != 1:
            raise ValueError("Protected cores from one original component became disconnected")
        parts = np.unique(output_components[(original_components == component) & kept])
        component_split_counts.append(int(np.count_nonzero(parts)))
    if max(component_split_counts) != 1:
        raise ValueError("An original component with protected cores became fragmented")
    original_voxels = int(np.count_nonzero(mask))
    retained_voxels = int(np.count_nonzero(kept))
    return kept, {
        "method": "coarse-core skeleton paths, source-mask subset",
        "coreDistanceVoxels": 2,
        "skeletonPoints": len(coordinates), "coreSkeletonPoints": int(anchors.sum()),
        "keptSkeletonPoints": int(alive.sum()),
        "originalVoxels": original_voxels, "retainedVoxels": retained_voxels,
        "retainedPct": round(retained_voxels / original_voxels * 100, 1),
        "originalComponents": original_count, "remainingComponents": output_count,
        "mainComponentSplitCount": main_split_count,
        "largestRemainingPct": round(float(output_sizes.max() / retained_voxels * 100), 1),
        "addedVoxels": 0, "protectedCorePointsPreserved": True,
        "protectedCoreSourceComponents": core_component_count,
        "protectedCoreConnectivityPreserved": True,
        "maxOriginalComponentSplitCount": max(component_split_counts),
        "componentConnectivityCheck": "All original components containing protected core points",
        "unsupportedFragmentVoxelsRemoved": unsupported_voxels,
    }


def vessel_surface(labels: np.ndarray, identifier: int, coarse: bool = False,
                   region_slices: tuple[slice, ...] | None = None) -> tuple[np.ndarray, np.ndarray, dict]:
    if region_slices is None:
        region_slices = ndimage.find_objects(labels, max_label=identifier)[identifier - 1]
    if region_slices is None:
        raise ValueError(f"Missing source vessel label {identifier}")
    lower = np.array([axis.start for axis in region_slices])
    upper = np.array([axis.stop for axis in region_slices])
    region = labels[region_slices] == identifier
    source_count = int(np.count_nonzero(region))
    # Padding closes surfaces at the published volume boundary. Such boundaries
    # are recorded below; they do not imply an anatomical vessel endpoint.
    padding = 3 if coarse else 1
    mask = np.pad(region, padding)
    if coarse:
        mask, selection = coarse_backbone(mask)
    else:
        count = ndimage.label(mask, np.ones((3, 3, 3), dtype=bool))[1]
        selection = {
            "method": "unchanged source sinus mask", "originalVoxels": source_count,
            "retainedVoxels": source_count, "retainedPct": 100.0,
            "originalComponents": count, "remainingComponents": count,
            "mainComponentSplitCount": 1, "addedVoxels": 0,
        }
    vertices, faces, _, _ = marching_cubes(
        mask.astype(np.uint8), level=0.5, gradient_direction="ascent", allow_degenerate=False,
    )
    vertices += lower - padding
    return vertices, faces, {
        "sourceVoxelCount": source_count,
        "displayVoxelCount": selection["retainedVoxels"],
        "displaySelection": selection,
        "sourceBoundsVoxel": np.stack([lower, upper - 1], axis=1).tolist(),
        "touchesSourceVolumeBoundary": bool(np.any(lower == 0) or np.any(upper == labels.shape)),
    }


def pack_mesh(path: Path, vertices: np.ndarray, faces: np.ndarray) -> dict:
    vertices = np.asarray(vertices, dtype="<f4")
    faces = np.asarray(faces, dtype="<u4")
    if not np.isfinite(vertices).all() or faces.max() >= len(vertices):
        raise ValueError(f"Invalid mesh {path.name}")
    payload = mesh_bytes(len(vertices), len(faces), vertices.tobytes(), faces.tobytes())
    packed = write_gzip(path, payload, uncompressed_hash=False)
    return {
        "format": "allen-mesh-v1", **packed,
        "vertexCount": len(vertices), "triangleCount": len(faces),
        "boundsUm": np.stack([vertices.min(axis=0), vertices.max(axis=0)], axis=1).tolist(),
    }


def load_labels(image: nib.spatialimages.SpatialImage) -> np.ndarray:
    # MINC scaling produces float64 arrays. Validate in slabs so a 34 MB label
    # volume does not require two full 272 MB floating-point copies.
    labels = np.empty(image.shape, dtype=np.uint8)
    for start in range(0, image.shape[0], 16):
        slab = np.asarray(image.dataobj[start:start + 16])
        if (not np.isfinite(slab).all() or not np.array_equal(slab, np.rint(slab))
                or np.any(slab < 0) or np.any(slab > 255)):
            raise ValueError("The vascular MINC volume must contain integer byte labels")
        labels[start:start + 16] = slab
    return labels


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--registration", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "public/vasculature/mice")
    args = parser.parse_args()

    vascular_path = args.cache / "cba_vasculature_labels.mnc"
    brain_path = args.cache / "cba_brain_labels.mnc"
    for path in [vascular_path, brain_path]:
        if sha256(path) != SOURCE_SHA256[path.name]:
            raise ValueError(f"Source checksum does not match the verified MICe download: {path.name}")
    vascular = nib.load(vascular_path)
    brain = nib.load(brain_path)
    labels = load_labels(vascular)
    label_bounds = ndimage.find_objects(labels)
    registration = json.loads(args.registration.read_text())
    if registration.get("coordinateSpace") != "Allen CCFv3 2017":
        raise ValueError("Registration is not in the expected Allen CCFv3 2017 space")
    if registration.get("sources", {}).get("brainLabelsSha256") != sha256(brain_path):
        raise ValueError("Registration was not fitted to the verified MICe brain labels")
    transform = np.asarray(registration["sourceWorldRasMmToCcfUm"], dtype=float)
    if transform.shape != (4, 4) or not np.isfinite(transform).all():
        raise ValueError("Registration must provide a finite 4 by 4 source RAS mm to CCF um matrix")
    if not np.allclose(transform[3], [0, 0, 0, 1]) or abs(np.linalg.det(transform[:3, :3])) < 1e-6:
        raise ValueError("Invalid registration affine")

    mesh_dir = args.output / "meshes"
    mesh_dir.mkdir(parents=True, exist_ok=True)
    source_to_ccf = transform @ vascular.affine
    vessels = []
    for identifier, name, english_name, group, hemisphere in VESSELS:
        vertices, faces, details = vessel_surface(
            labels, identifier, coarse=group != "sinus", region_slices=label_bounds[identifier - 1],
        )
        vertices = nib.affines.apply_affine(source_to_ccf, vertices)
        if np.linalg.det(source_to_ccf[:3, :3]) < 0:
            faces = faces[:, ::-1]
        if not np.isfinite(vertices).all() or np.any(vertices < -1000) or np.any(vertices > [14200, 9000, 12400]):
            raise ValueError(f"Vessel {identifier} is outside the supported CCF coordinate bounds")
        centered = vertices - vertices.mean(axis=0)
        volume_um3 = np.einsum(
            "ij,ij->", centered[faces[:, 0]],
            np.cross(centered[faces[:, 1]], centered[faces[:, 2]]),
        ) / 6
        if volume_um3 <= 0:
            raise ValueError(f"Vessel {identifier} has inward mesh winding")
        filename = f"{identifier}.bin.gz"
        item = {
            "id": identifier, "sourceLabelId": identifier, "name": name,
            "englishName": english_name, "group": group, "hemisphere": hemisphere,
            "url": f"/vasculature/mice/meshes/{filename}",
            "signedMeshVolumeUm3": float(volume_um3),
            **pack_mesh(mesh_dir / filename, vertices, faces), **details,
        }
        vessels.append(item)
        print(f"MICe {identifier}: {item['vertexCount']:,} vertices, {item['bytes']:,} bytes", flush=True)

    manifest = {
        "version": 1, "dataset": "MICe Cerebral Vascular Atlas of the CBA Mouse",
        "stage": "adult", "coordinateSpace": "Allen CCFv3 2017",
        "axisOrder": ["AP", "DV", "ML"], "units": "um",
        "vesselCount": len(vessels), "vessels": vessels,
        "source": {
            "page": SOURCE_PAGE, "paper": "https://doi.org/10.1016/j.neuroimage.2006.12.040",
            "labelKey": LABEL_KEY,
            "attribution": "Dorr A, Sled JG, Kabani N. NeuroImage 35 (2007), 1409–1423; Mouse Imaging Centre.",
            "species": "Mus musculus", "strain": "CBA", "sex": "male", "ageMonths": 6,
            "vascularSpecimenCount": 1,
            "paperCtAcquisitionVoxelSpacingUm": [20, 20, 20],
            "publishedVascularLabelVoxelSpacingUm": (nib.affines.voxel_sizes(vascular.affine) * 1000).tolist(),
            "publishedBrainLabelVoxelSpacingUm": (nib.affines.voxel_sizes(brain.affine) * 1000).tolist(),
            "license": "No explicit dataset redistribution license was identified on the source download page. Source terms apply; this project grants no additional rights.",
            "termsUrl": "https://www.mouseimaging.ca/terms.html",
        },
        "provenance": {
            "files": [source_record(vascular_path, vascular), source_record(brain_path, brain)],
            "selection": "Fourteen named atlas labels: sagittal/transverse/sigmoid sinuses, anterior/middle/posterior cerebral arteries, and rostral/caudal rhinal veins. Other vascular labels are excluded.",
            "processing": "The five sinus masks are unchanged. Nine artery/vein masks are source-label subsets: Lee skeletons, native distance-transform core points >2 voxels, and width-weighted shortest paths on the original skeleton retain connected cores. Original voxels are assigned to the nearest original skeleton point; assignments to omitted branches and disconnected fragments containing no retained skeleton are removed. No voxels are added. Marching cubes at 0.5 on the published 32 um grid; no smoothing, mesh decimation, mirrored completion, or reconstructed vessel segments.",
            "displayRule": "Core distance and skeleton path costs are display-selection parameters, not physical vessel-diameter measurements or bleeding-risk thresholds.",
            "sourceCoordinateSpace": "MICe CBA mean MRI, RAS millimeters; voxel centers follow MINC starts and steps.",
            "registrationFileSha256": sha256(args.registration),
            "generator": "scripts/prepare_mice_vasculature.py",
            "generatorEnvironment": {
                "python": platform.python_version(),
                **{name: version(name) for name in ["numpy", "scipy", "nibabel", "scikit-image"]},
            },
        },
        "registration": registration,
        "limitations": [
            "One six-month-old male CBA vascular specimen; not a population or individual-animal vascular map.",
            "CT was acquired after brain removal from the skull; complete dural vasculature and bridging-vein connections are not established by this dataset.",
            "The source label for the superior sagittal sinus does not distinguish the upper and lower compartments reported by later studies.",
            "Artery/vein display selection omits narrow terminal branches and may omit narrow alternative paths or loops; it is not a complete vascular network.",
            "Display pruning can remove original wall voxels near branch junctions; only the selected source-mask subset and protected core connectivity are preserved.",
            "Truncated and capped surfaces at omitted branches are display boundaries, not anatomical vessel endpoints. Vessel diameter and bleeding risk are not quantified.",
            "Published 32 um manual label surfaces and affine atlas registration limit spatial accuracy; blank regions do not establish vessel absence.",
            "Labels touching the source volume edge have clipped boundaries, which are closed for mesh rendering and are not anatomical endpoints.",
        ],
        "meshFormat": {
            "name": "allen-mesh-v1", "endian": "little", "compression": "gzip",
            "header": "uint32 vertexCount, uint32 triangleCount",
            "vertices": "vertexCount * 3 float32, AP/DV/ML micrometers",
            "triangles": "triangleCount * 3 uint32 vertex indices",
        },
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"vesselCount": len(vessels), "meshBytes": sum(v["bytes"] for v in vessels)}))


if __name__ == "__main__":
    main()
