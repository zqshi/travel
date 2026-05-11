import React from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function CompareResultView({ content }: { content: string }) {
  const parsed = tryParseCompareJSON(content);

  if (parsed) {
    return <CompareJSONView data={parsed} />;
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600" strokeLinecap="round">
            <path d="M3 11V5M7 11V3M11 11V7" />
          </svg>
        </span>
        <span className="text-sm font-medium">比价结果</span>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden px-5 py-4">
        <MarkdownContent text={content} />
      </div>
    </div>
  );
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    const h2Match = trimmed.match(/^#{2}\s+(.+)/);
    if (h2Match) {
      elements.push(
        <h3 key={i} className="text-sm font-bold mt-4 mb-2 first:mt-0 text-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          {renderInline(h2Match[1])}
        </h3>
      );
      i++; continue;
    }

    const h3Match = trimmed.match(/^#{3}\s+(.+)/);
    if (h3Match) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold mt-3 mb-1.5 text-foreground/90">
          {renderInline(h3Match[1])}
        </h4>
      );
      i++; continue;
    }

    const h4Match = trimmed.match(/^#{4}\s+(.+)/);
    if (h4Match) {
      elements.push(
        <h5 key={i} className="text-xs font-semibold mt-2 mb-1 text-foreground/80">
          {renderInline(h4Match[1])}
        </h5>
      );
      i++; continue;
    }

    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`list-${i}`} className="space-y-1.5 my-2">
          {listItems.map((item, j) => (
            <li key={j} className="text-xs leading-relaxed text-foreground/80 flex items-start gap-2">
              <span className="shrink-0 w-1 h-1 rounded-full bg-foreground/30 mt-1.5" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    elements.push(
      <p key={i} className="text-xs leading-relaxed text-foreground/80 my-1.5">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|¥[\d,.]+|[\d,.]+元|\$[\d,.]+|THB\s*[\d,.]+|฿[\d,.]+)/gi);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (/^\*\*(.+)\*\*$/.test(part)) {
      return <span key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</span>;
    }
    if (/^(¥[\d,.]+|[\d,.]+元|\$[\d,.]+|THB\s*[\d,.]+|฿[\d,.]+)$/i.test(part)) {
      return <span key={i} className="text-primary font-semibold">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const parseRow = (line: string) =>
    line.split("|").slice(1, -1).map((cell) => cell.trim());

  const headers = parseRow(lines[0]);
  const isSeparator = (line: string) => /^\|[\s\-:|]+\|$/.test(line);
  const dataLines = lines.filter((l, i) => i > 0 && !isSeparator(l));

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-foreground/70 whitespace-nowrap">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {dataLines.map((line, i) => {
            const cells = parseRow(line);
            return (
              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                {cells.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-foreground/80 whitespace-nowrap">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function tryParseCompareJSON(content: string): any | null {
  try {
    const trimmed = content.trim();
    let jsonStr = trimmed;
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      jsonStr = trimmed.slice(start, end + 1);
    }
    const data = JSON.parse(jsonStr);
    if (data.items || data.comparisons || data.platforms) return data;
    return null;
  } catch {
    return null;
  }
}

function CompareJSONView({ data }: { data: any }) {
  const items: any[] = data.items || (data.platforms ? [data] : []);
  const globalNotes: string = data.notes || data.summary || "";

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600" strokeLinecap="round">
            <path d="M3 11V5M7 11V3M11 11V7" />
          </svg>
        </span>
        <span className="text-sm font-medium">比价结果</span>
      </div>

      {items.map((item: any, idx: number) => (
        <div key={idx} className="rounded-2xl border border-border bg-card overflow-hidden">
          {item.name && (
            <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20">
              <h4 className="text-sm font-semibold">{item.name}</h4>
            </div>
          )}

          <div className="divide-y divide-border/50">
            {(item.platforms || []).map((p: any, i: number) => (
              <PlatformRow key={i} platform={p} />
            ))}
          </div>

          {item.recommendation && (
            <div className="px-5 py-3.5 border-t border-border bg-blue-50/50 dark:bg-blue-950/20">
              <p className="text-xs leading-relaxed text-foreground/80">
                <span className="font-semibold text-primary mr-1">推荐：</span>
                {renderInline(item.recommendation)}
              </p>
            </div>
          )}

          {item.total_savings_thb > 0 && (
            <div className="px-5 py-2.5 border-t border-border/50 flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-medium">
                最多可省 ฿{item.total_savings_thb}（约¥{Math.round(item.total_savings_thb * 0.2)}）
              </span>
            </div>
          )}
        </div>
      ))}

      {globalNotes && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-xs leading-relaxed text-foreground/70">
            <span className="font-semibold mr-1">备注：</span>
            {renderInline(globalNotes)}
          </p>
        </div>
      )}
    </div>
  );
}

function PlatformRow({ platform }: { platform: any }) {
  const name = platform.platform || platform.name || "未知";
  const priceThb = platform.price_thb;
  const priceCny = platform.price_cny;
  const url = platform.url || "";
  const available = platform.available !== false;
  const notes = platform.notes || "";

  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          {!available && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted">暂无</span>
          )}
        </div>
        {notes && (
          <p className="text-xs text-muted mt-1 leading-relaxed">{notes}</p>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">
            查看详情 →
          </a>
        )}
      </div>
      <div className="text-right shrink-0">
        {priceCny != null && priceCny > 0 ? (
          <>
            <p className="text-sm font-bold text-primary">¥{priceCny}</p>
            {priceThb != null && <p className="text-[10px] text-muted">฿{priceThb}</p>}
          </>
        ) : priceThb != null && priceThb > 0 ? (
          <>
            <p className="text-sm font-bold text-primary">฿{priceThb}</p>
            <p className="text-[10px] text-muted">≈¥{Math.round(priceThb * 0.2)}</p>
          </>
        ) : (
          <span className="text-xs text-muted">价格待查</span>
        )}
      </div>
    </div>
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */
