import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Termos de Serviço | Forbion",
  description: "Termos e condições de uso da plataforma Forbion.",
}

export default function TermsPage() {
  return (
    <main style={{
      maxWidth: 760,
      margin: "0 auto",
      padding: "60px 24px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#FAFAFA",
      background: "#09090B",
      minHeight: "100vh",
      lineHeight: 1.7,
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
        Termos de Serviço
      </h1>
      <p style={{ color: "#71717A", marginBottom: 40 }}>
        Última atualização: 6 de março de 2026
      </p>

      <Section title="1. Aceitação dos Termos">
        <p>
          Ao acessar ou usar a plataforma <strong>Forbion</strong>, você concorda com estes
          Termos de Serviço. Caso não concorde com algum dos termos, não utilize o serviço.
        </p>
      </Section>

      <Section title="2. O que é a Forbion">
        <p>
          A Forbion é uma plataforma de gestão para estéticas automotivas que permite:
        </p>
        <ul>
          <li>Gerenciamento de agendamentos online.</li>
          <li>Cadastro de clientes, veículos, serviços e funcionários.</li>
          <li>Agendamento online pelos clientes finais via página pública.</li>
          <li>Relatórios e controle financeiro básico.</li>
          <li>Planos de assinatura para clientes recorrentes.</li>
        </ul>
      </Section>

      <Section title="3. Cadastro e Conta">
        <p>
          Para usar a Forbion como proprietário de estabelecimento, você deve criar uma
          conta com informações verdadeiras e precisas. Você é responsável por manter a
          confidencialidade das suas credenciais de acesso.
        </p>
        <p>
          Ao fazer login com o Google, você autoriza a Forbion a utilizar seu nome,
          e-mail e foto de perfil para criar e identificar sua conta.
        </p>
      </Section>

      <Section title="4. Planos e Pagamentos">
        <p>
          A Forbion oferece diferentes planos de acesso (Free, Basic, Pro). Os recursos
          disponíveis variam conforme o plano contratado. Os planos pagos são cobrados
          conforme a periodicidade escolhida (mensal ou anual).
        </p>
        <p>
          O não pagamento das mensalidades pode resultar na suspensão temporária do acesso
          aos recursos premium, sem exclusão dos seus dados.
        </p>
      </Section>

      <Section title="5. Uso Aceitável">
        <p>Você concorda em não utilizar a Forbion para:</p>
        <ul>
          <li>Violar leis ou regulamentos aplicáveis.</li>
          <li>Transmitir spam ou conteúdo malicioso.</li>
          <li>Tentar acessar contas de outros usuários ou sistemas sem autorização.</li>
          <li>Reproduzir, distribuir ou criar trabalhos derivados da plataforma sem permissão.</li>
        </ul>
      </Section>

      <Section title="6. Dados dos Clientes Finais">
        <p>
          Ao cadastrar clientes e dados de veículos na plataforma, você declara ter o
          consentimento necessário para armazenar essas informações, em conformidade com a
          Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
        </p>
        <p>
          A Forbion atua como operadora dos dados inseridos pelos estabelecimentos, que
          são os controladores responsáveis por esses dados.
        </p>
      </Section>

      <Section title="7. Propriedade Intelectual">
        <p>
          Todo o código, design, marca e conteúdo da plataforma Forbion são de propriedade
          exclusiva da Forbion Tech. O uso do serviço não transfere nenhum direito de
          propriedade intelectual ao usuário.
        </p>
        <p>
          Os dados inseridos por você (clientes, agendamentos, etc.) permanecem de sua
          propriedade.
        </p>
      </Section>

      <Section title="8. Disponibilidade do Serviço">
        <p>
          A Forbion se esforça para manter o serviço disponível 24/7, mas não garante
          disponibilidade ininterrupta. Podem ocorrer períodos de manutenção programada
          ou indisponibilidade por fatores fora do nosso controle.
        </p>
      </Section>

      <Section title="9. Limitação de Responsabilidade">
        <p>
          A Forbion não se responsabiliza por danos indiretos, incidentais ou
          consequentes decorrentes do uso ou impossibilidade de uso do serviço. Nossa
          responsabilidade total está limitada ao valor pago pelo usuário nos últimos
          3 meses.
        </p>
      </Section>

      <Section title="10. Rescisão">
        <p>
          Você pode encerrar sua conta a qualquer momento. A Forbion pode suspender ou
          encerrar contas que violem estes Termos, após notificação prévia sempre que
          possível.
        </p>
        <p>
          Após o encerramento, seus dados serão mantidos por até 30 dias antes da
          exclusão definitiva, exceto onde a lei exigir retenção por período maior.
        </p>
      </Section>

      <Section title="11. Alterações nos Termos">
        <p>
          Podemos atualizar estes Termos periodicamente. Notificaremos usuários sobre
          mudanças relevantes por e-mail ou aviso na plataforma. O uso continuado após
          as alterações constitui aceitação dos novos termos.
        </p>
      </Section>

      <Section title="12. Lei Aplicável">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Qualquer
          disputa será resolvida no foro da comarca de São Paulo – SP.
        </p>
      </Section>

      <Section title="13. Contato">
        <p>
          Dúvidas sobre estes Termos? Entre em contato:{" "}
          <a href="mailto:contato@forbion.com.br" style={{ color: "#3B82F6" }}>
            contato@forbion.com.br
          </a>
        </p>
      </Section>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: 20,
        fontWeight: 600,
        color: "#FAFAFA",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid #27272A",
      }}>
        {title}
      </h2>
      <div style={{ color: "#A1A1AA" }}>{children}</div>
    </section>
  )
}
