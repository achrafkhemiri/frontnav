import { Component, OnInit } from '@angular/core';
import { DeclarationControllerService } from '../../api/api/declarationController.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DeclarationDTO } from '../../api/model/declarationDTO';
import { ProjetDTO } from '../../api/model/projetDTO';
import { ProjetActifService } from '../../service/projet-actif.service';

@Component({
  selector: 'app-declaration',
  templateUrl: './declaration.component.html',
  styleUrls: ['./declaration.component.css']
})
export class DeclarationComponent implements OnInit {
  declarations: DeclarationDTO[] = [];
  projets: ProjetDTO[] = [];
  selectedProjetId: number | null = null;
  Array = Array; // Pour utiliser Array.from dans le template
  
  // Modal state
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  
  // Form data
  newDeclaration: DeclarationDTO = {
    numeroDeclaration: '',
    quantiteManifestee: 0,
    projetId: 0
  };
  
  editingDeclaration: DeclarationDTO = {
    numeroDeclaration: '',
    quantiteManifestee: 0,
    projetId: 0
  };
  
  declarationToDelete: DeclarationDTO | null = null;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  constructor(
    private declarationService: DeclarationControllerService,
    private projetService: ProjetControllerService,
    private projetActifService: ProjetActifService
  ) {}

  ngOnInit(): void {
    this.loadProjets();
    
    // Subscribe to active project changes
    this.projetActifService.projetActif$.subscribe((projet: ProjetDTO | null) => {
      if (projet && projet.id) {
        this.selectedProjetId = projet.id;
        this.loadDeclarationsByProjet(projet.id);
      } else {
        this.selectedProjetId = null;
        this.declarations = [];
      }
    });
  }

  loadProjets(): void {
    this.projetService.getAllProjets().subscribe({
      next: (data: ProjetDTO[]) => {
        this.projets = data;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des projets:', error);
      }
    });
  }

  loadDeclarationsByProjet(projetId: number): void {
    this.declarationService.getDeclarationsByProjet(projetId).subscribe({
      next: (data: DeclarationDTO[]) => {
        this.declarations = data;
        this.totalItems = data.length;
        console.log(`✅ ${data.length} déclaration(s) chargée(s) pour le projet ${projetId}`);
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des déclarations:', error);
        this.declarations = [];
      }
    });
  }

  onProjetChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const projetId = parseInt(selectElement.value);
    
    if (projetId) {
      this.selectedProjetId = projetId;
      this.loadDeclarationsByProjet(projetId);
    } else {
      this.selectedProjetId = null;
      this.declarations = [];
    }
  }

  // Modal methods
  openAddModal(): void {
    if (!this.selectedProjetId) {
      alert('Veuillez sélectionner un projet');
      return;
    }
    
    this.newDeclaration = {
      numeroDeclaration: '',
      quantiteManifestee: 0,
      projetId: this.selectedProjetId
    };
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.newDeclaration = {
      numeroDeclaration: '',
      quantiteManifestee: 0,
      projetId: 0
    };
  }

  openEditModal(declaration: DeclarationDTO): void {
    this.editingDeclaration = { ...declaration };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingDeclaration = {
      numeroDeclaration: '',
      quantiteManifestee: 0,
      projetId: 0
    };
  }

  openDeleteModal(declaration: DeclarationDTO): void {
    this.declarationToDelete = declaration;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.declarationToDelete = null;
  }

  // CRUD operations
  createDeclaration(): void {
    if (!this.newDeclaration.numeroDeclaration || this.newDeclaration.quantiteManifestee === undefined) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.declarationService.createDeclaration(this.newDeclaration).subscribe({
      next: (data: DeclarationDTO) => {
        console.log('✅ Déclaration créée:', data);
        if (this.selectedProjetId) {
          this.loadDeclarationsByProjet(this.selectedProjetId);
        }
        this.closeAddModal();
      },
      error: (error: any) => {
        console.error('❌ Erreur lors de la création de la déclaration:', error);
        alert('Erreur lors de la création de la déclaration');
      }
    });
  }

  updateDeclaration(): void {
    if (!this.editingDeclaration.id) {
      return;
    }

    this.declarationService.updateDeclaration(this.editingDeclaration.id, this.editingDeclaration).subscribe({
      next: (data: DeclarationDTO) => {
        console.log('✅ Déclaration mise à jour:', data);
        if (this.selectedProjetId) {
          this.loadDeclarationsByProjet(this.selectedProjetId);
        }
        this.closeEditModal();
      },
      error: (error: any) => {
        console.error('❌ Erreur lors de la mise à jour de la déclaration:', error);
        alert('Erreur lors de la mise à jour de la déclaration');
      }
    });
  }

  deleteDeclaration(): void {
    if (!this.declarationToDelete || !this.declarationToDelete.id) {
      return;
    }

    this.declarationService.deleteDeclaration(this.declarationToDelete.id).subscribe({
      next: () => {
        console.log('✅ Déclaration supprimée');
        if (this.selectedProjetId) {
          this.loadDeclarationsByProjet(this.selectedProjetId);
        }
        this.closeDeleteModal();
      },
      error: (error: any) => {
        console.error('❌ Erreur lors de la suppression de la déclaration:', error);
        alert('Erreur lors de la suppression de la déclaration');
      }
    });
  }

  // Pagination methods
  get paginatedDeclarations(): DeclarationDTO[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.declarations.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  getProjetNom(): string {
    const projet = this.projets.find((p: ProjetDTO) => p.id === this.selectedProjetId);
    return projet?.societeNoms ? Array.from(projet.societeNoms).join(', ') : 'Aucune société';
  }
}
