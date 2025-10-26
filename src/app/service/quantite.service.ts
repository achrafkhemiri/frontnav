import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class QuantiteService {
  private baseUrl = 'http://localhost:8086/api/quantites';

  constructor(private http: HttpClient) {}

  /**
   * Récupère la quantité restante d'un projet
   */
  getQuantiteRestante(projetId: number): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/projet/${projetId}/restante`);
  }

  /**
   * Récupère les statistiques complètes d'un projet
   */
  getStatistiquesProjet(projetId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/projet/${projetId}/statistiques`);
  }

  /**
   * Valide si une quantité peut être ajoutée au projet
   */
  validerAjoutClient(projetId: number, quantite: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/projet/${projetId}/valider-client/${quantite}`, {});
  }
}
