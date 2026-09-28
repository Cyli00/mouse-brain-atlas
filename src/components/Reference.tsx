import { ArrowUpRight } from "lucide-react";
import type { BrainReference } from "../data/regions";
export function Reference({
  reference,
  index,
}: {
  reference: BrainReference;
  index: number;
}) {
  return (
    <li className="reference">
      <span className="reference-index">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div>
        <a href={reference.url} target="_blank" rel="noreferrer">
          {reference.title}
          <ArrowUpRight size={13} />
        </a>
        <span className="reference-citation">{reference.year} · {reference.journal}</span>
        <details>
          <summary>本页文献解读</summary>
          <p>{reference.finding}</p>
          <p className="reference-authors">{reference.authors}</p>
        </details>
      </div>
    </li>
  );
}
