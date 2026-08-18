"use client";

import { Modal, Descriptions, Tag, Space } from "antd";
import type { Business } from "../types/business.types";
import { BUSINESS_MODULE_KEYS, MODULE_LABELS } from "../constants/modules.constants";

interface Props {
  business: Business | null;
  onClose: () => void;
}

export function BusinessDetailModal({ business, onClose }: Props) {
  return (
    <Modal title="Detalle del negocio" open={!!business} onCancel={onClose} footer={null} destroyOnHidden>
      {business && (
        <Descriptions column={1} bordered size="small" className="mt-4">
          <Descriptions.Item label="Nombre">{business.name}</Descriptions.Item>
          <Descriptions.Item label="Estado">
            <Tag color={business.is_active ? "green" : "default"}>{business.is_active ? "Activo" : "Suspendido"}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Fecha de alta">
            {new Date(business.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </Descriptions.Item>
          <Descriptions.Item label="Módulos habilitados">
            <Space wrap>
              {BUSINESS_MODULE_KEYS.map((key) => (
                <Tag key={key} color={business.enabled_modules[key] ? "green" : "default"}>
                  {MODULE_LABELS[key]}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
