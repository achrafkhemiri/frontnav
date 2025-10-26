import { Component } from '@angular/core';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ClientDTO } from '../../api/model/clientDTO';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.css']
})
export class ClientsComponent {
  clients: ClientDTO[] = [];
  filteredClients: ClientDTO[] = [];
  paginatedClients: ClientDTO[] = [];
  selectedClient: ClientDTO | null = null;
  newClient: ClientDTO = { nom: '', numero: '', adresse: '', mf: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddClient: boolean = false;
  clientFilter: string = '';
  dialogClient: ClientDTO = { nom: '', numero: '', adresse: '', mf: '' };
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  Math = Math;

  constructor(
    private clientService: ClientControllerService
  ) {
    this.loadAllClients();
  }

  loadAllClients() {
    this.clientService.getAllClients('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.clients = json;
            } else {
              this.clients = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.clients = [];
          }
        } else if (Array.isArray(data)) {
          this.clients = data;
        } else {
          this.clients = [];
        }
        this.filteredClients = this.clients;
        this.updatePagination();
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des clients';
        console.error(err);
        this.clients = [];
        this.filteredClients = [];
      }
    });
  }

  filterClients() {
    if (this.clientFilter.trim() === '') {
      this.filteredClients = this.clients;
    } else {
      this.filteredClients = this.clients.filter(client =>
        client.nom?.toLowerCase().includes(this.clientFilter.toLowerCase()) ||
        client.numero?.toLowerCase().includes(this.clientFilter.toLowerCase())
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
    this.sortClients();
    this.updatePagination();
  }

  sortClients() {
    this.filteredClients.sort((a, b) => {
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
        case 'numero':
          aVal = a.numero ?? '';
          bVal = b.numero ?? '';
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
    this.totalPages = Math.ceil(this.filteredClients.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedClients = this.filteredClients.slice(startIndex, endIndex);
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

  selectClient(client: ClientDTO) {
    this.selectedClient = client;
    this.editMode = false;
  }

  addClient() {
    this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
    this.showAddClient = true;
    this.editMode = false;
  }

  saveClient() {
    if (this.dialogClient.nom && this.dialogClient.numero) {
      this.clientService.createClient(this.dialogClient).subscribe({
        next: () => {
          this.loadAllClients();
          this.showAddClient = false;
          this.dialogClient = { nom: '', numero: '', adresse: '', mf: '' };
        },
        error: (err) => {
          this.error = 'Erreur lors de la création du client';
          console.error(err);
        }
      });
    }
  }

  editClient(client: ClientDTO) {
    this.dialogClient = {
      id: client.id,
      nom: client.nom,
      numero: client.numero,
      adresse: client.adresse,
      mf: client.mf,
      quantitesAutoriseesParProjet: client.quantitesAutoriseesParProjet
    };
    this.editMode = true;
    this.showAddClient = true;
  }

  updateClient() {
    if (this.dialogClient.id) {
      this.clientService.updateClient(this.dialogClient.id, this.dialogClient).subscribe({
        next: () => {
          this.loadAllClients();
          this.showAddClient = false;
          this.editMode = false;
        },
        error: (err) => {
          this.error = 'Erreur lors de la mise à jour du client';
          console.error(err);
        }
      });
    }
  }

  deleteClient(client: ClientDTO) {
    if (client.id && confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      this.clientService.deleteClient(client.id).subscribe({
        next: () => {
          this.loadAllClients();
        },
        error: (err) => {
          this.error = 'Erreur lors de la suppression du client';
          console.error(err);
        }
      });
    }
  }

  cancel() {
    this.showAddClient = false;
    this.editMode = false;
  }
}