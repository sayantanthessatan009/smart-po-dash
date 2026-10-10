import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PO } from '../types';

let supabaseInstance: SupabaseClient | null = null;
let dynamicUrl: string | null = null;
let dynamicAnonKey: string | null = null;

// Dynamically set credentials at runtime from server
export function setSupabaseCredentials(url: string, anonKey: string) {
  if (url && anonKey) {
    dynamicUrl = url.trim();
    dynamicAnonKey = anonKey.trim();
    // Reset instance to force re-creation with correct credentials
    supabaseInstance = null;
  }
}

export function saveSupabaseCredentialsToLocalStorage(url: string, anonKey: string) {
  try {
    localStorage.setItem('tata_supabase_url', url.trim());
    localStorage.setItem('tata_supabase_anon_key', anonKey.trim());
    dynamicUrl = url.trim();
    dynamicAnonKey = anonKey.trim();
    supabaseInstance = null; // force re-creation
  } catch (e) {
    console.error('Failed to save Supabase credentials to localStorage:', e);
  }
}

export function clearSupabaseCredentialsFromLocalStorage() {
  try {
    localStorage.removeItem('tata_supabase_url');
    localStorage.removeItem('tata_supabase_anon_key');
    dynamicUrl = null;
    dynamicAnonKey = null;
    supabaseInstance = null;
  } catch (e) {
    console.error('Failed to clear Supabase credentials from localStorage:', e);
  }
}

function isValidCredential(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  return s !== '' && s !== 'undefined' && s !== 'null';
}

