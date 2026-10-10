export interface POItem {
  id: string;
  itemNo: string;
  materialNo: string;
  materialDesc: string;
  materialGroup: string;
  materialGroupDesc: string;
  qty: number;
  unit: string;
  grossPrice: number;
  totalValue: number;
  unloadingPoint?: string;
  deliveryDate?: string;
  packingCharges?: number;
  forwardingCharges?: number;
  delDays?: number;
  umc?: string;
  drawingNo?: string;
  partNo?: string;
  modelNo?: string;
  make?: string;
}

export interface PO {
  id: string;
  orderNo: string;
  companyName: string;
  location: string;
  orderDate: string;
  releaseDate: string;
  validityStart?: string;
  validityEnd?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  vendorCode: string;
  vendorName: string;
  vendorEmail?: string;
  vendorPhone?: string;
  items: POItem[];
  totalOrderValue: number;
  currency: string;
  paymentTerm: string;
  deliveryTerms: string;
  logisticsPartner?: string;
  status: 'Released' | 'In Production' | 'Dispatched' | 'Delivered' | 'Delayed' | 'Preponement of Delivery Schedule';
  dispatchedDate?: string;
  etaDate?: string;
  trackingNumber?: string;
  complianceChecked: boolean;
  complianceRating?: number; // 0 to 100
  liquidatedDamagesClause?: string;
  notes?: string;
  aiInsights?: string;
}

export interface SystemAlert {
  id: string;
  poId: string;
  poNo: string;
  type: 'dispatch_due' | 'unloading_delay' | 'compliance_issue' | 'ld_risk' | 'eta_warning';
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'info';
  date: string;
  read: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  connected: boolean;
}
