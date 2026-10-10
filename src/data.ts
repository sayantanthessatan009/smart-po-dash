import { PO, SystemAlert } from './types.js';
import realPOs from '../pos-db.json';

// Use real Purchase Orders from the primary database (zero mock/demo data)
export const INITIAL_POS: PO[] = (realPOs as PO[]).map(po => ({
  ...po,
  id: po.id || (po.orderNo ? po.orderNo.replace(/[^a-zA-Z0-9]/g, '_') : `po_${Date.now()}`),
  status: po.status || 'Released',
  items: (po.items || []).map((it, idx) => ({
    ...it,
    id: it.id || `parsed_it_${it.itemNo || idx + 1}_${Date.now()}`,
    qty: Number(it.qty) || 1,
    grossPrice: Number(it.grossPrice) || 0,
    totalValue: Number(it.totalValue) || ((Number(it.qty) || 1) * (Number(it.grossPrice) || 0))
  }))
}));

// Dynamically generate real operational alerts from actual PO contract parameters
export function generateRealAlertsFromPOs(pos: PO[]): SystemAlert[] {
  const alerts: SystemAlert[] = [];
  const today = new Date().toISOString().split('T')[0];

  pos.forEach((po, index) => {
    // 1. Check expired or nearing validity
    if (po.validityEnd && po.validityEnd < today && po.status !== 'Delivered') {
      alerts.push({
        id: `alert_val_${po.id}`,
        poId: po.id,
        poNo: po.orderNo,
        type: 'ld_risk',
        title: 'Contract Validity Amendment Required',
        message: `PO validity ended on ${po.validityEnd}. Contract delivery is scheduled for plant ${po.location}. Request commercial validity amendment to prevent works gate pass rejection.`,
        severity: 'high',
        date: po.validityEnd,
        read: false
      });
    }

    // 2. Dispatched transit alerts
    if (po.status === 'Dispatched') {
      alerts.push({
        id: `alert_disp_${po.id}`,
        poId: po.id,
        poNo: po.orderNo,
        type: 'dispatch_due',
        title: 'Shipment in Transit via 3PL',
        message: `Material is in transit via ${po.logisticsPartner || 'TATA 3PL Express'}. Destination: ${po.location}. Verify packaging certificates and entry pass.`,
        severity: 'info',
        date: po.dispatchedDate || po.orderDate,
        read: true
      });
    }

    // 3. Technical Drawing / Compliance verification
    const drawingItem = (po.items || []).find(it => it.drawingNo && it.drawingNo.trim().length > 0);
    if (drawingItem && po.status === 'Released' && alerts.length < 8) {
      alerts.push({
        id: `alert_drw_${po.id}_${index}`,
        poId: po.id,
        poNo: po.orderNo,
        type: 'compliance_issue',
        title: `Drawing Verification: ${drawingItem.drawingNo}`,
        message: `Item #${drawingItem.itemNo} (${drawingItem.materialDesc.slice(0, 45)}) requires drawing approval sign-off (${drawingItem.drawingNo}) with requisitioner ${po.contactPerson}.`,
        severity: 'medium',
        date: po.orderDate,
        read: false
      });
    }
  });

  return alerts.slice(0, 6);
}

export const INITIAL_ALERTS: SystemAlert[] = generateRealAlertsFromPOs(INITIAL_POS);
