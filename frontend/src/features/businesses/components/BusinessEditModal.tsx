"use client";

import { Modal, Form, Input, Button, Checkbox, Select } from "antd";
import type { FormInstance } from "antd";
import type { AiChatPlan } from "@/features/ai-chat-plans/types/aiChatPlan.types";
import type { Business, EnabledModules, UpdateBusinessInput } from "../types/business.types";
import { BUSINESS_MODULE_KEYS, MODULE_LABELS } from "../constants/modules.constants";

interface Props {
  business: Business | null;
  plans: AiChatPlan[];
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: UpdateBusinessInput) => void;
}

interface FormValues {
  name: string;
  enabled_modules_selected?: string[];
  ai_chat_plan_id?: string;
}

export function BusinessEditModal({ business, plans, saving, form, onClose, onSubmit }: Props) {
  const selectedModules = Form.useWatch("enabled_modules_selected", form) as string[] | undefined;
  const aiChatEnabled = (selectedModules ?? []).includes("aiChat");

  const handleFinish = (values: FormValues) => {
    const enabled_modules = Object.fromEntries(
      BUSINESS_MODULE_KEYS.map((key) => [key, (values.enabled_modules_selected ?? []).includes(key)]),
    ) as Partial<EnabledModules>;
    onSubmit({ name: values.name, enabled_modules, ai_chat_plan_id: values.ai_chat_plan_id });
  };

  return (
    <Modal title="Editar negocio" open={!!business} onCancel={onClose} footer={null} destroyOnHidden>
      {business && (
        <Form form={form} layout="vertical" onFinish={handleFinish} className="mt-4">
          <Form.Item label="Nombre del negocio" name="name" rules={[{ required: true, message: "Ingresá el nombre del negocio" }]}>
            <Input placeholder="Ej: Burger House" />
          </Form.Item>

          <Form.Item label="Módulos habilitados" name="enabled_modules_selected">
            <Checkbox.Group
              className="flex flex-col gap-2"
              options={BUSINESS_MODULE_KEYS.map((key) => ({ label: MODULE_LABELS[key], value: key }))}
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
              Guardar cambios
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
