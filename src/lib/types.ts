export type Frequency =
  | "semanal"
  | "quincenal"
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual"
  | "unico";

/** Cuántas piezas de cada tipo entran en el plan mensual del cliente (ej. 8 placas). */
export interface PlanItem {
  type: string;
  count: number;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  color: string;
  notes?: string;
  /** Plan de contenido mensual. */
  contentPlan?: PlanItem[];
  archived: boolean;
  createdAt: string;
}

/** Un cambio de precio que rige para los vencimientos desde `from` (inclusive). */
export interface PriceChange {
  from: string;
  amount: number;
}

export interface Service {
  id: string;
  clientId: string;
  name: string;
  /** Monto inicial de cada cobro, en pesos. Los aumentos van en `priceChanges`. */
  amount: number;
  priceChanges?: PriceChange[];
  frequency: Frequency;
  /** Primer vencimiento (YYYY-MM-DD). Los siguientes se calculan desde acá. */
  startDate: string;
  /** Si está, no se generan cobros después de esta fecha. */
  endDate?: string;
  notes?: string;
}

export type PaymentMethod = "transferencia" | "mercadopago" | "efectivo" | "otro";

export interface Payment {
  id: string;
  serviceId: string;
  clientId: string;
  /** Vencimiento al que corresponde este pago. */
  dueDate: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  note?: string;
  /** Número de recibo, si se generó. */
  receiptNumber?: number;
}

export type PostStatus = "pendiente" | "aprobada" | "cambios";

/** Una publicación del calendario de contenido de un cliente. */
export interface ContentPost {
  id: string;
  clientId: string;
  /** Día de publicación (YYYY-MM-DD). */
  date: string;
  title: string;
  /** Texto del posteo con hashtags, listo para copiar. */
  copy: string;
  /** La pieza en sí: texto de la placa, guion del reel y notas de diseño. */
  piece?: string;
  /** Aprobación del cliente. Sin valor = pendiente. */
  status?: PostStatus;
  /** Lo que pidió cambiar el cliente. */
  feedback?: string;
}

/** Un gasto asociado a un cliente: pauta, freelancers, herramientas. */
export interface Expense {
  id: string;
  clientId: string;
  concept: string;
  amount: number;
  date: string;
  /** Si se repite todos los meses desde `date`. */
  monthly?: boolean;
  /** Último mes en que se cuenta un gasto mensual (YYYY-MM-DD). */
  endDate?: string;
}

export interface Settings {
  ownerName: string;
  /** Datos que salen en los recibos. */
  businessName: string;
  businessId?: string;
  businessContact?: string;
  nextReceipt: number;
  /** Carpeta de Drive u OneDrive donde se guarda una copia diaria. */
  cloudBackupDir?: string;
  /** Avisos de Windows con lo que vence y se publica cada día. */
  notifications: boolean;
  /** Abrir la app (escondida, en la bandeja) al prender la compu. */
  openAtLogin: boolean;
}

export interface AppData {
  version: 1;
  clients: Client[];
  services: Service[];
  payments: Payment[];
  posts: ContentPost[];
  expenses: Expense[];
  settings: Settings;
}

export type ChargeStatus = "pagado" | "parcial" | "vencido" | "pendiente";

/** Un vencimiento calculado a partir de un servicio, con lo que se pagó. */
export interface Charge {
  key: string;
  serviceId: string;
  clientId: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: ChargeStatus;
}
