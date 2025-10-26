import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './service/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private isHandlingExpiration = false;
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: any) => {
        if (error instanceof HttpErrorResponse) {
          // Gérer les erreurs 401 - Token invalide ou expiré
          if (error.status === 401) {
            console.warn('🔒 Token expiré ou invalide (401). Déconnexion automatique...');
            this.handleTokenExpiration();
          }
          
          // Gérer les erreurs 403 liées au token expiré
          if (error.status === 403) {
            const errorMessage = (error.error?.message || error.message || '').toString().toLowerCase();
            // Use the outgoing request URL as primary source (more reliable in interceptors)
            const requestUrl = (req && (req.urlWithParams || req.url)) || error.url || '';

            // Business endpoints that must NOT trigger a logout on 403
            const isNotificationsPost = requestUrl.includes('/api/notifications') && req.method === 'POST';
            const isProjetDepotCreate = requestUrl.includes('/api/projet-depot') && req.method === 'POST';
            const isQuantiteAutorisee = (requestUrl.includes('/api/projet-client/') && requestUrl.includes('/quantite-autorisee')) ||
                                       (requestUrl.includes('/api/projet-depot/') && requestUrl.includes('/quantite-autorisee'));

            if (isNotificationsPost) {
              console.warn('⚠️ Échec création notification (403) - ignoré pour éviter déconnexion intempestive');
              return throwError(() => error);
            }

            if (isProjetDepotCreate) {
              console.warn('⚠️ Échec création ProjetDepot (403) - erreur métier, affichage modal attendu');
              return throwError(() => error);
            }

            if (isQuantiteAutorisee) {
              console.warn('⚠️ Dépassement de quantité autorisée (403) - erreur métier, pas d\'authentification');
              return throwError(() => error);
            }

            // If none of the above matched, only then consider it an authentication problem
            if (this.authService.isAuthenticated()) {
              console.warn('🔒 Erreur 403 reçue alors que l\'utilisateur est authentifié. Token probablement expiré. Déconnexion automatique...');
              console.log('URL de la requête:', requestUrl);
              console.log('Message d\'erreur:', errorMessage || '(vide)');
              this.handleTokenExpiration();
            } else {
              // Additional heuristic checks on the error message
              if (errorMessage.includes('token') || errorMessage.includes('expired') || errorMessage.includes('jwt') || errorMessage.includes('unauthorized')) {
                console.warn('🔒 Problème d\'authentification détecté (403). Déconnexion automatique...');
                this.handleTokenExpiration();
              }
            }
          }
        }
        return throwError(() => error);
      })
    );
  }

  private handleTokenExpiration(): void {
    // Éviter les appels multiples simultanés
    if (this.isHandlingExpiration) {
      console.log('⏭️ Déconnexion déjà en cours, ignoré...');
      return;
    }
    
    this.isHandlingExpiration = true;
    console.log('🚪 Déconnexion de l\'utilisateur...');
    
    // Marquer comme déconnecté immédiatement
    this.authService.markLoggedOut();
    
    // Nettoyer les données locales
    try {
      localStorage.removeItem('projetActif');
      localStorage.removeItem('viewMode');
      localStorage.removeItem('isAllVoyagesView');
      localStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('projetActifId');
    } catch {}
    
    // Supprimer le cookie JWT
    if (typeof document !== 'undefined') {
      document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    
    // Rediriger vers la page de connexion avec paramètre d'expiration
    setTimeout(() => {
      this.isHandlingExpiration = false;
      if (!this.router.url.includes('/login')) {
        console.log('↪️ Redirection vers /login avec message d\'expiration');
        this.router.navigate(['/login'], { 
          queryParams: { 
            expired: 'true'
          } 
        });
      } else {
        console.log('↪️ Déjà sur la page de login');
      }
    }, 100);
  }
}
