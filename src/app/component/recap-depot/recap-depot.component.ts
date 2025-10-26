import { Component, HostListener, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { DepotControllerService } from '../../api/api/depotController.service';
import { DepotDTO } from '../../api/model/depotDTO';
import { CamionControllerService } from '../../api/api/camionController.service';
import { CamionDTO } from '../../api/model/camionDTO';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetDepotControllerService } from '../../api/api/projetDepotController.service';
import { ProjetDepotDTO } from '../../api/model/projetDepotDTO';
import { ProjetActifService } from '../../service/projet-actif.service';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { HttpClient } from '@angular/common/http';
import { BASE_PATH } from '../../api/variables';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-recap-depot',
  templateUrl: './recap-depot.component.html',
  styleUrls: ['./recap-depot.component.css']
})
export class RecapDepotComponent {
  voyages: VoyageDTO[] = [];
  filteredVoyages: VoyageDTO[] = [];
  paginatedVoyages: VoyageDTO[] = [];
  depots: DepotDTO[] = [];
  camions: CamionDTO[] = [];
  chauffeurs: ChauffeurDTO[] = [];
  projetsDepots: ProjetDepotDTO[] = [];
  
  selectedDepot: DepotDTO | null = null;
  depotSearchInput: string = '';
  filteredDepotsSearch: DepotDTO[] = [];
  showDepotDropdown: boolean = false;
  
  projetActifId: number | null = null;
  projetActif: any = null;
  contextProjetId: number | null = null;
  contextProjet: any = null;
  breadcrumbItems: BreadcrumbItem[] = [];
  
