import { Component, HostListener, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { CamionControllerService } from '../../api/api/camionController.service';
import { ClientControllerService } from '../../api/api/clientController.service';
import { DepotControllerService } from '../../api/api/depotController.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { DechargementControllerService } from '../../api/api/dechargementController.service';
import { NotificationService } from '../../service/notification.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { CamionDTO } from '../../api/model/camionDTO';
import { ClientDTO } from '../../api/model/clientDTO';
import { DepotDTO } from '../../api/model/depotDTO';
import { ProjetDTO } from '../../api/model/projetDTO';
import { ProjetClientDTO } from '../../api/model/projetClientDTO';
import { DechargementDTO } from '../../api/model/dechargementDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { HttpClient } from '@angular/common/http';
import { BASE_PATH } from '../../api/variables';
import { ProjetActifService } from '../../service/projet-actif.service';
import { TypeNotification, NiveauAlerte } from '../../model/notification.model';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-voyage',
  templateUrl: './voyage.component.html',
  styleUrls: ['./voyage.component.css']
})
export class VoyageComponent {
  voyages: VoyageDTO[] = [];
  filteredVoyages: VoyageDTO[] = [];
  paginatedVoyages: VoyageDTO[] = [];
  projetActifId: number | null = null;
  projetActif: any = null;
  contextProjetId: number | null = null;
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  selectedVoyage: VoyageDTO | null = null;
  // Extend dialogVoyage with autorisationCode and available autorisations for client-specific code selection
  dialogVoyage: VoyageDTO & { _type?: 'client' | 'depot', autorisationCode?: string, _availableAutorisation?: any[] } = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, societe: '', societeP: undefined, _type: undefined };
  editMode: boolean = false;
  error: string = '';
  chauffeurs: ChauffeurDTO[] = [];
  camions: CamionDTO[] = [];
  clients: ClientDTO[] = [];
  depots: DepotDTO[] = [];
  projets: ProjetDTO[] = [];
  projetsClients: ProjetClientDTO[] = [];
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  voyageFilter: string = '';
  
  // Delete confirmation
  showDeleteDialog: boolean = false;
  voyageToDelete: VoyageDTO | null = null;
  
  // Camion search/create
  camionSearchInput: string = '';
  filteredCamions: CamionDTO[] = [];
  showCamionDropdown: boolean = false;
  isCreatingCamion: boolean = false;
  
  // Chauffeur search/create
  chauffeurSearchInput: string = '';
  filteredChauffeurs: ChauffeurDTO[] = [];
  showChauffeurDropdown: boolean = false;
  isCreatingChauffeur: boolean = false;
  chauffeurCinInput: string = '';
  
  // Société search
  societeSearchInput: string = '';
  filteredSocietes: string[] = [];
  showSocieteDropdown: boolean = false;
  allSocietes: string[] = [];
  societeDropdownTimer: any = null;
  
  // Client search
  clientSearchInput: string = '';
  filteredClientsSearch: ClientDTO[] = [];
  showClientDropdown: boolean = false;
  
  // Depot search
  depotSearchInput: string = '';
  filteredDepotsSearch: DepotDTO[] = [];
  showDepotDropdown: boolean = false;
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filtres
  activeFilter: 'all' | 'date' | 'client' | 'depot' | 'societeP' = 'all';
  dateDebut: string | null = null;
  dateFin: string | null = null;
  selectedClientId: number | null = null;
  selectedDepotId: number | null = null;
  selectedSocieteP: string | null = null;
  
  // Date max pour le filtre (aujourd'hui)
  today: string = '';
  
  Math = Math;
  Array = Array; // Pour utiliser Array.from dans le template

  // Sociétés normalisées pour l'en-tête
  get societesList(): string[] {
    const proj = (this.contextProjet || this.projetActif) as any;
    const set = proj?.societeNoms as Set<string> | string[] | undefined;
    if (!set) return [];
    try {
      return Array.isArray(set)
        ? (set as string[]).filter(Boolean)
        : Array.from(set as Set<string>).filter(Boolean);
    } catch {
      return [];
    }
  }

  constructor(
    private voyageService: VoyageControllerService,
    private chauffeurService: ChauffeurControllerService,
    private camionService: CamionControllerService,
    private clientService: ClientControllerService,
    private depotService: DepotControllerService,
    private projetService: ProjetControllerService,
    private projetClientService: ProjetClientControllerService,
    private dechargementService: DechargementControllerService,
    private projetActifService: ProjetActifService,
    private notificationService: NotificationService,
    private http: HttpClient,
    private route: ActivatedRoute,
    @Inject(BASE_PATH) private basePath: string
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 [Voyage] Notification reçue - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 [Voyage] Rechargement - previousId:', previousId, 'newId:', projet.id);
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
    this.route.paramMap.subscribe(pm => {
      const pid = pm.get('id');
      this.projetActifId = pid ? Number(pid) : null;
      // context from session storage may override
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        this.contextProjetId = Number(contextId);
        this.loadProjetDetails(this.contextProjetId, true);
      } else if (this.projetActifId) {
        this.loadProjetDetails(this.projetActifId);
      }
      // Recharger les voyages selon contexte route
      this.loadVoyages();
    });
    this.loadProjets(); // charge aussi si pas de param route
    this.loadChauffeurs();
    this.loadCamions();
    // NE PAS appeler loadClients() et loadDepots() ici car ils seront appelés
    // après que le projet actif soit défini (via reloadData() ou loadProjetDetails())
    this.loadProjetsClients();
    // Initialiser la date du jour au format yyyy-MM-dd
    this.today = this.getTodayString();
  }

  // 🔥 Méthode pour recharger toutes les données
  reloadData() {
    console.log('🔄 [Voyage] reloadData() - Projet actif:', this.projetActif?.nom, 'ID:', this.projetActifId);
    
    const currentUrl = window.location.pathname;
    const isOnParametrePage = currentUrl.includes('/parametre');
    
    if (isOnParametrePage) {
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        const contextIdNumber = Number(contextId);
        console.log('📌 [Voyage] Page paramètre - Contexte:', contextIdNumber);
        this.contextProjetId = contextIdNumber;
        if (contextIdNumber !== this.projetActifId) {
          this.loadProjetDetails(this.contextProjetId, true);
        } else {
          this.contextProjet = this.projetActif;
        }
      }
    } else {
      console.log('🏠 [Voyage] Mode Vue Projet Actif - Projet:', this.projetActif?.nom);
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    // Recharger toutes les données
    this.loadVoyages();
    this.loadChauffeurs();
    this.loadCamions();
    this.loadClients();
    this.loadDepots();
    this.loadProjetsClients();
  }

  // Fermer les dropdowns lors d'un clic en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Vérifier si le clic est en dehors du dropdown chauffeur
    const chauffeurInput = target.closest('.chauffeur-search-container');
    if (!chauffeurInput && this.showChauffeurDropdown) {
      this.showChauffeurDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown camion
    const camionInput = target.closest('.camion-search-container');
    if (!camionInput && this.showCamionDropdown) {
      this.showCamionDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown société
    const societeInput = target.closest('.societe-search-container');
    if (!societeInput && this.showSocieteDropdown) {
      this.showSocieteDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown client
    const clientInput = target.closest('.client-search-container');
    if (!clientInput && this.showClientDropdown) {
      this.showClientDropdown = false;
    }
    
    // Vérifier si le clic est en dehors du dropdown dépôt
    const depotInput = target.closest('.depot-search-container');
    if (!depotInput && this.showDepotDropdown) {
      this.showDepotDropdown = false;
    }
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.chauffeurs = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing chauffeurs: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.chauffeurs = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement chauffeurs: ' + (err.error?.message || err.message)
    });
  }

  loadCamions() {
    this.camionService.getAllCamions('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.camions = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing camions: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.camions = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement camions: ' + (err.error?.message || err.message)
    });
  }

  loadClients() {
    const projetId = this.contextProjetId || this.projetActifId;
    
    // 🔥 TOUJOURS charger seulement les clients du projet actif
    if (projetId) {
      console.log('📥 Chargement des clients pour le projet:', projetId);
      this.clientService.getClientsByProjet(projetId, 'body').subscribe({
        next: async (data) => {
          if (data instanceof Blob) {
            const text = await data.text();
            try {
              const parsed = JSON.parse(text);
              this.clients = Array.isArray(parsed) ? parsed : [];
              console.log('✅ Clients du projet chargés:', this.clients.length, this.clients);
            } catch (e) {
              console.error('❌ Erreur parsing clients:', e);
              this.clients = [];
            }
          } else {
            this.clients = Array.isArray(data) ? data : [];
            console.log('✅ Clients du projet chargés:', this.clients.length, this.clients);
          }
        },
        error: (err) => {
          console.error('❌ Erreur chargement clients du projet:', err);
          this.error = 'Erreur chargement clients: ' + (err.error?.message || err.message);
          this.clients = [];
        }
      });
    } else {
      // 🔥 Si pas de projet actif, vider la liste au lieu de charger tous les clients
      console.warn('⚠️ Pas de projet actif, impossible de charger les clients');
      this.clients = [];
    }
  }

  loadDepots() {
    const projetId = this.contextProjetId || this.projetActifId;
    
    if (!projetId) {
      console.log('⚠️ Pas de projet actif, impossible de charger les dépôts');
      this.depots = [];
      return;
    }
    
    console.log(`📦 Chargement des dépôts du projet ${projetId}...`);
    
    // Vider la liste des dépôts avant de charger les nouveaux
    this.depots = [];
    
    // Utiliser l'endpoint spécifique au projet avec le basePath correct
    const url = `${this.basePath}/api/projets/${projetId}/depots`;
    console.log(`🔗 URL: ${url}`);
    
    this.http.get<DepotDTO[]>(url).subscribe({
      next: (data) => {
        this.depots = data;
        console.log(`✅ ${this.depots.length} dépôt(s) chargé(s) pour le projet ${projetId}:`, this.depots.map(d => d.nom));
      },
      error: (err) => {
        console.error('❌ Erreur chargement dépôts:', err);
        this.error = 'Erreur chargement depots: ' + (err.error?.message || err.message);
        this.depots = [];
      }
    });
  }

  loadProjetsClients() {
    const projetId = this.contextProjetId || this.projetActifId;
    
    if (!projetId) {
      console.log('⚠️ Pas de projet actif, impossible de charger les projets-clients');
      this.projetsClients = [];
      return;
    }
    
    // Charger les associations projet-client pour le projet afin de récupérer les autorisations (codes + quantites)
    console.log(`📥 Chargement des associations projet-client pour le projet ${projetId}...`);
    const projetClientsUrl = `${this.basePath}/api/projet-client/projet/${projetId}`;
    this.http.get<any[]>(projetClientsUrl, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
      next: (projetClients) => {
        console.log('✅ Réponse projet-clients:', projetClients?.length || 0);
        if (!Array.isArray(projetClients) || projetClients.length === 0) {
          // fallback: try to load clients normally
          this.clientService.getClientsByProjet(projetId, 'body').subscribe({
              next: (data: any) => { this.clients = Array.isArray(data) ? data : []; this.projetsClients = this.clients.map(c => ({ id: c.id, projetId, clientId: c.id, quantiteAutorisee: (c as any).quantitesAutorisee || 0 })); },
              error: (err: any) => { console.error('❌ Erreur chargement clients (fallback):', err); this.clients = []; this.projetsClients = []; }
            });
          return;
        }

        // Récupérer les IDs uniques des clients et charger leurs données complètes
        const clientIds = [...new Set(projetClients.map((pc: any) => pc.clientId))];
        this.http.get<any[]>(`${this.basePath}/api/clients`, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
          next: (allClients) => {
            const filtered = Array.isArray(allClients) ? allClients.filter((c: any) => clientIds.includes(c.id)) : [];
            // Enrichir chaque client avec les infos de ProjetClient (autorisation/quantite)
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

            // Build projetsClients used by other helpers
            this.projetsClients = this.clients.map((c: any) => ({ id: c.projetClientId || c.id, projetId, clientId: c.id, quantiteAutorisee: c.quantiteAutorisee || 0 }));

            console.log(`✅ Clients enrichis chargés: ${this.clients.length}`);
          },
          error: (err: any) => { console.error('❌ Erreur chargement détails clients:', err); this.clients = []; this.projetsClients = []; }
        });
      },
      error: (err) => {
        console.error('❌ Erreur chargement projet-clients:', err);
        // fallback to basic client list
        this.clientService.getClientsByProjet(projetId, 'body').subscribe({
          next: (data: any) => { this.clients = Array.isArray(data) ? data : []; this.projetsClients = this.clients.map(c => ({ id: c.id, projetId, clientId: c.id, quantiteAutorisee: c.quantitesAutoriseesParProjet?.[projetId] || 0 })); },
          error: (e: any) => { console.error('❌ Erreur chargement clients (fallback):', e); this.clients = []; this.projetsClients = []; }
        });
      }
    });
  }

  // Calculer le reste total du projet (quantité totale - somme des livraisons)
  getResteProjet(): number {
    const projet = this.contextProjet || this.projetActif;
    if (!projet) return 0;
    
    const quantiteTotale = projet.quantiteTotale || 0;
    const totalLivre = this.voyages
      .filter(v => v.projetId === projet.id)
      .reduce((sum, v) => {
        return sum + (v.poidsClient || 0) + (v.poidsDepot || 0);
      }, 0);
    
    return quantiteTotale - totalLivre;
  }

  // Calculer le reste du projet au moment actuel (pour affichage dynamique)
  // Cette méthode affiche toujours le reste ACTUEL du projet, pas celui stocké lors de la création du voyage
  getResteProjetActuel(): number {
    return this.getResteProjet();
  }

  // Calculer le reste pour un voyage spécifique (après ce voyage)
  // Le reste = Quantité totale - Somme de tous les voyages du même projet créés AVANT OU AU MOMENT de ce voyage
  getResteForVoyage(voyage: VoyageDTO): number {
    const projet = this.contextProjet || this.projetActif;
    if (!projet) return 0;
    
    const quantiteTotale = projet.quantiteTotale || 0;
    
    // Récupérer la date du voyage actuel
    const voyageDate = voyage.date ? new Date(voyage.date).getTime() : Date.now();
    
    // Calculer le total des livraisons JUSQU'À ce voyage (inclus)
    const totalLivreJusquAVoyage = this.voyages
      .filter(v => {
        if (v.projetId !== projet.id) return false;
        
        // Comparer les dates : inclure tous les voyages créés avant ou au même moment
        const vDate = v.date ? new Date(v.date).getTime() : 0;
        return vDate <= voyageDate;
      })
      .reduce((sum, v) => {
        return sum + (v.poidsClient || 0) + (v.poidsDepot || 0);
      }, 0);
    
    return quantiteTotale - totalLivreJusquAVoyage;
  }

  // Obtenir la couleur du reste pour un voyage (vert/orange/rouge selon le pourcentage restant)
  getResteColorForVoyage(voyage: VoyageDTO): string {
    const projet = this.contextProjet || this.projetActif;
    if (!projet) return '#64748b'; // Gris par défaut
    
    const reste = this.getResteForVoyage(voyage);
    const quantiteTotale = projet.quantiteTotale || 0;
    
    if (quantiteTotale === 0) return '#64748b';
    
    const pourcentage = (reste / quantiteTotale) * 100;
    
    if (pourcentage > 50) return '#10b981'; // Vert
    if (pourcentage > 20) return '#f59e0b'; // Orange
    if (pourcentage >= 0) return '#ef4444'; // Rouge
    return '#dc2626'; // Rouge foncé (négatif - dépassement)
  }

  // Obtenir le nom et numéro d'un client
  getClientNomNumero(clientId: number | undefined): string {
    if (!clientId) return '-';
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return '-';
    return `${client.nom} (${client.numero || 'N/A'})`;
  }

  // Obtenir le nom d'un dépôt
  getDepotNom(depotId: number | undefined): string {
    if (!depotId) return '-';
    const depot = this.depots.find(d => d.id === depotId);
    if (!depot) return '-';
    return depot.nom || 'N/A';
  }

  // Obtenir le matricule et la société d'un camion
  getCamionInfo(camionId: number | undefined, societeName?: string): string {
    if (!camionId) return '-';
    const camion = this.camions.find(c => c.id === camionId);
    if (!camion) return '-';
    const matricule = camion.matricule || 'N/A';
    const societe = societeName || 'N/A';
    return `${matricule} (${societe})`;
  }

  // Retourne la liste des autorisations pour un client donné (depuis projetsClients)
  getClientAutorisations(clientId?: number): any[] {
    if (!clientId) return [];
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return [];
    // Prefer the enriched client object which may contain 'autorisation' array
    const client = this.clients.find(c => c.id === clientId);
    const clientAny = client as any;
    if (clientAny && clientAny.autorisation && Array.isArray(clientAny.autorisation)) {
      return clientAny.autorisation;
    }
    // Fallback to projetsClients entry if it contains autorisation
    const pc = this.projetsClients.find(p => p.projetId === projetId && p.clientId === clientId);
    if (!pc) return [];
    return (pc as any).autorisation && Array.isArray((pc as any).autorisation) ? (pc as any).autorisation : [];
  }

  // Quantité autorisée pour un client et un code donné
  getQuantiteAutoriseeForCode(clientId?: number, code?: string): number {
    if (!clientId) return 0;
    if (!code) return this.getQuantiteAutorisee(clientId);
    const autorisations = this.getClientAutorisations(clientId);
    const found = autorisations.find(a => (a.code || undefined) === code);
    return found ? (found.quantite || 0) : this.getQuantiteAutorisee(clientId);
  }

  // Calculer le total déjà livré pour un client ET un code
  getTotalLivreClientForCode(clientId?: number, code?: string): number {
    if (!clientId) return 0;
    if (!code) return this.getTotalLivreClient(clientId);
    return this.voyages
      .filter(v => v.clientId === clientId)
      .reduce((sum, v) => {
        // Some voyages may carry the autorisation code in different shapes (new DTO uses autorisationCode,
        // older objects or responses might have an nested 'autorisation' object). Cast to any to be safe.
        const codeOnVoyage = (v.autorisationCode as string) || ((v as any).autorisation?.code as string) || undefined;
        return sum + ((codeOnVoyage === code) ? (v.poidsClient || 0) : 0);
      }, 0);
  }

  // Calculer le reste pour un client pour un code donné
  getResteClientForCode(clientId?: number, code?: string): number {
    const quantite = this.getQuantiteAutoriseeForCode(clientId, code);
    const livre = this.getTotalLivreClientForCode(clientId, code);
    return quantite - livre;
  }

  // Calculer le reste pour un client+code AU MOMENT d'un voyage donné (somme cumulative jusqu'à la date du voyage)
  // retourne quantiteAutorisee - totalLivreJusquAuVoyage
  getResteClientForCodeUpToVoyage(voyage?: VoyageDTO): number {
    if (!voyage) return 0;
    const clientId = voyage.clientId;
    const code = this.getVoyageAutorisationCode(voyage);
    if (!clientId || !code) return 0;

    const voyageDate = voyage.date ? new Date(voyage.date).getTime() : Date.now();

    const totalLivreJusquA = this.voyages
      .filter(v => v.clientId === clientId)
      .filter(v => {
        const codeOnVoyage = (v.autorisationCode as string) || ((v as any).autorisation?.code as string) || undefined;
        if (codeOnVoyage !== code) return false;
        const vDate = v.date ? new Date(v.date).getTime() : 0;
        return vDate <= voyageDate;
      })
      .reduce((s, v) => s + (v.poidsClient || 0), 0);

    const quantiteAutorisee = this.getQuantiteAutoriseeForCode(clientId, code);
    return quantiteAutorisee - totalLivreJusquA;
  }

  // Obtenir le nom et le CIN d'un chauffeur
  getChauffeurInfo(chauffeurId: number | undefined): string {
    if (!chauffeurId) return '-';
    const chauffeur = this.chauffeurs.find(ch => ch.id === chauffeurId);
    if (!chauffeur) return '-';
    const nom = chauffeur.nom || 'N/A';
    const cin = chauffeur.numCin || 'N/A';
    return `${nom} (${cin})`;
  }

  // Retourne le code d'autorisation pour un voyage (gère ancien et nouveau format)
  getVoyageAutorisationCode(voyage?: VoyageDTO): string {
    if (!voyage) return '';
    // Prefer the explicit autorisationCode field if present
    if ((voyage as any).autorisationCode) return (voyage as any).autorisationCode;
    // Fallback to legacy nested object
    return (voyage as any).autorisation?.code || '';
  }

  // Filtrer les camions selon l'input de recherche
  onCamionSearchInput(): void {
    const searchValue = this.camionSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredCamions = [];
      this.showCamionDropdown = false;
      return;
    }
    
    // Filtrer les camions existants par matricule
    this.filteredCamions = this.camions.filter(c => 
      c.matricule?.toLowerCase().includes(searchValue)
    );
    
    this.showCamionDropdown = true;
  }

  // Sélectionner un camion existant
  selectCamion(camion: CamionDTO): void {
    this.dialogVoyage.camionId = camion.id;
    this.camionSearchInput = camion.matricule;
    this.showCamionDropdown = false;
    this.filteredCamions = [];
  }

  // Créer un nouveau camion et l'associer au voyage
  async createAndSelectCamion(): Promise<void> {
    const matricule = this.camionSearchInput.trim();
    
    if (!matricule) {
      this.error = 'Veuillez entrer un matricule de camion.';
      return;
    }

    // Vérifier si le camion existe déjà
    const existingCamion = this.camions.find(c => 
      c.matricule?.toLowerCase() === matricule.toLowerCase()
    );
    
    if (existingCamion) {
      this.selectCamion(existingCamion);
      return;
    }

    // Créer un nouveau camion
    this.isCreatingCamion = true;
    this.error = '';
    
    const newCamion: CamionDTO = {
      matricule: matricule,
      societe: this.dialogVoyage.societe || 'N/A'
    };

    try {
      const response = await this.camionService.createCamion(newCamion, 'body').toPromise();
      
      if (response) {
        let createdCamion: CamionDTO;
        
        if (response instanceof Blob) {
          const text = await response.text();
          createdCamion = JSON.parse(text);
        } else {
          createdCamion = response;
        }
        
        // Ajouter le nouveau camion à la liste
        this.camions.push(createdCamion);
        
        // Sélectionner le nouveau camion
        this.dialogVoyage.camionId = createdCamion.id;
        this.camionSearchInput = createdCamion.matricule;
        this.showCamionDropdown = false;
        this.filteredCamions = [];
        
        console.log('✅ Camion créé avec succès:', createdCamion);
      }
    } catch (err: any) {
      console.error('❌ Erreur lors de la création du camion:', err);
      this.error = 'Erreur lors de la création du camion: ' + (err.error?.message || err.message);
    } finally {
      this.isCreatingCamion = false;
    }
  }

  // Réinitialiser la recherche de camion
  resetCamionSearch(): void {
    this.camionSearchInput = '';
    this.filteredCamions = [];
    this.showCamionDropdown = false;
    this.dialogVoyage.camionId = undefined;
  }

  // Filtrer les chauffeurs selon l'input de recherche (par nom ou CIN)
  onChauffeurSearchInput(): void {
    const searchValue = this.chauffeurSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredChauffeurs = [];
      this.showChauffeurDropdown = false;
      return;
    }
    
    // Filtrer les chauffeurs existants par nom ou CIN
    this.filteredChauffeurs = this.chauffeurs.filter(ch => 
      ch.nom?.toLowerCase().includes(searchValue) ||
      ch.numCin?.toLowerCase().includes(searchValue)
    );
    
    this.showChauffeurDropdown = true;
  }

  // Sélectionner un chauffeur existant
  selectChauffeur(chauffeur: ChauffeurDTO): void {
    this.dialogVoyage.chauffeurId = chauffeur.id;
    this.chauffeurSearchInput = chauffeur.nom;
    this.showChauffeurDropdown = false;
    this.filteredChauffeurs = [];
  }

  // Créer un nouveau chauffeur et l'associer au voyage
  async createAndSelectChauffeur(nom: string, cin: string): Promise<void> {
    if (!nom.trim() || !cin.trim()) {
      this.error = 'Veuillez entrer le nom et le CIN du chauffeur.';
      return;
    }

    // Vérifier si le chauffeur existe déjà (par CIN)
    const existingChauffeur = this.chauffeurs.find(ch => 
      ch.numCin?.toLowerCase() === cin.toLowerCase()
    );
    
    if (existingChauffeur) {
      this.selectChauffeur(existingChauffeur);
      return;
    }

    // Créer un nouveau chauffeur
    this.isCreatingChauffeur = true;
    this.error = '';
    
    const newChauffeur: ChauffeurDTO = {
      nom: nom.trim(),
      numCin: cin.trim()
    };

    try {
      const response = await this.chauffeurService.createChauffeur(newChauffeur, 'body').toPromise();
      
      if (response) {
        let createdChauffeur: ChauffeurDTO;
        
        if (response instanceof Blob) {
          const text = await response.text();
          createdChauffeur = JSON.parse(text);
        } else {
          createdChauffeur = response;
        }
        
        // Ajouter le nouveau chauffeur à la liste
        this.chauffeurs.push(createdChauffeur);
        
        // Sélectionner le nouveau chauffeur
        this.dialogVoyage.chauffeurId = createdChauffeur.id;
        this.chauffeurSearchInput = createdChauffeur.nom;
        this.showChauffeurDropdown = false;
        this.filteredChauffeurs = [];
        
        console.log('✅ Chauffeur créé avec succès:', createdChauffeur);
      }
    } catch (err: any) {
      console.error('❌ Erreur lors de la création du chauffeur:', err);
      this.error = 'Erreur lors de la création du chauffeur: ' + (err.error?.message || err.message);
    } finally {
      this.isCreatingChauffeur = false;
    }
  }

  // Réinitialiser la recherche de chauffeur
  resetChauffeurSearch(): void {
    this.chauffeurSearchInput = '';
    this.chauffeurCinInput = '';
    this.filteredChauffeurs = [];
    this.showChauffeurDropdown = false;
    this.dialogVoyage.chauffeurId = undefined;
  }

  // Obtenir la quantité autorisée pour un client
  getQuantiteAutorisee(clientId: number | undefined): number {
    if (!clientId) {
      console.log('⚠️ getQuantiteAutorisee: clientId non défini');
      return 0;
    }
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) {
      console.log('⚠️ getQuantiteAutorisee: projetId non défini');
      return 0;
    }
    
    const projetClient = this.projetsClients.find(
      pc => pc.projetId === projetId && pc.clientId === clientId
    );
    
    if (!projetClient) {
      console.log(`❌ ProjetClient non trouvé pour projetId=${projetId}, clientId=${clientId}`);
      console.log(`📋 projetsClients disponibles (${this.projetsClients.length}):`, this.projetsClients);
      return 0;
    }

    // If autorisation list is present, sum quantite values; otherwise fallback to legacy quantiteAutorisee
    if (projetClient.autorisation && projetClient.autorisation.length > 0) {
      const total = projetClient.autorisation.reduce((s, a) => s + (a.quantite || 0), 0);
      console.log(`✅ ProjetClient trouvé: somme des autorisations = ${total}`);
      return total;
    }

    console.log(`✅ ProjetClient trouvé: quantité autorisée (legacy) = ${projetClient.quantiteAutorisee}`);
    return projetClient?.quantiteAutorisee || 0;
  }

  // Calculer le total déjà livré pour un client
  getTotalLivreClient(clientId: number): number {
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return 0;
    
    return this.voyages
      .filter(v => v.projetId === projetId && v.clientId === clientId)
      .reduce((sum, v) => sum + (v.poidsClient || 0), 0);
  }

  // Calculer le reste pour un client
  getResteClient(clientId: number): number {
    const quantiteAutorisee = this.getQuantiteAutorisee(clientId);
    const totalLivre = this.getTotalLivreClient(clientId);
    return quantiteAutorisee - totalLivre;
  }

  // Vérifier si un client a dépassé sa quantité autorisée
  isClientEnDepassement(clientId: number | undefined): boolean {
    if (!clientId) return false;
    const reste = this.getResteClient(clientId);
    return reste < 0;
  }

  // Obtenir la couleur selon le pourcentage restant
  getResteColor(reste: number, quantiteAutorisee: number): string {
    if (quantiteAutorisee === 0) return '#64748b'; // gris
    const pourcentage = (reste / quantiteAutorisee) * 100;
    
    if (pourcentage > 50) return '#10b981'; // vert
    if (pourcentage > 20) return '#f59e0b'; // jaune
    return '#ef4444'; // rouge
  }

  // Mettre à jour le reste en temps réel quand on change de client ou de poids
  updateResteEnTempsReel() {
    console.log('🔄 updateResteEnTempsReel appelée');
    console.log('  Type:', this.dialogVoyage._type);
    console.log('  ClientId:', this.dialogVoyage.clientId);
    
    if (this.dialogVoyage._type === 'client' && this.dialogVoyage.clientId) {
      const quantiteAutorisee = this.getQuantiteAutorisee(this.dialogVoyage.clientId);
      const totalLivre = this.getTotalLivreClient(this.dialogVoyage.clientId);
      const poidsActuel = Number(this.dialogVoyage.poidsClient) || 0;
      
      console.log('  📊 Quantité autorisée:', quantiteAutorisee);
      console.log('  📦 Total déjà livré:', totalLivre);
      console.log('  ⚖️ Poids actuel:', poidsActuel);
      
      // this.dialogVoyage.reste = quantiteAutorisee - totalLivre - poidsActuel;
      const resteProjet = this.getResteProjet();
      // const poidsActuel = Number(this.dialogVoyage.poidsDepot) || 0;
      this.dialogVoyage.reste = resteProjet - poidsActuel;
      console.log('  ✅ Reste calculé:', this.dialogVoyage.reste);
    } else {
      this.dialogVoyage.reste = 0;
      console.log('  ⚠️ Pas de client sélectionné ou type non-client');
    }
  }

  // Mettre à jour le reste pour le dépôt (reste = quantité totale du projet - total livré)
  updateResteForDepot() {
    if (this.dialogVoyage._type === 'depot') {
      const resteProjet = this.getResteProjet();
      const poidsActuel = Number(this.dialogVoyage.poidsDepot) || 0;
      this.dialogVoyage.reste = resteProjet - poidsActuel;
    }
  }

  // Valider le poids saisi
  validatePoids(): boolean {
    // Calculer le poids total à ajouter
    const poidsTotal = (this.dialogVoyage._type === 'client' ? (Number(this.dialogVoyage.poidsClient) || 0) : 0) +
                       (this.dialogVoyage._type === 'depot' ? (Number(this.dialogVoyage.poidsDepot) || 0) : 0);
    
    // Vérifier le reste du projet (quantité totale - total livré)
    const resteProjet = this.getResteProjet();
    
    // En mode édition, on doit retirer le poids actuel du voyage qu'on modifie
    let resteDisponible = resteProjet;
    if (this.editMode && this.selectedVoyage) {
      const poidsActuelVoyage = (this.selectedVoyage.poidsClient || 0) + (this.selectedVoyage.poidsDepot || 0);
      resteDisponible = resteProjet + poidsActuelVoyage;
    }
    
    if (poidsTotal > resteDisponible) {
      this.error = `Le poids saisi (${poidsTotal}) dépasse le reste disponible du projet (${resteDisponible})`;
      return false;
    }
    
    // Validation spécifique pour les clients
    if (this.dialogVoyage._type === 'client' && this.dialogVoyage.clientId) {
      const resteClient = this.getResteClient(this.dialogVoyage.clientId);
      const poidsActuel = Number(this.dialogVoyage.poidsClient) || 0;
      
      // En mode édition, ajouter le poids actuel du client si c'est le même client
      let resteClientDisponible = resteClient;
      if (this.editMode && this.selectedVoyage && this.selectedVoyage.clientId === this.dialogVoyage.clientId) {
        resteClientDisponible = resteClient + (this.selectedVoyage.poidsClient || 0);
      }
      
      if (poidsActuel > resteClientDisponible) {
        this.error = `Le poids saisi (${poidsActuel}) dépasse le reste autorisé pour ce client (${resteClientDisponible})`;
        return false;
      }
    }
    
    return true;
  }

  loadProjets() {
    this.projetService.getAllProjets('body').subscribe({
      next: (data) => {
        let projets: ProjetDTO[] = [];
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              projets = JSON.parse(reader.result as string);
              this.projets = projets;
              if (this.projetActifId === null) {
                // si la route n'impose pas un projet, on prend actif pour vue globale
                const actif = projets.find(pr => pr.active);
                this.projetActifId = actif?.id || null;
              }
              // Charger les détails du projet actif ou contexte
              const contextId = window.sessionStorage.getItem('projetActifId');
              if (contextId) {
                this.contextProjetId = Number(contextId);
                this.loadProjetDetails(this.contextProjetId, true);
              } else if (this.projetActifId) {
                this.loadProjetDetails(this.projetActifId);
              }
              this.loadVoyages();
            } catch (e) {
              this.error = 'Erreur parsing projets: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          projets = data;
          this.projets = projets;
          if (this.projetActifId === null) {
            const actif = projets.find(pr => pr.active);
            this.projetActifId = actif?.id || null;
          }
          // Charger les détails du projet actif
          if (this.projetActifId) {
            this.loadProjetDetails(this.projetActifId);
          }
          this.loadVoyages();
        }
      },
      error: (err) => this.error = 'Erreur chargement projets: ' + (err.error?.message || err.message)
    });
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
            // Recharger les clients, dépôts et projets-clients pour ce projet
            this.loadClients();
            this.loadDepots();
            this.loadProjetsClients();
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
          // Recharger les clients, dépôts et projets-clients pour ce projet
          this.loadClients();
          this.loadDepots();
          this.loadProjetsClients();
        }
      },
      error: (err: any) => {
        console.error('Erreur chargement projet:', err);
      }
    });
  }

  canAddData(): boolean {
    if (this.contextProjet) return this.contextProjet.active === true;
    return !!(this.projetActif && this.projetActif.active === true);
  }

  updateBreadcrumb() {
    const projet = this.contextProjet || this.projetActif;
    if (projet) {
      this.breadcrumbItems = [
        { label: 'Projets', url: '/projet' },
        { label: projet.nom || `Projet ${projet.id}`, url: `/projet/${projet.id}/parametre` },
        { label: 'Param\u00e8tres', url: `/projet/${projet.id}/parametre` },
        { label: 'Voyages' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'Voyages' }
      ];
    }
  }



  openAddDialog() {
    // 🕐 Définir automatiquement la date et heure actuelle
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    this.dialogVoyage = { 
      numBonLivraison: '', 
      numTicket: '', 
      reste: 0, 
      date: localDateTime,  // Date automatique (pas de champ visible)
      poidsClient: 0, 
      poidsDepot: 0, 
      societe: '', 
      societeP: undefined,
      _type: 'client' 
    };
    
    this.showAddDialog = true;
    this.editMode = false;
    
    // Réinitialiser les champs de recherche
    this.resetCamionSearch();
    this.resetChauffeurSearch();
    this.resetSocieteSearch();
    this.resetClientSearch();
    this.resetDepotSearch();
    
    // Toujours recharger les projets clients pour s'assurer d'avoir les données à jour
    console.log('🔄 Rechargement des projets clients...');
    this.loadProjetsClients();
    
    // Debug: afficher le projet actif et les clients disponibles
    const projetId = this.contextProjetId || this.projetActifId;
    console.log('📌 Projet actif:', projetId);
    console.log('📌 Context projet:', this.contextProjet);
    console.log('📌 Projet actif:', this.projetActif);
    console.log('👥 Clients du projet disponibles:', this.clients.length, this.clients);

    // Pré-sélectionner la Société Projet si une seule société est disponible
    try {
      const societes = this.societesList;
      if (societes && societes.length === 1) {
        this.dialogVoyage.societeP = societes[0];
      }
    } catch {}
  }

  selectVoyage(vg: VoyageDTO) {
    this.dialogVoyage = { ...vg };
    
    // Déterminer le type (client ou depot) basé sur les données
    if (vg.clientId && vg.clientId > 0) {
      this.dialogVoyage._type = 'client';
    } else if (vg.depotId && vg.depotId > 0) {
      this.dialogVoyage._type = 'depot';
    } else {
      this.dialogVoyage._type = 'client'; // Par défaut
    }
    
    // Convertir la date au format datetime-local si elle existe
    if (vg.date) {
      const dateStr = vg.date.toString();
      if (dateStr.includes('T')) {
        // Si la date contient déjà un T, prendre les 16 premiers caractères (YYYY-MM-DDTHH:mm)
        this.dialogVoyage.date = dateStr.slice(0, 16);
      } else {
        // Si c'est juste une date, ajouter l'heure 00:00
        this.dialogVoyage.date = dateStr + 'T00:00';
      }
    }
    
    this.selectedVoyage = vg;
    this.editMode = true;
    this.showAddDialog = false;
    
    // Initialiser le champ de recherche de camion avec le matricule actuel
    if (vg.camionId) {
      const camion = this.camions.find(c => c.id === vg.camionId);
      if (camion) {
        this.camionSearchInput = camion.matricule;
      }
    }
    
    // Initialiser le champ de recherche de chauffeur avec le nom actuel
    if (vg.chauffeurId) {
      const chauffeur = this.chauffeurs.find(ch => ch.id === vg.chauffeurId);
      if (chauffeur) {
        this.chauffeurSearchInput = chauffeur.nom;
      }
    }
    
    // Initialiser le champ de recherche de société avec la société actuelle
    if (vg.societe) {
      this.societeSearchInput = vg.societe;
    }
    
    // Initialiser les champs de recherche client/depot
    if (this.dialogVoyage._type === 'client' && vg.clientId) {
      const client = this.clients.find(c => c.id === vg.clientId);
      if (client) {
        this.clientSearchInput = client.nom || '';
      }
      // populate autorisation list and preselect code from voyage if available
      const autorisations = this.getClientAutorisations(vg.clientId);
      this.dialogVoyage._availableAutorisation = autorisations;
      this.dialogVoyage.autorisationCode = vg.autorisationCode || (autorisations && autorisations.length > 0 ? autorisations[0].code : undefined);
    } else if (this.dialogVoyage._type === 'depot' && vg.depotId) {
      const depot = this.depots.find(d => d.id === vg.depotId);
      if (depot) {
        this.depotSearchInput = depot.nom || '';
      }
    }

    // s'assurer que la Société Projet est portée dans le dialogue
    if (vg.societeP) {
      this.dialogVoyage.societeP = vg.societeP;
    }
  }

  async addDialogVoyage() {
    const targetProjetId = this.contextProjetId || this.projetActifId;
    if (targetProjetId) {
      this.dialogVoyage.projetId = targetProjetId;
    }
    // If a client was prefilled before opening the dialog, populate its autorisation codes
    if (this.dialogVoyage.clientId) {
      const autorisations = this.getClientAutorisations(this.dialogVoyage.clientId);
      this.dialogVoyage._availableAutorisation = autorisations;
      if (autorisations && autorisations.length > 0 && !this.dialogVoyage.autorisationCode) {
        this.dialogVoyage.autorisationCode = autorisations[0].code;
      }
    }
    
    // Validation des champs obligatoires
    if (!this.dialogVoyage.projetId) {
      this.error = 'Sélectionne un projet pour créer un voyage.';
      return;
    }
    if (!this.dialogVoyage.numBonLivraison) {
      this.error = 'Le numéro de bon de livraison est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.numTicket) {
      this.error = 'Le numéro de ticket est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.date) {
      this.error = 'La date est obligatoire.';
      return;
    }

    // Société Projet obligatoire
    if (!this.dialogVoyage.societeP || !this.dialogVoyage.societeP.trim()) {
      this.error = 'La Société Projet est obligatoire.';
      return;
    }
    
    // Vérification et création du chauffeur si nécessaire
    if (!this.dialogVoyage.chauffeurId && this.chauffeurSearchInput.trim() && this.chauffeurCinInput.trim()) {
      await this.createAndSelectChauffeur(this.chauffeurSearchInput, this.chauffeurCinInput);
    }
    
    if (!this.dialogVoyage.chauffeurId) {
      this.error = 'Le chauffeur est obligatoire.';
      return;
    }
    
    // Vérification et création du camion si nécessaire
    if (!this.dialogVoyage.camionId && this.camionSearchInput.trim()) {
      await this.createAndSelectCamion();
    }
    
    if (!this.dialogVoyage.camionId) {
      this.error = 'Le camion est obligatoire.';
      return;
    }
    if (!this.dialogVoyage._type) {
      this.error = 'Veuillez sélectionner Client ou Dépôt.';
      return;
    }
    if (this.dialogVoyage._type === 'client' && !this.dialogVoyage.clientId) {
      this.error = 'Veuillez sélectionner un client.';
      return;
    }
    if (this.dialogVoyage._type === 'depot' && !this.dialogVoyage.depotId) {
      this.error = 'Veuillez sélectionner un dépôt.';
      return;
    }
    
    // Validation du poids pour les clients
    if (!this.validatePoids()) {
      return;
    }
    
    this.dialogVoyage.userId = 1;

    // Normalisation du payload pour correspondre exactement au VoyageDTO backend
    const payload: any = {
      numBonLivraison: this.dialogVoyage.numBonLivraison?.trim(),
      numTicket: this.dialogVoyage.numTicket?.trim(),
      reste: this.dialogVoyage.reste != null ? Number(this.dialogVoyage.reste) : 0,
      date: this.dialogVoyage.date ? this.dialogVoyage.date : undefined,
      societe: this.dialogVoyage.societe?.trim() || undefined,
      societeP: this.dialogVoyage.societeP?.trim(),
      poidsClient: undefined as number | undefined,
      poidsDepot: undefined as number | undefined,
      chauffeurId: this.dialogVoyage.chauffeurId,
      camionId: this.dialogVoyage.camionId,
      clientId: undefined as number | undefined,
      depotId: undefined as number | undefined,
      projetId: this.dialogVoyage.projetId,
      userId: this.dialogVoyage.userId
    };

    // Mutuelle exclusivité client/depot
    if (this.dialogVoyage._type === 'client') {
      payload.clientId = this.dialogVoyage.clientId!;
      // include autorisation code when selected
      if (this.dialogVoyage.autorisationCode) {
        payload.autorisationCode = this.dialogVoyage.autorisationCode;
      }
      if (this.dialogVoyage.poidsClient != null) {
        payload.poidsClient = Number(this.dialogVoyage.poidsClient);
      }
    } else if (this.dialogVoyage._type === 'depot') {
      payload.depotId = this.dialogVoyage.depotId!;
      if (this.dialogVoyage.poidsDepot != null) {
        payload.poidsDepot = Number(this.dialogVoyage.poidsDepot);
      }
    }

    // Nettoyage: retirer les clés undefined pour éviter d'envoyer des champs superflus
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    console.log('Payload voyage envoyé ->', payload);

    this.voyageService.createVoyage(payload, 'body').subscribe({
      next: (createdVoyage) => {
        console.log('Voyage créé:', createdVoyage);
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, societe: '', societeP: undefined, _type: undefined };
        this.error = '';
        this.closeDialog();
        // Recharger la liste pour afficher le nouveau voyage
        this.loadVoyages();
        try { this.notificationService.rafraichir(); } catch (e) { console.warn('Erreur emit rafraichir after create voyage', e); }
      },
      error: (err) => {
        console.error('Erreur création voyage:', err);
        const backendMsg = (typeof err.error === 'string') ? err.error : (err.error?.message || err.message);
        this.error = 'num ticket ou num BL déja utilisé';
      }
    });
  }

  async updateDialogVoyage() {
    if (!this.dialogVoyage?.id) {
      this.error = "L'id du voyage à modifier est manquant.";
      return;
    }
    
    // Validation des champs obligatoires
    if (!this.dialogVoyage.numBonLivraison) {
      this.error = 'Le numéro de bon de livraison est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.numTicket) {
      this.error = 'Le numéro de ticket est obligatoire.';
      return;
    }
    if (!this.dialogVoyage.date) {
      this.error = 'La date est obligatoire.';
      return;
    }

    // Société Projet obligatoire
    if (!this.dialogVoyage.societeP || !this.dialogVoyage.societeP.trim()) {
      this.error = 'La Société Projet est obligatoire.';
      return;
    }
    
    // Vérification et création du chauffeur si nécessaire
    if (!this.dialogVoyage.chauffeurId && this.chauffeurSearchInput.trim() && this.chauffeurCinInput.trim()) {
      await this.createAndSelectChauffeur(this.chauffeurSearchInput, this.chauffeurCinInput);
    }
    
    if (!this.dialogVoyage.chauffeurId) {
      this.error = 'Le chauffeur est obligatoire.';
      return;
    }
    
    // Vérification et création du camion si nécessaire
    if (!this.dialogVoyage.camionId && this.camionSearchInput.trim()) {
      await this.createAndSelectCamion();
    }
    
    if (!this.dialogVoyage.camionId) {
      this.error = 'Le camion est obligatoire.';
      return;
    }
    
    // Validation du type (client OU depot, pas les deux)
    if (!this.dialogVoyage._type) {
      this.error = 'Veuillez sélectionner Client ou Dépôt.';
      return;
    }
    if (this.dialogVoyage._type === 'client' && !this.dialogVoyage.clientId) {
      this.error = 'Veuillez sélectionner un client.';
      return;
    }
    if (this.dialogVoyage._type === 'depot' && !this.dialogVoyage.depotId) {
      this.error = 'Veuillez sélectionner un dépôt.';
      return;
    }
    
    // Validation du poids
    if (!this.validatePoids()) {
      return;
    }
    
    // Normalisation du payload comme dans addDialogVoyage
    const payload: any = {
      id: this.dialogVoyage.id,
      numBonLivraison: this.dialogVoyage.numBonLivraison?.trim(),
      numTicket: this.dialogVoyage.numTicket?.trim(),
      reste: this.dialogVoyage.reste != null ? Number(this.dialogVoyage.reste) : 0,
      date: this.dialogVoyage.date ? this.dialogVoyage.date : undefined,
      societe: this.dialogVoyage.societe?.trim() || undefined,
      societeP: this.dialogVoyage.societeP?.trim(),
      poidsClient: undefined as number | undefined,
      poidsDepot: undefined as number | undefined,
      chauffeurId: this.dialogVoyage.chauffeurId,
      camionId: this.dialogVoyage.camionId,
      clientId: undefined as number | undefined,
      depotId: undefined as number | undefined,
      projetId: this.dialogVoyage.projetId,
      userId: this.dialogVoyage.userId || 1
    };

    // Mutuelle exclusivité client/depot
    if (this.dialogVoyage._type === 'client') {
      payload.clientId = this.dialogVoyage.clientId!;
      // include autorisation code when editing if present
      if (this.dialogVoyage.autorisationCode) {
        payload.autorisationCode = this.dialogVoyage.autorisationCode;
      }
      payload.depotId = undefined; // Forcer à undefined
      if (this.dialogVoyage.poidsClient != null) {
        payload.poidsClient = Number(this.dialogVoyage.poidsClient);
      }
      payload.poidsDepot = undefined; // Forcer à undefined
    } else if (this.dialogVoyage._type === 'depot') {
      payload.depotId = this.dialogVoyage.depotId!;
      payload.clientId = undefined; // Forcer à undefined
      if (this.dialogVoyage.poidsDepot != null) {
        payload.poidsDepot = Number(this.dialogVoyage.poidsDepot);
      }
      payload.poidsClient = undefined; // Forcer à undefined
    }

    // Nettoyage: retirer les clés undefined
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    console.log('Payload voyage modification envoyé ->', payload);
    
    // Conserver les anciennes valeurs pour trouver le déchargement correspondant
    const oldNumBonLivraison = this.selectedVoyage?.numBonLivraison;
    const oldNumTicket = this.selectedVoyage?.numTicket;

    this.voyageService.updateVoyage(this.dialogVoyage.id, payload, 'body').subscribe({
      next: () => {
        // Synchroniser avec le déchargement lié en utilisant les anciennes valeurs pour la recherche
        this.syncDechargementFromVoyage(this.dialogVoyage, oldNumBonLivraison, oldNumTicket);
        
        this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, societe: '', societeP: undefined };
        this.selectedVoyage = null;
        this.editMode = false;
        this.loadVoyages();
        try { this.notificationService.rafraichir(); } catch (e) { console.warn('Erreur emit rafraichir after update voyage', e); }
        this.closeDialog();
      },
      error: (err) => {
        console.error('Erreur backend:', err);
        if (err.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            this.error = 'Erreur modification: ' + reader.result;
          };
          reader.readAsText(err.error);
        } else if (err.error) {
          this.error = 'Erreur modification: ' + err.error;
        } else {
          this.error = 'Erreur modification: ' + (err.message || '');
        }
      }
    });
  }

  // Synchroniser le déchargement quand le voyage est modifié
  syncDechargementFromVoyage(voyage: VoyageDTO, oldNumBonLivraison?: string, oldNumTicket?: string): void {
    console.log('🔄 Début synchronisation Voyage → Déchargement');
    console.log('Voyage:', voyage);
    
    // Utiliser les anciennes valeurs si fournies, sinon les valeurs actuelles
    const searchBonLivraison = oldNumBonLivraison || voyage.numBonLivraison;
    const searchTicket = oldNumTicket || voyage.numTicket;
    
    if (!searchBonLivraison || !searchTicket) {
      console.warn('⚠️ Synchronisation annulée: numBonLivraison ou numTicket manquant');
      return;
    }

    console.log(`🔍 Recherche déchargement avec Bon: ${searchBonLivraison}, Ticket: ${searchTicket}`);
    if (oldNumBonLivraison || oldNumTicket) {
      console.log(`📝 Nouvelles valeurs: Bon: ${voyage.numBonLivraison}, Ticket: ${voyage.numTicket}`);
    }

    // Trouver le déchargement correspondant
    this.dechargementService.getAllDechargements().subscribe({
      next: (dechargements: any) => {
        let dechargementsList: DechargementDTO[] = [];
        
        if (dechargements instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              dechargementsList = JSON.parse(reader.result as string);
              console.log(`📦 ${dechargementsList.length} déchargements chargés (Blob)`);
              this.updateMatchingDechargement(dechargementsList, voyage, searchBonLivraison, searchTicket);
            } catch (e) {
              console.error('❌ Erreur parsing dechargements:', e);
            }
          };
          reader.readAsText(dechargements);
        } else {
          dechargementsList = dechargements;
          console.log(`📦 ${dechargementsList.length} déchargements chargés (JSON direct)`);
          this.updateMatchingDechargement(dechargementsList, voyage, searchBonLivraison, searchTicket);
        }
      },
      error: (err) => {
        console.error('❌ Erreur récupération dechargements:', err);
      }
    });
  }

  updateMatchingDechargement(dechargements: DechargementDTO[], voyage: VoyageDTO, searchBonLivraison: string, searchTicket: string): void {
    console.log('🔍 Recherche du déchargement correspondant parmi', dechargements.length, 'déchargements');
    
    const matchingDechargement = dechargements.find(d =>
      d.numBonLivraison === searchBonLivraison && 
      d.numTicket === searchTicket
    );

    if (!matchingDechargement) {
      console.warn('⚠️ Aucun déchargement trouvé avec Bon:', searchBonLivraison, 'Ticket:', searchTicket);
      return;
    }

    console.log('✅ Déchargement correspondant trouvé:', matchingDechargement);

    if (!matchingDechargement.id) {
      console.error('❌ Déchargement sans ID, impossible de mettre à jour');
      return;
    }

    // Calculer les poids à partir du voyage
    const poidsNet = (voyage.poidsClient || 0) + (voyage.poidsDepot || 0);
    
    // Synchroniser TOUS les champs communs
    const updatedDechargement: DechargementDTO = {
      ...matchingDechargement,
      // Identifiants (obligatoires pour DechargementDTO)
      chargementId: matchingDechargement.chargementId,
      
      // Numéros
      numBonLivraison: voyage.numBonLivraison || matchingDechargement.numBonLivraison,
      numTicket: voyage.numTicket || matchingDechargement.numTicket,
      
      // Date
      dateDechargement: voyage.date || matchingDechargement.dateDechargement,
      
    // Client/Dépôt (use undefined instead of 0 when not provided to avoid sending invalid IDs)
    clientId: voyage.clientId ?? matchingDechargement.clientId ?? undefined,
    depotId: voyage.depotId ?? matchingDechargement.depotId ?? undefined,
      
      // Transporteur
      societe: voyage.societe || matchingDechargement.societe,
      
      // Véhicule et chauffeur
      camionId: voyage.camionId || matchingDechargement.camionId,
      chauffeurId: voyage.chauffeurId || matchingDechargement.chauffeurId,
      
      // Projet
      projetId: voyage.projetId || matchingDechargement.projetId,
      
      // Note: Les poids (poidComplet, poidCamionVide) ne sont pas synchronisés depuis le voyage
      // car ils sont des mesures physiques spécifiques au déchargement
      // Propager le code d'autorisation si présent sur le voyage
      autorisationCode: voyage.autorisationCode || matchingDechargement.autorisationCode
    };

    // Clean payload: remove undefined fields to avoid sending invalid values to the backend
    const cleanedPayload: any = { ...updatedDechargement };
    Object.keys(cleanedPayload).forEach(k => cleanedPayload[k] === undefined && delete cleanedPayload[k]);

    // Ensure date format includes seconds because backend expects yyyy-MM-dd'T'HH:mm:ss
    if (cleanedPayload.dateDechargement && typeof cleanedPayload.dateDechargement === 'string') {
      // If format is like '2025-10-25T21:19' add ':00'
      const shortIsoMatch = cleanedPayload.dateDechargement.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      if (shortIsoMatch) {
        cleanedPayload.dateDechargement = cleanedPayload.dateDechargement + ':00';
      }
    }

    // Ensure numeric fields are numbers (not strings)
    ['poidCamionVide','poidComplet'].forEach(f => {
      if (cleanedPayload[f] !== undefined && cleanedPayload[f] !== null) {
        cleanedPayload[f] = Number(cleanedPayload[f]);
      }
    });

    console.log('📝 Déchargement mis à jour (cleaned):', cleanedPayload);

  this.dechargementService.updateDechargement(matchingDechargement.id, cleanedPayload).subscribe({
      next: () => {
        console.log('✅ Déchargement synchronisé avec succès!');
        console.log('🔄 Rechargement des déchargements recommandé');
        try { this.notificationService.rafraichir(); } catch (e) { console.warn('Erreur emit rafraichir after sync dechargement from voyage', e); }
      },
      error: (err) => {
        console.error('❌ Erreur synchronisation déchargement:', err);
        try {
          // If backend responded with a Blob (e.g., text/html), try to read it
          if (err && err.error instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              console.error('Détails erreur (blob):', reader.result);
            };
            reader.readAsText(err.error);
            return;
          }

          // If error payload is JSON/object, stringify it
          if (err && err.error && typeof err.error === 'object') {
            console.error('Détails erreur (json):', JSON.stringify(err.error));
            return;
          }

          // If error payload is a string, print it
          if (err && typeof err.error === 'string') {
            console.error('Détails erreur (string):', err.error);
            return;
          }

          // Fallback: print status and message
          console.error('Détails erreur (fallback): status=', err?.status, 'message=', err?.message || err);
        } catch (e) {
          console.error('Erreur lors du traitement du message d\'erreur:', e);
        }
      }
    });
  }

  closeDialog() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0, societe: '', societeP: undefined };
    this.selectedVoyage = null;
    this.error = '';
    
    // Réinitialiser les champs de recherche
    this.resetCamionSearch();
    this.resetChauffeurSearch();
    this.resetSocieteSearch();
  }

  applyFilter() {
    // Ne pas permettre une date future
    if (this.dateDebut && this.today && this.dateDebut > this.today) {
      this.dateDebut = this.today;
    }
    if (this.dateFin && this.today && this.dateFin > this.today) {
      this.dateFin = this.today;
    }
    const filter = this.voyageFilter.trim().toLowerCase();
    let voyagesFiltrés = this.voyages;
    
    // Filtre par projet actif
    if (this.projetActifId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.projetId === this.projetActifId);
    }
    
    // Filtre par recherche textuelle
    if (filter) {
      voyagesFiltrés = voyagesFiltrés.filter(vg =>
        (vg.numBonLivraison?.toLowerCase().includes(filter) || false) ||
        (vg.numTicket?.toLowerCase().includes(filter) || false) ||
        (vg.societe?.toLowerCase().includes(filter) || false) ||
        (vg.societeP?.toLowerCase().includes(filter) || false)
      );
    }
    
    // Filtre par date avec journée de travail (7h00 → 6h00 lendemain)
    if (this.dateDebut || this.dateFin) {
      const startDate = this.dateDebut ? new Date(this.dateDebut + 'T00:00:00') : new Date('1900-01-01');
      const endDate = this.dateFin ? new Date(this.dateFin + 'T00:00:00') : new Date();
      
      voyagesFiltrés = voyagesFiltrés.filter(vg => {
        if (!vg.date) return false;
        const voyageDateTime = new Date(vg.date);
        
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
    if (this.selectedClientId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.clientId === this.selectedClientId);
    }
    if (this.selectedDepotId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.depotId === this.selectedDepotId);
    }
    if (this.selectedSocieteP) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.societeP === this.selectedSocieteP);
    }
    
    this.filteredVoyages = voyagesFiltrés;
    
    // Si aucun tri manuel n'est actif, maintenir l'ordre par date décroissante
    if (!this.sortColumn) {
      this.filteredVoyages.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }
    
    this.updatePagination();
  }
  
  setFilter(filterType: 'all' | 'date' | 'client' | 'depot' | 'societeP') {
    this.activeFilter = filterType;
    
    // Réinitialiser les filtres spécifiques quand on change de type
    if (filterType === 'all') {
      this.dateDebut = null;
      this.dateFin = null;
      this.selectedClientId = null;
      this.selectedDepotId = null;
      this.selectedSocieteP = null;
    } else if (filterType === 'date') {
      // Ne pas initialiser automatiquement les dates, laisser l'utilisateur choisir
      // Les champs restent vides par défaut
    } else if (filterType === 'depot') {
      // Recharger les dépôts du projet actif pour s'assurer d'avoir les bonnes données
      console.log('🔄 [Voyage] Rechargement des dépôts pour le filtre');
      this.loadDepots();
    } else if (filterType === 'client') {
      // Recharger les clients du projet actif pour s'assurer d'avoir les bonnes données
      console.log('🔄 [Voyage] Rechargement des clients pour le filtre');
      this.loadClients();
    }
    
    this.applyFilter();
  }
  
  // 🔥 Obtenir le nombre total de voyages du projet actif uniquement
  getTotalVoyagesProjet(): number {
    if (this.projetActifId) {
      return this.voyages.filter(vg => vg.projetId === this.projetActifId).length;
    }
    return this.voyages.length;
  }
  
  getFilterCount(filterType: 'date' | 'client' | 'depot' | 'societeP'): number {
    let voyagesFiltrés = this.voyages;
    
    if (this.projetActifId) {
      voyagesFiltrés = voyagesFiltrés.filter(vg => vg.projetId === this.projetActifId);
    }
    
    if (filterType === 'date') {
      // Compter les voyages avec une date (voyages valides pour ce filtre)
      return voyagesFiltrés.filter(vg => vg.date).length;
    } else if (filterType === 'client') {
      // Compter les voyages avec un client
      return voyagesFiltrés.filter(vg => vg.clientId).length;
    } else if (filterType === 'depot') {
      // Compter les voyages avec un dépôt
      return voyagesFiltrés.filter(vg => vg.depotId).length;
    } else if (filterType === 'societeP') {
      return voyagesFiltrés.filter(vg => vg.societeP).length;
    }
    
    return 0;
  }

  // Effacer un filtre spécifique sans toucher aux autres
  clearFilter(filterType: 'date' | 'client' | 'depot' | 'societeP') {
    switch (filterType) {
      case 'date':
        this.dateDebut = null;
        this.dateFin = null;
        break;
      case 'client':
        this.selectedClientId = null;
        break;
      case 'depot':
        this.selectedDepotId = null;
        break;
      case 'societeP':
        this.selectedSocieteP = null;
        break;
    }
    this.applyFilter();
  }
  
  getTotalWeight(): number {
    return this.filteredVoyages.reduce((total, voyage) => {
      const poidsClient = voyage.poidsClient || 0;
      const poidsDepot = voyage.poidsDepot || 0;
      return total + poidsClient + poidsDepot;
    }, 0);
  }
  
  getTotalClientWeight(): number {
    return this.filteredVoyages.reduce((total, voyage) => {
      return total + (voyage.poidsClient || 0);
    }, 0);
  }
  
  getTotalDepotWeight(): number {
    return this.filteredVoyages.reduce((total, voyage) => {
      return total + (voyage.poidsDepot || 0);
    }, 0);
  }
  
  getTotalWeightLabel(): string {
    if (this.activeFilter === 'all') {
      return 'Total des voyages';
    } else if (this.activeFilter === 'date' && (this.dateDebut || this.dateFin)) {
      // Formater la plage de dates
      if (this.dateDebut && this.dateFin) {
        const dateD = new Date(this.dateDebut);
        const dateF = new Date(this.dateFin);
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const dateDebutFormatted = dateD.toLocaleDateString('fr-FR', options);
        const dateFinFormatted = dateF.toLocaleDateString('fr-FR', options);
        return `Total des voyages du ${dateDebutFormatted} au ${dateFinFormatted} (7h00 → 6h00)`;
      } else if (this.dateDebut) {
        const dateD = new Date(this.dateDebut);
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const dateDebutFormatted = dateD.toLocaleDateString('fr-FR', options);
        return `Total des voyages à partir du ${dateDebutFormatted} (7h00 → 6h00)`;
      } else if (this.dateFin) {
        const dateF = new Date(this.dateFin);
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const dateFinFormatted = dateF.toLocaleDateString('fr-FR', options);
        return `Total des voyages jusqu'au ${dateFinFormatted} (7h00 → 6h00)`;
      }
      return 'Total des voyages par date';
    } else if (this.activeFilter === 'client' && this.selectedClientId) {
      const client = this.clients.find(c => c.id === this.selectedClientId);
      if (client) {
        return `Total des voyages pour ${client.nom} (${client.numero || 'N/A'})`;
      }
      return 'Total des voyages par client';
    } else if (this.activeFilter === 'depot' && this.selectedDepotId) {
      const depot = this.depots.find(d => d.id === this.selectedDepotId);
      if (depot) {
        return `Total des voyages pour le dépôt ${depot.nom}`;
      }
      return 'Total des voyages par dépôt';
    }
    return 'Total des voyages';
  }
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortVoyages();
  }
  
  sortVoyages() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredVoyages.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof VoyageDTO];
      let bVal: any = b[this.sortColumn as keyof VoyageDTO];
      
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
    this.totalPages = Math.ceil(this.filteredVoyages.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedVoyages = this.filteredVoyages.slice(startIndex, endIndex);
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

  loadVoyages() {
    // Si on a un projet explicite dans l'URL => appel dédié
    if (this.projetActifId !== null && this.route.snapshot.routeConfig?.path?.includes('projet/:id/voyages')) {
      this.voyageService.getVoyagesByProjet(this.projetActifId, 'body').subscribe({
        next: (data) => {
          if (data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                this.voyages = JSON.parse(reader.result as string);
                // Trier par date décroissante (le plus récent en premier)
                this.sortVoyagesByDateDesc();
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
              this.applyFilter();
              this.extractUniqueSocietes();
            };
            reader.readAsText(data);
          } else {
            this.voyages = data;
            // Trier par date décroissante (le plus récent en premier)
            this.sortVoyagesByDateDesc();
            this.applyFilter();
            this.extractUniqueSocietes();
          }
        },
        error: (err) => this.error = 'Erreur chargement voyages projet: ' + (err.error?.message || err.message)
      });
      return;
    }

    // Sinon vue globale (tous puis filtrage éventuel par projet actif sélectionné)
    this.voyageService.getAllVoyages('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
            reader.onload = () => {
              try {
                this.voyages = JSON.parse(reader.result as string);
                // Trier par date décroissante (le plus récent en premier)
                this.sortVoyagesByDateDesc();
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
              this.applyFilter();
            };
            reader.readAsText(data);
        } else {
          this.voyages = data;
          // Trier par date décroissante (le plus récent en premier)
          this.sortVoyagesByDateDesc();
          this.applyFilter();
        }
        // Extraire toutes les sociétés uniques
        this.extractUniqueSocietes();
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  // Trier les voyages par date décroissante (le plus récent en premier)
  sortVoyagesByDateDesc(): void {
    this.voyages.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1; // Les voyages sans date vont à la fin
      if (!b.date) return -1;
      
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      // Ordre décroissant : le plus récent (dateB) avant l'ancien (dateA)
      return dateB - dateA;
    });
  }

  // Extraire toutes les sociétés uniques des voyages existants
  extractUniqueSocietes(): void {
    const societesSet = new Set<string>();
    this.voyages.forEach(voyage => {
      if (voyage.societe && voyage.societe.trim()) {
        societesSet.add(voyage.societe.trim());
      }
    });
    this.allSocietes = Array.from(societesSet).sort();
  }

  // Filtrer les sociétés selon l'input de recherche
  onSocieteSearchInput(): void {
    // Synchroniser avec dialogVoyage
    this.dialogVoyage.societe = this.societeSearchInput;
    
    const searchValue = this.societeSearchInput.trim().toLowerCase();
    
    // Nettoyer le timer existant
    if (this.societeDropdownTimer) {
      clearTimeout(this.societeDropdownTimer);
      this.societeDropdownTimer = null;
    }
    
    if (!searchValue) {
      this.filteredSocietes = this.allSocietes.slice(0, 10); // Afficher les 10 premières
      this.showSocieteDropdown = true;
      return;
    }
    
    // Filtrer les sociétés existantes
    this.filteredSocietes = this.allSocietes.filter(s => 
      s.toLowerCase().includes(searchValue)
    );
    
    this.showSocieteDropdown = true;
    
    // Si aucune société trouvée, démarrer un timer de 5 secondes pour fermer le popup
    if (this.filteredSocietes.length === 0 && searchValue) {
      this.societeDropdownTimer = setTimeout(() => {
        this.showSocieteDropdown = false;
        this.societeDropdownTimer = null;
      }, 500);
    }
  }

  // Sélectionner une société existante
  selectSociete(societe: string): void {
    this.dialogVoyage.societe = societe;
    this.societeSearchInput = societe;
    this.showSocieteDropdown = false;
    this.filteredSocietes = [];
  }

  // Réinitialiser la recherche de société
  resetSocieteSearch(): void {
    this.societeSearchInput = '';
    this.filteredSocietes = [];
    this.showSocieteDropdown = false;
    
    // Nettoyer le timer si existe
    if (this.societeDropdownTimer) {
      clearTimeout(this.societeDropdownTimer);
      this.societeDropdownTimer = null;
    }
  }

  // Filtrer les clients selon l'input de recherche (seulement les clients du projet actif)
  onClientSearchInput(): void {
    const searchValue = this.clientSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredClientsSearch = [];
      this.showClientDropdown = false;
      return;
    }
    
    // Filtrer UNIQUEMENT les clients du projet actif (this.clients est déjà filtré par loadClients())
    this.filteredClientsSearch = this.clients.filter(client =>
      client.nom?.toLowerCase().includes(searchValue) ||
      client.numero?.toLowerCase().includes(searchValue)
    );
    
    this.showClientDropdown = true;
    
    console.log('🔍 Recherche client dans projet:', this.contextProjetId || this.projetActifId);
    console.log('📋 Clients disponibles:', this.clients.length);
    console.log('🎯 Résultats filtrés:', this.filteredClientsSearch.length);
  }

  // Sélectionner un client existant
  selectClient(client: ClientDTO): void {
    this.dialogVoyage.clientId = client.id;
    this.clientSearchInput = `${client.nom} (${client.numero || 'N/A'})`;
    this.showClientDropdown = false;
    this.filteredClientsSearch = [];
    this.updateResteEnTempsReel();
    // Populate available autorisation codes for the selected client
    const autorisations = this.getClientAutorisations(client.id);
    this.dialogVoyage._availableAutorisation = autorisations;
    // Default select first code when available
    if (autorisations && autorisations.length > 0) {
      this.dialogVoyage.autorisationCode = autorisations[0].code || undefined;
    } else {
      this.dialogVoyage.autorisationCode = undefined;
    }
  }

  // Réinitialiser la recherche de client
  resetClientSearch(): void {
    this.clientSearchInput = '';
    this.filteredClientsSearch = [];
    this.showClientDropdown = false;
    this.dialogVoyage.clientId = undefined;
  }

  // Filtrer les dépôts selon l'input de recherche
  onDepotSearchInput(): void {
    const searchValue = this.depotSearchInput.trim().toLowerCase();
    
    if (!searchValue) {
      this.filteredDepotsSearch = [];
      this.showDepotDropdown = false;
      return;
    }
    
    // Filtrer les dépôts par nom
    this.filteredDepotsSearch = this.depots.filter(depot =>
      depot.nom?.toLowerCase().includes(searchValue)
    );
    
    this.showDepotDropdown = true;
  }

  // Sélectionner un dépôt existant
  selectDepot(depot: DepotDTO): void {
    this.dialogVoyage.depotId = depot.id;
    this.depotSearchInput = depot.nom || '';
    this.showDepotDropdown = false;
    this.filteredDepotsSearch = [];
    this.updateResteForDepot();
  }

  // Réinitialiser la recherche de dépôt
  resetDepotSearch(): void {
    this.depotSearchInput = '';
    this.filteredDepotsSearch = [];
    this.showDepotDropdown = false;
    this.dialogVoyage.depotId = undefined;
  }

  openDeleteDialog(voyage: VoyageDTO): void {
    this.voyageToDelete = voyage;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
    this.voyageToDelete = null;
  }

  confirmDeleteVoyage(): void {
    if (!this.voyageToDelete || !this.voyageToDelete.id) return;
    
    const id = this.voyageToDelete.id;
    const numTicket = this.voyageToDelete.numTicket;
    const numBonLivraison = this.voyageToDelete.numBonLivraison;
    const destination = this.voyageToDelete.clientId 
      ? `Client: ${this.voyageToDelete.clientNum || this.voyageToDelete.clientId}`
      : this.voyageToDelete.depotId 
        ? `Dépôt: ${this.voyageToDelete.depotNom || this.voyageToDelete.depotId}`
        : 'N/A';

    console.log('🗑️ Suppression voyage:', {
      voyageId: id,
      numTicket,
      numBonLivraison,
      destination
    });

    // 1. Supprimer le voyage
    this.voyageService.deleteVoyage(id, 'body').subscribe({
      next: () => {
        console.log('✅ Voyage supprimé avec succès');
        
        // 2. Trouver et supprimer le déchargement associé par numTicket ou numBonLivraison
        this.dechargementService.getAllDechargements('body').subscribe({
          next: async (dechargementsData) => {
            let dechargements: DechargementDTO[] = [];
            
            // Parser les données si c'est un Blob
            if (dechargementsData instanceof Blob) {
              const text = await dechargementsData.text();
              try {
                dechargements = JSON.parse(text);
              } catch (e) {
                console.error('❌ Erreur parsing déchargements:', e);
              }
            } else {
              dechargements = dechargementsData || [];
            }

            // Trouver le déchargement lié par numTicket ou numBonLivraison
            const dechargementAssocie = dechargements.find(d => 
              (numTicket && d.numTicket === numTicket) || 
              (numBonLivraison && d.numBonLivraison === numBonLivraison)
            );
            
            if (dechargementAssocie && dechargementAssocie.id) {
              console.log('🔍 Déchargement associé trouvé:', dechargementAssocie.id);
              
              const dechDestination = dechargementAssocie.clientId 
                ? `Client ID: ${dechargementAssocie.clientId}`
                : dechargementAssocie.depotId 
                  ? `Dépôt ID: ${dechargementAssocie.depotId}`
                  : 'N/A';
              
              // Supprimer le déchargement
              this.dechargementService.deleteDechargement(dechargementAssocie.id).subscribe({
                next: () => {
                  console.log('✅ Déchargement synchronisé et supprimé');
                  
                  // 3. Créer une notification de danger
                  const notificationMessage = `⚠️ OPÉRATION DANGEREUSE EFFECTUÉE

Suppression d'un voyage avec synchronisation automatique:

🚚 VOYAGE SUPPRIMÉ:
   • ID: ${id}
   • Bon de livraison: ${numBonLivraison || 'N/A'}
   • Ticket: ${numTicket || 'N/A'}
   • Date: ${this.formatDate(this.voyageToDelete?.date)}
   • Camion: ${this.voyageToDelete?.camionNom || this.voyageToDelete?.camionId || 'N/A'}
   • Chauffeur: ${this.voyageToDelete?.chauffeurNom || 'N/A'}
   • Destination: ${destination}
   • Quantité: ${this.voyageToDelete?.quantite || 0} T

📦 DÉCHARGEMENT SYNCHRONISÉ ET SUPPRIMÉ:
   • ID Déchargement: ${dechargementAssocie.id}
   • Ticket: ${dechargementAssocie.numTicket || 'N/A'}
   • Bon de livraison: ${dechargementAssocie.numBonLivraison || 'N/A'}
   • Destination: ${dechDestination}
   • Date: ${this.formatDate(dechargementAssocie.dateDechargement)}

⚠️ ATTENTION: Cette opération a supprimé automatiquement le déchargement associé pour maintenir la cohérence des données entre voyages et déchargements.

⏰ Date de l'opération: ${new Date().toLocaleString('fr-FR')}`;

                  this.notificationService.creerNotification({
                    type: TypeNotification.INFO_GENERALE,
                    niveau: NiveauAlerte.DANGER,
                    message: notificationMessage,
                    entiteType: 'VOYAGE',
                    entiteId: id,
                    lu: false,
                    deletable: false, // ⚠️ NOTIFICATION CRITIQUE - NON SUPPRIMABLE
                    dateCreation: new Date().toISOString()
                  } as any).subscribe({
                    next: () => {
                      console.log('✅ Notification de danger créée');
                      this.notificationService.rafraichir();
                    },
                    error: (err) => {
                      console.error('❌ Erreur création notification:', err);
                      // Ne pas bloquer l'opération si la notification échoue
                      if (err.status === 403) {
                        console.warn('⚠️ Session expirée - notification non créée (opération de suppression déjà effectuée)');
                      }
                    }
                  });
                },
                error: (err) => {
                  console.error('❌ Erreur suppression déchargement:', err);
                  this.error = 'Le voyage a été supprimé mais le déchargement associé n\'a pas pu être supprimé';
                }
              });
            } else {
              console.warn('⚠️ Aucun déchargement associé trouvé');
              
              // Notification sans déchargement
              const notificationMessage = `⚠️ OPÉRATION EFFECTUÉE

Suppression d'un voyage:

🚚 VOYAGE SUPPRIMÉ:
   • ID: ${id}
   • Bon de livraison: ${numBonLivraison || 'N/A'}
   • Ticket: ${numTicket || 'N/A'}
   • Date: ${this.formatDate(this.voyageToDelete?.date)}
   • Camion: ${this.voyageToDelete?.camionNom || this.voyageToDelete?.camionId || 'N/A'}
   • Chauffeur: ${this.voyageToDelete?.chauffeurNom || 'N/A'}
   • Destination: ${destination}
   • Quantité: ${this.voyageToDelete?.quantite || 0} T

ℹ️ Aucun déchargement associé n'a été trouvé pour synchronisation.

⏰ Date de l'opération: ${new Date().toLocaleString('fr-FR')}`;

              this.notificationService.creerNotification({
                type: TypeNotification.INFO_GENERALE,
                niveau: NiveauAlerte.WARNING,
                message: notificationMessage,
                entiteType: 'VOYAGE',
                entiteId: id,
                lu: false,
                deletable: false, // ⚠️ NOTIFICATION CRITIQUE - NON SUPPRIMABLE
                dateCreation: new Date().toISOString()
              } as any).subscribe({
                next: () => {
                  console.log('✅ Notification créée');
                  this.notificationService.rafraichir();
                },
                error: (err) => {
                  console.error('❌ Erreur création notification:', err);
                  // Ne pas bloquer l'opération si la notification échoue
                  if (err.status === 403) {
                    console.warn('⚠️ Session expirée - notification non créée (opération de suppression déjà effectuée)');
                  }
                }
              });
            }
            
            // Recharger les données
            this.loadVoyages();
            this.closeDeleteDialog();
          },
          error: (err) => {
            console.error('❌ Erreur chargement déchargements:', err);
            this.loadVoyages();
            this.closeDeleteDialog();
          }
        });
      },
      error: (err) => {
        this.error = 'Erreur suppression: ' + (err.error?.message || err.message);
        this.closeDeleteDialog();
      }
    });
  }

  deleteVoyage(id?: number) {
    if (id === undefined) return;
    
    // Trouver le voyage et ouvrir le modal de confirmation
    const voyage = this.voyages.find(v => v.id === id);
    if (voyage) {
      this.openDeleteDialog(voyage);
    }
  }

  private formatDate(date: any): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleString('fr-FR');
    } catch {
      return String(date);
    }
  }

  // Méthodes helper pour récupérer les informations du projet
  getNavire(voyage: VoyageDTO): string {
    if (!voyage.projetId) return '-';
    const projet = this.projets.find(p => p.id === voyage.projetId);
    return projet?.nomNavire || '-';
  }

  getPort(voyage: VoyageDTO): string {
    if (!voyage.projetId) return '-';
    const projet = this.projets.find(p => p.id === voyage.projetId);
    return projet?.port || '-';
  }

  getProduit(voyage: VoyageDTO): string {
    if (!voyage.projetId) return '-';
    const projet = this.projets.find(p => p.id === voyage.projetId);
    return projet?.nomProduit || '-';
  }

  // Obtenir le label du filtre actif avec gestion des combinaisons
  getActiveFilterLabel(): string {
    const filters: string[] = [];
    
    // Vérifier tous les filtres actifs
    if (this.dateDebut || this.dateFin) {
      if (this.dateDebut && this.dateFin) {
        filters.push(`Date: ${new Date(this.dateDebut).toLocaleDateString('fr-FR')} - ${new Date(this.dateFin).toLocaleDateString('fr-FR')}`);
      } else if (this.dateDebut) {
        filters.push(`Date: À partir du ${new Date(this.dateDebut).toLocaleDateString('fr-FR')}`);
      } else if (this.dateFin) {
        filters.push(`Date: Jusqu'au ${new Date(this.dateFin).toLocaleDateString('fr-FR')}`);
      }
    }
    
    if (this.selectedClientId) {
      const client = this.clients.find(c => c.id === this.selectedClientId);
      if (client) {
        filters.push(`Client: ${client.nom}`);
      }
    }
    
    if (this.selectedDepotId) {
      const depot = this.depots.find(d => d.id === this.selectedDepotId);
      if (depot) {
        filters.push(`Dépôt: ${depot.nom}`);
      }
    }
    
    if (this.selectedSocieteP) {
      filters.push(`Société: ${this.selectedSocieteP}`);
    }
    
    // Si aucun filtre n'est actif
    if (filters.length === 0) {
      return 'Tous les voyages';
    }
    
    // Combiner les filtres
    return filters.join(' et ');
  }

  exportToExcel(): void {
    // Récupérer les informations uniques de navire, port et produit
    const naviresSet = new Set<string>();
    const portsSet = new Set<string>();
    const produitsSet = new Set<string>();
    
    this.filteredVoyages.forEach(voyage => {
      const navire = this.getNavire(voyage);
      const port = this.getPort(voyage);
      const produit = this.getProduit(voyage);
      
      if (navire && navire !== '-') naviresSet.add(navire);
      if (port && port !== '-') portsSet.add(port);
      if (produit && produit !== '-') produitsSet.add(produit);
    });

    const navires = Array.from(naviresSet).join(', ');
    const ports = Array.from(portsSet).join(', ');
    const produits = Array.from(produitsSet).join(', ');
    const filterLabel = this.getActiveFilterLabel();

    // Calculer les statistiques
    const projet = this.contextProjet || this.projetActif;
    const quantiteTotale = projet?.quantiteTotale || 0;
    const nombreVoyages = this.filteredVoyages.length;
    const totalVoyages = this.filteredVoyages.reduce((sum, v) => {
      return sum + (v.poidsClient || 0) + (v.poidsDepot || 0);
    }, 0);

    // Créer le workbook
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([]);

    // Ajouter l'en-tête avec les informations
    let currentRow = 0;
  XLSX.utils.sheet_add_aoa(ws, [['LISTE DES VOYAGES']], { origin: { r: currentRow, c: 0 } });
  ws['!merges'] = ws['!merges'] || [];
  // ajusté pour inclure colonnes Autorisation et Reste Autorisation
  ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 14 } });
    currentRow++;

    if (navires) {
      XLSX.utils.sheet_add_aoa(ws, [[`Navire: ${navires}`]], { origin: { r: currentRow, c: 0 } });
  ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 14 } });
      currentRow++;
    }

    if (ports) {
      XLSX.utils.sheet_add_aoa(ws, [[`Port: ${ports}`]], { origin: { r: currentRow, c: 0 } });
  ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 14 } });
      currentRow++;
    }

    if (produits) {
      XLSX.utils.sheet_add_aoa(ws, [[`Produit: ${produits}`]], { origin: { r: currentRow, c: 0 } });
  ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 14 } });
      currentRow++;
    }

    // Ajouter la quantité totale du projet
    if (quantiteTotale > 0) {
      XLSX.utils.sheet_add_aoa(ws, [[`Quantité Totale du Projet: ${quantiteTotale.toLocaleString('fr-FR')} kg`]], { origin: { r: currentRow, c: 0 } });
      ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 12 } });
      currentRow++;
    }

    // Ajouter le nombre de voyages
    XLSX.utils.sheet_add_aoa(ws, [[`Nombre de Voyages: ${nombreVoyages}`]], { origin: { r: currentRow, c: 0 } });
    ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 12 } });
    currentRow++;

    // Ajouter le total des voyages
    XLSX.utils.sheet_add_aoa(ws, [[`Total des Voyages: ${totalVoyages.toLocaleString('fr-FR')} kg`]], { origin: { r: currentRow, c: 0 } });
    ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 12 } });
    currentRow++;

    // Ajouter le type de filtre
    XLSX.utils.sheet_add_aoa(ws, [[`Filtre: ${filterLabel}`]], { origin: { r: currentRow, c: 0 } });
    ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 12 } });
    currentRow++;

    // Ajouter une ligne vide
    currentRow++;

    // Préparer les données pour l'export avec nouvelle structure
    const dataToExport = this.filteredVoyages.map(voyage => {
      // Trouver les noms plutôt que les IDs
      const chauffeur = this.chauffeurs.find(c => c.id === voyage.chauffeurId);
      const camion = this.camions.find(c => c.id === voyage.camionId);
      const client = this.clients.find(c => c.id === voyage.clientId);
      const depot = this.depots.find(d => d.id === voyage.depotId);
  // Obtenir le code d'autorisation (s'il existe) et le reste pour ce code (cumulatif jusqu'au voyage)
  const autorisationCode = this.getVoyageAutorisationCode(voyage);
  const resteAutorisation = (voyage.clientId && autorisationCode) ? this.getResteClientForCodeUpToVoyage(voyage) : 0;

      return {
        'N° Bon de Livraison': voyage.numBonLivraison || '',
        'N° Ticket': voyage.numTicket || '',
        'Date': voyage.date ? this.formatDateTime(voyage.date) : '',
        'Chauffeur': chauffeur?.nom || '',
        'Camion': camion?.matricule || '',
        'Transporteur': voyage.societe || '',
        'Dépôt': depot?.nom || '',
        'Poids Dépôt (kg)': voyage.poidsDepot || '' ,
        'Client': client?.nom || '',
        'N° Client': client?.numero || '',
        'Poids Client (kg)': voyage.poidsClient || '',
        // ajouter autorisation et reste par code
        'Autorisation': autorisationCode || '',
        'Reste Autorisation (kg)': resteAutorisation,
        'Reste (kg)': this.getResteForVoyage(voyage),
        'Société': voyage.societeP || ''
      };
    });

    const headerRow = currentRow;
    
    // Ajouter les données
    XLSX.utils.sheet_add_json(ws, dataToExport, { origin: { r: currentRow, c: 0 } });

    // Appliquer les couleurs aux cellules
    // Colonnes: 0=BL, 1=Ticket, 2=Date, 3=Chauffeur, 4=Camion, 5=Transporteur
    // 6=Dépôt, 7=Poids Dépôt, 8=Client, 9=N° Client, 10=Poids Client, 11=Reste, 12=Société
    
    const dataStartRow = headerRow + 1;
    
    // Couleur pour le dépôt (jaune/orange) - colonnes 6 et 7
    const depotFill = {
      fgColor: { rgb: "FEF3C7" } // Jaune clair
    };
    
    // Couleur pour le client (vert clair) - colonnes 8, 9 et 10
    const clientFill = {
      fgColor: { rgb: "D1FAE5" } // Vert clair
    };
    
    this.filteredVoyages.forEach((voyage, index) => {
      const rowNum = dataStartRow + index;
      
      // Appliquer la couleur aux colonnes Dépôt (col 6) et Poids Dépôt (col 7)
      const depotCell = XLSX.utils.encode_cell({ r: rowNum, c: 6 });
      const poidsDepotCell = XLSX.utils.encode_cell({ r: rowNum, c: 7 });
      
      if (!ws[depotCell]) ws[depotCell] = { t: 's', v: '' };
      if (!ws[poidsDepotCell]) ws[poidsDepotCell] = { t: 'n', v: 0 };
      
      ws[depotCell].s = { fill: depotFill };
      ws[poidsDepotCell].s = { fill: depotFill };
      
      // Appliquer la couleur aux colonnes Client (col 8), N° Client (col 9) et Poids Client (col 10)
      const clientCell = XLSX.utils.encode_cell({ r: rowNum, c: 8 });
      const numClientCell = XLSX.utils.encode_cell({ r: rowNum, c: 9 });
      const poidsClientCell = XLSX.utils.encode_cell({ r: rowNum, c: 10 });
      
      if (!ws[clientCell]) ws[clientCell] = { t: 's', v: '' };
      if (!ws[numClientCell]) ws[numClientCell] = { t: 's', v: '' };
      if (!ws[poidsClientCell]) ws[poidsClientCell] = { t: 'n', v: 0 };
      
      ws[clientCell].s = { fill: clientFill };
      ws[numClientCell].s = { fill: clientFill };
      ws[poidsClientCell].s = { fill: clientFill };
    });

    // Ajuster la largeur des colonnes
    const columnWidths = [
      { wch: 20 }, // N° Bon de Livraison
      { wch: 15 }, // N° Ticket
      { wch: 18 }, // Date avec heure
      { wch: 20 }, // Chauffeur
      { wch: 15 }, // Camion
      { wch: 20 }, // Transporteur
      { wch: 20 }, // Dépôt
      { wch: 15 }, // Poids Dépôt
      { wch: 25 }, // Client
      { wch: 15 }, // N° Client
      { wch: 15 }, // Poids Client
      { wch: 18 }, // Reste Ticket (kg)
      { wch: 12 }, // Reste (kg)
      { wch: 22 }, // Société (dernière colonne)
      { wch: 18 }  // (réservé) -- si besoin
    ];
    ws['!cols'] = columnWidths;

    // Ajouter la feuille au workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Voyages');

    // Générer le nom du fichier avec la date actuelle et le filtre
    const fileName = this.generateFileName('xlsx');

    // Télécharger le fichier
    XLSX.writeFile(wb, fileName);
  }

  exportToPDF(): void {
    // Récupérer les informations uniques de navire, port et produit
    const naviresSet = new Set<string>();
    const portsSet = new Set<string>();
    const produitsSet = new Set<string>();
    
    this.filteredVoyages.forEach(voyage => {
      const navire = this.getNavire(voyage);
      const port = this.getPort(voyage);
      const produit = this.getProduit(voyage);
      
      if (navire && navire !== '-') naviresSet.add(navire);
      if (port && port !== '-') portsSet.add(port);
      if (produit && produit !== '-') produitsSet.add(produit);
    });

    const navires = Array.from(naviresSet).join(', ');
    const ports = Array.from(portsSet).join(', ');
    const produits = Array.from(produitsSet).join(', ');
    const filterLabel = this.getActiveFilterLabel();

    // Calculer les statistiques
    const projet = this.contextProjet || this.projetActif;
    const quantiteTotale = projet?.quantiteTotale || 0;
    const nombreVoyages = this.filteredVoyages.length;
    const totalVoyages = this.filteredVoyages.reduce((sum, v) => {
      return sum + (v.poidsClient || 0) + (v.poidsDepot || 0);
    }, 0);

    // Créer le PDF en mode paysage (landscape)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Titre principal
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTE DES VOYAGES', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

    let yPosition = 25;

    // Informations du projet
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (navires) {
      doc.text(`Navire: ${navires}`, 14, yPosition);
      yPosition += 5;
    }
    if (ports) {
      doc.text(`Port: ${ports}`, 14, yPosition);
      yPosition += 5;
    }
    if (produits) {
      doc.text(`Produit: ${produits}`, 14, yPosition);
      yPosition += 5;
    }
    if (quantiteTotale > 0) {
      doc.text(`Quantite Totale du Projet: ${Math.round(quantiteTotale)} kg`, 14, yPosition);
      yPosition += 5;
    }
    doc.text(`Nombre de Voyages: ${nombreVoyages}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Total des Voyages: ${Math.round(totalVoyages)} kg`, 14, yPosition);
    yPosition += 5;
    doc.text(`Filtre: ${filterLabel}`, 14, yPosition);
    yPosition += 8;

    // Préparer les données du tableau
    const tableData = this.filteredVoyages.map(voyage => {
      const chauffeur = this.chauffeurs.find(c => c.id === voyage.chauffeurId);
      const camion = this.camions.find(c => c.id === voyage.camionId);
      const client = this.clients.find(c => c.id === voyage.clientId);
      const depot = this.depots.find(d => d.id === voyage.depotId);
      const autorisationCode = this.getVoyageAutorisationCode(voyage);
      const resteTicket = autorisationCode && voyage.clientId ? Math.round(this.getResteClientForCodeUpToVoyage(voyage)) : 0;

      return [
        voyage.numBonLivraison || '',
        voyage.numTicket || '',
        voyage.date ? this.formatDateTime(voyage.date) : '',
        chauffeur?.nom || '',
        camion?.matricule || '',
        voyage.societe || '',
        depot?.nom || '',
        Math.round(voyage.poidsDepot || 0).toString(),
        client?.nom || '',
        client?.numero || '',
        Math.round(voyage.poidsClient || 0).toString(),
        autorisationCode || '',
        resteTicket.toString(),
        Math.round(this.getResteForVoyage(voyage)).toString(),
        voyage.societeP || ''
      ];
    });

    // Créer le tableau avec autoTable
    autoTable(doc, {
      startY: yPosition,
      head: [[
        'N° Bon',
        'N° Ticket',
        'Date',
        'Chauffeur',
        'Camion',
        'Transporteur',
        'Dépôt',
        'Poids Dépôt',
        'Client',
        'N° Client',
        'Poids Client',
        'Autorisation',
        'Reste Autorisation',
        'Reste',
        'Société'
      ]],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1,
        // permettre le retour à la ligne pour afficher les noms complets
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7
      },
      columnStyles: {
        0: { cellWidth: 16 },  // N° Bon
        1: { cellWidth: 12 },  // N° Ticket
        2: { cellWidth: 22 },  // Date
        3: { cellWidth: 18 },  // Chauffeur
        4: { cellWidth: 14 },  // Camion
        5: { cellWidth: 20 },  // Transporteur
        6: { cellWidth: 20, fillColor: [254, 243, 199] },  // Dépôt (jaune)
        7: { cellWidth: 12, fillColor: [254, 243, 199], halign: 'right' },  // Poids Dépôt (jaune)
        8: { cellWidth: 24, fillColor: [209, 250, 229] },  // Client (vert)
        9: { cellWidth: 12, fillColor: [209, 250, 229] },  // N° Client (vert)
        10: { cellWidth: 12, fillColor: [209, 250, 229], halign: 'right' },  // Poids Client (vert)
        11: { cellWidth: 26, halign: 'left' }, // code autorisation
        12: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },  // Reste Ticket (kg)
        13: { cellWidth: 14, halign: 'right' },  // Reste
        14: { cellWidth: 28 }   // Société (augmentée pour tenir le nom complet)
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { left: 14, right: 14 }
    });

    // Générer le nom du fichier avec la date actuelle et le filtre
    const fileName = this.generateFileName('pdf');

    // Télécharger le PDF
    doc.save(fileName);
  }

  // Générer un nom de fichier significatif avec les filtres
  generateFileName(extension: 'xlsx' | 'pdf'): string {
    const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
    let filterPart = '';

    // Ajouter le type de filtre au nom du fichier
    if (this.activeFilter === 'date' && (this.dateDebut || this.dateFin)) {
      if (this.dateDebut && this.dateFin) {
        const dateD = new Date(this.dateDebut).toLocaleDateString('fr-FR').replace(/\//g, '-');
        const dateF = new Date(this.dateFin).toLocaleDateString('fr-FR').replace(/\//g, '-');
        filterPart = `_Date_${dateD}_au_${dateF}`;
      } else if (this.dateDebut) {
        const dateD = new Date(this.dateDebut).toLocaleDateString('fr-FR').replace(/\//g, '-');
        filterPart = `_Date_a_partir_${dateD}`;
      } else if (this.dateFin) {
        const dateF = new Date(this.dateFin).toLocaleDateString('fr-FR').replace(/\//g, '-');
        filterPart = `_Date_jusquau_${dateF}`;
      }
    } else if (this.activeFilter === 'client' && this.selectedClientId) {
      const client = this.clients.find(c => c.id === this.selectedClientId);
      const clientName = client?.nom?.replace(/[^a-zA-Z0-9]/g, '_') || 'Client';
      filterPart = `_${clientName}`;
    } else if (this.activeFilter === 'depot' && this.selectedDepotId) {
      const depot = this.depots.find(d => d.id === this.selectedDepotId);
      const depotName = depot?.nom?.replace(/[^a-zA-Z0-9]/g, '_') || 'Depot';
      filterPart = `_${depotName}`;
    } else if (this.activeFilter === 'societeP' && this.selectedSocieteP) {
      const societeName = this.selectedSocieteP.replace(/[^a-zA-Z0-9]/g, '_');
      filterPart = `_${societeName}`;
    } else {
      filterPart = '_Tous';
    }

    return `Voyages${filterPart}_${dateStr}.${extension}`;
  }

  // Formater la date pour l'affichage dans le tableau
  formatDateTime(date: string | undefined): string {
    if (!date) return '-';
    
    try {
      const dateObj = new Date(date);
      
      // Vérifier si la date est valide
      if (isNaN(dateObj.getTime())) return date;
      
      // Formater: JJ/MM/AAAA HH:mm
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return date;
    }
  }

  // Helper: retourne aujourd'hui au format yyyy-MM-dd (heure locale)
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
