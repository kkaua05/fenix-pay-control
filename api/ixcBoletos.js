// ============================================================
// IXC PROVEDOR - Automacao de Boletos em Aberto
// ============================================================
// Faz login no painel administrativo IXC (sistema.fenixwireless.com.br/adm.php)
// com a conta de servico da empresa, busca o cliente pelo CPF, abre o cadastro,
// vai na aba Financeiro, seleciona todos os titulos com status "A receber"
// (vencido, vencendo hoje ou a vencer - as 3 variacoes usam o mesmo texto de
// status nessa tela, diferindo so na cor do badge) e gera o PDF combinado de
// boletos no layout "3 por pagina personalizavel + PIX Cobranca".
//
// IMPORTANTE: esta conta de admin permite apenas UMA sessao ativa por vez no
// IXC. Para nunca disputar sessao com nos mesmos (e evitar o erro "Ja existe
// uma sessao ativa" a cada chamada), esta automacao REAPROVEITA a sessao
// autenticada entre chamadas: quem chama passa o storageState salvo da ultima
// vez (cookies + localStorage) e recebe de volta o estado atualizado para
// persistir. So faz login de verdade quando nao ha sessao salva ou ela expirou.

const ADM_URL = 'https://sistema.fenixwireless.com.br/adm.php';
const NAV_TIMEOUT_MS = 20000;

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

async function launchBrowser() {
  const { chromium } = require('playwright-core');
  if (process.env.VERCEL) {
    const chromiumBinary = (await import('@sparticuz/chromium')).default;
    return chromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),
      headless: true,
    });
  }
  return chromium.launch({ headless: true });
}

async function clickBySelector(page, selector, { inFrame } = {}) {
  const target = inFrame || page;
  const clicked = await target.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, selector);
  if (!clicked) throw new Error(`Elemento nao encontrado no IXC: ${selector}`);
}

function findLoginFrame(page) {
  return page.frames().find((f) => f.url().includes('/app/login'));
}

// O painel ocasionalmente deixa um overlay de fundo (#backgroundContent) preso
// na tela apos fechar um modal (ex: aviso de 2FA), bloqueando cliques em
// qualquer elemento abaixo dele. Chamamos isso antes de cada interacao
// sensivel em vez de confiar numa unica limpeza logo apos o login.
async function limparOverlay(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#backgroundContent').forEach((el) => el.remove());
  }).catch(() => {});
}

async function fazerLogin(page, email, senha) {
  let ultimaMensagemErro = null;
  page.on('response', async (res) => {
    if (!res.url().includes('/model/login/login.php') && !res.url().includes('api-module/auth/login')) return;
    try {
      const body = JSON.parse(await res.text());
      const item = Array.isArray(body) ? body[0] : body;
      if (item?.status === '0' || item?.tipo === 'erro') {
        const msg = item.messages?.[0]?.body || item.mensagem;
        if (typeof msg === 'string') ultimaMensagemErro = msg;
      }
    } catch { /* resposta nao-JSON, ignora */ }
  });

  await page.goto(ADM_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  let frame = findLoginFrame(page);
  await frame.locator('#email').fill(email);
  await frame.locator('#btn-next-login').click();
  await page.waitForTimeout(1500);

  frame = findLoginFrame(page);
  await frame.locator('#password').fill(senha);
  await page.waitForTimeout(300);
  await frame.locator('#btn-enter-login').click();
  await page.waitForTimeout(2000);

  // So deve haver conflito de sessao se um humano estiver logado na mesma conta
  // em paralelo (agora que reaproveitamos sessao entre chamadas, nao devemos
  // mais gerar esse conflito sozinhos). Mesmo assim, mantemos alguns cliques de
  // confirmacao como rede de seguranca.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    frame = findLoginFrame(page);
    if (!frame) break;
    await frame.locator('#btn-enter-login').click();
    await page.waitForTimeout(2200);
  }

  frame = findLoginFrame(page);
  if (frame) {
    throw new Error(
      ultimaMensagemErro
        ? `Falha ao autenticar no IXC: ${ultimaMensagemErro}`
        : 'Nao foi possivel autenticar no IXC (verifique e-mail/senha configurados, ou ha uma sessao presa que nao foi possivel encerrar)'
    );
  }

  // Modal de configuracao de 2FA pode aparecer com atraso apos o login; dispensamos
  // sem ativar (o botao so "adia" o aviso, nao habilita nada). Espera ativamente
  // por ele em vez de checar so uma vez, ja que pode nao ter renderizado ainda.
  const cancelBtn = page.locator('button[class*="button2FACancel"]');
  try {
    await cancelBtn.waitFor({ state: 'attached', timeout: 6000 });
    await cancelBtn.click();
    await page.waitForTimeout(1000);
  } catch { /* modal nao apareceu neste login - segue normalmente */ }

  await limparOverlay(page);
}

// Garante um contexto autenticado: tenta reaproveitar o storageState informado;
// se a sessao salva estiver expirada (ou nao existir), faz login de verdade.
async function garantirSessao(browser, storageState, email, senha) {
  if (storageState) {
    try {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, storageState });
      const page = await context.newPage();
      page.setDefaultTimeout(NAV_TIMEOUT_MS);
      await page.goto(ADM_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      if (!findLoginFrame(page)) {
        await limparOverlay(page);
        return { context, page };
      }
      await context.close();
    } catch { /* storageState invalido/corrompido ou sessao expirada - segue para login completo */ }
  }

  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  await fazerLogin(page, email, senha);
  return { context, page };
}