// Get Supabase Client Lazily to prevent startup crash if keys are not ready yet
export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  let url = dynamicUrl;
  let anonKey = dynamicAnonKey;

  // Try localStorage if dynamic variables aren't set
  if (!isValidCredential(url) || !isValidCredential(anonKey)) {
    try {
      url = localStorage.getItem('tata_supabase_url');
      anonKey = localStorage.getItem('tata_supabase_anon_key');
    } catch (e) {
      // Ignore
    }
  }

  // Fallback to bundler environment variables
  if (!isValidCredential(url)) {
    try {
      url = (import.meta as any).env?.VITE_SUPABASE_URL;
    } catch (e) {}
  }
  if (!isValidCredential(anonKey)) {
    try {
      anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    } catch (e) {}
  }

  if (!isValidCredential(url) || !isValidCredential(anonKey)) {
    return null;
  }

  try {
    const cleanUrl = String(url).trim();
    const cleanKey = String(anonKey).trim();
    supabaseInstance = createClient(cleanUrl, cleanKey);
    return supabaseInstance;
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Check configuration status safely
export function isSupabaseConfigured(): boolean {
  let url = dynamicUrl;
  let anonKey = dynamicAnonKey;

  if (!isValidCredential(url) || !isValidCredential(anonKey)) {
    try {
      url = localStorage.getItem('tata_supabase_url');
      anonKey = localStorage.getItem('tata_supabase_anon_key');
    } catch (e) {
      // Ignore
    }
  }

  if (!isValidCredential(url)) {
    try {
      url = (import.meta as any).env?.VITE_SUPABASE_URL;
    } catch (e) {}
  }
  if (!isValidCredential(anonKey)) {
    try {
      anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    } catch (e) {}
  }

  return isValidCredential(url) && isValidCredential(anonKey);
}

// Sync POs to Supabase if configured (as a background utility)
export async function syncPOToSupabase(po: PO): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase client is not initialized.' };

  try {
    // Attempt upsert operation in case table is provisioned: 'purchase_orders'
    const { data, error } = await supabase
      .from('purchase_orders')
      .upsert({
        id: po.id,
        order_no: po.orderNo || '',
        company_name: po.companyName || 'TATA STEEL LIMITED',
        location: po.location || 'Jamshedpur',
        order_date: po.orderDate || null,
        release_date: po.releaseDate || null,
        validity_start: po.validityStart || null,
        validity_end: po.validityEnd || null,
        contact_person: po.contactPerson || null,
        contact_email: po.contactEmail || null,
        contact_phone: po.contactPhone || null,
        vendor_code: po.vendorCode || null,
        vendor_name: po.vendorName || null,
        vendor_email: po.vendorEmail || null,
        vendor_phone: po.vendorPhone || null,
        total_value: po.totalOrderValue !== undefined && po.totalOrderValue !== null ? Number(po.totalOrderValue) : 0,
        currency: po.currency || 'INR',
        payment_term: po.paymentTerm || null,
        delivery_terms: po.deliveryTerms || null,
        logistics_partner: po.logisticsPartner || null,
        status: po.status || 'Released',
        dispatched_date: po.dispatchedDate || null,
        eta_date: po.etaDate || null,
        tracking_number: po.trackingNumber || null,
        compliance_checked: po.complianceChecked ?? true,
        compliance_rating: po.complianceRating !== undefined && po.complianceRating !== null ? Number(po.complianceRating) : 85,
        liquidated_damages_clause: po.liquidatedDamagesClause || null,
        notes: po.notes || null,
        ai_insights: po.aiInsights || null,
        items: po.items ? JSON.stringify(po.items) : '[]',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('Supabase upsert warning (Ensure "purchase_orders" table exists):', error.message);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { 
        success: false, 
        error: 'Row Level Security (RLS) is active on "purchase_orders" but no insert/update policies allow this write. Please run "ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;" in your Supabase SQL editor to allow sync.' 
      };
    }

    return { success: true };
  } catch (e: any) {
    console.error('Supabase sync exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

// Fetch all POs from Supabase if configured
export async function fetchPOsFromSupabase(): Promise<PO[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (error) {
      console.warn('Supabase fetch failure on "purchase_orders":', error.message);
      return [];
    }

    if (data) {
      return data.map((d: any) => ({
        id: d.id,
        orderNo: d.order_no || '',
        companyName: d.company_name || 'TATA STEEL LIMITED',
        location: d.location || 'Jamshedpur',
        orderDate: d.order_date || '',
        releaseDate: d.release_date || '',
        validityStart: d.validity_start || undefined,
        validityEnd: d.validity_end || undefined,
        contactPerson: d.contact_person || 'Procurement Officer',
        contactEmail: d.contact_email || 'procurement@tatasteel.com',
        contactPhone: d.contact_phone || undefined,
        vendorCode: d.vendor_code || '',
        vendorName: d.vendor_name || '',
        vendorEmail: d.vendor_email || undefined,
        vendorPhone: d.vendor_phone || undefined,
        totalOrderValue: d.total_value !== null && d.total_value !== undefined ? Number(d.total_value) : 0,
        currency: d.currency || 'INR',
        paymentTerm: d.payment_term || '',
        deliveryTerms: d.delivery_terms || '',
        logisticsPartner: d.logistics_partner || undefined,
        status: d.status || 'Draft',
        dispatchedDate: d.dispatched_date || undefined,
        etaDate: d.eta_date || undefined,
        trackingNumber: d.tracking_number || undefined,
        complianceChecked: d.compliance_checked !== undefined && d.compliance_checked !== null ? d.compliance_checked : true,
        complianceRating: d.compliance_rating !== null && d.compliance_rating !== undefined ? Number(d.compliance_rating) : 85,
        liquidatedDamagesClause: d.liquidated_damages_clause || undefined,
        notes: d.notes || undefined,
        aiInsights: d.ai_insights || undefined,
        items: (() => {
          if (!d.items) return [];
          if (typeof d.items === 'string') {
            try {
              return JSON.parse(d.items);
            } catch (e) {
              console.error('Failed to parse items for PO:', d.id, e);
              return [];
            }
          }
          return Array.isArray(d.items) ? d.items : [];
        })(),
      }));
    }
  } catch (error) {
    console.error('Supabase get exception:', error);
  }
  return [];
}

// Sync multiple POs in a single batch upsert to Supabase
export async function syncAllPOsToSupabase(pos: PO[]): Promise<{ success: boolean; error?: string; count: number }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase client is not initialized.', count: 0 };

  if (!pos || pos.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    // Deduplicate POs by id, keeping the first occurrence in the array (most recent/unshifted)
    const seen = new Set<string>();
    const uniquePosList = pos.filter(po => {
      if (!po || !po.id) return false;
      if (seen.has(po.id)) return false;
      seen.add(po.id);
      return true;
    });

    const rows = uniquePosList.map(po => ({
      id: po.id,
      order_no: po.orderNo || '',
      company_name: po.companyName || 'TATA STEEL LIMITED',
      location: po.location || 'Jamshedpur',
      order_date: po.orderDate || null,
      release_date: po.releaseDate || null,
      validity_start: po.validityStart || null,
      validity_end: po.validityEnd || null,
      contact_person: po.contactPerson || null,
      contact_email: po.contactEmail || null,
      contact_phone: po.contactPhone || null,
      vendor_code: po.vendorCode || null,
      vendor_name: po.vendorName || null,
      vendor_email: po.vendorEmail || null,
      vendor_phone: po.vendorPhone || null,
      total_value: po.totalOrderValue !== undefined && po.totalOrderValue !== null ? Number(po.totalOrderValue) : 0,
      currency: po.currency || 'INR',
      payment_term: po.paymentTerm || null,
      delivery_terms: po.deliveryTerms || null,
      logistics_partner: po.logisticsPartner || null,
      status: po.status || 'Released',
      dispatched_date: po.dispatchedDate || null,
      eta_date: po.etaDate || null,
      tracking_number: po.trackingNumber || null,
      compliance_checked: po.complianceChecked ?? true,
      compliance_rating: po.complianceRating !== undefined && po.complianceRating !== null ? Number(po.complianceRating) : 85,
      liquidated_damages_clause: po.liquidatedDamagesClause || null,
      notes: po.notes || null,
      ai_insights: po.aiInsights || null,
      items: po.items ? JSON.stringify(po.items) : '[]',
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('purchase_orders')
      .upsert(rows, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('Supabase batch upsert warning:', error.message);
      return { success: false, error: error.message, count: 0 };
    }

    if (!data || data.length === 0) {
      return { 
        success: false, 
        error: 'Row Level Security (RLS) is active on "purchase_orders" but no insert/update policies allow this write. Please run "ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;" in your Supabase SQL editor.',
        count: 0 
      };
    }

    return { success: true, count: data.length };
  } catch (e: any) {
    console.error('Supabase batch sync exception:', e);
    return { success: false, error: e.message || String(e), count: 0 };
  }
}

// Delete PO from Supabase if configured
export async function deletePOFromSupabase(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete failure:', error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error('Supabase delete exception:', e);
    return false;
  }
}

