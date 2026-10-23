'use strict';

const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const SCREENSHOTS = path.resolve(__dirname, '../docs/screenshots');
const save = async (page, name) => {
  const target = path.join(SCREENSHOTS, name);
  await page.screenshot({path: target, fullPage: true, animations: 'disabled'});
  const image = fs.readFileSync(target);
  expect(image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))).toBeTruthy();
  expect(image.length).toBeGreaterThan(18000);
};

// Screenshots are captured from the REAL app rendered by Playwright Chromium,
// driven by an actual 3-client game. No compositing or mock UI.
// GitHub Actions runs this intentionally with CAPTURE_SHOWCASE=1 and commits the PNGs.
test('capture: six genuine Classic gameplay screens for the GitHub gallery', async ({browser}) => {
  test.skip(process.env.CAPTURE_SHOWCASE !== '1', 'Opt-in gallery capture only.');
  test.setTimeout(90000);
  fs.mkdirSync(SCREENSHOTS, {recursive:true});
  const desktopContext = await browser.newContext({viewport:{width:1366,height:870}, deviceScaleFactor:1});
  const phoneContexts = await Promise.all([0,1,2].map(()=>browser.newContext({
    viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true
  })));
  const [host,friendA,friendB] = await Promise.all(phoneContexts.map(ctx=>ctx.newPage()));
  const pages = [host,friendA,friendB];
  const names = ['Host','Asha','Charan'];
  try {
    const desktop = await desktopContext.newPage();
    await desktop.goto('/');
    await expect(desktop.getByRole('heading',{name:/One secret/})).toBeVisible();
    await save(desktop,'01-home-desktop.png');

    await host.goto('/');
    await expect(host.getByRole('heading',{name:/One secret/})).toBeVisible();
    await save(host,'02-home-mobile.png');

    await host.locator('#playerName').fill(names[0]);
    await host.locator('#maxPlayers').selectOption('3');
    await host.locator('#totalRounds').selectOption('3');
    await host.locator('#guessSeconds').selectOption('30');
    await host.locator('#createForm button[type="submit"]').click();
    await expect(host.locator('.code')).toBeVisible();
    const roomCode = (await host.locator('.code').innerText()).trim();
    for (let i=1;i<=2;i++) {
      await pages[i].goto('/?room='+roomCode);
      await pages[i].locator('#joinName').fill(names[i]);
      await pages[i].locator('#joinForm button[type="submit"]').click();
      await expect(pages[i].locator('.code')).toHaveText(roomCode);
      await pages[i].locator('[data-action="ready"]').click();
    }
    await expect(host.locator('[data-action="start"]')).toBeEnabled();
    await save(host,'03-lobby-mobile.png');
    await host.locator('[data-action="start"]').click();

    for (let round=1;round<=3;round++) {
      const roles = [];
      for(const page of pages){
        await expect(page.getByRole('heading',{name:'Check your secret card'})).toBeVisible();
        await expect(page.locator('#timer')).toHaveCount(0);
        await page.locator('[data-action="flip"]').click();
        roles.push((await page.locator('.role-card .role-title').innerText()).trim());
      }
      expect(roles.slice().sort()).toEqual(['Rama','Ravana','Sita'].sort());
      if (round===1) {
        const sita = pages[roles.indexOf('Sita')];
        await save(sita,'04-private-card-mobile.png');
      }
      for(const page of pages) await page.locator('[data-action="role-ready"]').click();
      const rama = pages[roles.indexOf('Rama')];
      const sitaName = names[roles.indexOf('Sita')];
      await expect(rama.getByRole('heading',{name:'The search for Sita'})).toBeVisible();
      await rama.locator('[data-action="select"]').filter({hasText:sitaName}).click();
      if(round===1) await save(rama,'05-rama-guess-mobile.png');
      rama.once('dialog', async dialog=>dialog.accept());
      await rama.locator('[data-action="guess"]').click();
      await expect(host.getByRole('heading',{name:'Rama found Sita!'})).toBeVisible();
      await expect(host.locator('.reveal-person')).toHaveCount(3);
      if(round===1) await save(host,'06-role-reveal-mobile.png');
      await host.locator('[data-action="next"]').click();
    }
    await expect(host.getByText('Final leaderboard')).toBeVisible();
    await save(host,'07-leaderboard-mobile.png');
    expect(fs.readdirSync(SCREENSHOTS).filter(name=>name.endsWith('.png'))).toHaveLength(7);
  } finally {
    await Promise.all([...phoneContexts,desktopContext].map(context=>context.close()));
  }
});
