import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProjetActifService {
  private readonly STORAGE_KEY = 'projetActif';
  private readonly VIEW_MODE_KEY = 'viewMode';
  private projetActif: any = null;
  private isAllVoyagesView: boolean = false;

  private projetActifSubject = new BehaviorSubject<any>(null);
  projetActif$ = this.projetActifSubject.asObservable();
  private viewModeSubject = new BehaviorSubject<boolean>(false);
  viewMode$ = this.viewModeSubject.asObservable();

  constructor() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.projetActif = JSON.parse(stored);
      this.projetActifSubject.next(this.projetActif);
    }
    const storedMode = localStorage.getItem(this.VIEW_MODE_KEY);
    if (storedMode) {
      this.isAllVoyagesView = JSON.parse(storedMode);
      this.viewModeSubject.next(this.isAllVoyagesView);
    }
  }

  setProjetActif(projet: any) {
    // console.log('🔥 ProjetActifService.setProjetActif() appelé avec:', projet);
    this.projetActif = projet;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projet));
    // console.log('💾 Projet sauvegardé dans localStorage');
    this.projetActifSubject.next(projet);
    // console.log('📡 Notification émise aux abonnés');
    // Assurer l'UI en mode "vue projet" quand un projet actif est défini
    this.setViewMode(false);
  }

  getProjetActif() {
    if (this.projetActif) return this.projetActif;
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.projetActif = JSON.parse(stored);
      // Ne pas émettre ici pour éviter les boucles infinies
      // L'émission sera faite uniquement via setProjetActif()
      return this.projetActif;
    }
    return null;
  }

  clearProjetActif() {
    this.projetActif = null;
    localStorage.removeItem(this.STORAGE_KEY);
    this.projetActifSubject.next(null);
    // Quand on n'a plus de projet actif, repasser en vue globale
    this.setViewMode(true);
  }

  setViewMode(isAllVoyages: boolean) {
    this.isAllVoyagesView = isAllVoyages;
    localStorage.setItem(this.VIEW_MODE_KEY, JSON.stringify(isAllVoyages));
    this.viewModeSubject.next(isAllVoyages);
  }

  getViewMode(): boolean {
    const stored = localStorage.getItem(this.VIEW_MODE_KEY);
    if (stored) {
      this.isAllVoyagesView = JSON.parse(stored);
    }
    return this.isAllVoyagesView;
  }
}
