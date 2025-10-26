import { ProjetParametreComponent } from './component/projet/projet-parametre.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';


import { ChauffeurComponent } from './component/chauffeur/chauffeur.component';
import { CamionComponent } from './component/camion/camion.component';
import { ClientComponent } from './component/client/client.component';
import { DepotComponent } from './component/depot/depot.component';
import { ProjetComponent } from './component/projet/projet.component';
import { VoyageComponent } from './component/voyage/voyage.component';
import { ChargementComponent } from './component/chargement/chargement.component';
import { DechargementComponent } from './component/dechargement/dechargement.component';
import { ProjetClientComponent } from './component/projet-client/projet-client.component';
import { ProjetListComponent } from './projet-list/projet-list.component';
import { ClientsComponent } from './component/clients/clients.component';
import { DepotsComponent } from './component/depots/depots.component';
import { NotificationsComponent } from './component/notifications/notifications.component';
import { RecapComponent } from './component/recap/recap.component';
import { RecapDepotComponent } from './component/recap-depot/recap-depot.component';
import { DeclarationComponent } from './component/declaration/declaration.component';

// Importation des guards
import { AuthGuard } from './guards/auth.guard';
import { LoginGuard } from './guards/login.guard';


const routes: Routes = [
  // Route de connexion - accessible seulement si non authentifié
  { path: 'login', component: LoginComponent, canActivate: [LoginGuard] },
  
  // Route par défaut - redirige vers la page des projets
  { path: '', redirectTo: '/projet', pathMatch: 'full' },
  
  // Routes protégées - nécessitent une authentification
  { path: 'projet-list', component: ProjetListComponent, canActivate: [AuthGuard] },
  { path: 'chauffeur', component: ChauffeurComponent, canActivate: [AuthGuard] },
  { path: 'camion', component: CamionComponent, canActivate: [AuthGuard] },
  { path: 'client', component: ClientComponent, canActivate: [AuthGuard] },
  { path: 'depot', component: DepotComponent, canActivate: [AuthGuard] },
  { path: 'clients', component: ClientsComponent, canActivate: [AuthGuard] },
  { path: 'depots', component: DepotsComponent, canActivate: [AuthGuard] },
  { path: 'projet', component: ProjetComponent, canActivate: [AuthGuard] },
  { path: 'declaration', component: DeclarationComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/parametre', component: ProjetParametreComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/voyages', component: VoyageComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/chargements', component: ChargementComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/recap', component: RecapComponent, canActivate: [AuthGuard] },
  { path: 'projet/:id/recap-depot', component: RecapDepotComponent, canActivate: [AuthGuard] },
  { path: 'voyage', component: VoyageComponent, canActivate: [AuthGuard] },
  { path: 'chargement', component: ChargementComponent, canActivate: [AuthGuard] },
  { path: 'dechargement', component: DechargementComponent, canActivate: [AuthGuard] },
  { path: 'recap', component: RecapComponent, canActivate: [AuthGuard] },
  { path: 'recap-depot', component: RecapDepotComponent, canActivate: [AuthGuard] },
  { path: 'projet-client', component: ProjetClientComponent, canActivate: [AuthGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [AuthGuard] },
  
  // Redirection par défaut - toute route inconnue vers la page des projets
  { path: '**', redirectTo: '/projet' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
