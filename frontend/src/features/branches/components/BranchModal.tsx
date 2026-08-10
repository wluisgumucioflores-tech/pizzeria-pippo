"use client";

import { Modal, Form, Input, Button, TimePicker } from "antd";
import type { FormInstance } from "antd";
import type { Dayjs } from "dayjs";
import { useTranslations } from "next-intl";
import type { Branch } from "../types/branch.types";

interface Props {
  open: boolean;
  editing: Branch | null;
  saving: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { name: string; address?: string; phone?: string; expected_start_time?: Dayjs }) => void;
}

export function BranchModal({ open, editing, saving, form, onClose, onSubmit }: Props) {
  const t = useTranslations("common");
  const tb = useTranslations("branches.modal");

  return (
    <Modal
      title={editing ? tb("editTitle") : tb("createTitle")}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Form.Item label={tb("name")} name="name" rules={[{ required: true, message: tb("nameRequired") }]}>
          <Input placeholder={tb("namePlaceholder")} />
        </Form.Item>
        <Form.Item label={tb("address")} name="address">
          <Input placeholder={tb("addressPlaceholder")} />
        </Form.Item>
        <Form.Item label={tb("phone")} name="phone">
          <Input placeholder={tb("phonePlaceholder")} />
        </Form.Item>
        <Form.Item
          label={tb("startTime")}
          name="expected_start_time"
          extra={tb("startTimeHint")}
        >
          <TimePicker format="HH:mm" style={{ width: "100%" }} placeholder={tb("startTimePlaceholder")} />
        </Form.Item>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {editing ? tb("saveChanges") : tb("create")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
