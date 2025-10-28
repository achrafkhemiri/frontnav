import { Component } from '@angular/core';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetActifService } from '../../service/projet-actif.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmCodeDialogComponent } from '../../shared/confirm-code-dialog.component';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-chauffeur',
  templateUrl: './chauffeur.component.html',
  styleUrls: ['./chauffeur.component.css']
})
export class ChauffeurComponent {
  chauffeurs: ChauffeurDTO[] = [];
  filteredChauffeurs: ChauffeurDTO[] = [];
  paginatedChauffeurs: ChauffeurDTO[] = [];
  selectedChauffeur: ChauffeurDTO | null = null;
  newChauffeur: ChauffeurDTO = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
  dialogChauffeur: ChauffeurDTO = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
  editMode: boolean = false;
  showAddDialog: boolean = false;
  isSidebarOpen: boolean = true;
  chauffeurFilter: string = '';
  error: string = '';
  projetActifId: number | null = null;
  projetActif: any = null;
  contextProjetId: number | null = null;
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  Math = Math;

  // Modal de confirmation/erreur (comme pour Depot)
  showConfirmModal: boolean = false;
  showErrorModal: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalIcon: string = '';
  modalIconColor: string = '';
  chauffeurToDelete: number | null = null;

  constructor(
    private chauffeurService: ChauffeurControllerService,
    private projetService: ProjetControllerService,
    private projetActifService: ProjetActifService,
    private dialog: MatDialog
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 [Chauffeur] Notification reçue - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 [Chauffeur] Rechargement - previousId:', previousId, 'newId:', projet.id);
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
    const contextId = window.sessionStorage.getItem('projetActifId');
    if (contextId) {
      this.contextProjetId = Number(contextId);
      this.loadProjetDetails(this.contextProjetId, true);
    }
    this.loadChauffeurs();
  }

  requestDeleteChauffeur(id?: number) {
    if (id === undefined) return;

    // ouvrir la boîte de dialogue de code (même UX que Depot)
    const dialogRef = this.dialog.open(ConfirmCodeDialogComponent, { disableClose: true });
    dialogRef.afterClosed().subscribe((ok: boolean) => {
      if (ok === true) {
        this.chauffeurToDelete = id;
        this.showConfirmModal = true;
        this.modalTitle = 'Confirmer la suppression';
        this.modalMessage = 'Êtes-vous sûr de vouloir supprimer ce chauffeur ? Cette action est irréversible.';
        this.modalIcon = 'bi-trash-fill';
        this.modalIconColor = '#ef4444';
      }
    });
  }

  async confirmDelete() {
    if (this.chauffeurToDelete === null) return;

    this.chauffeurService.deleteChauffeur(this.chauffeurToDelete, 'body').subscribe({
      next: () => {
        this.showConfirmModal = false;
        this.chauffeurToDelete = null;
        this.loadChauffeurs();
      },
      error: async (err: any) => {
        console.error('Erreur suppression chauffeur:', err);
        this.showConfirmModal = false;
        this.showErrorModal = true;
        this.modalTitle = 'Erreur de suppression';

        // Prefer a clear message when backend returns 400 (entity used in voyages)
        if (err && err.status === 400) {
          this.modalMessage = 'Impossible de supprimer : ce chauffeur est référencé dans un ou plusieurs voyages.';
        } else if (err && err.status === 403) {
          this.modalMessage = 'Vous n\'avez pas les permissions nécessaires pour supprimer ce chauffeur.';
        } else {
          // Try to extract a meaningful message from backend, fallback to generic
          let errorMessage = 'Une erreur est survenue lors de la suppression.';
          if (err && err.error instanceof Blob) {
            try {
              const text = await err.error.text();
              if (text && text.trim()) errorMessage = text;
            } catch (e) {
              console.error('Erreur parsing blob error:', e);
            }
          } else if (err && err.error?.message) {
            errorMessage = err.error.message;
          } else if (err && err.message) {
            errorMessage = err.message;
          }

          // If the raw error contains DB constraint hints, translate to user-friendly text
          const errorText = JSON.stringify(err || '');
          if (errorText.includes('foreign key') || errorText.includes('constraint') || errorText.includes('DataIntegrityViolationException')) {
            errorMessage = 'Impossible de supprimer : ce chauffeur est référencé dans un ou plusieurs voyages.';
          }

          this.modalMessage = errorMessage;
        }

        this.modalIcon = 'bi-x-circle-fill';
        this.modalIconColor = '#ef4444';
      }
    });
  }

  cancelDelete() {
    this.showConfirmModal = false;
    this.chauffeurToDelete = null;
  }

