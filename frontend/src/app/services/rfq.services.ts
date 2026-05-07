import { Injectable } from '@angular/core';
import { Api } from '../services/api';

@Injectable({ providedIn: 'root' })
export class RfqService {

  constructor(private api: Api) {}

  getAll(){
    return this.api.get('rfq');
  }

  create(data:any){
    return this.api.post('rfq', data);
  }

  update(id:string, status:string){
    return this.api.put(`rfq/${id}`, { status });
  }

  delete(id:string){
    return this.api.delete(`rfq/${id}`);
  }
}