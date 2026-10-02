import { ArrowUpRight } from "lucide-react";
import type { BrainReference } from "../data/regions";
import { useI18n } from "../lib/i18n";
export function Reference({
  reference,
  index,
}: {
  reference: BrainReference;
  index: number;
}) {
  const { t, text } = useI18n();
  return (
    <li className="reference">
      <span className="reference-index">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div>
        <a href={reference.url} target="_blank" rel="noreferrer">
          {text(reference.title)}
          <ArrowUpRight size={13} />
        </a>
        <span className="reference-citation">{reference.year} · {text(reference.journal)}</span>
        <details>
          <summary>{t("本页文献解读", "How this source is used")}</summary>
          <p>{text(reference.finding)}</p>
          <p className="reference-authors">{text(reference.authors)}</p>
        </details>
      </div>
    </li>
  );
}
