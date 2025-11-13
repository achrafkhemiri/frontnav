import { ProjetParametreComponent } from './component/projet/projet-parametre.component';
import { ProjetListComponent } from './projet-list/projet-list.component';
import { ProjetComponent } from './component/projet/projet.component';
import { VoyageComponent } from './component/voyage/voyage.component';
import { ChargementComponent } from './component/chargement/chargement.component';
import { DechargementComponent } from './component/dechargement/dechargement.component';
import { BreadcrumbComponent } from './component/breadcrumb/breadcrumb.component';
import { RecapComponent } from './component/recap/recap.component';
import { RecapDepotComponent } from './component/recap-depot/recap-depot.component';
import { SocieteComponent } from './component/societe/societe.component';
import { NgModule } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { BASE_PATH } from './api/variables';
import { SsrJwtInterceptor } from './ssr-jwt.interceptor';
import { AuthTokenInterceptor } from './auth-token.interceptor';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';

import { FormsModule } from '@angular/forms';
// FormsModule est déjà importé correctement
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { LoginComponent } from './login/login.component';
import { HttpClientModule } from '@angular/common/http';
import { ChauffeurComponent } from './component/chauffeur/chauffeur.component';
import { CamionComponent } from './component/camion/camion.component';
import { DepotComponent } from './component/depot/depot.component';
import { ConfirmCodeDialogComponent } from './shared/confirm-code-dialog.component';
// DepotComponent est déjà importé correctement
import { ProjetClientComponent } from './component/projet-client/projet-client.component';
import { ClientComponent } from './component/client/client.component';
import { ClientsComponent } from './component/clients/clients.component';
import { DepotsComponent } from './component/depots/depots.component';
import { RouterModule } from '@angular/router';
import { AuthErrorInterceptor } from './auth-error.interceptor';
import { NotificationsComponent } from './component/notifications/notifications.component';
import { DeclarationComponent } from './component/declaration/declaration.component';
import { Configuration } from './api/configuration';

@NgModule({ 
  declarations: [
  AppComponent,
  SidebarComponent,
  NavbarComponent,
  LoginComponent,

  ChauffeurComponent,
  ProjetComponent,
  VoyageComponent,
  ChargementComponent,
  DechargementComponent,
  CamionComponent,
  DepotComponent,
  ProjetClientComponent,
  // Ajout du composant client
  ClientComponent,
  ClientsComponent,
  DepotsComponent,
  // Ajout du composant projet-parametre
  ProjetParametreComponent,
  ProjetListComponent,
  BreadcrumbComponent,
  NotificationsComponent,
  RecapComponent,
  RecapDepotComponent,
  DeclarationComponent,
  ConfirmCodeDialogComponent,
  SocieteComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDialogModule,
    MatSelectModule,
    RouterModule
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: SsrJwtInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthErrorInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthTokenInterceptor,
      multi: true
    },
    { provide: BASE_PATH, useValue: 'http://localhost:8086' },
    {
      provide: Configuration,
      useFactory: () => new Configuration({
        basePath: 'http://localhost:8086',
        withCredentials: true  // Important pour recevoir et envoyer les cookies JWT
      })
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
