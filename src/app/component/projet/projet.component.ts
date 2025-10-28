// ...existing code...
import { Component } from '@angular/core';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DeclarationControllerService } from '../../api/api/declarationController.service';
import { SocieteControllerService } from '../../api/api/societeController.service';
import { ProjetDTO } from '../../api/model/projetDTO';
import { DeclarationDTO } from '../../api/model/declarationDTO';
import { SocieteDTO } from '../../api/model/societeDTO';
import { ProjetActifService } from '../../service/projet-actif.service';
import { firstValueFrom } from 'rxjs';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { ChargementControllerService } from '../../api/api/chargementController.service';

// Interface pour gérer l'état de flip des cartes
interface ProjetDTOWithFlip extends ProjetDTO {
  isFlipped?: boolean;
}

@Component({
  selector: 'app-projet',
  templateUrl: './projet.component.html',
  styleUrls: ['./projet.component.css']
})
export class ProjetComponent {
  openSettingsModal(pr: ProjetDTO) {
    setTimeout(() => {
      const modal = document.getElementById('settingsProjetModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }
  isSidebarOpen: boolean = true;
  openEditProjetModal(pr: ProjetDTO) {
    this.selectedProjet = { ...pr };
    // Synchroniser les sociétés du projet sélectionné (même logique que selectProjet)
    const societes = (pr as any).societes as SocieteDTO[] | undefined;
    const noms = (pr as any).societeNoms as Set<string> | string[] | undefined;
    if (Array.isArray(societes) && societes.length) {
      this.selectedSocietes = societes.map(s => ({...s}));
      // Préparer les contacts arrays côté UI
      this.selectedSocietes.forEach(s => this.ensureContactsArray(s));
    } else if (noms) {
      const arr = Array.isArray(noms) ? noms : Array.from(noms as any);
      this.selectedSocietes = arr.map(n => ({ nom: n } as SocieteDTO));
    } else {
      this.selectedSocietes = [];
    }
    this.editMode = true;
    setTimeout(() => {
      const modal = document.getElementById('editProjetModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }
  projets: ProjetDTOWithFlip[] = [];
  filteredProjets: ProjetDTOWithFlip[] = [];
  paginatedProjets: ProjetDTOWithFlip[] = [];
  selectedProjet: ProjetDTO | null = null;
  newProjet: ProjetDTO = { 
    nomProduit: '', 
    quantiteTotale: 0, 
    nomNavire: '', 
    paysNavire: '', 
    etat: '', 
    port: '', 
    dateDebut: new Date().toISOString().split('T')[0], // Date automatique
    dateFin: '', 
    active: false 
  };
  editMode: boolean = false;
  error: string = '';
  projetActif: ProjetDTO | null = null;
  projetFilter: string = '';
  
  // Gestion des déclarations par projet (pour l'affichage au dos des cartes)
  declarationsByProjet: Map<number, DeclarationDTO[]> = new Map();
  allDeclarations: DeclarationDTO[] = [];
  
  // Déclarations dynamiques pour le formulaire d'ajout/modification
  declarations: Array<{numeroDeclaration: string, quantiteManifestee: number}> = [{numeroDeclaration: '', quantiteManifestee: 0}];
  
  // Gestion des sociétés (sélection, création, édition)
  selectedSocietes: SocieteDTO[] = [];
  societeSearchInput: string = '';
  allSocietes: SocieteDTO[] = [];
  filteredSocietes: SocieteDTO[] = [];
  showSocieteDropdown: boolean = false;
  // Formulaire rapide pour créer une nouvelle société
  showNewSocieteForm: boolean = false;
  newSociete: SocieteDTO = { nom: '', adresse: '', rcs: '', contact: '', tva: '' };
  newSocieteContacts: string[] = [];
  
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
    private projetService: ProjetControllerService,
    private declarationService: DeclarationControllerService,
    private societeService: SocieteControllerService,
    private projetActifService: ProjetActifService,
    private voyageService: VoyageControllerService,
    private chargementService: ChargementControllerService
  ) {
    this.loadProjets();
    this.loadSocietes();
  }

  // Validation helpers
  private isEndAfterStart(start?: string, end?: string): boolean {
    if (!start || !end) return true; // no end date or start means no block
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return e.getTime() > s.getTime();
  }

  // Used by templates to avoid using `new Date()` directly in HTML
  isAddDateInvalid(): boolean {
    const d = this.newProjet;
    return !!(d.dateDebut && d.dateFin) && !this.isEndAfterStart(d.dateDebut, d.dateFin);
  }

  isEditDateInvalid(): boolean {
    const p = this.selectedProjet;
    if (!p) return false;
    return !!(p.dateDebut && p.dateFin) && !this.isEndAfterStart(p.dateDebut, p.dateFin);
  }

  // Validation du formulaire d'ajout
  isAddFormValid(): boolean {
    return !!(
      this.newProjet.nomProduit && this.newProjet.nomProduit.trim() !== '' &&
      this.newProjet.quantiteTotale && this.newProjet.quantiteTotale > 0 &&
      this.newProjet.nomNavire && this.newProjet.nomNavire.trim() !== '' &&
      this.newProjet.port && this.newProjet.port.trim() !== '' &&
      !this.isAddDateInvalid()
    );
  }

  // Validation du formulaire d'édition
  isEditFormValid(): boolean {
    if (!this.selectedProjet) return false;
    return !!(
      this.selectedProjet.nomProduit && this.selectedProjet.nomProduit.trim() !== '' &&
      this.selectedProjet.quantiteTotale && this.selectedProjet.quantiteTotale > 0 &&
      this.selectedProjet.nomNavire && this.selectedProjet.nomNavire.trim() !== '' &&
      this.selectedProjet.port && this.selectedProjet.port.trim() !== '' &&
      !this.isEditDateInvalid()
    );
  }

  // Charger toutes les sociétés
  loadSocietes(): void {
    this.societeService.getAllSocietes('body').subscribe({
      next: (data) => {
        this.allSocietes = (data || []) as any;
      },
      error: (err) => {
        console.error('Erreur chargement sociétés:', err);
      }
    });
  }

  // Méthodes pour gérer les déclarations dynamiques
  ajouterDeclaration(): void {
    this.declarations.push({numeroDeclaration: '', quantiteManifestee: 0});
  }

  supprimerDeclaration(index: number): void {
    if (this.declarations.length > 1) {
      this.declarations.splice(index, 1);
    }
  }

  resetDeclarations(): void {
    this.declarations = [{numeroDeclaration: '', quantiteManifestee: 0}];
  }

  openAddProjetModal() {
    // Obtenir la date actuelle au format YYYY-MM-DD
    const today = new Date();
    const dateDebut = today.toISOString().split('T')[0];
    
    // Réinitialiser le formulaire avec la date de début automatique
    this.newProjet = { 
      nomProduit: '', 
      quantiteTotale: 0, 
      nomNavire: '', 
      paysNavire: '', 
      etat: '', 
      port: '', 
      dateDebut: dateDebut,  // Date automatique
      dateFin: '', 
      active: false 
    };
  this.resetDeclarations();
  this.selectedSocietes = [];
  this.societeSearchInput = '';
  this.showNewSocieteForm = false;
  this.newSociete = { nom: '', adresse: '', rcs: '', contact: '', tva: '' };
  this.newSocieteContacts = [];
    
    setTimeout(() => {
      const modal = document.getElementById('addProjetModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }

  loadProjets() {
    this.projetService.getAllProjets('body').subscribe({
      next: async (data) => {
        let projets: ProjetDTO[] = [];
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              projets = json;
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
          }
        } else if (Array.isArray(data)) {
          projets = data;
        }
        this.projets = projets;
        // Sélectionne automatiquement le projet actif
        this.projetActif = this.projets.find(pr => pr.active) || null;
        
        // Si aucun projet n'est actif, notifier le service pour nettoyer la navbar
        if (!this.projetActif) {
          this.projetActifService.clearProjetActif();
        }
        
        // Charger toutes les déclarations pour l'affichage au dos des cartes
        this.loadAllDeclarations();
        
        this.applyFilter(); // applyFilter appelle sortProjetsByDateAndActive
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }
  
  applyFilter() {
    const filter = this.projetFilter.trim().toLowerCase();
    if (!filter) {
      this.filteredProjets = [...this.projets];
    } else {
      this.filteredProjets = this.projets.filter(pr =>
        pr.nomProduit?.toLowerCase().includes(filter) ||
        pr.nomNavire?.toLowerCase().includes(filter)
      );
    }
    this.sortProjetsByDateAndActive();
    this.updatePagination();
  }
  
  sortProjetsByDateAndActive() {
    // Trier les projets par ID décroissant (le plus récent en premier)
    this.filteredProjets.sort((a, b) => {
      // Le projet actif est toujours en première position
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      
      // Sinon, trier par ID décroissant (le plus récent en premier)
      const idA = a.id || 0;
      const idB = b.id || 0;
      return idB - idA;
    });
  }
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortProjets();
  }
  
  sortProjets() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredProjets.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof ProjetDTO];
      let bVal: any = b[this.sortColumn as keyof ProjetDTO];
      
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
    this.totalPages = Math.ceil(this.filteredProjets.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedProjets = this.filteredProjets.slice(startIndex, endIndex);
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

  addProjet() {
    // Validation des champs obligatoires
    if (!this.newProjet.nomProduit || this.newProjet.nomProduit.trim() === '') {
      this.error = 'Le nom du produit est obligatoire.';
      return;
    }
    
    if (!this.newProjet.quantiteTotale || this.newProjet.quantiteTotale <= 0) {
      this.error = 'La quantité doit être supérieure à 0.';
      return;
    }
    
    if (!this.newProjet.nomNavire || this.newProjet.nomNavire.trim() === '') {
      this.error = 'Le nom du navire est obligatoire.';
      return;
    }
    
    if (!this.newProjet.port || this.newProjet.port.trim() === '') {
      this.error = 'Le port est obligatoire.';
      return;
    }
    
    // Validate dates: dateFin > dateDebut when provided
    if (!this.isEndAfterStart(this.newProjet.dateDebut, this.newProjet.dateFin)) {
      this.error = 'La date de fin doit être strictement supérieure à la date de début.';
      return;
    }
    const projetEstActive = this.newProjet.active;
    
    // Préparer payload avec sociétés complètes
    const payload: ProjetDTO = { ...this.newProjet } as any;
    if (this.selectedSocietes.length > 0) {
      (payload as any).societes = this.selectedSocietes.map(s => ({
        id: s.id,
        nom: s.nom,
        adresse: s.adresse,
        rcs: s.rcs,
        contact: this.stringifyContacts(this.getContactsArray(s)),
        tva: s.tva,
      }));
      delete (payload as any).societeNoms;
    } else if (!(payload as any).societeNoms) {
      (payload as any).societeNoms = [] as any;
    }

    this.projetService.createProjet(payload, 'body').subscribe({
      next: async (created) => {
        let projetAjoute: ProjetDTO | undefined = created;
        if (created instanceof Blob) {
          const text = await created.text();
          try {
            projetAjoute = JSON.parse(text);
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            projetAjoute = undefined;
          }
        }
        
        if (projetAjoute && projetAjoute.id) {
          // Si le projet ajouté est actif, désactiver les autres d'abord
          if (projetEstActive) {
            const updatePromises = this.projets
              .filter(pr => pr.active && pr.id)
              .map(pr => {
                pr.active = false;
                return new Promise<void>((resolve, reject) => {
                  this.projetService.updateProjet(pr.id!, pr, 'body').subscribe({
                    next: () => resolve(),
                    error: (err) => reject(err)
                  });
                });
              });
            
            // Attendre que toutes les désactivations soient terminées
            Promise.all(updatePromises)
              .then(() => {
                // Maintenant ajouter le nouveau projet
                this.projets.push(projetAjoute!);
                this.projetActifService.setProjetActif(projetAjoute!);
                // console.log('✅ Nouveau projet actif défini:', projetAjoute);
              })
              .catch((err) => {
                console.error('❌ Erreur lors de la désactivation des projets:', err);
                // Ajouter quand même le projet
                this.projets.push(projetAjoute!);
                this.projetActifService.setProjetActif(projetAjoute!);
              });
          } else {
            // Projet non actif, ajouter directement
            this.projets.push(projetAjoute);
          }
          
          // Créer les déclarations associées au projet
          const declarationsValides = this.declarations.filter(d => d.numeroDeclaration && d.numeroDeclaration.trim() !== '');
          if (declarationsValides.length > 0) {
            const projetId = projetAjoute.id;
            const projetNom = projetAjoute.nomProduit;
            declarationsValides.forEach(decl => {
              const declarationDTO: DeclarationDTO = {
                numeroDeclaration: decl.numeroDeclaration,
                quantiteManifestee: decl.quantiteManifestee,
                projetId: projetId
              };
              this.declarationService.createDeclaration(declarationDTO).subscribe({
                next: () => console.log(`✅ Déclaration ${decl.numeroDeclaration} créée pour le projet ${projetNom}`),
                error: (err) => console.error('❌ Erreur création déclaration:', err)
              });
            });
          }
        }
        
        this.newProjet = { nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '', port: '', dateDebut: '', dateFin: '', active: false };
        this.resetDeclarations();
        this.selectedSocietes = [];
        this.loadProjets(); // Recharge la liste pour garantir la cohérence
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  selectProjet(pr: ProjetDTO) {
    this.selectedProjet = { ...pr };
    // Synchroniser les sociétés du projet sélectionné
    const societes = (pr as any).societes as SocieteDTO[] | undefined;
    const noms = (pr as any).societeNoms as Set<string> | string[] | undefined;
    if (Array.isArray(societes) && societes.length) {
      this.selectedSocietes = societes.map(s => ({...s}));
      // Préparer les contacts arrays côté UI
      this.selectedSocietes.forEach(s => this.ensureContactsArray(s));
    } else if (noms) {
      const arr = Array.isArray(noms) ? noms : Array.from(noms as any);
      this.selectedSocietes = arr.map(n => ({ nom: n } as SocieteDTO));
    } else {
      this.selectedSocietes = [];
    }
    this.editMode = true;
  }

  updateProjet() {
    if (!this.selectedProjet || !this.selectedProjet.id) return;
    
    // Validation des champs obligatoires
    if (!this.selectedProjet.nomProduit || this.selectedProjet.nomProduit.trim() === '') {
      this.error = 'Le nom du produit est obligatoire.';
      return;
    }
    
    if (!this.selectedProjet.quantiteTotale || this.selectedProjet.quantiteTotale <= 0) {
      this.error = 'La quantité doit être supérieure à 0.';
      return;
    }
    
    if (!this.selectedProjet.nomNavire || this.selectedProjet.nomNavire.trim() === '') {
      this.error = 'Le nom du navire est obligatoire.';
      return;
    }
    
    if (!this.selectedProjet.port || this.selectedProjet.port.trim() === '') {
      this.error = 'Le port est obligatoire.';
      return;
    }
    
    // Validate dates for edit
    if (!this.isEndAfterStart(this.selectedProjet.dateDebut, this.selectedProjet.dateFin)) {
      this.error = 'La date de fin doit être strictement supérieure à la date de début.';
      return;
    }
    
    // 🔥 IMPORTANT : Sauvegarder le projet sélectionné dans une variable locale
    // car this.selectedProjet sera mis à null avant que le callback async ne termine
    const projetEnCoursDeMiseAJour = { ...this.selectedProjet };
    const projetEstActive = this.selectedProjet.active;
    // console.log('🔧 updateProjet() - Projet:', projetEnCoursDeMiseAJour.nomProduit, 'ID:', projetEnCoursDeMiseAJour.id, 'Active:', projetEstActive);
    
    // Si le projet modifié est actif, désactive les autres
    if (projetEstActive) {
      // console.log('🔄 Désactivation des autres projets...');
      this.projets.forEach(pr => {
        if (pr.active && pr.id !== projetEnCoursDeMiseAJour.id) {
          pr.active = false;
          // console.log('  ❌ Désactivation du projet:', pr.nomProduit, 'ID:', pr.id);
          if (pr.id) {
            this.projetService.updateProjet(pr.id, pr, 'body').subscribe();
          }
        }
      });
    }
    
    // Injecter sociétés complètes si présentes
    const payload: ProjetDTO = { ...projetEnCoursDeMiseAJour } as any;
    if (this.selectedSocietes.length > 0) {
      (payload as any).societes = this.selectedSocietes.map(s => ({
        id: s.id,
        nom: s.nom,
        adresse: s.adresse,
        rcs: s.rcs,
        contact: this.stringifyContacts(this.getContactsArray(s)),
        tva: s.tva,
      }));
      delete (payload as any).societeNoms;
    }

    this.projetService.updateProjet(projetEnCoursDeMiseAJour.id!, payload, 'body').subscribe({
      next: async (updated) => {
        // console.log('✅ Projet mis à jour:', updated);
        // console.log('🔍 projetEstActive:', projetEstActive, 'projetEnCoursDeMiseAJour:', projetEnCoursDeMiseAJour);
        
        // Si le projet est activé, mettre à jour le service ProjetActifService
        if (projetEstActive && projetEnCoursDeMiseAJour) {
          // console.log('🔄 Traitement du projet actif...');
          let projetUpdated: any = updated;
          
          // Gérer le cas où updated est un Blob
          if (updated instanceof Blob) {
            // console.log('📦 Blob détecté, parsing...');
            const text = await updated.text();
            // console.log('📄 Texte brut du Blob:', text);
            try {
              projetUpdated = JSON.parse(text);
              // console.log('✅ Projet parsé:', projetUpdated);
            } catch (e) {
              console.error('❌ Erreur parsing projet:', e);
              projetUpdated = projetEnCoursDeMiseAJour;
            }
          } else {
            // console.log('✅ Pas de Blob, projet déjà en objet');
          }
          
          // console.log('🔥 Appel setProjetActif avec:', projetUpdated);
          
          // 🔥 IMPORTANT : Nettoyer le sessionStorage pour éviter les conflits
          window.sessionStorage.removeItem('projetActifId');
          
          // Mettre à jour le service avec le projet complet
          this.projetActifService.setProjetActif(projetUpdated);
          // console.log('✅ Projet actif mis à jour:', projetUpdated);
          
          // 🔥 Forcer une seconde émission après un court délai pour s'assurer que tous les composants reçoivent la notification
          setTimeout(() => {
            this.projetActifService.setProjetActif(projetUpdated);
            // console.log('🔄 Émission forcée du projet actif');
          }, 100);
        } else {
          console.warn('⚠️ Projet non activé ou selectedProjet null - pas de mise à jour du service');
        }
        
        this.loadProjets();
        this.selectedProjet = null;
        this.editMode = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }


  closeAddProjetModal() {
    const modal = document.getElementById('addProjetModal');
    if (modal) {
      const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
      if (modalInstance) {
        modalInstance.hide();
      }
    }
  }

  closeEditProjetModal() {
    const modal = document.getElementById('editProjetModal');
    if (modal) {
      const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
      if (modalInstance) {
        modalInstance.hide();
      }
    }
    this.selectedProjet = null;
    this.editMode = false;
  }

  deleteProjet(id?: number) {
    if (id === undefined) return;
    const projet = this.projets.find(p => p.id === id);
    const nom = projet?.nomProduit || `Projet ${id}`;
    
    // Vérifier s'il y a des voyages/chargements/déchargements liés
    Promise.all([
      firstValueFrom(this.voyageService.getVoyagesByProjet(id!, 'body')).catch(() => []),
      firstValueFrom(this.chargementService.getChargementsByProjet(id!)).catch(() => [])
    ]).then(async ([voyages, chargements]: any[]) => {
      // Gérer le cas où les réponses sont des Blobs
      let voyagesList: any[] = [];
      let chargementsList: any[] = [];
      
      if (voyages instanceof Blob) {
        const text = await voyages.text();
        try {
          voyagesList = JSON.parse(text);
        } catch (e) {
          voyagesList = [];
        }
      } else if (Array.isArray(voyages)) {
        voyagesList = voyages;
      }
      
      if (chargements instanceof Blob) {
        const text = await chargements.text();
        try {
          chargementsList = JSON.parse(text);
        } catch (e) {
          chargementsList = [];
        }
      } else if (Array.isArray(chargements)) {
        chargementsList = chargements;
      }
      
      const nbVoyages = voyagesList.length || 0;
      const nbChargements = chargementsList.length || 0;
      const hasLinks = nbVoyages > 0 || nbChargements > 0;
      
      if (hasLinks) {
        // Construire un message d'erreur détaillé et lisible
        let details: string[] = [];
        if (nbVoyages > 0) {
          details.push(`${nbVoyages} voyage${nbVoyages > 1 ? 's' : ''}`);
        }
        if (nbChargements > 0) {
          details.push(`${nbChargements} chargement${nbChargements > 1 ? 's' : ''}`);
        }
        
        this.error = `Impossible de supprimer le projet « ${nom} »\n\n` +
                    `Ce projet contient encore :\n` +
                    details.map(d => `• ${d}`).join('\n') + '\n\n' +
                    `Veuillez d'abord supprimer ces éléments avant de pouvoir supprimer le projet.`;
        
        // Fermer le modal de confirmation
        const modalEl = document.getElementById('deleteConfirmModal');
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl);
        modalInstance?.hide();
        
        // Faire défiler vers le haut pour voir le message d'erreur
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
        
        return;
      }
      
      // Aucun lien trouvé, procéder à la suppression
      this.projetService.deleteProjet(id!, 'body').subscribe({
        next: () => {
          this.projets = this.projets.filter(p => p.id !== id);
          // Rafraîchir la liste affichée (filtres + pagination)
          this.applyFilter();
          this.error = '';
          // Fermer le modal de confirmation s'il est ouvert
          const modalEl = document.getElementById('deleteConfirmModal');
          const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl);
          modalInstance?.hide();
          this.selectedProjet = null;
          
          // Afficher un message de succès
          // console.log(`✅ Projet « ${nom} » supprimé avec succès`);
        },
        error: async (err) => {
          // Améliorer l'affichage des erreurs HTTP
          let errorMessage = '';
          
          // Si l'erreur contient un status 403
          if (err.status === 403) {
            errorMessage = `Impossible de supprimer le projet « ${nom} »\n\n` +
                          `Le projet contient des éléments liés (voyages, chargements ou déchargements).\n\n` +
                          `Veuillez supprimer ces éléments en premier.`;
          } 
          // Si l'erreur contient un message
          else if (err.error) {
            if (err.error instanceof Blob) {
              try {
                const text = await err.error.text();
                errorMessage = `Erreur : ${text}`;
              } catch (e) {
                errorMessage = `Une erreur est survenue lors de la suppression du projet.`;
              }
            } else if (typeof err.error === 'string') {
              errorMessage = err.error;
            } else if (err.error.message) {
              errorMessage = err.error.message;
            } else {
              errorMessage = `Erreur ${err.status || ''} : Impossible de supprimer le projet`;
            }
          } 
          // Message générique
          else {
            errorMessage = `Une erreur est survenue lors de la suppression du projet « ${nom} »`;
          }
          
          this.error = errorMessage;
          
          // Fermer le modal
          const modalEl = document.getElementById('deleteConfirmModal');
          const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl);
          modalInstance?.hide();
          
          // Faire défiler vers le haut pour voir le message d'erreur
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 300);
        }
      });
    }).catch((err) => {
      this.error = `Erreur lors de la vérification des dépendances du projet.\n\n` +
                  `Veuillez réessayer ou contacter l'administrateur.`;
      
      // Fermer le modal
      const modalEl = document.getElementById('deleteConfirmModal');
      const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl);
      modalInstance?.hide();
      
      // Faire défiler vers le haut pour voir le message d'erreur
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    });
  }

  cancelEdit() {
    this.selectedProjet = null;
    this.editMode = false;
  }

  // Méthode pour basculer l'état de flip d'une carte
  toggleCardFlip(projet: ProjetDTOWithFlip): void {
    projet.isFlipped = !projet.isFlipped;
  }

  // Charge toutes les déclarations et les groupe par projetId
  loadAllDeclarations(): void {
    // console.log('🔄 Chargement des déclarations...');
    this.declarationService.getAllDeclarations().subscribe({
      next: async (data) => {
        // console.log('✅ Déclarations reçues (raw):', data);
        // console.log('✅ Type de data:', typeof data, 'isArray:', Array.isArray(data));
        
        // Gérer le cas où data est un Blob
        let declarations: DeclarationDTO[] = [];
        if (data instanceof Blob) {
          const text = await data.text();
          // console.log('📄 Blob text:', text);
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              declarations = json;
            }
          } catch (e) {
            console.error('❌ Erreur parsing JSON:', e);
            return;
          }
        } else if (Array.isArray(data)) {
          declarations = data;
        } else {
          console.error('❌ Type de données inattendu:', data);
          return;
        }
        
        // console.log('✅ Déclarations parsées:', declarations);
        this.allDeclarations = declarations;
        
        if (declarations.length === 0) {
          console.warn('⚠️ Aucune déclaration trouvée en base de données.');
          console.info('💡 Pour ajouter des déclarations de test, exécutez le script SQL : navire/insert_test_declarations.sql');
          console.info('💡 Ou créez un nouveau projet avec des déclarations via le formulaire.');
        }
        
        // Grouper les déclarations par projetId
        this.declarationsByProjet.clear();
        declarations.forEach((decl, index) => {
          // console.log(`  📄 Déclaration ${index + 1}:`, {
          //   id: decl.id,
          //   numero: decl.numeroDeclaration,
          //   quantite: decl.quantiteManifestee,
          //   projetId: decl.projetId,
          //   projetIdType: typeof decl.projetId
          // });
          if (decl.projetId !== undefined && decl.projetId !== null) {
            // Convertir en number pour être sûr
            const pid = Number(decl.projetId);
            if (!this.declarationsByProjet.has(pid)) {
              this.declarationsByProjet.set(pid, []);
            }
            this.declarationsByProjet.get(pid)?.push(decl);
          }
        });
        // console.log('📊 Déclarations par projet:', this.declarationsByProjet);
        // console.log('📊 Map keys:', Array.from(this.declarationsByProjet.keys()));
      },
      error: (err) => {
        console.error('❌ Erreur chargement déclarations:', err);
      }
    });
  }

  // Récupère les déclarations pour un projet spécifique
  getDeclarationsForProjet(projetId?: number): DeclarationDTO[] {
    if (projetId === undefined) return [];
    const declarations = this.declarationsByProjet.get(projetId) || [];
    // console.log(`📄 Déclarations pour projet ${projetId}:`, declarations);
    return declarations;
  }

  // Méthodes pour la gestion des sociétés
  onSocieteSearchInput(): void {
    const search = this.societeSearchInput.trim().toLowerCase();
    if (search) {
      this.filteredSocietes = this.allSocietes.filter(s => s.nom?.toLowerCase().includes(search));
      this.showSocieteDropdown = true;
    } else {
      this.filteredSocietes = [];
      this.showSocieteDropdown = false;
    }
  }

  selectSociete(societe: SocieteDTO): void {
    if (!this.selectedSocietes.find(s => s.nom === societe.nom)) {
      const copy = { ...societe };
      this.ensureContactsArray(copy);
      this.selectedSocietes.push(copy);
    }
    this.societeSearchInput = '';
    this.filteredSocietes = [];
    this.showSocieteDropdown = false;
  }

  removeSociete(nom: string): void {
    this.selectedSocietes = this.selectedSocietes.filter(s => s.nom !== nom);
  }

  addSocieteFromSearch(): void {
    const nom = this.societeSearchInput.trim();
    if (!nom) return;
    if (!this.selectedSocietes.find(s => s.nom === nom)) {
      this.newSociete = { nom, adresse: '', rcs: '', contact: '', tva: '' };
      this.newSocieteContacts = [];
      this.showNewSocieteForm = true;
    }
    this.societeSearchInput = '';
    this.filteredSocietes = [];
    this.showSocieteDropdown = false;
  }

  // Gestion contacts: convertir string JSON <-> tableau
  private ensureContactsArray(s: SocieteDTO & { _contacts?: string[] }): void {
    if ((s as any)._contacts) return;
    (s as any)._contacts = this.parseContacts(s.contact);
  }

  getContactsArray(s: SocieteDTO & { _contacts?: string[] }): string[] {
    if (!(s as any)._contacts) this.ensureContactsArray(s);
    return (s as any)._contacts as string[];
  }

  addContactToSociete(s: SocieteDTO & { _contacts?: string[] }, phone: string = ''): void {
    const arr = this.getContactsArray(s);
    arr.push(phone);
  }

  removeContactFromSociete(s: SocieteDTO & { _contacts?: string[] }, idx: number): void {
    const arr = this.getContactsArray(s);
    if (idx >= 0 && idx < arr.length) arr.splice(idx, 1);
  }

  parseContacts(contact?: string): string[] {
    if (!contact) return [];
    try {
      const val = JSON.parse(contact);
      return Array.isArray(val) ? val.map(String) : (typeof val === 'string' ? [val] : []);
    } catch {
      // fallback: split by comma
      if (contact.includes(',')) return contact.split(',').map(s => s.trim()).filter(Boolean);
      return [contact];
    }
  }

  stringifyContacts(arr: string[]): string {
    return JSON.stringify((arr || []).map(s => s.trim()).filter(Boolean));
  }

  // Création rapide: confirmer/cancel
  confirmAddNewSociete(): void {
    const nom = (this.newSociete.nom || '').trim();
    if (!nom) return;
    const copy: any = { ...this.newSociete } as any;
    copy._contacts = [...this.newSocieteContacts];
    copy.contact = this.stringifyContacts(copy._contacts);
    this.selectedSocietes.push(copy);
    this.newSociete = { nom: '', adresse: '', rcs: '', contact: '', tva: '' };
    this.newSocieteContacts = [];
    this.showNewSocieteForm = false;
  }

  cancelAddNewSociete(): void {
    this.showNewSocieteForm = false;
  }

  // TrackBy pour éviter la perte de focus dans les inputs
  trackByIndex(index: number, item: any): number {
    return index;
  }

  // Helper pour UI: récupérer les noms des sociétés d'un projet
  getSocieteNames(pr: ProjetDTO): string[] {
    const societes = (pr as any).societes as SocieteDTO[] | undefined;
    if (Array.isArray(societes) && societes.length) return societes.map(s => s.nom);
    const noms = (pr as any).societeNoms as Set<string> | string[] | undefined;
    return noms ? (Array.isArray(noms) ? noms : Array.from(noms as any)) : [];
  }
  // Méthode pour ouvrir le modal de confirmation de suppression
  openDeleteConfirmModal(projet: ProjetDTO): void {
    this.selectedProjet = projet;
    setTimeout(() => {
      const modal = document.getElementById('deleteConfirmModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }
}
