"use client";

import { Modal, Form, Input, InputNumber, Button, Switch, Select } from "antd";
import type { FormInstance } from "antd";
import type { AiModel } from "@/features/ai-models/types/aiModel.types";
import type { AiChatPlan, CreateAiChatPlanInput, UpdateAiChatPlanInput } from "../types/aiChatPlan.types";

interface Props {
  open: boolean;
  editing: AiChatPlan | null;
  saving: boolean;
  form: FormInstance;
  models: AiModel[];
  onClose: () => void;
  onSubmit: (values: CreateAiChatPlanInput & UpdateAiChatPlanInput) => void;
}

export function AiChatPlanModal({ open, editing, saving, form, models, onClose, onSubmit }: Props) {
  return (
    <Modal title={editing ? "Editar plan" : "Nuevo plan"} open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item label="Nombre" name="name" rules={[{ required: true, message: "Ingresá el nombre del plan" }]}>
          <Input placeholder="Ej: Básico" />
        </Form.Item>
        <Form.Item
          label="Mensajes por día"
          name="messages_per_day"
          extra="Dejar vacío para un plan sin límite (ilimitado)."
        >
          <InputNumber min={1} style={{ width: "100%" }} placeholder="Ej: 20" />
        </Form.Item>
        <Form.Item
          label="Modelo de IA"
          name="model_id"
          extra="El modelo que usan los negocios de este plan. Sin selector en su panel — lo fija acá el superadmin."
        >
          <Select
            allowClear
            placeholder="Usar el modelo por defecto de la plataforma"
            options={models.map((m) => ({ value: m.id, label: `${m.label} (${m.provider})` }))}
          />
        </Form.Item>
        <Form.Item
          label="Escritura por chat habilitada"
          name="allowed_write_domains"
          extra="Además de consultar, en qué dominios el agente puede crear datos para los negocios de este plan."
        >
          <Select
            mode="multiple"
            placeholder="Ninguno (solo consulta)"
            options={[{ value: "stock", label: "Stock" }]}
          />
        </Form.Item>
        {editing && (
          <Form.Item label="Activo" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? "Guardar cambios" : "Crear plan"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
