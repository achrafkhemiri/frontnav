export interface Notification {
  id: number;
  type: TypeNotification;
  niveau: NiveauAlerte;
  message: string;
  entiteType?: string;
  entiteId?: number;
  dateCreation: string;
  lu: boolean;
  dateLecture?: string;
  deletable?: boolean; // Indique si la notification peut être supprimée
}

export enum TypeNotification {
  DEPASSEMENT_QUANTITE = 'DEPASSEMENT_QUANTITE',
  QUANTITE_PROCHE_LIMITE = 'QUANTITE_PROCHE_LIMITE',
  VALIDATION_CLIENT = 'VALIDATION_CLIENT',
  VALIDATION_VOYAGE = 'VALIDATION_VOYAGE',
  ALERTE_STOCK = 'ALERTE_STOCK',
  INFO_GENERALE = 'INFO_GENERALE'
}

export enum NiveauAlerte {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  DANGER = 'DANGER'
}

export interface StatistiquesNotifications {
  total: number;
  nonLues: number;
  danger: number;
  warning: number;
  info: number;
  success: number;
}
