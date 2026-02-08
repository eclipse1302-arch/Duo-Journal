import { supabase } from './supabase';
import type { JournalEntry, PartnerRequest, PartnerRequestWithProfiles, Profile } from '../types';

// ── Profile ──────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase().trim())
    .single();
  return data;
}

export async function createProfile(
  userId: string,
  username: string,
  displayName: string,
  avatar: string
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: username.toLowerCase().trim(),
      display_name: displayName,
      avatar,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Journal Entries ──────────────────────────────────────

export async function getEntries(userId: string): Promise<JournalEntry[]> {
  const { data } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  return data || [];
}

export async function getEntryByDate(
  userId: string,
  date: string
): Promise<JournalEntry | null> {
  const { data } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  return data;
}

export async function saveEntry(
  userId: string,
  date: string,
  content: string
): Promise<JournalEntry> {
  const existing = await getEntryByDate(userId, date);

  if (existing) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, date, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);
  if (error) throw error;
}

export async function getEntriesForMonth(
  userId: string,
  year: number,
  month: number
): Promise<Set<string>> {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endMonth = month === 11 ? 1 : month + 2;
  const endYear = month === 11 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data } = await supabase
    .from('journal_entries')
    .select('date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lt('date', endDate)
    .neq('content', '');

  return new Set((data || []).map((e) => e.date));
}

export async function getEntryCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('content', '');
  return count ?? 0;
}

// ── Partner Requests ─────────────────────────────────────

export async function getActivePartner(
  userId: string
): Promise<{ request: PartnerRequest; partner: Profile } | null> {
  const { data } = await supabase
    .from('partner_requests')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .in('status', ['accepted', 'break_pending'])
    .maybeSingle();

  if (!data) return null;

  const partnerId = data.from_user_id === userId ? data.to_user_id : data.from_user_id;
  const partner = await getProfile(partnerId);
  if (!partner) return null;

  return { request: data as PartnerRequest, partner };
}

export async function getPendingIncomingRequests(
  userId: string
): Promise<PartnerRequestWithProfiles[]> {
  const { data } = await supabase
    .from('partner_requests')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) return [];

  const results: PartnerRequestWithProfiles[] = [];
  for (const req of data) {
    const fromProfile = await getProfile(req.from_user_id);
    const toProfile = await getProfile(req.to_user_id);
    if (fromProfile && toProfile) {
      results.push({ ...(req as PartnerRequest), from_profile: fromProfile, to_profile: toProfile });
    }
  }
  return results;
}

export async function getSentPendingRequests(
  userId: string
): Promise<PartnerRequestWithProfiles[]> {
  const { data } = await supabase
    .from('partner_requests')
    .select('*')
    .eq('from_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) return [];

  const results: PartnerRequestWithProfiles[] = [];
  for (const req of data) {
    const fromProfile = await getProfile(req.from_user_id);
    const toProfile = await getProfile(req.to_user_id);
    if (fromProfile && toProfile) {
      results.push({ ...(req as PartnerRequest), from_profile: fromProfile, to_profile: toProfile });
    }
  }
  return results;
}

export async function sendPartnerRequest(
  fromUserId: string,
  toUsername: string
): Promise<void> {
  const toProfile = await getProfileByUsername(toUsername);
  if (!toProfile) throw new Error('User not found. Please check the username.');
  if (toProfile.id === fromUserId)
    throw new Error('You cannot send a request to yourself.');

  // Check for existing connection or pending request
  const { data: existing } = await supabase
    .from('partner_requests')
    .select('id, status')
    .or(
      `and(from_user_id.eq.${fromUserId},to_user_id.eq.${toProfile.id}),and(from_user_id.eq.${toProfile.id},to_user_id.eq.${fromUserId})`
    );

  if (existing && existing.length > 0) {
    const statuses = existing.map((e) => e.status);
    if (statuses.includes('accepted') || statuses.includes('break_pending'))
      throw new Error('You already have an active connection with this user.');
    if (statuses.includes('pending'))
      throw new Error('A request is already pending with this user.');
  }

  // Also check if either user already has an active partner
  const myPartner = await getActivePartner(fromUserId);
  if (myPartner) throw new Error('You already have an active partner. Disconnect first.');

  const theirPartner = await getActivePartner(toProfile.id);
  if (theirPartner) throw new Error('This user already has an active partner.');

  const { error } = await supabase.from('partner_requests').insert({
    from_user_id: fromUserId,
    to_user_id: toProfile.id,
    status: 'pending',
  });
  if (error) throw error;
}

export async function acceptRequest(requestId: string): Promise<void> {
  // Before accepting, check if the accepting user already has an active partner
  const { data: request } = await supabase
    .from('partner_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!request) throw new Error('Request not found.');

  const myPartner = await getActivePartner(request.to_user_id);
  if (myPartner) throw new Error('You already have an active partner.');

  const theirPartner = await getActivePartner(request.from_user_id);
  if (theirPartner) throw new Error('The other user already has an active partner.');

  const { error } = await supabase
    .from('partner_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

export async function rejectRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
}

export async function requestBreakLink(
  requestId: string,
  requesterId: string
): Promise<void> {
  const { error } = await supabase
    .from('partner_requests')
    .update({
      status: 'break_pending',
      break_requester_id: requesterId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (error) throw error;
}

export async function confirmBreakLink(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
}

export async function cancelBreakLink(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_requests')
    .update({
      status: 'accepted',
      break_requester_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (error) throw error;
}
