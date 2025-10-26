import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './service/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';
  private tokenCheckInterval: any;
  private routerSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Force une vérification de l'état d'authentification au démarrage
    // (le service s'en occupe déjà dans son constructeur)
  }

  ngOnInit(): void {
    // Vérifier le token à chaque changement de route
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Vérifier si l'utilisateur est toujours authentifié
        if (!this.router.url.includes('/login')) {
          this.authService.isAuthenticated();
        }
      });

    // Vérifier périodiquement la validité du token (toutes les 30 secondes)
    this.tokenCheckInterval = setInterval(() => {
      if (!this.router.url.includes('/login')) {
        this.authService.isAuthenticated();
      }
    }, 30000); // 30 secondes
  }

  ngOnDestroy(): void {
    // Nettoyer l'intervalle et la souscription
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}
