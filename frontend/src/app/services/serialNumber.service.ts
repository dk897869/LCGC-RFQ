import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SerialNumberData {
  uniqueSerialNo: string;
  type: 'rfq' | 'pr' | 'po' | 'payment' | 'ep';
  title: string;
  requester: string;
  requesterName?: string;
  emailId?: string;
  department?: string;
  amount?: number;
  vendor?: string;
  vendorName?: string;
  items?: any[];
  stakeholders?: any[];
  ccList?: string[];
  purposeAndObjective?: string;
  description?: string;
  requestDate?: string;
  priority?: string;
  status?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class SerialNumberService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Search by serial number
  searchBySerialNumber(serialNumber: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/search/serial/${serialNumber}`).pipe(
      catchError((error) => {
        console.error('Search error:', error);
        return of({ success: false, message: error.error?.message || 'Search failed' });
      })
    );
  }

  // Get request by serial number
  getRequestBySerialNumber(serialNumber: string, type: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${type}/serial/${serialNumber}`).pipe(
      catchError((error) => {
        console.error('Get request error:', error);
        return of({ success: false, message: error.error?.message || 'Request failed' });
      })
    );
  }

  // Get all serial numbers for autocomplete
  getAllSerialNumbers(type?: string): Observable<any> {
    let url = `${this.apiUrl}/search/serials`;
    if (type) url += `?type=${type}`;
    return this.http.get(url).pipe(
      catchError((error) => {
        console.error('Get serials error:', error);
        return of({ success: true, data: [] });
      })
    );
  }

  // Reuse existing request data
  reuseRequestData(serialNumber: string, targetType: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reuse/serial/${serialNumber}`, { targetType }).pipe(
      catchError((error) => {
        console.error('Reuse error:', error);
        return of({ success: false, message: error.error?.message || 'Reuse failed' });
      })
    );
  }
}