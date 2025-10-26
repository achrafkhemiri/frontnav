import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-code-dialog',
  template: `
  <div class="code-dialog">
    <h3>Code de suppression</h3>
    <p>Veuillez entrer le code de suppression pour confirmer l'opération.</p>
    <input [(ngModel)]="code" placeholder="Entrez le code" class="code-input" />
    <div *ngIf="error" class="error-msg">{{ error }}</div>
    <div class="actions">
      <button (click)="onCancel()" class="btn-cancel">Annuler</button>
      <button (click)="onConfirm()" class="btn-confirm">Valider</button>
    </div>
  </div>
  `,
  styles: [
    `
    .code-dialog { padding: 20px; width: 360px; }
    .code-input { width: 100%; padding: 8px 10px; margin-top: 10px; border-radius:6px; border:1px solid #cbd5e1 }
    .actions { display:flex; gap:10px; justify-content:flex-end; margin-top:16px }
    .btn-cancel { background:white; border:1px solid #cbd5e1; padding:8px 12px; border-radius:8px }
    .btn-confirm { background: linear-gradient(135deg,#ef4444 0%,#dc2626 100%); color:white; padding:8px 12px; border-radius:8px; border:none }
    .error-msg { color:#b91c1c; margin-top:8px }
    `
  ]
})
export class ConfirmCodeDialogComponent {
  code: string = '';
  error: string | null = null;
  private readonly SECRET = '06460465';

  constructor(private dialogRef: MatDialogRef<ConfirmCodeDialogComponent>) {}

  onCancel() {
    this.dialogRef.close(false);
  }

  onConfirm() {
    if (this.code && this.code.trim() === this.SECRET) {
      this.dialogRef.close(true);
    } else {
      this.error = 'Code invalide';
    }
  }
}
