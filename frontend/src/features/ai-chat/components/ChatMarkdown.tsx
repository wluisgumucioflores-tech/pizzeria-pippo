import { Fragment, type ReactNode } from "react";

// Intentionally lightweight parser — the agent only returns bold, lists, and
// paragraphs (never tables, code, or links), so it doesn't justify pulling in a
// full markdown library for the floating widget.
const BOLD_PATTERN = /\*\*(.+?)\*\*/g;
const BULLET_PATTERN = /^[-*]\s+(.*)$/;
const NUMBERED_PATTERN = /^\d+\.\s+(.*)$/;

function renderInline(text: string): ReactNode {
  const parts = text.split(BOLD_PATTERN);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

interface Block {
  type: "paragraph" | "bullet-list" | "numbered-list";
  lines: string[];
}

function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let sawBlankLine = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      sawBlankLine = true;
      continue;
    }

    const bullet = line.match(BULLET_PATTERN);
    const numbered = line.match(NUMBERED_PATTERN);
    const type = bullet ? "bullet-list" : numbered ? "numbered-list" : "paragraph";
    const text = bullet?.[1] ?? numbered?.[1] ?? line;

    const last = blocks[blocks.length - 1];
    // A blank line always separates paragraphs (even of the same
    // type) — only lists get grouped across consecutive lines
    // with no blank line in between.
    if (last && last.type === type && !(sawBlankLine && type === "paragraph")) {
      last.lines.push(text);
    } else {
      blocks.push({ type, lines: [text] });
    }
    sawBlankLine = false;
  }
  return blocks;
}

export function ChatMarkdown({ content }: { content: string }) {
  const blocks = toBlocks(content);
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "bullet-list") {
          return (
            <ul key={i} style={{ margin: "4px 0", paddingLeft: 18 }}>
              {block.lines.map((line, j) => <li key={j}>{renderInline(line)}</li>)}
            </ul>
          );
        }
        if (block.type === "numbered-list") {
          return (
            <ol key={i} style={{ margin: "4px 0", paddingLeft: 18 }}>
              {block.lines.map((line, j) => <li key={j}>{renderInline(line)}</li>)}
            </ol>
          );
        }
        return (
          <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0" }}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
