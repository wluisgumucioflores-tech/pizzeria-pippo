"use client";

import { Modal, Form, Input, Button, Divider, Checkbox, Select } from "antd";
import type { FormInstance } from "antd";
import type { AiChatPlan } from "@/features/ai-chat-plans/types/aiChatPlan.types";
import type { CreateBusinessInput, EnabledModules } from "../types/business.types";
import { DEFAULT_ENABLED_MODULES_LIST, MODULE_LABELS, ROLE_MODULE_KEYS, FEATURE_MODULE_KEYS } from "../constants/modules.constants";

interface Props {
  open: boolean;
  plans: AiChatPlan[];
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: CreateBusinessInput) => void;
}

interface FormValues extends Omit<CreateBusinessInput, "enabled_modules"> {
  role_modules_selected?: string[];
  feature_modules_selected?: string[];
}

const DEFAULT_ROLE_MODULES = DEFAULT_ENABLED_MODULES_LIST.filter((key) => ROLE_MODULE_KEYS.includes(key));
const DEFAULT_FEATURE_MODULES = DEFAULT_ENABLED_MODULES_LIST.filter((key) => FEATURE_MODULE_KEYS.includes(key));

export function BusinessModal({ open, plans, saving, form, onClose, onSubmit }: Props) {
  const selectedFeatureModules = Form.useWatch("feature_modules_selected", form) as string[] | undefined;
  const aiChatEnabled = (selectedFeatureModules ?? DEFAULT_FEATURE_MODULES).includes("aiChat");

  const handleFinish = (values: FormValues) => {
    const { role_modules_selected, feature_modules_selected, ...rest } = values;
    const selected = [...(role_modules_selected ?? []), ...(feature_modules_selected ?? [])];
    const enabled_modules = Object.fromEntries(
      [...ROLE_MODULE_KEYS, ...FEATURE_MODULE_KEYS].map((key) => [key, selected.includes(key)]),
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
          Roles disponibles para este negocio
        </Divider>

        <Form.Item name="role_modules_selected" initialValue={DEFAULT_ROLE_MODULES}>
          <Checkbox.Group
            className="flex flex-col gap-2"
            options={ROLE_MODULE_KEYS.map((key) => ({ label: MODULE_LABELS[key], value: key }))}
          />
        </Form.Item>

        <Divider orientation="left" plain>
          Otros módulos habilitados
        </Divider>

        <Form.Item name="feature_modules_selected" initialValue={DEFAULT_FEATURE_MODULES}>
          <Checkbox.Group
            className="flex flex-col gap-2"
            options={FEATURE_MODULE_KEYS.map((key) => ({ label: MODULE_LABELS[key], value: key }))}
          />
        </Form.Item>

        {aiChatEnabled && (
          <Form.Item
            label="Plan Chat IA"
            name="ai_chat_plan_id"
            extra="Plan que usa este negocio para el asistente de Chat IA."
          >
            <Select
              placeholder="Elegir un plan"
              options={plans.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
        )}

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
