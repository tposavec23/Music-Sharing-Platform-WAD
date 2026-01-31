import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { User } from '../models/user';
import { AppRoute } from '../app.routes';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  public get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  constructor(private http: HttpClient) {}

  whoami(): Observable<User | null> {
    return this.http.get<User>(this.apiUrl, { withCredentials: true }).pipe(
      tap(user => this.currentUserSubject.next(user?.user_id ? user : null))
    );
  }

  login(username: string, password: string): Observable<User> {
    return this.http.post<User>(this.apiUrl, { username, password }, { withCredentials: true }).pipe(
      tap(user => this.currentUserSubject.next(user))
    );
  }

  logout(): Observable<any> {
    return this.http.delete(this.apiUrl, { withCredentials: true }).pipe(
      tap(() => this.currentUserSubject.next(null))
    );
  }

  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { username, email, password }, { withCredentials: true });
  }

  isInRole(user: User | null, roles: number[]): boolean {
    if (!roles || roles.length === 0) return true;
    if (!user?.role_id) return false;
    return roles.includes(user.role_id);
  }

  isRouteAvailable(user: User | null, route: AppRoute): boolean {
    const roles = route.data?.roles;
    if (!roles || roles.length === 0) return true;
    return this.isInRole(user, roles);
  }
}
