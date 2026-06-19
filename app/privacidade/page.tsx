import type { Metadata } from "next";
import { LegalShell, H2 } from "../_legal/LegalShell";

export const metadata: Metadata = {
  title: "Política de Privacidade — Forbion",
  description:
    "Como a Forbion coleta, usa e protege seus dados, incluindo os dados acessados via login com Google e a integração opcional com o Google Calendar.",
};

export default function PrivacidadePage() {
  return (
    <LegalShell title="Política de Privacidade" updatedAt="19 de junho de 2026">
      <p>
        A <strong style={{ color: "var(--c-text, #FAFAFA)" }}>Forbion</strong> é uma plataforma de gestão para
        estéticas automotivas (agendamentos, comandas, clientes e relatórios). Esta política explica quais dados
        coletamos, por que coletamos e como você pode controlá-los. Ao usar a plataforma — incluindo o login com o
        Google e a integração com o Google Calendar — você concorda com as práticas descritas aqui.
      </p>

      <H2>1. Quem somos</H2>
      <p>
        Forbion — software de gestão para estética automotiva. Contato:{" "}
        <a href="mailto:contato@forbion.digital" style={{ color: "#4d94ff" }}>contato@forbion.digital</a>. Atuamos como
        controladores dos dados de cadastro da conta e como operadores dos dados que cada loja registra sobre seus
        próprios clientes.
      </p>

      <H2>2. Dados que coletamos</H2>
      <ul>
        <li><strong style={{ color: "var(--c-text, #FAFAFA)" }}>Cadastro:</strong> nome, e-mail, telefone e dados da loja.</li>
        <li><strong style={{ color: "var(--c-text, #FAFAFA)" }}>Operação:</strong> agendamentos, serviços, veículos, comandas e histórico de atendimento que você registra na plataforma.</li>
        <li><strong style={{ color: "var(--c-text, #FAFAFA)" }}>Dados de pagamento:</strong> processados pelo nosso parceiro de pagamentos (Cakto). Não armazenamos dados completos de cartão.</li>
        <li><strong style={{ color: "var(--c-text, #FAFAFA)" }}>Dados técnicos:</strong> logs de acesso e uso, para segurança e suporte.</li>
      </ul>

      <H2>3. Login com o Google e dados do Google</H2>
      <p>
        Você pode entrar na Forbion usando sua conta Google. Nesse caso, com o seu consentimento, acessamos apenas:
      </p>
      <ul>
        <li><strong style={{ color: "var(--c-text, #FAFAFA)" }}>Perfil básico</strong> (<code>userinfo.profile</code>): nome e foto, para identificar sua conta.</li>
        <li><strong style={{ color: "var(--c-text, #FAFAFA)" }}>E-mail</strong> (<code>userinfo.email</code>): para criar e autenticar sua conta.</li>
      </ul>
      <p>
        Esses escopos servem unicamente para autenticar você. Não acessamos contatos, arquivos ou qualquer outro dado
        da sua conta Google.
      </p>

      <H2>4. Integração com o Google Calendar (opcional)</H2>
      <p>
        Se — e somente se — você ativar a integração e der consentimento explícito, solicitamos o escopo{" "}
        <code>https://www.googleapis.com/auth/calendar.events</code>. Usamos esse acesso de forma estritamente limitada:
      </p>
      <ul>
        <li>Criar, atualizar e cancelar <strong style={{ color: "var(--c-text, #FAFAFA)" }}>eventos dos seus próprios agendamentos</strong> feitos na Forbion, com um lembrete 30 minutos antes do horário.</li>
        <li>Sincronizar reagendamentos e cancelamentos feitos na plataforma.</li>
      </ul>
      <p>
        <strong style={{ color: "var(--c-text, #FAFAFA)" }}>O que NÃO fazemos:</strong> não lemos os demais eventos da
        sua agenda, não analisamos seu calendário e não usamos esses dados para nenhum outro fim. O token de acesso é
        usado apenas no servidor, para sincronizar o evento do agendamento que você mesmo criou.
      </p>
      <p>
        O uso e a transferência de informações recebidas das APIs do Google pela Forbion seguem a{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: "#4d94ff" }}>
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado (<em>Limited Use</em>).
      </p>

      <H2>5. Como usamos os dados</H2>
      <ul>
        <li>Operar a plataforma (agenda, comandas, relatórios, lembretes).</li>
        <li>Enviar e-mails transacionais (confirmação de conta, novos agendamentos, lembretes).</li>
        <li>Dar suporte, prevenir fraude e garantir a segurança da conta.</li>
      </ul>
      <p>
        <strong style={{ color: "var(--c-text, #FAFAFA)" }}>Não vendemos seus dados</strong> e não os compartilhamos
        com terceiros para publicidade.
      </p>

      <H2>6. Compartilhamento</H2>
      <p>
        Compartilhamos dados apenas com prestadores necessários à operação: provedor de pagamentos (Cakto), provedor de
        e-mail (Resend) e o Google (quando você usa login/Calendar). Cada um trata os dados apenas para a finalidade
        contratada.
      </p>

      <H2>7. Retenção e exclusão</H2>
      <p>
        Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a exclusão da conta e dos dados
        associados a qualquer momento por{" "}
        <a href="mailto:contato@forbion.digital" style={{ color: "#4d94ff" }}>contato@forbion.digital</a>.
      </p>

      <H2>8. Como revogar o acesso do Google</H2>
      <ul>
        <li>Dentro da Forbion, desconecte a integração de Calendar nas configurações.</li>
        <li>Ou revogue o acesso diretamente em{" "}
          <a href="https://myaccount.google.com/permissions" style={{ color: "#4d94ff" }}>myaccount.google.com/permissions</a>.
        </li>
      </ul>
      <p>Ao revogar, paramos imediatamente de criar ou atualizar eventos no seu calendário.</p>

      <H2>9. Seus direitos (LGPD)</H2>
      <p>
        Você pode acessar, corrigir, exportar ou excluir seus dados, e revogar consentimentos. Para exercer qualquer
        direito, escreva para{" "}
        <a href="mailto:contato@forbion.digital" style={{ color: "#4d94ff" }}>contato@forbion.digital</a>.
      </p>

      <H2>10. Alterações</H2>
      <p>
        Podemos atualizar esta política. Mudanças relevantes serão comunicadas pelos canais da plataforma, e a data de
        “última atualização” no topo será revisada.
      </p>
    </LegalShell>
  );
}
