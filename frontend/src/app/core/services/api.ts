import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Api {

  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get(url: string) {
    return this.http.get(`${this.base}/${url}`);
  }

  post(url: string, data: any) {
    return this.http.post(`${this.base}/${url}`, data);
  }

  put(url: string, data: any) {
    return this.http.put(`${this.base}/${url}`, data);
  }

  delete(url: string) {
    return this.http.delete(`${this.base}/${url}`);
  }
}