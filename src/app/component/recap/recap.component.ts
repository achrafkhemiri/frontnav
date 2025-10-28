import { Component, HostListener, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { ClientControllerService } from '../../api/api/clientController.service';
import { ClientDTO } from '../../api/model/clientDTO';
import { CamionControllerService } from '../../api/api/camionController.service';
import { CamionDTO } from '../../api/model/camionDTO';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ProjetClientDTO } from '../../api/model/projetClientDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { HttpClient } from '@angular/common/http';
import { BASE_PATH } from '../../api/variables';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-recap',
  templateUrl: './recap.component.html',
  styleUrls: ['./recap.component.css']
})
export class RecapComponent {
  voyages: VoyageDTO[] = [];
  filteredVoyages: VoyageDTO[] = [];
  paginatedVoyages: VoyageDTO[] = [];
  clients: ClientDTO[] = [];
  camions: CamionDTO[] = [];
  chauffeurs: ChauffeurDTO[] = [];
  projetsClients: ProjetClientDTO[] = [];
  
  selectedClient: ClientDTO | null = null;
  clientSearchInput: string = '';
  filteredClientsSearch: ClientDTO[] = [];
  showClientDropdown: boolean = false;
  
  projetActifId: number | null = null;
  contextProjetId: number | null = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  
  isSidebarOpen: boolean = true;
  voyageFilter: string = '';
  // Autorisation code filter
  autorisationCodes: string[] = [];
  selectedAutorisationCode: string = '';
  
  // Filtre par date
  dateDebut: string = '';
  dateFin: string = '';
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  Math = Math;

  constructor(
    private voyageService: VoyageControllerService,
    private clientService: ClientControllerService,
    private camionService: CamionControllerService,
    private chauffeurService: ChauffeurControllerService,
    private projetService: ProjetControllerService,
    private projetClientService: ProjetClientControllerService,
    private route: ActivatedRoute,
    private http: HttpClient,
    @Inject(BASE_PATH) private basePath: string
  ) {
    this.initializeContext();
  }

  initializeContext() {
    // Get context from route or session storage
    this.route.paramMap.subscribe(pm => {
      const idParam = pm.get('id');
      if (idParam) {
        this.contextProjetId = Number(idParam);
        window.sessionStorage.setItem('projetActifId', idParam);
        this.loadProjetDetails(this.contextProjetId);
      } else {
        // Si pas d'ID dans la route, essayer de récupérer depuis sessionStorage
        const contextId = window.sessionStorage.getItem('projetActifId');
        if (contextId) {
          this.contextProjetId = Number(contextId);
          this.loadProjetDetails(this.contextProjetId);
        }
      }
    });

    // Load data
    this.loadClients();
    this.loadCamions();
    this.loadChauffeurs();
    this.loadProjetsClients();
    this.updateBreadcrumb();
  }

  loadProjetDetails(projetId: number) {
    this.projetService.getProjetById(projetId, 'body').subscribe({
      next: (data: any) => {
        console.log('Projet chargé:', data);
        this.updateBreadcrumb();
      },
      error: (err: any) => {
        console.error('Erreur chargement projet:', err);
      }
    });
  }

  updateBreadcrumb() {
    if (this.contextProjetId) {
      this.breadcrumbItems = [
        { label: 'Projets', url: '/projet' },
        { label: `Projet ${this.contextProjetId}`, url: `/projet/${this.contextProjetId}/parametre` },
        { label: 'Récapitulatif par Client' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'Récapitulatif par Client' }
      ];
    }
  }

