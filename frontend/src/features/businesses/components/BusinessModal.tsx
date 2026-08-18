"use client";

import { Modal, Form, Input, Button, Divider, Checkbox } from "antd";
import type { FormInstance } from "antd";
import type { CreateBusinessInput, EnabledModules } from "../types/business.types";
import { BUSINESS_MODULE_KEYS, DEFAULT_ENABLED_MODULES_LIST, MODULE_LABELS } from "../constants/modules.constants";

interface Props {
  open: boolean;
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: CreateBusinessInput) => void;
}

interface FormValues extends Omit<CreateBusinessInput, "enabled_modules"> {
  enabled_modules_selected?: string[];
}

export function BusinessModal({ open, saving, form, onClose, onSubmit }: Props) {
  const handleFinish = (values: FormValues) => {
    const { enabled_modules_selected, ...rest } = values;
    const enabled_modules = Object.fromEntries(
      BUSINESS_MODULE_KEYS.map((key) => [key, (enabled_modules_selected ?? []).includes(key)]),
    ) as Partial<EnabledModules>;
    onSubmit({ ...rest, enabled_modules });
  };

  return (
    <Modal title="Nuevo negocio" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={handleFinish} className="mt-4">
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

        <Divider orientation="left" plain>
          Módulos habilitados
        </Divider>

        <Form.Item name="enabled_modules_selected" initialValue={DEFAULT_ENABLED_MODULES_LIST}>
          <Checkbox.Group
            className="flex flex-col gap-2"
            options={BUSINESS_MODULE_KEYS.map((key) => ({ label: MODULE_LABELS[key], value: key }))}
          />
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
