import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../service/auth.service';

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    // Vérifier si l'utilisateur est vraiment authentifié (avec token valide)
    if (this.authService.isAuthenticated()) {
      // Si l'utilisateur est déjà authentifié avec un token valide,
      // rediriger vers la page projet-list au lieu de /projet
      this.router.navigate(['/projet-list']);
      return false;
    } else {
      // Permettre l'accès à la page de connexion si non authentifié
      return true;
    }
  }
}