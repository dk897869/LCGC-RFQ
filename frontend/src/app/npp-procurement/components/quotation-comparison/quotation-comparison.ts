import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './quotation-comparison.html',
  styleUrls: ['./quotation-comparison.scss']
})
export class QuotationComparisonComponent implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  rfqNo: string = '';
  requestDate: string = '';
  requesterName: string = '';
  department: string = '';

  supplier1Name: string = 'IKEA INDIA PRIVATE LIMITED';
  supplier2Name: string = 'GSK Interior';
  supplier3Name: string = 'Modular Line Interior';

  quotationItems: QuotationItem[] = [
    {
      sNo: 1,
      partCode: 'EKTORP',
      partDescription: 'EKTORP Two-seat sofa frame',
      specification: '801.850.33',
      uom: 'Nos',
      qty: 1,
      supplier1Price: 20882.63,
      supplier1Amount: 20882.63,
      supplier2Price: 25460,
      supplier2Amount: 25460,
      supplier3Price: 23950,
      supplier3Amount: 23950
    },
    {
      sNo: 2,
      partCode: 'EKTORP Cover',
      partDescription: 'EKTORP Cover for 2-seat sofa, Kilanda light beige',
      specification: '905.653.58',
      uom: 'Nos',
      qty: 1,
      supplier1Price: 5762.71,
      supplier1Amount: 5762.71,
      supplier2Price: 5762.71,
      supplier2Amount: 5762.71,
      supplier3Price: 5762.71,
      supplier3Amount: 5762.71
    }
  ];

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

  recommendation: string = 'It is recommended to place the order on M/s. IKEA INDIA PRIVATE LIMITED';
  selectedSupplierIndex: 1 | 2 | 3 = 1;
  isSubmitting: boolean = false;
  submitSuccess: boolean = false;

  ngOnInit(): void {
    const today = new Date();
    this.requestDate = today.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
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
    const min = Math.min(t1, t2, t3);
    if (min === t1) return this.supplier1Name;
    if (min === t2) return this.supplier2Name;
    return this.supplier3Name;
  }

  getSelectedSupplier(): string {
    if (this.selectedSupplierIndex === 1) return this.supplier1Name;
    if (this.selectedSupplierIndex === 2) return this.supplier2Name;
    return this.supplier3Name;
  }

  selectSupplier(index: 1 | 2 | 3): void {
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
    this.recommendation = selected === best
      ? `It is recommended to place the order on M/s. ${selected} based on lowest total cost.`
      : `Selected vendor is M/s. ${selected}, however M/s. ${best} provides the same requirement at a lower price.`;
  }

  submitQuotation(): void {
    this.isSubmitting = true;
    const payload = {
      rfqNo: this.rfqNo,
      requestDate: this.requestDate,
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
      recommendation: this.recommendation
    };
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
}
