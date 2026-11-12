# Scipione Cred — redesign da interface existente

## Base analisada
Repositório JS171555/scipione-cred, commit 6ffe000. SPA Vite 8, JavaScript ESM, Ionic Core, Supabase, Lucide e GSAP. Camadas existentes: módulos de tela em src/modules; componentes em src/components; serviços Supabase em src/services; regras em src/domain e src/utils; autenticação e roteador por hash em src/core; migrations e RLS em supabase; testes Vitest/jsdom, SQL e integração local.

Os fluxos funcionais já existem. A UI atual usa CSS estrutural, sem sidebar, fontes institucionais, adaptação das tabelas ao toque ou páginas globais de dívidas/pagamentos. O dashboard dispõe de seis indicadores, mas não de visão financeira completa. Upload privado e validação binária, idempotência, estorno auditado e regras de saldo estão implementados e serão preservados. Os commits recentes adotaram “Clientes” na interface; nomes internos e rotas /devedores permanecem.

## Implementação
Evoluir os módulos existentes, sem scaffold, framework adicional, backend novo, mudança das migrations ou alteração de regras financeiras. Componentes compartilhados para shell, marca, ícones, estados, upload e autenticação. Adicionar leituras paginadas para páginas globais de dívidas e pagamentos com RLS. Visão financeira derivada das views existentes usando centavos inteiros e paginação completa, sem amostras apresentadas como totais. Não exibir dados fictícios no produto.

Estrutura: src/styles/tokens.css e base.css para design system; src/components para elementos reutilizáveis; src/modules para telas; public para fontes, ícones e manifest PWA. Serviços mantêm a exclusividade de acesso ao Supabase. Scripts de validação usam apenas ambiente sintético/local.

## Direção visual aprovada pelo usuário
Noir financeiro editorial. Preto #080808 no fundo, grafite #171717 nos painéis, bronze #34302A nas divisórias, marfim #E8DFC9 para leitura e dourado #B89A62 restrito às ações e destaques. Cormorant Garamond nos títulos e marca; DM Sans na operação. Layout com sidebar recolhível, cabeçalho contextual e áreas de conteúdo hierarquizadas, sem ilustrações decorativas ou gráficos inventados. Marca tipográfica própria SCIPIONE / CRED com símbolo geométrico discreto. Essência: crédito, controle e confiança; sóbrio, seguro, preciso.

Navegação desktop com Dashboard, Clientes, Dívidas e Pagamentos. Mobile com navegação inferior, cabeçalho compacto, listas financeiras em cards e campos de no mínimo 44 px. Microinterações de foco e hover discretas; transições de 160–220 ms; respeitar prefers-reduced-motion. Sem neon, gradientes excessivos, integrações bancárias ou automação de cobranças.

## Restrições e decisões preservadas
CPF/CNPJ opcional até decisão comercial; vencimento e comprovante opcionais; limites de upload vindos da configuração existente. Status financeiro calculado pelo banco, nunca seletor manual que contorne pagamentos. Cliente inativo não recebe nova dívida e pode receber pagamentos. Sem exclusão física de histórico; sem juros, multas, encargos ou parcelamento. Buckets privados e URLs assinadas curtas. Não publicar dados ou credenciais nem testar escrita contra produção.

Não há projeto Manus Webdev anexado nem configuração Supabase disponível nesta sessão. Trabalhar no repositório existente e entregar branch/PR revisável; não inicializar outro projeto nem ativar hospedagem. Diagnósticos por node --check, Vitest e build existentes, pois não existe registro de LSP de um projeto gerenciado. Testes visuais solicitados serão feitos em Chromium headless com serviços simulados e dados explicitamente sintéticos, nunca um bypass de autenticação no bundle de produção.
