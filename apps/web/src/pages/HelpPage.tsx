import { CalendarPlus, CircleDollarSign, FileText, MessageSquareText, ShieldCheck, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const GUIDES = [
  { icon: CalendarPlus, title: "Marcar uma consulta", to: "/agenda", steps: ["Abra a Agenda e clique em Nova consulta, ou clique direto no horário livre.", "Escolha o paciente, a data e o horário. O término é preenchido sozinho.", "Para toda semana, escolha Recorrência: Semanal e quantas consultas.", "Se houver choque de horário, o sistema avisa e nada é salvo."] },
  { icon: UserPlus, title: "Cadastrar um paciente", to: "/pacientes", steps: ["Em Pacientes, clique em Novo paciente.", "Só o nome é obrigatório. O resto pode ser completado depois.", "Se já existir alguém parecido, aparece um aviso antes de salvar."] },
  { icon: CircleDollarSign, title: "Cobrar o mês e registrar pagamentos", to: "/financeiro", steps: ["Em Financeiro, clique em Gerar cobranças: o sistema conta as sessões realizadas de cada paciente.", "Quando o pagamento chegar, clique em Registrar pagamento na linha do paciente.", "Anexe o comprovante na mesma tela, se quiser."] },
  { icon: MessageSquareText, title: "Confirmar consultas pelo WhatsApp", to: "/comunicacao", steps: ["Em Comunicação, a lista Sugestões mostra quem precisa de confirmação ou lembrete.", "Clique na pessoa, confira o texto e use Copiar texto ou Enviar.", "Nada é enviado sem o seu clique de confirmação."] },
  { icon: FileText, title: "Fechar o mês", to: "/relatorios", steps: ["Em Financeiro, clique em Demonstrativo PDF para o resumo do mês.", "Em Relatórios, escolha o período e baixe CSV ou PDF."] },
  { icon: ShieldCheck, title: "Proteger o acesso", to: "/configuracoes?aba=seguranca", steps: ["Em Configurações, aba Segurança, ative a verificação em duas etapas.", "Na aba Usuários, a psicóloga concede acesso clínico à secretaria só quando precisar, com prazo."] },
];

export function HelpPage() {
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Ajuda" title="Como fazer" description="As tarefas do dia a dia em poucos passos. Em qualquer tela, o botão escuro no canto superior direito é a ação principal." />
      <div className="grid gap-4 md:grid-cols-2">
        {GUIDES.map((g) => (
          <Card key={g.title} className="flex flex-col p-6">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-sage-100 p-2.5 text-forest"><g.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
              <h2 className="text-xl">{g.title}</h2>
            </div>
            <ol className="mt-4 flex-1 list-decimal space-y-2 pl-5 text-sm text-ink">
              {g.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <Link to={g.to} className="mt-4 text-sm font-medium text-forest hover:underline">Ir para lá →</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
