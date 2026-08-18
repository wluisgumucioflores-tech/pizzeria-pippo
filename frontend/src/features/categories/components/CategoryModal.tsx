"use client";

import { useEffect } from "react";
import { Modal, Form, Input, Checkbox } from "antd";
import type { Category, CategoryInput } from "../types/category.types";

interface Props {
  open: boolean;
  editing: Category | null;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryInput) => Promise<void>;
}

export function CategoryModal({ open, editing, categories, saving, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<CategoryInput>();
  const hasOtherDefault = categories.some((c) => c.is_pizza && c.id !== editing?.id);

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        editing ? { name: editing.name, is_pizza: editing.is_pizza } : { name: "", is_pizza: false },
      );
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      title={editing ? "Editar categoría" : "Nueva categoría"}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      okText={editing ? "Guardar" : "Crear"}
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="Nombre"
          rules={[{ required: true, message: "Ingresá el nombre de la categoría" }]}
        >
          <Input placeholder="Ej: Postres" />
        </Form.Item>

        {!hasOtherDefault && (
          <Form.Item name="is_pizza" valuePropName="checked">
            <Checkbox>Categoría por defecto</Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
