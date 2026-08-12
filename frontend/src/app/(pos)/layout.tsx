import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import enUS from "antd/locale/en_US";
import { getLocale } from "next-intl/server";
import { PosAccessGuard } from "@/features/pos/components/PosAccessGuard";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <AntdRegistry>
      <ConfigProvider locale={locale === "en" ? enUS : esES}>
        <PosAccessGuard>{children}</PosAccessGuard>
      </ConfigProvider>
    </AntdRegistry>
  );
}
