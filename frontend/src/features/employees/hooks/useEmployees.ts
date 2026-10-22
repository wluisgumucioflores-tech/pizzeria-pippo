"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { EmployeesService } from "../services/employees.service";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { Branch } from "@/features/branches/types/branch.types";
import type { Employee, EmployeeCredential } from "../types/employee.types";

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [credential, setCredential] = useState<EmployeeCredential | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [employeeList, branchList] = await Promise.all([EmployeesService.getEmployees(), BranchesService.getBranches()]);
    setEmployees(employeeList);
    setBranches(branchList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (employee: Employee) => { setEditing(employee); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);
  const closeCredentialModal = () => setCredential(null);

  const handleSubmit = async (values: { branch_id: string; full_name: string; position: string }) => {
    setSaving(true);
    if (editing) {
      const result = await EmployeesService.updateEmployee(editing.id, values);
      if (result.ok) {
        message.success("Empleado actualizado");
        setModalOpen(false);
        load();
      } else {
        message.error(result.error ?? "Error al guardar");
      }
    } else {
      const result = await EmployeesService.createEmployee(values);
      if (result.ok && result.result) {
        setModalOpen(false);
        setCredential(result.result.credential);
        load();
      } else {
        message.error(result.error ?? "Error al crear el empleado");
      }
    }
    setSaving(false);
  };

  const handleToggleActive = async (employee: Employee) => {
    const result = await EmployeesService.toggleActive(employee.id, !employee.is_active);
    if (result.ok) {
      message.success(employee.is_active ? "Empleado desactivado" : "Empleado reactivado");
      load();
    } else {
      message.error(result.error ?? "Error al actualizar");
    }
  };

  const handleRegenerateCredential = async (employee: Employee) => {
    const result = await EmployeesService.regenerateCredential(employee.id);
    if (result.ok && result.result) {
      setCredential(result.result.credential);
    } else {
      message.error(result.error ?? "Error al regenerar la credencial");
    }
  };

  return {
    employees, branches, loading, saving,
    modalOpen, editing, credential,
    openCreate, openEdit, closeModal, closeCredentialModal,
    handleSubmit, handleToggleActive, handleRegenerateCredential,
    refetch: load,
  };
}
