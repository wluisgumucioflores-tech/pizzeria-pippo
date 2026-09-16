"use client";

import { AnnouncementsTable } from "@/features/announcements/components/AnnouncementsTable";
import { AnnouncementModal } from "@/features/announcements/components/AnnouncementModal";
import { useAnnouncements } from "@/features/announcements/hooks/useAnnouncements";

export default function AnnouncementsPage() {
  const {
    announcements, businesses, loading, saving, modalOpen, editing, form,
    openCreate, openEdit, closeModal, handleSubmit, handleDelete,
  } = useAnnouncements();

  return (
    <>
      <AnnouncementsTable
        announcements={announcements}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <AnnouncementModal
        open={modalOpen}
        saving={saving}
        editing={editing}
        businesses={businesses}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </>
  );
}
