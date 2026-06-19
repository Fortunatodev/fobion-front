import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, H2 } from "../_legal/LegalShell";

export const metadata: Metadata = {
  title: "Termos de Uso — Forbion",
  description: "Termos e condições de uso da plataforma Forbion de gestão para estética automotiva.",
};

export default function TermosPage() {
  return (
    <LegalShell title="Termos de Uso" updatedAt="19 de junho de 2026">
      <p>
        Estes Termos regem o uso da <strong style={{ color: "var(--c-text, #FAFAFA)" }}>Forbion</strong>, plataforma de
        gestão para estéticas automotivas. Ao criar uma conta ou usar a plataforma, você concorda com estes Termos e com
        a nossa{" "}
        <Link href="/privacidade" style={{ color: "#4d94ff" }}>Política de Privacidade</Link>.
      </p>

      <H2>1. O serviço</H2>
      <p>
        A Forbion oferece ferramentas para agendamento, comandas, gestão de clientes, relatórios e comunicação para
        estéticas automotivas. Podemos evoluir, adicionar ou descontinuar funcionalidades ao longo do tempo.
      </p>

      <H2>2. Conta e responsabilidade</H2>
      <ul>
        <li>Você é responsável por manter a confidencialidade das suas credenciais de acesso.</li>
        <li>Os dados que você cadastra (clientes, agendamentos, valores) são de sua responsabilidade e devem respeitar a legislação aplicável, inclusive a LGPD.</li>
        <li>Você se compromete a usar a plataforma de forma lícita e a não tentar comprometer sua segurança.</li>
      </ul>

      <H2>3. Planos e pagamento</H2>
      <p>
        O acesso a planos pagos é cobrado conforme o plano contratado, processado pelo nosso parceiro de pagamentos
        (Cakto). Períodos de teste, quando oferecidos, têm prazo definido no momento da contratação. A renovação e o
        cancelamento seguem as condições do plano vigente.
      </p>

      <H2>4. Cancelamento</H2>
      <p>
        Você pode cancelar sua assinatura a qualquer momento. O acesso permanece disponível até o fim do período já
        pago. Para cancelar ou solicitar a exclusão da conta, escreva para{" "}
        <a href="mailto:contato@forbion.digital" style={{ color: "#4d94ff" }}>contato@forbion.digital</a>.
      </p>

      <H2>5. Integrações de terceiros</H2>
      <p>
        A Forbion pode se integrar a serviços de terceiros (como Google Calendar e WhatsApp). O uso dessas integrações é
        opcional e está sujeito também aos termos do respectivo serviço. O acesso aos dados do Google é descrito na{" "}
        <Link href="/privacidade" style={{ color: "#4d94ff" }}>Política de Privacidade</Link> e pode ser revogado por você a
        qualquer momento.
      </p>

      <H2>6. Propriedade intelectual</H2>
      <p>
        A plataforma, sua marca e seu código são de propriedade da Forbion. Estes Termos não transferem nenhum direito
        de propriedade intelectual a você. Os dados que você insere continuam sendo seus.
      </p>

      <H2>7. Limitação de responsabilidade</H2>
      <p>
        A plataforma é fornecida “como está”. Empregamos esforços razoáveis para mantê-la disponível e segura, mas não
        garantimos operação ininterrupta ou livre de erros. Na máxima extensão permitida em lei, a Forbion não se
        responsabiliza por danos indiretos decorrentes do uso ou da indisponibilidade do serviço.
      </p>

      <H2>8. Alterações dos Termos</H2>
      <p>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas pelos canais da plataforma, e a data de
        “última atualização” no topo será revisada. O uso continuado após as mudanças significa concordância com a nova
        versão.
      </p>

      <H2>9. Contato</H2>
      <p>
        Dúvidas sobre estes Termos:{" "}
        <a href="mailto:contato@forbion.digital" style={{ color: "#4d94ff" }}>contato@forbion.digital</a>.
      </p>
    </LegalShell>
  );
}
