import { Component, OnInit } from '@angular/core';
import { SocieteControllerService } from '../../api/api/societeController.service';
import { SocieteDTO } from '../../api/model/societeDTO';
import { BreadcrumbItem } from '../breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-societe',
  templateUrl: './societe.component.html',
  styleUrls: ['./societe.component.css']
})
export class SocieteComponent implements OnInit {
  // Layout
  isSidebarOpen: boolean = true;
  
  // Breadcrumb
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Accueil', url: '/' },
    { label: 'Sociétés', url: '/societe' }
  ];
  
  societes: SocieteDTO[] = [];
  filteredSocietes: SocieteDTO[] = [];
  searchTerm: string = '';
  
  showDialog: boolean = false;
  dialogTitle: string = '';
  isEditMode: boolean = false;
  
  dialogSociete: SocieteDTO = {
    nom: '',
    adresse: '',
    rcs: '',
    contact: '',
    tva: '',
    logo: '',
    description: ''
  };

  // Gestion des contacts multiples
  dialogContacts: string[] = [''];

  // Drag and drop properties
  isDragging: boolean = false;
  logoPreview: string | null = null;

  constructor(
    private societeService: SocieteControllerService
  ) {}

  ngOnInit(): void {
    this.loadSocietes();
  }

  loadSocietes(): void {
    this.societeService.getAllSocietes().subscribe({
      next: (data) => {
        this.societes = data;
        this.filteredSocietes = data;
      },
      error: (err) => console.error('Erreur lors du chargement des sociétés:', err)
    });
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredSocietes = this.societes;
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredSocietes = this.societes.filter(s =>
      s.nom?.toLowerCase().includes(term) ||
      s.adresse?.toLowerCase().includes(term) ||
      s.rcs?.toLowerCase().includes(term)
    );
  }

  openCreateDialog(): void {
    this.isEditMode = false;
    this.dialogTitle = 'Créer une société';
    this.dialogSociete = {
      nom: '',
      adresse: '',
      rcs: '',
      contact: '',
      tva: '',
      logo: '',
      description: ''
    };
    this.dialogContacts = [''];
    this.logoPreview = null;
    this.showDialog = true;
  }

  openEditDialog(societe: SocieteDTO): void {
    this.isEditMode = true;
    this.dialogTitle = 'Modifier la société';
    this.dialogSociete = { ...societe };
    this.logoPreview = societe.logo || null;
    
    // Parse contacts
    this.dialogContacts = this.parseContacts(societe.contact || '');
    if (this.dialogContacts.length === 0) {
      this.dialogContacts = [''];
    }
    
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.isDragging = false;
  }

  saveSociete(): void {
    if (!this.dialogSociete.nom?.trim()) {
      alert('Le nom de la société est obligatoire');
      return;
    }

    // Convertir les contacts en JSON
    this.dialogSociete.contact = this.stringifyContacts(this.dialogContacts);

    // Debug: vérifier les données avant l'envoi
    console.log('💾 Sauvegarde société:', {
      id: this.dialogSociete.id,
      nom: this.dialogSociete.nom,
      hasLogo: !!this.dialogSociete.logo,
      logoLength: this.dialogSociete.logo?.length || 0,
      description: this.dialogSociete.description,
      contact: this.dialogSociete.contact
    });

    if (this.isEditMode && this.dialogSociete.id) {
      this.societeService.updateSociete(this.dialogSociete.id, this.dialogSociete).subscribe({
        next: () => {
          console.log('✅ Société mise à jour avec succès');
          this.loadSocietes();
          this.closeDialog();
        },
        error: (err) => {
          console.error('❌ Erreur lors de la mise à jour:', err);
          alert('Erreur lors de la mise à jour: ' + (err.error?.message || err.message));
        }
      });
    } else {
      this.societeService.createSociete(this.dialogSociete).subscribe({
        next: () => {
          console.log('✅ Société créée avec succès');
          this.loadSocietes();
          this.closeDialog();
        },
        error: (err) => {
          console.error('❌ Erreur lors de la création:', err);
          alert('Erreur lors de la création: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  deleteSociete(id: number | undefined): void {
    if (!id) return;
    
    if (confirm('Êtes-vous sûr de vouloir supprimer cette société ?')) {
      this.societeService.deleteSociete(id).subscribe({
        next: () => this.loadSocietes(),
        error: (err) => console.error('Erreur lors de la suppression:', err)
      });
    }
  }

  // Drag and Drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La taille de l\'image ne doit pas dépasser 5MB');
      return;
    }

    // Convertir en base64
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const base64 = e.target?.result as string;
      this.dialogSociete.logo = base64;
      this.logoPreview = base64;
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.dialogSociete.logo = '';
    this.logoPreview = null;
  }

  // Gestion des contacts
  addContact(): void {
    this.dialogContacts.push('');
  }

  removeContact(index: number): void {
    if (this.dialogContacts.length > 1) {
      this.dialogContacts.splice(index, 1);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  parseContacts(contact: string): string[] {
    if (!contact) return [];
    try {
      const parsed = JSON.parse(contact);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // fallback: split by comma
      if (contact.includes(',')) return contact.split(',').map(s => s.trim()).filter(Boolean);
      return [contact];
    }
  }

  stringifyContacts(arr: string[]): string {
    return JSON.stringify((arr || []).map(s => s.trim()).filter(Boolean));
  }

  // Format contacts pour affichage dans le tableau
  formatContacts(contact: string | undefined): string {
    if (!contact) return '-';
    const contacts = this.parseContacts(contact);
    return contacts.join(', ') || '-';
  }
}
