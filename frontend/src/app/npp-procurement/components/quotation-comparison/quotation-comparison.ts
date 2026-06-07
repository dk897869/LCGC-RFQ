import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { FormStatusBarComponent } from '../../../shared/form-status-bar/form-status-bar.component';
import { StatusModalComponent } from '../../../shared/status-modal/status-modal.component';

interface QuotationItem {
  sNo: number;
  partCode: string;
  partDescription: string;
  specification: string;
  uom: string;
  qty: number;
  supplier1Price: number;
  supplier1Amount: number;
  supplier2Price: number;
  supplier2Amount: number;
  supplier3Price: number;
  supplier3Amount: number;
}

interface QuotationTerms {
  gst: string;
  transport: string;
  leadTime: string;
  paymentTerms: string;
  attachment1: string;
  attachment2: string;
  attachment3: string;
}

@Component({
  selector: 'app-quotation-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule, FormStatusBarComponent, StatusModalComponent],
  templateUrl: './quotation-comparison.html',
  styleUrls: ['./quotation-comparison.scss']
})
export class QuotationComparisonComponent implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  rfqNo: string = '';
  requestDate: string = '';
  requesterName: string = '';
  requesterEmail: string = '';
  department: string = '';
  comparisonStatus: string = 'Draft';
  comparisonMode: 'auto' | 'manual' = 'auto';
  isLoadingComparison = false;
  showStatusModal = false;
  comparisonStatusLabel = 'Pending';

  supplier1Name: string = '';
  supplier2Name: string = '';
  supplier3Name: string = '';

  quotationItems: QuotationItem[] = [];

  terms1: QuotationTerms = {
    gst: 'Extra',
    transport: '999',
    leadTime: '',
    paymentTerms: '100% Against Proforma Invoice',
    attachment1: '',
    attachment2: '',
    attachment3: ''
  };

  terms2: QuotationTerms = {
    gst: 'Extra',
    transport: 'Extra',
    leadTime: '',
    paymentTerms: '100% Against Proforma Invoice',
    attachment1: '',
    attachment2: '',
    attachment3: ''
  };

  terms3: QuotationTerms = {
    gst: 'Extra',
    transport: '4000',
    leadTime: '',
    paymentTerms: '100% Against Proforma Invoice',
    attachment1: '',
    attachment2: '',
    attachment3: ''
  };

  recommendation: string = '';
  selectedSupplierIndex: 1 | 2 | 3 = 1;
  isSubmitting: boolean = false;
  submitSuccess: boolean = false;

  constructor(private authService: AuthService) {}
  conditionOptions = ['GST', 'Transport', 'Payment Terms', 'Lead Time', 'Attachment', 'Warranty', 'Delivery Location', 'Other'];
  conditionRows = [
    { label: 'GST', s1: 'Extra', s2: 'Extra', s3: 'Extra' },
    { label: 'Transport', s1: '999', s2: 'Extra', s3: '4000' },
    { label: 'Payment Terms', s1: '100% Against Proforma Invoice', s2: '100% Against Proforma Invoice', s3: '100% Against Proforma Invoice' },
    { label: 'Lead Time', s1: '', s2: '', s3: '' },
    { label: 'Attachment', s1: '', s2: '', s3: '' }
  ];

  ngOnInit(): void {
    const today = new Date();
    this.requestDate = today.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const user = this.authService.getUser();
    if (user) {
      this.requesterName = user.name || '';
      this.requesterEmail = user.email || '';
      this.department = user.department || '';
    }
    this.loadAutoComparison();
  }

  loadAutoComparison(): void {
    this.comparisonMode = 'auto';
    this.isLoadingComparison = true;
    this.authService.getPrComparison('latest').subscribe({
      next: (res: any) => {
        this.isLoadingComparison = false;
        const data = res?.items ? res : res?.data || res;
        if (data.rfqNo) this.rfqNo = data.rfqNo;
        if (data.items?.length) {
          this.mapComparisonToGrid(data.items);
          if (data.recommendedVendor?.vendorName) {
            this.recommendation = `It is recommended to place the order on M/s. ${data.recommendedVendor.vendorName}`;
          }
        } else {
          this.loadFromNppForms();
        }
      },
      error: () => {
        this.isLoadingComparison = false;
        this.loadFromNppForms();
      }
    });
  }

  private loadFromNppForms(): void {
    this.authService.searchNppForms({ type: 'quotation-comparison' }).subscribe({
      next: (res: any) => {
        const rows = res?.data || [];
        const doc = rows.find((r: any) => (r.quotationItems || r.data?.quotationItems)?.length) || rows[0];
        if (!doc) {
          this.loadFromQuotationSubmissions();
          return;
        }
        const data = doc.data || doc;
        const qItems = data.quotationItems || [];
        if (qItems.length) {
          this.supplier1Name = data.supplierNames?.[0] || data.suppliers?.[0]?.name || 'Supplier 1';
          this.supplier2Name = data.supplierNames?.[1] || data.suppliers?.[1]?.name || 'Supplier 2';
          this.supplier3Name = data.supplierNames?.[2] || data.suppliers?.[2]?.name || 'Supplier 3';
          this.quotationItems = qItems.map((row: any, i: number) => ({
            sNo: i + 1,
            partCode: row.partCode || '',
            partDescription: row.partDescription || '',
            specification: row.specification || '',
            uom: row.uom || 'Nos',
            qty: Number(row.qty || 1),
            supplier1Price: Number(row.supplier1Price || 0),
            supplier1Amount: Number(row.supplier1Amount || 0),
            supplier2Price: Number(row.supplier2Price || 0),
            supplier2Amount: Number(row.supplier2Amount || 0),
            supplier3Price: Number(row.supplier3Price || 0),
            supplier3Amount: Number(row.supplier3Amount || 0)
          }));
          if (data.rfqNo || doc.rfqNo) this.rfqNo = data.rfqNo || doc.rfqNo;
          this.updateRecommendation();
          return;
        }
        this.loadFromQuotationSubmissions();
      },
      error: () => this.loadFromQuotationSubmissions()
    });
  }

  private loadFromQuotationSubmissions(): void {
    this.authService.searchNppForms({ type: 'quotation-submission' }).subscribe({
      next: (res: any) => {
        const rows = res?.data || [];
        if (!rows.length) {
          this.resetComparisonEmpty();
          return;
        }
        const vendorMap: Record<string, Record<string, { price: number; qty: number }>> = {};
        const vendorOrder: string[] = [];
        rows.forEach((doc: any) => {
          const data = doc.data || doc;
          (data.quotationSubmissionItems || data.items || []).forEach((row: any) => {
            const vendorName = (row.vendorName || '').trim();
            if (!vendorName) return;
            if (!vendorOrder.includes(vendorName)) vendorOrder.push(vendorName);
            const key = row.partCode || row.partDescription || 'item';
            if (!vendorMap[key]) vendorMap[key] = {};
            vendorMap[key][vendorName] = {
              price: Number(row.unitPrice || 0),
              qty: Number(row.qty || 1)
            };
          });
        });
        const vendors = vendorOrder.slice(0, 3);
        this.supplier1Name = vendors[0] || '';
        this.supplier2Name = vendors[1] || '';
        this.supplier3Name = vendors[2] || '';
        this.quotationItems = Object.entries(vendorMap).map(([key, vendorPrices], i) => {
          const first = Object.values(vendorPrices)[0];
          const qty = first?.qty || 1;
          const p1 = vendors[0] ? vendorPrices[vendors[0]]?.price || 0 : 0;
          const p2 = vendors[1] ? vendorPrices[vendors[1]]?.price || 0 : 0;
          const p3 = vendors[2] ? vendorPrices[vendors[2]]?.price || 0 : 0;
          return {
            sNo: i + 1,
            partCode: key,
            partDescription: key,
            specification: '',
            uom: 'Nos',
            qty,
            supplier1Price: p1, supplier1Amount: p1 * qty,
            supplier2Price: p2, supplier2Amount: p2 * qty,
            supplier3Price: p3, supplier3Amount: p3 * qty
          };
        });
        if (!this.quotationItems.length) {
          this.resetComparisonEmpty();
          return;
        }
        this.updateRecommendation();
      },
      error: () => this.resetComparisonEmpty()
    });
  }

  private resetComparisonEmpty(): void {
    this.supplier1Name = '';
    this.supplier2Name = '';
    this.supplier3Name = '';
    this.quotationItems = [];
    this.recommendation = 'No vendor quotations found. Link an RFQ and add quotation submissions, or use Manual mode.';
    this.addRow();
  }

  private mapComparisonToGrid(items: any[]): void {
    const vendorSet = new Set<string>();
    items.forEach(item => (item.suppliers || []).forEach((s: any) => vendorSet.add(s.vendorName)));
    const vendors = Array.from(vendorSet);
    this.supplier1Name = vendors[0] || 'Supplier 1';
    this.supplier2Name = vendors[1] || 'Supplier 2';
    this.supplier3Name = vendors[2] || 'Supplier 3';

    this.quotationItems = items.map((item, i) => {
      const s1 = item.suppliers?.[0] || {};
      const s2 = item.suppliers?.[1] || {};
      const s3 = item.suppliers?.[2] || {};
      const qty = Number(item.qty || 1);
      return {
        sNo: i + 1,
        partCode: item.partCode || '',
        partDescription: item.description || item.partDescription || '',
        specification: item.specification || '',
        uom: item.uom || 'Nos',
        qty,
        supplier1Price: Number(s1.price || 0),
        supplier1Amount: Number(s1.amount || qty * Number(s1.price || 0)),
        supplier2Price: Number(s2.price || 0),
        supplier2Amount: Number(s2.amount || qty * Number(s2.price || 0)),
        supplier3Price: Number(s3.price || 0),
        supplier3Amount: Number(s3.amount || qty * Number(s3.price || 0))
      };
    });
    this.updateRecommendation();
  }

  switchToManual(): void {
    this.comparisonMode = 'manual';
  }

  addRow(): void {
    this.quotationItems.push({
      sNo: this.quotationItems.length + 1,
      partCode: '',
      partDescription: '',
      specification: '',
      uom: '',
      qty: 1,
      supplier1Price: 0,
      supplier1Amount: 0,
      supplier2Price: 0,
      supplier2Amount: 0,
      supplier3Price: 0,
      supplier3Amount: 0
    });
  }

  removeRow(index: number): void {
    if (this.quotationItems.length > 1) {
      this.quotationItems.splice(index, 1);
      this.quotationItems.forEach((item, i) => { item.sNo = i + 1; });
    }
  }

  calcAmounts(item: QuotationItem): void {
    item.supplier1Amount = Number(item.qty) * Number(item.supplier1Price);
    item.supplier2Amount = Number(item.qty) * Number(item.supplier2Price);
    item.supplier3Amount = Number(item.qty) * Number(item.supplier3Price);
    this.updateRecommendation();
  }

  getTotals(): { t1: number; t2: number; t3: number } {
    const t1 = this.quotationItems.reduce((s, i) => s + i.supplier1Amount, 0);
    const t2 = this.quotationItems.reduce((s, i) => s + i.supplier2Amount, 0);
    const t3 = this.quotationItems.reduce((s, i) => s + i.supplier3Amount, 0);
    return { t1, t2, t3 };
  }

  getBestSupplier(): string {
    const { t1, t2, t3 } = this.getTotals();
    const entries = [
      { name: this.supplier1Name, total: t1 },
      { name: this.supplier2Name, total: t2 },
      { name: this.supplier3Name, total: t3 }
    ].filter(e => e.name && e.total > 0);
    if (!entries.length) return '—';
    const min = Math.min(...entries.map(e => e.total));
    return entries.find(e => e.total === min)?.name || '—';
  }

  getSelectedSupplier(): string {
    if (this.selectedSupplierIndex === 1) return this.supplier1Name || '—';
    if (this.selectedSupplierIndex === 2) return this.supplier2Name || '—';
    return this.supplier3Name || '—';
  }

  selectSupplier(index: 1 | 2 | 3): void {
    this.comparisonMode = 'manual';
    this.selectedSupplierIndex = index;
    this.updateRecommendation();
  }

  getSelectedVsBestMessage(): string {
    const best = this.getBestSupplier();
    const selected = this.getSelectedSupplier();
    if (selected === best) {
      return `${selected} is currently the lowest total cost vendor.`;
    }
    return `${best} provides the same requirement at a lower total price. Please review before final approval.`;
  }

  isBestSupplier(supplierIndex: 1 | 2 | 3): boolean {
    const { t1, t2, t3 } = this.getTotals();
    const min = Math.min(t1, t2, t3);
    if (supplierIndex === 1) return t1 === min;
    if (supplierIndex === 2) return t2 === min;
    return t3 === min;
  }

  getBestSupplierIndex(): 1 | 2 | 3 {
    const { t1, t2, t3 } = this.getTotals();
    const min = Math.min(t1, t2, t3);
    if (min === t1) return 1;
    if (min === t2) return 2;
    return 3;
  }

  isLowestItemPrice(item: QuotationItem, supplierIndex: 1 | 2 | 3): boolean {
    const prices = [item.supplier1Price, item.supplier2Price, item.supplier3Price].filter(v => Number(v) > 0);
    if (!prices.length) return false;
    const min = Math.min(...prices);
    if (supplierIndex === 1) return item.supplier1Price === min;
    if (supplierIndex === 2) return item.supplier2Price === min;
    return item.supplier3Price === min;
  }

  addConditionRow(): void {
    this.conditionRows.push({ label: 'Other', s1: '', s2: '', s3: '' });
  }

  saveDraft(): void {
    this.comparisonStatus = 'Draft';
    localStorage.setItem(`quotation_comparison_draft_${Date.now()}`, JSON.stringify(this.buildPayload()));
    this.submitSuccess = true;
    setTimeout(() => { this.submitSuccess = false; }, 2500);
  }

  getSavings(): string {
    const { t1, t2, t3 } = this.getTotals();
    const allAmounts = [t1, t2, t3].filter(v => v > 0);
    if (allAmounts.length < 2) return '0';
    const min = Math.min(...allAmounts);
    const max = Math.max(...allAmounts);
    return (max - min).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  updateRecommendation(): void {
    const best = this.getBestSupplier();
    const selected = this.getSelectedSupplier();
    if (best === '—') {
      this.recommendation = 'Add vendor quotations or switch to Manual mode to compare suppliers.';
      return;
    }
    if (!selected || selected === '—') {
      this.selectedSupplierIndex = this.getBestSupplierIndex();
    }
    const sel = this.getSelectedSupplier();
    this.recommendation = sel === best
      ? `It is recommended to place the order on M/s. ${best} based on lowest total cost.`
      : `Selected vendor is M/s. ${sel}, however M/s. ${best} provides the same requirement at a lower price.`;
  }

  submitQuotation(): void {
    this.isSubmitting = true;
    this.comparisonStatus = 'Submitted';
    const payload = this.buildPayload();
    console.log('Quotation Payload:', payload);
    setTimeout(() => {
      this.isSubmitting = false;
      this.submitSuccess = true;
      this.onSubmit.emit({
        success: true,
        serialNo: this.rfqNo || `QC-${Date.now()}`,
        type: 'quotation-comparison',
        data: payload
      });
      setTimeout(() => { this.submitSuccess = false; }, 4000);
    }, 1200);
  }

  private buildPayload(): any {
    return {
      rfqNo: this.rfqNo,
      requestDate: this.requestDate,
      requesterEmail: this.requesterEmail,
      status: this.comparisonStatus,
      comparisonMode: this.comparisonMode,
      suppliers: [
        { name: this.supplier1Name, terms: this.terms1 },
        { name: this.supplier2Name, terms: this.terms2 },
        { name: this.supplier3Name, terms: this.terms3 }
      ],
      quotationItems: this.quotationItems,
      totals: this.getTotals(),
      bestSupplier: this.getBestSupplier(),
      selectedSupplier: this.getSelectedSupplier(),
      selectedSupplierIndex: this.selectedSupplierIndex,
      vendorSuggestion: this.getSelectedVsBestMessage(),
      recommendation: this.recommendation,
      conditionRows: this.conditionRows
    };
  }
}