async function buscarBoletosAbertos(cpfInput, { storageState, onSessionUpdate } = {}) {
  const cpf = onlyDigits(cpfInput);
  if (cpf.length !== 11) throw new Error('CPF invalido: informe 11 digitos, sem pontos ou traco');

  const email = process.env.IXC_ADMIN_EMAIL;
  const senha = process.env.IXC_ADMIN_PASSWORD;
  if (!email || !senha) throw new Error('IXC_ADMIN_EMAIL/IXC_ADMIN_PASSWORD nao configurados no Vercel');

  const browser = await launchBrowser();
  try {
    const { context, page } = await garantirSessao(browser, storageState, email, senha);
    try {
      // Persiste a sessao assim que confirmada valida (reaproveitada ou recem-logada),
      // antes de seguir com o resto do fluxo - assim, mesmo que uma etapa mais
      // adiante falhe, a proxima chamada ja comeca reaproveitando esta sessao.
      if (onSessionUpdate) {
        await onSessionUpdate(await context.storageState());
      }

      await limparOverlay(page);
      const searchBox = page.locator('input[placeholder="Contém..."]');
      await searchBox.click({ force: true });
      await searchBox.pressSequentially(cpf, { delay: 40 });
      await page.waitForTimeout(1500);

      // A busca do IXC as vezes retorna mais de um registro (ex: dependentes no mesmo
      // endereco); usamos o card cujo CPF exibido bate exatamente com o pesquisado.
      // Le todos os resultados em uma unica chamada (evita reavaliar o DOM linha a
      // linha entre awaits, o que pode ficar defasado se a lista re-renderizar).
      await page.waitForTimeout(300);
      const match = await page.evaluate((cpfBusca) => {
        const onlyDigitsInner = (s) => String(s || '').replace(/\D/g, '');
        const spans = Array.from(document.querySelectorAll('span.id_razao_fantasia'));
        for (const span of spans) {
          const li = span.closest('li.x-cmp-searchbar-registro-listMaster');
          const cpfSpan = li?.querySelector('span.cnpj_cpf_email_entereco');
          const cpfLine = cpfSpan?.childNodes[0]?.textContent || '';
          if (onlyDigitsInner(cpfLine) === cpfBusca) {
            const raw = span.textContent || '';
            return { id: (raw.match(/\d+/) || [])[0] || null, nome: raw.replace(/^\d+/, '').trim() };
          }
        }
        return null;
      }, cpf);
      if (!match) throw new Error('Cliente nao encontrado no IXC para este CPF');
      const { id: clienteId, nome: clienteNome } = match;

      await clickBySelector(page, `li[id="${clienteId}"] span.id_razao_fantasia`);

      await page.waitForTimeout(3000);
      const clientFrame = page.frames().find((f) => f.url().includes('index_cliente'));
      if (!clientFrame) throw new Error('Painel do cliente nao abriu no IXC');
      await clickBySelector(page, '#edita_cliente', { inFrame: clientFrame });
      await page.waitForTimeout(2500);
      await limparOverlay(page);

      await page.locator('a.tabTitle:has-text("Financeiro")').click({ force: true });
      await page.waitForSelector('table tbody tr', { timeout: NAV_TIMEOUT_MS });
      await page.waitForTimeout(1000);

      const titulos = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const selecionados = [];
        rows.forEach((r) => {
          const cells = Array.from(r.querySelectorAll('td'));
          const statusCell = cells.find((c) => c.textContent.trim() === 'A receber');
          if (!statusCell) return;
          const checkbox = r.querySelector('input[type="checkbox"]');
          if (!checkbox) return;
          if (!checkbox.checked) checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          const idCell = cells[1]?.textContent?.trim();
          const datas = cells.filter((c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c.textContent.trim())).map((c) => c.textContent.trim());
          const valorCell = cells.find((c) => /^\d+[,.]\d{2}$/.test(c.textContent.trim()));
          // Coluna "Vencimento" vem depois de "Emissão" na tabela, entao a ultima data e o vencimento
          selecionados.push({ id: idCell, vencimento: datas[datas.length - 1] || null, valor: valorCell?.textContent.trim() || null });
        });
        return selecionados;
      });

      if (!titulos.length) {
        return { semBoletosPendentes: true, cliente: { id: clienteId, nome: clienteNome, cpf: cpfInput } };
      }
      await page.waitForTimeout(500);

      await limparOverlay(page);
      await clickBySelector(page, 'button[name="imprimir_goletos"]');
      await page.waitForSelector('#layout_impressao', { state: 'attached', timeout: NAV_TIMEOUT_MS });
      await limparOverlay(page);
      await page.locator('#layout_impressao').selectOption({ label: '3 por página personalizável + PIX Cobrança' });
      await page.waitForTimeout(500);

      const pdfResponsePromise = page.waitForResponse(
        (r) => (r.headers()['content-type'] || '').includes('pdf'),
        { timeout: 25000 }
      );
      await clickBySelector(page, 'form[name="cliente_contrato_rel_areceber_imprime"] #salvar');
      const pdfResp = await pdfResponsePromise;

      const refetch = await page.request.get(pdfResp.url());
      const pdfBuffer = await refetch.body();
      if (!pdfBuffer || pdfBuffer.length < 100) throw new Error('PDF de boletos retornado pelo IXC esta vazio ou corrompido');

      return {
        semBoletosPendentes: false,
        cliente: { id: clienteId, nome: clienteNome, cpf: cpfInput },
        titulos,
        pdfBuffer,
      };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

module.exports = { buscarBoletosAbertos };
