import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, Subject } from 'rxjs';
import { Notification, StatistiquesNotifications, NiveauAlerte } from '../model/notification.model';
import { startWith, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = 'http://localhost:8086/api/notifications';
  private notificationUpdate = new Subject<void>();

  // Expose an observable so other components can react to manual refresh events
  onRefresh() {
    return this.notificationUpdate.asObservable();
  }

  constructor(private http: HttpClient) {
    // Rafraîchir les notifications toutes les 30 secondes
    interval(30000).subscribe(() => this.notificationUpdate.next());
  }

  getToutesLesNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.baseUrl);
  }

  getNotificationsNonLues(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.baseUrl}/non-lues`);
  }

  getNotificationsParNiveau(niveau: NiveauAlerte): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.baseUrl}/niveau/${niveau}`);
  }

  getNotificationsParEntite(type: string, id: number): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.baseUrl}/entite/${type}/${id}`);
  }

  marquerCommeLue(id: number): Observable<Notification> {
    return this.http.put<Notification>(`${this.baseUrl}/${id}/lue`, {});
  }

  marquerToutesCommeLues(): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/marquer-toutes-lues`, {});
  }

  supprimerNotification(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  supprimerNotificationsLues(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/lues`);
  }

  getStatistiques(): Observable<StatistiquesNotifications> {
    return this.http.get<StatistiquesNotifications>(`${this.baseUrl}/statistiques`);
  }

  compterNotificationsNonLues(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/count/non-lues`);
  }

  // Observable pour rafraîchir automatiquement
  getNotificationsNonLuesAuto(): Observable<Notification[]> {
    return this.notificationUpdate.pipe(
      startWith(0),
      switchMap(() => this.getNotificationsNonLues())
    );
  }

  getCountNonLuesAuto(): Observable<number> {
    return this.notificationUpdate.pipe(
      startWith(0),
      switchMap(() => this.compterNotificationsNonLues())
    );
  }

  // Méthode pour forcer le rafraîchissement
  rafraichir(): void {
    this.notificationUpdate.next();
  }

  // Créer une notification manuelle
  creerNotification(notification: Partial<Notification>): Observable<Notification> {
    return this.http.post<Notification>(this.baseUrl, notification);
  }
}
