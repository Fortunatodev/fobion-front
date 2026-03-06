import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de Privacidade | Forbion",
  description: "Como a Forbion coleta, usa e protege seus dados pessoais.",
}

export default function PrivacyPage() {
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
        Política de Privacidade
      </h1>
      <p style={{ color: "#71717A", marginBottom: 40 }}>
        Última atualização: 6 de março de 2026
      </p>

      <Section title="1. Quem somos">
        <p>
          A <strong>Forbion</strong> é uma plataforma de gestão para estéticas automotivas,
          desenvolvida e operada por Forbion Tech. Esta política descreve como coletamos,
          usamos e protegemos suas informações pessoais ao utilizar nossos serviços.
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <p>Ao criar uma conta ou usar a Forbion, podemos coletar:</p>
        <ul>
          <li><strong>Dados de identificação:</strong> nome, endereço de e-mail e foto de perfil, fornecidos via Google OAuth ou cadastro direto.</li>
          <li><strong>Dados de uso:</strong> agendamentos, clientes, serviços e funcionários cadastrados no sistema.</li>
          <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador e logs de acesso, para fins de segurança e diagnóstico.</li>
        </ul>
      </Section>

      <Section title="3. Como usamos seus dados">
        <p>Usamos suas informações exclusivamente para:</p>
        <ul>
          <li>Autenticar seu acesso à plataforma (via Google OAuth ou e-mail/senha).</li>
          <li>Operar e exibir os dados do seu negócio (agendamentos, clientes, relatórios).</li>
          <li>Enviar notificações transacionais relacionadas aos seus agendamentos.</li>
          <li>Melhorar a estabilidade e segurança do serviço.</li>
        </ul>
        <p>
          <strong>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros
          para fins de marketing.</strong>
        </p>
      </Section>

      <Section title="4. Google OAuth">
        <p>
          A Forbion utiliza o <strong>Google Sign-In (OAuth 2.0)</strong> como opção de
          autenticação. Quando você faz login com o Google, recebemos apenas as informações
          que você autoriza na tela de permissão: nome, e-mail e foto de perfil.
        </p>
        <p>
          Não solicitamos acesso à sua agenda, e-mails, contatos ou qualquer outro dado
          além do necessário para criar e identificar sua conta.
        </p>
        <p>
          O uso de informações recebidas via Google APIs está em conformidade com a{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3B82F6" }}
          >
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado.
        </p>
      </Section>

      <Section title="5. Compartilhamento de dados">
        <p>Seus dados podem ser processados por prestadores de serviço essenciais:</p>
        <ul>
          <li><strong>Neon / PostgreSQL</strong> — armazenamento do banco de dados.</li>
          <li><strong>Railway</strong> — hospedagem do servidor backend.</li>
          <li><strong>Vercel</strong> — hospedagem do frontend.</li>
          <li><strong>UploadThing</strong> — armazenamento de imagens de serviços.</li>
          <li><strong>Resend</strong> — envio de e-mails transacionais.</li>
        </ul>
        <p>Todos esses parceiros são contratualmente obrigados a tratar seus dados com segurança.</p>
      </Section>

      <Section title="6. Retenção de dados">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Caso solicite a exclusão
          da conta, removeremos seus dados pessoais em até 30 dias, exceto onde a retenção
          for exigida por lei.
        </p>
      </Section>

      <Section title="7. Seus direitos">
        <p>Você tem o direito de:</p>
        <ul>
          <li>Acessar os dados que armazenamos sobre você.</li>
          <li>Corrigir informações incorretas.</li>
          <li>Solicitar a exclusão da sua conta e dados associados.</li>
          <li>Exportar seus dados em formato legível.</li>
        </ul>
        <p>
          Para exercer qualquer um desses direitos, entre em contato pelo e-mail:{" "}
          <a href="mailto:privacidade@forbion.com.br" style={{ color: "#3B82F6" }}>
            privacidade@forbion.com.br
          </a>
        </p>
      </Section>

      <Section title="8. Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados
          contra acesso não autorizado, alteração, divulgação ou destruição. As comunicações
          entre seu navegador e nossos servidores são protegidas por HTTPS/TLS.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          A Forbion utiliza apenas cookies estritamente necessários para manter sua sessão
          autenticada no painel administrativo. Não utilizamos cookies de rastreamento ou
          publicidade.
        </p>
      </Section>

      <Section title="10. Alterações nesta política">
        <p>
          Podemos atualizar esta política periodicamente. Quando isso ocorrer, atualizaremos
          a data no topo desta página. O uso continuado da plataforma após as alterações
          constitui aceitação da nova política.
        </p>
      </Section>

      <Section title="11. Contato">
        <p>
          Dúvidas sobre esta política? Fale conosco:{" "}
          <a href="mailto:privacidade@forbion.com.br" style={{ color: "#3B82F6" }}>
            privacidade@forbion.com.br
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