  loadClients() {
    const projetId = this.contextProjetId || this.projetActifId;
    
    if (projetId) {
      // Load clients for specific project
      this.clientService.getClientsByProjet(projetId, 'body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              this.clients = JSON.parse(text);
            } catch (e) {
              this.clients = [];
            }
          } else {
            this.clients = Array.isArray(data) ? data : [];
          }
          console.log('Clients chargés:', this.clients);
        },
        error: (err) => {
          console.error('Erreur chargement clients:', err);
          this.clients = [];
        }
      });
    } else {
      // Load all clients
      this.clientService.getAllClients('body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              this.clients = JSON.parse(text);
            } catch (e) {
              this.clients = [];
            }
          } else {
            this.clients = Array.isArray(data) ? data : [];
          }
          console.log('Clients chargés:', this.clients);
        },
        error: (err) => {
          console.error('Erreur chargement clients:', err);
          this.clients = [];
        }
      });
    }
  }

  loadCamions() {
    this.camionService.getAllCamions('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            this.camions = JSON.parse(text);
          } catch (e) {
            this.camions = [];
          }
        } else {
          this.camions = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur chargement camions:', err);
        this.camions = [];
      }
    });
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            this.chauffeurs = JSON.parse(text);
          } catch (e) {
            this.chauffeurs = [];
          }
        } else {
          this.chauffeurs = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur chargement chauffeurs:', err);
        this.chauffeurs = [];
      }
    });
  }

  loadProjetsClients() {
    const projetId = this.contextProjetId || this.projetActifId;

    if (!projetId) {
      this.projetsClients = [];
      return;
    }

    // Try to load projet-client associations which may contain 'autorisation' arrays per client
    const projetClientsUrl = `${this.basePath}/api/projet-client/projet/${projetId}`;
    this.http.get<any[]>(projetClientsUrl, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
      next: (projetClients) => {
        if (!Array.isArray(projetClients) || projetClients.length === 0) {
          // fallback: use clients endpoint
          this.clientService.getClientsByProjet(projetId, 'body').subscribe({
            next: (data: any) => {
              const clients = Array.isArray(data) ? data : [];
              this.projetsClients = clients.map((client: any) => ({ projetId, clientId: client.id, quantiteAutorisee: client.quantitesAutoriseesParProjet?.[projetId] || client.quantiteAutorisee || 0 }));
            },
            error: (err) => { console.error('Erreur fallback clients:', err); this.projetsClients = []; }
          });
          return;
        }

        // Load full client details and enrich with autorisation arrays
        const clientIds = [...new Set(projetClients.map((pc: any) => pc.clientId))];
        this.http.get<any[]>(`${this.basePath}/api/clients`, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
          next: (allClients) => {
            const filtered = Array.isArray(allClients) ? allClients.filter((c: any) => clientIds.includes(c.id)) : [];
            this.clients = filtered.map((client: any) => {
              const pc = projetClients.find((p: any) => p.clientId === client.id) || {};
              const autorisations = pc.autorisation || [];
              const sumAutorisation = Array.isArray(autorisations) && autorisations.length > 0 ? autorisations.reduce((s: number, a: any) => s + (a?.quantite || 0), 0) : (pc.quantiteAutorisee || client.quantiteAutorisee || 0);
              const quantitesMap: any = {};
              quantitesMap[projetId] = sumAutorisation;
              return {
                ...client,
                projetClientId: pc.id,
                autorisation: autorisations,
                quantiteAutorisee: sumAutorisation,
                quantitesAutoriseesParProjet: quantitesMap,
                projetId: projetId
              };
            });

            this.projetsClients = this.clients.map((c: any) => ({ id: c.projetClientId || c.id, projetId, clientId: c.id, quantiteAutorisee: c.quantiteAutorisee || 0, autorisation: (c as any).autorisation }));
            console.log('ProjetsClients enrichis:', this.projetsClients.length);
          },
          error: (err) => { console.error('Erreur chargement clients details:', err); this.projetsClients = []; }
        });
      },
      error: (err) => {
        console.error('Erreur chargement projet-clients:', err);
        // fallback to clientService
        this.clientService.getClientsByProjet(projetId, 'body').subscribe({ next: (data: any) => { const clients = Array.isArray(data) ? data : []; this.projetsClients = clients.map((client: any) => ({ projetId, clientId: client.id, quantiteAutorisee: client.quantitesAutoriseesParProjet?.[projetId] || client.quantiteAutorisee || 0 })); }, error: () => { this.projetsClients = []; } });
      }
    });
  }

  // Client search
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clientInput = target.closest('.client-search-container');
    if (!clientInput && this.showClientDropdown) {
      this.showClientDropdown = false;
    }
  }

  onClientSearchInput(): void {
    const searchValue = this.clientSearchInput.trim().toLowerCase();
    
    if (!searchValue || searchValue.length < 2) {
      this.showClientDropdown = false;
      this.filteredClientsSearch = [];
      return;
    }
    
    this.filteredClientsSearch = this.clients.filter(client => 
      client.nom?.toLowerCase().includes(searchValue) ||
      client.numero?.toLowerCase().includes(searchValue)
    ).slice(0, 10);
    
    this.showClientDropdown = this.filteredClientsSearch.length > 0;
  }

  selectClient(client: ClientDTO): void {
    this.selectedClient = client;
    this.clientSearchInput = `${client.nom} (${client.numero || 'N/A'})`;
    this.showClientDropdown = false;
    
    // Log pour déboguer
    console.log('Client sélectionné:', client);
    const projetId = this.contextProjetId || this.projetActifId;
    console.log('ProjetId actif:', projetId);
    
    // Vérifier si le client a les informations de quantité
    const clientData = client as any;
    if (clientData.quantitesAutoriseesParProjet && projetId) {
      console.log('Quantités autorisées par projet:', clientData.quantitesAutoriseesParProjet);
      console.log('Quantité pour ce projet:', clientData.quantitesAutoriseesParProjet[projetId]);
    }
    if (clientData.quantiteAutorisee !== undefined) {
      console.log('Quantité totale autorisée globale:', clientData.quantiteAutorisee);
    }
    
    this.loadVoyagesForClient();
    // Populate available autorisation codes for the selected client
    this.populateAutorisationCodesForSelectedClient();
  }

  populateAutorisationCodesForSelectedClient(): void {
    if (!this.selectedClient || !this.selectedClient.id) {
      this.autorisationCodes = [];
      this.selectedAutorisationCode = '';
      return;
    }
    const auths = this.getClientAutorisations(this.selectedClient.id) || [];
    const codes = Array.isArray(auths) ? auths.map((a: any) => a.code).filter((c: any) => !!c) : [];
    // unique
    this.autorisationCodes = Array.from(new Set(codes));
    // reset selected code to show all by default
    this.selectedAutorisationCode = '';
  }

  loadVoyagesForClient(): void {
    if (!this.selectedClient || !this.selectedClient.id) {
      this.voyages = [];
      this.filteredVoyages = [];
      this.paginatedVoyages = [];
      return;
    }

    const projetId = this.contextProjetId || this.projetActifId;
    
    if (projetId) {
      // Load voyages for the project
      this.voyageService.getVoyagesByProjet(projetId, 'body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const allVoyages = JSON.parse(text);
              // Filter for selected client
              this.voyages = allVoyages.filter((v: VoyageDTO) => v.clientId === this.selectedClient!.id);
            } catch (e) {
              this.voyages = [];
            }
          } else {
            const allVoyages = Array.isArray(data) ? data : [];
            this.voyages = allVoyages.filter((v: VoyageDTO) => v.clientId === this.selectedClient!.id);
          }
          
          // Sort by date descending
          this.voyages.sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return b.date.localeCompare(a.date);
          });
          
          this.applyFilter();
          console.log('Voyages chargés pour le client:', this.voyages);
        },
        error: (err) => {
          console.error('Erreur chargement voyages:', err);
          this.voyages = [];
          this.filteredVoyages = [];
          this.paginatedVoyages = [];
        }
      });
    } else {
      // Load all voyages and filter
      this.voyageService.getAllVoyages('body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const allVoyages = JSON.parse(text);
              this.voyages = allVoyages.filter((v: VoyageDTO) => v.clientId === this.selectedClient!.id);
            } catch (e) {
              this.voyages = [];
            }
          } else {
            const allVoyages = Array.isArray(data) ? data : [];
            this.voyages = allVoyages.filter((v: VoyageDTO) => v.clientId === this.selectedClient!.id);
          }
          
          // Sort by date descending
          this.voyages.sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return b.date.localeCompare(a.date);
          });
          
          this.applyFilter();
          console.log('Voyages chargés pour le client:', this.voyages);
        },
        error: (err) => {
          console.error('Erreur chargement voyages:', err);
          this.voyages = [];
          this.filteredVoyages = [];
          this.paginatedVoyages = [];
        }
      });
    }
  }

  applyFilter(): void {
    const filter = this.voyageFilter.trim().toLowerCase();
    
    // Appliquer le filtre texte
    let result = this.voyages;
    
    if (filter) {
      result = result.filter(v =>
        v.numBonLivraison?.toLowerCase().includes(filter) ||
        v.numTicket?.toLowerCase().includes(filter) ||
        this.getCamionMatricule(v.camionId).toLowerCase().includes(filter) ||
        this.getChauffeurNom(v.chauffeurId).toLowerCase().includes(filter)
      );
    }
    
    // Appliquer le filtre par date avec journée de travail (7h00 → 6h00 lendemain)
    if (this.dateDebut || this.dateFin) {
      const startDate = this.dateDebut ? new Date(this.dateDebut + 'T00:00:00') : new Date('1900-01-01');
      const endDate = this.dateFin ? new Date(this.dateFin + 'T00:00:00') : new Date();
      
      result = result.filter(v => {
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
    
    // Appliquer le filtre par code d'autorisation si sélectionné
    if (this.selectedAutorisationCode && this.selectedAutorisationCode.trim() !== '') {
      const code = this.selectedAutorisationCode;
      result = result.filter(v => {
        const vCode = (v as any).autorisationCode || (v as any).autorisation?.code || '';
        return vCode === code;
      });
    }

    this.filteredVoyages = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortVoyages();
  }

  sortVoyages(): void {
    this.filteredVoyages.sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;

      if (this.sortColumn === 'matricule') {
        aVal = this.getCamionMatricule(a.camionId);
        bVal = this.getCamionMatricule(b.camionId);
      } else {
        aVal = a[this.sortColumn];
        bVal = b[this.sortColumn];
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredVoyages.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedVoyages = this.filteredVoyages.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Helper methods
  getCamionMatricule(camionId: number | undefined): string {
    if (!camionId) return 'N/A';
    const camion = this.camions.find(c => c.id === camionId);
    return camion?.matricule || 'N/A';
  }

  getChauffeurNom(chauffeurId: number | undefined): string {
    if (!chauffeurId) return 'N/A';
    const chauffeur = this.chauffeurs.find(ch => ch.id === chauffeurId);
    return chauffeur?.nom || 'N/A';
  }

  getQuantiteAutorisee(clientId: number | undefined): number {
    if (!clientId) return 0;
    
    const projetId = this.contextProjetId || this.projetActifId;
    
    // Essayer d'abord de récupérer depuis selectedClient
    if (this.selectedClient && this.selectedClient.id === clientId) {
      const client = this.selectedClient as any;
      if (client.quantitesAutoriseesParProjet && projetId) {
        const quantite = client.quantitesAutoriseesParProjet[projetId];
        if (quantite !== undefined) {
          console.log(`Quantité totale autorisée pour client ${clientId} depuis selectedClient:`, quantite);
          return quantite;
        }
      }
      if (client.quantiteAutorisee !== undefined) {
        console.log(`Quantité totale autorisée pour client ${clientId} depuis selectedClient.quantiteAutorisee:`, client.quantiteAutorisee);
        return client.quantiteAutorisee;
      }
    }
    
    // Ensuite depuis la liste des clients
    const client = this.clients.find(c => c.id === clientId) as any;
    if (client) {
      if (client.quantitesAutoriseesParProjet && projetId) {
        const quantite = client.quantitesAutoriseesParProjet[projetId];
        if (quantite !== undefined) {
          console.log(`Quantité autorisée pour client ${clientId} depuis clients list:`, quantite);
          return quantite;
        }
      }
      if (client.quantiteAutorisee !== undefined) {
        console.log(`Quantité autorisée pour client ${clientId} depuis clients list.quantiteAutorisee:`, client.quantiteAutorisee);
        return client.quantiteAutorisee;
      }
    }
    
    // Enfin depuis projetsClients
    const projetClient = this.projetsClients.find(pc => pc.clientId === clientId);
    if (projetClient && projetClient.quantiteAutorisee !== undefined) {
      console.log(`Quantité autorisée pour client ${clientId} depuis projetsClients:`, projetClient.quantiteAutorisee);
      return projetClient.quantiteAutorisee;
    }
    
    console.log(`Aucune quantité autorisée trouvée pour client ${clientId}`);
    return 0;
  }

  // Retourne la liste des autorisations (codes) pour un client donné
  getClientAutorisations(clientId?: number): any[] {
    if (!clientId) return [];
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return [];
    // Prefer enriched client object
    const client = this.clients.find(c => c.id === clientId) as any;
    if (client && client.autorisation && Array.isArray(client.autorisation)) {
      return client.autorisation;
    }
    // Fallback to projetsClients entry
    const pc = this.projetsClients.find(p => p.projetId === projetId && p.clientId === clientId) as any;
    if (pc && pc.autorisation && Array.isArray(pc.autorisation)) return pc.autorisation;
    return [];
  }

  // Quantité autorisée pour un client + code
  getQuantiteAutoriseeForCode(clientId?: number, code?: string): number {
    if (!clientId || !code) return 0;
    const autorisations = this.getClientAutorisations(clientId);
    const a = autorisations.find((x: any) => x.code === code);
    return a ? Number(a.quantite || 0) : 0;
  }

  // Total livré pour client+code (depuis voyages chargés)
  getTotalLivreClientForCode(clientId: number | undefined, code?: string): number {
    if (!clientId || !code) return 0;
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return 0;
    // Sum across voyages for this client in the current project (filtered voyages already reflect client)
    const allVoyages = this.voyages || [];
    const list = allVoyages.filter(v => v.clientId === clientId && (v as any).autorisationCode === code && v.projetId === projetId);
    return list.reduce((s, v) => s + (v.poidsClient || 0), 0);
  }

  // Reste pour client+code
  getResteClientForCode(clientId: number | undefined, code?: string): number {
    const q = this.getQuantiteAutoriseeForCode(clientId, code);
    const livre = this.getTotalLivreClientForCode(clientId, code);
    return q - livre;
  }

  getTotalLivre(): number {
    return this.filteredVoyages.reduce((sum, v) => sum + (v.poidsClient || 0), 0);
  }

  getReste(): number {
    if (!this.selectedClient || !this.selectedClient.id) return 0;
    const quantiteAutorisee = this.getQuantiteAutorisee(this.selectedClient.id);
    const totalLivre = this.voyages.reduce((sum, v) => sum + (v.poidsClient || 0), 0);
    return quantiteAutorisee - totalLivre;
  }

  // Calculer le reste cumulé après chaque voyage (pour affichage dans le tableau)
  // NOTE: compute against the full voyages list, based on dates, so UI filters (date) don't change the remainder
  getResteCumule(voyage: any, index: number): number {
    if (!this.selectedClient || !this.selectedClient.id) return 0;

    const clientId = this.selectedClient.id;
    const quantiteAutorisee = this.getQuantiteAutorisee(clientId);

    // Use the full voyages loaded for this client (this.voyages) so filters don't affect remainder
    const all = Array.isArray(this.voyages) ? this.voyages : [];

    // Determine the target date for the voyage; if missing, treat as far future (include all)
    const targetDate = voyage && voyage.date ? new Date(voyage.date) : null;

    let totalLivreJusquIci = 0;
    for (const v of all) {
      if (!v) continue;
      if (v.clientId !== clientId) continue;
      if (targetDate && v.date) {
        const d = new Date(v.date);
        if (d <= targetDate) totalLivreJusquIci += (v.poidsClient || 0);
      } else if (!targetDate) {
        // if voyage has no date, include everything
        totalLivreJusquIci += (v.poidsClient || 0);
      }
    }

    return quantiteAutorisee - totalLivreJusquIci;
  }

  // Calculer le reste cumulé pour un voyage donné en fonction du code d'autorisation
  // NOTE: compute against the full voyages list, based on dates, so UI filters (date) don't change the remainder
  getResteCumuleForVoyageByCode(voyage: any, index: number): number {
    if (!this.selectedClient || !this.selectedClient.id) return 0;
    const clientId = this.selectedClient.id;
    const code = (voyage as any).autorisationCode || (voyage as any).autorisation?.code || undefined;
    if (!code) return this.getResteCumule(voyage, index);

    const all = Array.isArray(this.voyages) ? this.voyages : [];
    const targetDate = voyage && voyage.date ? new Date(voyage.date) : null;

    let totalForCode = 0;
    for (const v of all) {
      if (!v) continue;
      if (v.clientId !== clientId) continue;
      const vCode = (v as any).autorisationCode || (v as any).autorisation?.code || undefined;
      if (vCode !== code) continue;
      if (targetDate && v.date) {
        const d = new Date(v.date);
        if (d <= targetDate) totalForCode += (v.poidsClient || 0);
      } else if (!targetDate) {
        totalForCode += (v.poidsClient || 0);
      }
    }

    const quantiteAutorisee = this.getQuantiteAutoriseeForCode(clientId, code);
    return quantiteAutorisee - totalForCode;
  }

  // Vérifier si le client sélectionné a dépassé sa quantité autorisée
  isClientEnDepassement(): boolean {
    const reste = this.getReste();
    return reste < 0;
  }

  getResteColor(): string {
    const reste = this.getReste();
    const quantiteAutorisee = this.getQuantiteAutorisee(this.selectedClient?.id);
    
    if (quantiteAutorisee === 0) return '#64748b';
    const percentage = (reste / quantiteAutorisee) * 100;
    
    if (percentage > 50) return '#10b981';
    if (percentage > 20) return '#f59e0b';
    return '#ef4444';
  }

  getResteGradient(): string {
    const reste = this.getReste();
    const quantiteAutorisee = this.getQuantiteAutorisee(this.selectedClient?.id);
    
    if (quantiteAutorisee === 0) return 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)';
    const percentage = (reste / quantiteAutorisee) * 100;
    
    if (percentage > 50) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    if (percentage > 20) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  }

  getResteBadgeColor(reste: number): string {
    if (!this.selectedClient || !this.selectedClient.id) return '#64748b';
    const quantiteAutorisee = this.getQuantiteAutorisee(this.selectedClient.id);
    
    if (quantiteAutorisee === 0) return '#64748b';
    const percentage = (reste / quantiteAutorisee) * 100;
    
    if (percentage > 50) return '#10b981';
    if (percentage > 20) return '#f59e0b';
    return '#ef4444';
  }

  // Exporter vers PDF
  exportToPDF(): void {
    if (!this.selectedClient) {
      alert('Veuillez sélectionner un client');
      return;
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Titre principal
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RÉCAPITULATIF PAR CLIENT', pageWidth / 2, 15, { align: 'center' });
    
    // Informations du client
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Client: ${this.selectedClient.nom}`, 14, 25);
    doc.text(`Numéro: ${this.selectedClient.numero || 'N/A'}`, 14, 31);
    doc.text(`Quantité Total autorisée: ${this.getQuantiteAutorisee(this.selectedClient.id).toFixed(2)} kg`, 14, 37);
    
    // Statistiques
    doc.setFont('helvetica', 'bold');
    doc.text('Statistiques:', 14, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total voyages: ${this.filteredVoyages.length}`, 14, 51);
    doc.text(`Total livré: ${this.getTotalLivre().toFixed(2)} kg`, 80, 51);
    doc.text(`Reste: ${this.getReste().toFixed(2)} kg`, 160, 51);
    
    // Filtres actifs
    if (this.voyageFilter || this.dateDebut || this.dateFin) {
      doc.setFont('helvetica', 'bold');
      doc.text('Filtres appliqués:', 14, 59);
      doc.setFont('helvetica', 'normal');
      let filterY = 65;
      
      if (this.voyageFilter) {
        doc.text(`Recherche: ${this.voyageFilter}`, 14, filterY);
        filterY += 6;
      }
      if (this.dateDebut) {
        doc.text(`Date début: ${this.dateDebut}`, 14, filterY);
        filterY += 6;
      }
      if (this.dateFin) {
        doc.text(`Date fin: ${this.dateFin}`, 14, filterY);
      }
    }
    
    // Group voyages by authorization ticket (codes) and render one section per ticket
    const autorisations = this.getClientAutorisations(this.selectedClient.id) || [];
    const startYBase = this.voyageFilter || this.dateDebut || this.dateFin ? 77 : 59;
    let currentY = startYBase;

    if (!Array.isArray(autorisations) || autorisations.length === 0) {
      // Fallback: render a single table with all voyages (existing behavior)
      const tableData = this.filteredVoyages.map(v => [
        v.date ? v.date.substring(0, 10) : '',
        v.numBonLivraison || '',
        v.numTicket || '',
        this.getCamionMatricule(v.camionId),
        this.getChauffeurNom(v.chauffeurId),
        (v.poidsClient || 0).toFixed(2),
        this.getResteCumuleForVoyageByCode(v, 0).toFixed(2)
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Bon Livraison', 'Ticket', 'Matricule', 'Chauffeur', 'Poids (kg)', 'Reste (kg)']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234], textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 30 },
          1: { halign: 'left', cellWidth: 35 },
          2: { halign: 'left', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 35 },
          4: { halign: 'left', cellWidth: 50 },
          5: { halign: 'right', cellWidth: 30 },
          6: { halign: 'right', cellWidth: 30 }
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 }
      });
    } else {
      for (const auth of autorisations) {
        const code = auth?.code || 'N/A';
        const quantiteAuth = Number(auth?.quantite || 0);

        // Section header for this ticket
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`code ticket d\'autorisation: ${code} — Quantité autorisée: ${quantiteAuth.toFixed(2)} kg`, 14, currentY);
        currentY += 6;

        // Table rows: use filteredVoyages but only voyages matching this code
        const rows = this.filteredVoyages.filter(v => {
          const vCode = (v as any).autorisationCode || (v as any).autorisation?.code || '';
          return vCode === code;
        }).map(v => [
          v.date ? v.date.substring(0, 10) : '',
          v.numBonLivraison || '',
          v.numTicket || '',
          this.getCamionMatricule(v.camionId),
          this.getChauffeurNom(v.chauffeurId),
          (v.poidsClient || 0).toFixed(2),
          this.getResteCumuleForVoyageByCode(v, 0).toFixed(2)
        ]);

        if (rows.length === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text('Aucun voyage pour cette autorisation dans la sélection.', 14, currentY);
          currentY += 8;
        } else {
          autoTable(doc, {
            startY: currentY,
            head: [['Date', 'Bon Livraison', 'Ticket', 'Matricule', 'Chauffeur', 'Poids (kg)', 'Reste (kg)']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
              0: { halign: 'center', cellWidth: 30 },
              1: { halign: 'left', cellWidth: 35 },
              2: { halign: 'left', cellWidth: 30 },
              3: { halign: 'center', cellWidth: 35 },
              4: { halign: 'left', cellWidth: 50 },
              5: { halign: 'right', cellWidth: 30 },
              6: { halign: 'right', cellWidth: 30 }
            },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 14, right: 14 },
            didDrawPage: (dataArg) => {
              // update currentY to next position after table
              currentY = (dataArg.cursor && dataArg.cursor.y) ? dataArg.cursor.y + 6 : currentY + 50;
            }
          });
        }

        // small spacer between sections
        currentY += 4;
      }
    }
    
    // Footer avec date de génération
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} - Page ${i}/${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    // Nom du fichier
    const fileName = this.generateFileName('pdf');
    doc.save(fileName);
  }

  // Exporter vers Excel
  exportToExcel(): void {
    if (!this.selectedClient) {
      alert('Veuillez sélectionner un client');
      return;
    }

    const wb = XLSX.utils.book_new();
    
    // Feuille de statistiques
    const statsData: any[][] = [
      ['RÉCAPITULATIF PAR CLIENT'],
      [],
      ['Client', this.selectedClient.nom],
      ['Numéro', this.selectedClient.numero || 'N/A'],
      ['Quantité Total autorisée', this.getQuantiteAutorisee(this.selectedClient.id).toFixed(2) + ' kg'],
      [],
      ['STATISTIQUES'],
      ['Total voyages', this.filteredVoyages.length],
      ['Total livré', this.getTotalLivre().toFixed(2) + ' kg'],
      ['Reste', this.getReste().toFixed(2) + ' kg'],
      []
    ];
    
    if (this.voyageFilter || this.dateDebut || this.dateFin) {
      statsData.push(['FILTRES APPLIQUÉS']);
      if (this.voyageFilter) statsData.push(['Recherche', this.voyageFilter]);
      if (this.dateDebut) statsData.push(['Date début', this.dateDebut]);
      if (this.dateFin) statsData.push(['Date fin', this.dateFin]);
      statsData.push([]);
    }
    
    statsData.push(['DÉTAILS DES VOYAGES']);

    // Group voyages per authorization ticket
    const autorisations = this.getClientAutorisations(this.selectedClient.id) || [];

    if (!Array.isArray(autorisations) || autorisations.length === 0) {
      // fallback: single table with all voyages
      statsData.push(['Date', 'Bon Livraison', 'Ticket', 'Matricule', 'Chauffeur', 'Poids (kg)', 'Reste (kg)']);
      this.filteredVoyages.forEach(v => {
        statsData.push([
          v.date ? v.date.substring(0, 10) : '',
          v.numBonLivraison || '',
          v.numTicket || '',
          this.getCamionMatricule(v.camionId),
          this.getChauffeurNom(v.chauffeurId),
          (v.poidsClient || 0).toFixed(2),
          this.getResteCumuleForVoyageByCode(v, 0).toFixed(2)
        ]);
      });
    } else {
      for (const auth of autorisations) {
        const code = auth?.code || 'N/A';
        const quantiteAuth = Number(auth?.quantite || 0);

        // Section header for this ticket
        statsData.push([`code ticket d\'autorisation: ${code}`, `Quantité autorisée: ${quantiteAuth.toFixed(2)} kg`]);
        statsData.push(['Date', 'Bon Livraison', 'Ticket', 'Matricule', 'Chauffeur', 'Poids (kg)', 'Reste (kg)']);

        const rows = this.filteredVoyages.filter(v => {
          const vCode = (v as any).autorisationCode || (v as any).autorisation?.code || '';
          return vCode === code;
        });

        if (rows.length === 0) {
          statsData.push(['', 'Aucun voyage pour cette autorisation dans la sélection.']);
        } else {
          rows.forEach(v => {
            statsData.push([
              v.date ? v.date.substring(0, 10) : '',
              v.numBonLivraison || '',
              v.numTicket || '',
              this.getCamionMatricule(v.camionId),
              this.getChauffeurNom(v.chauffeurId),
              (v.poidsClient || 0).toFixed(2),
              this.getResteCumuleForVoyageByCode(v, 0).toFixed(2)
            ]);
          });
        }

        // blank line between sections
        statsData.push([]);
      }
    }
    
    const ws = XLSX.utils.aoa_to_sheet(statsData);
    
    // Mise en forme
    ws['!cols'] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 }
    ];
    
    // Style pour le titre
    const titleCell = ws['A1'];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center' }
      };
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'Récapitulatif');
    
    // Nom du fichier
    const fileName = this.generateFileName('xlsx');
    XLSX.writeFile(wb, fileName);
  }

  // Générer le nom de fichier
  generateFileName(extension: string): string {
    const clientName = this.selectedClient?.nom?.replace(/[^a-zA-Z0-9]/g, '_') || 'Client';
    const date = new Date().toISOString().split('T')[0];
    let filterSuffix = '';
    
    if (this.dateDebut && this.dateFin) {
      filterSuffix = `_${this.dateDebut}_au_${this.dateFin}`;
    } else if (this.dateDebut) {
      filterSuffix = `_depuis_${this.dateDebut}`;
    } else if (this.dateFin) {
      filterSuffix = `_jusqua_${this.dateFin}`;
    }
    
    return `Recap_${clientName}${filterSuffix}_${date}.${extension}`;
  }
}
