// I8 (2461) is an interstitial nucleus misplaced in the source fiber-tract tree.
// Keep it out of white matter even though its ontology path contains 1009.

/**
 * Allen/Paxinos-derived ontology ID of the "fiber tracts" subtree root.
 * Any Kim v2 structure whose structure_id_path contains this ID is white
 * matter by ontology classification alone.
 */
export const FIBER_TRACTS_ROOT_ID = 1009;

/**
 * Explicit ontology exceptions, all verified to have voxels in the v2 volume:
 * - 17 InWh / 42 DpWh / 851 Op: superior colliculus white layers. InWh and
 *   DpWh are filed under SC motor related (294) and Op under SC sensory (302),
 *   none under fiber tracts. Op (stratum opticum) carries retinal afferent
 *   axons and myelinated fibers (Byun et al. 2016, J Comp Neurol,
 *   doi:10.1002/cne.23952; Edwards et al. 1986, doi:10.1002/cne.902480309).
 * - 2219 SMV: the superior medullary velum is a thin white-matter lamina that
 *   the Kim ontology files under the ventricular branch (73/145), not fiber
 *   tracts.
 * Nuclei with "tract" in their name (e.g. nucleus of the lateral olfactory
 * tract) are gray matter and are deliberately not included.
 */
export const WHITE_MATTER_EXCEPTION_IDS: readonly number[] = [17, 42, 851, 2219];

export const WHITE_MATTER_COLOR = "#80613d";
export const WHITE_MATTER_LABEL = "白质 / 纤维束";

/**
 * True when the structure is white matter in the PF / Kim v2 ontology:
 * either inside the fiber-tracts subtree (path contains 1009) or one of the
 * explicit superior colliculus white-layer exceptions. Matching is by
 * ontology path only, never by name, so nuclei named after tracts stay gray.
 */
export function isWhiteMatterStructure(
  s: { id: number; structure_id_path: number[] } | undefined,
): boolean {
  if (!s || s.id === 2461) return false;
  return (
    s.structure_id_path.includes(FIBER_TRACTS_ROOT_ID) ||
    WHITE_MATTER_EXCEPTION_IDS.includes(s.id)
  );
}
