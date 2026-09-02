"use client";

import { Modal, Form, Input, Button, Switch, Select } from "antd";
import type { FormInstance } from "antd";
import { AI_MODEL_PROVIDERS } from "@pippo/shared";
import type { AiModel, CreateAiModelInput, UpdateAiModelInput } from "../types/aiModel.types";

interface Props {
  open: boolean;
  editing: AiModel | null;
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: CreateAiModelInput & UpdateAiModelInput) => void;
}

const PROVIDER_OPTIONS = Object.entries(AI_MODEL_PROVIDERS).map(([value, { label }]) => ({ value, label }));

export function AiModelModal({ open, editing, saving, form, onClose, onSubmit }: Props) {
  return (
    <Modal title={editing ? "Editar modelo" : "Nuevo modelo"} open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item
          label="Proveedor"
          name="provider"
          extra="DeepSeek, Qwen/DashScope, Groq y similares van en 'Compatible con OpenAI' con su propia Base URL."
          rules={[{ required: true, message: "Elegí el proveedor" }]}
        >
          <Select placeholder="Elegir proveedor" options={PROVIDER_OPTIONS} />
        </Form.Item>
        <Form.Item
          label="ID del modelo"
          name="model_id"
          extra="El id real que se le pasa al proveedor (ej. qwen3:8b, claude-haiku-4-5-20251001)."
          rules={[{ required: true, message: "Ingresá el id del modelo" }]}
        >
          <Input placeholder="Ej: qwen3:8b" />
        </Form.Item>
        <Form.Item label="Nombre visible" name="label" rules={[{ required: true, message: "Ingresá un nombre visible" }]}>
          <Input placeholder="Ej: Qwen 3 8B (local)" />
        </Form.Item>
        <Form.Item
          label="Base URL"
          name="base_url"
          extra="Requerido para local/openai-compatible. Vacío en Anthropic. NO incluir /v1/chat/completions ni /v1 al final — el servicio se lo agrega solo (ej. DashScope: https://dashscope-intl.aliyuncs.com/compatible-mode, no .../compatible-mode/v1)."
        >
          <Input placeholder="Ej: http://localhost:11434" />
        </Form.Item>
        <Form.Item
          label="API key"
          name="api_key"
          extra={
            editing?.has_api_key
              ? "Ya hay una key guardada. Dejar vacío para no cambiarla, o ingresar una nueva para reemplazarla."
              : "Requerida para proveedores cloud (Anthropic, OpenAI-compatible). Se guarda cifrada, nunca se vuelve a mostrar."
          }
        >
          <Input.Password placeholder={editing?.has_api_key ? "••••••••" : "sk-..."} autoComplete="off" />
        </Form.Item>
        <Form.Item label="Es local" name="is_local" valuePropName="checked">
          <Switch />
        </Form.Item>
        {editing && (
          <Form.Item label="Activo" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
        <Form.Item label="Modelo por defecto" name="is_default" valuePropName="checked" extra="Se usa cuando un plan no tiene un modelo propio asignado.">
          <Switch />
        </Form.Item>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? "Guardar cambios" : "Crear modelo"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
