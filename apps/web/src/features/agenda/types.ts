export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  startsAt: string;
  endsAt: string;
  modality: "presencial" | "online";
  status: "agendada" | "confirmada" | "realizada" | "cancelada" | "falta" | "remarcada";
  recurrence: "unica" | "semanal" | "quinzenal";
  seriesId: string | null;
  adminNotes: string | null;
  googleEventId: string | null;
  meetUrl: string | null;
}
