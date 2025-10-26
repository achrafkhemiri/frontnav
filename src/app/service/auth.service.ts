import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'authLoggedIn';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();
  private tokenCheckSubscription?: Subscription;

  constructor(private router: Router) {
    // Au démarrage, vérifier si l'utilisateur était connecté précédemment
    const stored = localStorage.getItem(this.STORAGE_KEY);
    
    // Pour les cookies HttpOnly, on ne peut pas lire le JWT directement
    // On fait confiance au flag localStorage qui est défini après un login réussi
    // La vérification réelle se fera lors de la première requête API
    if (stored === 'true') {
      this.isAuthenticatedSubject.next(true);
      this.startTokenValidityCheck();
    }
  }

  /**
   * Vérifie la présence et la validité du token JWT dans les cookies
   * NOTE: Avec HttpOnly cookie, on ne peut pas lire le token depuis JS
   * Cette méthode vérifie juste si le cookie est accessible (pas HttpOnly)
   * ou si l'utilisateur a le flag d'authentification
   */
  private checkTokenValidity(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }

    // Essayer de lire le cookie (ne fonctionnera pas si HttpOnly)
    console.log('🍪 Tous les cookies disponibles:', document.cookie);
    const match = document.cookie.match(/jwt=([^;]+)/);
    
    if (match) {
      // Le cookie est lisible (pas HttpOnly), on peut vérifier l'expiration
      const token = match[1];
      console.log('✅ Cookie JWT trouvé (accessible):', token.substring(0, 20) + '...');
      
      try {
        const payload = this.parseJwt(token);
        if (!payload || !payload.exp) {
          return false;
        }

        const expirationDate = payload.exp * 1000;
        const now = Date.now();
        
        if (now >= expirationDate) {
          console.log('❌ Token expiré');
          return false;
        }

        console.log('✅ Token valide');
        return true;
      } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        return false;
      }
    } else {
      // Le cookie n'est pas lisible par JS (HttpOnly)
      console.log('ℹ️ Cookie JWT HttpOnly (non lisible par JS)');
      
      // Vérifier si on a au moins un cookie (HttpOnly cookies ne sont pas listés mais existent)
      // Si on n'a AUCUN cookie contenant 'jwt', et que document.cookie ne contient aucune référence,
      // cela peut indiquer que le cookie a expiré
      const allCookies = document.cookie;
      const hasAnyCookie = allCookies.length > 0;
      const hasAuthFlag = localStorage.getItem(this.STORAGE_KEY) === 'true';
      
      if (hasAuthFlag) {
        console.log('✅ Flag d\'authentification présent');
        console.log('📊 État des cookies: ' + (hasAnyCookie ? 'Présents' : 'Aucun cookie détecté'));
        
        // Si on a le flag d'auth mais AUCUN cookie du tout, c'est suspect
        // Cependant, les cookies HttpOnly ne sont pas visibles, donc on ne peut pas conclure
        // On fait confiance au flag et on laisse le backend valider
        return true;
      } else {
        console.log('❌ Aucun flag d\'authentification');
        return false;
      }
    }
  }

  /**
   * Décode le payload du JWT sans vérifier la signature
   */
  private parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Erreur lors du parsing du JWT:', error);
      return null;
    }
  }

  /**
   * Retourne true si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    // Avec un cookie HttpOnly, on se fie au flag localStorage
    // La vérification réelle du token se fait côté serveur
    const hasAuthFlag = this.isAuthenticatedSubject.value;
    
    // Vérifier quand même si un token est disponible (au cas où il ne serait pas HttpOnly)
    const hasValidToken = this.checkTokenValidity();
    
    // Si le flag dit qu'on est authentifié mais qu'on peut lire un token expiré
    // (cas où le cookie n'est pas HttpOnly), on déconnecte
    if (hasAuthFlag && !hasValidToken && document.cookie.includes('jwt=')) {
      console.log('⚠️ Token lisible et expiré, déconnexion');
      this.logout();
      return false;
    }
    
    return hasAuthFlag;
  }

  /**
   * Marque l'utilisateur comme connecté
   * Avec un cookie HttpOnly, on ne peut pas vérifier directement le token
   * On fait confiance au backend qui a envoyé le cookie
   */
  markLoggedIn(): void {
    console.log('✅ Marquage utilisateur comme connecté (stockage du flag)');
    localStorage.setItem(this.STORAGE_KEY, 'true');
    this.isAuthenticatedSubject.next(true);
    this.startTokenValidityCheck();
  }

  /**
   * Marque l'utilisateur comme déconnecté
   */
  markLoggedOut(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.isAuthenticatedSubject.next(false);
    this.stopTokenValidityCheck();
  }

  /**
   * Démarre la vérification périodique de la validité du token
   */
  private startTokenValidityCheck(): void {
    // Vérifier toutes les 30 secondes si le token est toujours valide
    this.stopTokenValidityCheck(); // Arrêter toute vérification existante
    
    this.tokenCheckSubscription = interval(30000).subscribe(() => {
      if (!this.checkTokenValidity() && this.isAuthenticatedSubject.value) {
        console.warn('⏰ Token expiré détecté lors de la vérification périodique');
        this.logout();
      }
    });
  }

  /**
   * Arrête la vérification périodique du token
   */
  private stopTokenValidityCheck(): void {
    if (this.tokenCheckSubscription) {
      this.tokenCheckSubscription.unsubscribe();
      this.tokenCheckSubscription = undefined;
    }
  }

  /**
   * Déconnecte l'utilisateur et le redirige vers /login
   */
  logout(): void {
    this.markLoggedOut();
    this.clearLocalData();
    this.deleteCookie('jwt');
    this.router.navigate(['/login']);
  }

  /**
   * Supprime un cookie
   */
  private deleteCookie(name: string): void {
    if (typeof document !== 'undefined') {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  }

  /**
   * Nettoie les données locales
   */
  private clearLocalData(): void {
    try {
      localStorage.removeItem('projetActif');
      localStorage.removeItem('viewMode');
      localStorage.removeItem('isAllVoyagesView');
      sessionStorage.removeItem('projetActifId');
    } catch {}
  }
}