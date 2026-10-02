import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Check,
  ArrowUpRight,
  Search,
  X,
} from "lucide-react";
import { brainCircuits } from "../data/circuits";
import type { BrainRegion } from "../data/regions";
import { useI18n, translateText } from "../lib/i18n";

type BrowseMode = "regions" | "circuits";

type Props = {
  regions: BrainRegion[];
  selected: number;
  embryonic: boolean;
  mode: BrowseMode;
  onModeChange: (mode: BrowseMode) => void;
  activeCircuitId?: string;
  onSelect: (id: number) => void;
  onCircuitSelect: (id: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
};

export function RegionBrowser({
  regions,
  selected,
  embryonic,
  mode,
  onModeChange,
  activeCircuitId,
  onSelect,
  onCircuitSelect,
  searchInputRef,
}: Props) {
  const { locale, t, text } = useI18n();
  const regionName = (region: BrainRegion) => locale === "en" ? region.englishName : region.name;
  const id = useId();
  const localSearchRef = useRef<HTMLInputElement>(null);
  const searchRef = searchInputRef ?? localSearchRef;
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement>(null);
  const regionTabRef = useRef<HTMLButtonElement>(null);
  const circuitTabRef = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const activeMode = embryonic ? "regions" : mode;
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("全部");
  const categories = useMemo(
    () => [...new Set(regions.map((region) => region.category))],
    [regions],
  );
  useEffect(() => {
    if (category !== "全部" && !categories.includes(category)) setCategory("全部");
  }, [categories, category]);
  const normalizedQuery = searchTerm.trim().toLowerCase();
  const overview = !normalizedQuery && category === "全部";
  const searchMatches = useMemo(
    () =>
      regions.filter((region) =>
        `${region.name} ${region.englishName} ${region.acronym} ${region.category} ${translateText(region.category, "en")}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [regions, normalizedQuery],
  );
  const filtered = useMemo(
    () =>
      searchMatches.filter(
        (region) => category === "全部" || region.category === category,
      ),
    [searchMatches, category],
  );
  const groups = useMemo(
    () =>
      categories
        .map((name) => ({
          name,
          regions: filtered.filter((region) => region.category === name),
        }))
        .filter((group) => group.regions.length > 0),
    [categories, filtered],
  );
  const selectedVisible = filtered.some((region) => region.id === selected);

  useEffect(() => {
    if (activeMode !== "regions" || !selectedVisible) return;
    const revealSelectedRow = () => {
      const list = listRef.current;
      const row = selectedRowRef.current;
      if (!list || !row || !list.clientHeight || !row.getClientRects().length)
        return;
      // Move the catalog's own scroll area, never an ancestor or the page.
      const listBox = list.getBoundingClientRect();
      const rowBox = row.getBoundingClientRect();
      const top = listBox.top + list.clientTop;
      const bottom = top + list.clientHeight;
      if (rowBox.top < top) list.scrollTop += rowBox.top - top;
      else if (rowBox.bottom > bottom) list.scrollTop += rowBox.bottom - bottom;
    };
    const frame = requestAnimationFrame(revealSelectedRow);
    const observer = new ResizeObserver(revealSelectedRow);
    if (listRef.current) observer.observe(listRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [selected, activeMode, selectedVisible]);

  const resetListScroll = () => {
    if (listRef.current) listRef.current.scrollTop = 0;
  };
  const clearSearch = (clearCategory = false) => {
    composing.current = false;
    setQuery("");
    setSearchTerm("");
    if (clearCategory) setCategory("全部");
    resetListScroll();
    searchRef.current?.focus();
  };
  const changeCategory = (nextCategory: string) => {
    setCategory(nextCategory);
    resetListScroll();
  };
  const changeModeWithKeyboard = (key: string) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return false;
    const nextMode =
      key === "Home"
        ? "regions"
        : key === "End"
          ? "circuits"
          : activeMode === "regions"
            ? "circuits"
            : "regions";
    onModeChange(nextMode);
    (nextMode === "regions" ? regionTabRef : circuitTabRef).current?.focus();
    return true;
  };

  return (
    <div className="region-browser">
      {!embryonic && (
        <div className="explore-switch" role="tablist" aria-label={t("探索方式", "Explore by")}>
          {(["regions", "circuits"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              ref={tab === "regions" ? regionTabRef : circuitTabRef}
              id={`${id}-${tab}-tab`}
              role="tab"
              aria-selected={activeMode === tab}
              aria-controls={`${id}-${tab}-panel`}
              tabIndex={activeMode === tab ? 0 : -1}
              onClick={() => onModeChange(tab)}
              onKeyDown={(event) => {
                if (changeModeWithKeyboard(event.key)) event.preventDefault();
              }}
            >
              {tab === "regions" ? t("解剖分区", "Regions") : t("经典环路", "Circuits")}
            </button>
          ))}
        </div>
      )}
      <div
        id={`${id}-regions-panel`}
        role={embryonic ? undefined : "tabpanel"}
        aria-labelledby={embryonic ? undefined : `${id}-regions-tab`}
        hidden={activeMode !== "regions"}
      >
        <div className="catalog-toolbar">
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder={t("名称、英文或缩写", "Name or abbreviation")}
              title={t("按 / 进入脑区搜索", "Press / to search regions")}
              aria-label={t("搜索脑区", "Search brain regions")}
              aria-describedby={`${id}-results`}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={(event) => {
                composing.current = false;
                setQuery(event.currentTarget.value);
                setSearchTerm(event.currentTarget.value);
                resetListScroll();
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!composing.current) {
                  setSearchTerm(event.target.value);
                  resetListScroll();
                }
              }}
            />
            {!query && <kbd aria-hidden="true">/</kbd>}
            {query && (
              <button
                type="button"
                aria-label={t("清除脑区搜索", "Clear region search")}
                onClick={() => clearSearch()}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {!overview && (
            <div className="catalog-filter-row">
              <select
                className="category-select"
                aria-label={t("筛选脑区分类", "Filter region category")}
                value={category}
                onChange={(event) => changeCategory(event.target.value)}
              >
                <option value="全部">{t("全部分类", "All categories")}</option>
                {categories.map((name) => <option key={name} value={name}>{text(name)}</option>)}
              </select>
              <span className="catalog-result-total" aria-hidden="true">{t(`${filtered.length} 项`, `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`)}</span>
            </div>
          )}
          <span id={`${id}-results`} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {t(`${filtered.length} 个结构${category !== "全部" ? `，${category}` : ""}`, `${filtered.length} ${filtered.length === 1 ? "structure" : "structures"}${category !== "全部" ? `, ${text(category)}` : ""}`)}
          </span>
        </div>
        <div ref={listRef} className="region-list" aria-label={t("脑区搜索结果", "Region search results")}>
          {overview ? (
            <div className="guide-category-grid">
              {groups.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  className="guide-category-card"
                  onClick={() => changeCategory(group.name)}
                >
                  <span className="guide-category-color" style={{ backgroundColor: group.regions[0].color }} aria-hidden="true" />
                  <strong>{text(group.name)}</strong>
                  <small>{group.regions.length}</small>
                </button>
              ))}
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <section className="region-group" key={group.name}>
                  <h3 className="guide-group-heading" hidden={category !== "全部"}>
                    {text(group.name)}
                    <span>{group.regions.length}</span>
                  </h3>
                  <div className="guide-region-grid">
                    {group.regions.map((region) => (
                      <button
                        key={region.id}
                        ref={
                          selected === region.id ? selectedRowRef : undefined
                        }
                        type="button"
                        className={`guide-region-card${selected === region.id ? " selected" : ""}`}
                        aria-pressed={selected === region.id}
                        aria-label={t(`${region.name} ${region.acronym}，定位并查看解说`, `${region.englishName} ${region.acronym}, locate and read details`)}
                        onClick={() => onSelect(region.id)}
                      >
                        <span className="guide-region-copy">
                          <strong>{regionName(region)}</strong>
                          {locale === "zh" && <span className="guide-region-english">{region.englishName}</span>}
                        </span>
                        <span className="guide-region-symbol" style={{ "--region-color": region.color } as React.CSSProperties}>
                          {region.acronym}
                        </span>
                        {selected === region.id ? <Check size={15} aria-label={t("已选", "Selected")} /> : <ArrowUpRight size={15} aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
          {!filtered.length && (
            <div className="empty-results catalog-status" role="status">
              <Search size={23} aria-hidden="true" />
              <p>{t("未找到匹配脑区", "No matching regions")}</p>
              <span>
                {category === "全部"
                  ? t("试试中文名称、英文名称或缩写。", "Try a Chinese or English name, or an abbreviation.")
                  : t(`当前只搜索“${category}”。`, `Searching only in “${text(category)}”.`)}
              </span>
              {category !== "全部" &&
                normalizedQuery &&
                searchMatches.length > 0 && (
                  <button type="button" onClick={() => changeCategory("全部")}>
                    {t(`在全部脑区中搜索（${searchMatches.length}）`, `Search all regions (${searchMatches.length})`)}
                  </button>
                )}
              <button type="button" onClick={() => clearSearch(true)}>
                {t("清除搜索与筛选", "Clear search and filters")}
              </button>
            </div>
          )}
        </div>
      </div>
      {!embryonic && (
        <div
          id={`${id}-circuits-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-circuits-tab`}
          hidden={activeMode !== "circuits"}
        >
          <div className="circuit-list">
            {brainCircuits.map((circuit) => (
              <button
                type="button"
                key={circuit.id}
                className={activeCircuitId === circuit.id ? "active" : ""}
                aria-pressed={activeCircuitId === circuit.id}
                onClick={() => onCircuitSelect(circuit.id)}
              >
                <strong>{text(circuit.name)}</strong>
                <span>{text(circuit.subtitle)}</span>
                <small>
                  {t(`${circuit.nodeIds.length} 个区域 · ${circuit.edges.length} 条关系`, `${circuit.nodeIds.length} regions · ${circuit.edges.length} connections`)}
                </small>
              </button>
            ))}
            <p>{t("节点可定位至三维脑和切片。连线仅示意投射关系。", "Locate nodes in the 3D brain and slices. Connections are schematic projections.")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
