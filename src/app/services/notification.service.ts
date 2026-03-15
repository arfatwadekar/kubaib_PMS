import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from '../models/notification.model';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private baseUrl = `${environment.apiBaseUrl}/api/Notification`;
  private hubUrl = `${environment.apiBaseUrl}/notificationHub`;

  private hubConnection!: signalR.HubConnection;

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.startSignalRConnection();
  }

  // ==========================
  // SIGNALR CONNECTION
  // ==========================
  private startSignalRConnection() {

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => console.log('✅ SignalR Connected'))
      .catch(err => console.error('❌ SignalR Error:', err));

    // Listen to backend event
    this.hubConnection.on('ReceiveNotification', (notification: Notification) => {

      const current = this.notificationsSubject.value;

      this.notificationsSubject.next([
        notification,
        ...current
      ]);
    });
  }

  // ==========================
  // FETCH ALL
  // ==========================
  fetchAll(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.baseUrl);
  }

  // ==========================
  // MARK AS READ
  // ==========================
  markAsRead(id: number): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/read`, {});
  }

  // ==========================
  // SET INITIAL DATA
  // ==========================
  setNotifications(data: Notification[]) {
    this.notificationsSubject.next(data);
  }

  getLocalUnreadCount(): number {
    return this.notificationsSubject.value.filter(n => !n.isRead).length;
  }
}
