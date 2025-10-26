import { ProjetActifService } from '../service/projet-actif.service';
import { AuthService } from '../service/auth.service';
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { UserControllerService } from '../api/api/userController.service';
import { LoginDTO } from '../api/model/loginDTO';
import { ProjetControllerService } from '../api/api/projetController.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  sessionExpired: boolean = false;
  
  constructor(
    private userService: UserControllerService,
    private router: Router,
    private route: ActivatedRoute,
    private projetActifService: ProjetActifService,
    private projetControllerService: ProjetControllerService,
    private authService: AuthService
  ) {}
  // Ajout pour récupération du projet actif côté frontend
  // À adapter selon la logique métier (ex: projet actif = projet avec active=true)
  // Retourne une Promise qui résout avec le projet actif (ou null) une fois chargé
  private chargerProjetActifApresLogin(): Promise<any> {
    return new Promise((resolve) => {
      this.projetControllerService.getAllProjets('body').subscribe({
        next: (projets: any) => {
          const handleArray = (arr: any[]) => {
            const actif = arr.find((p: any) => p.active) || (arr.length > 0 ? arr[0] : null);
            if (actif) {
              this.projetActifService.setProjetActif(actif);
              try { window.sessionStorage.setItem('projetActifId', actif.id); } catch(e){}
            }
            resolve(actif);
          };

          if (projets instanceof Blob) {
            projets.text().then((txt: string) => {
              try {
                const parsed = JSON.parse(txt);
                if (Array.isArray(parsed)) {
                  handleArray(parsed);
                } else {
                  console.error('Format inattendu projets (après parsing):', parsed);
                  resolve(null);
                }
              } catch (e) {
                console.error('Erreur parsing JSON projets:', e);
                resolve(null);
              }
            }).catch((e: any) => { console.error('Erreur lecture Blob projets:', e); resolve(null); });
          } else {
            if (Array.isArray(projets)) {
              handleArray(projets);
            } else {
              console.error('Format inattendu projets:', projets);
              resolve(null);
            }
          }
        },
        error: (err: any) => {
          console.error('Erreur récupération projet actif:', err);
          resolve(null);
        }
      });
    });
  }
  
  // Charger et afficher tous les projets (comme /projet) au chargement du composant
  ngOnInit(): void {
    // Vérifier si l'utilisateur a été redirigé suite à une expiration de session
    this.route.queryParams.subscribe(params => {
      if (params['expired'] === 'true') {
        this.sessionExpired = true;
      }
    });
    
    this.projetControllerService.getAllProjets('body').subscribe({
      next: (projets: any) => {
        if (projets instanceof Blob) {
          projets.text().then((txt: string) => {
            try {
              const parsed = JSON.parse(txt);
            } catch (e) {
              console.error('Erreur parsing JSON projets (login ngOnInit):', e);
            }
          }).catch((e: any) => console.error('Erreur lecture Blob projets (login ngOnInit):', e));
        } else {
        }
      },
      error: (err: any) => {
        console.error('Erreur récupération projets (login ngOnInit):', err);
      }
    });
  }
  email: string = '';
  password: string = '';


  onSubmit() {
    const loginData: LoginDTO = { mail: this.email, password: this.password };
    this.userService.login(loginData).subscribe({
      next: async (result: any) => {
        if (result instanceof Blob) {
          try { const txt = await result.text(); if (txt) { try { result = JSON.parse(txt); } catch {} } } catch {}
        }

        console.log('🔐 Login réussi, le backend a envoyé le cookie JWT (HttpOnly)');
        // Si le backend renvoie le token dans le body (mode debug), on le stocke comme fallback
        if (result && result.token) {
          try { localStorage.setItem('jwt_token', result.token); console.log('✅ Token stocké en localStorage (fallback)'); } catch (e) {}
        }
        
        const projetActif = result?.projetActif || null;
        // Redirection vers la page projet après connexion réussie
        let cibleNavig = ['/projet'];
        
        if (projetActif && projetActif.id) {
          this.projetActifService.setProjetActif(projetActif);
          try { window.sessionStorage.setItem('projetActifId', projetActif.id); } catch {}
        } else {
          await this.chargerProjetActifApresLogin();
        }
        
        // Attendre un court instant pour que le cookie JWT soit enregistré par le navigateur
        setTimeout(() => {
          // Marquer l'utilisateur comme connecté
          // Le cookie HttpOnly sera automatiquement envoyé avec les requêtes
          this.authService.markLoggedIn();
          console.log('✅ Utilisateur marqué comme connecté, navigation vers:', cibleNavig);
          this.router.navigate(cibleNavig);
        }, 100); // Délai de 100ms pour que le cookie soit enregistré
      },
      error: (err: any) => {
        console.error('❌ Erreur de login:', err);
      }
    });
  }
}
