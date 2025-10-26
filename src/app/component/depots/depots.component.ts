import { Component } from '@angular/core';
import { DepotControllerService } from '../../api/api/depotController.service';
import { DepotDTO } from '../../api/model/depotDTO';

@Component({
  selector: 'app-depots',
  templateUrl: './depots.component.html',
  styleUrls: ['./depots.component.css']
})
export class DepotsComponent {
  depots: DepotDTO[] = [];
  filteredDepots: DepotDTO[] = [];
  paginatedDepots: DepotDTO[] = [];
  selectedDepot: DepotDTO | null = null;
  dialogDepot: DepotDTO = { nom: '', adresse: '', mf: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  depotFilter: string = '';
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  Math = Math;

  constructor(private depotService: DepotControllerService) {
    this.loadAllDepots();
  }

  loadAllDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          console.log('getAllDepots - blob text:', text);
          try {
            const json = JSON.parse(text);
            console.log('getAllDepots - parsed json:', json);
            if (Array.isArray(json)) {
              this.depots = json;
            } else {
              this.depots = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.depots = [];
          }
        } else if (Array.isArray(data)) {
          console.log('getAllDepots - json array, length:', data.length);
          this.depots = data;
        } else {
          console.log('getAllDepots - unexpected response:', data);
          this.depots = [];
        }
        this.filteredDepots = this.depots;
        this.updatePagination();
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des dépôts';
        console.error(err);
        this.depots = [];
        this.filteredDepots = [];
      }
    });
  }

  filterDepots() {
    if (this.depotFilter.trim() === '') {
      this.filteredDepots = this.depots;
    } else {
      this.filteredDepots = this.depots.filter(depot =>
        depot.nom?.toLowerCase().includes(this.depotFilter.toLowerCase())
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
    this.sortDepots();
    this.updatePagination();
  }

  sortDepots() {
    this.filteredDepots.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (this.sortColumn) {
        case 'id':
          aVal = a.id ?? 0;
          bVal = b.id ?? 0;
          break;
        case 'nom':
          aVal = a.nom ?? '';
          bVal = b.nom ?? '';
          break;
        case 'adresse':
          aVal = a.adresse ?? '';
          bVal = b.adresse ?? '';
          break;
        case 'mf':
          aVal = a.mf ?? '';
          bVal = b.mf ?? '';
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredDepots.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
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

  openAddDialog() {
    this.dialogDepot = { nom: '', adresse: '', mf: '' };
    this.showAddDialog = true;
    this.editMode = false;
  }

  saveDepot() {
    if (this.dialogDepot.nom) {
      this.depotService.createDepot(this.dialogDepot).subscribe({
        next: () => {
          this.loadAllDepots();
          this.showAddDialog = false;
          this.dialogDepot = { nom: '', adresse: '', mf: '' };
        },
        error: (err) => {
          this.error = 'Erreur lors de la création du dépôt';
          console.error(err);
        }
      });
    }
  }

  editDepot(depot: DepotDTO) {
    this.selectedDepot = depot;
    this.dialogDepot = { 
      id: depot.id,
      nom: depot.nom,
      adresse: depot.adresse,
      mf: depot.mf,
      projetId: depot.projetId
    };
    this.editMode = true;
    this.showAddDialog = true;
  }

  updateDepot() {
    if (this.dialogDepot && this.dialogDepot.id) {
      this.depotService.updateDepot(this.dialogDepot.id, this.dialogDepot).subscribe({
        next: () => {
          this.loadAllDepots();
          this.showAddDialog = false;
          this.selectedDepot = null;
          this.dialogDepot = { nom: '', adresse: '', mf: '' };
          this.editMode = false;
        },
        error: (err) => {
          this.error = 'Erreur lors de la mise à jour du dépôt';
          console.error(err);
        }
      });
    }
  }

  deleteDepot(depot: DepotDTO) {
    if (depot.id && confirm('Êtes-vous sûr de vouloir supprimer ce dépôt ?')) {
      this.depotService.deleteDepot(depot.id).subscribe({
        next: () => {
          this.loadAllDepots();
        },
        error: (err) => {
          this.error = 'Erreur lors de la suppression du dépôt';
          console.error(err);
        }
      });
    }
  }

  cancel() {
    this.showAddDialog = false;
    this.selectedDepot = null;
    this.dialogDepot = { nom: '', adresse: '', mf: '' };
    this.editMode = false;
  }
}