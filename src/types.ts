export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'break_pending';
  break_requester_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerRequestWithProfiles extends PartnerRequest {
  from_profile: Profile;
  to_profile: Profile;
}

export const AVATAR_OPTIONS = ['🌸', '🌊', '🌺', '🌿', '🌙', '⭐', '🦋', '🌻', '🍃', '🔥', '💜', '🧸'];
