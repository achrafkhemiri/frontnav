import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { ProjetActifService } from '../service/projet-actif.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  isOpen = true;
  isAllVoyagesView: boolean = false;
  projetActif: any = null;

  @Output() toggle = new EventEmitter<boolean>();

  constructor(private projetActifService: ProjetActifService) {}

  ngOnInit() {
    this.projetActifService.projetActif$.subscribe(p => this.projetActif = p);
    this.projetActifService.viewMode$.subscribe(mode => this.isAllVoyagesView = mode);
    this.updateView();
  }

  updateView() {
    this.isAllVoyagesView = this.projetActifService.getViewMode();
    this.projetActif = this.projetActifService.getProjetActif();
  }

  toggleSidebar() {
    this.isOpen = !this.isOpen;
    this.toggle.emit(this.isOpen); // notifier le layout
  }
}
