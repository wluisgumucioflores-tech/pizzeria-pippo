"use client";

import { Modal, Form, Input, Button, Divider } from "antd";
import type { FormInstance } from "antd";
import type { CreateBusinessInput } from "../types/business.types";

interface Props {
  open: boolean;
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: CreateBusinessInput) => void;
}

export function BusinessModal({ open, saving, form, onClose, onSubmit }: Props) {
  return (
    <Modal title="Nuevo negocio" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item label="Nombre del negocio" name="name" rules={[{ required: true, message: "Ingresá el nombre del negocio" }]}>
          <Input placeholder="Ej: Burger House" />
        </Form.Item>

        <Divider orientation="left" plain>
          Admin del negocio
        </Divider>

        <Form.Item
          label="Nombre completo"
          name={["admin", "full_name"]}
          rules={[{ required: true, message: "Ingresá el nombre del admin" }]}
        >
          <Input placeholder="Ej: Juan Pérez" />
        </Form.Item>
        <Form.Item
          label="Correo electrónico"
          name={["admin", "email"]}
          rules={[{ required: true, message: "Ingresá el correo" }, { type: "email", message: "Correo inválido" }]}
        >
          <Input placeholder="admin@negocio.com" />
        </Form.Item>
        <Form.Item
          label="Contraseña"
          name={["admin", "password"]}
          rules={[{ required: true, message: "Ingresá una contraseña" }, { min: 6, message: "Mínimo 6 caracteres" }]}
        >
          <Input.Password placeholder="••••••••" />
        </Form.Item>

        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            Crear negocio
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
