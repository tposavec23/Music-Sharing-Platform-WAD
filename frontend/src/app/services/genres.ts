import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Genre } from '../models/genre';

@Injectable({
  providedIn: 'root'
})
export class GenresService {
  private apiUrl = '/api/genres';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Genre[]> {
    return this.http.get<Genre[]>(this.apiUrl, { withCredentials: true });
  }

  getOne(id: number): Observable<Genre> {
    return this.http.get<Genre>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  create(genre: Partial<Genre>): Observable<Genre> {
    return this.http.post<Genre>(this.apiUrl, genre, { withCredentials: true });
  }

  update(id: number, genre: Partial<Genre>): Observable<Genre> {
    return this.http.put<Genre>(`${this.apiUrl}/${id}`, genre, { withCredentials: true });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
  }
}