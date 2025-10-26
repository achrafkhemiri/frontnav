import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';

@Component({
  selector: 'app-projet-parametre',
  templateUrl: './projet-parametre.component.html',
  styleUrls: ['./projet-parametre.component.css']
})
export class ProjetParametreComponent implements OnInit {
  isSidebarOpen: boolean = true;
  projetId: number | null = null;
  projet: any = null;
  cards = [
    {icon:'bi-person-badge', color:'text-primary', title:'Client', link:'/client', text:'Voir les clients', dynamic:false},
    {icon:'bi-building', color:'text-success', title:'Dépôt', link:'/depot', text:'Voir les dépôts', dynamic:false},
    {icon:'bi-truck', color:'text-warning', title:'Camion', link:'/camion', text:'Voir les camions', dynamic:false},
    {icon:'bi-person-lines-fill', color:'text-info', title:'Chauffeur', link:'/chauffeur', text:'Voir les chauffeurs', dynamic:false},
    {icon:'bi-diagram-3', color:'text-secondary', title:'Voyages', link:'/voyage', text:'Voir les voyages', dynamic:true}
  ];

  constructor(
    private route: ActivatedRoute,
    private projetActifService: ProjetActifService,
    private projetControllerService: ProjetControllerService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      this.projetId = idParam ? Number(idParam) : null;
      if (this.projetId !== null) {
        // NE PAS modifier le projet actif ici
        // La navbar gérera l'affichage du projet consulté via currentProjet
        window.sessionStorage.setItem('projetActifId', String(this.projetId));
        // Charger les détails du projet pour affichage
        this.loadProjet(this.projetId);
      } else {
        // Nettoyage si on arrive sans id
        window.sessionStorage.removeItem('projetActifId');
      }
    });
  }

  // Liste des sociétés du projet (à afficher dans le header)
  get societesList(): string[] {
    const set = this.projet?.societeNoms as Set<string> | string[] | undefined;
    if (!set) return [];
    const arr = Array.isArray(set) ? set : Array.from(set);
    return arr.filter((s: string) => !!s && s.trim() !== '');
  }

  private loadProjet(id: number) {
    this.projetControllerService.getProjetById(id, 'body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            this.projet = JSON.parse(text);
          } catch (e) {
            console.error('Erreur parsing projet:', e);
          }
        } else {
          this.projet = data;
        }
        console.log('Projet chargé:', this.projet);
      },
      error: (err) => {
        console.error('Erreur chargement projet:', err);
      }
    });
  }
}
