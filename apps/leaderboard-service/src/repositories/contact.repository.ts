import { SupabaseDatabase } from '../../../../shared/database/supabase.client';
import { ContactDto } from '../../../../shared/models/types';

export class ContactRepository {
  public async getContacts(): Promise<any[]> {
    const { data, error } = await SupabaseDatabase.client
      .from('contacts')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  public async createContact(dto: ContactDto): Promise<any> {
    const { data, error } = await SupabaseDatabase.client
      .from('contacts')
      .insert({
        name: dto.name,
        phone: dto.phone,
        designation: dto.designation,
        priority: dto.priority || 1,
        is_active: dto.isActive ?? true,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}
