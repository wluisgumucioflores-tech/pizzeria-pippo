"use client";

import { Button, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

interface Props {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}

// data-chart-export-exclude marks this node for useDownloadChartImage's
// filter so the button doesn't appear inside its own exported PNG.
export function ChartDownloadButton({ onClick, loading, label = "Descargar imagen" }: Props) {
  return (
    <span data-chart-export-exclude="true">
      <Tooltip title={label}>
        <Button type="text" size="small" icon={<DownloadOutlined />} loading={loading} onClick={onClick} />
      </Tooltip>
    </span>
  );
}
