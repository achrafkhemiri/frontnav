
import { Component, OnInit } from '@angular/core';
import { ProjetClientControllerService } from '../../api/api/projetClientController.service';
import { ProjetClientDTO } from '../../api/model/projetClientDTO';
import { AutorisationDTO } from '../../api/model/autorisationDTO';

@Component({
  selector: 'app-projet-client',
  templateUrl: './projet-client.component.html',
  styleUrls: ['./projet-client.component.css']
})
export class ProjetClientComponent implements OnInit {
  projetClients: ProjetClientDTO[] = [];
  selectedProjetClient: ProjetClientDTO | null = null;
  newProjetClient: ProjetClientDTO = { autorisation: [] };
  editProjetClient: ProjetClientDTO | null = null;
  quantiteUpdate: number | null = null;

  // helpers for adding autorisation rows in forms
  newAutorisationCode: string = '';
  newAutorisationQuantite: number | null = null;

  constructor(public projetClientService: ProjetClientControllerService) {}

  ngOnInit() {
    this.loadProjetClients();
  }

  loadProjetClients() {
    // TODO: Replace with actual service call when available
    // Example: this.projetClientService.getAllProjetClients().subscribe(...)
    // For now, set to empty array
    this.projetClients = [];
  }

  addProjetClient() {
    // If autorisation is empty but quantiteAutorisee provided, keep quantiteAutorisee for compatibility
    const payload: ProjetClientDTO = { ...this.newProjetClient };
    // In real use, call API
    // this.projetClientService.createProjetClient(payload).subscribe(...)
    const newClient = { ...payload, id: Date.now() };
    this.projetClients.push(newClient);
    this.newProjetClient = { autorisation: [] };
    this.newAutorisationCode = '';
    this.newAutorisationQuantite = null;
  }

  editProjetClientStart(projetClient: ProjetClientDTO) {
    // clone and ensure autorisation array exists for editing
    this.editProjetClient = { ...projetClient, autorisation: projetClient.autorisation ? [...projetClient.autorisation] : [] };
  }

  updateProjetClient() {
    // TODO: Replace with actual service call when available
    // Example: this.projetClientService.updateProjetClient(this.editProjetClient).subscribe(...)
    if (this.editProjetClient) {
      const idx = this.projetClients.findIndex(pc => pc.id === this.editProjetClient!.id);
      if (idx > -1) {
        this.projetClients[idx] = { ...this.editProjetClient };
      }
      this.editProjetClient = null;
    }
  }

  deleteProjetClient(id: number | undefined) {
    // TODO: Replace with actual service call when available
    // Example: this.projetClientService.deleteProjetClient(id).subscribe(...)
    this.projetClients = this.projetClients.filter(pc => pc.id !== id);
  }

  updateQuantiteAutorisee(id: number | undefined, quantite: number | null) {
    if (id && quantite !== null) {
      this.projetClientService.updateQuantiteAutorisee(id, quantite).subscribe(
        (updated: ProjetClientDTO) => {
          const idx = this.projetClients.findIndex(pc => pc.id === id);
          if (idx > -1) {
            this.projetClients[idx].quantiteAutorisee = updated.quantiteAutorisee;
          }
        }
      );
    }
  }

  // Autorisation helpers for adding/removing rows in new/edit forms
  addAutorisationToNew() {
    if (!this.newProjetClient.autorisation) this.newProjetClient.autorisation = [];
    if (!this.newAutorisationCode || this.newAutorisationQuantite == null) return;
    this.newProjetClient.autorisation.push({ code: this.newAutorisationCode, quantite: this.newAutorisationQuantite });
    this.newAutorisationCode = '';
    this.newAutorisationQuantite = null;
  }

  removeAutorisationFromNew(idx: number) {
    if (!this.newProjetClient.autorisation) return;
    this.newProjetClient.autorisation.splice(idx, 1);
  }

  addAutorisationToEdit(code: string | undefined, quantite: number | undefined) {
    if (!this.editProjetClient) return;
    if (!this.editProjetClient.autorisation) this.editProjetClient.autorisation = [];
    if (!code || quantite == null) return;
    this.editProjetClient.autorisation.push({ code: code, quantite: quantite });
  }

  removeAutorisationFromEdit(idx: number) {
    if (!this.editProjetClient || !this.editProjetClient.autorisation) return;
    this.editProjetClient.autorisation.splice(idx, 1);
  }
}
