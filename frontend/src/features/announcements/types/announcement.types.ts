export interface Announcement {
  business_id: string;
  business_name: string;
  message: string;
  is_active: boolean;
  updated_at: string;
}

export interface UpsertAnnouncementInput {
  message: string;
  is_active?: boolean;
}
