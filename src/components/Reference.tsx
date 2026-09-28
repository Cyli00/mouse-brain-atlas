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
        <p>
          {reference.authors} · {reference.year}
          <br />
          <em>{reference.journal}</em>
        </p>
        <details>
          <summary>查看研究证据</summary>
          <p>{reference.finding}</p>
        </details>
      </div>
    </li>
  );
}
