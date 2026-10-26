import { Check, MessageSquareText, type LucideIcon } from "lucide-react";
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
