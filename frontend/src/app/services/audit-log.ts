import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditLogEntry {
  id: number;
  action: string;
  target_id: number | null;
  timestamp: string;
  user_id: number;
  username?: string;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  pagination: {
    total: number;
    limit: number;
    page: number;
    total_pages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private apiUrl = '/api/audit-log';

  constructor(private http: HttpClient) {}

  getAll(params?: {
    page?: number;
    limit?: number;
    action?: string;
    user_id?: number;
  }): Observable<AuditLogResponse> {
    let httpParams = new HttpParams();

    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.action) httpParams = httpParams.set('action', params.action);
    if (params?.user_id) httpParams = httpParams.set('user_id', params.user_id.toString());

    return this.http.get<AuditLogResponse>(this.apiUrl, {
      params: httpParams,
      withCredentials: true
    });
  }

  getOne(id: number): Observable<AuditLogEntry> {
    return this.http.get<AuditLogEntry>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  getActions(): Observable<{ action: string; count: number }[]> {
    return this.http.get<{ action: string; count: number }[]>(
      `${this.apiUrl}/actions`,
      { withCredentials: true }
    );
  }

  exportPdf(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/pdf`, {
      withCredentials: true,
      responseType: 'blob'
    });
  }
}