  isSidebarOpen: boolean = true;
  voyageFilter: string = '';
  
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
    private depotService: DepotControllerService,
    private camionService: CamionControllerService,
    private chauffeurService: ChauffeurControllerService,
    private projetService: ProjetControllerService,
    private projetDepotService: ProjetDepotControllerService,
    private projetActifService: ProjetActifService,
    private route: ActivatedRoute,
    private http: HttpClient,
    @Inject(BASE_PATH) private basePath: string
  ) {
    // 🔥 Écouter les changements du projet actif
    this.projetActifService.projetActif$.subscribe(projet => {
      console.log('📡 [RecapDepot] Notification reçue - Nouveau projet:', projet);
      
      if (projet && projet.id) {
        const previousId = this.projetActifId;
        this.projetActifId = projet.id;
        this.projetActif = projet;
        
        // 🔥 FIX : Recharger si le projet change OU si c'est la première fois
        if (!previousId || previousId !== projet.id) {
          console.log('🔄 [RecapDepot] Rechargement - previousId:', previousId, 'newId:', projet.id);
          setTimeout(() => {
            this.reloadData();
          }, 50);
        }
      }
    });
    
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

    // Charger le projet actif initial
    const storedProjet = this.projetActifService.getProjetActif();
    if (storedProjet && storedProjet.id) {
      this.projetActifId = storedProjet.id;
      this.projetActif = storedProjet;
      console.log('✅ [RecapDepot] Projet actif initialisé:', this.projetActif.nom);
    }

    // Load data
    this.loadDepots();
    this.loadCamions();
    this.loadChauffeurs();
    this.updateBreadcrumb();
  }

  // 🔥 Méthode pour recharger toutes les données
  reloadData() {
    console.log('🔄 [RecapDepot] reloadData() - Projet actif:', this.projetActif?.nom, 'ID:', this.projetActifId);
    
    const currentUrl = window.location.pathname;
    const isOnParametrePage = currentUrl.includes('/parametre');
    
    if (isOnParametrePage) {
      const contextId = window.sessionStorage.getItem('projetActifId');
      if (contextId) {
        const contextIdNumber = Number(contextId);
        console.log('📌 [RecapDepot] Page paramètre - Contexte:', contextIdNumber);
        this.contextProjetId = contextIdNumber;
        if (contextIdNumber !== this.projetActifId) {
          this.loadProjetDetails(this.contextProjetId);
        } else {
          this.contextProjet = this.projetActif;
        }
      }
    } else {
      console.log('🏠 [RecapDepot] Mode Vue Projet Actif - Projet:', this.projetActif?.nom);
      this.contextProjetId = null;
      this.contextProjet = null;
    }
    
    // Recharger toutes les données
    this.loadDepots();
    this.loadCamions();
    this.loadChauffeurs();
    if (this.selectedDepot) {
      this.loadVoyagesForDepot();
    }
    this.updateBreadcrumb();
  }

  loadProjetDetails(projetId: number) {
    this.projetService.getProjetById(projetId, 'body').subscribe({
      next: (data: any) => {
        console.log('Projet chargé:', data);
        this.updateBreadcrumb();
      },
      error: (err) => console.error('Erreur chargement projet:', err)
    });
  }

  updateBreadcrumb() {
    this.breadcrumbItems = [
      { label: 'Accueil', url: '/' },
      { label: 'Récapitulatif Dépôts', url: `/recap-depot${this.contextProjetId ? '/' + this.contextProjetId : ''}` }
    ];
  }

  loadDepots() {
    const projetId = this.contextProjetId || this.projetActifId;
    if (!projetId) {
      console.warn('⚠️ [RecapDepot] Pas de projet actif, impossible de charger les dépôts');
      this.depots = [];
      this.projetsDepots = [];
      return;
    }

    // 1. Charger les ProjetDepot pour ce projet
    this.projetDepotService.getProjetDepotsByProjetId(projetId, 'body').subscribe({
      next: async (projetDepotsData: any) => {
        let projetDepots: ProjetDepotDTO[] = [];
        if (projetDepotsData instanceof Blob) {
          const text = await projetDepotsData.text();
          try {
            projetDepots = JSON.parse(text);
          } catch (e) {
            projetDepots = [];
          }
        } else if (Array.isArray(projetDepotsData)) {
          projetDepots = projetDepotsData;
        }
        this.projetsDepots = projetDepots;
        const depotIds = [...new Set(projetDepots.map(pd => pd.depotId))];

        // 2. Charger tous les dépôts
        this.depotService.getAllDepots('body').subscribe({
          next: async (data: any) => {
            let allDepots: DepotDTO[] = [];
            if (data instanceof Blob) {
              const text = await data.text();
              try {
                allDepots = Array.isArray(JSON.parse(text)) ? JSON.parse(text) : [];
              } catch (e) {
                allDepots = [];
              }
            } else if (Array.isArray(data)) {
              allDepots = data;
            }
            // 3. Filtrer et enrichir avec les infos de ProjetDepot
            this.depots = allDepots
              .filter(depot => depotIds.includes(depot.id!))
              .map(depot => {
                const projetDepot = projetDepots.find(pd => pd.depotId === depot.id);
                return {
                  ...depot,
                  projetDepotId: projetDepot?.id,
                  quantiteAutorisee: projetDepot?.quantiteAutorisee || 0
                };
              })
              .sort((a, b) => (b.id || 0) - (a.id || 0));
            console.log('✅ Dépôts enrichis avec quantités:', this.depots);
            // Si un dépôt est déjà sélectionné, rafraîchir ses données
            if (this.selectedDepot) {
              const updatedDepot = this.depots.find(d => d.id === this.selectedDepot!.id);
              if (updatedDepot) {
                this.selectedDepot = updatedDepot;
                console.log(`🔄 Dépôt sélectionné mis à jour:`, this.selectedDepot);
              }
            }
          },
          error: (err) => {
            console.error('❌ Erreur chargement détails dépôts:', err);
            this.depots = [];
          }
        });
      },
      error: (err) => {
        console.error('❌ Erreur chargement projetDepots:', err);
        this.projetsDepots = [];
        this.depots = [];
      }
    });
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

  // Depot search
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const depotInput = target.closest('.depot-search-container');
    if (!depotInput && this.showDepotDropdown) {
      this.showDepotDropdown = false;
    }
  }

  onDepotSearchInput(): void {
    const searchValue = this.depotSearchInput.trim().toLowerCase();
    
    if (!searchValue || searchValue.length < 2) {
      this.showDepotDropdown = false;
      this.filteredDepotsSearch = [];
      return;
    }
    
    this.filteredDepotsSearch = this.depots.filter(depot => 
      depot.nom?.toLowerCase().includes(searchValue)
    ).slice(0, 10);
    
    this.showDepotDropdown = this.filteredDepotsSearch.length > 0;
  }

  selectDepot(depot: DepotDTO): void {
    this.selectedDepot = depot;
    this.depotSearchInput = depot.nom || '';
    this.showDepotDropdown = false;
    
    console.log('Dépôt sélectionné:', depot);
    
    this.loadVoyagesForDepot();
  }

  loadVoyagesForDepot(): void {
    if (!this.selectedDepot || !this.selectedDepot.id) {
      this.voyages = [];
      this.filteredVoyages = [];
      this.paginatedVoyages = [];
      return;
    }

    const projetId = this.contextProjetId || this.projetActifId;
    console.log('📊 [loadVoyagesForDepot] Dépôt:', this.selectedDepot.nom, 'ProjetId:', projetId);

    this.voyageService.getAllVoyages('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const allVoyages = JSON.parse(text);
            
            // 🔥 FIX: Filtrer par dépôt ET par projet actif
            this.voyages = allVoyages.filter((v: VoyageDTO) => {
              const matchDepot = v.depotId === this.selectedDepot!.id;
              const matchProjet = projetId ? v.projetId === projetId : true;
              return matchDepot && matchProjet;
            });
            
            console.log('✅ [loadVoyagesForDepot] Voyages filtrés:', this.voyages.length, 'pour dépôt:', this.selectedDepot?.nom, 'et projet:', projetId);
          } catch (e) {
            this.voyages = [];
          }
        } else {
          const allVoyages = Array.isArray(data) ? data : [];
          
          // 🔥 FIX: Filtrer par dépôt ET par projet actif
          this.voyages = allVoyages.filter((v: VoyageDTO) => {
            const matchDepot = v.depotId === this.selectedDepot!.id;
            const matchProjet = projetId ? v.projetId === projetId : true;
            return matchDepot && matchProjet;
          });
          
          console.log('✅ [loadVoyagesForDepot] Voyages filtrés:', this.voyages.length, 'pour dépôt:', this.selectedDepot?.nom, 'et projet:', projetId);
        }
        
        // Sort by date descending
        this.voyages.sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return b.date.localeCompare(a.date);
        });
        
        this.applyFilter();
      },
      error: (err) => {
        console.error('Erreur chargement voyages:', err);
        this.voyages = [];
        this.filteredVoyages = [];
        this.paginatedVoyages = [];
      }
    });
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

  // Helper methods
  getCamionMatricule(camionId: number | undefined): string {
    if (!camionId) return 'N/A';
    const camion = this.camions.find(c => c.id === camionId);
    return camion?.matricule || 'N/A';
  }

  getChauffeurNom(chauffeurId: number | undefined): string {
    if (!chauffeurId) return 'N/A';
    const chauffeur = this.chauffeurs.find(c => c.id === chauffeurId);
    return chauffeur?.nom || 'N/A';
  }

  getQuantiteAutorisee(depotId: number | undefined): number {
    if (!depotId) {
      console.log(`⚠️ getQuantiteAutorisee appelé sans depotId`);
      return 0;
    }
    
    // Essayer d'abord de récupérer depuis selectedDepot
    if (this.selectedDepot && this.selectedDepot.id === depotId) {
      const depot = this.selectedDepot as any;
      if (depot.quantiteAutorisee !== undefined && depot.quantiteAutorisee !== null) {
        console.log(`✅ Quantité autorisée pour dépôt ${depotId} (${depot.nom}) depuis selectedDepot:`, depot.quantiteAutorisee);
        return depot.quantiteAutorisee;
      }
    }
    
    // Ensuite depuis la liste des dépôts
    const depot = this.depots.find(d => d.id === depotId) as any;
    if (depot) {
      if (depot.quantiteAutorisee !== undefined && depot.quantiteAutorisee !== null) {
        console.log(`✅ Quantité autorisée pour dépôt ${depotId} (${depot.nom}) depuis depots list:`, depot.quantiteAutorisee);
        return depot.quantiteAutorisee;
      }
    }
    
    console.warn(`⚠️ Aucune quantité autorisée trouvée pour dépôt ${depotId}`);
    return 0;
  }

  getTotalLivre(): number {
    return this.filteredVoyages.reduce((sum, v) => sum + (v.poidsDepot || 0), 0);
  }

  getReste(): number {
    const quantiteAutorisee = this.getQuantiteAutorisee(this.selectedDepot?.id);
    const totalLivre = this.getTotalLivre();
    return quantiteAutorisee - totalLivre;
  }

  getResteCumule(voyage: any, index: number): number {
    const quantiteAutorisee = this.getQuantiteAutorisee(this.selectedDepot?.id);
    let totalLivreJusquIci = 0;
    for (let i = 0; i <= index; i++) {
      totalLivreJusquIci += (this.paginatedVoyages[i].poidsDepot || 0);
    }
    return quantiteAutorisee - totalLivreJusquIci;
  }

  getResteColor(): string {
    const reste = this.getReste();
    if (reste === 0) return '#10b981';
    if (reste > 0) return '#f59e0b';
    return '#ef4444';
  }

  getResteGradient(): string {
    const reste = this.getReste();
    if (reste === 0) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    if (reste > 0) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  }

  // Exporter vers PDF
  exportToPDF(): void {
    if (!this.selectedDepot) {
      alert('Veuillez sélectionner un dépôt');
      return;
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Titre principal
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RÉCAPITULATIF PAR DÉPÔT', pageWidth / 2, 15, { align: 'center' });
    
    // Informations du dépôt
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dépôt: ${this.selectedDepot.nom}`, 14, 25);
    
    // Statistiques
    doc.setFont('helvetica', 'bold');
    doc.text('Statistiques:', 14, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(`Quantité autorisée: ${this.getQuantiteAutorisee(this.selectedDepot.id).toFixed(2)} kg`, 14, 41);
    doc.text(`Total voyages: ${this.filteredVoyages.length}`, 14, 47);
    doc.text(`Total livré: ${this.getTotalLivre().toFixed(2)} kg`, 80, 47);
    doc.text(`Reste: ${this.getReste().toFixed(2)} kg`, 160, 47);
    
    // Filtres actifs
    if (this.voyageFilter || this.dateDebut || this.dateFin) {
      doc.setFont('helvetica', 'bold');
      doc.text('Filtres appliqués:', 14, 55);
      doc.setFont('helvetica', 'normal');
      let filterY = 61;
      
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
    
    // Tableau des voyages
    const tableData = this.filteredVoyages.map(v => [
      v.date ? v.date.substring(0, 10) : '',
      v.numBonLivraison || '',
      v.numTicket || '',
      this.getCamionMatricule(v.camionId),
      this.getChauffeurNom(v.chauffeurId),
      (v.poidsDepot || 0).toFixed(2),
      (v.reste || 0).toFixed(2)
    ]);
    
    autoTable(doc, {
      startY: this.voyageFilter || this.dateDebut || this.dateFin ? 67 : 49,
      head: [['Date', 'Bon Livraison', 'Ticket', 'Matricule', 'Chauffeur', 'Poids (kg)', 'Reste (kg)']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [251, 191, 36],
        textColor: [30, 41, 59],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 30 },
        1: { halign: 'left', cellWidth: 35 },
        2: { halign: 'left', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 35 },
        4: { halign: 'left', cellWidth: 50 },
        5: { halign: 'right', cellWidth: 30 },
        6: { halign: 'right', cellWidth: 30 }
      },
      alternateRowStyles: {
        fillColor: [254, 252, 232]
      },
      margin: { left: 14, right: 14 }
    });
    
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
    if (!this.selectedDepot) {
      alert('Veuillez sélectionner un dépôt');
      return;
    }

    const wb = XLSX.utils.book_new();
    
    // Feuille de statistiques
    const statsData: any[][] = [
      ['RÉCAPITULATIF PAR DÉPÔT'],
      [],
      ['Dépôt', this.selectedDepot.nom],
      [],
      ['STATISTIQUES'],
      ['Quantité autorisée', this.getQuantiteAutorisee(this.selectedDepot.id).toFixed(2) + ' kg'],
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
    statsData.push(['Date', 'Bon Livraison', 'Ticket', 'Matricule', 'Chauffeur', 'Poids (kg)', 'Reste (kg)']);
    
    this.filteredVoyages.forEach(v => {
      statsData.push([
        v.date ? v.date.substring(0, 10) : '',
        v.numBonLivraison || '',
        v.numTicket || '',
        this.getCamionMatricule(v.camionId),
        this.getChauffeurNom(v.chauffeurId),
        (v.poidsDepot || 0).toFixed(2),
        (v.reste || 0).toFixed(2)
      ]);
    });
    
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
    const depotName = this.selectedDepot?.nom?.replace(/[^a-zA-Z0-9]/g, '_') || 'Depot';
    const date = new Date().toISOString().split('T')[0];
    let filterSuffix = '';
    
    if (this.dateDebut && this.dateFin) {
      filterSuffix = `_${this.dateDebut}_au_${this.dateFin}`;
    } else if (this.dateDebut) {
      filterSuffix = `_depuis_${this.dateDebut}`;
    } else if (this.dateFin) {
      filterSuffix = `_jusqua_${this.dateFin}`;
    }
    
    return `Recap_Depot_${depotName}${filterSuffix}_${date}.${extension}`;
  }
}
