import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ItemMasterRow {
  select: boolean;
  cmdt: string;
  partCode: string;
  partDesc: string;
  supplier: string;
  location: string;
  price: number;
  uit: string;
  sob: string;
}

@Component({
  selector: 'app-item-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-master.html',
  styleUrls: ['./item-master.scss']
})
export class ItemMasterComponent {
  itemMasterList: ItemMasterRow[] = [
    { select: true, cmdt: 'Consumables', partCode: 'RAEPL-CON-01', partDesc: 'Tape', supplier: 'QWERT', location: 'Delhi', price: 100, uit: 'RL', sob: '100%' },
    { select: false, cmdt: 'ESD Material', partCode: 'RAEPL-ESD-01', partDesc: 'Head Caps', supplier: 'ASDFG', location: 'Hyderabad', price: 30, uit: 'Nos', sob: '100%' },
    { select: false, cmdt: 'House Keeping', partCode: 'RAEPL-HK-01', partDesc: 'Wire', supplier: 'ZXCVB', location: 'Noida', price: 20, uit: 'Mtr', sob: '70%' },
    { select: false, cmdt: 'Maintenance', partCode: 'RAEPL-MNT-04', partDesc: 'Asian Paint', supplier: 'YUIOP', location: 'Pune', price: 500, uit: 'Ltrs', sob: '30%' }
  ];
  
  filteredItems: ItemMasterRow[] = [];
  filterPartCode = '';
  filterSupplier = '';
  selectedDesc = '';
  showToast = false;
  toastMessage = '';

  constructor() {
    this.filteredItems = [...this.itemMasterList];
  }

  applyFilters() {
    this.filteredItems = this.itemMasterList.filter(item =>
      (!this.filterPartCode || item.partCode.toLowerCase().includes(this.filterPartCode.toLowerCase())) &&
      (!this.filterSupplier || item.supplier.toLowerCase().includes(this.filterSupplier.toLowerCase()))
    );
  }

  addItem() {
    this.itemMasterList.push({ select: false, cmdt: '', partCode: '', partDesc: '', supplier: '', location: '', price: 0, uit: '', sob: '' });
    this.applyFilters();
  }

  selectItem(item: ItemMasterRow) {
    if (item.select) {
      this.selectedDesc = item.partDesc;
    } else if (this.selectedDesc === item.partDesc) {
      this.selectedDesc = '';
    }
  }

  saveItem(item: ItemMasterRow) {
    this.showMessage(`Item "${item.partDesc}" saved`);
  }

  deleteItem(index: number) {
    if (confirm('Delete this item?')) {
      this.itemMasterList.splice(index, 1);
      this.applyFilters();
      this.showMessage('Item deleted');
    }
  }

  exportToExcel() {
    this.showMessage('Export started');
  }

  showMessage(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
    setTimeout(() => { this.showToast = false; }, 3000);
  }
}