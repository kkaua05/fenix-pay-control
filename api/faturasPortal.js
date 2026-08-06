// ============================================================
// FATURAS PORTAL - Automacao Playwright do Portal do Cliente
// ============================================================
// Faz login no portal https://sistema.fenixwireless.com.br usando o CPF
// do cliente (login e senha = CPF sem pontuacao), abre a fatura pendente
// e extrai o PDF direto do DOM (o portal injeta a fatura como
// data:application/pdf;base64 dentro de um <embed>, sem precisar simular
// o clique no botao de download do visualizador de PDF do navegador).

const LOGIN_URL = 'https://sistema.fenixwireless.com.br/central_assinante_web/login';
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
  // Ambiente local (dev): usa o Chromium instalado via `npx playwright install chromium`
  return chromium.launch({ headless: true });
}

// O portal usa icones de fonte (material-icons) cujo bounding-box por vezes
// fica zerado no Chromium headless, fazendo o .click() do Playwright falhar
// com "elemento nao visivel" mesmo com force:true. Disparar o evento de
// click diretamente no DOM contorna essa checagem sem depender do layout.
async function clickBySelector(page, selector) {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, selector);
  if (!clicked) throw new Error(`Elemento nao encontrado no portal: ${selector}`);
}

async function buscarFaturaPortal(cpfInput) {
  const cpf = onlyDigits(cpfInput);
  if (cpf.length !== 11) throw new Error('CPF invalido: informe 11 digitos, sem pontos ou traco');

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/model/login/login.php') && res.request().method() === 'POST',
      { timeout: NAV_TIMEOUT_MS }
    );

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('input.login:visible').first().fill(cpf);
    await page.locator('.tipo_login_senha input[type="password"]:visible').first().fill(cpf);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    const loginRes = await loginResponsePromise;
    const loginBody = JSON.parse(await loginRes.text());
    const loginResult = Array.isArray(loginBody) ? loginBody[0] : loginBody;

    if (!loginResult || loginResult.tipo !== 'sucesso' || !loginResult.mensagem?.dados_cliente) {
      const msg = typeof loginResult?.mensagem === 'string' ? loginResult.mensagem : 'CPF ou senha incorretos no portal';
      throw new Error(msg);
    }

    const dadosCliente = loginResult.mensagem.dados_cliente;
    if (onlyDigits(dadosCliente.cnpj_cpf) !== cpf) {
      throw new Error('Divergencia de CPF: o portal autenticou uma conta diferente da esperada');
    }

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const pagarFaturaBtn = page.locator('a[data-target="#modalConsultarFatura"]').first();
    try {
      await pagarFaturaBtn.waitFor({ state: 'attached', timeout: 12000 });
    } catch {
      return {
        semFaturaPendente: true,
        cliente: { id: dadosCliente.id, nome: dadosCliente.razao, cpf: dadosCliente.cnpj_cpf }
      };
    }

    const linha = await pagarFaturaBtn.evaluate((el) => {
      const row = el.closest('tr');
      const get = (label) => row?.querySelector(`[data-th="${label}"]`)?.textContent?.trim() || null;
      return { vencimento: get('Vencimento:'), valor: get('Valor:') };
    });

    await clickBySelector(page, 'a[data-target="#modalConsultarFatura"]');
    await page.waitForSelector('#modalConsultarFatura a[data-target="#modalImpressao"]', { state: 'attached' });
    await clickBySelector(page, '#modalConsultarFatura a[data-target="#modalImpressao"]');

    const embed = page.locator('#modalImpressao embed[src^="data:application/pdf"]').first();
    await embed.waitFor({ state: 'attached', timeout: NAV_TIMEOUT_MS });
    const dataUri = await embed.getAttribute('src');
    const tituloModal = await page.locator('#modalImpressao .modal-title').first().textContent().catch(() => '');
    const numeroFatura = (tituloModal.match(/\d+/) || [])[0] || null;

    const base64 = dataUri.split(',')[1];
    const pdfBuffer = Buffer.from(base64, 'base64');
    if (pdfBuffer.length < 100) throw new Error('PDF retornado pelo portal esta vazio ou corrompido');

    return {
      semFaturaPendente: false,
      cliente: { id: dadosCliente.id, nome: dadosCliente.razao, cpf: dadosCliente.cnpj_cpf },
      fatura: { numero: numeroFatura, vencimento: linha.vencimento, valor: linha.valor },
      pdfBuffer
    };
  } finally {
    await browser.close();
  }
}

module.exports = { buscarFaturaPortal };
