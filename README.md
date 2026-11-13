# Espaço da Juh — Agenda

Página das clientes: `/`. Painel administrativo protegido: `/admin`.

## Serviços e disponibilidade

O catálogo compartilhado de nomes, valores e durações está em `public/catalog.js`.
- Manicure premium: R$ 70,00, 70 minutos.
- Pedicure premium: R$ 70,00, 70 minutos.
- Combo manicure e pedicure premium: R$ 100,00, 115 minutos.
- Podologia: a partir de R$ 120,00; valor final combinado com a Juh.
- Reflexologia: R$ 85,00, 45 minutos.
- Os demais serviços e preços foram preservados.

Atendimento de quarta a sábado, das 9h às 17h, no fuso America/Sao_Paulo.
A cliente pode escolher vários serviços. A soma das durações considera todo o intervalo ocupado e respeita o fechamento às 17h.

## Pedidos e Pix

Ao usar “Salvar pedido e continuar no WhatsApp”, nome, serviços, data e horário são registrados no banco como “Aguardando comprovante Pix”. O intervalo fica reservado e desaparece da seleção de outras clientes. A gravação confere conflitos no servidor e evita duplicar o mesmo pedido em novas tentativas.

Chave Pix: ju.santtos@icloud.com. A cliente paga somente 50% do valor via Pix para confirmar e envia o comprovante pelo WhatsApp. Os outros 50% são pagos pessoalmente no dia do atendimento. Para podologia com preço a partir de R$ 120,00, o valor final deve ser combinado com a Juh antes do sinal. Os valores do sinal e do saldo aparecem na agenda, na mensagem e no painel. O site não realiza nem verifica transferências bancárias automaticamente.

No painel, a administradora confere o comprovante e escolhe “Confirmar comprovante recebido”. Se a cliente desistir ou não concluir o pagamento, deve cancelar o pedido para liberar o horário. Não há vencimento automático dos pedidos pendentes.

## Painel

Mostra nomes, serviços, datas, horários, valores e status, incluindo histórico e registros cancelados. Filtros: todos, aguardando comprovante, confirmados, bloqueios e cancelados. A consulta é exclusiva da conta autorizada. A API de disponibilidade pública nunca retorna nomes ou observações.

Também permite bloquear um ou vários intervalos, bloquear todos os horários de um dia, registrar atendimentos feitos fora do site, cancelar e restaurar registros. Não há sincronização com a InfinitePay.

O painel usa a autenticação do ChatGPT fornecida pelo Sites e confere a conta no servidor. Inicialmente a conta proprietária é autorizada pela configuração `ADMIN_BOOTSTRAP_EMAIL`. Em “Acesso da Juh” é possível transferir o painel para o e-mail da conta ChatGPT dela. A conta anterior perde acesso. O acesso externo ao site depende também da audiência configurada na hospedagem.

## Desenvolvimento e publicação

Requer Node.js 24 ou superior. Não há dependências externas para instalar.
- `npm run dev`: testes locais em http://localhost:4173/ e /admin.
- `npm test`: testes de disponibilidade, autenticação, reservas, conflitos e confirmação.
- `npm run build`: gera o Worker ESM em dist/server/index.js e embute arquivos públicos.

Edite `public/` e `worker/`, não os arquivos gerados de `dist/`. O catálogo é compartilhado entre página e servidor. As migrações de banco estão em `drizzle/` e são aplicadas na publicação pelo Sites.

A prévia local usa uma conta fictícia e um banco separado em `.preview/`. Essa pasta, senhas e credenciais não fazem parte do ZIP. Nunca publique o servidor de testes como servidor de produção. O ZIP agora inclui uma configuração própria para Vercel. Consulte PUBLICAR-NA-VERCEL.txt. O frontend da Vercel consulta o mesmo servidor e banco do site principal; o painel continua no servidor autenticado. Não exclua nem torne privado o site principal enquanto a Vercel estiver usando a agenda.

## Vercel

`vercel.json` define `node scripts/build-vercel.mjs` e saída `dist`. Esse build gera HTML/CSS/JS, sem o Worker e sem os arquivos do painel. Duas reescritas externas encaminham disponibilidade e reservas ao servidor principal. As respostas da agenda não são armazenadas em cache. As rotas /admin e /admin.html redirecionam ao painel autenticado. Nenhuma senha ou chave de acesso é incluída no frontend.

O servidor aceita reservas vindas de https://espacodajuh.vercel.app e do próprio domínio. Ao mudar o domínio público, atualize CLIENT_ORIGINS em worker/index.js e publique o backend. As URLs temporárias de preview podem consultar horários, mas só os domínios autorizados podem enviar reservas.
