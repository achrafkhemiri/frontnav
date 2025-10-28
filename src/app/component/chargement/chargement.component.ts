import { Component, HostListener, Inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChargementControllerService } from '../../api/api/chargementController.service';
import { DechargementControllerService } from '../../api/api/dechargementController.service';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { ChargementDTO } from '../../api/model/chargementDTO';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { CamionControllerService } from '../../api/api/camionController.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetDepotControllerService } from '../../api/api/projetDepotController.service';
import { ClientControllerService } from '../../api/api/clientController.service';
import { DepotControllerService } from '../../api/api/depotController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { CamionDTO } from '../../api/model/camionDTO';
import { ProjetDTO } from '../../api/model/projetDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { HttpClient } from '@angular/common/http';
import { BASE_PATH } from '../../api/variables';
import { ProjetActifService } from '../../service/projet-actif.service';
import { NotificationService } from '../../service/notification.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-chargement',
  templateUrl: './chargement.component.html',
  styleUrls: ['./chargement.component.css']
})
export class ChargementComponent {
  chargements: ChargementDTO[] = [];
  filteredChargements: ChargementDTO[] = [];
  paginatedChargements: ChargementDTO[] = [];
  projetActifId: number | null = null;
  projetActif: any = null;
  contextProjetId: number | null = null;
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  selectedChargement: ChargementDTO | null = null;
  dialogChargement: ChargementDTO = { camionId: 0, chauffeurId: 0, societe: '', projetId: 0, dateChargement: '' };
  editMode: boolean = false;
  error: string = '';
  chauffeurs: ChauffeurDTO[] = [];
  camions: CamionDTO[] = [];
  projets: ProjetDTO[] = [];
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  showDechargementDialog: boolean = false;
  showDeleteDialog: boolean = false;
  chargementToDelete: ChargementDTO | null = null;
  chargementFilter: string = '';
  
  // Dialog dechargement
  dialogDechargement: any = {
    id: undefined, // ID du déchargement en édition
    chargementId: 0,
    numTicket: '',
    numBonLivraison: '',
    poidCamionVide: 0,
    poidComplet: 0,
    clientId: undefined,
    depotId: undefined,
    poidsClient: 0,
    poidsDepot: 0,
    societeP: '', // Société du projet/chargement
    _type: 'client', // 'client' ou 'depot'
    _originalClientId: undefined, // Stocker la valeur initiale pour empêcher de changer les deux
    _originalDepotId: undefined
  };
  selectedChargementForDechargement: ChargementDTO | null = null;
  editingDechargement: boolean = false; // Flag pour savoir si on édite ou crée
  clients: any[] = [];
  depots: any[] = [];
  projetsClients: any[] = [];
  projetsDepots: any[] = [];
  dechargements: any[] = [];
  
  // Recherche client/depot dans dechargement
  clientSearchInput: string = '';
  depotSearchInput: string = '';
  filteredClientsSearch: any[] = [];
  filteredDepotsSearch: any[] = [];
  showClientDropdown: boolean = false;
  showDepotDropdown: boolean = false;
  
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
  
  // Informations du projet (extraites des chargements)
  projetInfo: {
    produit: string;
    navire: string;
    port: string;
  } = {
    produit: '',
    navire: '',
    port: ''
  };
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filtres
  activeFilter: 'all' | 'date' | 'societeP' = 'all';
  dateDebut: string | null = null;
  dateFin: string | null = null;
  selectedSocieteP: string | null = null;
  
  // Date max pour le filtre (aujourd'hui)
  today: string = '';
  
  Math = Math;

  // Validation flags for déchargement form
  weightsAreIntegers: boolean = true;
  isBrutGreaterThanTar: boolean = true;
  get canSubmitDechargement(): boolean {
    return this.weightsAreIntegers && this.isBrutGreaterThanTar && !!this.dialogDechargement.numTicket && ((this.dialogDechargement._type === 'client' && !!this.dialogDechargement.clientId) || (this.dialogDechargement._type === 'depot' && !!this.dialogDechargement.depotId));
  }

  // Modal de confirmation de dépassement
  showDepassementModal: boolean = false;
  depassementQuantite: number = 0;

  constructor(
    private chargementService: ChargementControllerService,
    private dechargementService: DechargementControllerService,
    private voyageService: VoyageControllerService,
    private chauffeurService: ChauffeurControllerService,
    private camionService: CamionControllerService,
    private projetService: ProjetControllerService,
    private clientService: ClientControllerService,
  private depotService: DepotControllerService,
  private projetDepotService: ProjetDepotControllerService,
    private projetActifService: ProjetActifService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService,
    @Inject(BASE_PATH) private basePath: string
  ) {
    // Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        if (!previousId || previousId !== projet.id) {
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
    this.initializeProjetContext();
  }

  // Sociétés du projet actif/contexte pour affichage dans le header
  get societesList(): string[] {
    const proj = this.contextProjet || this.projetActif;
    const set = proj?.societeNoms as Set<string> | string[] | undefined;
    if (!set) return [];
    const arr = Array.isArray(set) ? set : Array.from(set);
    return arr.filter((s: string) => !!s && s.trim() !== '');
  }

  initializeProjetContext() {
    // 1. Récupérer le projet actif global du service
    const globalProjet = this.projetActifService.getProjetActif();
    if (globalProjet && globalProjet.id) {
      this.projetActifId = globalProjet.id;
      this.projetActif = globalProjet;
      console.log('✅ [Chargement] Projet actif initialisé:', this.projetActif.nom, '- Active:', this.projetActif.active, '- canAddData():', this.canAddData());
    } else {
      console.warn('⚠️ [Chargement] Aucun projet actif trouvé au démarrage');
    }

    // 2. Vérifier si on est dans un contexte projet (via route /projet/:id/chargements)
    this.route.paramMap.subscribe(pm => {
      const pid = pm.get('id');
      const urlProjetId = pid ? Number(pid) : null;
      const contextId = window.sessionStorage.getItem('projetActifId');
      
      if (contextId) {
        this.contextProjetId = Number(contextId);
        
        // Si le contextId correspond au projet actif déjà chargé, l'utiliser directement
        if (this.projetActif && this.projetActif.id === this.contextProjetId) {
          this.contextProjet = this.projetActif;
          console.log('✅ [Chargement] Context projet = projet actif:', this.contextProjet.nom);
        } else {
          this.loadProjetDetails(this.contextProjetId, true);
        }
      } else if (urlProjetId) {
        this.projetActifId = urlProjetId;
        this.loadProjetDetails(urlProjetId);
      }
      this.loadChargements();
    });
    
    this.loadProjets();
    this.loadChauffeurs();
    this.loadCamions();
    this.loadClientsAndDepots();
  }

  ngOnInit() {
    // Initialiser la date du jour au format yyyy-MM-dd
    this.today = this.getTodayString();
    this.updateBreadcrumb();
  }

  reloadData() {
    console.log('🔄 [Chargement] reloadData() - Projet actif:', this.projetActif?.nom, 'ID:', this.projetActifId);
    
    const currentUrl = window.location.pathname;
    const isOnParametrePage = currentUrl.includes('/parametre');
    
    if (isOnParametrePage) {
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        const contextIdNumber = Number(contextId);
        console.log('📌 [Chargement] Page paramètre - Contexte:', contextIdNumber);
        this.contextProjetId = contextIdNumber;
        if (contextIdNumber !== this.projetActifId) {
          this.loadProjetDetails(this.contextProjetId, true);
        } else {
          this.contextProjet = this.projetActif;
        }
      }
    } else {
      console.log('🏠 [Chargement] Mode Vue Projet Actif - Projet:', this.projetActif?.nom);
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    // Recharger toutes les données
    this.loadChargements();
    this.loadProjets();
    this.loadChauffeurs();
    this.loadCamions();
    this.loadClientsAndDepots();
    this.updateBreadcrumb();
  }

  updateBreadcrumb() {
    this.breadcrumbItems = [
      { label: 'Accueil', url: '/home' },
      { label: 'Projets', url: '/projet-list' }
    ];
    
    if (this.contextProjet) {
      this.breadcrumbItems.push({
        label: this.contextProjet.nom || 'Projet',
        url: `/projet/${this.contextProjetId}`
      });
    } else if (this.projetActif) {
      this.breadcrumbItems.push({
        label: this.projetActif.nom || 'Projet',
        url: `/projet/${this.projetActifId}`
      });
    }
    
    this.breadcrumbItems.push({ label: 'Order de Chargements' });
  }