  // 🔥 Méthode pour recharger toutes les données
  reloadData() {
    console.log('🔄 [Chauffeur] reloadData() - Projet actif:', this.projetActif?.nom, 'ID:', this.projetActifId);
    
    const currentUrl = window.location.pathname;
    const isOnParametrePage = currentUrl.includes('/parametre');
    
    if (isOnParametrePage) {
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        const contextIdNumber = Number(contextId);
        console.log('📌 [Chauffeur] Page paramètre - Contexte:', contextIdNumber);
        this.contextProjetId = contextIdNumber;
        if (contextIdNumber !== this.projetActifId) {
          this.loadProjetDetails(this.contextProjetId, true);
        } else {
          this.contextProjet = this.projetActif;
        }
      }
    } else {
      console.log('🏠 [Chauffeur] Mode Vue Projet Actif - Projet:', this.projetActif?.nom);
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    this.loadChauffeurs();
    this.updateBreadcrumb();
  }

  canAddData(): boolean {
    if (this.contextProjet) return this.contextProjet.active === true;
    return true;
  }

  loadProjetDetails(projetId: number, isContext: boolean = false) {
    this.projetService.getProjetById(projetId, 'body').subscribe({
      next: (data: any) => {
        if (isContext) {
          this.contextProjet = data;
          this.updateBreadcrumb();
        }
      },
      error: (err: any) => console.error('Erreur chargement projet:', err)
    });
  }

  updateBreadcrumb() {
    if (this.contextProjet) {
      this.breadcrumbItems = [
        { label: 'Projets', url: '/projets' },
        { label: this.contextProjet.nom, url: `/projet/${this.contextProjet.id}` },
        { label: 'Paramètres', url: `/projet/${this.contextProjet.id}/parametre` },
        { label: 'Chauffeurs' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'Chauffeurs' }
      ];
    }
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.chauffeurs = json;
              this.filteredChauffeurs = [...this.chauffeurs];
            } else {
              this.chauffeurs = [];
              this.filteredChauffeurs = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.chauffeurs = [];
          }
        } else if (Array.isArray(data)) {
          this.chauffeurs = data;
          this.filteredChauffeurs = [...this.chauffeurs];
        } else {
          this.chauffeurs = [];
          this.filteredChauffeurs = [];
        }
        this.updatePagination();
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  addChauffeur() {
    const payload = {
      nom: this.newChauffeur.nom,
      numCin: this.newChauffeur.numCin
    };
    this.chauffeurService.createChauffeur(payload as any, 'body').subscribe({
      next: () => {
        this.newChauffeur = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
        this.loadChauffeurs(); // Recharge la liste après ajout
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  selectChauffeur(ch: ChauffeurDTO) {
    this.selectedChauffeur = { ...ch };
    this.editMode = true;
  }

  updateChauffeur() {
    // Use the dialog model for updates (dialogChauffeur is bound to the inputs)
    if (!this.dialogChauffeur?.id) return;
    const id = this.dialogChauffeur.id;
    this.chauffeurService.updateChauffeur(id, this.dialogChauffeur, 'body').subscribe({
      next: (updated) => {
        // Some backends may return blob/text; to ensure UI is up-to-date we reload the list
        // This guarantees the updated values are reflected without requiring a full page reload.
        this.loadChauffeurs();
        this.selectedChauffeur = null;
        this.editMode = false;
        this.showAddDialog = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  deleteChauffeur(id?: number) {
    if (id === undefined) return;
    this.chauffeurService.deleteChauffeur(id, 'body').subscribe({
      next: () => {
        this.chauffeurs = this.chauffeurs.filter(c => c.id !== id);
        this.filteredChauffeurs = [...this.chauffeurs];
        this.updatePagination();
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedChauffeur = null;
    this.editMode = false;
  }

  filterChauffeurs() {
    if (!this.chauffeurFilter.trim()) {
      this.filteredChauffeurs = [...this.chauffeurs];
    } else {
      const filter = this.chauffeurFilter.toLowerCase();
      this.filteredChauffeurs = this.chauffeurs.filter(ch => 
        ch.nom?.toLowerCase().includes(filter) ||
        ch.numCin?.toLowerCase().includes(filter)
      );
    }
    this.updatePagination();
  }
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortChauffeurs();
  }
  
  sortChauffeurs() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredChauffeurs.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof ChauffeurDTO];
      let bVal: any = b[this.sortColumn as keyof ChauffeurDTO];
      
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
    this.totalPages = Math.ceil(this.filteredChauffeurs.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedChauffeurs = this.filteredChauffeurs.slice(startIndex, endIndex);
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

  openAddDialog() {
    this.dialogChauffeur = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
    this.editMode = false;
    this.showAddDialog = true;
  }

  editChauffeur(chauffeur: ChauffeurDTO) {
    this.dialogChauffeur = { ...chauffeur };
    this.editMode = true;
    this.showAddDialog = true;
  }

  saveChauffeur() {
    if (this.contextProjet && this.contextProjet.active === false) {
      this.error = 'Ce projet n\'est pas actif.';
      return;
    }
    const payload = {
      nom: this.dialogChauffeur.nom,
      numCin: this.dialogChauffeur.numCin
    };
    this.chauffeurService.createChauffeur(payload as any, 'body').subscribe({
      next: () => {
        this.showAddDialog = false;
        this.loadChauffeurs();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  cancel() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogChauffeur = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
  }
}
