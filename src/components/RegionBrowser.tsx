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
        `${region.name} ${region.englishName} ${region.acronym} ${region.category}`
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
        <div className="explore-switch" role="tablist" aria-label="探索方式">
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
              {tab === "regions" ? "解剖分区" : "经典环路"}
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
              placeholder="名称、英文或缩写"
              title="按 / 进入脑区搜索"
              aria-label="搜索脑区"
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
                aria-label="清除脑区搜索"
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
                aria-label="筛选脑区分类"
                value={category}
                onChange={(event) => changeCategory(event.target.value)}
              >
                <option value="全部">全部分类</option>
                {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <span className="catalog-result-total" aria-hidden="true">{filtered.length} 项</span>
            </div>
          )}
          <span id={`${id}-results`} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {filtered.length} 个结构{category !== "全部" ? `，${category}` : ""}
          </span>
        </div>
        <div ref={listRef} className="region-list" aria-label="脑区搜索结果">
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
                  <strong>{group.name}</strong>
                  <small>{group.regions.length}</small>
                </button>
              ))}
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <section className="region-group" key={group.name}>
                  <h3 className="guide-group-heading" hidden={category !== "全部"}>
                    {group.name}
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
                        aria-label={`${region.name} ${region.acronym}，定位并查看解说`}
                        onClick={() => onSelect(region.id)}
                      >
                        <span className="guide-region-copy">
                          <strong>{region.name}</strong>
                          <span className="guide-region-english">{region.englishName}</span>
                        </span>
                        <span className="guide-region-symbol" style={{ "--region-color": region.color } as React.CSSProperties}>
                          {region.acronym}
                        </span>
                        {selected === region.id ? <Check size={15} aria-label="已选" /> : <ArrowUpRight size={15} aria-hidden="true" />}
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
              <p>未找到匹配脑区</p>
              <span>
                {category === "全部"
                  ? "试试中文名称、英文名称或缩写。"
                  : `当前只搜索“${category}”。`}
              </span>
              {category !== "全部" &&
                normalizedQuery &&
                searchMatches.length > 0 && (
                  <button type="button" onClick={() => changeCategory("全部")}>
                    在全部脑区中搜索（{searchMatches.length}）
                  </button>
                )}
              <button type="button" onClick={() => clearSearch(true)}>
                清除搜索与筛选
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
                <strong>{circuit.name}</strong>
                <span>{circuit.subtitle}</span>
                <small>
                  {circuit.nodeIds.length} 个区域 · {circuit.edges.length}{" "}
                  条关系
                </small>
              </button>
            ))}
            <p>节点可定位至三维脑和切片。连线仅示意投射关系。</p>
          </div>
        </div>
      )}
    </div>
  );
}
