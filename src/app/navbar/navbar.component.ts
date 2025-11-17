import { Component, Input } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ProjetActifService } from '../service/projet-actif.service';
import { AuthService } from '../service/auth.service';
import { ProjetControllerService } from '../api/api/projetController.service';
import { NotificationService } from '../service/notification.service';
import { VoyageControllerService } from '../api/api/voyageController.service';
import { VoyageDTO } from '../api/model/voyageDTO';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() isSidebarOpen: boolean = true;
  @Input() sidebarWidth: number = 280; // largeur ouverte (correspond à la nouvelle sidebar)
  @Input() sidebarClosedWidth: number = 75; // largeur fermée (correspond à la nouvelle sidebar)

  isAllVoyagesView: boolean = false;
  projetActif: any = null;
  currentProjet: any = null; // Projet actuellement consulté (peut être différent du projet actif)
  private loadingProjectDetails: boolean = false;
  notificationsCount: number = 0;
  voyages: VoyageDTO[] = [];
  resteQuantite: number = 0;
  pourcentageRestant: number = 0;

  constructor(
    private router: Router, 
    private projetActifService: ProjetActifService,
    private authService: AuthService,
    private projetControllerService: ProjetControllerService,
    private notificationService: NotificationService,
    private voyageControllerService: VoyageControllerService
  ) {
    this.subscribeStreams();
    this.subscribeToRouteChanges();
    // Initialiser compteur
    this.notificationService.getCountNonLuesAuto().subscribe(c => this.notificationsCount = c);
  }

  ngOnInit() { 
    this.updateView();
    // Forcer la mise à jour immédiate du projet actif
    this.projetActif = this.projetActifService.getProjetActif();
    
    // Vérifier la route actuelle pour initialiser currentProjet
    this.checkCurrentRoute();
    
    // Charger les voyages et calculer le reste
    this.loadVoyagesAndCalculateReste();
  }

  private subscribeToRouteChanges() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkCurrentRoute();
    });
  }

  private checkCurrentRoute() {
    const url = this.router.url;
    // Détecter si on est sur une page de projet spécifique (ex: /projet/5/parametre)
    const projetMatch = url.match(/\/projet\/(\d+)/);
    
    if (projetMatch) {
      const projetId = parseInt(projetMatch[1]);
      // On force le mode vue projet si on arrive via navigation directe depuis "Tous les projets"
      if (this.isAllVoyagesView) {
        this.isAllVoyagesView = false;
        try { this.projetActifService.setViewMode(false); } catch {}
      }
      // On est sur un projet spécifique, charger ses détails
      if (!this.currentProjet || this.currentProjet.id !== projetId) {
        // Définir un projet minimal immédiatement pour afficher la navbar sans attendre l'API
        this.currentProjet = { id: projetId } as any;
        // Lancer le chargement des détails et le calcul du reste
        this.loadProjectForDisplay(projetId);
        this.loadVoyagesAndCalculateReste();
      }
    } else {
      // On n'est pas sur un projet spécifique, réinitialiser currentProjet
      this.currentProjet = null;
      // 🔥 FIX: Ne basculer en vue globale QUE si aucun projet actif n'existe
      // Cela permet de conserver la sidebar du projet actif lors de la navigation
      const projetActifExiste = this.projetActifService.getProjetActif();
      if (!projetActifExiste) {
        try { this.projetActifService.setViewMode(true); } catch {}
      }
    }
  }

  private loadProjectForDisplay(projetId: number) {
    if (this.loadingProjectDetails) return;
    this.loadingProjectDetails = true;
    
    this.projetControllerService.getProjetById(projetId, 'body').subscribe({
      next: async (data) => {
        let projet: any = null;
        
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            projet = JSON.parse(text);
          } catch (e) {
            console.error('Erreur parsing projet:', e);
            this.loadingProjectDetails = false;
            return;
          }
        } else {
          projet = data;
        }
        
        if (projet && projet.id) {
          this.currentProjet = projet;
          // Synchroniser le projet actif pour cohérence globale
          try { this.projetActifService.setProjetActif(projet); } catch {}
          // Recharger les voyages quand le projet consulté change
          this.loadVoyagesAndCalculateReste();
        }
        this.loadingProjectDetails = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du projet:', err);
        this.loadingProjectDetails = false;
      }
    });
  }

  private subscribeStreams() {
    this.projetActifService.projetActif$.subscribe(p => { 
      console.log('🔔 Navbar reçoit notification de projet actif:', p);
      
      // Ne pas écraser projetActif si p est null, un objet vide, ou un objet incomplet (sans nom)
      if (!p) {
        this.projetActif = null;
        console.log('❌ Projet actif mis à null');
        // Reset affichages dépendants du projet
        this.resteQuantite = 0;
        this.pourcentageRestant = 0;
      } else if (p && Object.keys(p).length > 0) {
        // Vérifier si le projet a vraiment changé avant de recharger
        const projetIdChanged = !this.projetActif || this.projetActif.id !== p.id;
        const projetDataChanged = !this.projetActif || this.projetActif.quantiteTotale !== p.quantiteTotale;
        
        // Si payload complet → affecter directement
        if (p.nomNavire || p.nomProduit) {
          this.projetActif = p;
          console.log('✅ Navbar - Projet actif mis à jour (complet):', this.projetActif);
          // Recharger uniquement si le projet ou sa quantité ont changé
          if (projetIdChanged || projetDataChanged) {
            this.loadVoyagesAndCalculateReste();
          }
        } else if (p.id) {
          // Payload partiel → mettre à jour au moins l'id pour afficher le bouton immédiatement
          this.projetActif = { ...(this.projetActif || {}), ...p };
          console.log('⚠️ Navbar - Projet actif partiel, chargement des détails...', this.projetActif);
          if (projetIdChanged) {
            this.loadProjectForDisplay(p.id);
          } else if (projetDataChanged) {
            this.loadVoyagesAndCalculateReste();
          }
        }
      }
    });
    this.projetActifService.viewMode$.subscribe(mode => { 
      this.isAllVoyagesView = mode;
      console.log('🔔 Navbar - Mode vue changé:', mode ? 'Tous les projets' : 'Projet spécifique');
      // Quand on passe en vue globale, masquer les widgets projet et reset les valeurs
      if (mode) { // true => Tous les projets
        this.resteQuantite = 0;
        this.pourcentageRestant = 0;
      } else {
        // En revenant à la vue projet, recalculer si un projet est disponible
        this.loadVoyagesAndCalculateReste();
      }
    });
  }

  // Indique si un projet actif existe (utilisé pour afficher le bouton "Vue Projet Actif")
  hasActiveProjet(): boolean {
    return !!(
      (this.projetActif && this.projetActif.id) ||
      (this.currentProjet && this.currentProjet.id)
    );
  }

  updateView() {
    this.projetActif = this.projetActifService.getProjetActif();
    this.isAllVoyagesView = this.projetActifService.getViewMode();
  }

  toggleViewMode() {
    if (this.isAllVoyagesView) {
      // On est en mode "tous les projets", on veut retourner au projet actif
      // Recharger le projet actif depuis le service pour s'assurer qu'il est à jour
      const projetActifActuel = this.projetActifService.getProjetActif();
      
      if (projetActifActuel && projetActifActuel.id) {
        this.projetActif = projetActifActuel;
        this.currentProjet = projetActifActuel; // Mettre à jour le projet consulté
        
        // 🔥 IMPORTANT : Mettre à jour le sessionStorage avec le projet actif
        window.sessionStorage.setItem('projetActifId', String(projetActifActuel.id));
        
        // Forcer la mise à jour du service pour déclencher les subscriptions
        this.projetActifService.setProjetActif(projetActifActuel);
        
        this.router.navigate(['/projet', projetActifActuel.id, 'parametre']);
        console.log('🔄 Retour au projet actif:', projetActifActuel);
      } else {
        // Si pas de projet actif, aller à la liste des projets
        console.warn('⚠️ Aucun projet actif trouvé');
        window.sessionStorage.removeItem('projetActifId');
        this.router.navigate(['/projet']);
      }
      this.projetActifService.setViewMode(false);
    } else {
      // On est en mode "projet actif", on veut voir tous les projets
      // Réinitialiser le projet consulté pour revenir au projet actif
      this.currentProjet = null;
      // 🔥 Nettoyer le sessionStorage pour éviter les conflits
      window.sessionStorage.removeItem('projetActifId');
      // Rediriger vers la page liste des projets
      this.router.navigate(['/projet']);
      this.projetActifService.setViewMode(true);
    }
  }

  getButtonText(): string {
    return this.isAllVoyagesView ? 'Vue Projet Actif' : 'Afficher tous les projets';
  }

  logout() {
    // Nettoyer les données spécifiques au projet
    try {
      this.projetActifService.clearProjetActif();
      this.projetActifService.setViewMode(false);
    } catch (e) { 
      console.warn('Erreur nettoyage storage projet', e); 
    }
    
    // Utiliser le service d'authentification pour une déconnexion complète
    this.authService.logout();
  }

  getProjectDisplay(): string { 
    // En mode "tous les projets" (isAllVoyagesView=true), afficher le projet actif
    // En mode "projet spécifique" (isAllVoyagesView=false), afficher currentProjet ou à défaut projetActif
    let projet: any;
    
    if (this.isAllVoyagesView) {
      // Mode "tous les projets" → Toujours afficher le projet actif
      projet = this.projetActif;
    } else {
      // Mode "projet spécifique" → Afficher le projet consulté, ou le projet actif si aucun projet consulté
      projet = this.currentProjet || this.projetActif;
    }
    
    // Si pas de projet, retourner message par défaut
    if (!projet) {
      return 'Aucun projet';
    }
    
    // Format: "Navire - Date début"
    const navire = projet.nomNavire || 'Sans navire';
    const dateDebut = projet.dateDebut ? this.formatDate(projet.dateDebut) : 'Sans date';
    
    return `${navire} - ${dateDebut}`;
  }
  
  // Méthode pour formater la date (YYYY-MM-DD -> DD/MM/YYYY)
  private formatDate(dateStr: string): string {
    if (!dateStr) return 'Sans date';
    
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  // Charger les voyages et calculer le reste du projet
  loadVoyagesAndCalculateReste() {
    const projet = this.currentProjet || this.projetActif;
    
    if (!projet || !projet.id) {
      this.resteQuantite = 0;
      this.pourcentageRestant = 0;
      return;
    }

    // Charger UNIQUEMENT les voyages du projet spécifique (plus performant)
    this.voyageControllerService.getVoyagesByProjet(projet.id, 'body').subscribe({
      next: async (data: any) => {
        let voyages: VoyageDTO[] = [];
        
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            voyages = JSON.parse(text);
          } catch (e) {
            console.error('Erreur parsing voyages:', e);
            return;
          }
        } else {
          voyages = data as VoyageDTO[];
        }
        
        this.voyages = voyages;
        
        // Calculer le reste
        this.calculateReste();
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des voyages:', err);
        this.resteQuantite = 0;
        this.pourcentageRestant = 0;
      }
    });
  }

  // Calculer le reste du projet
  calculateReste() {
    const projet = this.currentProjet || this.projetActif;
    
    if (!projet) {
      this.resteQuantite = 0;
      this.pourcentageRestant = 0;
      return;
    }
    
    const quantiteTotale = projet.quantiteTotale || 0;
    const totalLivre = this.voyages.reduce((sum, v) => {
      return sum + (v.poidsClient || 0) + (v.poidsDepot || 0);
    }, 0);
    
    this.resteQuantite = quantiteTotale - totalLivre;
    
    // Calculer le pourcentage restant
    if (quantiteTotale > 0) {
      this.pourcentageRestant = Math.round((this.resteQuantite / quantiteTotale) * 100);
    } else {
      this.pourcentageRestant = 0;
    }
  }

  // Obtenir la classe CSS pour la couleur selon le pourcentage
  getResteColorClass(): string {
    if (this.pourcentageRestant > 50) {
      return 'reste-safe'; // Vert
    } else if (this.pourcentageRestant > 20) {
      return 'reste-warning'; // Orange
    } else if (this.pourcentageRestant >= 0) {
      return 'reste-danger'; // Rouge
    } else {
      return 'reste-critical'; // Rouge foncé (dépassement)
    }
  }

  // Obtenir l'icône selon le pourcentage
  getResteIcon(): string {
    if (this.pourcentageRestant > 50) {
      return 'bi-check-circle-fill';
    } else if (this.pourcentageRestant > 20) {
      return 'bi-exclamation-triangle-fill';
    } else {
      return 'bi-x-circle-fill';
    }
  }

  // Formater les nombres avec séparateur de milliers
  formatNumber(num: number): string {
    return num.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }
}
