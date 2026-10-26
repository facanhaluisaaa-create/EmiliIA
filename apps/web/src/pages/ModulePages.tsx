import { Check, FolderOpen, MessageSquareText, Wallet, BarChart3, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";

interface ModuleSpec {
  title: string;
  stage: number;
  icon: LucideIcon;
  description: string;
  features: string[];
  integrations?: string[];
  note?: string;
}

function ModulePreview({ spec }: { spec: ModuleSpec }) {
  const Icon = spec.icon;
  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow={`Módulo · Etapa ${spec.stage}`}
        title={spec.title}
        description={spec.description}
        action={<Badge tone="warn">Em desenvolvimento</Badge>}
      />
      <div className="mb-5">
        <DemoBanner text={`Este módulo está previsto para a Etapa ${spec.stage}. A estrutura de dados e as permissões já existem no backend; a interface será entregue nessa etapa.`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-sage-100 p-2.5 text-forest">
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-xl">O que este módulo fará</h2>
          </div>
          <ul className="space-y-2.5">
            {spec.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage-500" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-5">
          {spec.integrations && (
            <Card className="p-6">
              <h2 className="text-xl">Integrações previstas</h2>
              <ul className="mt-3 space-y-2">
                {spec.integrations.map((i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span>{i}</span>
                    <Badge tone="neutral">Não conectada</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {spec.note && (
            <Card className="bg-sage-100/60 p-6">
              <p className="text-sm leading-relaxed text-forest">{spec.note}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export const FinancePage = () => (
  <ModulePreview
    spec={{
      title: "Financeiro",
      stage: 3,
      icon: Wallet,
      description: "Sessões realizadas, cobranças mensais, pagamentos e demonstrativos.",
      features: [
        "Registro de sessões realizadas e valores por sessão.",
        "Cobranças mensais com vencimentos e pagamentos parciais ou integrais.",
        "Vinculação de comprovantes e notas fiscais a cada registro.",
        "Demonstrativos mensais em PDF e visão de valores recebidos, pendentes e em atraso.",
      ],
      note: "Notas fiscais oficiais não serão emitidas pelo sistema sem uma integração própria e homologada com a prefeitura.",
    }}
  />
);

export const DocumentsPage = () => (
  <ModulePreview
    spec={{
      title: "Documentos",
      stage: 3,
      icon: FolderOpen,
      description: "Documentos administrativos organizados por paciente e por mês.",
      features: [
        "Organização por paciente e competência mensal.",
        "Visualização e vinculação de comprovantes e notas fiscais aos registros financeiros.",
        "Preparação para armazenamento no Google Drive com credenciais protegidas no servidor.",
      ],
      integrations: ["Google Drive"],
    }}
  />
);

export const CommunicationPage = () => (
  <ModulePreview
    spec={{
      title: "Comunicação",
      stage: 5,
      icon: MessageSquareText,
      description: "Modelos de mensagens e envio pela API oficial do WhatsApp Business.",
      features: [
        "Modelos de confirmação de consulta, lembretes, remarcações e cobrança.",
        "Pré-visualização personalizada por paciente antes do envio.",
        "Registro de mensagens enviadas no histórico administrativo.",
      ],
      integrations: ["WhatsApp Business (API oficial)"],
      note: "Nenhuma mensagem será enviada automaticamente sem autorização expressa e configuração prévia da integração.",
    }}
  />
);

export const ReportsPage = () => (
  <ModulePreview
    spec={{
      title: "Relatórios",
      stage: 3,
      icon: BarChart3,
      description: "Indicadores de consultas, cancelamentos, receitas e inadimplência.",
      features: [
        "Consultas realizadas, cancelamentos e faltas por período.",
        "Receitas, inadimplência e evolução mensal.",
        "Filtros por período e exportação em PDF ou planilha.",
      ],
    }}
  />
);
