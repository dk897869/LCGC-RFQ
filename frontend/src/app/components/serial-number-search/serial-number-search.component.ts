import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SerialNumberService, SerialNumberData } from '../../services/serialNumber.service';

@Component({
  selector: 'app-serial-number-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="serial-search-container">
      <div class="search-input-group">
        <input
          type="text"
          class="serial-search-input"
          [(ngModel)]="searchTerm"
          (input)="onSearchInput()"
          (keyup.enter)="search()"
          placeholder="Enter Serial Number (e.g., RFQ-20260430143022-1234)"
          [disabled]="disabled"
        />
        <button class="search-btn" (click)="search()" [disabled]="!searchTerm || isLoading">
          🔍 Search
        </button>
        <button class="clear-btn" *ngIf="searchTerm" (click)="clearSearch()">✕</button>
      </div>
      
      <div class="search-suggestions" *ngIf="suggestions.length > 0 && showSuggestions">
        <div class="suggestion-item" *ngFor="let sug of suggestions" (click)="selectSuggestion(sug)">
          <span class="suggestion-serial">{{ sug.uniqueSerialNo }}</span>
          <span class="suggestion-title">{{ sug.title }}</span>
          <span class="suggestion-type" [ngClass]="'type-' + sug.type">{{ sug.type | uppercase }}</span>
        </div>
      </div>
      
      <div class="search-result" *ngIf="searchResult && !showSuggestions">
        <div class="result-card" *ngIf="searchResult.success">
          <div class="result-header">
            <span class="result-serial">{{ searchResult.data?.uniqueSerialNo }}</span>
            <span class="result-type" [ngClass]="'type-' + searchResult.data?.type">{{ searchResult.data?.type | uppercase }}</span>
          </div>
          <div class="result-info">
            <div><strong>Title:</strong> {{ searchResult.data?.title || searchResult.data?.titleOfActivity }}</div>
            <div><strong>Requester:</strong> {{ searchResult.data?.requester || searchResult.data?.requesterName }}</div>
            <div><strong>Amount:</strong> ₹{{ (searchResult.data?.amount || 0).toLocaleString('en-IN') }}</div>
          </div>
          <div class="result-actions">
            <button class="reuse-btn" (click)="reuseData()">📋 Reuse this data</button>
            <button class="view-btn" (click)="viewDetails()">👁️ View Details</button>
          </div>
        </div>
        <div class="error-message" *ngIf="!searchResult.success">
          ⚠️ {{ searchResult.message || 'No data found for this serial number' }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .serial-search-container {
      position: relative;
      margin-bottom: 20px;
    }
    .search-input-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .serial-search-input {
      flex: 1;
      padding: 10px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      font-family: monospace;
      background: #f8fafc;
      transition: all 0.2s;
    }
    .serial-search-input:focus {
      outline: none;
      border-color: #3b82f6;
      background: white;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
    }
    .search-btn, .clear-btn, .reuse-btn, .view-btn {
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .search-btn {
      background: linear-gradient(135deg, #1e3a8a, #3b82f6);
      color: white;
    }
    .search-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59,130,246,0.3);
    }
    .search-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .clear-btn {
      background: #f1f5f9;
      color: #64748b;
      font-size: 16px;
      padding: 10px 14px;
    }
    .clear-btn:hover {
      background: #e2e8f0;
    }
    .search-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      max-height: 250px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .suggestion-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.2s;
    }
    .suggestion-item:hover {
      background: #f8fafc;
    }
    .suggestion-serial {
      font-family: monospace;
      font-size: 12px;
      font-weight: 600;
      color: #1e40af;
      background: #eef2ff;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .suggestion-title {
      flex: 1;
      font-size: 13px;
      color: #334155;
    }
    .suggestion-type {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
    }
    .suggestion-type.type-rfq { background: #dbeafe; color: #1e40af; }
    .suggestion-type.type-pr { background: #fed7aa; color: #9a3412; }
    .suggestion-type.type-po { background: #d1fae5; color: #065f46; }
    .suggestion-type.type-payment { background: #e0e7ff; color: #3730a3; }
    .search-result {
      margin-top: 15px;
      padding: 15px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .result-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .result-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .result-serial {
      font-family: monospace;
      font-size: 13px;
      font-weight: 700;
      color: #1e40af;
      background: #eef2ff;
      padding: 4px 12px;
      border-radius: 8px;
    }
    .result-type {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 20px;
      font-weight: 600;
    }
    .result-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      font-size: 13px;
    }
    .result-info div {
      color: #334155;
    }
    .result-actions {
      display: flex;
      gap: 12px;
      margin-top: 5px;
    }
    .reuse-btn {
      background: #10b981;
      color: white;
    }
    .reuse-btn:hover {
      background: #059669;
    }
    .view-btn {
      background: #8b5cf6;
      color: white;
    }
    .view-btn:hover {
      background: #7c3aed;
    }
    .error-message {
      color: #dc2626;
      font-size: 13px;
      padding: 10px;
      text-align: center;
    }
    @media (max-width: 600px) {
      .search-input-group {
        flex-wrap: wrap;
      }
      .serial-search-input {
        width: 100%;
      }
      .result-info {
        grid-template-columns: 1fr;
      }
      .result-actions {
        flex-wrap: wrap;
      }
    }
  `]
})
export class SerialNumberSearchComponent implements OnInit {
  @Input() targetType: 'rfq' | 'pr' | 'po' | 'payment' | 'ep' | 'all' = 'all';
  @Input() disabled = false;
  @Input() autoFill = true;
  @Output() dataFound = new EventEmitter<SerialNumberData>();
  @Output() dataReused = new EventEmitter<SerialNumberData>();

  searchTerm = '';
  isLoading = false;
  suggestions: any[] = [];
  showSuggestions = false;
  searchResult: any = null;
  private searchTimeout: any;

  constructor(private serialNumberService: SerialNumberService) {}

  ngOnInit() {}

  onSearchInput(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    
    if (this.searchTerm.length >= 3) {
      this.searchTimeout = setTimeout(() => {
        this.loadSuggestions();
      }, 500);
    } else {
      this.suggestions = [];
      this.showSuggestions = false;
    }
  }

  loadSuggestions(): void {
    this.serialNumberService.getAllSerialNumbers(this.targetType !== 'all' ? this.targetType : undefined)
      .subscribe({
        next: (res: any) => {
          if (res?.success && res?.data && Array.isArray(res.data)) {
            const filtered = res.data.filter((item: any) => 
              item.uniqueSerialNo?.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
            this.suggestions = filtered.slice(0, 10);
            this.showSuggestions = this.suggestions.length > 0;
          } else {
            this.suggestions = [];
            this.showSuggestions = false;
          }
        },
        error: () => {
          this.suggestions = [];
          this.showSuggestions = false;
        }
      });
  }

  search(): void {
    if (!this.searchTerm) return;
    
    this.isLoading = true;
    this.showSuggestions = false;
    
    this.serialNumberService.searchBySerialNumber(this.searchTerm).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.searchResult = res;
        if (res?.success && res?.data && this.autoFill) {
          this.dataFound.emit(res.data);
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        this.searchResult = { success: false, message: err?.error?.message || 'Search failed' };
      }
    });
  }

  selectSuggestion(suggestion: any): void {
    this.searchTerm = suggestion.uniqueSerialNo;
    this.showSuggestions = false;
    this.search();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchResult = null;
    this.suggestions = [];
    this.showSuggestions = false;
  }

  reuseData(): void {
    if (this.searchResult?.data) {
      this.dataReused.emit(this.searchResult.data);
    }
  }

  viewDetails(): void {
    if (this.searchResult?.data) {
      this.dataFound.emit(this.searchResult.data);
    }
  }
}