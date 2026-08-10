"use client";

import { Modal, Form, Input, Select, Switch, DatePicker, Row, Col, Checkbox } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import { PromotionRules } from "./PromotionRules";
import { getTypeOptions, getDays } from "../constants/promotion.constants";
import type { Promotion, Branch, Variant, Rule } from "../types/promotion.types";

interface Props {
  open: boolean;
  editing: Promotion | null;
  branches: Branch[];
  variants: Variant[];
  promoType: string;
  rules: Rule[];
  form: FormInstance;
  onClose: () => void;
  onSave: () => void;
  onTypeChange: (type: string) => void;
  onAddRule: () => void;
  onUpdateRule: (index: number, field: keyof Rule, value: unknown) => void;
  onRemoveRule: (index: number) => void;
}

export function PromotionModal({ open, editing, branches, variants, promoType, rules, form, onClose, onSave, onTypeChange, onAddRule, onUpdateRule, onRemoveRule }: Props) {
  const t = useTranslations("common");
  const tp = useTranslations("promotions");
  const tm = useTranslations("promotions.modal");
  const TYPE_OPTIONS = getTypeOptions(tp);
  const DAYS = getDays(tp);
  const ALL_DAYS = DAYS.map((d) => d.value);
  const selectedDays: number[] = Form.useWatch("days_of_week", form) ?? [];
  const allDaysSelected = ALL_DAYS.every((d) => selectedDays.includes(d));

  const handleAllDaysToggle = (checked: boolean) => {
    form.setFieldValue("days_of_week", checked ? ALL_DAYS : []);
  };

  return (
    <Modal
      title={editing ? tm("editTitle") : tm("createTitle")}
      open={open}
      onCancel={onClose}
      onOk={onSave}
      okText={editing ? tm("saveChanges") : tm("createAction")}
      cancelText={t("cancel")}
      width={promoType ? "min(960px, 95vw)" : "min(620px, 95vw)"}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Left column — general fields */}
          <div className="w-full md:w-[300px] md:flex-none">
            <Form.Item label={tm("name")} name="name" rules={[{ required: true, message: tm("required") }]}>
              <Input placeholder={tm("namePlaceholder")} />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} sm={16}>
                <Form.Item label={tm("type")} name="type" rules={[{ required: true, message: tm("required") }]}>
                  <Select options={TYPE_OPTIONS} placeholder={tm("typePlaceholder")} onChange={onTypeChange} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label={tm("active")} name="active" valuePropName="checked" initialValue={true}>
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label={tm("branch")} name="branch_id" initialValue="all">
              <Select options={[{ value: "all", label: tp("allBranches") }, ...branches.map((b) => ({ value: b.id, label: b.name }))]} />
            </Form.Item>
            <Form.Item
              label={
                <span className="flex items-center gap-3">
                  {tm("daysOfWeekLabel")}
                  <Checkbox checked={allDaysSelected} onChange={(e) => handleAllDaysToggle(e.target.checked)}>
                    {tm("allDaysToggle")}
                  </Checkbox>
                </span>
              }
              name="days_of_week"
            >
              <Select mode="multiple" options={DAYS.map((d) => ({ value: d.value, label: d.label }))} placeholder={tm("daysPlaceholder")} />
            </Form.Item>
            <Form.Item label={tm("validity")} name="dates" rules={[{ required: true, message: tm("required") }]}>
              <DatePicker.RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>

          {/* Right column — rules (only when type is selected) */}
          {promoType && (
            <div className="w-full flex-1 min-w-0 max-h-[480px] overflow-y-auto pt-4 border-t border-gray-100 md:pt-0 md:border-t-0 md:border-l md:pl-6">
              <PromotionRules
                promoType={promoType}
                rules={rules}
                variants={variants}
                onAdd={onAddRule}
                onUpdate={onUpdateRule}
                onRemove={onRemoveRule}
              />
            </div>
          )}
        </div>
      </Form>
    </Modal>
  );
}
