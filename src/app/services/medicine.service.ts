import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface Medicine {
  medicineId: number;
  name: string;
  strength: string;
  dosageForm: string;
  stockQuantity: number;
  unit: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface MedicineListResponse {
  data: {
    items: Medicine[];
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
  };
  success: boolean;
  message: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MedicineService {

  private baseUrl = 'http://localhost:8080/api/Medicine';

  constructor(private http: HttpClient) {}

  getAll(
    page = 1,
    pageSize = 10,
    search = ''
  ): Observable<MedicineListResponse> {

    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<MedicineListResponse>(this.baseUrl, { params });
  }

  getById(id: number) {
    return this.http.get<Medicine>(`${this.baseUrl}/${id}`);
  }

  create(data: any) {
    return this.http.post(this.baseUrl, data);
  }

  update(id: number, data: any) {
    return this.http.put(`${this.baseUrl}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