  // Générer la date et heure actuelle pour la Tunisie (UTC+1)
  getTunisiaDateTime(): string {
    const now = new Date();
    // Tunisie est UTC+1 (ajouter 1 heure)
    const tunisiaOffset = 1; // heures
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const tunisiaTime = new Date(utcTime + (3600000 * tunisiaOffset));
    
    // Format: yyyy-MM-ddTHH:mm:ss
    const year = tunisiaTime.getFullYear();
    const month = String(tunisiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(tunisiaTime.getDate()).padStart(2, '0');
    const hours = String(tunisiaTime.getHours()).padStart(2, '0');
    const minutes = String(tunisiaTime.getMinutes()).padStart(2, '0');
    const seconds = String(tunisiaTime.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  loadProjetDetails(id: number, isContext: boolean = false) {
    this.projetService.getProjetById(id).subscribe({
      next: (projet) => {
        if (isContext) {
          this.contextProjet = projet;
        } else {
          this.projetActif = projet;
        }
        this.updateBreadcrumb();
        const projetSocietes = projet.societeNoms ? Array.from(projet.societeNoms).join(', ') : 'Aucune société';
        console.log('✅ [Chargement] Projet chargé:', projetSocietes, '- Active:', projet.active, '- canAddData():', this.canAddData());
      },
      error: (err) => console.error('❌ Erreur chargement projet:', err)
    });
  }

  loadChargements() {
    // 🔥 FIX: Utiliser le projet actif pour filtrer les chargements
    const projectId = this.contextProjetId || this.projetActifId;
    console.log('📊 [loadChargements] contextProjetId:', this.contextProjetId, 'projetActifId:', this.projetActifId, '→ projectId:', projectId);
    
    // 🔥 Si on a un projet actif, charger UNIQUEMENT les chargements de CE projet
    if (projectId) {
      console.log('📤 [loadChargements] Appel API getChargementsByProjet:', projectId);
      this.chargementService.getChargementsByProjet(projectId).subscribe({
        next: async (data) => {
          console.log('✅ [loadChargements] Réponse reçue pour projet', projectId, ':', data);
          
          // Si c'est un Blob, le convertir en JSON
          if (data instanceof Blob) {
            try {
              const text = await data.text();
              if (!text || text.trim() === '') {
                console.warn('⚠️ Blob vide, aucun chargement pour ce projet');
                this.chargements = [];
              } else {
                const jsonData = JSON.parse(text);
                this.chargements = Array.isArray(jsonData) ? jsonData : [];
              }
            } catch (e) {
              console.error('❌ Impossible de parser le Blob:', e);
              this.chargements = [];
              this.error = 'Erreur: réponse invalide du serveur';
            }
          } else {
            this.chargements = Array.isArray(data) ? data : [];
          }
          
          // Filtrer les chargements déjà déchargés
          await this.filterChargementsDecharges();
          
          // Extraire les informations du projet depuis le premier chargement
          this.extractProjetInfo();
          
          console.log('📦 [loadChargements] Chargements filtrés du projet', projectId, ':', this.chargements.length, 'éléments');
          this.applyFilter();
        },
        error: (err) => {
          console.error('❌ [loadChargements] Erreur API:', err);
          this.error = 'Impossible de charger les chargements du projet';
          this.chargements = [];
          this.applyFilter();
        }
      });
    } else {
      // Sinon charger tous les chargements (vue globale)
      console.log('📤 [loadChargements] Appel API getAllChargements (vue globale)');
      this.chargementService.getAllChargements().subscribe({
        next: async (data) => {
          console.log('✅ [loadChargements] Réponse reçue (tous):', data);
          
          // Si c'est un Blob, le convertir en JSON
          if (data instanceof Blob) {
            try {
              const text = await data.text();
              if (!text || text.trim() === '') {
                console.warn('⚠️ Blob vide, aucun chargement');
                this.chargements = [];
              } else {
                const jsonData = JSON.parse(text);
                this.chargements = Array.isArray(jsonData) ? jsonData : [];
              }
            } catch (e) {
              console.error('❌ Impossible de parser le Blob:', e);
              this.chargements = [];
              this.error = 'Erreur: réponse invalide du serveur';
            }
          } else {
            this.chargements = Array.isArray(data) ? data : [];
          }
          
          // Filtrer les chargements déjà déchargés
          await this.filterChargementsDecharges();
          
          // Extraire les informations du projet depuis le premier chargement
          this.extractProjetInfo();
          
          console.log('📦 [loadChargements] Tous les chargements:', this.chargements.length, 'éléments');
          this.applyFilter();
        },
        error: (err) => {
          console.error('❌ [loadChargements] Erreur API:', err);
          this.error = 'Impossible de charger les chargements';
          this.chargements = [];
          this.applyFilter();
        }
      });
    }
  }

  // Extraire les informations du projet depuis le premier chargement
  extractProjetInfo(): void {
    if (this.chargements && this.chargements.length > 0) {
      const firstChargement = this.chargements[0];
      this.projetInfo = {
        produit: firstChargement.produit || 'N/A',
        navire: firstChargement.navire || 'N/A',
        port: firstChargement.port || 'N/A'
      };
      console.log('✅ Informations du projet extraites:', this.projetInfo);
    } else {
      this.projetInfo = {
        produit: 'N/A',
        navire: 'N/A',
        port: 'N/A'
      };
      console.log('⚠️ Aucun chargement disponible pour extraire les informations');
    }
  }

  async filterChargementsDecharges() {
    try {
      const response = await this.dechargementService.getAllDechargements().toPromise();
      let dechargements: any[] = [];
      
      // Gérer le cas où la réponse est un Blob
      if (response instanceof Blob) {
        const text = await response.text();
        try {
          dechargements = JSON.parse(text);
        } catch (e) {
          console.error('❌ Erreur parsing déchargements Blob:', e);
          return; // En cas d'erreur, on continue avec tous les chargements
        }
      } else if (Array.isArray(response)) {
        dechargements = response;
      }
      
      const chargementsDechargesIds = new Set<number>();
      dechargements.forEach((dechargement: any) => {
        if (dechargement.chargementId) {
          chargementsDechargesIds.add(dechargement.chargementId);
        }
      });
      
      // Filtrer les chargements qui ne sont pas déchargés
      const beforeCount = this.chargements.length;
      this.chargements = this.chargements.filter(chg => !chargementsDechargesIds.has(chg.id!));
      console.log(`✅ Chargements filtrés: ${beforeCount} → ${this.chargements.length} (${beforeCount - this.chargements.length} déchargés cachés)`);
    } catch (err) {
      console.error('❌ Erreur lors du filtrage des déchargements:', err);
      // En cas d'erreur, on continue avec tous les chargements
    }
  }

  openDechargementForm(chargement: ChargementDTO) {
    this.selectedChargementForDechargement = chargement;
    this.editingDechargement = false; // Mode création
    this.dialogDechargement = {
      id: undefined,
      chargementId: chargement.id,
      numTicket: '',
      numBonLivraison: '',
      poidCamionVide: 0,
      poidComplet: 0,
      clientId: undefined,
      depotId: undefined,
      poidsClient: 0,
      poidsDepot: 0,
      societeP: chargement.societeP || '', // 🔥 Initialiser avec la société du chargement
      _type: 'client',
      _originalClientId: undefined,
      _originalDepotId: undefined
    };
    this.clientSearchInput = '';
    this.depotSearchInput = '';
    this.showDechargementDialog = true;
    this.loadClientsAndDepots();
    this.loadDechargements();

    // Reset validation state
    this.weightsAreIntegers = true;
    this.isBrutGreaterThanTar = true;
  }

  // 🆕 Fonction pour éditer un déchargement existant
  editDechargement(dechargement: any, chargement: ChargementDTO) {
    this.selectedChargementForDechargement = chargement;
    this.editingDechargement = true; // Mode édition
    
    // Déterminer le type et les valeurs initiales
    const hasClient = dechargement.clientId !== undefined && dechargement.clientId !== null;
    const hasDepot = dechargement.depotId !== undefined && dechargement.depotId !== null;
    
    this.dialogDechargement = {
      id: dechargement.id, // Stocker l'ID pour l'édition
      chargementId: dechargement.chargementId || chargement.id,
      numTicket: dechargement.numTicket || '',
      numBonLivraison: dechargement.numBonLivraison || '',
      poidCamionVide: dechargement.poidCamionVide || 0,
      poidComplet: dechargement.poidComplet || 0,
      clientId: dechargement.clientId,
      depotId: dechargement.depotId,
      poidsClient: dechargement.poidsClient || 0,
      poidsDepot: dechargement.poidsDepot || 0,
      societeP: chargement.societeP || '',
      _type: hasClient ? 'client' : 'depot',
      _originalClientId: dechargement.clientId, // 🔒 Stocker la valeur initiale
      _originalDepotId: dechargement.depotId     // 🔒 Stocker la valeur initiale
    };
    
    // Initialiser les champs de recherche si nécessaire
    this.clientSearchInput = '';
    this.depotSearchInput = '';
  // Populate available autorisation codes for the selected client (when editing)
  const autorisations = this.getClientAutorisations(this.dialogDechargement.clientId);
  this.dialogDechargement._availableAutorisation = autorisations;
  // Pre-fill autorisationCode from the existing dechargement if present, else use first available code
  this.dialogDechargement.autorisationCode = dechargement.autorisationCode || dechargement.autorisation?.code || (autorisations && autorisations.length > 0 ? autorisations[0].code : undefined);
    
    this.showDechargementDialog = true;
    this.loadClientsAndDepots();
    this.loadDechargements();

    // Reset validation state
    this.weightsAreIntegers = true;
    this.isBrutGreaterThanTar = true;
    
    console.log('✏️ Mode édition déchargement:', {
      id: dechargement.id,
      type: this.dialogDechargement._type,
      clientId: dechargement.clientId,
      depotId: dechargement.depotId
    });
  }

  loadClientsAndDepots() {
    const projetId = this.contextProjetId || this.projetActifId;
    
    if (!projetId) {
      console.warn('⚠️ Aucun projet actif, impossible de charger les clients/dépôts');
      return;
    }

    // Charger les associations projet-client pour ce projet afin de récupérer les autorisations (codes + quantites)
    console.log(`📥 Chargement des associations projet-client pour le projet ${projetId}...`);
    const projetClientsUrl = `${this.basePath}/api/projet-client/projet/${projetId}`;
    this.http.get<any[]>(projetClientsUrl, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
      next: (projetClients) => {
        console.log('✅ Réponse projet-clients:', projetClients?.length || 0);
        if (!Array.isArray(projetClients) || projetClients.length === 0) {
          // fallback: try to load clients normally
          this.clientService.getClientsByProjet(projetId, 'body').subscribe({
            next: (data: any) => { this.clients = Array.isArray(data) ? data : []; this.projetsClients = this.clients.map(c => ({ id: c.id, projetId, clientId: c.id, quantiteAutorisee: c.quantitesAutoriseesParProjet?.[projetId] || 0 })); },
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

    // Charger les dépôts du projet et récupérer les quantités autorisées via ProjetDepot
    console.log(`📥 Chargement des dépôts + projet-depots pour le projet ${projetId}...`);
    // 1) charger la liste basique des dépôts (infos) via depotService
    const depotUrl = `${this.basePath}/api/projets/${projetId}/depots`;
    this.http.get(depotUrl, { withCredentials: true }).subscribe({
      next: async (data: any) => {
        let depotsData: any[] = [];
        if (data instanceof Blob) {
          const text = await data.text();
          try { depotsData = JSON.parse(text); } catch(e) { depotsData = []; console.error('❌ Erreur parsing dépôts:', e); }
        } else { depotsData = Array.isArray(data) ? data : []; }
        this.depots = depotsData;

        // 2) charger les associations ProjetDepot (avec quantiteAutorisee)
        this.projetsDepots = [];
        this.projetDepotService.getProjetDepotsByProjetId(projetId).subscribe({
          next: async (pdData: any) => {
            let pdArray: any[] = [];
            
            // Gérer le cas Blob
            if (pdData instanceof Blob) {
              const text = await pdData.text();
              try { 
                pdArray = JSON.parse(text); 
              } catch(e) { 
                console.error('❌ Erreur parsing projet-depots:', e); 
                pdArray = []; 
              }
            } else {
              pdArray = Array.isArray(pdData) ? pdData : [];
            }
            
            // projetsDepots contient id (projetDepot id), projetId, depotId, quantiteAutorisee
            this.projetsDepots = pdArray.map((pd: any) => ({
              id: pd.id,
              projetId: pd.projetId || projetId,
              depotId: pd.depotId,
              quantiteAutorisee: pd.quantiteAutorisee || 0
            }));

            console.log('✅ Dépôts chargés:', this.depots.length);
            console.log('✅ Projets-dépôts chargés:', this.projetsDepots.length, this.projetsDepots);
          },
          error: (err: any) => {
            console.error('❌ Erreur chargement projet-depots:', err);
            // fallback minimal: créer projetsDepots sans quantite
            this.projetsDepots = this.depots.map((d: any) => ({ id: d.id, projetId: projetId, depotId: d.id, quantiteAutorisee: 0 }));
          }
        });
      },
      error: (err: any) => { console.error('❌ Erreur chargement dépôts du projet:', err); this.depots = []; this.projetsDepots = []; }
    });
  }

  // Obtenir la quantité autorisée pour un dépôt
  getQuantiteAutoriseeDepot(depotId: number | undefined): number {
    if (!depotId) return 0;
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return 0;
    const projetDepot = this.projetsDepots.find(pd => pd.projetId === projetId && pd.depotId === depotId);
    return projetDepot?.quantiteAutorisee || 0;
  }

  // Calculer total livré au dépôt
  getTotalLivreDepot(depotId: number): number {
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return 0;
    return this.dechargements
      .filter(d => d.depotId === depotId)
      .reduce((sum, d) => {
        const poidsNet = (d.poidComplet || 0) - (d.poidCamionVide || 0);
        return sum + poidsNet;
      }, 0);
  }

  // Calculer le reste pour un dépôt
  getResteDepot(depotId: number): number {
    const quantiteAutorisee = this.getQuantiteAutoriseeDepot(depotId);
    const totalLivre = this.getTotalLivreDepot(depotId);
    return quantiteAutorisee - totalLivre;
  }

  isDepotEnDepassement(depotId: number | undefined): boolean {
    if (!depotId) return false;
    const reste = this.getResteDepot(depotId);
    return reste < 0;
  }

  loadDechargements() {
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return;

    this.dechargementService.getAllDechargements().subscribe({
      next: async (data: any) => {
        let allDechargements: any[] = [];
        if (data instanceof Blob) {
          const text = await data.text();
          allDechargements = JSON.parse(text);
        } else {
          allDechargements = data;
        }
        // Filtrer les déchargements du projet actuel
        this.dechargements = allDechargements.filter(d => d.projetId === projetId);
        console.log('✅ Déchargements chargés:', this.dechargements.length);
      },
      error: (err) => console.error('❌ Erreur chargement déchargements:', err)
    });
  }

  saveDechargement() {
    // Réinitialiser l'erreur
    this.error = '';
    
    // Vérifier immédiatement si le client dépasse sa quantité autorisée (PREMIÈRE VÉRIFICATION)
    const poidsNet = this.calculatePoids();
    if (this.dialogDechargement._type === 'client' && this.dialogDechargement.clientId) {
      // If a specific autorisation code was selected, validate against that code's remaining quantity
      const selectedCode = this.dialogDechargement.autorisationCode;
      let resteClientForCheck = this.getResteClient(this.dialogDechargement.clientId);
      if (selectedCode) {
        resteClientForCheck = this.getResteClientForCode(this.dialogDechargement.clientId, selectedCode);
      }
      if (poidsNet > resteClientForCheck) {
        const depassement = poidsNet - resteClientForCheck;
        this.depassementQuantite = depassement;
        this.showDepassementModal = true;
        return; // Afficher la modal immédiatement
      }
    }

    // Si type depot, vérifier la quantité autorisée du dépôt
    if (this.dialogDechargement._type === 'depot' && this.dialogDechargement.depotId) {
      const resteDepot = this.getResteDepot(this.dialogDechargement.depotId);
      if (poidsNet > resteDepot) {
        const depassement = poidsNet - resteDepot;
        this.depassementQuantite = depassement;
        this.showDepassementModal = true;
        return; // Afficher la modal immédiatement
      }
    }

    // Si pas de dépassement, faire les validations normales
    this.proceedWithSaveDechargement();
  }

  // Confirmer le dépassement et continuer l'enregistrement
  confirmDepassement() {
    this.showDepassementModal = false;
    this.proceedWithSaveDechargement();
  }

  // Annuler le dépassement
  cancelDepassement() {
    this.showDepassementModal = false;
  }

  // Procéder avec l'enregistrement du déchargement
  private proceedWithSaveDechargement() {
    // Validate integer weights and brut > tar before submit
    this.validateWeights();
    if (!this.weightsAreIntegers) {
      this.error = 'Les poids doivent être des entiers (sans décimales).';
      return;
    }
    if (!this.isBrutGreaterThanTar) {
      this.error = 'Le poids brut doit être strictement supérieur au poids tar.';
      return;
    }
    if (!this.dialogDechargement.numTicket) {
      this.error = 'Le numéro de ticket est obligatoire';
      return;
    }
    
    // Validation de societeP
    if (!this.dialogDechargement.societeP) {
      this.error = 'Veuillez sélectionner une société';
      return;
    }

    // 🔒 VALIDATION STRICTE: Un déchargement ne peut avoir QU'UNE SEULE destination
    const hasClient = this.dialogDechargement.clientId !== undefined && this.dialogDechargement.clientId !== null;
    const hasDepot = this.dialogDechargement.depotId !== undefined && this.dialogDechargement.depotId !== null;
    
    if (hasClient && hasDepot) {
      this.error = '❌ ERREUR: Un déchargement ne peut pas avoir à la fois un client ET un dépôt. Veuillez choisir UNE SEULE destination.';
      console.error('🚫 Tentative de sauvegarder avec clientId ET depotId:', {
        clientId: this.dialogDechargement.clientId,
        depotId: this.dialogDechargement.depotId,
        type: this.dialogDechargement._type
      });
      return;
    }

    // 🔒 EN MODE ÉDITION: Empêcher de changer les DEUX destinations
    if (this.editingDechargement) {
      const originalHadClient = this.dialogDechargement._originalClientId !== undefined && this.dialogDechargement._originalClientId !== null;
      const originalHadDepot = this.dialogDechargement._originalDepotId !== undefined && this.dialogDechargement._originalDepotId !== null;
      
      // Si l'original avait un client et maintenant on a un dépôt (ou vice-versa), c'est OK
      // MAIS si l'original avait client et maintenant on a AUSSI client + depot, c'est interdit
      if (originalHadClient && hasDepot && hasClient) {
        this.error = '❌ Vous ne pouvez pas avoir à la fois un client ET un dépôt. Choisissez UN SEUL.';
        return;
      }
      if (originalHadDepot && hasClient && hasDepot) {
        this.error = '❌ Vous ne pouvez pas avoir à la fois un client ET un dépôt. Choisissez UN SEUL.';
        return;
      }

      console.log('✏️ Édition:', {
        originalClient: this.dialogDechargement._originalClientId,
        originalDepot: this.dialogDechargement._originalDepotId,
        newClient: this.dialogDechargement.clientId,
        newDepot: this.dialogDechargement.depotId,
        type: this.dialogDechargement._type
      });
    }

    if (this.dialogDechargement._type === 'client' && !hasClient) {
      this.error = 'Veuillez sélectionner un client';
      return;
    }

    if (this.dialogDechargement._type === 'depot' && !hasDepot) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }

    // Valider que le poids ne dépasse pas le reste du projet
    const poidsNet = this.calculatePoids();
    const resteProjet = this.getResteProjet();
    if (poidsNet > resteProjet) {
      this.error = `Le poids net (${poidsNet}) dépasse le reste disponible du projet (${resteProjet})`;
      return;
    }
    
    // 🔒 NETTOYER: S'assurer que seulement la destination choisie est présente
    // Calculer le poids selon le type et FORCER l'autre à null
    if (this.dialogDechargement._type === 'client') {
      this.dialogDechargement.poidsClient = this.dialogDechargement.poidComplet - this.dialogDechargement.poidCamionVide;
      // FORCER depot à null (effacer l'ancien depot si on passe à client)
      this.dialogDechargement.depotId = null;
      this.dialogDechargement.poidsDepot = null;
      console.log('✅ Sauvegarde CLIENT - depotId forcé à null');
    } else {
      this.dialogDechargement.poidsDepot = this.dialogDechargement.poidComplet - this.dialogDechargement.poidCamionVide;
      // FORCER client à null (effacer l'ancien client si on passe à depot)
      this.dialogDechargement.clientId = null;
      this.dialogDechargement.poidsClient = null;
      console.log('✅ Sauvegarde DEPOT - clientId forcé à null');
    }

    // Générer la date et heure de Tunisie automatiquement
    const dateDechargement = this.getTunisiaDateTime();

    const dechargementDTO = {
      chargementId: this.dialogDechargement.chargementId,
      numTicket: this.dialogDechargement.numTicket,
      numBonLivraison: this.dialogDechargement.numBonLivraison,
      poidCamionVide: this.dialogDechargement.poidCamionVide,
      poidComplet: this.dialogDechargement.poidComplet,
      clientId: this.dialogDechargement.clientId,
      depotId: this.dialogDechargement.depotId,
      dateDechargement: dateDechargement,
      // include autorisation code when selected (backend may accept it)
      autorisationCode: this.dialogDechargement.autorisationCode
    };

    // 🔀 ÉDITION vs CRÉATION
    if (this.editingDechargement && this.dialogDechargement.id) {
      // MODE ÉDITION: Appeler updateDechargement
      console.log('📝 Mise à jour du déchargement ID:', this.dialogDechargement.id);
      this.dechargementService.updateDechargement(this.dialogDechargement.id, dechargementDTO).subscribe({
        next: () => {
          console.log('✅ Déchargement mis à jour avec succès');
          this.handleDechargementSuccess();
        },
        error: (err) => {
          console.error('❌ Erreur mise à jour déchargement:', err);
          this.error = 'Erreur lors de la mise à jour du déchargement';
        }
      });
    } else {
      // MODE CRÉATION: Appeler createDechargement
      console.log('➕ Création d\'un nouveau déchargement');
      this.dechargementService.createDechargement(dechargementDTO).subscribe({
        next: () => {
          console.log('✅ Déchargement créé avec succès');
          this.handleDechargementSuccess();
        },
        error: (err) => {
          console.error('❌ Erreur création déchargement:', err);
          // Try to extract a useful backend message for display in the form
          let backendMessage = '';
          try {
            if (err && err.error) {
              if (typeof err.error === 'string') {
                backendMessage = err.error;
              } else if (err.error.message) {
                backendMessage = err.error.message;
              } else if (err.error.msg) {
                backendMessage = err.error.msg;
              } else {
                backendMessage = JSON.stringify(err.error);
              }
            } else if (err && err.message) {
              backendMessage = err.message;
            }
          } catch (e) {
            // ignore parsing errors
          }

          if (backendMessage) {
            // Improve the message shown to the user
            this.error = 'num ticket ou num BL déja utilisé' ;
          } else {
            this.error = 'num ticket ou num BL déja utilisé';
          }
        }
      });
    }
  }

  // Fonction helper pour gérer le succès de création/édition
  private handleDechargementSuccess() {
    // 🔥 Si societeP a été modifiée OU si le chargement n'a pas de societeP, mettre à jour le chargement
    const needsUpdate = this.dialogDechargement.societeP && 
        this.selectedChargementForDechargement && 
        (this.dialogDechargement.societeP !== this.selectedChargementForDechargement.societeP || 
         !this.selectedChargementForDechargement.societeP);
    
    if (needsUpdate) {
      console.log('📝 Mise à jour de la société du chargement:', this.dialogDechargement.societeP);
      
      // Mettre à jour le chargement avec la nouvelle societeP
      const chargementToUpdate: ChargementDTO = {
        id: this.selectedChargementForDechargement!.id,
        camionId: this.selectedChargementForDechargement!.camionId || 0,
        chauffeurId: this.selectedChargementForDechargement!.chauffeurId || 0,
        societe: this.selectedChargementForDechargement!.societe || '',
        projetId: this.selectedChargementForDechargement!.projetId || 0,
        dateChargement: this.selectedChargementForDechargement!.dateChargement || '',
        societeP: this.dialogDechargement.societeP
      };
      
      this.chargementService.updateChargement(chargementToUpdate.id!, chargementToUpdate).subscribe({
        next: () => {
          console.log('✅ Société du chargement mise à jour avec succès');
          // 🔥 Synchroniser avec le voyage
          this.syncVoyageWithSocieteP(this.dialogDechargement, this.dialogDechargement.societeP!);
        },
        error: (err) => {
          console.error('❌ Erreur mise à jour du chargement:', err);
          // Même si la mise à jour du chargement échoue, synchroniser quand même le voyage
          this.syncVoyageWithSocieteP(this.dialogDechargement, this.dialogDechargement.societeP!);
        }
      });
    } else {
      // Pas de modification de societeP
      this.closeDechargementSuccess();
    }
  }

  // Synchroniser le voyage avec la nouvelle societeP
  private syncVoyageWithSocieteP(dechargement: any, societeP: string) {
    console.log('🔄 Synchronisation du voyage avec societeP:', societeP);
    
    const numBonLivraison = dechargement.numBonLivraison;
    const numTicket = dechargement.numTicket;
    
    if (!numBonLivraison || !numTicket) {
      console.warn('⚠️ Impossible de synchroniser: numBonLivraison ou numTicket manquant');
      this.closeDechargementSuccess();
      return;
    }
    
    console.log(`🔍 Recherche voyage avec Bon: ${numBonLivraison}, Ticket: ${numTicket}`);
    
    // Trouver le voyage correspondant
    this.voyageService.getAllVoyages().subscribe({
      next: (voyages: any) => {
        let voyagesList: VoyageDTO[] = [];
        
        if (voyages instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              voyagesList = JSON.parse(reader.result as string);
              console.log(`📦 ${voyagesList.length} voyages chargés`);
              this.updateVoyageWithSocieteP(voyagesList, dechargement, numBonLivraison, numTicket, societeP);
            } catch (e) {
              console.error('❌ Erreur parsing voyages:', e);
              this.closeDechargementSuccess();
            }
          };
          reader.readAsText(voyages);
        } else {
          voyagesList = voyages;
          console.log(`📦 ${voyagesList.length} voyages chargés`);
          this.updateVoyageWithSocieteP(voyagesList, dechargement, numBonLivraison, numTicket, societeP);
        }
      },
      error: (err) => {
        console.error('❌ Erreur récupération voyages:', err);
        this.closeDechargementSuccess();
      }
    });
  }

  // Mettre à jour le voyage correspondant
  private updateVoyageWithSocieteP(voyages: VoyageDTO[], dechargement: any, numBonLivraison: string, numTicket: string, societeP: string) {
    const matchingVoyage = voyages.find(v => 
      v.numBonLivraison === numBonLivraison && 
      v.numTicket === numTicket
    );

    if (!matchingVoyage) {
      console.warn('⚠️ Aucun voyage trouvé avec Bon:', numBonLivraison, 'Ticket:', numTicket);
      this.closeDechargementSuccess();
      return;
    }

    console.log('✅ Voyage correspondant trouvé:', matchingVoyage);

    if (!matchingVoyage.id) {
      console.error('❌ Voyage sans ID, impossible de mettre à jour');
      this.closeDechargementSuccess();
      return;
    }

    // Calculer le poids net du déchargement
    const poidsNet = (dechargement.poidComplet || 0) - (dechargement.poidCamionVide || 0);

    // Préparer le payload pour la mise à jour
    const payload: any = {
      id: matchingVoyage.id,
      numBonLivraison: matchingVoyage.numBonLivraison?.trim(),
      numTicket: matchingVoyage.numTicket?.trim(),
      reste: matchingVoyage.reste != null ? Number(matchingVoyage.reste) : 0,
      date: dechargement.dateDechargement || matchingVoyage.date,
      societe: matchingVoyage.societe?.trim() || undefined,
      societeP: societeP.trim(), // 🔥 Mettre à jour avec la nouvelle societeP
      chauffeurId: dechargement.chauffeurId || matchingVoyage.chauffeurId,
      camionId: dechargement.camionId || matchingVoyage.camionId,
      projetId: dechargement.projetId || matchingVoyage.projetId,
      userId: matchingVoyage.userId || 1,
      poidsClient: undefined as number | undefined,
      poidsDepot: undefined as number | undefined,
      clientId: undefined as number | undefined,
      depotId: undefined as number | undefined
    };

    // Mutuelle exclusivité client/depot
    if (dechargement.clientId && dechargement.clientId > 0) {
      payload.clientId = dechargement.clientId;
      payload.depotId = undefined;
      payload.poidsClient = poidsNet;
      payload.poidsDepot = undefined;
    } else if (dechargement.depotId && dechargement.depotId > 0) {
      payload.depotId = dechargement.depotId;
      payload.clientId = undefined;
      payload.poidsDepot = poidsNet;
      payload.poidsClient = undefined;
    } else {
      payload.clientId = matchingVoyage.clientId;
      payload.depotId = matchingVoyage.depotId;
      payload.poidsClient = matchingVoyage.poidsClient;
      payload.poidsDepot = matchingVoyage.poidsDepot;
    }

    // Nettoyage
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    // Propager le code d'autorisation si présent sur le déchargement
    // ou réutiliser celui déjà présent sur le voyage (compatibilité)
    try {
      payload.autorisationCode = dechargement.autorisationCode || (matchingVoyage as any).autorisationCode || (matchingVoyage as any).autorisation?.code;
      if (!payload.autorisationCode) delete payload.autorisationCode;
    } catch (e) {
      // ne pas bloquer la synchronisation si erreur d'accès
      console.warn('Impossible de propager autorisationCode:', e);
    }

    console.log('📝 Payload voyage synchronisation:', payload);

    this.voyageService.updateVoyage(matchingVoyage.id, payload, 'body').subscribe({
      next: () => {
        console.log('✅ Voyage synchronisé avec succès!');
        this.closeDechargementSuccess();
      },
      error: (err) => {
        console.error('❌ Erreur synchronisation voyage:', err);
        this.closeDechargementSuccess();
      }
    });
  }

  // Fermer le dialog après succès
  private closeDechargementSuccess() {
    this.showDechargementDialog = false;
    this.editingDechargement = false;
    this.error = '';
    this.loadChargements(); // Recharger pour mettre à jour l'affichage
    this.loadDechargements(); // Recharger les déchargements
    // Informer les autres composants (client) de se rafraîchir
    try {
      this.notificationService.rafraichir();
    } catch (e) {
      console.warn("⚠️ Impossible d'émettre rafraichissement notification:", e);
    }
  }

  closeDechargementDialog() {
    this.showDechargementDialog = false;
    this.editingDechargement = false; // Réinitialiser le flag d'édition
    this.clientSearchInput = '';
    this.depotSearchInput = '';
    this.showClientDropdown = false;
    this.showDepotDropdown = false;
    this.error = '';
  }

  calculatePoids() {
    const poidVide = this.dialogDechargement.poidCamionVide || 0;
    const poidComplet = this.dialogDechargement.poidComplet || 0;
    return poidComplet - poidVide;
  }

  // Enforce integer values and update validation flags
  onWeightChange(field: 'poidCamionVide' | 'poidComplet', value: any) {
    // Coerce to number, strip decimals
    const num = Number(value);
    const intVal = Number.isFinite(num) ? Math.trunc(num) : 0;
    this.dialogDechargement[field] = intVal;
    this.validateWeights();
  }

  private validateWeights() {
    const vide = Number(this.dialogDechargement.poidCamionVide || 0);
    const brut = Number(this.dialogDechargement.poidComplet || 0);
    this.weightsAreIntegers = Number.isInteger(vide) && Number.isInteger(brut);
    this.isBrutGreaterThanTar = brut > vide;
  }

  // Recherche client
  onClientSearchInput() {
    if (this.clientSearchInput.trim().length >= 2) {
      this.filteredClientsSearch = this.clients.filter(c =>
        c.nom?.toLowerCase().includes(this.clientSearchInput.toLowerCase()) ||
        c.numero?.toLowerCase().includes(this.clientSearchInput.toLowerCase())
      );
      this.showClientDropdown = true;
    } else {
      this.filteredClientsSearch = [];
      this.showClientDropdown = false;
    }
  }

  selectClient(client: any) {
    this.dialogDechargement.clientId = client.id;
    this.clientSearchInput = `${client.nom} (${client.numero || 'N/A'})`;
    this.showClientDropdown = false;
    // Attach available autorisation codes (new data model) for the UI
    const autorisations = this.getClientAutorisations(client.id);
    this.dialogDechargement._availableAutorisation = autorisations;
    // Default select first code when available
    if (autorisations && autorisations.length > 0) {
      this.dialogDechargement.autorisationCode = autorisations[0].code || 'DEFAULT';
    } else {
      this.dialogDechargement.autorisationCode = undefined;
    }
  }

  // Recherche dépôt
  onDepotSearchInput() {
    if (this.depotSearchInput.trim().length >= 2) {
      this.filteredDepotsSearch = this.depots.filter(d =>
        d.nom?.toLowerCase().includes(this.depotSearchInput.toLowerCase())
      );
      this.showDepotDropdown = true;
    } else {
      this.filteredDepotsSearch = [];
      this.showDepotDropdown = false;
    }
  }

  selectDepot(depot: any) {
    this.dialogDechargement.depotId = depot.id;
    this.depotSearchInput = depot.nom;
    this.showDepotDropdown = false;
  }

  // Obtenir la quantité autorisée pour un client
  getQuantiteAutorisee(clientId: number | undefined): number {
    if (!clientId) return 0;
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return 0;
    
    const projetClient = this.projetsClients.find(
      pc => pc.projetId === projetId && pc.clientId === clientId
    );
    
    return projetClient?.quantiteAutorisee || 0;
  }

  // Retourne la liste des autorisations (codes + quantite) pour un client
  getClientAutorisations(clientId: number | undefined): Array<{code?: string; quantite?: number}> {
    if (!clientId) return [];
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return [];
    // prefer explicit autorisation array (new data model)
    if (Array.isArray(client.autorisation) && client.autorisation.length > 0) {
      return client.autorisation.map((a: any) => ({ code: a.code || 'DEFAULT', quantite: Number(a.quantite) || 0 }));
    }
    // fallback to legacy quantitesAutoriseesParProjet map (one DEFAULT code)
    const projetId = this.contextProjetId || this.projetActifId;
    let q: any = 0;
    if (projetId && client.quantitesAutoriseesParProjet && client.quantitesAutoriseesParProjet[projetId] != null) {
      q = client.quantitesAutoriseesParProjet[projetId];
    } else {
      q = client.quantiteAutorisee || 0;
    }
    return [{ code: 'DEFAULT', quantite: Number(q) || 0 }];
  }

  // Obtenir la quantité autorisée pour un client et un code spécifique
  getQuantiteAutoriseeForCode(clientId: number | undefined, code: string | undefined): number {
    if (!clientId) return 0;
    if (!code) return this.getQuantiteAutorisee(clientId);
    const autorisations = this.getClientAutorisations(clientId);
    const found = autorisations.find(a => (a.code || 'DEFAULT') === code);
    return found ? (found.quantite || 0) : this.getQuantiteAutorisee(clientId);
  }

  // Calculer le total déjà livré pour un client ET un code (si les déchargements portent la propriété autorisationCode)
  getTotalLivreClientForCode(clientId: number | undefined, code: string | undefined): number {
    if (!clientId) return 0;
    if (!code) return this.getTotalLivreClient(clientId);
    return this.dechargements
      .filter(d => d.clientId === clientId && (d.autorisationCode || d.autorisation?.code) === code)
      .reduce((sum, d) => {
        const poidsNet = (d.poidComplet || 0) - (d.poidCamionVide || 0);
        return sum + poidsNet;
      }, 0);
  }

  // Calculer le reste pour un client pour un code donné
  getResteClientForCode(clientId: number | undefined, code: string | undefined): number {
    const quantite = this.getQuantiteAutoriseeForCode(clientId, code);
    const livre = this.getTotalLivreClientForCode(clientId, code);
    return quantite - livre;
  }

  // Calculer le total déjà livré pour un client (via déchargements)
  getTotalLivreClient(clientId: number): number {
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) return 0;
    
    return this.dechargements
      .filter(d => d.clientId === clientId)
      .reduce((sum, d) => {
        // Calculer le poids net (poidComplet - poidCamionVide)
        const poidsNet = (d.poidComplet || 0) - (d.poidCamionVide || 0);
        return sum + poidsNet;
      }, 0);
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

  // Calculer le reste total du projet (quantité totale - somme des livraisons)
  getResteProjet(): number {
    const projet = this.contextProjet || this.projetActif;
    if (!projet) return 0;
    
    const quantiteTotale = projet.quantiteTotale || 0;
    
    // Calculer le total déjà livré à partir de tous les déchargements du projet
    const totalLivre = this.dechargements
      .filter((d: any) => d.projetId === projet.id)
      .reduce((sum: number, d: any) => {
        const poidsNet = (d.poidComplet || 0) - (d.poidCamionVide || 0);
        return sum + poidsNet;
      }, 0);
    
    return quantiteTotale - totalLivre;
  }

  // Obtenir la couleur selon le pourcentage restant
  getResteColor(reste: number, quantiteAutorisee: number): string {
    if (quantiteAutorisee === 0) return '#64748b';
    const pourcentage = (reste / quantiteAutorisee) * 100;
    if (pourcentage > 30) return '#10b981'; // Vert
    if (pourcentage > 10) return '#f59e0b'; // Orange
    return '#ef4444'; // Rouge
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.chauffeurs = JSON.parse(reader.result as string);
              console.log('✅ Chauffeurs chargés:', this.chauffeurs.length);
            } catch (e) {
              console.error('❌ Erreur parsing chauffeurs:', e);
              this.chauffeurs = [];
            }
          };
          reader.readAsText(data);
        } else {
          this.chauffeurs = Array.isArray(data) ? data : [];
          console.log('✅ Chauffeurs chargés:', this.chauffeurs.length);
        }
      },
      error: (err) => {
        console.error('❌ Erreur chargement chauffeurs:', err);
        this.chauffeurs = [];
      }
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
              console.log('✅ Camions chargés:', this.camions.length);
              // Extraire les sociétés uniques des camions
              this.extractUniqueSocietes();
            } catch (e) {
              console.error('❌ Erreur parsing camions:', e);
              this.camions = [];
            }
          };
          reader.readAsText(data);
        } else {
          this.camions = Array.isArray(data) ? data : [];
          console.log('✅ Camions chargés:', this.camions.length);
          // Extraire les sociétés uniques des camions
          this.extractUniqueSocietes();
        }
      },
      error: (err) => {
        console.error('❌ Erreur chargement camions:', err);
        this.camions = [];
      }
    });
  }

  // Extraire toutes les sociétés uniques des camions existants
  extractUniqueSocietes(): void {
    const societesSet = new Set<string>();
    this.camions.forEach(camion => {
      if (camion.societe && camion.societe.trim() && camion.societe !== 'N/A') {
        societesSet.add(camion.societe.trim());
      }
    });
    this.allSocietes = Array.from(societesSet).sort();
    console.log('✅ Sociétés uniques extraites:', this.allSocietes.length, this.allSocietes);
  }

  loadProjets() {
    this.projetService.getAllProjets().subscribe({
      next: (data) => this.projets = data,
      error: (err) => console.error('Erreur chargement projets:', err)
    });
  }

  get isProjetActif(): boolean {
    if (this.contextProjet) {
      return this.contextProjet.active === true;
    }
    return !!(this.projetActif && this.projetActif.active === true);
  }
  
  canAddData(): boolean {
    return this.isProjetActif;
  }

  openAddDialog() {
    if (!this.canAddData()) return;
    
    this.editMode = false;
    // Générer automatiquement la date et heure de Tunisie (UTC+1)
    const tunisiaDate = this.getTunisiaDateTime();
    
    this.dialogChargement = {
      camionId: 0,
      chauffeurId: 0,
      societe: '',
      societeP: undefined, // 🔥 Par défaut undefined (optionnel)
      projetId: this.contextProjetId || this.projetActifId || 0,
      dateChargement: tunisiaDate
    };
    this.camionSearchInput = '';
    this.chauffeurSearchInput = '';
    this.societeSearchInput = '';
    this.showAddDialog = true;
    this.error = '';
  }

  openEditDialog(chargement: ChargementDTO) {
    if (!this.canAddData()) return;
    
    this.editMode = true;
    this.selectedChargement = chargement;
    this.dialogChargement = { ...chargement };
    
    // Pré-remplir les champs de recherche
    const camion = this.camions.find(c => c.id === chargement.camionId);
    const chauffeur = this.chauffeurs.find(c => c.id === chargement.chauffeurId);
    
    this.camionSearchInput = camion ? `${camion.matricule} - ${camion.societe}` : '';
    if (chauffeur) {
      const ccin = chauffeur.numCin && chauffeur.numCin.trim() ? chauffeur.numCin.trim() : '';
      this.chauffeurSearchInput = ccin ? `${chauffeur.nom} (${ccin})` : chauffeur.nom || '';
    } else {
      this.chauffeurSearchInput = '';
    }
    this.societeSearchInput = chargement.societe || '';
    
    this.showAddDialog = true;
    this.error = '';
  }

  closeDialog() {
    this.showAddDialog = false;
    this.editMode = false;
    this.selectedChargement = null;
    this.error = '';
  }

  saveChargement() {
    if (!this.dialogChargement.camionId || !this.dialogChargement.chauffeurId || 
        !this.dialogChargement.societe || !this.dialogChargement.projetId) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      console.error('Validation échouée:', {
        camionId: this.dialogChargement.camionId,
        chauffeurId: this.dialogChargement.chauffeurId,
        societe: this.dialogChargement.societe,
        projetId: this.dialogChargement.projetId
      });
      return;
    }

    // Générer automatiquement la date et heure de Tunisie si pas en mode édition
    const chargementToSave = { ...this.dialogChargement };
    if (!this.editMode) {
      chargementToSave.dateChargement = this.getTunisiaDateTime();
    } else if (chargementToSave.dateChargement && chargementToSave.dateChargement.length === 16) {
      // En mode édition, si le format est yyyy-MM-ddTHH:mm, ajouter :00 pour les secondes
      chargementToSave.dateChargement = chargementToSave.dateChargement + ':00';
    }

    if (this.editMode && this.selectedChargement) {
      this.chargementService.updateChargement(this.selectedChargement.id!, chargementToSave).subscribe({
        next: () => {
          this.loadChargements();
          this.closeDialog();
        },
        error: (err) => {
          console.error('Erreur mise à jour:', err);
          this.error = 'Erreur lors de la mise à jour du chargement';
        }
      });
    } else {
      console.log('📤 Envoi du chargement:', chargementToSave);
      this.chargementService.createChargement(chargementToSave).subscribe({
        next: () => {
          console.log('✅ Chargement créé avec succès');
          this.loadChargements();
          this.closeDialog();
        },
        error: (err) => {
          console.error('❌ Erreur création:', err);
          console.error('Status:', err.status);
          console.error('Message:', err.message);
          console.error('Error body:', err.error);
          this.error = 'Erreur lors de la création du chargement: ' + (err.error?.message || err.message);
        }
      });
    }
  }

  openDeleteDialog(chargement: ChargementDTO) {
    if (!this.canAddData()) return;
    this.chargementToDelete = chargement;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog() {
    this.showDeleteDialog = false;
    this.chargementToDelete = null;
  }

  confirmDelete() {
    if (!this.chargementToDelete || !this.chargementToDelete.id) return;
    
    this.chargementService.deleteChargement(this.chargementToDelete.id).subscribe({
      next: () => {
        this.loadChargements();
        this.closeDeleteDialog();
      },
      error: (err) => {
        console.error('Erreur suppression:', err);
        this.error = 'Erreur lors de la suppression du chargement';
      }
    });
  }

  // Recherche Camion
  onCamionSearch() {
    if (!Array.isArray(this.camions)) {
      this.camions = [];
      this.filteredCamions = [];
      return;
    }
    
    if (this.camionSearchInput.length >= 2) {
      this.filteredCamions = this.camions.filter(c =>
        c.matricule?.toLowerCase().includes(this.camionSearchInput.toLowerCase()) ||
        c.societe?.toLowerCase().includes(this.camionSearchInput.toLowerCase())
      );
      this.showCamionDropdown = true;
    } else {
      this.showCamionDropdown = false;
    }
  }

  selectCamion(camion: CamionDTO): void {
    this.dialogChargement.camionId = camion.id!;
    this.camionSearchInput = camion.matricule;
    this.showCamionDropdown = false;
    this.filteredCamions = [];
  }

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
      societe: this.dialogChargement.societe || 'N/A'
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
        this.dialogChargement.camionId = createdCamion.id!;
        this.camionSearchInput = createdCamion.matricule;
        this.showCamionDropdown = false;
        this.filteredCamions = [];
        
        console.log('✅ Camion créé et sélectionné:', createdCamion);
      }
    } catch (err) {
      console.error('❌ Erreur création camion:', err);
      this.error = 'Erreur lors de la création du camion.';
    } finally {
      this.isCreatingCamion = false;
    }
  }

  // Recherche Chauffeur
  onChauffeurSearch() {
    if (!Array.isArray(this.chauffeurs)) {
      this.chauffeurs = [];
      this.filteredChauffeurs = [];
      return;
    }
    
    if (this.chauffeurSearchInput.length >= 2) {
      this.filteredChauffeurs = this.chauffeurs.filter(c =>
        c.nom?.toLowerCase().includes(this.chauffeurSearchInput.toLowerCase()) ||
        c.numCin?.toLowerCase().includes(this.chauffeurSearchInput.toLowerCase())
      );
      this.showChauffeurDropdown = true;
    } else {
      this.showChauffeurDropdown = false;
    }
  }

  selectChauffeur(chauffeur: ChauffeurDTO): void {
    this.dialogChargement.chauffeurId = chauffeur.id!;
    const cin = chauffeur.numCin && chauffeur.numCin.trim() ? chauffeur.numCin.trim() : '';
    this.chauffeurSearchInput = cin ? `${chauffeur.nom} (${cin})` : chauffeur.nom || '';
    this.showChauffeurDropdown = false;
    this.filteredChauffeurs = [];
  }

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
      this.chauffeurCinInput = '';
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
  this.dialogChargement.chauffeurId = createdChauffeur.id!;
  const createdCin = createdChauffeur.numCin && createdChauffeur.numCin.trim() ? createdChauffeur.numCin.trim() : '';
  this.chauffeurSearchInput = createdCin ? `${createdChauffeur.nom} (${createdCin})` : createdChauffeur.nom || '';
  this.showChauffeurDropdown = false;
  this.filteredChauffeurs = [];
  this.chauffeurCinInput = '';
        
        console.log('✅ Chauffeur créé et sélectionné:', createdChauffeur);
      }
    } catch (err) {
      console.error('❌ Erreur création chauffeur:', err);
      this.error = 'Erreur lors de la création du chauffeur.';
    } finally {
      this.isCreatingChauffeur = false;
    }
  }

  // Recherche Société
  onSocieteSearch() {
    if (this.societeSearchInput.length >= 1) {
      // Utiliser les sociétés déjà extraites des camions
      this.filteredSocietes = this.allSocietes.filter(s =>
        s.toLowerCase().includes(this.societeSearchInput.toLowerCase())
      ).slice(0, 20); // Limiter à 20 résultats
      this.showSocieteDropdown = true;
    } else {
      // Afficher toutes les sociétés si le champ est vide (limité à 20)
      this.filteredSocietes = this.allSocietes.slice(0, 20);
      this.showSocieteDropdown = true;
    }
  }

  selectSociete(societe: string) {
    this.dialogChargement.societe = societe;
    this.societeSearchInput = societe;
    this.showSocieteDropdown = false;
  }

  // Filtres
  setFilter(filter: 'all' | 'date' | 'societeP') {
    this.activeFilter = filter;
    
    if (filter === 'all') {
      this.dateDebut = null;
      this.dateFin = null;
      this.selectedSocieteP = null;
    }
    
    this.applyFilter();
  }

  applyFilter() {
    console.log('🔍 [applyFilter] Début - chargements:', this.chargements?.length, 'éléments');
    
    if (!this.chargements || !Array.isArray(this.chargements)) {
      console.warn('⚠️ [applyFilter] chargements n\'est pas un tableau, initialisation à []');
      this.chargements = [];
    }
    
    let filtered = [...this.chargements];
    console.log('🔍 [applyFilter] Filtered initial:', filtered.length, 'éléments');

    // Filtre de recherche — uniquement par Matricule Camion et Chauffeur
    if (this.chargementFilter) {
      const search = this.chargementFilter.toLowerCase();
      filtered = filtered.filter(c => {
        try {
          const camionStr = this.getCamionInfo(c.camionId || 0).toLowerCase();
          const chauffeurStr = this.getChauffeurInfo(c.chauffeurId || 0).toLowerCase();
          return camionStr.includes(search) || chauffeurStr.includes(search);
        } catch (e) {
          return false;
        }
      });
    }

    // Validation des dates futures
    if (this.dateDebut && this.today && this.dateDebut > this.today) {
      this.dateDebut = this.today;
    }
    if (this.dateFin && this.today && this.dateFin > this.today) {
      this.dateFin = this.today;
    }

    // Filtre par date avec journée de travail (7h00 → 6h00 lendemain)
    if (this.dateDebut || this.dateFin) {
      const startDate = this.dateDebut ? new Date(this.dateDebut + 'T00:00:00') : new Date('1900-01-01');
      const endDate = this.dateFin ? new Date(this.dateFin + 'T00:00:00') : new Date();
      
      filtered = filtered.filter(c => {
        if (!c.dateChargement) return false;
        const chargeDateTime = new Date(c.dateChargement);
        
        // Vérifier si le chargement tombe dans l'une des journées de travail de la plage
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const workDayStart = new Date(d);
          workDayStart.setHours(7, 0, 0, 0);
          const workDayEnd = new Date(d);
          workDayEnd.setDate(workDayEnd.getDate() + 1);
          workDayEnd.setHours(6, 0, 0, 0);
          
          if (chargeDateTime >= workDayStart && chargeDateTime < workDayEnd) {
            return true;
          }
        }
        return false;
      });
    }
    if (this.selectedSocieteP) {
      filtered = filtered.filter(c => c.societeP === this.selectedSocieteP);
    }

    this.filteredChargements = filtered;
    this.totalPages = Math.ceil(this.filteredChargements.length / this.pageSize);
    this.currentPage = 1;
    console.log('✅ [applyFilter] Fin - filteredChargements:', this.filteredChargements.length, 'totalPages:', this.totalPages);
    this.updatePagination();
  }

  // Helper: retourne aujourd'hui au format yyyy-MM-dd (heure locale)
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Effacer un filtre spécifique sans toucher aux autres
  clearFilter(filter: 'date' | 'societeP') {
    switch (filter) {
      case 'date':
        this.dateDebut = null;
        this.dateFin = null;
        break;
      case 'societeP':
        this.selectedSocieteP = null;
        break;
    }
    this.applyFilter();
  }

  getFilterCount(filter: 'date' | 'societeP'): number {
    switch(filter) {
      case 'date':
        return this.chargements.filter(c => !!c.dateChargement).length;
      case 'societeP':
        return this.chargements.filter(c => !!c.societeP).length;
      default:
        return 0;
    }
  }

  // Pagination
  updatePagination() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedChargements = this.filteredChargements.slice(start, end);
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.updatePagination();
  }

  changePageSize(size: number) {
    this.pageSize = size;
    this.totalPages = Math.ceil(this.filteredChargements.length / this.pageSize);
    this.currentPage = 1;
    this.updatePagination();
  }
  // Format datetime for display
  formatDateTime(dateStr: string | undefined): string {
    if (!dateStr) return '';
    
    // Parse the datetime string
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return dateStr;
    
    // Format: DD/MM/YYYY HH:mm
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  // Tri
  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.filteredChargements.sort((a: any, b: any) => {
      const aVal = a[column];
      const bVal = b[column];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (typeof aVal === 'string') {
        return this.sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    this.updatePagination();
  }

  // Export Excel
  exportToExcel() {
    const dataToExport = this.filteredChargements.map(c => ({
      'ID': c.id,
      'Date': c.dateChargement,
      'Société': c.societe,
      'Projet': c.nomProjet,
      'Produit': c.produit,
      'Navire': c.navire,
      'Port': c.port,
      'Camion ID': c.camionId,
      'Chauffeur ID': c.chauffeurId
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chargements');
    XLSX.writeFile(wb, `chargements_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  getCamionInfo(camionId: number): string {
    const camion = this.camions.find(c => c.id === camionId);
    return camion ? `${camion.matricule}` : 'N/A';
  }

  getChauffeurInfo(chauffeurId: number): string {
    const chauffeur = this.chauffeurs.find(c => c.id === chauffeurId);
    if (!chauffeur) return 'N/A';
    const nom = chauffeur.nom || '';
    const cin = (chauffeur.numCin && chauffeur.numCin.trim()) ? chauffeur.numCin.trim() : '';
    return cin ? `${nom} (${cin})` : nom;
  }

  // Imprimer une facture thermique (format papier rouleau)
  printThermalReceipt(chargement: ChargementDTO): void {
    // Récupérer les informations complètes
    const camion = this.camions.find(c => c.id === chargement.camionId);
    const chauffeur = this.chauffeurs.find(c => c.id === chargement.chauffeurId);
    
    // Créer une fenêtre en plein écran pour visualiser la facture
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Impossible d\'ouvrir la fenêtre d\'impression. Veuillez autoriser les popups.');
      return;
    }

    // Date et heure formatées
    const dateFormatted = new Date(chargement.dateChargement).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const now = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Contenu HTML avec style thermique (80mm de largeur)
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bon de Chargement #${chargement.id}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.3;
            margin: 0;
            padding: 20px;
            max-width: 80mm;
            margin: 0 auto;
            background: #f5f5f5;
          }
          
          .receipt-container {
            background: white;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          
          .print-button {
            display: block;
            width: 200px;
            margin: 20px auto;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          .print-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 8px rgba(0,0,0,0.15);
          }
          
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .receipt-title {
            font-size: 14px;
            font-weight: bold;
            margin: 10px 0;
            text-decoration: underline;
          }
          
          .section {
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px dashed #666;
          }
          
          .row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          
          .label {
            font-weight: bold;
          }
          
          .value {
            text-align: right;
          }
          
          .footer {
            text-align: center;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 10px;
          }
          
          .barcode {
            text-align: center;
            font-size: 20px;
            font-family: 'Libre Barcode 39', cursive;
            margin: 10px 0;
          }
          
          @media print {
            body {
              background: white;
              padding: 10px;
            }
            
            .receipt-container {
              box-shadow: none;
              padding: 10px;
            }
            
            .print-button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <button class="print-button" onclick="window.print()">
          <i class="bi bi-printer-fill"></i> Imprimer le bon
        </button>
        
        <div class="receipt-container">
        <div class="header">
          ${chargement.societeP ? `<div class="company-name">${chargement.societeP}</div>` : ''}
          <div>${chargement.produit || 'Produit'}</div>
          <div style="font-size: 10px; margin-top: 5px;">
            Port: ${chargement.port || ''} | Navire: ${chargement.navire || ''}
          </div>
        </div>
        
        <div class="receipt-title">ORDRE DE CHARGEMENT</div>
        
        <div class="section">
          <div class="row">
            <span class="label">Date :</span>
            <span class="value">${dateFormatted}</span>
          </div>
        </div>
        
        <div class="section">
          <div style="font-weight: bold; margin-bottom: 5px;">TRANSPORT</div>
          <div class="row">
            <span class="label">Chauffeur:</span>
            <span class="value">${chauffeur?.nom || 'N/A'}</span>
          </div>
          ${chauffeur?.numCin ? `
          <div class="row">
            <span class="label">CIN:</span>
            <span class="value">${chauffeur.numCin}</span>
          </div>
          ` : ''}
          <div class="row">
            <span class="label">Matricule camion:</span>
            <span class="value">${camion?.matricule || 'N/A'}</span>
          </div>
          <div class="row">
            <span class="label">Transporteur:</span>
            <span class="value">${chargement.societe || 'N/A'}</span>
          </div>
        </div>
        
        <div class="barcode">*${chargement.id}*</div>
        
       
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.autocomplete-container') && !target.closest('.client-search-container') && !target.closest('.depot-search-container')) {
      this.showCamionDropdown = false;
      this.showChauffeurDropdown = false;
      this.showSocieteDropdown = false;
      this.showClientDropdown = false;
      this.showDepotDropdown = false;
    }
  }
}
