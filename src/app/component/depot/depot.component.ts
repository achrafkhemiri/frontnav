import { Component } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { DepotControllerService } from '../../api/api/depotController.service';
import { ProjetDepotControllerService } from '../../api/api/projetDepotController.service';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { HttpClient } from '@angular/common/http';
import { Inject } from '@angular/core';
import { BASE_PATH } from '../../api/variables';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmCodeDialogComponent } from '../../shared/confirm-code-dialog.component';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DepotDTO } from '../../api/model/depotDTO';
import { ProjetDepotDTO } from '../../api/model/projetDepotDTO';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { NotificationService } from '../../service/notification.service';
import { QuantiteService } from '../../service/quantite.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Interface étendue pour les dépôts avec quantités
interface DepotWithQuantite extends DepotDTO {
  projetDepotId?: number;
  quantiteAutorisee?: number;
}

@Component({
  selector: 'app-depot',
  templateUrl: './depot.component.html',
  styleUrls: ['./depot.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }),
        animate('300ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-out', style({ transform: 'scale(0.8)', opacity: 0 }))
      ])
    ])
  ]
})
export class DepotComponent {
  depots: DepotWithQuantite[] = [];
  projetDepots: ProjetDepotDTO[] = [];
  filteredDepots: DepotWithQuantite[] = [];
  paginatedDepots: DepotWithQuantite[] = [];
  // Global active project
  projetActifId: number | null = null;
  projetActif: any = null;
  // Context (visited) project from session
  contextProjetId: number | null = null;
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  selectedDepot: DepotWithQuantite | null = null;
  dialogDepot: DepotDTO = { nom: '', adresse: '', mf: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  depotFilter: string = '';
  
  // Pour l'autocomplétion type Select2
  allDepots: DepotDTO[] = []; // Tous les dépôts (toutes les BDD)
  filteredSuggestions: DepotDTO[] = [];
  showSuggestions: boolean = false;
  selectedExistingDepot: DepotDTO | null = null;
  
  // Modal de quantité
  showQuantiteModal: boolean = false;
  quantiteAutorisee: number = 0;
  pendingDepotId: number | null = null;
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Voyages pour calculer la quantité vendue
  voyages: VoyageDTO[] = [];
  
  // Date Filter
  dateFilterActive: boolean = false;
  dateDebut: string | null = null;
  dateFin: string | null = null;
  // Date max pour le filtre (aujourd'hui)
  today: string = '';
  
  // Alerte temporaire
  showAlert: boolean = false;
  alertMessage: string = '';
  alertType: 'success' | 'danger' | 'warning' | 'info' = 'info';
  
  // Modal de confirmation/erreur
  showConfirmModal: boolean = false;
  showErrorModal: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalIcon: string = '';
  modalIconColor: string = '';
  depotToDelete: number | null = null;
  
  Math = Math;

  constructor(
    private depotService: DepotControllerService,
    private projetDepotService: ProjetDepotControllerService,
    private voyageService: VoyageControllerService,
    private projetActifService: ProjetActifService, 
    private projetService: ProjetControllerService,
    private notificationService: NotificationService,
    private quantiteService: QuantiteService,
    private http: HttpClient,
    private dialog: MatDialog,
    @Inject(BASE_PATH) private basePath: string
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 [Depot] Notification reçue - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 [Depot] Rechargement - previousId:', previousId, 'newId:', projet.id);
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
    this.initializeProjetContext();
    // Initialiser la date du jour
    this.today = this.getTodayString();
  }

  initializeProjetContext() {
    const globalProjet = this.projetActifService.getProjetActif?.();
    if (globalProjet && globalProjet.id) {
      this.projetActifId = globalProjet.id;
      this.projetActif = globalProjet;
    }
    const contextId = window.sessionStorage.getItem('projetActifId');
    if (contextId) {
      this.contextProjetId = Number(contextId);
      this.loadProjetDetails(this.contextProjetId, true);
    }
    this.loadAllDepots(); // Charger tous les dépôts pour l'autocomplétion
    this.loadDepots();
    this.loadVoyages(); // Charger les voyages pour calculer la quantité vendue
  }

  // 🔥 NOUVEAU : Méthode pour recharger toutes les données
  reloadData() {
    // Réinitialiser le contexte si on n'est pas sur une page de paramètre
    const contextId = window.sessionStorage.getItem('projetActifId');
    if (contextId) {
      this.contextProjetId = Number(contextId);
      this.loadProjetDetails(this.contextProjetId, true);
    } else {
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    // Recharger toutes les données
    this.loadAllDepots();
    this.loadDepots();
    this.loadVoyages();
    this.updateBreadcrumb();
  }

  loadProjetDetails(projetId: number, isContext: boolean = false) {
    this.projetService.getProjetById(projetId, 'body').subscribe({
      next: async (data: any) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            if (isContext) {
              this.contextProjet = parsed;
              this.updateBreadcrumb();
            } else {
              this.projetActif = parsed;
            }
          } catch (e) {
            console.error('Erreur parsing projet:', e);
          }
        } else {
          if (isContext) {
            this.contextProjet = data;
            this.updateBreadcrumb();
          } else {
            this.projetActif = data;
          }
        }
      },
      error: (err: any) => {
        console.error('Erreur chargement projet:', err);
      }
    });
  }

  // IMPORTANT: Cette méthode est pour FILTRER les données (garde le comportement actuel)
  isProjetActif(): boolean {
    // Pour filtrage on utilise le contexte si disponible, sinon global
    return !!(this.contextProjetId || this.projetActifId);
  }

  // NOUVELLE: Cette méthode est UNIQUEMENT pour les boutons Ajouter
  canAddData(): boolean {
    // Si on visite un autre projet, on contrôle selon ce projet contextuel
    if (this.contextProjet) {
      return this.contextProjet.active === true;
    }
    return !!(this.projetActif && this.projetActif.active === true);
  }

  updateBreadcrumb() {
    const projet = this.contextProjet || this.projetActif;
    if (projet) {
      this.breadcrumbItems = [
        { label: 'Projets', url: '/projet' },
        { label: projet.nom || `Projet ${projet.id}`, url: `/projet/${projet.id}/parametre` },
        { label: 'Param\u00e8tres', url: `/projet/${projet.id}/parametre` },
        { label: 'D\u00e9p\u00f4ts' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'D\u00e9p\u00f4ts' }
      ];
    }
  }

  openAddDialog() {
    this.dialogDepot = { nom: '', adresse: '', mf: '' };
    this.selectedExistingDepot = null;
    this.showAddDialog = true;
    this.editMode = false;
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }

  // Charger tous les dépôts de la base de données pour l'autocomplétion
  loadAllDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              // Trier par ID décroissant (du plus récent au plus ancien)
              this.allDepots = json.sort((a, b) => (b.id || 0) - (a.id || 0));
            }
          } catch (e) {
            console.error('Erreur parsing allDepots:', e);
          }
        } else if (Array.isArray(data)) {
          // Trier par ID décroissant (du plus récent au plus ancien)
          this.allDepots = data.sort((a, b) => (b.id || 0) - (a.id || 0));
        }
        console.log('AllDepots chargés et triés pour autocomplétion:', this.allDepots.length);
      },
      error: (err) => {
        console.error('Erreur chargement allDepots:', err);
      }
    });
  }

  // Filtrer les suggestions lors de la saisie
  onDepotInputChange() {
    const searchValue = this.dialogDepot.nom;
    
    if (!searchValue || searchValue.trim().length < 2) {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
      this.selectedExistingDepot = null;
      return;
    }
    
    const searchLower = searchValue.trim().toLowerCase();
    const targetProjetId = this.contextProjetId || this.projetActifId;
    
    // Filtrer les dépôts qui correspondent et qui ne sont PAS déjà dans le projet actuel
    this.filteredSuggestions = this.allDepots.filter(depot => {
      const matchesSearch = depot.nom?.toLowerCase().includes(searchLower);
      // Exclure les dépôts déjà associés au projet actuel
      const notInCurrentProject = !this.depots.some(d => d.id === depot.id);
      return matchesSearch && notInCurrentProject;
    }).slice(0, 10); // Limiter à 10 suggestions
    
    this.showSuggestions = this.filteredSuggestions.length > 0;
    this.selectedExistingDepot = null;
  }

  // Sélectionner un dépôt existant depuis les suggestions
  selectSuggestion(depot: DepotDTO) {
    this.selectedExistingDepot = depot;
    this.dialogDepot.nom = depot.nom || '';
    this.dialogDepot.adresse = depot.adresse || '';
    this.dialogDepot.mf = depot.mf || '';
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }

  // Fermer les suggestions si on clique ailleurs
  closeSuggestions() {
    setTimeout(() => {
      this.showSuggestions = false;
      this.filteredSuggestions = [];
    }, 200);
  }

  selectDepot(dep: DepotDTO) {
    this.dialogDepot = { 
      id: dep.id,
      nom: dep.nom,
      adresse: dep.adresse,
      mf: dep.mf,
      projetId: dep.projetId
    };
    this.selectedDepot = dep;
    this.editMode = true;
    this.showAddDialog = true;
  }

  addDialogDepot() {
    if (!this.dialogDepot.nom) {
      this.error = 'Veuillez remplir le nom.';
      return;
    }
    
    const targetProjetId = this.contextProjetId || this.projetActifId;
    
    // Si un dépôt existant a été sélectionné, demander la quantité
    if (this.selectedExistingDepot && this.selectedExistingDepot.id) {
      console.log('Association dépôt existant:', this.selectedExistingDepot.id, 'au projet:', targetProjetId);
      if (targetProjetId) {
        // Stocker l'ID du dépôt en attente et ouvrir la modal de quantité
        this.pendingDepotId = this.selectedExistingDepot.id;
        this.quantiteAutorisee = 0;
        this.showQuantiteModal = true;
        this.closeDialog();
      }
      return;
    }
    
    // Créer un nouveau dépôt puis demander la quantité
    console.log('Création nouveau depot - payload:', this.dialogDepot);

    this.depotService.createDepot(this.dialogDepot, 'body').subscribe({
      next: async (created) => {
        console.log('Réponse création depot (raw):', created);

        let createdId: number | null = null;
        
        if (created instanceof Blob) {
          const text = await created.text();
          try {
            const parsed = JSON.parse(text);
            console.log('Réponse création depot (parsed):', parsed);
            createdId = parsed?.id;
          } catch (e) {
            console.error('Erreur parsing création depot:', e);
          }
        } else {
          createdId = (created as any)?.id;
        }

        if (createdId && targetProjetId) {
          // Stocker l'ID et ouvrir la modal de quantité
          this.pendingDepotId = createdId;
          this.quantiteAutorisee = 0;
          this.showQuantiteModal = true;
          this.closeDialog();
        } else {
          this.loadDepots();
          this.closeDialog();
        }
      },
      error: (err) => {
        this.error = 'Erreur ajout: ' + (err.error?.message || err.message);
        console.error('Erreur création depot:', err);
      }
    });
  }

  // Confirmer l'ajout avec quantité
  confirmAddDepotWithQuantite() {
    if (this.quantiteAutorisee === null || this.quantiteAutorisee === undefined || this.quantiteAutorisee < 0) {
      this.showAlert = true;
      this.alertType = 'danger';
      this.alertMessage = 'Veuillez entrer une quantité autorisée valide (≥ 0)';
      return;
    }

    const targetProjetId = this.contextProjetId || this.projetActifId;
    
    if (!this.pendingDepotId || !targetProjetId) {
      this.showAlert = true;
      this.alertType = 'danger';
      this.alertMessage = 'Erreur: ID dépôt ou projet manquant';
      return;
    }

    // Créer le ProjetDepot avec quantité
    const projetDepot: any = {
      projetId: targetProjetId,
      depotId: this.pendingDepotId,
      quantiteAutorisee: this.quantiteAutorisee
    };

    this.projetDepotService.createProjetDepot(projetDepot, 'body').subscribe({
      next: () => {
        console.log('✅ ProjetDepot créé avec quantité:', this.quantiteAutorisee);
        this.showAlert = true;
        this.alertType = 'success';
        this.alertMessage = `Dépôt ajouté avec succès (Quantité: ${this.quantiteAutorisee} kg)`;
        this.showQuantiteModal = false;
        this.pendingDepotId = null;
        this.quantiteAutorisee = 0;
        
        // Recharger les données avec un petit délai pour laisser la BD se mettre à jour
        setTimeout(() => {
          this.loadDepots();
          this.loadVoyages();
        }, 200);
      },
      error: async (err) => {
        console.error('❌ Erreur création ProjetDepot:', err);
        // If it's a 400/403, treat as quantity-exceed similar to client flow
        let errorMsg = '';

        if (err.error instanceof Blob) {
          try {
            const text = await err.error.text();
            if (text && text.trim()) errorMsg = text;
          } catch (e) {
            console.error('Erreur parsing blob:', e);
          }
        } else if (err.error) {
          if (typeof err.error === 'string') errorMsg = err.error;
          else if (err.error.message) errorMsg = err.error.message;
          else if (err.error.error) errorMsg = err.error.error;
        }

        if (err.status === 400 || err.status === 403) {
          // Close the quantite modal
          this.showQuantiteModal = false;

          const projet = this.contextProjet || this.projetActif;
          if (projet && targetProjetId) {
            // Get remaining quantity
            this.quantiteService.getQuantiteRestante(targetProjetId).subscribe({
              next: (quantiteRestante) => {
                const nomProjet = projet.nom || `Projet ${targetProjetId}`;
                const alertMsg = `Impossible d'ajouter le dépôt : la quantité autorisée dépasse la quantité restante.\n\n` +
                                 `📊 Projet "${nomProjet}" :\n` +
                                 `✅ Quantité restante disponible : ${quantiteRestante.toFixed(2)}`;
                // show temporary alert (create method below)
                this.showTemporaryAlert(alertMsg, 'danger');
              },
              error: () => {
                const nomProjet = projet.nom || `Projet ${targetProjetId}`;
                const alertMsg = errorMsg && errorMsg.trim()
                  ? errorMsg
                  : `Impossible d'ajouter le dépôt au projet "${nomProjet}" : la quantité autorisée dépasse la quantité restante.`;
                this.showTemporaryAlert(alertMsg, 'danger');
              }
            });
          } else {
            const alertMsg = errorMsg && errorMsg.trim()
              ? errorMsg
              : 'Impossible d\'ajouter le dépôt : la quantité autorisée dépasse la quantité restante du projet.';
            this.showTemporaryAlert(alertMsg, 'danger');
          }

          // Refresh notifications
          this.notificationService.rafraichir();

          // Remove orphan depot if needed
          if (this.pendingDepotId) {
            console.log('Suppression du dépôt orphelin:', this.pendingDepotId);
            this.depotService.deleteDepot(this.pendingDepotId, 'body').subscribe({
              next: () => console.log('Dépôt orphelin supprimé'),
              error: (delErr) => console.error('Erreur suppression dépôt orphelin:', delErr)
            });
          }

          // Reset state
          this.pendingDepotId = null;
          this.quantiteAutorisee = 0;
        } else {
          // Other errors
          this.showAlert = true;
          this.alertType = 'danger';
          this.alertMessage = 'Erreur: ' + (errorMsg || err.message || err.error?.message || '');
          this.showQuantiteModal = false;
        }
      }
    });
  }

  // Annuler l'ajout avec quantité
  cancelAddDepotWithQuantite() {
    this.showQuantiteModal = false;
    this.pendingDepotId = null;
    this.quantiteAutorisee = 0;
  }

  updateDialogDepot() {
    if (!this.dialogDepot?.id) return;
    this.depotService.updateDepot(this.dialogDepot.id, this.dialogDepot, 'body').subscribe({
      next: () => {
        this.dialogDepot = { nom: '', adresse: '', mf: '' };
        this.selectedDepot = null;
        this.editMode = false;
        this.loadDepots();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  closeDialog() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogDepot = { nom: '', adresse: '', mf: '' };
    this.selectedDepot = null;
    this.error = '';
  }

  applyFilter() {
    const filter = this.depotFilter.trim().toLowerCase();
    let depotsFiltrés = this.depots;
    
    // Note: Les dépôts sont déjà filtrés par projet dans loadDepotsDetails()
    // Pas besoin de refiltrer par projetId ici
    
    // Filtre par texte
    if (filter) {
      depotsFiltrés = depotsFiltrés.filter(d =>
        d.nom?.toLowerCase().includes(filter)
      );
    }
    
    this.filteredDepots = depotsFiltrés;
    console.log(`📊 applyFilter() - ${this.filteredDepots.length} dépôts après filtrage`);
    this.updatePagination();
  }

  // Total livré pour un dépôt avec filtre par plage de dates (journée de travail 7h00 → 6h00)
  getTotalLivreDepot(depotId?: number): number {
    if (!depotId || !this.voyages) return 0;
    let voyagesFiltrés = this.voyages.filter(v => v.depotId === depotId && v.poidsDepot);

    if (this.dateFilterActive && (this.dateDebut || this.dateFin)) {
      const startDate = this.dateDebut ? new Date(this.dateDebut + 'T00:00:00') : new Date('1900-01-01');
      const endDate = this.dateFin ? new Date(this.dateFin + 'T00:00:00') : new Date();
      
      voyagesFiltrés = voyagesFiltrés.filter(v => {
        if (!v.date) return false;
        const voyageDateTime = new Date(v.date);
        
        // Vérifier si le voyage tombe dans l'une des journées de travail de la plage
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const workDayStart = new Date(d);
          workDayStart.setHours(7, 0, 0, 0);
          const workDayEnd = new Date(d);
          workDayEnd.setDate(workDayEnd.getDate() + 1);
          workDayEnd.setHours(6, 0, 0, 0);
          
          if (voyageDateTime >= workDayStart && voyageDateTime < workDayEnd) {
            return true;
          }
        }
        return false;
      });
    }
    return voyagesFiltrés.reduce((sum, v) => sum + (v.poidsDepot || 0), 0);
  }

  toggleDateFilter() {
    this.dateFilterActive = !this.dateFilterActive;
    this.updatePagination();
  }

  onDateFilterChange() {
    // Empêcher la sélection d'une date future
    if (this.dateDebut && this.today && this.dateDebut > this.today) {
      this.dateDebut = this.today;
    }
    if (this.dateFin && this.today && this.dateFin > this.today) {
      this.dateFin = this.today;
    }
    this.updatePagination();
  }

  clearDateFilter() {
    this.dateFilterActive = false;
    this.dateDebut = null;
    this.dateFin = null;
    this.updatePagination();
  }
  
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortDepots();
  }
  
  sortDepots() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredDepots.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof DepotDTO];
      let bVal: any = b[this.sortColumn as keyof DepotDTO];
      
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.updatePagination();
  }
  
  updatePagination() {
    this.totalPages = Math.ceil(this.filteredDepots.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedDepots = this.filteredDepots.slice(startIndex, endIndex);
  }
  
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  deleteDepot(id?: number) {
    if (id === undefined) return;

    // Vérifier si le dépôt a une quantité vendue > 0
    const quantite = this.getTotalLivreDepot(id);
    if (quantite > 0) {
      this.showErrorModal = true;
      this.modalTitle = 'Suppression impossible';
      this.modalMessage = `Ce dépôt a une quantité vendue de ${quantite.toFixed(2)} kg. Vous ne pouvez pas supprimer un dépôt ayant des ventes enregistrées.`;
      this.modalIcon = 'bi-exclamation-triangle-fill';
      this.modalIconColor = '#ef4444';
      return;
    }

    // Ouvrir d'abord la boîte de dialogue de code de suppression
    const dialogRef = this.dialog.open(ConfirmCodeDialogComponent, { disableClose: true });
    dialogRef.afterClosed().subscribe((ok: boolean) => {
      if (ok === true) {
        // Afficher la modale de confirmation existante
        this.depotToDelete = id;
        this.showConfirmModal = true;
        this.modalTitle = 'Confirmer la suppression';
        this.modalMessage = 'Êtes-vous sûr de vouloir supprimer ce dépôt ? Cette action est irréversible.';
        this.modalIcon = 'bi-trash-fill';
        this.modalIconColor = '#ef4444';
      }
    });
  }

  confirmDelete() {
    if (this.depotToDelete === null) return;
    
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (!targetProjetId) {
      this.showConfirmModal = false;
      this.showErrorModal = true;
      this.modalTitle = 'Erreur';
      this.modalMessage = 'Aucun projet actif';
      this.modalIcon = 'bi-x-circle-fill';
      this.modalIconColor = '#ef4444';
      return;
    }
    
    // Utiliser depotService.deleteDepot qui utilise la bonne méthode backend
    this.depotService.deleteDepot(this.depotToDelete, 'body').subscribe({
      next: () => {
        console.log('✅ Dépôt supprimé avec succès');
        this.showConfirmModal = false;
        this.depotToDelete = null;
        this.loadDepots();
      },
      error: (err) => {
        console.error('❌ Erreur suppression dépôt:', err);
        this.showConfirmModal = false;
        this.showErrorModal = true;
        this.modalTitle = 'Erreur de suppression';
        
        // Message d'erreur plus explicite
        let errorMessage = 'Une erreur est survenue lors de la suppression';
        
        if (err.status === 403) {
          errorMessage = 'Vous n\'avez pas les permissions nécessaires pour supprimer ce dépôt.';
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        // Détecter les erreurs de contrainte de clé étrangère
        const errorText = JSON.stringify(err);
        if (errorText.includes('foreign key') || errorText.includes('constraint') || errorText.includes('DataIntegrityViolationException')) {
          errorMessage = 'Ce dépôt est encore associé à un ou plusieurs projets. Il ne peut pas être supprimé tant qu\'il y a des associations actives.';
        }
        
        this.modalMessage = errorMessage;
        this.modalIcon = 'bi-x-circle-fill';
        this.modalIconColor = '#ef4444';
      }
    });
  }

  cancelDelete() {
    this.showConfirmModal = false;
    this.depotToDelete = null;
  }

  closeErrorModal() {
    this.showErrorModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
  }

  // Affiche une alerte temporaire pendant 1 minute (utilisé pour erreurs de dépassement)
  showTemporaryAlert(message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info') {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    setTimeout(() => {
      this.showAlert = false;
      this.alertMessage = '';
    }, 60000);
  }

  loadDepots() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    console.log('📊 loadDepots() - contextProjetId:', this.contextProjetId, 'projetActifId:', this.projetActifId, 'targetProjetId:', targetProjetId);
    
    if (!targetProjetId) {
      console.warn('⚠️ Aucun projet actif - liste des dépôts vide');
      this.depots = [];
      this.projetDepots = [];
      this.applyFilter();
      return;
    }
    
    // Charger les ProjetDepot pour ce projet
    this.projetDepotService.getProjetDepotsByProjetId(targetProjetId, 'body').subscribe({
      next: async (data: any) => {
        console.log('✅ Réponse getProjetDepotsByProjetId:', data);
        
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              this.projetDepots = parsed.sort((a, b) => (b.id || 0) - (a.id || 0));
              // Charger les détails des dépôts
              this.loadDepotsDetails();
            }
          } catch (e) {
            console.error('Erreur parsing projetDepots:', e);
            this.projetDepots = [];
            this.depots = [];
            this.applyFilter();
          }
        } else if (Array.isArray(data)) {
          this.projetDepots = data.sort((a, b) => (b.id || 0) - (a.id || 0));
          console.log(`✅ ${data.length} ProjetDepots chargés pour le projet ${targetProjetId}`);
          // Charger les détails des dépôts
          this.loadDepotsDetails();
        } else {
          this.projetDepots = [];
          this.depots = [];
          this.applyFilter();
        }
      },
      error: err => {
        console.error('❌ Erreur chargement projetDepots:', err);
        this.error = 'Erreur chargement des dépôts: ' + (err.error?.message || err.message);
        this.projetDepots = [];
        this.depots = [];
        this.applyFilter();
      }
    });
  }

  // Charger les détails des dépôts depuis les ProjetDepot
  loadDepotsDetails() {
    if (this.projetDepots.length === 0) {
      this.depots = [];
      this.applyFilter();
      return;
    }

    // Récupérer les IDs uniques des dépôts
    const depotIds = [...new Set(this.projetDepots.map(pd => pd.depotId))];
    
    // Charger tous les dépôts
    this.depotService.getAllDepots('body').subscribe({
      next: async (data: any) => {
        let allDepots: DepotDTO[] = [];
        
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            allDepots = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error('Erreur parsing depots:', e);
          }
        } else if (Array.isArray(data)) {
          allDepots = data;
        }
        
        // Filtrer et enrichir avec les infos de ProjetDepot
        this.depots = allDepots
          .filter(depot => depotIds.includes(depot.id!))
          .map(depot => {
            const projetDepot = this.projetDepots.find(pd => pd.depotId === depot.id);
            return {
              ...depot,
              projetDepotId: projetDepot?.id,
              quantiteAutorisee: projetDepot?.quantiteAutorisee || 0
            } as DepotWithQuantite;
          })
          .sort((a, b) => (b.id || 0) - (a.id || 0));
        
        console.log('✅ Dépôts enrichis avec quantités:', this.depots);
        this.applyFilter();
      },
      error: (err: any) => {
        console.error('❌ Erreur chargement détails dépôts:', err);
        this.depots = [];
        this.applyFilter();
      }
    });
  }

  // Charger les voyages
  loadVoyages() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    
    if (targetProjetId) {
      // Charger les voyages du projet
      this.voyageService.getVoyagesByProjet(targetProjetId, 'body').subscribe({
        next: async (data: any) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const parsed = JSON.parse(text);
              this.voyages = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              console.error('Erreur parsing voyages:', e);
              this.voyages = [];
            }
          } else {
            this.voyages = Array.isArray(data) ? data : [];
          }
        },
        error: (err: any) => {
          console.error('Erreur chargement voyages:', err);
          this.voyages = [];
        }
      });
    } else {
      // Charger tous les voyages
      this.voyageService.getAllVoyages('body').subscribe({
        next: async (data: any) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const parsed = JSON.parse(text);
              this.voyages = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              console.error('Erreur parsing voyages:', e);
              this.voyages = [];
            }
          } else {
            this.voyages = Array.isArray(data) ? data : [];
          }
        },
        error: (err: any) => {
          console.error('Erreur chargement voyages:', err);
          this.voyages = [];
        }
      });
    }
  }

  // Calculer la quantité livrée pour un dépôt
  getQuantiteLivree(depot: DepotWithQuantite): number {
    if (!depot.id) return 0;
    return this.voyages
      .filter(v => v.depotId === depot.id)
      .reduce((sum, v) => sum + (v.quantite || 0), 0);
  }

  // Calculer le reste pour un dépôt
  getReste(depot: DepotWithQuantite): number {
    const quantiteAutorisee = depot.quantiteAutorisee || 0;
    const quantiteLivree = this.getQuantiteLivree(depot);
    return quantiteAutorisee - quantiteLivree;
  }

  // Calculer le pourcentage utilisé
  getPourcentageUtilise(depot: DepotWithQuantite): number {
    const quantiteAutorisee = depot.quantiteAutorisee || 0;
    if (quantiteAutorisee === 0) return 0;
    const quantiteLivree = this.getQuantiteLivree(depot);
    return (quantiteLivree / quantiteAutorisee) * 100;
  }

  // Obtenir la classe CSS pour la barre de progression
  getProgressBarClass(depot: DepotWithQuantite): string {
    const pourcentage = this.getPourcentageUtilise(depot);
    if (pourcentage >= 100) return 'progress-bar-danger';
    if (pourcentage >= 80) return 'progress-bar-warning';
    return 'progress-bar-success';
  }

  // Modal pour modifier la quantité autorisée
  showEditQuantiteModal: boolean = false;
  editingDepot: DepotWithQuantite | null = null;
  newQuantiteAutorisee: number = 0;

  openEditQuantiteModal(depot: DepotWithQuantite) {
    this.editingDepot = depot;
    this.newQuantiteAutorisee = depot.quantiteAutorisee || 0;
    this.showEditQuantiteModal = true;
  }

  confirmEditQuantite() {
    if (!this.editingDepot || !this.editingDepot.projetDepotId) {
      this.showAlert = true;
      this.alertType = 'danger';
      this.alertMessage = 'Erreur: Dépôt invalide';
      return;
    }

    if (this.newQuantiteAutorisee === null || this.newQuantiteAutorisee === undefined || this.newQuantiteAutorisee < 0) {
      this.showAlert = true;
      this.alertType = 'danger';
      this.alertMessage = 'Veuillez entrer une quantité valide (≥ 0)';
      return;
    }

    this.projetDepotService.updateQuantiteAutorisee(
      this.editingDepot.projetDepotId,
      this.newQuantiteAutorisee,
      'body'
    ).subscribe({
      next: () => {
        this.showAlert = true;
        this.alertType = 'success';
        this.alertMessage = `Quantité mise à jour avec succès (${this.newQuantiteAutorisee} kg)`;
        this.showEditQuantiteModal = false;
        this.editingDepot = null;
        
        // Recharger les données avec un petit délai
        setTimeout(() => {
          this.loadDepots();
          this.loadVoyages();
        }, 200);
      },
      error: (err) => {
        console.error('❌ Erreur mise à jour quantité:', err);
        this.showEditQuantiteModal = false;
        this.editingDepot = null;
        
        // Afficher un message personnalisé selon le type d'erreur
        this.showAlert = true;
        this.alertType = 'danger';
        
        if (err.status === 403) {
          // Erreur 403 - dépassement de quantité
          this.alertMessage = '⚠️ Quantité non autorisée : La quantité demandée dépasse la quantité disponible du projet.';
        } else if (err.status === 400 || err.status === 500) {
          // Autres erreurs de validation
          this.alertMessage = '❌ Impossible de modifier la quantité. Veuillez vérifier les données saisies.';
        } else {
          // Erreur générique
          this.alertMessage = '❌ Une erreur est survenue lors de la modification de la quantité.';
        }
      }
    });
  }

  cancelEditQuantite() {
    this.showEditQuantiteModal = false;
    this.editingDepot = null;
    this.newQuantiteAutorisee = 0;
  }

  // Alertes
  closeAlert() {
    this.showAlert = false;
  }

  getAlertTitle(): string {
    switch (this.alertType) {
      case 'success': return 'Succès';
      case 'danger': return 'Erreur';
      case 'warning': return 'Attention';
      case 'info': return 'Information';
      default: return '';
    }
  }

  // Calcul cumulé legacy supprimé: méthodes remplacées par version fenêtre [07:00, 06:00)

  formatDate(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Helper: retourne aujourd'hui au format yyyy-MM-dd (heure locale)
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Export PDF
  exportToPDF(): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Titre
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Liste des Dépôts', 14, 15);

    // Informations du projet
    if (this.projetActif) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      let yPos = 25;
      
      if (this.projetActif.nomNavire) {
        doc.text(`Navire: ${this.projetActif.nomNavire}`, 14, yPos);
        yPos += 6;
      }
      if (this.projetActif.port) {
        doc.text(`Port: ${this.projetActif.port}`, 14, yPos);
        yPos += 6;
      }
      if (this.projetActif.nomProduit) {
        doc.text(`Produit: ${this.projetActif.nomProduit}`, 14, yPos);
        yPos += 6;
      }
    }

    // Statistiques
    const totalDepots = this.filteredDepots.length;
    const totalVendu = this.filteredDepots.reduce((sum, d) => 
      sum + (this.getTotalLivreDepot(d.id) || 0), 0
    );

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    let statsY = this.projetActif ? 45 : 25;
    doc.text(`Total Dépôts: ${totalDepots}`, 14, statsY);
    doc.text(`Quantité Totale Vendue: ${totalVendu.toFixed(2)} kg`, 80, statsY);

    // Filtres appliqués
    // Filtres appliqués
    if (this.dateFilterActive && (this.dateDebut || this.dateFin)) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      statsY += 6;
      let filterText = 'Filtre par date: ';
      if (this.dateDebut && this.dateFin) {
        filterText += `${this.formatDate(this.dateDebut)} - ${this.formatDate(this.dateFin)}`;
      } else if (this.dateDebut) {
        filterText += `À partir du ${this.formatDate(this.dateDebut)}`;
      } else if (this.dateFin) {
        filterText += `Jusqu'au ${this.formatDate(this.dateFin)}`;
      }
      doc.text(filterText, 14, statsY);
    }

    // Préparer les données du tableau
    const tableData = this.filteredDepots.map(depot => {
      const quantiteVendue = this.getTotalLivreDepot(depot.id);
      
      return [
        depot.nom || '-',
        depot.adresse || '-',
        depot.mf || '-',
        quantiteVendue.toFixed(2)
      ];
    });

    // Générer le tableau
    autoTable(doc, {
      startY: statsY + 10,
      head: [['Nom', 'Adresse', 'Matricule Fiscal', 'Quantité Vendue (kg)']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [251, 191, 36], // Couleur jaune/orange pour les dépôts
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 80 },
        2: { cellWidth: 50 },
        3: { cellWidth: 40, halign: 'right' }
      },
      didDrawPage: (data) => {
        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${data.pageNumber} / ${pageCount} - Généré le ${new Date().toLocaleDateString('fr-FR')}`,
          14,
          pageHeight - 10
        );
      }
    });

    // Télécharger le PDF
    const fileName = `Depots_${this.projetActif?.nomNavire || 'Liste'}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
  }

  // Export Excel
  exportToExcel(): void {
    // Préparer les données
    const data = this.filteredDepots.map(depot => {
      const quantiteVendue = this.getTotalLivreDepot(depot.id);
      
      return {
        'Nom': depot.nom || '-',
        'Adresse': depot.adresse || '-',
        'Matricule Fiscal': depot.mf || '-',
        'Quantité Vendue (kg)': quantiteVendue.toFixed(2)
      };
    });

    // Créer la feuille de calcul
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // Définir la largeur des colonnes
    ws['!cols'] = [
      { wch: 30 }, // Nom
      { wch: 50 }, // Adresse
      { wch: 25 }, // MF
      { wch: 20 }  // Quantité Vendue
    ];

    // Créer le classeur
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dépôts');

    // Ajouter une feuille de statistiques
    const totalDepots = this.filteredDepots.length;
    const totalVendu = this.filteredDepots.reduce((sum, d) => 
      sum + (this.getTotalLivreDepot(d.id) || 0), 0
    );

    const statsData = [
      { 'Statistique': 'Total Dépôts', 'Valeur': totalDepots },
      { 'Statistique': 'Quantité Totale Vendue (kg)', 'Valeur': totalVendu.toFixed(2) }
    ];

    if (this.projetActif) {
      statsData.unshift(
        { 'Statistique': 'Navire', 'Valeur': this.projetActif.nomNavire || '-' },
        { 'Statistique': 'Port', 'Valeur': this.projetActif.port || '-' },
        { 'Statistique': 'Produit', 'Valeur': this.projetActif.nomProduit || '-' }
      );
    }

    const wsStats: XLSX.WorkSheet = XLSX.utils.json_to_sheet(statsData);
    wsStats['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');

    // Télécharger le fichier
    const fileName = `Depots_${this.projetActif?.nomNavire || 'Liste'}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
