import { Typography, Timeline, Tag } from "antd";
import type { ChangelogEntry } from "../types/changelog.types";

const { Title } = Typography;

interface Props {
  entries: ChangelogEntry[];
}

export function ChangelogList({ entries }: Props) {
  return (
    <Timeline
      items={entries.map((entry) => ({
        children: (
          <div key={entry.version} style={{ paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>v{entry.version}</Title>
              <Tag>{entry.date}</Tag>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {entry.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ),
      }))}
    />
  );
}
