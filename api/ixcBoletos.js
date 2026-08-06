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
// IMPORTANTE: esta conta de admin permite apenas UMA sessao ativa por vez.
// Se o e-mail/senha configurados estiverem logados em outro navegador (ex: o
// proprio usuario usando o IXC ao mesmo tempo), rodar esta automacao vai
// encerrar aquela sessao para conseguir logar aqui.

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

async function login(page, email, senha) {
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
  await page.waitForTimeout(2500);

  // Conta de admin permite so uma sessao ativa: se houver conflito, um segundo
  // clique confirma e forca a nova sessao (mensagem: "Ja existe uma sessao ativa...")
  frame = findLoginFrame(page);
  if (frame) {
    await frame.locator('#btn-enter-login').click();
    await page.waitForTimeout(4000);
  }

  frame = findLoginFrame(page);
  if (frame) throw new Error('Nao foi possivel autenticar no IXC (verifique e-mail/senha configurados)');

  // Modal de configuracao de 2FA pode aparecer no primeiro acesso da sessao;
  // dispensamos sem ativar (o botao so "adia" o aviso, nao habilita nada)
  const cancelBtn = page.locator('button[class*="button2FACancel"]');
  if (await cancelBtn.count() > 0) {
    await cancelBtn.click();
    await page.waitForTimeout(1000);
  }
}

async function buscarBoletosAbertos(cpfInput) {
  const cpf = onlyDigits(cpfInput);
  if (cpf.length !== 11) throw new Error('CPF invalido: informe 11 digitos, sem pontos ou traco');

  const email = process.env.IXC_ADMIN_EMAIL;
  const senha = process.env.IXC_ADMIN_PASSWORD;
  if (!email || !senha) throw new Error('IXC_ADMIN_EMAIL/IXC_ADMIN_PASSWORD nao configurados no Vercel');

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    await login(page, email, senha);

    const searchBox = page.locator('input[placeholder="Contém..."]');
    await searchBox.click();
    await searchBox.pressSequentially(cpf, { delay: 40 });
    await page.waitForTimeout(1500);

    // A busca do IXC as vezes retorna mais de um registro (ex: dependentes no mesmo
    // endereco); usamos o card cujo CPF exibido bate exatamente com o pesquisado.
    const nameSpan = page.locator('span.id_razao_fantasia');
    const total = await nameSpan.count();
    let clienteId = null;
    let clienteNome = null;
    for (let i = 0; i < total; i++) {
      const container = nameSpan.nth(i).locator('xpath=ancestor::li[contains(@class,"x-cmp-searchbar-registro-listMaster")]');
      // O span tem CPF, e-mail e endereco juntos (separados por <br>); pega so a primeira linha (o CPF)
      const cpfText = await container.locator('span.cnpj_cpf_email_entereco').evaluate((el) => el.childNodes[0]?.textContent || '').catch(() => '');
      if (onlyDigits(cpfText) === cpf) {
        const raw = (await nameSpan.nth(i).textContent()) || '';
        clienteId = (raw.match(/\d+/) || [])[0];
        clienteNome = raw.replace(/^\d+/, '').trim();
        await nameSpan.nth(i).click();
        break;
      }
    }
    if (clienteId === null) throw new Error('Cliente nao encontrado no IXC para este CPF');

    await page.waitForTimeout(3000);
    const clientFrame = page.frames().find((f) => f.url().includes('index_cliente'));
    if (!clientFrame) throw new Error('Painel do cliente nao abriu no IXC');
    await clickBySelector(page, '#edita_cliente', { inFrame: clientFrame });
    await page.waitForTimeout(2500);

    await page.locator('a.tabTitle:has-text("Financeiro")').click();
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

    await clickBySelector(page, 'button[name="imprimir_goletos"]');
    await page.waitForSelector('#layout_impressao', { state: 'attached', timeout: NAV_TIMEOUT_MS });
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
    await browser.close();
  }
}

module.exports = { buscarBoletosAbertos };
