import { Component } from '@angular/core';
import { CamionControllerService } from '../../api/api/camionController.service';
import { CamionDTO } from '../../api/model/camionDTO';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetActifService } from '../../service/projet-actif.service';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-camion',
  templateUrl: './camion.component.html',
  styleUrls: ['./camion.component.css']
})
export class CamionComponent {
  camions: CamionDTO[] = [];
  filteredCamions: CamionDTO[] = [];
  paginatedCamions: CamionDTO[] = [];
  selectedCamion: CamionDTO | null = null;
  newCamion: CamionDTO = { matricule: '', societe: '', numBonLivraison: '' };
  dialogCamion: CamionDTO = { matricule: '', societe: '', numBonLivraison: '' };
  editMode: boolean = false;
  showAddDialog: boolean = false;
  isSidebarOpen: boolean = true;
  camionFilter: string = '';
  error: string = '';
  projetActifId: number | null = null;
  projetActif: any = null;
  // Context project (if visiting a project page)
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

  constructor(
    private camionService: CamionControllerService,
    private projetService: ProjetControllerService,
    private projetActifService: ProjetActifService
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 [Camion] Notification reçue - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 [Camion] Rechargement - previousId:', previousId, 'newId:', projet.id);
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
    // check session context
    const contextId = window.sessionStorage.getItem('projetActifId');
    if (contextId) {
      this.contextProjetId = Number(contextId);
      this.loadProjetDetails(this.contextProjetId, true);
    }
    this.loadCamions();
  }

  // 🔥 Méthode pour recharger toutes les données
  reloadData() {
    console.log('🔄 [Camion] reloadData() - Projet actif:', this.projetActif?.nom, 'ID:', this.projetActifId);
    
    const currentUrl = window.location.pathname;
    const isOnParametrePage = currentUrl.includes('/parametre');
    
    if (isOnParametrePage) {
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        const contextIdNumber = Number(contextId);
        console.log('📌 [Camion] Page paramètre - Contexte:', contextIdNumber);
        this.contextProjetId = contextIdNumber;
        if (contextIdNumber !== this.projetActifId) {
          this.loadProjetDetails(this.contextProjetId, true);
        } else {
          this.contextProjet = this.projetActif;
        }
      }
    } else {
      console.log('🏠 [Camion] Mode Vue Projet Actif - Projet:', this.projetActif?.nom);
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    this.loadCamions();
    this.updateBreadcrumb();
  }

  canAddData(): boolean {
    if (this.contextProjet) return this.contextProjet.active === true;
    // no projet context -> allow by default
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
        { label: 'Camions' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'Camions' }
      ];
    }
  }

  loadCamions() {
    this.camionService.getAllCamions('body').subscribe({
      next: async (data) => {
        // Si la réponse est un Blob, on la parse en JSON
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.camions = json;
              this.filteredCamions = [...this.camions];
            } else {
              this.camions = [];
              this.filteredCamions = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.camions = [];
          }
        } else if (Array.isArray(data)) {
          this.camions = data;
          this.filteredCamions = [...this.camions];
        } else {
          this.camions = [];
          this.filteredCamions = [];
        }
        this.updatePagination();
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  addCamion() {
    // simple guard: if visiting inactive project, prevent
    if (this.contextProjet && this.contextProjet.active === false) {
      this.error = 'Ce projet n\'est pas actif.';
      return;
    }
    this.camionService.createCamion(this.newCamion, 'body').subscribe({
      next: () => {
        this.newCamion = { matricule: '', societe: '', numBonLivraison: '' };
        this.loadCamions(); // Recharge la liste après ajout
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  selectCamion(cam: CamionDTO) {
    this.selectedCamion = { ...cam };
    this.editMode = true;
  }

  updateCamion() {
    if (!this.selectedCamion?.id) return;
    this.camionService.createCamion(this.selectedCamion, 'body').subscribe({
      next: (updated) => {
        const idx = this.camions.findIndex(c => c.id === updated.id);
        if (idx > -1) this.camions[idx] = updated;
        this.filteredCamions = [...this.camions];
        this.updatePagination();
        this.selectedCamion = null;
        this.editMode = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  deleteCamion(id?: number) {
    if (id === undefined) return;
    this.camionService.deleteCamion(id, 'body').subscribe({
      next: () => {
        this.camions = this.camions.filter(c => c.id !== id);
        this.filteredCamions = [...this.camions];
        this.updatePagination();
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedCamion = null;
    this.editMode = false;
  }

  filterCamions() {
    if (!this.camionFilter.trim()) {
      this.filteredCamions = [...this.camions];
    } else {
      const filter = this.camionFilter.toLowerCase();
      this.filteredCamions = this.camions.filter(cam => 
        cam.matricule?.toLowerCase().includes(filter) ||
        cam.societe?.toLowerCase().includes(filter)
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
    this.sortCamions();
  }
  
  sortCamions() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredCamions.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof CamionDTO];
      let bVal: any = b[this.sortColumn as keyof CamionDTO];
      
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
    this.totalPages = Math.ceil(this.filteredCamions.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedCamions = this.filteredCamions.slice(startIndex, endIndex);
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
    this.dialogCamion = { matricule: '', societe: '', numBonLivraison: '' };
    this.editMode = false;
    this.showAddDialog = true;
  }

  editCamion(camion: CamionDTO) {
    this.dialogCamion = { ...camion };
    this.editMode = true;
    this.showAddDialog = true;
  }

  saveCamion() {
    this.camionService.createCamion(this.dialogCamion, 'body').subscribe({
      next: () => {
        this.showAddDialog = false;
        this.loadCamions();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  cancel() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogCamion = { matricule: '', societe: '', numBonLivraison: '' };
  }
}
