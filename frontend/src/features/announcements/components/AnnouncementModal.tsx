"use client";

import { Modal, Form, Select, Input, Switch, Button } from "antd";
import type { FormInstance } from "antd";
import type { Business } from "@/features/businesses/types/business.types";
import type { Announcement } from "../types/announcement.types";

const { TextArea } = Input;

interface Props {
  open: boolean;
  saving: boolean;
  editing: Announcement | null;
  businesses: Business[];
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { business_id: string; message: string; is_active?: boolean }) => void;
}

export function AnnouncementModal({ open, saving, editing, businesses, form, onClose, onSubmit }: Props) {
  return (
    <Modal
      title={editing ? "Editar banner" : "Nuevo banner"}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item label="Negocio" name="business_id" rules={[{ required: true, message: "Elegí un negocio" }]}>
          <Select
            showSearch
            placeholder="Elegí un negocio"
            disabled={!!editing}
            options={businesses.map((b) => ({ value: b.id, label: b.name }))}
            filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item
          label="Mensaje"
          name="message"
          rules={[{ required: true, message: "Escribí un mensaje" }, { max: 500, message: "Máximo 500 caracteres" }]}
        >
          <TextArea rows={3} showCount maxLength={500} placeholder="Ej: Mañana no abrimos por feriado nacional" />
        </Form.Item>
        <Form.Item label="Activo" name="is_active" valuePropName="checked" initialValue>
          <Switch />
        </Form.Item>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? "Guardar cambios" : "Crear banner"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
